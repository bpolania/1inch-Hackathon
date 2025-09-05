/**
 * Structured Logging Utility
 * 
 * Provides structured logging for the automated relayer service with
 * different levels and formatting options.
 */

export interface LogEntry {
    timestamp: string;
    level: string;
    message: string;
    data?: any;
    service: string;
}

export class Logger {
    private serviceName: string;

    constructor(serviceName: string = '1inch-fusion-relayer') {
        this.serviceName = serviceName;
    }

    private formatMessage(level: string, message: string, data?: any): string {
        const entry: LogEntry = {
            timestamp: new Date().toISOString(),
            level: level.toUpperCase(),
            message,
            service: this.serviceName
        };

        if (data !== undefined) {
            entry.data = data;
        }

        // For now, use simple console formatting
        // In production, this could be JSON format for log aggregation
        const timestamp = entry.timestamp;
        const levelStr = `[${entry.level}]`.padEnd(7);
        const dataStr = data ? ` | ${JSON.stringify(data, (key, value) => 
            typeof value === 'bigint' ? value.toString() : value
        )}` : '';
        
        return `${timestamp} ${levelStr} ${message}${dataStr}`;
    }

    info(message: string, data?: any): void {
        console.log(this.formatMessage('info', message, data));
    }

    warn(message: string, data?: any): void {
        console.warn(this.formatMessage('warn', message, data));
    }

    error(message: string, data?: any): void {
        console.error(this.formatMessage('error', message, data));
    }

    debug(message: string, data?: any): void {
        if (process.env.LOG_LEVEL === 'debug') {
            console.log(this.formatMessage('debug', message, data));
        }
    }

    success(message: string, data?: any): void {
        // Success is just info with a specific prefix
        console.log(this.formatMessage('info', ` ${message}`, data));
    }

    transaction(message: string, txHash: string, explorerUrl?: string): void {
        const data = { txHash, explorerUrl };
        console.log(this.formatMessage('info', ` ${message}`, data));
    }

    profit(message: string, amount: string, currency: string = 'ETH'): void {
        const data = { amount, currency };
        console.log(this.formatMessage('info', ` ${message}`, data));
    }

    execution(message: string, orderHash: string, step?: string): void {
        const data = { orderHash, step };
        console.log(this.formatMessage('info', ` ${message}`, data));
    }
}

// Export singleton instance
export const logger = new Logger();