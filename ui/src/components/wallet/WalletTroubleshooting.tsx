/**
 * Wallet Troubleshooting - Help users with common wallet connection issues
 */

'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { 
  AlertCircle, 
  ExternalLink, 
  CheckCircle, 
  Info,
  ChevronDown,
  ChevronUp
} from 'lucide-react'

export function WalletTroubleshooting() {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <Card className="border-blue-200 bg-blue-50/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-blue-800 flex items-center gap-2">
            <Info className="h-4 w-4" />
            Wallet Connection Help
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-blue-600 hover:text-blue-800"
          >
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>
      
      {isExpanded && (
        <CardContent className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Connection Issues?</AlertTitle>
            <AlertDescription>
              Common errors: "account doesn't exist" or "intents.testnet doesn't exist" - both indicate setup issues.
            </AlertDescription>
          </Alert>

          <div className="space-y-3">
            <h4 className="font-medium text-blue-800">🔧 Quick Fixes:</h4>
            
            <div className="space-y-2 text-sm">
              <div className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                <div>
                  <strong>Create NEAR Testnet Account:</strong>
                  <br />
                  <Button
                    variant="link"
                    size="sm"
                    className="p-0 h-auto text-blue-600 hover:text-blue-800"
                    onClick={() => window.open('https://wallet.testnet.near.org', '_blank')}
                  >
                    Go to wallet.testnet.near.org
                    <ExternalLink className="h-3 w-3 ml-1" />
                  </Button>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                <div>
                  <strong>Get Testnet NEAR:</strong>
                  <br />
                  <Button
                    variant="link"
                    size="sm"
                    className="p-0 h-auto text-blue-600 hover:text-blue-800"
                    onClick={() => window.open('https://near-faucet.io', '_blank')}
                  >
                    Get free testnet NEAR from faucet
                    <ExternalLink className="h-3 w-3 ml-1" />
                  </Button>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                <div>
                  <strong>Fixed "intents.testnet doesn't exist":</strong>
                  <br />
                  This was a configuration issue - now resolved! The wallet no longer requires a specific contract to connect.
                </div>
              </div>

              <div className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                <div>
                  <strong>Network Issues?</strong>
                  <br />
                  Try refreshing the page or switching networks if the RPC is overloaded
                </div>
              </div>
            </div>
          </div>

          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              <strong>Note:</strong> This app uses NEAR testnet for development. 
              Testnet tokens have no real value and are used for testing only.
            </AlertDescription>
          </Alert>
        </CardContent>
      )}
    </Card>
  )
}