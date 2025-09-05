/**
 * Network Tester - Debug component to test NEAR RPC connectivity
 */

'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { testNearRpcConnectivity } from '@/utils/nearRpcTest'

export function NetworkTester() {
  const [testing, setTesting] = useState(false)
  const [results, setResults] = useState<string>('')

  const testConnectivity = async () => {
    setTesting(true)
    setResults('Testing NEAR RPC connectivity...\n')
    
    try {
      const workingEndpoint = await testNearRpcConnectivity('testnet')
      if (workingEndpoint) {
        setResults(prev => prev + ` Found working endpoint: ${workingEndpoint}\n`)
      } else {
        setResults(prev => prev + ' No working endpoints found\n')
      }
    } catch (error) {
      setResults(prev => prev + ` Test failed: ${error}\n`)
    } finally {
      setTesting(false)
    }
  }

  if (process.env.NODE_ENV !== 'development') {
    return null // Only show in development
  }

  return (
    <Card className="mb-4 border-orange-200 bg-orange-50">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-orange-800">
           Network Debug Tool
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-orange-700">
          If wallet connection is failing, test NEAR RPC connectivity:
        </p>
        
        <Button 
          onClick={testConnectivity} 
          disabled={testing}
          size="sm"
          variant="outline"
          className="border-orange-300 text-orange-800 hover:bg-orange-100"
        >
          {testing ? 'Testing...' : 'Test RPC Connectivity'}
        </Button>
        
        {results && (
          <pre className="text-xs bg-gray-100 p-2 rounded overflow-auto max-h-32">
            {results}
          </pre>
        )}
        
        <p className="text-xs text-orange-600">
          Note: RPC connectivity issues are common in development and may be due to CORS, 
          network restrictions, or temporary service issues.
        </p>
      </CardContent>
    </Card>
  )
}