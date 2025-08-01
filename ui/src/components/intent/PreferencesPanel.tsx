/**
 * Preferences Panel - Advanced settings for intent customization
 */

'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Settings, ChevronDown, AlertTriangle, Clock, Percent } from 'lucide-react';
import { cn } from '@/utils/utils';
import { useIntentStore } from '@/stores/intentStore';
import { formatPercentage, formatDuration } from '@/utils/utils';

export function PreferencesPanel() {
  const [isExpanded, setIsExpanded] = useState(false);
  const { currentIntent, updateIntent } = useIntentStore();

  if (!currentIntent) return null;

  const handleSlippageChange = (slippage: number) => {
    updateIntent({ maxSlippage: slippage });
  };

  const handleDeadlineChange = (minutes: number) => {
    const deadline = Math.floor(Date.now() / 1000) + (minutes * 60);
    updateIntent({ deadline });
  };

  const currentDeadlineMinutes = currentIntent.deadline 
    ? Math.floor((currentIntent.deadline - Date.now() / 1000) / 60)
    : 5;

  return (
    <Card className="overflow-hidden">
      <CardHeader 
        className="cursor-pointer select-none"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <CardTitle className="flex items-center justify-between text-lg">
          <div className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Advanced Preferences
          </div>
          <ChevronDown className={cn(
            "h-4 w-4 transition-transform text-muted-foreground",
            isExpanded && "transform rotate-180"
          )} />
        </CardTitle>
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-6">
          {/* Slippage Tolerance */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Percent className="h-4 w-4 text-muted-foreground" />
              <label className="text-sm font-medium">
                Slippage Tolerance
              </label>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {[25, 50, 100, 300].map((slippage) => (
                <Button
                  key={slippage}
                  variant={currentIntent.maxSlippage === slippage ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleSlippageChange(slippage)}
                  className="text-xs"
                >
                  {formatPercentage(slippage / 100, 1)}
                </Button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                max="50"
                step="0.1"
                value={(currentIntent.maxSlippage || 50) / 100}
                onChange={(e) => handleSlippageChange(parseFloat(e.target.value) * 100)}
                className="flex-1 px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-near-500"
                placeholder="Custom %"
              />
              <span className="text-xs text-muted-foreground">%</span>
            </div>
            {(currentIntent.maxSlippage || 0) > 500 && (
              <div className="flex items-center gap-2 p-2 rounded-md bg-yellow-50 border border-yellow-200">
                <AlertTriangle className="h-4 w-4 text-yellow-600" />
                <span className="text-xs text-yellow-700">
                  High slippage tolerance may result in unfavorable trades
                </span>
              </div>
            )}
          </div>

          {/* Transaction Deadline */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <label className="text-sm font-medium">
                Transaction Deadline
              </label>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {[5, 10, 30, 60].map((minutes) => (
                <Button
                  key={minutes}
                  variant={currentDeadlineMinutes === minutes ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleDeadlineChange(minutes)}
                  className="text-xs"
                >
                  {minutes}m
                </Button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                max="1440"
                value={currentDeadlineMinutes}
                onChange={(e) => handleDeadlineChange(parseInt(e.target.value))}
                className="flex-1 px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-near-500"
                placeholder="Custom minutes"
              />
              <span className="text-xs text-muted-foreground">minutes</span>
            </div>
          </div>

          {/* Priority Settings */}
          <div className="space-y-3">
            <label className="text-sm font-medium">
              Execution Priority
            </label>
            <div className="space-y-2">
              {[
                { 
                  value: 'speed' as const, 
                  label: 'Speed First', 
                  description: 'Prioritize fast execution over cost savings' 
                },
                { 
                  value: 'cost' as const, 
                  label: 'Best Price', 
                  description: 'Optimize for maximum output amount' 
                },
                { 
                  value: 'security' as const, 
                  label: 'Maximum Security', 
                  description: 'Only use TEE-verified solvers' 
                }
              ].map((option) => (
                <div
                  key={option.value}
                  className={cn(
                    "p-3 rounded-lg border cursor-pointer transition-all",
                    currentIntent.prioritize === option.value
                      ? "border-near-500 bg-near-50 ring-2 ring-near-200"
                      : "border-border hover:border-near-300 hover:bg-near-50/50"
                  )}
                  onClick={() => updateIntent({ prioritize: option.value })}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-4 h-4 rounded-full border-2 flex items-center justify-center",
                      currentIntent.prioritize === option.value
                        ? "border-near-500 bg-near-500"
                        : "border-muted-foreground"
                    )}>
                      {currentIntent.prioritize === option.value && (
                        <div className="w-2 h-2 rounded-full bg-white" />
                      )}
                    </div>
                    <div>
                      <div className="text-sm font-medium">{option.label}</div>
                      <div className="text-xs text-muted-foreground">
                        {option.description}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Reset to Defaults */}
          <div className="pt-4 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                updateIntent({
                  maxSlippage: 50,
                  deadline: Math.floor(Date.now() / 1000) + 300,
                  prioritize: 'speed'
                });
              }}
              className="w-full"
            >
              Reset to Defaults
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}