/**
 * Logger utility for TEE Shade Agent
 */

import winston from 'winston';

const logLevel = process.env.LOG_LEVEL || 'info';
const logFormat = process.env.LOG_FORMAT || 'json';

const baseLogger = winston.createLogger({
    level: logLevel,
    format: logFormat === 'json' 
        ? winston.format.combine(
            winston.format.timestamp(),
            winston.format.errors({ stack: true }),
            winston.format.json()
          )
        : winston.format.combine(
            winston.format.timestamp(),
            winston.format.errors({ stack: true }),
            winston.format.simple()
          ),
    transports: [
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
            )
        })
    ]
});

// Extend logger with custom quote method
export const logger = Object.assign(baseLogger, {
    quote: (message: string, meta?: any) => {
        baseLogger.info(`💰 QUOTE: ${message}`, meta);
    }
});

export default logger;