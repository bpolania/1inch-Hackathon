/**
 * TEE Solver Logger
 * 
 * Simple logging utility for the TEE solver
 * Reuses patterns from our existing logger
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  data?: any;
}

class Logger {
  private logLevel: LogLevel = LogLevel.INFO;

  constructor() {
    // Set log level from environment
    const envLevel = process.env.LOG_LEVEL?.toUpperCase();
    switch (envLevel) {
      case 'DEBUG':
        this.logLevel = LogLevel.DEBUG;
        break;
      case 'INFO':
        this.logLevel = LogLevel.INFO;
        break;
      case 'WARN':
        this.logLevel = LogLevel.WARN;
        break;
      case 'ERROR':
        this.logLevel = LogLevel.ERROR;
        break;
    }
  }

  debug(message: string, data?: any): void {
    if (this.logLevel <= LogLevel.DEBUG) {
      this.log('DEBUG', message, data);
    }
  }

  info(message: string, data?: any): void {
    if (this.logLevel <= LogLevel.INFO) {
      this.log('INFO', message, data);
    }
  }

  warn(message: string, data?: any): void {
    if (this.logLevel <= LogLevel.WARN) {
      this.log('WARN', message, data);
    }
  }

  error(message: string, data?: any): void {
    if (this.logLevel <= LogLevel.ERROR) {
      this.log('ERROR', message, data);
    }
  }

  // Specialized logging methods
  quote(message: string, data?: any): void {
    this.info(`💭 QUOTE: ${message}`, data);
  }

  execution(message: string, data?: any): void {
    this.info(`⚡ EXEC: ${message}`, data);
  }

  signature(message: string, data?: any): void {
    this.info(`🔐 SIG: ${message}`, data);
  }

  tee(message: string, data?: any): void {
    this.info(`🛡️ TEE: ${message}`, data);
  }

  private log(level: string, message: string, data?: any): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      data
    };

    // Format output
    let output = `${entry.timestamp} [${level.padEnd(5)}] ${message}`;
    if (data) {
      output += ` ${JSON.stringify(data)}`;
    }

    // Output to console
    switch (level) {
      case 'DEBUG':
        console.debug(output);
        break;
      case 'INFO':
        console.log(output);
        break;
      case 'WARN':
        console.warn(output);
        break;
      case 'ERROR':
        console.error(output);
        break;
    }
  }
}

export const logger = new Logger();