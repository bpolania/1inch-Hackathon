/**
 * WebSocket Service for Real-time Updates
 * 
 * Provides real-time communication between backend services and UI
 */

import { WebSocketServer, WebSocket } from 'ws';
import { EventEmitter } from 'events';
import { TEESolverService } from './TEESolverService';
import { RelayerService } from './RelayerService';
import { logger } from '../utils/logger';

interface WebSocketClient {
  id: string;
  ws: WebSocket;
  subscriptions: Set<string>;
  lastPing: number;
}

interface WebSocketMessage {
  type: 'subscribe' | 'unsubscribe' | 'ping' | 'pong';
  channel?: string;
  data?: any;
}

export class WebSocketService extends EventEmitter {
  private wss: WebSocketServer;
  private teeService: TEESolverService;
  private relayerService: RelayerService;
  private clients = new Map<string, WebSocketClient>();
  private pingInterval: NodeJS.Timeout | null = null;

  constructor(
    wss: WebSocketServer, 
    teeService: TEESolverService, 
    relayerService: RelayerService
  ) {
    super();
    this.wss = wss;
    this.teeService = teeService;
    this.relayerService = relayerService;
    
    this.setupWebSocketServer();
    this.setupServiceListeners();
    this.startPingInterval();
  }

  private setupWebSocketServer(): void {
    this.wss.on('connection', (ws, request) => {
      const clientId = this.generateClientId();
      const client: WebSocketClient = {
        id: clientId,
        ws,
        subscriptions: new Set(),
        lastPing: Date.now()
      };

      this.clients.set(clientId, client);
      
      logger.info(`WebSocket client connected: ${clientId}`);

      // Send welcome message
      this.sendMessage(ws, {
        type: 'connected',
        clientId,
        timestamp: Date.now()
      });

      // Handle messages
      ws.on('message', (data) => {
        try {
          const message: WebSocketMessage = JSON.parse(data.toString());
          this.handleMessage(client, message);
        } catch (error) {
          logger.error('Invalid WebSocket message:', error);
          this.sendError(ws, 'Invalid message format');
        }
      });

      // Handle disconnection
      ws.on('close', () => {
        this.clients.delete(clientId);
        logger.info(`WebSocket client disconnected: ${clientId}`);
      });

      // Handle errors
      ws.on('error', (error) => {
        logger.error(`WebSocket error for client ${clientId}:`, error);
        this.clients.delete(clientId);
      });
    });

    logger.info('WebSocket server initialized');
  }

  private setupServiceListeners(): void {
    // TEE Service events
    this.teeService.on('executionUpdate', (update) => {
      this.broadcast('tee-execution-update', update);
    });

    this.teeService.on('orderSubmitted', (data) => {
      this.broadcast('tee-order-submitted', data);
    });

    this.teeService.on('processingFailed', (data) => {
      this.broadcast('tee-processing-failed', data);
    });

    // Relayer Service events
    this.relayerService.on('orderUpdate', (update) => {
      this.broadcast('relayer-order-update', update);
    });

    // Enhanced production events
    this.setupEnhancedEventListeners();

    logger.info('Service event listeners configured');
  }

  private setupEnhancedEventListeners(): void {
    // Transaction lifecycle events
    this.setupTransactionEvents();
    
    // Chain status events
    this.setupChainStatusEvents();
    
    // Market data events
    this.setupMarketDataEvents();
    
    // User notification events
    this.setupUserNotificationEvents();
    
    // System alert events
    this.setupSystemAlertEvents();
  }

  private setupTransactionEvents(): void {
    // Mock transaction events - in production these would come from actual services
    setInterval(() => {
      // Simulate transaction status updates
      const txUpdate = {
        transactionId: `tx-${Date.now()}`,
        status: 'executing',
        step: 'cross-chain-bridge',
        progress: Math.floor(Math.random() * 100),
        estimatedCompletion: Date.now() + Math.random() * 600000
      };
      this.broadcast('transaction-update', txUpdate);
    }, 30000); // Every 30 seconds

    setInterval(() => {
      // Simulate transaction completions
      const completion = {
        transactionId: `tx-${Date.now() - 300000}`,
        status: 'completed',
        finalAmount: '1000.0',
        fees: '5.2',
        duration: 480000
      };
      this.broadcast('transaction-completed', completion);
    }, 45000); // Every 45 seconds
  }

  private setupChainStatusEvents(): void {
    setInterval(() => {
      // Simulate chain status updates
      const chainUpdate = {
        chainId: Math.floor(Math.random() * 3) === 0 ? 1 : 137,
        gasPrice: 20 + Math.random() * 20,
        congestion: Math.floor(Math.random() * 100),
        blockHeight: 18500000 + Math.floor(Math.random() * 1000),
        status: Math.random() > 0.9 ? 'degraded' : 'healthy'
      };
      this.broadcast('chain-status-update', chainUpdate);
    }, 15000); // Every 15 seconds
  }

  private setupMarketDataEvents(): void {
    setInterval(() => {
      // Simulate market data updates 
      const marketUpdate = {
        pair: 'ETH/USDC',
        price: 2000 + (Math.random() - 0.5) * 100,
        volume24h: '125000000',
        change24h: (Math.random() - 0.5) * 10,
        timestamp: Date.now()
      };
      this.broadcast('market-data-update', marketUpdate);
    }, 10000); // Every 10 seconds

    setInterval(() => {
      // Simulate solver bid updates
      const bidUpdate = {
        intentId: `intent-${Date.now()}`,
        solvers: [
          { id: 'tee-solver', bid: '0.025', confidence: 95 },
          { id: 'relayer-1', bid: '0.028', confidence: 87 },
          { id: 'relayer-2', bid: '0.032', confidence: 92 }
        ],
        bestBid: '0.025',
        deadline: Date.now() + 120000
      };
      this.broadcast('solver-bid-update', bidUpdate);
    }, 20000); // Every 20 seconds
  }

  private setupUserNotificationEvents(): void {
    setInterval(() => {
      // Simulate user notifications
      const notification = {
        id: `notif-${Date.now()}`,
        type: Math.random() > 0.5 ? 'transaction' : 'system',
        title: 'Transaction Update',
        message: 'Your cross-chain swap is being processed',
        priority: Math.random() > 0.8 ? 'high' : 'normal',
        timestamp: Date.now(),
        actions: [
          { label: 'View Details', action: 'view_transaction' },
          { label: 'Dismiss', action: 'dismiss' }
        ]
      };
      this.broadcast('user-notification', notification);
    }, 60000); // Every minute
  }

  private setupSystemAlertEvents(): void {
    setInterval(() => {
      // Simulate system alerts (less frequent)
      if (Math.random() > 0.9) { // 10% chance
        const alert = {
          id: `alert-${Date.now()}`,
          severity: Math.random() > 0.7 ? 'warning' : 'info',
          title: 'System Status Update',
          message: 'Temporary delays on Ethereum network due to high congestion',
          affectedChains: [1],
          estimatedResolution: Date.now() + 1800000,
          timestamp: Date.now()
        };
        this.broadcast('system-alert', alert);
      }
    }, 120000); // Every 2 minutes
  }

  private handleMessage(client: WebSocketClient, message: WebSocketMessage): void {
    switch (message.type) {
      case 'subscribe':
        if (message.channel) {
          client.subscriptions.add(message.channel);
          this.sendMessage(client.ws, {
            type: 'subscribed',
            channel: message.channel,
            timestamp: Date.now()
          });
          logger.info(`Client ${client.id} subscribed to ${message.channel}`);
        }
        break;

      case 'unsubscribe':
        if (message.channel) {
          client.subscriptions.delete(message.channel);
          this.sendMessage(client.ws, {
            type: 'unsubscribed',
            channel: message.channel,
            timestamp: Date.now()
          });
          logger.info(`Client ${client.id} unsubscribed from ${message.channel}`);
        }
        break;

      case 'ping':
        client.lastPing = Date.now();
        this.sendMessage(client.ws, {
          type: 'pong',
          timestamp: Date.now()
        });
        break;

      default:
        this.sendError(client.ws, `Unknown message type: ${message.type}`);
    }
  }

  private broadcast(channel: string, data: any): void {
    const message = {
      type: 'broadcast',
      channel,
      data,
      timestamp: Date.now()
    };

    let sentCount = 0;
    this.clients.forEach((client) => {
      if (client.subscriptions.has(channel) || client.subscriptions.has('*')) {
        try {
          this.sendMessage(client.ws, message);
          sentCount++;
        } catch (error) {
          logger.error(`Failed to send message to client ${client.id}:`, error);
        }
      }
    });

    if (sentCount > 0) {
      logger.info(`Broadcast sent to ${sentCount} clients on channel: ${channel}`);
    }
  }

  private sendMessage(ws: WebSocket, message: any): void {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        // Handle BigInt serialization by converting to string
        const serializedMessage = JSON.stringify(message, (key, value) =>
          typeof value === 'bigint' ? value.toString() : value
        );
        ws.send(serializedMessage);
      } catch (error) {
        logger.error('Failed to serialize WebSocket message:', error);
      }
    }
  }

  private sendError(ws: WebSocket, error: string): void {
    this.sendMessage(ws, {
      type: 'error',
      error,
      timestamp: Date.now()
    });
  }

  private generateClientId(): string {
    return `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private startPingInterval(): void {
    // Send ping to all clients every 30 seconds
    this.pingInterval = setInterval(() => {
      const now = Date.now();
      const staleThreshold = 60000; // 1 minute

      this.clients.forEach((client, clientId) => {
        // Check if client is stale
        if (now - client.lastPing > staleThreshold) {
          logger.warn(`Removing stale client: ${clientId}`);
          client.ws.terminate();
          this.clients.delete(clientId);
          return;
        }

        // Send ping
        try {
          this.sendMessage(client.ws, {
            type: 'ping',
            timestamp: now
          });
        } catch (error) {
          logger.error(`Failed to ping client ${clientId}:`, error);
          this.clients.delete(clientId);
        }
      });
    }, 30000);

    logger.info('WebSocket ping interval started');
  }

  /**
   * Send a message to specific clients
   */
  public sendToClients(clientIds: string[], message: any): void {
    clientIds.forEach(clientId => {
      const client = this.clients.get(clientId);
      if (client) {
        this.sendMessage(client.ws, message);
      }
    });
  }

  /**
   * Get connected client count
   */
  public getClientCount(): number {
    return this.clients.size;
  }

  /**
   * Get client statistics
   */
  public getStats() {
    const subscriptionCounts = new Map<string, number>();
    
    this.clients.forEach(client => {
      client.subscriptions.forEach(channel => {
        subscriptionCounts.set(channel, (subscriptionCounts.get(channel) || 0) + 1);
      });
    });

    return {
      totalClients: this.clients.size,
      subscriptions: Object.fromEntries(subscriptionCounts),
      uptime: process.uptime()
    };
  }

  /**
   * Stop the WebSocket service
   */
  public stop(): void {
    logger.info('Stopping WebSocket service...');

    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }

    // Close all client connections
    this.clients.forEach((client, clientId) => {
      this.sendMessage(client.ws, {
        type: 'server-shutdown',
        message: 'Server is shutting down',
        timestamp: Date.now()
      });
      client.ws.close();
    });

    this.clients.clear();
    this.wss.close();

    logger.info('WebSocket service stopped');
  }
}