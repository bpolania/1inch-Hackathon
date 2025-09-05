# NEAR Shade Agent TEE Solver Research Summary

##  Research Findings: Phase 1 Complete

### 1.  **TEE Solver Architecture Overview**

#### Existing NEAR Intents TEE Solver Components
```

   Solver Registry         Manages liquidity pools & TEE verification
   (Smart Contract)      

            

   Intents Vault           Manages pool assets
   (Smart Contract)      

            

   TEE Solver Server       TypeScript server managing solver lifecycle
   - Monitor pools       
   - Deploy solvers      
   - WebSocket relay     

```

#### Key Architecture Insights
- **Security**: Only TEE-approved Docker images can register as solvers
- **Automation**: Server automatically finds and creates solvers for new pools
- **Communication**: Uses WebSocket relay (`wss://solver-relay-v2.chaindefuser.com/ws`)
- **Language**: TypeScript for server, Rust for smart contracts

### 2.  **NEAR Chain Signatures Integration**

#### How Chain Signatures Work
```
NEAR Account  Derivation Path  Foreign Blockchain Address
                                           
"myaccount.near" + "ethereum-1"  Unique Ethereum Address
```

#### Key Features
- **Multi-Chain Support**: Bitcoin, Ethereum, Solana, Cosmos, Aptos, Sui
- **MPC Network**: Decentralized signing without exposing private keys
- **Signature Schemes**: 
  - Secp256k1 (domain_id: 0) - Bitcoin, Ethereum
  - Ed25519 (domain_id: 1) - Solana, NEAR

#### Implementation Process
1. **Derive Address**: Use NEAR account + path to generate blockchain address
2. **Create Transaction**: Build transaction for target chain
3. **Request Signature**: Call `v1.signer` contract with:
   ```javascript
   {
     payload: transaction_hash,
     path: derivation_path,
     domain_id: 0 // or 1 for Ed25519
   }
   ```
4. **Relay Transaction**: Broadcast signed transaction to destination chain

### 3.  **Solver Implementation Patterns**

#### From Existing TEE AMM Solver
```typescript
// Key Components
interface SolverConfig {
  NEAR_ACCOUNT_ID: string;      // Solver's NEAR account
  NEAR_PRIVATE_KEY: string;     // For signing
  RELAY_WS_URL: string;         // WebSocket for intents
  MARGIN_PERCENT: number;       // Pricing margin (0.3%)
  NEP141_TOKEN_1: string;       // Token pair
  NEP141_TOKEN_2: string;
}

// Solver Flow
1. Listen for intents via WebSocket
2. Calculate quote using AMM logic
3. Apply margin for profitability
4. Submit solution to NEAR Intents
5. Execute within TEE environment
```

### 4.  **Integration Strategy for 1inch Fusion+**

#### Current Relayer  TEE Solver Transformation
```
Current Components              TEE Solver Components
==================               =======================
OrderMonitor                   IntentListener (WebSocket)
ProfitabilityAnalyzer          QuoteGenerator (AMM + margins)
CrossChainExecutor             MetaOrderCreator
WalletManager                 ChainSignatureManager
- Private keys                - MPC signatures
- Single instance             - TEE deployment
```

#### New Components Needed
1. **IntentListener**: WebSocket connection to quote requests
2. **QuoteGenerator**: Price discovery with competitive margins
3. **MetaOrderCreator**: Generate 1inch Fusion+ meta-orders
4. **ChainSignatureManager**: Replace private keys with MPC
5. **TEEDeployment**: Docker image with attestation

### 5.  **Security & Trust Model**

#### TEE Benefits
- **No Private Keys**: Uses MPC network for signing
- **Attestation**: Verified Docker images only
- **Delegation**: Users can delegate without trust
- **Competition**: Multiple solvers compete fairly

#### Chain Signatures Security
- **Distributed Trust**: No single node has complete key
- **Mathematical Derivation**: Deterministic address generation
- **Multi-Party Computation**: Secure collaborative signing

### 6.  **Technical Requirements**

#### Development Stack
- **Languages**: TypeScript (server), Rust (contracts)
- **Blockchain**: NEAR Protocol
- **TEE**: Docker with attestation support
- **Networking**: WebSocket for real-time communication
- **Signing**: NEAR Chain Signatures (v1.signer contract)

#### Infrastructure Needs
- **NEAR Account**: Funded for gas and operations
- **TEE Environment**: Secure execution environment
- **WebSocket Server**: For intent/quote communication
- **Docker Registry**: For TEE-approved images

### 7.  **Implementation Priorities**

#### Phase 1: Core Solver (Days 1-4) 
1.  Research TEE solver architecture
2.  Understand Chain Signatures
3.  Analyze existing implementations
4.  Design 1inch Fusion+ integration

#### Phase 2: Build Foundation (Days 5-8)
1. Extend OrderMonitor  IntentListener
2. Transform ProfitabilityAnalyzer  QuoteGenerator
3. Adapt CrossChainExecutor  MetaOrderCreator
4. Replace WalletManager  ChainSignatureManager

#### Phase 3: TEE Integration (Days 9-10)
1. Create Docker image with solver
2. Implement TEE attestation
3. Deploy to Shade Agent Framework
4. Test secure execution

#### Phase 4: Multi-Chain (Days 11-12)
1. Add Cosmos support (bonus points!)
2. Implement Bitcoin if time permits
3. Test cross-chain meta-orders

### 8.  **Competitive Advantages**

#### What We Bring
- ** Modular Architecture**: Already supports multi-chain
- ** Production Quality**: 113/113 tests passing
- ** Execution Experience**: Working atomic swaps
- ** Professional Codebase**: TypeScript, monitoring, logging

#### What Makes Us Win
- **Multi-Chain Vision**: Cosmos/Bitcoin ready (bonus points!)
- **Proven Foundation**: Not starting from scratch
- **Quality Focus**: Comprehensive testing culture
- **Clear Documentation**: Professional presentation

### 9.  **Key Learnings**

1. **WebSocket is Critical**: Real-time intent listening via relay
2. **AMM Logic**: Simple but effective pricing mechanism
3. **Chain Signatures**: Powerful abstraction for multi-chain
4. **TEE Deployment**: Docker + attestation is standard
5. **Competition Model**: Multiple solvers, best quote wins

### 10.  **Resources for Implementation**

#### Essential Repositories
- [TEE Solver Registry](https://github.com/Near-One/tee-solver/)
- [TEE AMM Solver Example](https://github.com/think-in-universe/near-intents-tee-amm-solver/)
- [Chain Signatures Demo](https://github.com/near-examples/chainsig-script)
- [Omni Transaction Library](https://github.com/near/omni-transaction-rs)

#### Documentation
- [Chain Signatures Docs](https://docs.near.org/chain-abstraction/chain-signatures)
- [NEAR MPC Implementation](https://github.com/near/mpc)
- [Chain Signatures Library](https://github.com/near/chainsig-lib)

#### Community
- [Telegram Dev Channel](https://t.me/chain_abstraction)
- NEAR Forum discussions on TEE solvers

---

##  Next Steps

### Immediate Actions
1. **Design WebSocket IntentListener** building on OrderMonitor
2. **Plan Chain Signatures integration** for wallet management
3. **Architect meta-order generation** for 1inch Fusion+
4. **Create TEE deployment strategy** with Docker

### Architecture Decision
Based on research, we should:
1. **Reuse**: 80% of our existing modular components
2. **Replace**: WalletManager with Chain Signatures
3. **Extend**: Monitoring for WebSocket intents
4. **Add**: TEE deployment layer

### Success Factors
- **Speed**: Leverage existing codebase
- **Quality**: Maintain 100% test coverage
- **Innovation**: Multi-chain support for bonus
- **Presentation**: Clear documentation and demo

**Ready to proceed with Phase 2: Architecture Design! **