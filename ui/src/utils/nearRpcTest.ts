/**
 * Utility to test NEAR RPC connectivity
 */

const RPC_ENDPOINTS = {
  testnet: [
    'https://rpc.testnet.near.org',
    'https://near-testnet.lava.build',
    'https://endpoints.omniatech.io/v1/near/testnet/public',
  ],
  mainnet: [
    'https://rpc.mainnet.near.org', 
    'https://near-mainnet.lava.build',
    'https://endpoints.omniatech.io/v1/near/mainnet/public',
  ]
}

/**
 * Test connectivity to NEAR RPC endpoints
 */
export async function testNearRpcConnectivity(network: 'testnet' | 'mainnet' = 'testnet') {
  const endpoints = RPC_ENDPOINTS[network]
  
  console.log(`🧪 Testing NEAR ${network} RPC connectivity...`)
  
  for (const endpoint of endpoints) {
    try {
      console.log(`🔍 Testing ${endpoint}...`)
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'dontcare',
          method: 'status',
          params: []
        })
      })
      
      if (response.ok) {
        const data = await response.json()
        console.log(`✅ ${endpoint} is working!`)
        console.log(`📊 Chain ID: ${data.result?.chain_id}`)
        return endpoint
      } else {
        console.log(`❌ ${endpoint} returned ${response.status}`)
      }
      
    } catch (error) {
      console.log(`❌ ${endpoint} failed:`, error)
    }
  }
  
  console.log('🚨 All RPC endpoints failed!')
  return null
}

/**
 * Get the best working RPC endpoint
 */
export async function getBestRpcEndpoint(network: 'testnet' | 'mainnet' = 'testnet'): Promise<string> {
  const workingEndpoint = await testNearRpcConnectivity(network)
  
  if (workingEndpoint) {
    return workingEndpoint
  }
  
  // Fallback to default
  console.log('⚠️ No working RPC found, using default')
  return RPC_ENDPOINTS[network][0]
}