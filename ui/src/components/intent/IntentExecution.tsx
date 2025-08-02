/**
 * Intent Execution Component
 * Shows real-time execution status and progress for submitted intents
 */

'use client';

import React, { useEffect, useState } from 'react';
import { CheckCircle, Clock, XCircle, AlertCircle, ArrowRight, DollarSign, Zap, ExternalLink } from 'lucide-react';
import { cn } from '@/utils/utils';
import { useRelayerIntegration, OrderSubmission, ProfitabilityAnalysis } from '@/services/relayerIntegration';
import { IntentRequest } from '@/types/intent';

interface IntentExecutionProps {
  intent: IntentRequest;
  onExecutionComplete?: (result: OrderSubmission) => void;
  className?: string;
}

export function IntentExecution({ intent, onExecutionComplete, className }: IntentExecutionProps) {
  const { 
    submitIntent, 
    analyzeProfitability, 
    getExecutionStatus, 
    startMonitoring,
    requestExecution,
    cancelOrder
  } = useRelayerIntegration();

  const [submission, setSubmission] = useState<OrderSubmission | null>(null);
  const [profitability, setProfitability] = useState<ProfitabilityAnalysis | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Analyze profitability on mount
  useEffect(() => {
    const analyze = async () => {
      try {
        const analysis = await analyzeProfitability(intent);
        setProfitability(analysis);
      } catch (err) {
        console.error('Profitability analysis failed:', err);
      }
    };

    analyze();
  }, [intent, analyzeProfitability]);

  // Start monitoring if we have a submission
  useEffect(() => {
    if (!submission || submission.status === 'completed' || submission.status === 'failed') {
      return;
    }

    const cleanup = startMonitoring(intent.id, (update) => {
      setSubmission(update);
      
      if (update.status === 'completed' || update.status === 'failed') {
        onExecutionComplete?.(update);
      }
    });

    return cleanup;
  }, [submission, intent.id, startMonitoring, onExecutionComplete]);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      const result = await submitIntent(intent);
      setSubmission(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRequestExecution = async () => {
    if (!submission) return;
    
    try {
      const success = await requestExecution(submission.intentId);
      if (success) {
        setSubmission({ ...submission, status: 'processing' });
      }
    } catch (err) {
      setError('Failed to request immediate execution');
    }
  };

  const handleCancel = async () => {
    if (!submission) return;
    
    try {
      const success = await cancelOrder(submission.intentId);
      if (success) {
        setSubmission({ ...submission, status: 'failed' });
      }
    } catch (err) {
      setError('Failed to cancel order');
    }
  };

  const getStatusIcon = () => {
    switch (submission?.status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'failed':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'processing':
        return <Zap className="h-5 w-5 text-blue-500 animate-pulse" />;
      default:
        return <Clock className="h-5 w-5 text-orange-500" />;
    }
  };

  const getStatusText = () => {
    switch (submission?.status) {
      case 'pending':
        return 'Waiting for submission';
      case 'submitted':
        return 'Submitted to relayer';
      case 'processing':
        return 'Executing atomic swap';
      case 'completed':
        return 'Execution completed';
      case 'failed':
        return 'Execution failed';
      default:
        return 'Ready to submit';
    }
  };

  return (
    <div className={cn('space-y-6', className)}>
      {/* Profitability Analysis */}
      {profitability && (
        <div className="p-4 rounded-xl border bg-card">
          <div className="flex items-center gap-3 mb-4">
            <DollarSign className="h-5 w-5 text-green-500" />
            <h3 className="font-semibold text-card-foreground">
              Profitability Analysis
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-3 rounded-lg bg-muted">
              <div className="text-lg font-bold text-card-foreground">
                {parseFloat(profitability.estimatedProfit).toFixed(6)} ETH
              </div>
              <div className="text-sm text-muted-foreground">
                Estimated Profit
              </div>
            </div>

            <div className="text-center p-3 rounded-lg bg-muted">
              <div className="text-lg font-bold text-card-foreground">
                {profitability.marginPercent.toFixed(2)}%
              </div>
              <div className="text-sm text-muted-foreground">
                Profit Margin
              </div>
            </div>

            <div className="text-center p-3 rounded-lg bg-muted">
              <div className={cn(
                'text-lg font-bold',
                profitability.isProfitable ? 'text-green-600' : 'text-red-600'
              )}>
                {profitability.recommendation.toUpperCase()}
              </div>
              <div className="text-sm text-muted-foreground">
                Recommendation
              </div>
            </div>
          </div>

          {profitability.riskFactors.length > 0 && (
            <div className="mt-4 p-3 rounded-lg bg-yellow-50 border border-yellow-200">
              <div className="flex items-center gap-2 text-yellow-800 mb-2">
                <AlertCircle className="h-4 w-4" />
                <span className="font-medium">Risk Factors</span>
              </div>
              <ul className="text-sm text-yellow-700 space-y-1">
                {profitability.riskFactors.map((factor, index) => (
                  <li key={index}>• {factor}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Execution Status */}
      <div className="p-4 rounded-xl border bg-card">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {getStatusIcon()}
            <div>
              <h3 className="font-semibold text-card-foreground">
                Execution Status
              </h3>
              <p className="text-sm text-muted-foreground">
                {getStatusText()}
              </p>
            </div>
          </div>

          {submission && (
            <div className="text-xs text-muted-foreground">
              {new Date(submission.timestamp).toLocaleTimeString()}
            </div>
          )}
        </div>

        {/* Execution Progress */}
        {submission && (
          <div className="space-y-4">
            {/* Progress Steps */}
            <div className="flex items-center justify-between text-sm">
              <div className={cn(
                'flex items-center gap-2',
                ['submitted', 'processing', 'completed'].includes(submission.status) 
                  ? 'text-green-600' : 'text-muted-foreground'
              )}>
                <div className={cn(
                  'w-2 h-2 rounded-full',
                  ['submitted', 'processing', 'completed'].includes(submission.status) 
                    ? 'bg-green-500' : 'bg-gray-300'
                )} />
                Submitted
              </div>

              <ArrowRight className="h-4 w-4 text-muted-foreground" />

              <div className={cn(
                'flex items-center gap-2',
                ['processing', 'completed'].includes(submission.status) 
                  ? 'text-blue-600' : 'text-muted-foreground'
              )}>
                <div className={cn(
                  'w-2 h-2 rounded-full',
                  ['processing', 'completed'].includes(submission.status) 
                    ? 'bg-blue-500' : 'bg-gray-300'
                )} />
                Processing
              </div>

              <ArrowRight className="h-4 w-4 text-muted-foreground" />

              <div className={cn(
                'flex items-center gap-2',
                submission.status === 'completed' 
                  ? 'text-green-600' : 'text-muted-foreground'
              )}>
                <div className={cn(
                  'w-2 h-2 rounded-full',
                  submission.status === 'completed' 
                    ? 'bg-green-500' : 'bg-gray-300'
                )} />
                Completed
              </div>
            </div>

            {/* Order Hash */}
            {submission.orderHash && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Order Hash:</span>
                <code className="px-2 py-1 rounded bg-muted text-xs">
                  {submission.orderHash.slice(0, 10)}...{submission.orderHash.slice(-8)}
                </code>
                <button className="p-1 rounded hover:bg-muted">
                  <ExternalLink className="h-3 w-3 text-muted-foreground" />
                </button>
              </div>
            )}

            {/* Transaction Hash */}
            {submission.transactionHash && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Transaction:</span>
                <code className="px-2 py-1 rounded bg-muted text-xs">
                  {submission.transactionHash.slice(0, 10)}...{submission.transactionHash.slice(-8)}
                </code>
                <button className="p-1 rounded hover:bg-muted">
                  <ExternalLink className="h-3 w-3 text-muted-foreground" />
                </button>
              </div>
            )}

            {/* Execution Result */}
            {submission.executionResult && (
              <div className="p-3 rounded-lg bg-muted">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-card-foreground">
                    Execution Result
                  </span>
                  <div className={cn(
                    'px-2 py-1 rounded-full text-xs font-medium',
                    submission.executionResult.success 
                      ? 'bg-green-100 text-green-700' 
                      : 'bg-red-100 text-red-700'
                  )}>
                    {submission.executionResult.success ? 'Success' : 'Failed'}
                  </div>
                </div>

                {submission.executionResult.actualProfit && (
                  <div className="text-sm text-muted-foreground">
                    Actual Profit: {parseFloat(submission.executionResult.actualProfit).toFixed(6)} ETH
                  </div>
                )}

                {submission.executionResult.gasUsed && (
                  <div className="text-sm text-muted-foreground">
                    Gas Used: {parseInt(submission.executionResult.gasUsed).toLocaleString()}
                  </div>
                )}

                {submission.executionResult.error && (
                  <div className="text-sm text-red-600 mt-2">
                    Error: {submission.executionResult.error}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 mt-4">
          {!submission && (
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || (profitability?.isProfitable === false)}
              className="flex-1 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Submitting...' : 'Submit to Relayer'}
            </button>
          )}

          {submission && submission.status === 'submitted' && (
            <>
              <button
                onClick={handleRequestExecution}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700"
              >
                Request Immediate Execution
              </button>
              <button
                onClick={handleCancel}
                className="px-4 py-2 rounded-lg border border-red-200 text-red-600 font-medium hover:bg-red-50"
              >
                Cancel
              </button>
            </>
          )}
        </div>

        {/* Error Display */}
        {error && (
          <div className="mt-4 p-3 rounded-lg bg-red-50 border border-red-200">
            <div className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-4 w-4" />
              <span className="font-medium">Error</span>
            </div>
            <p className="text-sm text-red-600 mt-1">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}