import axios from "axios";
import { getDomain, getDomainWithoutSuffix } from "tldts";
import { load } from "cheerio";
import { logger } from "./helpers/logger";
import { appendUrlsToFile, urlsToFile } from "./helpers/ioHelper";

function onlyUnique(value: any, index: number, array: Array<any>) {
    return array.indexOf(value) === index;
}

/**
 * Crawls over the given URL and its links recursively. (Legacy)
 * @param url The URL to crawl
 * @param anyTLD Whether to allow any TLD (Top-Level Domain)
 * @param ignoreQueryParams Whether to ignore query parameters (e.g. example.com?utm_source=... === example.com)
 * @param ignoreCase Whether to ignore case sensitivity (e.g. example.com === EXAMPLE.COM)
 * @param maxDepth Maximum recursion depth
 * @returns
 */
const crawl = async (
    url: string,
    anyTLD: boolean = false,
    ignoreQueryParams: boolean = true,
    ignoreCase: boolean = true,
    maxDepth: number = 10,
    depth = 0,
    visited = new Set<string>(),
    counters = { crawled: 0, skipped: 0, error: 0 }, // Track different types
    startTime = Date.now(), // Track start time for time elapsed
    remainingLinks: string[] = [] // Track remaining links to be crawled
): Promise<{ counters: typeof counters; timeElapsed: number }> => {
    if (ignoreCase) {
        url = url.toLowerCase();
    }

    if (depth > maxDepth || visited.has(url)) {
        // Increment skipped counter if URL is skipped
        return { counters, timeElapsed: Date.now() - startTime };
    }
    visited.add(url);

    try {
        const { data } = await axios.get(url).catch((error) => {
            if (error.response && error.response.status !== 404) {
                counters.error++; // Increment error counter for failed crawls
                throw new Error(`Failed to fetch ${url}: ${error.message}`);
            }

            logger.warn(`Skipping: ${url} (404 Not Found)`);
            counters.skipped++; // Increment skipped counter if 404
            return { data: null };
        });

        if (!data) {
            counters.skipped++; // Increment skipped if no data
            return { counters, timeElapsed: Date.now() - startTime };
        }

        const $ = load(data);

        logger.log(`Crawling: ${url}`);

        const baseDomain = anyTLD
            ? getDomainWithoutSuffix(url)
            : getDomain(url);

        const links = $("a[href]")
            .map((_, el) => $(el).attr("href"))
            .get()
            .filter((href) => href && !href.startsWith("#"))
            .map((href) => new URL(href, url))
            .filter(
                (href) =>
                    href.protocol === "http:" || href.protocol === "https:"
            )
            .filter(
                (href) =>
                    (anyTLD
                        ? getDomainWithoutSuffix(href.href)
                        : getDomain(href.href)) === baseDomain
            )
            .map((href) => {
                if (ignoreQueryParams) {
                    return href.href.split("?")[0];
                } else {
                    return href.href;
                }
            })
            .filter((href) => !visited.has(href));

        counters.crawled++; // Increment crawled counter after crawling a URL

        // Track the remaining links
        remainingLinks.push(...links);

        await Promise.all(
            links.map(async (link) => {
                const result = await crawl(
                    link,
                    anyTLD,
                    ignoreQueryParams,
                    ignoreCase,
                    maxDepth,
                    depth + 1,
                    visited,
                    counters,
                    startTime,
                    remainingLinks // Pass remainingLinks to the next recursive call
                );
                counters = result.counters; // Merge counters from recursive calls
            })
        );
    } catch (error: any) {
        logger.err(`Failed to crawl ${url}: ${error.message}`);
        counters.error++; // Increment error counter if any error occurs
    }

    return { counters, timeElapsed: Date.now() - startTime }; // Return counters and time elapsed
};

type CrawlerCounters = { crawled: number; skipped: number; error: number };

class Crawler {
    private _maxConcurrentThreads: number;
    private _queue: Set<string>;
    private _alreadyCrawled: Set<string> = new Set();

    private _anyTLD: boolean;
    private _ignoreQueryParams: boolean;
    private _ignoreCase: boolean;
    private _baseDomain: string | null = null;

    private _outFile: string | undefined;
    private _skipCodes: number[] = [404];

    private _lastQueueSize: number = 0;
    private _counters: CrawlerCounters = { crawled: 0, skipped: 0, error: 0 };
    private _startTime: number = 0;
    private _batchesCrawled: number = 0;

    constructor(
        anyTLD: boolean = false,
        ignoreQueryParams: boolean = true,
        ignoreCase: boolean = true
    ) {
        this._maxConcurrentThreads = parseInt(
            process.env.MAX_CONCURRENT_THREADS || "10"
        );
        this._anyTLD = anyTLD;
        this._ignoreQueryParams = ignoreQueryParams;
        this._ignoreCase = ignoreCase;
        this._queue = new Set();
        this._skipCodes = process.env.SKIP_CODES?.split(",").map(Number) || [];
        this._outFile = process.env.OUT_FILE;
    }

    public async crawl(url: string) {
        this._startTime = Date.now();

        this._baseDomain = this._anyTLD
            ? getDomainWithoutSuffix(url)
            : getDomain(url);

        if (!this._baseDomain) {
            logger.err(`Invalid URL: ${url}`);
        }

        this.configStatus();

        const links = await this.extractLinks(url);
        links.forEach((link) => this.push(link));

        this._batchesCrawled++;

        while (this._queue.size > 0) {
            // Take a batch of URLs from the queue and crawl them concurrently
            const batch = this.takeAndRemove();

            await Promise.all(
                batch.map(async (url) => {
                    const links = await this.extractLinks(url);
                    links.forEach((link) => this.push(link));
                })
            );
            appendUrlsToFile(this._outFile, sortAndFilterUrls(batch));

            this._batchesCrawled++;
        }

        this.status(true);

        urlsToFile(this._outFile, sortAndFilterUrls(this._alreadyCrawled));

        return this._alreadyCrawled;
    }

    public status(log: boolean = false): {
        batchesCrawled: number;
        counters: CrawlerCounters;
        timeElapsed: number;
    } {
        if (this._startTime === 0) {
            throw new Error("Crawler hasn't started yet");
        }
        const timeElapsed = Date.now() - this._startTime;
        if (process.env.VERBOSE?.toLowerCase() === "true" || log) {
            logger.hr();
            logger.log(
                `Crawled ${this._counters.crawled} pages (${this._batchesCrawled} batches) in ${timeElapsed}ms`
            );
            logger.warn(`Skipped: ${this._counters.skipped}`);
            logger.err(`Errors: ${this._counters.error}`);
            logger.hr();
        }

        return {
            batchesCrawled: this._batchesCrawled,
            counters: this._counters,
            timeElapsed: timeElapsed,
        };
    }

    private configStatus(): {
        baseDomain: string;
        anyTLD: boolean;
        ignoreQueryParams: boolean;
        ignoreCase: boolean;
        skipCodes: number[];
        maxConcurrentThreads: number;
    } {
        if (process.env.VERBOSE?.toLowerCase() === "true") {
            logger.hr();
            logger.info("Configuration:");
            logger.info(`Base domain: ${this._baseDomain}`);
            logger.info(`Any TLD: ${this._anyTLD}`);
            logger.info(`Ignore query params: ${this._ignoreQueryParams}`);
            logger.info(`Ignore case: ${this._ignoreCase}`);
            logger.info(`Skip codes: ${this._skipCodes.join(", ")}`);
            logger.info(
                `Max concurrent threads: ${this._maxConcurrentThreads}`
            );
            logger.hr();
        }

        return {
            baseDomain: this._baseDomain || "[invalid]",
            anyTLD: this._anyTLD,
            ignoreQueryParams: this._ignoreQueryParams,
            ignoreCase: this._ignoreCase,
            skipCodes: this._skipCodes,
            maxConcurrentThreads: this._maxConcurrentThreads,
        };
    }

    private batchStatus(len: number): {
        batchesCrawled: number;
        counters: CrawlerCounters;
        queueSize: number;
        trend: string;
        diff: number;
    } {
        var queueIsRising = this._queue.size > this._lastQueueSize;
        if (process.env.VERBOSE?.toLowerCase() === "true") {
            logger.divide();
            logger.log(
                `Crawling batch ${this._batchesCrawled} (${len} pages)...`
            );
            logger.info(
                `Total processed: ${
                    this._counters.crawled +
                    this._counters.skipped +
                    this._counters.error
                } (Crawled: ${this._counters.crawled}, Skipped: ${
                    this._counters.skipped
                }, Errors: ${this._counters.error})`
            );
            logger.info(`Current queue size: ${this._queue.size}`);
            logger.info(
                `Queue size trend: ${queueIsRising ? "up" : "down"} (diff: ${
                    queueIsRising ? "+" : ""
                }${this._queue.size - this._lastQueueSize})`
            );
            logger.divide();
            this._lastQueueSize = this._queue.size;
        }

        return {
            batchesCrawled: this._batchesCrawled,
            counters: this._counters,
            queueSize: this._queue.size,
            trend: queueIsRising ? "up" : "down",
            diff: this._queue.size - this._lastQueueSize,
        };
    }

    private async extractLinks(url: string): Promise<string[]> {
        try {
            let statusCode = 200;
            let statusText = "OK";
            let timesRedirected = 0;
            const { data } = await axios
                .get(url)
                .then((res) => {
                    timesRedirected = res.request._redirectable._redirectCount;
                    statusCode = res.status;
                    statusText = res.statusText;
                    return res;
                })
                .catch((error) => {
                    if (
                        error.response &&
                        !this._skipCodes.includes(error.response.status)
                    ) {
                        this._counters.error++;
                        throw new Error(
                            `Failed to fetch ${url}: ${error.message}`
                        );
                    }

                    logger.warn(
                        `Skipping: ${url} [${error.response.status} ${error.response.statusText}]`
                    );
                    this._counters.skipped++;
                    return { data: null };
                });

            if (!data) {
                this._counters.skipped++;
                return [];
            }

            const $ = load(data);

            let logHref: string = url;

            if (process.env.VERBOSE?.toLowerCase() === "true") {
                logHref = `${logHref} [${statusCode} ${statusText}] ${
                    timesRedirected > 0
                        ? `(${timesRedirected}x redirected)`
                        : ""
                }`;
            }

            logger.log(`Crawling: ${logHref}`);

            return $("a[href]")
                .map((_, el) => $(el).attr("href"))
                .get()
                .filter((href) => href && !href.startsWith("#"))
                .map((href) => new URL(href, url))
                .filter(
                    (href) =>
                        href.protocol === "http:" || href.protocol === "https:"
                )
                .filter(
                    (href) =>
                        (this._anyTLD
                            ? getDomainWithoutSuffix(href.href)
                            : getDomain(href.href)) === this._baseDomain
                )
                .map((href) => href.href);
        } catch (error: any) {
            logger.err(`Failed to crawl ${url}: ${error.message}`);
            this._counters.error++;
            return [];
        } finally {
            this._counters.crawled++;
        }
    }

    private push(url: string) {
        if (this._ignoreCase) {
            url = url.toLowerCase();
        }

        if (this._ignoreQueryParams) {
            url = url.split("?")[0];
        }

        if (this._alreadyCrawled.has(url)) {
            return;
        }

        this._queue.add(url); // Set prevents duplicates
    }

    private takeAndRemove(): string[] {
        const result: string[] = [];
        for (const item of this._queue) {
            if (result.length >= this._maxConcurrentThreads) break;
            result.push(item);
        }

        this.batchStatus(result.length);
        result.forEach((item) => {
            this._queue.delete(item); // Remove taken items from the set
            this._alreadyCrawled.add(item); // Add to already crawled set
        });
        return result;
    }
}

const sortAndFilterUrls = (urls: string[] | Set<string>): string[] => {
    if (urls instanceof Set) {
        urls = Array.from(urls);
    }
    return urls.sort((a, b) => {
        // Remove the domain part and split the remaining URL by "/"
        const pathA = new URL(a).pathname
            .split("/")
            .filter((segment) => segment !== "");
        const pathB = new URL(b).pathname
            .split("/")
            .filter((segment) => segment !== "");

        // Compare the paths segment by segment
        for (let i = 0; i < Math.min(pathA.length, pathB.length); i++) {
            if (pathA[i] < pathB[i]) return -1;
            if (pathA[i] > pathB[i]) return 1;
        }

        // If paths are equal so far, compare by length (shorter URLs come first)
        return pathA.length - pathB.length;
    });
};

export default Crawler;
export { crawl as crawlLegacy };
export { sortAndFilterUrls };
