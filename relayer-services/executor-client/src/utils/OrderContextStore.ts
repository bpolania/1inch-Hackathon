/**
 * Order Context Store
 * 
 * Provides persistent storage for order contexts to survive relayer restarts.
 * Uses file-based storage for simplicity, can be upgraded to database later.
 */

import * as fs from 'fs';
import * as path from 'path';
import { logger } from './logger';

export interface OrderContext {
    orderHash: string;
    chainId: number;
    maker: string;
    srcToken: string;
    srcAmount: string;
    dstChainId: number;
    dstExecutionParams: any;
    expiryTime: number;
    hashlock: string;
    secret?: string;
    createdAt: number;
    updatedAt: number;
    status: 'pending' | 'htlc_created' | 'htlc_funded' | 'secret_revealed' | 'claimed' | 'expired' | 'failed';
    bitcoin?: {
        htlcAddress?: string;
        htlcScript?: string;
        fundingTxId?: string;
        fundingAmount?: number;
        claimingTxId?: string;
        refundTxId?: string;
    };
    error?: string;
}

export class OrderContextStore {
    private storePath: string;
    private contexts: Map<string, OrderContext>;
    private saveDebounceTimer: NodeJS.Timeout | null = null;

    constructor(dataDir: string = './data') {
        this.storePath = path.join(dataDir, 'order-contexts.json');
        this.contexts = new Map();
        this.ensureDataDir();
        this.load();
    }

    /**
     * Ensure data directory exists
     */
    private ensureDataDir(): void {
        const dir = path.dirname(this.storePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
            logger.info(`Created data directory: ${dir}`);
        }
    }

    /**
     * Load contexts from disk
     */
    private load(): void {
        try {
            if (fs.existsSync(this.storePath)) {
                const data = fs.readFileSync(this.storePath, 'utf8');
                const parsed = JSON.parse(data);
                
                // Convert array to Map
                if (Array.isArray(parsed)) {
                    parsed.forEach((context: OrderContext) => {
                        this.contexts.set(context.orderHash, context);
                    });
                } else if (parsed.contexts) {
                    // Handle object format
                    Object.entries(parsed.contexts).forEach(([hash, context]) => {
                        this.contexts.set(hash, context as OrderContext);
                    });
                }
                
                logger.info(`Loaded ${this.contexts.size} order contexts from disk`);
                
                // Clean up old/expired contexts
                this.cleanupExpired();
            }
        } catch (error: any) {
            logger.error(`Failed to load order contexts: ${error.message}`);
            // Start fresh if load fails
            this.contexts = new Map();
        }
    }

    /**
     * Save contexts to disk (debounced)
     */
    private save(): void {
        // Clear existing timer
        if (this.saveDebounceTimer) {
            clearTimeout(this.saveDebounceTimer);
        }

        // Set new timer to save after 1 second of no changes
        this.saveDebounceTimer = setTimeout(() => {
            this.saveImmediate();
        }, 1000);
    }

    /**
     * Save contexts to disk immediately
     */
    private saveImmediate(): void {
        try {
            const data = {
                version: 1,
                savedAt: new Date().toISOString(),
                contexts: Object.fromEntries(this.contexts)
            };
            
            // Write to temporary file first
            const tempPath = `${this.storePath}.tmp`;
            fs.writeFileSync(tempPath, JSON.stringify(data, null, 2));
            
            // Atomic rename
            fs.renameSync(tempPath, this.storePath);
            
            logger.debug(`Saved ${this.contexts.size} order contexts to disk`);
        } catch (error: any) {
            logger.error(`Failed to save order contexts: ${error.message}`);
        }
    }

    /**
     * Set or update an order context
     */
    set(orderHash: string, context: Partial<OrderContext>): void {
        const existing = this.contexts.get(orderHash);
        
        const updatedContext: OrderContext = {
            ...existing,
            ...context,
            orderHash,
            updatedAt: Date.now()
        } as OrderContext;

        if (!existing) {
            updatedContext.createdAt = Date.now();
        }

        this.contexts.set(orderHash, updatedContext);
        this.save();
        
        logger.info(`Updated order context: ${orderHash} (status: ${updatedContext.status})`);
    }

    /**
     * Get an order context
     */
    get(orderHash: string): OrderContext | undefined {
        return this.contexts.get(orderHash);
    }

    /**
     * Update order status
     */
    updateStatus(orderHash: string, status: OrderContext['status'], error?: string): void {
        const context = this.contexts.get(orderHash);
        if (context) {
            context.status = status;
            context.updatedAt = Date.now();
            if (error) {
                context.error = error;
            }
            this.save();
            logger.info(`Updated order ${orderHash} status to: ${status}`);
        }
    }

    /**
     * Update Bitcoin-specific information
     */
    updateBitcoinInfo(orderHash: string, bitcoinInfo: Partial<OrderContext['bitcoin']>): void {
        const context = this.contexts.get(orderHash);
        if (context) {
            context.bitcoin = {
                ...context.bitcoin,
                ...bitcoinInfo
            };
            context.updatedAt = Date.now();
            this.save();
            logger.info(`Updated Bitcoin info for order ${orderHash}`);
        }
    }

    /**
     * Get all contexts by status
     */
    getByStatus(status: OrderContext['status']): OrderContext[] {
        const results: OrderContext[] = [];
        this.contexts.forEach(context => {
            if (context.status === status) {
                results.push(context);
            }
        });
        return results;
    }

    /**
     * Get all pending contexts (not completed or failed)
     */
    getPending(): OrderContext[] {
        const results: OrderContext[] = [];
        const pendingStatuses = ['pending', 'htlc_created', 'htlc_funded', 'secret_revealed'];
        
        this.contexts.forEach(context => {
            if (pendingStatuses.includes(context.status)) {
                results.push(context);
            }
        });
        
        return results;
    }

    /**
     * Check if an order exists
     */
    has(orderHash: string): boolean {
        return this.contexts.has(orderHash);
    }

    /**
     * Delete an order context
     */
    delete(orderHash: string): void {
        if (this.contexts.delete(orderHash)) {
            this.save();
            logger.info(`Deleted order context: ${orderHash}`);
        }
    }

    /**
     * Clean up expired or old contexts
     */
    cleanupExpired(): void {
        const now = Date.now() / 1000; // Current time in seconds
        const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000); // 1 week in ms
        let cleaned = 0;

        this.contexts.forEach((context, hash) => {
            // Remove if expired
            if (context.expiryTime && context.expiryTime < now) {
                if (context.status !== 'expired' && context.status !== 'claimed') {
                    context.status = 'expired';
                    logger.info(`Marked order ${hash} as expired`);
                }
            }

            // Remove completed/failed orders older than 1 week
            if (['claimed', 'expired', 'failed'].includes(context.status) && 
                context.updatedAt < oneWeekAgo) {
                this.contexts.delete(hash);
                cleaned++;
            }
        });

        if (cleaned > 0) {
            logger.info(`Cleaned up ${cleaned} old order contexts`);
            this.save();
        }
    }

    /**
     * Get all contexts (for debugging/monitoring)
     */
    getAll(): OrderContext[] {
        return Array.from(this.contexts.values());
    }

    /**
     * Get context count
     */
    size(): number {
        return this.contexts.size;
    }

    /**
     * Force save (useful before shutdown)
     */
    async flush(): Promise<void> {
        if (this.saveDebounceTimer) {
            clearTimeout(this.saveDebounceTimer);
            this.saveDebounceTimer = null;
        }
        this.saveImmediate();
    }

    /**
     * Clear all contexts (use with caution!)
     */
    clear(): void {
        this.contexts.clear();
        this.save();
        logger.warn('Cleared all order contexts');
    }
}