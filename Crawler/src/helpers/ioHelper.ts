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
            logger.info(`Data successfully written to ${fileName}`);
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

export { toOutFile as urlsToFile, appendToOutFile as appendUrlsToFile };
