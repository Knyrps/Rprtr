import { crawl } from "./helpers/crawlingHelper";
import { logger } from "./helpers/logger";

(async () => {
    const startUrl = "https://macaw.net";
    const anyTLD = true;
    const maxDepth = 10;
    const ignoreQueryParams = false;
    const ignoreCase = false;

    const res = await crawl(
        startUrl,
        anyTLD,
        ignoreQueryParams,
        ignoreCase,
        maxDepth
    );

    logger.hr();
    logger.log("Crawling complete!");
    logger.log(`Crawled ${res.counters.crawled} pages in ${res.timeElapsed}ms`);
    logger.warn(`Skipped: ${res.counters.skipped}`);
    logger.err(`Errors: ${res.counters.error}`);
})();
