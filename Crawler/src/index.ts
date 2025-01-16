import Crawler, { crawlLegacy } from "./helpers/crawlingHelper";
import { logger } from "./helpers/logger";

(async () => {
    const startUrl = "https://macaw.net";
    const anyTLD = true;
    const maxDepth = 10; // Legacy crawler only
    const ignoreQueryParams = false;
    const maxConcurrentThreads = 10;
    const ignoreCase = false;

    // const res = await crawlLegacy(
    //     startUrl,
    //     anyTLD,
    //     ignoreQueryParams,
    //     ignoreCase,
    //     maxDepth
    // );

    const crawler = new Crawler(
        maxConcurrentThreads,
        anyTLD,
        ignoreQueryParams,
        ignoreCase
    );

    // Fire and forget
    /* await */ crawler.crawl(startUrl);

    // Irrelevant if await is commented out
    // crawler.status();
})();
