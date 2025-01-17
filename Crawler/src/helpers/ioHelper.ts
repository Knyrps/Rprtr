import fs from "fs";
import { logger } from "./logger";

const toOutFile = (fileName: string | undefined, data: Array<string>): void => {
    if (!fileName) {
        logger.err("No file name provided");
        return;
    }
    const content = data.join("\n");

    fs.writeFile(fileName, content, (err) => {
        if (err) {
            logger.err(`Error writing to file: ${err}`);
        } else {
            logger.verbose(`Data successfully written to ${fileName}`);
        }
    });
};

const appendToOutFile = (
    fileName: string | undefined,
    data: Array<string>
): void => {
    if (!fileName) {
        logger.err("No file name provided");
        return;
    }
    const content = data.join("\n") + "\n";

    fs.appendFile(fileName, content, (err) => {
        if (err) {
            logger.err(`Error writing to file: ${err}`);
        } else {
            logger.info(`Data successfully written to ${fileName}`);
        }
    });
};

const toSitemapFile = (fileName: string | undefined, data: string[]): void => {
    if (!fileName) {
        logger.err("No file name provided");
        return;
    }
    if (!fileName.endsWith(".xml")) {
        logger.err("Sitemap file must be an XML file");
        return;
    }
    let sitemapXML = '<?xml version="1.0" encoding="UTF-8"?>\n';
    sitemapXML +=
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

    data.forEach((url) => {
        sitemapXML += `  <url>\n`;
        sitemapXML += `    <loc>${url}</loc>\n`;
        sitemapXML += `  </url>\n`;
    });

    sitemapXML += "</urlset>";

    fs.writeFile(fileName, sitemapXML, (err) => {
        if (err) {
            logger.err(`Error writing to file: ${err}`);
        } else {
            logger.info(`Data successfully written to ${fileName}`);
        }
    });
};

export {
    toOutFile as urlsToFile,
    appendToOutFile as appendUrlsToFile,
    toSitemapFile as generateSitemap,
};
