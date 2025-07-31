/**
 * Intent Listener - WebSocket Quote Request Handler
 * 
 * This component listens for quote requests via WebSocket relay
 * and coordinates with the quote generator to provide competitive quotes.
 * 
 * Evolution from OrderMonitor - now handles real-time intent requests
 * instead of blockchain event monitoring.
 */

import WebSocket from 'ws';
import { EventEmitter } from 'events';
import {
  QuoteRequest,
  Quote,
  WebSocketMessage,
  MessageType,
  SolverConfig,
  SolverStatus,
  SolverError,
  SolverErrorType,
  SolverEvent,
  SolverEventType
} from '../types/solver.types';
import { logger } from '../utils/logger';

export class IntentListener extends EventEmitter {
  private config: SolverConfig;
  private ws?: WebSocket;
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;
  private reconnectDelay: number = 5000;
  private heartbeatInterval?: NodeJS.Timeout;
  private lastHeartbeat: number = 0;
  private messageQueue: WebSocketMessage[] = [];
  private isProcessingQueue: boolean = false;

  // Statistics
  private stats = {
    quotesReceived: 0,
    quotesResponded: 0,
    connectionTime: 0,
    lastActivity: 0
  };

  constructor(config: SolverConfig) {
    super();
    this.config = config;
    this.setupEventHandlers();
  }

  /**
   * Initialize and connect to WebSocket relay
   */
  async initialize(): Promise<void> {
    logger.info('🔧 Initializing Intent Listener...');
    
    try {
      await this.connectToRelay();
      this.startHeartbeat();
      logger.info('✅ Intent Listener initialized and connected');
    } catch (error) {
      logger.error('💥 Failed to initialize Intent Listener:', error);
      throw error;
    }
  }

  /**
   * Connect to WebSocket relay server
   */
  private async connectToRelay(): Promise<void> {
    return new Promise((resolve, reject) => {
      logger.info(`🌐 Connecting to relay: ${this.config.relayUrl}`);

      this.ws = new WebSocket(this.config.relayUrl, {
        headers: {
          'User-Agent': `1inch-fusion-tee-solver/${this.config.solverId}`,
          'X-Solver-Id': this.config.solverId,
          'X-Supported-Chains': this.config.supportedChains.join(',')
        }
      });

      // Connection timeout
      const timeout = setTimeout(() => {
        reject(new Error('WebSocket connection timeout'));
      }, 10000);

      this.ws.on('open', () => {
        clearTimeout(timeout);
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.stats.connectionTime = Date.now();
        
        logger.info('✅ Connected to WebSocket relay');
        this.emit('connection_established');
        
        // Send solver registration
        this.sendSolverRegistration();
        resolve();
      });

      this.ws.on('message', (data: WebSocket.Data) => {
        this.handleMessage(data);
      });

      this.ws.on('close', (code: number, reason: string) => {
        clearTimeout(timeout);
        this.handleDisconnection(code, reason);
      });

      this.ws.on('error', (error: Error) => {
        clearTimeout(timeout);
        logger.error('🚨 WebSocket error:', error);
        this.emit('error', {
          type: SolverErrorType.CONNECTION_ERROR,
          message: error.message,
          timestamp: Date.now()
        });
        reject(error);
      });
    });
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(data: WebSocket.Data): void {
    try {
      const message: WebSocketMessage = JSON.parse(data.toString());
      this.stats.lastActivity = Date.now();

      logger.debug(`📨 Received message type: ${message.type}`);

      // Add to processing queue
      this.messageQueue.push(message);
      this.processMessageQueue();

    } catch (error) {
      logger.error('💥 Error parsing WebSocket message:', error);
      this.emitError(SolverErrorType.VALIDATION_ERROR, 'Invalid message format');
    }
  }

  /**
   * Process message queue to handle requests in order
   */
  private async processMessageQueue(): Promise<void> {
    if (this.isProcessingQueue || this.messageQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift()!;
      
      try {
        await this.processMessage(message);
      } catch (error) {
        logger.error(`💥 Error processing message ${message.id}:`, error);
      }
    }

    this.isProcessingQueue = false;
  }

  /**
   * Process individual message based on type
   */
  private async processMessage(message: WebSocketMessage): Promise<void> {
    switch (message.type) {
      case MessageType.QUOTE_REQUEST:
        await this.handleQuoteRequest(message);
        break;
        
      case MessageType.ORDER_CREATED:
        this.handleOrderCreated(message);
        break;
        
      case MessageType.ORDER_EXECUTED:
        this.handleOrderExecuted(message);
        break;
        
      case MessageType.HEARTBEAT:
        this.handleHeartbeat(message);
        break;
        
      case MessageType.ERROR:
        this.handleErrorMessage(message);
        break;
        
      default:
        logger.warn(`⚠️ Unknown message type: ${message.type}`);
    }
  }

  /**
   * Handle quote request from users
   */
  private async handleQuoteRequest(message: WebSocketMessage): Promise<void> {
    const quoteRequest: QuoteRequest = message.data;
    
    // Handle BigInt deserialization from JSON
    if (typeof quoteRequest.sourceAmount === 'string') {
      quoteRequest.sourceAmount = BigInt(quoteRequest.sourceAmount);
    }
    
    logger.info(`💭 Quote request received:`, {
      id: quoteRequest.id,
      sourceChain: quoteRequest.sourceChain,
      destinationChain: quoteRequest.destinationChain,
      amount: quoteRequest.sourceAmount.toString()
    });

    this.stats.quotesReceived++;

    // Validate request
    if (!this.validateQuoteRequest(quoteRequest)) {
      logger.warn(`❌ Invalid quote request: ${quoteRequest.id}`);
      return;
    }

    // Check if we support the requested chains
    if (!this.config.supportedChains.includes(quoteRequest.sourceChain) ||
        !this.config.supportedChains.includes(quoteRequest.destinationChain)) {
      logger.debug(`⏭️ Unsupported chain pair: ${quoteRequest.sourceChain} → ${quoteRequest.destinationChain}`);
      return;
    }

    // Emit event for quote generator
    this.emit('quote_requested', quoteRequest);

    // Track the request
    this.emitEvent(SolverEventType.QUOTE_REQUESTED, {
      requestId: quoteRequest.id,
      sourceChain: quoteRequest.sourceChain,
      destinationChain: quoteRequest.destinationChain,
      amount: quoteRequest.sourceAmount.toString()
    });
  }

  /**
   * Submit quote response back to relay
   */
  async submitQuote(quote: Quote): Promise<void> {
    if (!this.isConnected || !this.ws) {
      throw new Error('Not connected to relay');
    }

    const message: WebSocketMessage = {
      type: MessageType.QUOTE_RESPONSE,
      id: quote.requestId,
      timestamp: Date.now(),
      data: quote
    };

    try {
      this.ws.send(JSON.stringify(message));
      this.stats.quotesResponded++;
      
      logger.info(`📤 Quote submitted:`, {
        requestId: quote.requestId,
        destinationAmount: quote.destinationAmount.toString(),
        validUntil: new Date(quote.validUntil).toISOString()
      });

      this.emitEvent(SolverEventType.QUOTE_GENERATED, {
        requestId: quote.requestId,
        destinationAmount: quote.destinationAmount.toString(),
        solverFee: quote.solverFee.toString()
      });

    } catch (error) {
      logger.error('💥 Failed to submit quote:', error);
      throw error;
    }
  }

  /**
   * Handle order creation notification
   */
  private handleOrderCreated(message: WebSocketMessage): void {
    logger.info(`📋 Order created: ${message.data.orderHash}`);
    this.emit('order_created', message.data);
  }

  /**
   * Handle order execution notification
   */
  private handleOrderExecuted(message: WebSocketMessage): void {
    logger.info(`✅ Order executed: ${message.data.orderHash}`);
    this.emit('order_executed', message.data);
  }

  /**
   * Handle heartbeat from relay
   */
  private handleHeartbeat(message: WebSocketMessage): void {
    this.lastHeartbeat = Date.now();
    logger.debug('💓 Heartbeat received');
  }

  /**
   * Handle error message from relay
   */
  private handleErrorMessage(message: WebSocketMessage): void {
    logger.error('🚨 Relay error:', message.data);
    this.emit('relay_error', message.data);
  }

  /**
   * Send solver registration to relay
   */
  private sendSolverRegistration(): void {
    if (!this.ws) return;

    const registration = {
      type: 'solver_registration',
      id: this.generateMessageId(),
      timestamp: Date.now(),
      data: {
        solverId: this.config.solverId,
        supportedChains: this.config.supportedChains,
        capabilities: {
          maxQuoteAge: this.config.maxQuoteAge,
          minProfitThreshold: this.config.minProfitThreshold.toString(),
          teeEnabled: this.config.teeEnabled
        }
      }
    };

    this.ws.send(JSON.stringify(registration));
    logger.info('📝 Solver registration sent');
  }

  /**
   * Start heartbeat mechanism
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      if (this.ws && this.isConnected) {
        const heartbeat = {
          type: MessageType.HEARTBEAT,
          id: this.generateMessageId(),
          timestamp: Date.now(),
          data: { solverId: this.config.solverId }
        };
        
        this.ws.send(JSON.stringify(heartbeat));
      }
    }, 30000); // Every 30 seconds
  }

  /**
   * Handle WebSocket disconnection
   */
  private handleDisconnection(code: number, reason: string): void {
    this.isConnected = false;
    logger.warn(`🔌 WebSocket disconnected: ${code} - ${reason}`);
    
    this.emit('connection_lost', { code, reason });
    
    // Attempt reconnection
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.scheduleReconnection();
    } else {
      logger.error('💥 Max reconnection attempts reached');
      this.emitError(SolverErrorType.CONNECTION_ERROR, 'Max reconnection attempts exceeded');
    }
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnection(): void {
    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1); // Exponential backoff
    
    logger.info(`🔄 Reconnection attempt ${this.reconnectAttempts} in ${delay}ms`);
    
    setTimeout(async () => {
      try {
        await this.connectToRelay();
      } catch (error) {
        logger.error('💥 Reconnection failed:', error);
      }
    }, delay);
  }

  /**
   * Validate quote request
   */
  private validateQuoteRequest(request: QuoteRequest): boolean {
    if (!request.id || !request.sourceChain || !request.destinationChain) {
      return false;
    }
    
    if (!request.sourceToken || !request.destinationToken) {
      return false;
    }
    
    if (!request.sourceAmount || request.sourceAmount <= 0n) {
      return false;
    }
    
    if (!request.userAddress || !request.deadline) {
      return false;
    }
    
    if (request.deadline <= Date.now() / 1000) {
      return false;
    }
    
    return true;
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    this.on('error', (error: SolverError) => {
      logger.error('🚨 Solver error:', error);
    });
  }

  /**
   * Get solver status
   */
  getStatus(): SolverStatus {
    return {
      isRunning: true,
      isConnected: this.isConnected,
      lastHeartbeat: this.lastHeartbeat,
      quotesGenerated: this.stats.quotesResponded,
      ordersExecuted: 0, // Will be tracked separately
      successRate: this.stats.quotesReceived > 0 ? 
        (this.stats.quotesResponded / this.stats.quotesReceived) * 100 : 0,
      averageExecutionTime: 0, // Will be calculated separately
      currentProfit: 0n, // Will be tracked separately
      supportedChains: this.config.supportedChains
    };
  }

  /**
   * Stop the intent listener
   */
  async stop(): Promise<void> {
    logger.info('🛑 Stopping Intent Listener...');
    
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    
    if (this.ws) {
      this.ws.close();
    }
    
    this.isConnected = false;
    logger.info('✅ Intent Listener stopped');
  }

  // Utility methods
  private generateMessageId(): string {
    return `${this.config.solverId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private emitError(type: SolverErrorType, message: string, details?: any): void {
    const error: SolverError = {
      type,
      message,
      details,
      timestamp: Date.now()
    };
    this.emit('error', error);
  }

  private emitEvent(type: SolverEventType, data: any): void {
    const event: SolverEvent = {
      type,
      timestamp: Date.now(),
      data
    };
    this.emit('solver_event', event);
  }
}