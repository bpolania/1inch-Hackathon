#  1inch Cross-Chain Intents UI - Bitcoin TEE Integration

A comprehensive user interface for 1inch Fusion+ cross-chain atomic swaps with Bitcoin integration via TEE (Trusted Execution Environment) autonomous solvers.

##  Overview

This UI demonstrates advanced cross-chain intent processing with full Bitcoin integration, showcasing:

- **Intent Expression**: Users express swap desires across Ethereum  NEAR  Bitcoin chains
- **1inch Integration**: Real-time price quotes and optimal routing via 1inch Fusion+ Protocol
- **Autonomous TEE Solvers**: Trustless execution with NEAR Chain Signatures MPC
- **Bitcoin TEE Integration**: Secure Bitcoin handling via Trusted Execution Environment
- **Real-time Monitoring**: Live execution tracking with WebSocket updates
- **Dual Execution Paths**: Choice between manual relayer and autonomous TEE execution

##  Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn
- A NEAR testnet account (for full functionality)

### Installation

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local

# Start development server
npm run dev

# Open browser
open http://localhost:3000
```

##  Architecture

### Core Components

- **Intent Expression Interface**: User-friendly form for creating cross-chain swap intents
- **1inch Price Quotes**: Real-time optimal routing and price discovery
- **Dual Execution Paths**: Manual relayer vs autonomous TEE solver options
- **Real-time Monitoring**: Live execution tracking with detailed step progression
- **TEE Status Dashboard**: Autonomous solver health and attestation verification
- **Bitcoin Integration**: Secure Bitcoin handling via TEE Chain Signatures

### Technology Stack

- **Framework**: Next.js 14 with TypeScript
- **Styling**: Tailwind CSS + Radix UI  
- **State Management**: Zustand
- **API Integration**: 1inch Fusion+ Protocol API
- **Blockchain**: NEAR API JS + Wallet Selector + Bitcoin Chain Signatures
- **Real-time**: EventSource/WebSocket for execution monitoring
- **Testing**: Jest + React Testing Library (54 comprehensive tests)
- **TEE Integration**: Autonomous solver with attestation verification

##  Key Features

### 1. 1inch Fusion+ Integration
Real-time price quotes and optimal routing with:
- Multi-DEX aggregation across supported chains
- Price impact analysis and slippage protection
- Competitive quote comparison with caching (10s TTL)
- Gas cost estimation and route visualization

### 2. Dual Execution Architecture
Choose between execution methods:
- **Manual Relayer**: Traditional relayer service with profitability analysis
- **Autonomous TEE**: Trustless execution via TEE solver with attestation verification

### 3. Bitcoin Chain Signatures
Secure Bitcoin integration featuring:
- NEAR Chain Signatures MPC for Bitcoin transactions
- TEE-verified Bitcoin transaction signing
- Cross-chain atomic swaps: Ethereum  NEAR  Bitcoin
- Real-time attestation verification and health monitoring

### 4. Comprehensive Monitoring
Live execution tracking with:
- Real-time WebSocket/EventSource updates
- Detailed execution step progression
- Transaction hash tracking across all chains
- Error handling and recovery mechanisms

### 5. Production-Ready Testing
54 comprehensive tests covering:
- Service layer integration (1inch, Relayer, TEE)
- Component rendering and user interactions
- Real-time monitoring and error scenarios
- End-to-end integration flows

##  Demo Scenarios

### Scenario 1: Ethereum  NEAR Swap via Relayer
```
Intent: "Swap 1 ETH for NEAR tokens"
 1inch API provides optimal routing and pricing
 Relayer analyzes profitability and execution cost
 Manual execution with real-time monitoring
 Settlement via NEAR Chain Signatures in ~2 minutes
```

### Scenario 2: Bitcoin  Ethereum via TEE Autonomous Solver
```
Intent: "Swap 0.1 BTC for USDC on Ethereum"
 TEE solver analyzes cross-chain opportunity autonomously
 Bitcoin Chain Signatures integration for secure BTC handling
 Autonomous execution with attestation verification
 Complete atomic swap execution in ~5 minutes
```

### Scenario 3: Multi-Chain Route Optimization
```
Intent: "Best route for 100 USDC  BTC"
 1inch aggregation finds optimal path via multiple DEXs
 TEE solver evaluates Ethereum  NEAR  Bitcoin routing
 Real-time execution monitoring across all three chains
 Final Bitcoin delivery with full audit trail
```

##  Configuration

### Environment Variables

```bash
# NEAR Configuration
NEXT_PUBLIC_NEAR_NETWORK=testnet
NEXT_PUBLIC_NEAR_RPC_URL=https://rpc.testnet.near.org

# 1inch API Integration
NEXT_PUBLIC_ONEINCH_API_URL=https://api.1inch.dev
NEXT_PUBLIC_ONEINCH_API_KEY=your_api_key_here

# Relayer Service Integration
NEXT_PUBLIC_RELAYER_SERVICE_URL=http://localhost:3001
NEXT_PUBLIC_RELAYER_WS_URL=ws://localhost:3001

# TEE Solver Integration  
NEXT_PUBLIC_TEE_SOLVER_URL=http://localhost:3002
NEXT_PUBLIC_TEE_SOLVER_WS_URL=ws://localhost:3002

# Bitcoin Chain Signatures
NEXT_PUBLIC_BITCOIN_NETWORK=testnet
NEXT_PUBLIC_CHAIN_SIGNATURES_CONTRACT=v1.signer-prod.testnet

# Optional Features
NEXT_PUBLIC_ANALYTICS_ENABLED=true
NEXT_PUBLIC_MOCK_DATA_MODE=false
```

##  Mobile Support

The UI is fully responsive and works seamlessly on:
- Desktop (1024px+)
- Tablet (768px - 1023px)
- Mobile (320px - 767px)

##  Testing

Comprehensive test suite with 54 tests covering all integration features:

```bash
# Run all tests
npm test

# Run specific service tests
npm test -- --testPathPattern="oneinch.test.ts"
npm test -- --testPathPattern="relayerIntegration.test.ts" 
npm test -- --testPathPattern="teeIntegration.test.ts"

# Run component tests
npm test -- --testPathPattern="components/"

# Run integration tests
npm test -- --testPathPattern="integration"

# Generate coverage report
npm run test:coverage
```

### Test Coverage

- **1inch API Integration**: 21 tests covering quotes, caching, validation
- **Relayer Integration**: 17 tests covering profitability, monitoring, execution
- **TEE Integration**: 16 tests covering autonomous analysis, attestation, monitoring
- **Component Tests**: UI components with user interaction scenarios
- **Integration Tests**: End-to-end flows with mocked services

##  Development Guide

### Component Structure

```
src/
 components/
    ui/              # Base UI components (buttons, inputs, etc.)
    intent/          # Intent expression and execution components
    relayer/         # Manual relayer execution components
    tee/             # TEE autonomous solver components
    wallet/          # NEAR wallet integration components
    layout/          # Page layout components
 services/
    oneinch.ts       # 1inch API integration service
    relayerIntegration.ts  # Manual relayer service
    teeIntegration.ts      # TEE autonomous solver service
    __tests__/       # Comprehensive service tests
 stores/
    intentStore.ts   # Intent state management
    walletStore.ts   # NEAR wallet state management
 types/
     intent.ts        # TypeScript definitions
```

### State Management

We use Zustand for state management with separate stores for:
- Intent creation and execution management
- NEAR wallet connection and account state
- User preferences and UI settings
- Real-time execution monitoring state

### Styling Guidelines

- Use Tailwind CSS utility classes
- Follow the established design system
- Maintain consistent spacing and typography
- Ensure accessibility compliance (WCAG 2.1)

##  1inch Hackathon Compliance

This UI satisfies advanced cross-chain integration requirements:

 **1inch Fusion+ Protocol Integration**: Real-time quotes, optimal routing, multi-DEX aggregation  
 **Bitcoin Chain Signatures**: Secure BTC handling via NEAR Chain Signatures MPC  
 **TEE Autonomous Solvers**: Trustless execution with attestation verification  
 **Comprehensive Testing**: 54 tests covering all integration scenarios  
 **Production-Ready Architecture**: Modular services with error handling and monitoring  

##  Deployment

### Development
```bash
npm run dev
```

### Production Build
```bash
npm run build
npm start
```

### Docker Deployment
```bash
docker build -t near-intents-ui .
docker run -p 3000:3000 near-intents-ui
```

##  License

MIT License - see LICENSE file for details.

---

**Built for the 1inch Cross-Chain Hackathon - Advanced Bitcoin TEE Integration** 

### API Integration Services

This project includes three comprehensive API integration services:

1. **1inch Integration Service** (`src/services/oneinch.ts`):
   - Real-time price quotes with 10-second caching
   - Multi-DEX aggregation and optimal routing
   - UI-formatted responses with error handling
   - 21 comprehensive tests

2. **Relayer Integration Service** (`src/services/relayerIntegration.ts`):
   - Manual execution with profitability analysis
   - Real-time monitoring via EventSource
   - Order management and cancellation
   - 17 comprehensive tests

3. **TEE Integration Service** (`src/services/teeIntegration.ts`):
   - Autonomous solver with attestation verification
   - Bitcoin Chain Signatures integration
   - TEE health monitoring and route analysis
   - 16 comprehensive tests

**Total: 54 tests ensuring production-ready reliability** 