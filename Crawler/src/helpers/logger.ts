import { styleText } from "util";

const logger = {
    hr: () => {
        const width = process.stdout.columns || 80; // Get console width, default to 80 if not available
        console.log("-".repeat(width)); // Log a line with dashes spanning the entire width
    },
    log: (message: string, timestamp: boolean = false) => {
        if (timestamp) {
            message = `${getTimeStamp()} ${message}`;
        }
        console.log(message); // Log a message to the console
    },
    info: (message: string, timestamp: boolean = false) => {
        if (timestamp) {
            message = `${getTimeStamp()} ${message}`;
        }
        console.log(styleText("blueBright", message)); // Log an info message to the console
    },
    warn: (message: string, timestamp: boolean = false) => {
        if (timestamp) {
            message = `${getTimeStamp()} ${message}`;
        }
        console.log(styleText("yellow", message)); // Log a warning message to the console
    },
    err: (message: string, timestamp: boolean = false) => {
        if (timestamp) {
            message = `${getTimeStamp()} ${message}`;
        }
        console.log(styleText("red", message)); // Log an error message to the console
    },
};

function getTimeStamp(): string {
    return `[${new Date().toLocaleTimeString()}]`; // Return the current time as a string
}

export { logger }; // Export the logLine function
