# 🎨 NEAR Intents UI - Shade Agent Framework

A comprehensive user interface for managing and visualizing TEE solvers in the NEAR Intents ecosystem.

## 🎯 Overview

This UI demonstrates our TEE (Trusted Execution Environment) solver's participation in the NEAR Intents protocol, showcasing:

- **Intent Expression**: Users express what they want, not how to achieve it
- **Solver Competition**: Real-time visualization of solver bidding and competition
- **Chain Abstraction**: Complex multi-chain operations simplified into single intents
- **TEE Verification**: Highlighting our solver's security advantages
- **Real-time Settlement**: Live tracking of Chain Signatures cross-chain execution

## 🚀 Quick Start

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

## 🏗️ Architecture

### Core Components

- **Intent Expression Interface**: User-friendly form for creating intents
- **Solver Competition Dashboard**: Real-time solver comparison and selection
- **Chain Abstraction Demo**: Visualizes complexity abstracted away
- **Settlement Tracking**: Live updates on cross-chain execution
- **TEE Solver Analytics**: Performance metrics and competitive advantages

### Technology Stack

- **Framework**: Next.js 14 with TypeScript
- **Styling**: Tailwind CSS + Radix UI
- **State Management**: Zustand
- **Charts**: Recharts
- **Animations**: Framer Motion
- **Blockchain**: NEAR API JS + Wallet Selector
- **Real-time**: Socket.io

## 📊 Key Features

### 1. Intent-Based Interaction
Users express their desired outcomes rather than specifying technical implementation details.

### 2. Solver Competition Visualization
See how different solvers (including our TEE solver) compete to provide the best execution plan.

### 3. TEE Solver Advantages
Prominently display our solver's competitive advantages:
- Trusted Execution Environment verification
- Optimal cross-chain routing
- High success rates and fast execution

### 4. Chain Abstraction Demo
Show users the complexity that's abstracted away behind simple intent expressions.

### 5. Real-time Updates
Live WebSocket connections provide instant updates on:
- Solver competition results
- Settlement progress
- Chain Signatures status
- Transaction confirmations

## 🎮 Demo Scenarios

### Scenario 1: Simple Cross-Chain Swap
```
Intent: "I want 100 USDC on Ethereum for my 2.5 NEAR"
→ Multiple solvers compete
→ Our TEE solver wins with best execution plan
→ Real-time settlement tracking
→ Successful completion in ~30 seconds
```

### Scenario 2: Complex Multi-Step Operation
```
Intent: "Optimize my portfolio: 50% BTC, 30% ETH, 20% NEAR"
→ Complex execution plan visualization
→ TEE solver's optimized routing
→ Parallel execution across multiple chains
→ Final portfolio rebalancing
```

## 🔧 Configuration

### Environment Variables

```bash
# NEAR Configuration
NEXT_PUBLIC_NEAR_NETWORK=testnet
NEXT_PUBLIC_NEAR_RPC_URL=https://rpc.testnet.near.org

# Solver Integration
NEXT_PUBLIC_SOLVER_WS_URL=ws://localhost:8080
NEXT_PUBLIC_TEE_SOLVER_ID=near-bitcoin-tee-solver

# Optional Features
NEXT_PUBLIC_ANALYTICS_ENABLED=true
NEXT_PUBLIC_MOCK_DATA_MODE=false
```

## 📱 Mobile Support

The UI is fully responsive and works seamlessly on:
- Desktop (1024px+)
- Tablet (768px - 1023px)
- Mobile (320px - 767px)

## 🧪 Testing

```bash
# Run unit tests
npm test

# Run component tests
npm run test:components

# Run E2E tests
npm run test:e2e

# Generate coverage report
npm run test:coverage
```

## 📖 Development Guide

### Component Structure

```
src/components/
├── ui/              # Base UI components (buttons, inputs, etc.)
├── intent/          # Intent expression components
├── solver/          # Solver competition components
├── settlement/      # Transaction tracking components
├── charts/          # Data visualization components
└── layout/          # Page layout components
```

### State Management

We use Zustand for state management with separate stores for:
- Intent creation and management
- Solver competition data
- User preferences and settings
- WebSocket connection state

### Styling Guidelines

- Use Tailwind CSS utility classes
- Follow the established design system
- Maintain consistent spacing and typography
- Ensure accessibility compliance (WCAG 2.1)

## 🎯 Bounty Compliance

This UI satisfies the NEAR Shade Agent Framework bounty requirements:

✅ **Demonstrates decentralized solver functionality**  
✅ **Shows TEE solver integration and advantages**  
✅ **Integrates with NEAR Chain Signatures**  
✅ **Provides comprehensive documentation**  
✅ **Includes end-to-end demonstration**  

## 🚀 Deployment

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

## 📄 License

MIT License - see LICENSE file for details.

---

**Built for the NEAR Shade Agent Framework bounty submission** 🏆