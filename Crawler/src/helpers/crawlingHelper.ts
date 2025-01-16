import axios from "axios";
import { getDomain, getDomainWithoutSuffix } from "tldts";
import { load } from "cheerio";
import { logger } from "./logger";

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

    private _anyTLD: boolean;
    private _ignoreQueryParams: boolean;
    private _ignoreCase: boolean;
    private _counters: CrawlerCounters = { crawled: 0, skipped: 0, error: 0 };
    private _baseDomain: string | null = null;

    private _lastQueueSize: number = 0;

    constructor(
        maxConcurrentThreads: number = 10,
        anyTLD: boolean = false,
        ignoreQueryParams: boolean = true,
        ignoreCase: boolean = true
    ) {
        this._maxConcurrentThreads = maxConcurrentThreads;
        this._anyTLD = anyTLD;
        this._ignoreQueryParams = ignoreQueryParams;
        this._ignoreCase = ignoreCase;
        this._queue = new Set();
    }

    public async crawl(url: string) {
        this._baseDomain = this._anyTLD
            ? getDomainWithoutSuffix(url)
            : getDomain(url);

        if (!this._baseDomain) {
            logger.err(`Invalid URL: ${url}`);
        }

        const links = await this.extractLinks(url);
        links.forEach((link) => this.push(link));

        while (this._queue.size > 0) {
            // Take a batch of URLs from the queue and crawl them concurrently
            const batch = this.takeAndRemove(
                this._queue,
                this._maxConcurrentThreads
            );

            if (process.env.VERBOSE?.toLowerCase() === "true") {
                logger.divide();
                logger.log(`Crawling ${batch.length} pages...`);
                logger.info(`Current queue size: ${this._queue.size}`);
                var queueIsRising = this._queue.size > this._lastQueueSize;
                logger.info(
                    `Queue size trend: ${
                        queueIsRising ? "up" : "down"
                    } (diff: ${queueIsRising ? "+" : ""}${
                        this._queue.size - this._lastQueueSize
                    })`
                );
                logger.divide();
                this._lastQueueSize = this._queue.size;
            }

            await Promise.all(
                batch.map(async (url) => {
                    const links = await this.extractLinks(url);
                    links.forEach((link) => this.push(link));
                })
            );
        }

        this.status(true);
    }

    public status(log: boolean = false): { counters: CrawlerCounters } {
        if (process.env.VERBOSE?.toLowerCase() === "true" || log) {
            logger.hr();
            logger.log(`Crawled ${this._counters.crawled} pages in ${0}ms`);
            logger.warn(`Skipped: ${this._counters.skipped}`);
            logger.err(`Errors: ${this._counters.error}`);
            logger.hr();
        }

        return {
            counters: this._counters,
        };
    }

    private async extractLinks(url: string): Promise<string[]> {
        try {
            const { data } = await axios.get(url).catch((error) => {
                if (error.response && error.response.status !== 404) {
                    this._counters.error++;
                    throw new Error(`Failed to fetch ${url}: ${error.message}`);
                }

                logger.warn(`Skipping: ${url} (404 Not Found)`);
                this._counters.skipped++;
                return { data: null };
            });

            if (!data) {
                this._counters.skipped++;
                return [];
            }

            const $ = load(data);

            logger.log(`Crawling: ${url}`);

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

        this._queue.add(url); // Set prevents duplicates
    }

    private takeAndRemove<T>(set: Set<T>, n: number): T[] {
        const result: T[] = [];
        for (const item of set) {
            if (result.length >= n) break;
            result.push(item);
        }
        result.forEach((item) => set.delete(item)); // Remove taken items from the set
        return result;
    }
}

export default Crawler;
export { crawl as crawlLegacy };
