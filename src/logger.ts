import winston from "winston";

const { createLogger, format, transports } = winston;
const { combine, timestamp, label, prettyPrint } = format;

// Logger configuration
const logConfiguration = {
    level: "debug",
    format: combine(
        // format.colorize(),
        format.json(),
        timestamp(),
        prettyPrint()
    ),
    transports: [
        new winston.transports.Console()
    ]
};

export interface Logger {
    error(msg: string, err: Error): void;
    info(msg: string): void;
    debug(msg: string): void;
}

const winstonLogger = winston.createLogger(logConfiguration);

export const loggerFor = (fileName: string): Logger => {
    const source = fileName.substring(fileName.indexOf("argo-clinical"));
    return {
        error: (msg: string, err: Error): void => {
            winstonLogger.error(msg, {source});
        },
        debug: (msg: string): void => {
            winstonLogger.debug(msg, { source });
        },
        info: (msg: string): void => {
            winstonLogger.info(msg, { source });
        }
    };
};

