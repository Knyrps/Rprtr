import Crawler, { crawlLegacy, sortAndFilterUrls } from "./crawler";
import { urlsToFile } from "./helpers/ioHelper";

(async () => {
    // const startUrl = "https://pc-notdienst-freiburg.de/";
    const startUrl = "https://macaw.net/";
    const anyTLD = true;
    const ignoreQueryParams = false;
    const ignoreCase = false;

    // const maxDepth = 10; // Legacy crawler only
    // const maxConcurrentThreads = 10; // Now in .env

    // const res = await crawlLegacy(
    //     startUrl,
    //     anyTLD,
    //     ignoreQueryParams,
    //     ignoreCase,
    //     maxDepth
    // );

    const crawler = new Crawler(anyTLD, ignoreQueryParams, ignoreCase);

    // Fire and forget
    const results = await crawler.crawl(startUrl);

    const urlArray = sortAndFilterUrls(results);

    // urlsToFile("C:/Dump/output.txt", urlArray);
    // Irrelevant if await is commented out
    // crawler.status();
})();
