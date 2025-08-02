/**
 * Centralized logging utility
 */

interface LogLevel {
  level: string;
  color: string;
}

const LOG_LEVELS: Record<string, LogLevel> = {
  error: { level: 'ERROR', color: '\x1b[31m' }, // Red
  warn: { level: 'WARN', color: '\x1b[33m' },   // Yellow
  info: { level: 'INFO', color: '\x1b[36m' },   // Cyan
  debug: { level: 'DEBUG', color: '\x1b[35m' }  // Magenta
};

const RESET_COLOR = '\x1b[0m';

class Logger {
  private formatMessage(level: LogLevel, message: string, data?: any): string {
    const timestamp = new Date().toISOString();
    const prefix = `${level.color}[${timestamp}] ${level.level}${RESET_COLOR}`;
    
    if (data) {
      try {
        // Handle BigInt serialization by converting to string
        const serializedData = JSON.stringify(data, (key, value) =>
          typeof value === 'bigint' ? value.toString() : value
        );
        return `${prefix} ${message} ${serializedData}`;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return `${prefix} ${message} [Data serialization failed: ${errorMessage}]`;
      }
    }
    
    return `${prefix} ${message}`;
  }

  error(message: string, data?: any): void {
    console.error(this.formatMessage(LOG_LEVELS.error, message, data));
  }

  warn(message: string, data?: any): void {
    console.warn(this.formatMessage(LOG_LEVELS.warn, message, data));
  }

  info(message: string, data?: any): void {
    console.info(this.formatMessage(LOG_LEVELS.info, message, data));
  }

  debug(message: string, data?: any): void {
    if (process.env.NODE_ENV === 'development') {
      console.debug(this.formatMessage(LOG_LEVELS.debug, message, data));
    }
  }
}

export const logger = new Logger();