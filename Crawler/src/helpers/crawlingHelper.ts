import axios from "axios";
import { getDomain, getDomainWithoutSuffix } from "tldts";
import { load } from "cheerio";
import { logger } from "./logger";

function onlyUnique(value: any, index: number, array: Array<any>) {
    return array.indexOf(value) === index;
}

/**
 * Crawls over the given URL and its links recursively.
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
            });

        counters.crawled++; // Increment crawled counter after crawling a URL

        // Track the remaining links
        remainingLinks.push(...links);

        for (const link of links) {
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
        }
    } catch (error: any) {
        logger.err(`Failed to crawl ${url}: ${error.message}`);
        counters.error++; // Increment error counter if any error occurs
    }

    return { counters, timeElapsed: Date.now() - startTime }; // Return counters and time elapsed
};

export { crawl };
