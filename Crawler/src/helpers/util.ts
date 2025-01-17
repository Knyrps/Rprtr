const msToTime = (ms: number): string => {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((ms % (1000 * 60)) / 1000);
    const milliseconds = ms % 1000;

    // Build the result, ensuring each unit is only shown if it's non-zero or necessary
    return `${hours > 0 ? hours + "h" : ""} ${
        minutes > 0 || hours > 0 ? minutes + "m" : ""
    } ${seconds > 0 || minutes > 0 || hours > 0 ? seconds + "s" : ""} ${
        milliseconds > 0 || hours > 0 || minutes > 0 || seconds > 0
            ? milliseconds + "ms"
            : ""
    }`.trim();
};

export { msToTime };
