/**
 * Autonomous Execution Component
 * Shows autonomous TEE solver processing and execution for intents
 */

'use client';

import React, { useEffect, useState } from 'react';
import { Brain, CheckCircle, XCircle, AlertTriangle, Shield, Zap, Activity, Clock, TrendingUp } from 'lucide-react';
import { cn } from '@/utils/utils';
import { useTEESolverIntegration, SwapDecision, SwapExecution } from '@/services/teeIntegration';
import { IntentRequest } from '@/types/intent';

interface AutonomousExecutionProps {
  intent: IntentRequest;
  onExecutionComplete?: (result: SwapExecution) => void;
  className?: string;
}

export function AutonomousExecution({ intent, onExecutionComplete, className }: AutonomousExecutionProps) {
  const { 
    submitToTEE, 
    analyzeIntent, 
    getExecutionStatus, 
    startMonitoring,
    requestExecution,
    cancelRequest,
    isHealthy,
    attestation
  } = useTEESolverIntegration();

  const [decision, setDecision] = useState<SwapDecision | null>(null);
  const [execution, setExecution] = useState<SwapExecution | null>(null);
  const [solverRequestId, setSolverRequestId] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-analyze the intent when component mounts
  useEffect(() => {
    if (isHealthy && !decision && !isAnalyzing) {
      handleAnalyze();
    }
  }, [isHealthy]);

  // Start monitoring if we have a solver request ID
  useEffect(() => {
    if (!solverRequestId || !execution || execution.success || execution.error) {
      return;
    }

    const cleanup = startMonitoring(solverRequestId, (update) => {
      setExecution(update);
      
      if (update.success || update.error) {
        onExecutionComplete?.(update);
      }
    });

    return cleanup;
  }, [solverRequestId, execution, startMonitoring, onExecutionComplete]);

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    setError(null);

    try {
      const analysis = await analyzeIntent(intent);
      setDecision(analysis);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSubmitToTEE = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      const result = await submitToTEE(intent);
      setSolverRequestId(result.solverRequestId);
      setDecision(result.decision);
      setExecution(result.execution || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRequestExecution = async () => {
    if (!solverRequestId) return;
    
    try {
      const success = await requestExecution(solverRequestId);
      if (success && execution) {
        setExecution({ ...execution, success: false, error: undefined });
      }
    } catch (err) {
      setError('Failed to request execution');
    }
  };

  const handleCancel = async () => {
    if (!solverRequestId) return;
    
    try {
      const success = await cancelRequest(solverRequestId);
      if (success && execution) {
        setExecution({ ...execution, success: false, error: 'Cancelled by user' });
      }
    } catch (err) {
      setError('Failed to cancel request');
    }
  };

  const getRiskScoreColor = (score: number) => {
    if (score <= 0.3) return 'text-green-600';
    if (score <= 0.7) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getRiskScoreBg = (score: number) => {
    if (score <= 0.3) return 'bg-green-100';
    if (score <= 0.7) return 'bg-yellow-100';
    return 'bg-red-100';
  };

  return (
    <div className={cn('space-y-6', className)}>
      {/* TEE Status Check */}
      {!isHealthy && (
        <div className="p-4 rounded-xl border border-yellow-200 bg-yellow-50">
          <div className="flex items-center gap-2 text-yellow-800">
            <AlertTriangle className="h-4 w-4" />
            <span className="font-medium">TEE Solver Unavailable</span>
          </div>
          <p className="text-sm text-yellow-700 mt-1">
            The autonomous TEE solver is currently offline. Autonomous processing is not available.
          </p>
        </div>
      )}

      {/* Autonomous Analysis */}
      <div className="p-4 rounded-xl border bg-card">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Brain className="h-5 w-5 text-purple-500" />
            <div>
              <h3 className="font-semibold text-card-foreground">
                Autonomous Analysis
              </h3>
              <p className="text-sm text-muted-foreground">
                TEE-verified intelligent decision making
              </p>
            </div>
          </div>

          {attestation && (
            <div className={cn(
              'px-2 py-1 rounded-full text-xs font-medium',
              attestation.valid ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
            )}>
              <Shield className="h-3 w-3 inline mr-1" />
              {attestation.valid ? 'TEE Verified' : 'Unverified'}
            </div>
          )}
        </div>

        {isAnalyzing && (
          <div className="flex items-center gap-3 p-4 rounded-lg bg-blue-50 border border-blue-200">
            <Brain className="h-5 w-5 text-blue-500 animate-pulse" />
            <div>
              <div className="font-medium text-blue-800">Analyzing Intent</div>
              <div className="text-sm text-blue-600">
                TEE solver is evaluating profitability and risk...
              </div>
            </div>
          </div>
        )}

        {decision && !isAnalyzing && (
          <div className="space-y-4">
            {/* Decision Summary */}
            <div className="flex items-center justify-between p-4 rounded-lg bg-muted">
              <div className="flex items-center gap-3">
                {decision.shouldExecute ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-500" />
                )}
                <div>
                  <div className="font-semibold text-card-foreground">
                    {decision.shouldExecute ? 'Execution Recommended' : 'Execution Not Recommended'}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {decision.reason}
                  </div>
                </div>
              </div>

              <div className="text-right">
                <div className="text-lg font-bold text-card-foreground">
                  {parseFloat(decision.expectedProfit).toFixed(6)} ETH
                </div>
                <div className="text-sm text-muted-foreground">
                  Expected Profit
                </div>
              </div>
            </div>

            {/* Analysis Details */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-3 rounded-lg bg-muted">
                <div className={cn(
                  'text-lg font-bold',
                  getRiskScoreColor(decision.riskScore)
                )}>
                  {(decision.riskScore * 100).toFixed(1)}%
                </div>
                <div className="text-sm text-muted-foreground">
                  Risk Score
                </div>
              </div>

              <div className="text-center p-3 rounded-lg bg-muted">
                <div className="text-lg font-bold text-card-foreground">
                  {decision.executionStrategy.toUpperCase()}
                </div>
                <div className="text-sm text-muted-foreground">
                  Strategy
                </div>
              </div>

              <div className="text-center p-3 rounded-lg bg-muted">
                <div className="text-lg font-bold text-blue-600">
                  {decision.shouldExecute ? 'GO' : 'STOP'}
                </div>
                <div className="text-sm text-muted-foreground">
                  Decision
                </div>
              </div>
            </div>

            {/* Detailed Analysis */}
            {decision.profitAnalysis && (
              <div className="p-4 rounded-lg border">
                <h4 className="font-medium text-card-foreground mb-3">
                  Detailed Analysis
                </h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-muted-foreground mb-2">Cost Breakdown</div>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span>Gas Costs:</span>
                        <span>{decision.profitAnalysis.costAnalysis.gasCosts.toFixed(6)} ETH</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Bridge Fees:</span>
                        <span>{decision.profitAnalysis.costAnalysis.bridgeFees.toFixed(6)} ETH</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Slippage Impact:</span>
                        <span>{(decision.profitAnalysis.costAnalysis.slippageImpact * 100).toFixed(2)}%</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="text-sm text-muted-foreground mb-2">Market Conditions</div>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span>Volatility:</span>
                        <span>{(decision.profitAnalysis.marketConditions.volatility * 100).toFixed(1)}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Liquidity:</span>
                        <span>{(decision.profitAnalysis.marketConditions.liquidity * 100).toFixed(0)}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Spreads:</span>
                        <span>{(decision.profitAnalysis.marketConditions.spreads * 100).toFixed(2)}%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 mt-4">
          {!decision && !isAnalyzing && (
            <button
              onClick={handleAnalyze}
              disabled={!isHealthy}
              className="flex-1 px-4 py-2 rounded-lg border border-blue-200 text-blue-600 font-medium hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Analyze with TEE
            </button>
          )}

          {decision && !solverRequestId && (
            <>
              {decision.shouldExecute && (
                <button
                  onClick={handleSubmitToTEE}
                  disabled={isSubmitting || !isHealthy}
                  className="flex-1 px-4 py-2 rounded-lg bg-purple-600 text-white font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Submitting...' : 'Submit for Autonomous Execution'}
                </button>
              )}
              <button
                onClick={handleAnalyze}
                disabled={isAnalyzing || !isHealthy}
                className="px-4 py-2 rounded-lg border border-gray-200 text-gray-600 font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Re-analyze
              </button>
            </>
          )}
        </div>

        {/* Error Display */}
        {error && (
          <div className="mt-4 p-3 rounded-lg bg-red-50 border border-red-200">
            <div className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-4 w-4" />
              <span className="font-medium">Error</span>
            </div>
            <p className="text-sm text-red-600 mt-1">{error}</p>
          </div>
        )}
      </div>

      {/* Execution Status */}
      {execution && (
        <div className="p-4 rounded-xl border bg-card">
          <div className="flex items-center gap-3 mb-4">
            <Activity className="h-5 w-5 text-blue-500" />
            <h3 className="font-semibold text-card-foreground">
              Autonomous Execution
            </h3>
            <div className={cn(
              'px-2 py-1 rounded-full text-xs font-medium',
              execution.success ? 'bg-green-100 text-green-700' :
              execution.error ? 'bg-red-100 text-red-700' :
              'bg-blue-100 text-blue-700'
            )}>
              {execution.success ? 'Completed' : execution.error ? 'Failed' : 'Processing'}
            </div>
          </div>

          {/* Execution Steps */}
          {execution.steps && execution.steps.length > 0 && (
            <div className="space-y-3">
              <div className="text-sm text-muted-foreground mb-2">
                Execution Steps:
              </div>
              {execution.steps.map((step, index) => (
                <div key={index} className="flex items-center gap-3 p-3 rounded-lg bg-muted">
                  <div className={cn(
                    'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold',
                    step.status === 'completed' ? 'bg-green-500 text-white' :
                    step.status === 'processing' ? 'bg-blue-500 text-white animate-pulse' :
                    step.status === 'failed' ? 'bg-red-500 text-white' :
                    'bg-gray-300 text-gray-700'
                  )}>
                    {step.step}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-card-foreground">
                      {step.description}
                    </div>
                    {step.transactionHash && (
                      <div className="text-xs text-muted-foreground">
                        Tx: {step.transactionHash.slice(0, 10)}...{step.transactionHash.slice(-8)}
                      </div>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(step.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Execution Results */}
          {execution.success && execution.actualProfit && (
            <div className="mt-4 p-3 rounded-lg bg-green-50 border border-green-200">
              <div className="flex items-center gap-2 text-green-800">
                <TrendingUp className="h-4 w-4" />
                <span className="font-medium">Autonomous Execution Successful</span>
              </div>
              <div className="text-sm text-green-700 mt-1">
                Actual Profit: {parseFloat(execution.actualProfit).toFixed(6)} ETH
              </div>
            </div>
          )}

          {execution.error && (
            <div className="mt-4 p-3 rounded-lg bg-red-50 border border-red-200">
              <div className="flex items-center gap-2 text-red-800">
                <XCircle className="h-4 w-4" />
                <span className="font-medium">Execution Failed</span>
              </div>
              <div className="text-sm text-red-700 mt-1">
                {execution.error}
              </div>
            </div>
          )}

          {/* Action Buttons for Active Execution */}
          {solverRequestId && !execution.success && !execution.error && (
            <div className="flex gap-3 mt-4">
              <button
                onClick={handleRequestExecution}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700"
              >
                Prioritize Execution
              </button>
              <button
                onClick={handleCancel}
                className="px-4 py-2 rounded-lg border border-red-200 text-red-600 font-medium hover:bg-red-50"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}