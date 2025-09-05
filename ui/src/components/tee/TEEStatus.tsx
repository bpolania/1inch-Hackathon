/**
 * TEE Status Component
 * Shows the status of the autonomous TEE solver with attestation verification
 */

'use client';

import React, { useEffect, useState } from 'react';
import { Shield, CheckCircle, XCircle, AlertTriangle, Zap, Activity, Lock, Eye } from 'lucide-react';
import { cn } from '@/utils/utils';
import { useTEESolverIntegration, TEEStatus as TEEStatusType } from '@/services/teeIntegration';

interface TEEStatusProps {
  className?: string;
  compact?: boolean;
}

export function TEEStatus({ className, compact = false }: TEEStatusProps) {
  const { isHealthy, status, attestation, getSupportedRoutes } = useTEESolverIntegration();
  const [routes, setRoutes] = useState<any[]>([]);

  useEffect(() => {
    const loadRoutes = async () => {
      try {
        const supportedRoutes = await getSupportedRoutes();
        setRoutes(supportedRoutes);
      } catch (error) {
        console.error('Failed to load supported routes:', error);
      }
    };

    if (isHealthy) {
      loadRoutes();
    }
  }, [isHealthy, getSupportedRoutes]);

  if (compact) {
    return (
      <div className={cn('flex items-center gap-2 text-sm', className)}>
        <div className="flex items-center gap-1">
          <div className={cn(
            'w-2 h-2 rounded-full',
            isHealthy === null ? 'bg-gray-400 animate-pulse' :
            isHealthy ? 'bg-green-500' : 'bg-red-500'
          )} />
          <Shield className="h-3 w-3 text-muted-foreground" />
          <span className="text-muted-foreground">
            TEE: {isHealthy === null ? 'Checking...' : isHealthy ? 'Active' : 'Offline'}
          </span>
        </div>
        {attestation && (
          <div className={cn(
            'px-2 py-1 rounded-full text-xs',
            attestation.valid ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
          )}>
            {attestation.valid ? 'Verified' : 'Unverified'}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Main TEE Status Card */}
      <div className="p-4 rounded-xl border bg-card">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={cn(
              'p-2 rounded-xl',
              isHealthy === null ? 'bg-gray-100' :
              isHealthy ? 'bg-green-100' : 'bg-red-100'
            )}>
              {isHealthy === null ? (
                <Shield className="h-5 w-5 text-gray-500 animate-pulse" />
              ) : isHealthy ? (
                <Shield className="h-5 w-5 text-green-600" />
              ) : (
                <XCircle className="h-5 w-5 text-red-600" />
              )}
            </div>
            <div>
              <h3 className="font-semibold text-card-foreground">
                TEE Autonomous Solver
              </h3>
              <p className="text-sm text-muted-foreground">
                {isHealthy === null ? 'Checking TEE status...' :
                 isHealthy ? 'Autonomous intent processing active' : 'TEE solver unavailable'}
              </p>
            </div>
          </div>
          
          <div className={cn(
            'px-3 py-1 rounded-full text-xs font-medium',
            isHealthy === null ? 'bg-gray-100 text-gray-600' :
            isHealthy ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
          )}>
            {isHealthy === null ? 'Connecting' : isHealthy ? 'Active' : 'Offline'}
          </div>
        </div>

        {/* TEE Features Status */}
        {status && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
              <Lock className={cn(
                'h-4 w-4',
                status.attestationValid ? 'text-green-500' : 'text-red-500'
              )} />
              <div>
                <div className="text-sm font-medium text-card-foreground">
                  TEE Attestation
                </div>
                <div className={cn(
                  'text-xs font-bold',
                  status.attestationValid ? 'text-green-600' : 'text-red-600'
                )}>
                  {status.attestationValid ? 'Valid' : 'Invalid'}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
              <Zap className={cn(
                'h-4 w-4',
                status.chainSignaturesEnabled ? 'text-blue-500' : 'text-gray-400'
              )} />
              <div>
                <div className="text-sm font-medium text-card-foreground">
                  Chain Signatures
                </div>
                <div className={cn(
                  'text-xs font-bold',
                  status.chainSignaturesEnabled ? 'text-blue-600' : 'text-gray-600'
                )}>
                  {status.chainSignaturesEnabled ? 'Enabled' : 'Disabled'}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Supported Chains */}
        {status?.supportedChains && status.supportedChains.length > 0 && (
          <div className="mt-4 pt-4 border-t">
            <h4 className="text-sm font-medium text-muted-foreground mb-3">
              Supported Chains
            </h4>
            <div className="flex flex-wrap gap-2">
              {status.supportedChains.map((chain, index) => (
                <span
                  key={index}
                  className="px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-medium"
                >
                  {chain.charAt(0).toUpperCase() + chain.slice(1)}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* TEE Attestation Details */}
      {attestation && (
        <div className="p-4 rounded-xl border bg-card">
          <div className="flex items-center gap-3 mb-4">
            <Eye className="h-5 w-5 text-blue-500" />
            <h3 className="font-semibold text-card-foreground">
              TEE Attestation Details
            </h3>
            <div className={cn(
              'px-2 py-1 rounded-full text-xs font-medium',
              attestation.valid ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
            )}>
              {attestation.valid ? 'Verified' : 'Unverified'}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Code Hash</span>
              <code className="px-2 py-1 rounded bg-muted text-xs">
                {attestation.codeHash?.slice(0, 16)}...
              </code>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Last Verified</span>
              <span className="text-sm text-card-foreground">
                {new Date(attestation.timestamp).toLocaleString()}
              </span>
            </div>

            {attestation.measurements && (
              <div className="pt-2 border-t">
                <div className="text-xs text-muted-foreground mb-2">
                  TEE Measurements
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                  {Object.entries(attestation.measurements).map(([key, value]) => (
                    <div key={key} className="flex justify-between">
                      <span className="text-muted-foreground">{key}:</span>
                      <code className="text-card-foreground">
                        {typeof value === 'string' ? value.slice(0, 8) + '...' : String(value)}
                      </code>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Statistics Card */}
      {status?.statistics && (
        <div className="p-4 rounded-xl border bg-card">
          <h3 className="font-semibold text-card-foreground mb-4">
            Autonomous Performance
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-card-foreground">
                {status.statistics.totalSwaps}
              </div>
              <div className="text-sm text-muted-foreground">
                Total Swaps
              </div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {status.statistics.successfulSwaps}
              </div>
              <div className="text-sm text-muted-foreground">
                Successful
              </div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {parseFloat(status.statistics.totalProfit).toFixed(4)}
              </div>
              <div className="text-sm text-muted-foreground">
                Total Profit (ETH)
              </div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                {Math.round(status.statistics.averageExecutionTime / 1000)}s
              </div>
              <div className="text-sm text-muted-foreground">
                Avg. Time
              </div>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Uptime</span>
              <span className="text-sm font-medium text-card-foreground">
                {Math.round(status.statistics.uptime / 3600)}h
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Supported Routes */}
      {routes.length > 0 && (
        <div className="p-4 rounded-xl border bg-card">
          <h3 className="font-semibold text-card-foreground mb-4">
            Supported Swap Routes
          </h3>
          <div className="space-y-2">
            {routes.map((route, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 rounded-lg bg-muted"
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'w-2 h-2 rounded-full',
                    route.enabled ? 'bg-green-500' : 'bg-gray-400'
                  )} />
                  <span className="text-sm font-medium text-card-foreground">
                    {route.fromChain.charAt(0).toUpperCase() + route.fromChain.slice(1)}  {route.toChain.charAt(0).toUpperCase() + route.toChain.slice(1)}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">
                  ~{route.estimatedTime}min
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Warning if service is offline */}
      {isHealthy === false && (
        <div className="p-4 rounded-xl border border-yellow-200 bg-yellow-50">
          <div className="flex items-center gap-2 text-yellow-800">
            <AlertTriangle className="h-4 w-4" />
            <span className="font-medium">TEE Solver Offline</span>
          </div>
          <p className="text-sm text-yellow-700 mt-1">
            The autonomous TEE solver is currently unavailable. Intents will be processed
            by traditional relayers until the TEE comes back online.
          </p>
        </div>
      )}

      {/* Attestation Warning */}
      {isHealthy && attestation && !attestation.valid && (
        <div className="p-4 rounded-xl border border-red-200 bg-red-50">
          <div className="flex items-center gap-2 text-red-800">
            <Shield className="h-4 w-4" />
            <span className="font-medium">TEE Attestation Invalid</span>
          </div>
          <p className="text-sm text-red-700 mt-1">
            The TEE attestation could not be verified. This may indicate a security issue.
            Please verify the TEE environment before submitting sensitive intents.
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Simple TEE health indicator
 */
export function TEEHealthIndicator({ className }: { className?: string }) {
  const { isHealthy, attestation } = useTEESolverIntegration();

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className={cn(
        'w-2 h-2 rounded-full',
        isHealthy === null ? 'bg-gray-400 animate-pulse' :
        isHealthy ? 'bg-green-500' : 'bg-red-500'
      )} />
      <Shield className="h-3 w-3 text-muted-foreground" />
      <span className="text-xs text-muted-foreground">
        TEE {isHealthy === null ? 'checking' : isHealthy ? 'verified' : 'offline'}
      </span>
      {attestation && (
        <div className={cn(
          'w-1 h-1 rounded-full',
          attestation.valid ? 'bg-green-400' : 'bg-red-400'
        )} />
      )}
    </div>
  );
}