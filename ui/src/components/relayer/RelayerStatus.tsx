/**
 * Relayer Status Component
 * Shows the status of the automated executor-client relayer service
 */

'use client';

import React, { useEffect, useState } from 'react';
import { Activity, CheckCircle, XCircle, Clock, Zap, DollarSign, AlertTriangle } from 'lucide-react';
import { cn } from '@/utils/utils';
import { useRelayerIntegration, RelayerStatus as RelayerStatusType } from '@/services/relayerIntegration';

interface RelayerStatusProps {
  className?: string;
  compact?: boolean;
}

export function RelayerStatus({ className, compact = false }: RelayerStatusProps) {
  const { isHealthy, status, getMetrics } = useRelayerIntegration();
  const [metrics, setMetrics] = useState<any>(null);

  useEffect(() => {
    const loadMetrics = async () => {
      try {
        const data = await getMetrics();
        setMetrics(data);
      } catch (error) {
        console.error('Failed to load relayer metrics:', error);
      }
    };

    if (isHealthy) {
      loadMetrics();
      // Refresh metrics every 30 seconds
      const interval = setInterval(loadMetrics, 30000);
      return () => clearInterval(interval);
    }
  }, [isHealthy, getMetrics]);

  if (compact) {
    return (
      <div className={cn('flex items-center gap-2 text-sm', className)}>
        <div className="flex items-center gap-1">
          <div className={cn(
            'w-2 h-2 rounded-full',
            isHealthy === null ? 'bg-gray-400 animate-pulse' :
            isHealthy ? 'bg-green-500' : 'bg-red-500'
          )} />
          <span className="text-muted-foreground">
            Relayer: {isHealthy === null ? 'Checking...' : isHealthy ? 'Active' : 'Offline'}
          </span>
        </div>
        {status && (
          <span className="text-xs text-muted-foreground">
            Queue: {status.queueLength}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Main Status Card */}
      <div className="p-4 rounded-xl border bg-card">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={cn(
              'p-2 rounded-xl',
              isHealthy === null ? 'bg-gray-100' :
              isHealthy ? 'bg-green-100' : 'bg-red-100'
            )}>
              {isHealthy === null ? (
                <Activity className="h-5 w-5 text-gray-500 animate-pulse" />
              ) : isHealthy ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : (
                <XCircle className="h-5 w-5 text-red-600" />
              )}
            </div>
            <div>
              <h3 className="font-semibold text-card-foreground">
                Automated Relayer Service
              </h3>
              <p className="text-sm text-muted-foreground">
                {isHealthy === null ? 'Checking connection...' :
                 isHealthy ? 'Monitoring and executing intents' : 'Service unavailable'}
              </p>
            </div>
          </div>
          
          <div className={cn(
            'px-3 py-1 rounded-full text-xs font-medium',
            isHealthy === null ? 'bg-gray-100 text-gray-600' :
            isHealthy ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
          )}>
            {isHealthy === null ? 'Connecting' : isHealthy ? 'Online' : 'Offline'}
          </div>
        </div>

        {/* Service Details */}
        {status && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
              <Clock className="h-4 w-4 text-blue-500" />
              <div>
                <div className="text-sm font-medium text-card-foreground">
                  Queue Length
                </div>
                <div className="text-lg font-bold text-card-foreground">
                  {status.queueLength}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
              <Activity className="h-4 w-4 text-green-500" />
              <div>
                <div className="text-sm font-medium text-card-foreground">
                  Events Processed
                </div>
                <div className="text-lg font-bold text-card-foreground">
                  {status.monitorStatus.eventsProcessed || 0}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
              <Zap className="h-4 w-4 text-orange-500" />
              <div>
                <div className="text-sm font-medium text-card-foreground">
                  Monitor Status
                </div>
                <div className="text-sm font-bold text-card-foreground">
                  {status.monitorStatus.connected ? 'Connected' : 'Disconnected'}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Wallet Status */}
        {status?.walletStatus && (
          <div className="mt-4 pt-4 border-t">
            <h4 className="text-sm font-medium text-muted-foreground mb-3">
              Wallet Status
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Ethereum Wallet */}
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
                <div className={cn(
                  'w-3 h-3 rounded-full',
                  status.walletStatus.ethereum.connected ? 'bg-green-500' : 'bg-red-500'
                )} />
                <div>
                  <div className="text-sm font-medium text-card-foreground">
                    Ethereum
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {status.walletStatus.ethereum.connected ? (
                      <>
                        {status.walletStatus.ethereum.address.slice(0, 8)}...
                        <br />
                        {status.walletStatus.ethereum.balance} ETH
                      </>
                    ) : (
                      'Disconnected'
                    )}
                  </div>
                </div>
              </div>

              {/* NEAR Wallet */}
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
                <div className={cn(
                  'w-3 h-3 rounded-full',
                  status.walletStatus.near.connected ? 'bg-green-500' : 'bg-red-500'
                )} />
                <div>
                  <div className="text-sm font-medium text-card-foreground">
                    NEAR
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {status.walletStatus.near.connected ? (
                      <>
                        {status.walletStatus.near.accountId}
                        <br />
                        {status.walletStatus.near.balance} NEAR
                      </>
                    ) : (
                      'Disconnected'
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Metrics Card */}
      {metrics && (
        <div className="p-4 rounded-xl border bg-card">
          <h3 className="font-semibold text-card-foreground mb-4">
            Performance Metrics
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-card-foreground">
                {metrics.totalOrders}
              </div>
              <div className="text-sm text-muted-foreground">
                Total Orders
              </div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {metrics.successfulExecutions}
              </div>
              <div className="text-sm text-muted-foreground">
                Successful
              </div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {parseFloat(metrics.totalProfitGenerated).toFixed(4)}
              </div>
              <div className="text-sm text-muted-foreground">
                Total Profit (ETH)
              </div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                {Math.round(metrics.averageExecutionTime / 1000)}s
              </div>
              <div className="text-sm text-muted-foreground">
                Avg. Time
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Warning if service is offline */}
      {isHealthy === false && (
        <div className="p-4 rounded-xl border border-yellow-200 bg-yellow-50">
          <div className="flex items-center gap-2 text-yellow-800">
            <AlertTriangle className="h-4 w-4" />
            <span className="font-medium">Relayer Service Offline</span>
          </div>
          <p className="text-sm text-yellow-700 mt-1">
            The automated relayer service is currently unavailable. Your intents will be queued
            until the service comes back online.
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Simple relayer health indicator
 */
export function RelayerHealthIndicator({ className }: { className?: string }) {
  const { isHealthy } = useRelayerIntegration();

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className={cn(
        'w-2 h-2 rounded-full',
        isHealthy === null ? 'bg-gray-400 animate-pulse' :
        isHealthy ? 'bg-green-500' : 'bg-red-500'
      )} />
      <span className="text-xs text-muted-foreground">
        Relayer {isHealthy === null ? 'checking' : isHealthy ? 'online' : 'offline'}
      </span>
    </div>
  );
}