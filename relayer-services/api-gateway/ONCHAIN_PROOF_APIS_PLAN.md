# Onchain Proof APIs Implementation Plan

**Status**: Ready for Implementation  
**Estimated Effort**: 2-3 weeks  
**Priority**: High (Essential for frontend trust and verification)

## Executive Summary

This document outlines the implementation plan for **essential Onchain Proof APIs** that provide cryptographic verification of cross-chain atomic swap execution. These APIs bridge the trust gap between complex multi-blockchain coordination and user verification needs.

**Core Value**: Transform "trust the API" into "verify independently" through blockchain explorer links and cryptographic proofs.

## Phase 1: Essential Proof APIs (Priority Implementation)

### 1. Escrow Lock Verification API

**Endpoint**: `GET /api/proofs/escrow/:orderHash`

**Purpose**: Provide cryptographic proof that user tokens are actually locked in 1inch escrow contracts.

#### Implementation Details

**Route Definition** (`src/routes/proofs.ts`):
```typescript
import { Router } from 'express';
import { param, validationResult } from 'express-validator';
import { ethers } from 'ethers';
import { logger } from '../utils/logger';

const router = Router();

/**
 * GET /api/proofs/escrow/:orderHash
 * Get cryptographic proof of escrow lock
 */
router.get('/escrow/:orderHash', [
  param('orderHash').isLength({ min: 66, max: 66 }).withMessage('Invalid order hash format')
], async (req: any, res: any) => {
  try {
    const { orderHash } = req.params;
    
    // Get order details from Fusion+ Factory
    const order = await req.fusionFactory.getOrder(orderHash);
    const escrowAddresses = await req.fusionFactory.getEscrowAddresses(orderHash);
    
    if (!order.isActive && !escrowAddresses.source) {
      return res.status(404).json({
        success: false,
        error: 'Order not found or no escrow created'
      });
    }
    
    // Get escrow lock transaction proof
    const escrowProof = await generateEscrowLockProof(
      escrowAddresses.source,
      order.sourceToken,
      order.sourceAmount,
      orderHash
    );
    
    // Verify current escrow balance
    const currentBalance = await verifyEscrowBalance(
      escrowAddresses.source,
      order.sourceToken
    );
    
    const response = {
      success: true,
      data: {
        orderHash,
        escrowAddress: escrowAddresses.source,
        tokenAddress: order.sourceToken,
        lockedAmount: order.sourceAmount,
        
        // Onchain proof
        ethereumProof: {
          transactionHash: escrowProof.txHash,
          blockNumber: escrowProof.blockNumber,
          blockHash: escrowProof.blockHash,
          logIndex: escrowProof.logIndex,
          contractEventProof: escrowProof.eventSignature
        },
        
        // Balance verification
        currentEscrowBalance: currentBalance.toString(),
        balanceProofBlock: escrowProof.blockNumber,
        
        // Human readable links
        etherscanUrl: `https://sepolia.etherscan.io/tx/${escrowProof.txHash}`,
        escrowEtherscanUrl: `https://sepolia.etherscan.io/address/${escrowAddresses.source}`,
        verificationStatus: currentBalance >= order.sourceAmount ? 'verified' : 'insufficient_balance'
      },
      timestamp: new Date().toISOString()
    };
    
    res.json(response);
    
  } catch (error) {
    logger.error('Escrow proof generation failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate escrow proof',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});
```

**Helper Functions**:
```typescript
async function generateEscrowLockProof(
  escrowAddress: string,
  tokenAddress: string,
  expectedAmount: string,
  orderHash: string
): Promise<EscrowLockProof> {
  // Query Ethereum for escrow creation transaction
  const provider = new ethers.JsonRpcProvider(process.env.ETHEREUM_RPC_URL);
  
  // Find the transaction that created this escrow
  const escrowContract = new ethers.Contract(escrowAddress, ESCROW_ABI, provider);
  
  // Get creation block by querying for EscrowCreated events
  const filter = escrowContract.filters.EscrowCreated(orderHash);
  const events = await escrowContract.queryFilter(filter);
  
  if (events.length === 0) {
    throw new Error('Escrow creation event not found');
  }
  
  const creationEvent = events[0];
  const receipt = await provider.getTransactionReceipt(creationEvent.transactionHash);
  const block = await provider.getBlock(receipt.blockNumber);
  
  return {
    txHash: creationEvent.transactionHash,
    blockNumber: receipt.blockNumber,
    blockHash: block.hash,
    logIndex: creationEvent.logIndex,
    eventSignature: creationEvent.signature
  };
}

async function verifyEscrowBalance(
  escrowAddress: string,
  tokenAddress: string
): Promise<bigint> {
  const provider = new ethers.JsonRpcProvider(process.env.ETHEREUM_RPC_URL);
  
  if (tokenAddress === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee') {
    // ETH balance
    return await provider.getBalance(escrowAddress);
  } else {
    // ERC20 balance
    const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
    return await tokenContract.balanceOf(escrowAddress);
  }
}
```

### 2. Cross-Chain Execution Proof API

**Endpoint**: `GET /api/proofs/cross-chain/:orderHash`

**Purpose**: Prove that NEAR/Bitcoin side execution completed successfully with atomic coordination.

#### Implementation Details

```typescript
/**
 * GET /api/proofs/cross-chain/:orderHash
 * Get proof of cross-chain execution and atomic coordination
 */
router.get('/cross-chain/:orderHash', [
  param('orderHash').isLength({ min: 66, max: 66 }).withMessage('Invalid order hash format')
], async (req: any, res: any) => {
  try {
    const { orderHash } = req.params;
    
    // Get order details
    const order = await req.fusionFactory.getOrder(orderHash);
    const destinationChain = order.destinationChainId;
    
    let crossChainProof;
    
    if (destinationChain === 397) {
      // NEAR Protocol proof
      crossChainProof = await generateNearExecutionProof(orderHash, order);
    } else if (destinationChain === 40004 || destinationChain === 40001) {
      // Bitcoin proof
      crossChainProof = await generateBitcoinExecutionProof(orderHash, order);
    } else {
      throw new Error(`Unsupported destination chain: ${destinationChain}`);
    }
    
    // Get secret coordination proof
    const secretProof = await generateSecretCoordinationProof(orderHash);
    
    const response = {
      success: true,
      data: {
        orderHash,
        destinationChain: getChainName(destinationChain),
        
        // Chain-specific proof
        ...crossChainProof,
        
        // Secret coordination proof
        secretRevealProof: {
          secret: secretProof.secret,
          hashlock: secretProof.hashlock,
          verificationHash: ethers.keccak256(
            ethers.solidityPacked(['bytes32'], [secretProof.secret])
          ),
          coordinationVerified: secretProof.verificationHash === secretProof.hashlock
        },
        
        coordinationStatus: crossChainProof.executionStatus === 'completed' ? 
          'atomic_success' : 'pending'
      },
      timestamp: new Date().toISOString()
    };
    
    res.json(response);
    
  } catch (error) {
    logger.error('Cross-chain proof generation failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate cross-chain proof',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});
```

**NEAR Proof Generation**:
```typescript
async function generateNearExecutionProof(
  orderHash: string,
  order: any
): Promise<NEARExecutionProof> {
  // Query NEAR RPC for transaction execution
  const nearConnection = await connect(NEAR_CONFIG);
  
  // Get NEAR order data
  const nearOrder = await req.nearTakerInteraction.getNearOrder(orderHash);
  
  // Find NEAR transaction by searching for contract calls
  const accountId = nearOrder.destinationAddress;
  const transactions = await nearConnection.connection.provider.query({
    request_type: 'view_account',
    account_id: accountId,
    finality: 'final'
  });
  
  // Find the specific transaction for this order
  const executionTx = await findNearExecutionTransaction(orderHash, nearOrder);
  
  if (!executionTx) {
    return {
      nearProof: null,
      executionStatus: 'pending',
      nearBlocksUrl: `https://testnet.nearblocks.io/address/${accountId}`
    };
  }
  
  // Get transaction receipt and block info
  const receipt = await nearConnection.connection.provider.txStatusReceipts(
    executionTx.hash,
    nearOrder.destinationAddress
  );
  
  return {
    nearProof: {
      transactionId: executionTx.hash,
      blockHash: receipt.receipts_outcome[0].block_hash,
      blockHeight: receipt.final_execution_outcome.block_height,
      receiptProof: JSON.stringify(receipt.receipts_outcome),
      nearBlocksUrl: `https://testnet.nearblocks.io/txns/${executionTx.hash}`
    },
    executionStatus: receipt.status.SuccessValue ? 'completed' : 'failed'
  };
}
```

**Bitcoin Proof Generation**:
```typescript
async function generateBitcoinExecutionProof(
  orderHash: string,
  order: any
): Promise<BitcoinExecutionProof> {
  // Get Bitcoin HTLC details from our Bitcoin service
  const htlcData = await req.bitcoinService.getHTLCByOrderHash(orderHash);
  
  if (!htlcData) {
    return {
      bitcoinProof: null,
      executionStatus: 'pending'
    };
  }
  
  // Query Bitcoin RPC for transaction confirmation
  const bitcoin = new BitcoinRPC(BITCOIN_RPC_CONFIG);
  
  let unlockTx;
  try {
    unlockTx = await bitcoin.getRawTransaction(htlcData.unlockTxId, true);
  } catch (error) {
    return {
      bitcoinProof: {
        transactionId: htlcData.fundingTxId,
        blockstreamUrl: `https://blockstream.info/testnet/tx/${htlcData.fundingTxId}`,
        status: 'funded_not_unlocked'
      },
      executionStatus: 'pending'
    };
  }
  
  return {
    bitcoinProof: {
      transactionId: unlockTx.txid,
      blockHash: unlockTx.blockhash,
      blockHeight: unlockTx.blockheight,
      confirmations: unlockTx.confirmations,
      htlcUnlockProof: unlockTx.hex, // Raw transaction hex
      blockstreamUrl: `https://blockstream.info/testnet/tx/${unlockTx.txid}`
    },
    executionStatus: unlockTx.confirmations >= 1 ? 'completed' : 'pending'
  };
}
```

### 3. Token Settlement Proof API

**Endpoint**: `GET /api/proofs/settlement/:orderHash/:userAddress`

**Purpose**: Prove user actually received tokens on destination chain.

#### Implementation Details

```typescript
/**
 * GET /api/proofs/settlement/:orderHash/:userAddress
 * Get proof that user received tokens on destination chain
 */
router.get('/settlement/:orderHash/:userAddress', [
  param('orderHash').isLength({ min: 66, max: 66 }).withMessage('Invalid order hash'),
  param('userAddress').isString().notEmpty().withMessage('User address required')
], async (req: any, res: any) => {
  try {
    const { orderHash, userAddress } = req.params;
    
    // Get order details
    const order = await req.fusionFactory.getOrder(orderHash);
    const destinationChain = order.destinationChainId;
    
    let settlementProof;
    
    if (destinationChain === 397) {
      // NEAR settlement proof
      settlementProof = await generateNearSettlementProof(orderHash, userAddress, order);
    } else if (destinationChain === 40004 || destinationChain === 40001) {
      // Bitcoin settlement proof
      settlementProof = await generateBitcoinSettlementProof(orderHash, userAddress, order);
    } else {
      throw new Error(`Unsupported destination chain: ${destinationChain}`);
    }
    
    const response = {
      success: true,
      data: {
        orderHash,
        userAddress,
        destinationChain: getChainName(destinationChain),
        ...settlementProof
      },
      timestamp: new Date().toISOString()
    };
    
    res.json(response);
    
  } catch (error) {
    logger.error('Settlement proof generation failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate settlement proof',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});
```

**Settlement Proof Generation**:
```typescript
async function generateNearSettlementProof(
  orderHash: string,
  userAddress: string,
  order: any
): Promise<SettlementProof> {
  const nearConnection = await connect(NEAR_CONFIG);
  
  // Get balance before and after the swap
  const account = await nearConnection.account(userAddress);
  
  // Find the token transfer transaction
  const transferTx = await findNearTokenTransfer(orderHash, userAddress);
  
  if (!transferTx) {
    return {
      tokenTransfer: null,
      balanceProof: null,
      explorerUrl: `https://testnet.nearblocks.io/address/${userAddress}`,
      verificationStatus: 'pending'
    };
  }
  
  return {
    tokenTransfer: {
      fromAddress: transferTx.predecessor_id,
      toAddress: userAddress,
      tokenAmount: order.destinationAmount,
      transactionHash: transferTx.transaction_hash,
      blockNumber: transferTx.block_height
    },
    
    balanceProof: {
      balanceBefore: transferTx.balanceBefore || '0',
      balanceAfter: transferTx.balanceAfter || '0',
      balanceChange: order.destinationAmount,
      proofBlock: transferTx.block_height
    },
    
    explorerUrl: `https://testnet.nearblocks.io/txns/${transferTx.transaction_hash}`,
    verificationStatus: 'confirmed'
  };
}

async function generateBitcoinSettlementProof(
  orderHash: string,
  userAddress: string,
  order: any
): Promise<SettlementProof> {
  const bitcoin = new BitcoinRPC(BITCOIN_RPC_CONFIG);
  
  // Get HTLC unlock transaction that sent Bitcoin to user
  const htlcData = await req.bitcoinService.getHTLCByOrderHash(orderHash);
  
  if (!htlcData || !htlcData.unlockTxId) {
    return {
      tokenTransfer: null,
      balanceProof: null,
      explorerUrl: `https://blockstream.info/testnet/address/${userAddress}`,
      verificationStatus: 'pending'
    };
  }
  
  const unlockTx = await bitcoin.getRawTransaction(htlcData.unlockTxId, true);
  
  // Find the output that went to the user
  const userOutput = unlockTx.vout.find((output: any) => 
    output.scriptPubKey.address === userAddress
  );
  
  if (!userOutput) {
    throw new Error('User output not found in unlock transaction');
  }
  
  return {
    tokenTransfer: {
      fromAddress: htlcData.htlcAddress,
      toAddress: userAddress,
      tokenAmount: (userOutput.value * 100000000).toString(), // Convert BTC to satoshis
      transactionHash: unlockTx.txid,
      blockNumber: unlockTx.blockheight
    },
    
    balanceProof: {
      balanceBefore: '0', // Would need additional query for previous balance
      balanceAfter: (userOutput.value * 100000000).toString(),
      balanceChange: (userOutput.value * 100000000).toString(),
      proofBlock: unlockTx.blockheight
    },
    
    explorerUrl: `https://blockstream.info/testnet/tx/${unlockTx.txid}`,
    verificationStatus: unlockTx.confirmations >= 1 ? 'confirmed' : 'pending'
  };
}
```

## Implementation Architecture

### Service Layer Organization

```typescript
// src/services/ProofService.ts
export class ProofService {
  constructor(
    private ethereumProvider: ethers.Provider,
    private nearConnection: Near,
    private bitcoinRPC: BitcoinRPC,
    private fusionFactory: Contract,
    private nearTakerInteraction: Contract
  ) {}
  
  async generateEscrowProof(orderHash: string): Promise<EscrowProof> {
    // Implementation details...
  }
  
  async generateCrossChainProof(orderHash: string): Promise<CrossChainProof> {
    // Implementation details...
  }
  
  async generateSettlementProof(orderHash: string, userAddress: string): Promise<SettlementProof> {
    // Implementation details...
  }
}
```

### Database Schema for Proof Caching

```sql
-- Proof cache table for performance optimization
CREATE TABLE proof_cache (
  id SERIAL PRIMARY KEY,
  order_hash VARCHAR(66) NOT NULL,
  proof_type VARCHAR(50) NOT NULL, -- 'escrow', 'cross_chain', 'settlement'
  user_address VARCHAR(100), -- NULL for non-user-specific proofs
  proof_data JSONB NOT NULL,
  blockchain VARCHAR(20) NOT NULL, -- 'ethereum', 'near', 'bitcoin'
  verification_status VARCHAR(20) NOT NULL, -- 'verified', 'pending', 'failed'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP,
  
  UNIQUE(order_hash, proof_type, user_address)
);

-- Indexes for performance
CREATE INDEX idx_proof_cache_order_hash ON proof_cache(order_hash);
CREATE INDEX idx_proof_cache_type ON proof_cache(proof_type);
CREATE INDEX idx_proof_cache_status ON proof_cache(verification_status);
```

### Error Handling and Retry Logic

```typescript
class ProofGenerationError extends Error {
  constructor(
    message: string,
    public readonly proofType: string,
    public readonly orderHash: string,
    public readonly retryable: boolean = true
  ) {
    super(message);
    this.name = 'ProofGenerationError';
  }
}

async function generateProofWithRetry<T>(
  generator: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await generator();
    } catch (error) {
      if (attempt === maxRetries || (error instanceof ProofGenerationError && !error.retryable)) {
        throw error;
      }
      
      logger.warn(`Proof generation attempt ${attempt} failed, retrying in ${delay}ms`, {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      await sleep(delay * attempt); // Exponential backoff
    }
  }
  
  throw new Error('Max retries exceeded');
}
```

## Frontend Integration Support

### Proof Display Components

```typescript
// Enhanced transaction status with proof links
interface TransactionStatusWithProofs {
  orderHash: string;
  status: 'pending' | 'completed' | 'failed';
  proofs: {
    escrowLock?: EscrowProof;
    crossChainExecution?: CrossChainProof;
    tokenSettlement?: SettlementProof;
  };
  verificationLinks: {
    etherscan?: string;
    nearBlocks?: string;
    blockstream?: string;
  };
}

// React component example
function ProofVerificationPanel({ orderHash }: { orderHash: string }) {
  const { data: proofs, loading } = useProofData(orderHash);
  
  if (loading) return <ProofLoadingSpinner />;
  
  return (
    <div className="proof-panel">
      <h3>🔍 Transaction Verification</h3>
      
      <ProofSection 
        title="Escrow Lock" 
        proof={proofs.escrowLock}
        verificationUrl={proofs.escrowLock?.etherscanUrl}
      />
      
      <ProofSection 
        title="Cross-Chain Execution" 
        proof={proofs.crossChainExecution}
        verificationUrl={proofs.crossChainExecution?.nearProof?.nearBlocksUrl || 
                        proofs.crossChainExecution?.bitcoinProof?.blockstreamUrl}
      />
      
      <ProofSection 
        title="Token Settlement" 
        proof={proofs.tokenSettlement}
        verificationUrl={proofs.tokenSettlement?.explorerUrl}
      />
      
      <button onClick={() => downloadProofBundle(orderHash)}>
        📄 Download Verification Certificate
      </button>
    </div>
  );
}
```

## Testing Strategy

### Unit Tests

```typescript
// src/routes/__tests__/proofs.test.ts
describe('Proof APIs', () => {
  describe('GET /api/proofs/escrow/:orderHash', () => {
    it('should generate valid escrow lock proof', async () => {
      const mockOrder = createMockOrder();
      const response = await request(app)
        .get(`/api/proofs/escrow/${mockOrder.orderHash}`);
      
      expect(response.status).toBe(200);
      expect(response.body.data.ethereumProof.transactionHash).toBeDefined();
      expect(response.body.data.verificationStatus).toBe('verified');
    });
    
    it('should handle non-existent orders', async () => {
      const fakeOrderHash = '0x' + '0'.repeat(64);
      const response = await request(app)
        .get(`/api/proofs/escrow/${fakeOrderHash}`);
      
      expect(response.status).toBe(404);
    });
  });
  
  describe('GET /api/proofs/cross-chain/:orderHash', () => {
    it('should generate NEAR execution proof', async () => {
      const mockNearOrder = createMockNearOrder();
      const response = await request(app)
        .get(`/api/proofs/cross-chain/${mockNearOrder.orderHash}`);
      
      expect(response.status).toBe(200);
      expect(response.body.data.nearProof).toBeDefined();
      expect(response.body.data.secretRevealProof.coordinationVerified).toBe(true);
    });
  });
});
```

### Integration Tests

```typescript
// src/__tests__/proofs.integration.test.ts
describe('Proof APIs Integration', () => {
  it('should provide complete proof chain for completed order', async () => {
    // Use a real completed order from testnet
    const realOrderHash = '0x123...'; // From our test data
    
    // Test escrow proof
    const escrowProof = await request(app)
      .get(`/api/proofs/escrow/${realOrderHash}`);
    expect(escrowProof.body.data.verificationStatus).toBe('verified');
    
    // Test cross-chain proof  
    const crossChainProof = await request(app)
      .get(`/api/proofs/cross-chain/${realOrderHash}`);
    expect(crossChainProof.body.data.coordinationStatus).toBe('atomic_success');
    
    // Test settlement proof
    const settlementProof = await request(app)
      .get(`/api/proofs/settlement/${realOrderHash}/0x742d35cc6634c0532925a3b8d4e9dc7d67a1c1e2`);
    expect(settlementProof.body.data.verificationStatus).toBe('confirmed');
  });
});
```

## Performance Optimization

### Caching Strategy

```typescript
class ProofCacheService {
  private cache = new Map<string, CachedProof>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  
  async getCachedProof(key: string): Promise<CachedProof | null> {
    const cached = this.cache.get(key);
    if (cached && Date.now() < cached.expiresAt) {
      return cached;
    }
    
    this.cache.delete(key);
    return null;
  }
  
  setCachedProof(key: string, proof: any): void {
    this.cache.set(key, {
      data: proof,
      expiresAt: Date.now() + this.CACHE_TTL
    });
  }
}
```

### Database Optimization

```sql
-- Materialized view for fast proof lookups
CREATE MATERIALIZED VIEW proof_summary AS
SELECT 
  order_hash,
  MAX(CASE WHEN proof_type = 'escrow' THEN verification_status END) as escrow_status,
  MAX(CASE WHEN proof_type = 'cross_chain' THEN verification_status END) as cross_chain_status,
  MAX(CASE WHEN proof_type = 'settlement' THEN verification_status END) as settlement_status,
  COUNT(*) as total_proofs
FROM proof_cache 
GROUP BY order_hash;

-- Refresh materialized view periodically
CREATE OR REPLACE FUNCTION refresh_proof_summary()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW proof_summary;
END;
$$ LANGUAGE plpgsql;
```

## Deployment Strategy

### Environment Configuration

```bash
# .env additions for proof APIs
ETHEREUM_RPC_URL=https://sepolia.infura.io/v3/YOUR_PROJECT_ID
NEAR_RPC_URL=https://rpc.testnet.near.org
BITCOIN_RPC_URL=https://bitcoin-testnet-rpc.com
BITCOIN_RPC_USER=your_username
BITCOIN_RPC_PASS=your_password

# Proof cache settings
PROOF_CACHE_TTL=300000  # 5 minutes
PROOF_RETRY_ATTEMPTS=3
PROOF_RETRY_DELAY=1000  # 1 second
```

### Monitoring and Alerting

```typescript
// Metrics for proof API performance
const proofMetrics = {
  proofGenerationTime: new Histogram({
    name: 'proof_generation_duration_seconds',
    help: 'Time taken to generate proofs',
    labelNames: ['proof_type', 'blockchain']
  }),
  
  proofSuccessRate: new Counter({
    name: 'proof_generation_success_total',
    help: 'Number of successful proof generations',
    labelNames: ['proof_type', 'blockchain']
  }),
  
  proofFailureRate: new Counter({
    name: 'proof_generation_failure_total',
    help: 'Number of failed proof generations',
    labelNames: ['proof_type', 'blockchain', 'error_type']
  })
};
```

## Success Criteria

### Functional Requirements
- [ ] Generate valid escrow lock proofs for all active orders
- [ ] Provide cross-chain execution proofs for NEAR and Bitcoin
- [ ] Generate token settlement proofs with explorer links
- [ ] Handle error cases gracefully (pending transactions, failed swaps)
- [ ] Cache proofs for performance optimization

### Performance Requirements
- [ ] Proof generation time < 2 seconds for cached results
- [ ] Proof generation time < 10 seconds for fresh generation
- [ ] 99.5% uptime for proof APIs
- [ ] Support 100+ concurrent proof requests

### Security Requirements
- [ ] Cryptographically verifiable proofs
- [ ] No exposure of sensitive data (private keys, secrets)
- [ ] Rate limiting to prevent abuse
- [ ] Input validation for all parameters

## Implementation Timeline

### Week 1: Foundation and Escrow Proofs
- [ ] Set up proof routes and service architecture
- [ ] Implement escrow lock proof generation
- [ ] Add Ethereum transaction query functionality
- [ ] Basic caching implementation
- [ ] Unit tests for escrow proofs

### Week 2: Cross-Chain and Settlement Proofs
- [ ] NEAR execution proof implementation
- [ ] Bitcoin execution proof implementation
- [ ] Token settlement proof generation
- [ ] Cross-chain coordination verification
- [ ] Integration tests with real testnet data

### Week 3: Optimization and Production Ready
- [ ] Performance optimization and advanced caching
- [ ] Error handling and retry logic
- [ ] Monitoring and metrics implementation
- [ ] Frontend integration support
- [ ] Documentation and deployment guide

## Conclusion

The **Onchain Proof APIs** provide essential verification capabilities that bridge the trust gap between complex cross-chain atomic swaps and user confidence. By implementing these three core endpoints, users can independently verify:

1. **Their tokens are safely locked** in 1inch escrows
2. **Cross-chain execution completed** atomically across NEAR/Bitcoin
3. **They actually received tokens** on the destination chain

This implementation transforms the user experience from "trust the API" to **"verify independently"** through blockchain explorer integration and cryptographic proofs, making it an essential component for production deployment of the 1inch Fusion+ extension.