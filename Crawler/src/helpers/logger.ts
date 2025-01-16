import { styleText } from "util";

const logger = {
    hr: () => {
        const width = process.stdout.columns || 80; // Get console width, default to 80 if not available
        console.log("-".repeat(width)); // Log a line with dashes spanning the entire width
    },
    log: (message: string) => {
        if (isVerbose()) {
            message = `${getTimeStamp()} ${message}`;
        }
        console.log(message); // Log a message to the console
    },
    info: (message: string) => {
        if (isVerbose()) {
            message = `${getTimeStamp()} ${message}`;
        }
        console.log(styleText("blueBright", message)); // Log an info message to the console
    },
    warn: (message: string) => {
        if (isVerbose()) {
            message = `${getTimeStamp()} ${message}`;
        }
        console.log(styleText("yellow", message)); // Log a warning message to the console
    },
    err: (message: string) => {
        if (isVerbose()) {
            message = `${getTimeStamp()} ${message}`;
        }
        console.log(styleText("red", message)); // Log an error message to the console
    },
    verbose: (message: string) => {
        if (isVerbose()) {
            message = `${getTimeStamp()} ${message}`;
            console.log(styleText("grey", message)); // Log a verbose message to the console if VERBOSE=true
        }
    },
};

function isVerbose(): boolean {
    return process.env.VERBOSE?.toLowerCase() === "true";
}

function getTimeStamp(): string {
    return `[${new Date().toLocaleTimeString()}]`; // Return the current time as a string
}

export { logger }; // Export the logLine function
