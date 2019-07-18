import winston from "winston";
const { createLogger, format, transports } = winston;
const { combine, timestamp, label, prettyPrint, json } = format;

// read the log level from the env directly since this is a very high priority value.
const LOG_LEVEL = process.env.LOG_LEVEL || "debug";
console.log("log level configured: ", LOG_LEVEL);

// Logger configuration
const logConfiguration = {
  level: LOG_LEVEL,
  format: combine(
    // format.colorize(),
    json(),
    timestamp(),
    prettyPrint()
  ),
  transports: [new winston.transports.Console()]
};

export interface Logger {
  error(msg: string, err: Error): void;
  info(msg: string): void;
  debug(msg: string): void;
}

const winstonLogger = winston.createLogger(logConfiguration);
console.log("logger configured: ", winstonLogger);

export const loggerFor = (fileName: string): Logger => {
  console.debug("creating logger for", fileName);
  const source = fileName.substring(fileName.indexOf("argo-clinical"));
  return {
    error: (msg: string, err: Error): void => {
      winstonLogger.error(msg, err, { source });
    },
    debug: (msg: string): void => {
      winstonLogger.debug(msg, { source });
    },
    info: (msg: string): void => {
      winstonLogger.info(msg, { source });
    }
  };
};
