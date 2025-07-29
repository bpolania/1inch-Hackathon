/**
 * Mock Web3 Provider for 1inch SDK Integration
 * 
 * Provides a minimal Web3-like interface for testing and development
 */

export interface Web3Like {
  eth: {
    getGasPrice(): Promise<string>;
    estimateGas(tx: any): Promise<string>;
    getTransactionCount(address: string): Promise<number>;
    sendSignedTransaction(signedTx: string): Promise<any>;
    call(tx: any): Promise<string>;
    getBalance(address: string): Promise<string>;
    getCode(address: string): Promise<string>;
    getChainId(): Promise<number>;
  };
  currentProvider?: any;
  extend: (extension: unknown) => any;
}

export class MockWeb3Provider implements Web3Like {
  private chainId: number;

  constructor(chainId: number = 1) {
    this.chainId = chainId;
  }

  eth = {
    getGasPrice: async (): Promise<string> => {
      // Return mock gas price (20 gwei)
      return '20000000000';
    },

    estimateGas: async (tx: any): Promise<string> => {
      // Return mock gas estimate based on transaction type
      if (tx.to && tx.data) {
        return '150000'; // Contract interaction
      }
      return '21000'; // Simple transfer
    },

    getTransactionCount: async (address: string): Promise<number> => {
      // Return mock nonce
      return 42;
    },

    sendSignedTransaction: async (signedTx: string): Promise<any> => {
      // Return mock transaction receipt
      return {
        transactionHash: '0x' + Array(64).fill('a').join(''),
        blockNumber: 12345678,
        gasUsed: '150000',
        status: true
      };
    },

    call: async (tx: any): Promise<string> => {
      // Return mock call result
      return '0x0000000000000000000000000000000000000000000000000000000000000001';
    },

    getBalance: async (address: string): Promise<string> => {
      // Return mock balance (1 ETH)
      return '1000000000000000000';
    },

    getCode: async (address: string): Promise<string> => {
      // Return mock contract code
      return '0x608060405234801561001057600080fd5b50';
    },

    getChainId: async (): Promise<number> => {
      return this.chainId;
    }
  };

  currentProvider = {
    request: async (args: { method: string; params?: any[] }) => {
      switch (args.method) {
        case 'eth_chainId':
          return `0x${this.chainId.toString(16)}`;
        case 'eth_accounts':
          return ['0x742d35Cc6634C0532925a3b8D1Cc9E78e0b7548b'];
        case 'eth_gasPrice':
          return '0x4a817c800'; // 20 gwei
        case 'net_version':
          return this.chainId.toString();
        default:
          throw new Error(`Unsupported method: ${args.method}`);
      }
    }
  };

  extend = (extension: unknown) => {
    // Mock extend functionality
    return this;
  };
}

// Web3-compatible provider factory
export function createMockWeb3Provider(chainId: number = 1): Web3Like {
  return new MockWeb3Provider(chainId);
}