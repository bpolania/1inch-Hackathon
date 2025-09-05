# 1inch Fusion+ TEE Solver Architecture Design

##  System Architecture

### High-Level Overview
```

                     1inch Fusion+ TEE Solver                     

                                                                  
       
   Intent Listener     Quote Generator     Meta-Order       
   (WebSocket)       (Price Engine)    Creator          
       
                                                               
  
                Chain Signature Manager (MPC)                   
    - No private keys    - Multi-chain addresses               
    - Secure signing     - Delegation support                  
  
                                                                  
  
                      TEE Execution Layer                        
    - Docker container   - Attestation    - Secure execution    
  

```

##  Component Evolution

### 1. **Intent Listener** (Evolution of OrderMonitor)
```typescript
interface IntentListener {
  // WebSocket connection to relay
  connectToRelay(url: string): Promise<void>;
  
  // Listen for quote requests
  onQuoteRequest(callback: (request: QuoteRequest) => void): void;
  
  // Submit quotes back
  submitQuote(quote: FusionMetaOrder): Promise<void>;
}

interface QuoteRequest {
  id: string;
  sourceChain: ChainId;
  destinationChain: ChainId;
  sourceToken: string;
  destinationToken: string;
  amount: bigint;
  deadline: number;
  userAddress: string;
}
```

### 2. **Quote Generator** (Evolution of ProfitabilityAnalyzer)
```typescript
interface QuoteGenerator {
  // Generate competitive quote
  generateQuote(request: QuoteRequest): Promise<Quote>;
  
  // Price discovery across chains
  findBestRoute(
    source: TokenInfo,
    destination: TokenInfo,
    amount: bigint
  ): Route[];
  
  // Apply margin and fees
  calculateProfitableQuote(
    route: Route,
    marginPercent: number
  ): Quote;
}

interface Quote {
  requestId: string;
  sourceAmount: bigint;
  destinationAmount: bigint;
  route: Route[];
  executionTime: number;
  validUntil: number;
  solverFee: bigint;
}
```

### 3. **Meta-Order Creator** (Evolution of CrossChainExecutor)
```typescript
interface MetaOrderCreator {
  // Create 1inch Fusion+ meta-order
  createMetaOrder(quote: Quote): FusionMetaOrder;
  
  // Define execution steps
  buildExecutionPlan(route: Route[]): ExecutionStep[];
  
  // Add solver constraints
  addSolverConstraints(
    order: FusionMetaOrder,
    constraints: SolverConstraints
  ): void;
}

interface FusionMetaOrder {
  orderHash: string;
  maker: string;
  resolver: string;
  sourceChain: ChainId;
  destinationChain: ChainId;
  sourceToken: string;
  destinationToken: string;
  sourceAmount: bigint;
  destinationAmount: bigint;
  deadline: number;
  executionSteps: ExecutionStep[];
  signature?: string; // Added by Chain Signatures
}
```

### 4. **Chain Signature Manager** (Replacement for WalletManager)
```typescript
interface ChainSignatureManager {
  // Initialize with NEAR account
  initialize(nearAccount: string): Promise<void>;
  
  // Derive addresses for other chains
  deriveAddress(chain: ChainId, path?: string): Promise<string>;
  
  // Sign transaction using MPC
  signTransaction(
    chain: ChainId,
    transaction: any,
    path?: string
  ): Promise<string>;
  
  // No private keys needed!
  getAddresses(): Map<ChainId, string>;
}

// Implementation using NEAR Chain Signatures
class ChainSignatureManager {
  async signTransaction(chain: ChainId, tx: any, path?: string) {
    const derivationPath = `${chain}-${path || 'default'}`;
    const domainId = this.getDomainId(chain); // 0 for Secp256k1, 1 for Ed25519
    
    // Call v1.signer contract
    const signature = await this.nearAccount.functionCall({
      contractId: 'v1.signer',
      methodName: 'sign',
      args: {
        payload: tx.hash,
        path: derivationPath,
        domain_id: domainId
      }
    });
    
    return signature;
  }
}
```

##  Data Flow

### Quote Request  Meta-Order Flow
```
1. WebSocket Intent Request
   
2. Quote Generator analyzes:
   - Cross-chain routes
   - Liquidity sources
   - Gas costs
   - Profit margins
   
3. Meta-Order Creator builds:
   - Execution plan
   - Solver constraints
   - Deadline/validity
   
4. Chain Signatures signs:
   - No private keys
   - MPC network
   - Secure execution
   
5. Submit Meta-Order via WebSocket
```

##  Multi-Chain Architecture (Bonus Points!)

### Modular Chain Adapters
```typescript
interface ChainAdapter {
  chainId: ChainId;
  
  // Get token prices and liquidity
  getTokenInfo(address: string): Promise<TokenInfo>;
  
  // Estimate execution costs
  estimateGasCost(operation: Operation): Promise<bigint>;
  
  // Build chain-specific transaction
  buildTransaction(params: TransactionParams): any;
  
  // Verify transaction completion
  verifyExecution(txHash: string): Promise<boolean>;
}

// Implementations
class EthereumAdapter implements ChainAdapter { }
class NearAdapter implements ChainAdapter { }
class CosmosAdapter implements ChainAdapter { }  // Bonus!
class BitcoinAdapter implements ChainAdapter { } // Extra bonus!
```

##  TEE Deployment Architecture

### Docker Container Structure
```dockerfile
FROM node:18-alpine

# Install solver dependencies
WORKDIR /app
COPY . .
RUN npm install --production

# TEE attestation support
RUN apk add --no-cache \
    sgx-sdk \
    attestation-tools

# Environment variables
ENV NODE_ENV=production
ENV TEE_MODE=true

# Start solver service
CMD ["node", "dist/tee-solver.js"]
```

### TEE Security Model
```

         User Intent Request          

                 

      TEE Secure Enclave              
   
     Solver Logic (Isolated)       
     - No external access          
     - Verified code only          
     - Attestation proof           
   

                 

    Chain Signatures (MPC Network)    

```

##  Competitive Features

### 1. **Multi-Protocol Support** (Bonus Points!)
```typescript
enum SupportedProtocols {
  ONEINCH_FUSION = "1inch-fusion",
  UNISWAP_X = "uniswap-x",        // Future
  COWSWAP = "cowswap",            // Future
  HASHFLOW = "hashflow"           // Future
}

interface ProtocolAdapter {
  protocol: SupportedProtocols;
  
  // Convert to protocol-specific format
  formatOrder(metaOrder: FusionMetaOrder): any;
  
  // Parse protocol events
  parseRequest(data: any): QuoteRequest;
}
```

### 2. **Advanced Routing Engine**
```typescript
interface RoutingEngine {
  // Multi-hop routing
  findOptimalRoute(
    source: Token,
    destination: Token,
    amount: bigint,
    maxHops: number
  ): Route[];
  
  // Cross-chain bridging options
  evaluateBridges(
    sourceChain: ChainId,
    destChain: ChainId
  ): Bridge[];
  
  // DEX aggregation
  aggregateLiquidity(
    token: Token,
    chain: ChainId
  ): LiquiditySource[];
}
```

### 3. **Competitive Pricing Strategy**
```typescript
interface PricingStrategy {
  // Dynamic margin based on competition
  calculateDynamicMargin(
    baseMargin: number,
    competitorQuotes: Quote[],
    gasPrice: bigint
  ): number;
  
  // Volume-based discounts
  applyVolumeDiscount(
    amount: bigint,
    userHistory: UserStats
  ): number;
  
  // Time-based urgency pricing
  adjustForUrgency(
    deadline: number,
    currentTime: number
  ): number;
}
```

##  Implementation Phases

### Phase 1: Core Components (Current)
- [x] Research completed
- [ ] Intent Listener design
- [ ] Quote Generator architecture
- [ ] Chain Signatures integration plan

### Phase 2: Implementation
- [ ] WebSocket relay connection
- [ ] Quote generation logic
- [ ] Meta-order formatting
- [ ] Chain Signatures testing

### Phase 3: TEE Integration
- [ ] Docker container setup
- [ ] Attestation implementation
- [ ] Secure deployment

### Phase 4: Multi-Chain (Bonus)
- [ ] Cosmos adapter
- [ ] Bitcoin adapter
- [ ] Cross-chain testing

##  Performance Targets

- **Quote Generation**: < 100ms
- **Signature Time**: < 2 seconds (MPC network)
- **End-to-End**: < 5 seconds
- **Uptime**: 99.9% availability
- **Competitiveness**: Top 3 quotes for 80%+ requests

##  Security Considerations

1. **No Private Keys**: All signing via Chain Signatures
2. **TEE Isolation**: Solver logic in secure enclave
3. **Attestation**: Verified Docker images only
4. **Rate Limiting**: Prevent spam/DoS attacks
5. **Audit Trail**: All operations logged

##  Success Metrics

- **Technical**: Working TEE solver with Chain Signatures
- **Performance**: Competitive quotes winning executions
- **Architecture**: Clean, modular, extensible design
- **Bonus Points**: Multi-chain and multi-protocol support
- **Documentation**: Clear setup and operation guides

---

**Ready to implement! Next: Start building the Intent Listener component. **