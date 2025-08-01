/**
 * Robust RPC Provider with fallback and retry logic
 */

import { providers } from 'near-api-js'

const RPC_ENDPOINTS = {
  mainnet: [
    'https://rpc.mainnet.near.org',
    'https://near-mainnet.lava.build',
    'https://endpoints.omniatech.io/v1/near/mainnet/public',
  ],
  testnet: [
    'https://rpc.testnet.near.org',
    'https://near-testnet.lava.build', 
    'https://endpoints.omniatech.io/v1/near/testnet/public',
  ]
}

export class RobustRpcProvider {
  private networkId: 'mainnet' | 'testnet'
  private providers: providers.JsonRpcProvider[]
  private currentIndex: number = 0

  constructor(networkId: 'mainnet' | 'testnet') {
    this.networkId = networkId
    this.providers = RPC_ENDPOINTS[networkId].map(url => 
      new providers.JsonRpcProvider({ url })
    )
  }

  private async tryProvider(providerIndex: number, query: any): Promise<any> {
    const provider = this.providers[providerIndex]
    if (!provider) throw new Error('No more providers to try')

    try {
      return await provider.query(query)
    } catch (error) {
      console.warn(`RPC endpoint ${RPC_ENDPOINTS[this.networkId][providerIndex]} failed:`, error)
      throw error
    }
  }

  async query(queryParams: any): Promise<any> {
    let lastError: any

    // Try each provider in sequence
    for (let i = 0; i < this.providers.length; i++) {
      try {
        const result = await this.tryProvider(i, queryParams)
        this.currentIndex = i // Remember working provider
        return result
      } catch (error) {
        lastError = error
        continue
      }
    }

    // If all providers failed, throw the last error
    throw new Error(`All RPC providers failed. Last error: ${lastError?.message || 'Unknown error'}`)
  }

  // Get current working endpoint for debugging
  getCurrentEndpoint(): string {
    return RPC_ENDPOINTS[this.networkId][this.currentIndex] || 'none'
  }
}