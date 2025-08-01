# 1inch Cross-Chain API Gateway

Production-ready API Gateway that connects the UI to our sophisticated TEE Solver and Relayer backend services for real cross-chain execution.

## 🌟 Features

### 🛡️ TEE Solver Integration
- **Autonomous Execution**: Real TEE-verified intelligent decision making
- **Chain Signatures**: NEAR MPC for secure multi-blockchain operations
- **Bitcoin Integration**: Native Bitcoin transaction handling via Chain Signatures
- **Attestation Verification**: TEE code integrity validation

### 🔄 Relayer Service Integration
- **Cross-Chain Execution**: ETH ↔ NEAR ↔ BTC atomic swaps
- **Profitability Analysis**: Real-time cost and profit analysis
- **Bitcoin Executor**: Complete Bitcoin HTLC creation and execution
- **Order Monitoring**: Real-time execution tracking

### 🚀 API Gateway Features
- **REST API**: Complete RESTful endpoints for all services
- **WebSocket Support**: Real-time updates for execution monitoring
- **Rate Limiting**: Production-ready request throttling
- **Error Handling**: Comprehensive error recovery and reporting
- **Health Monitoring**: Service health checks and metrics

## 🏗️ Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────────┐
│       UI        │◄──►│   API Gateway    │◄──►│   Backend Services  │
│   (Next.js)     │    │   (Express.js)   │    │                     │
└─────────────────┘    └──────────────────┘    └─────────────────────┘
                              │                          │
                              ▼                          ▼
                     ┌──────────────────┐    ┌─────────────────────┐
                     │   WebSocket      │    │  TEE Solver         │
                     │   Real-time      │    │  • ShadeAgent       │
                     │   Updates        │    │  • Chain Signatures │
                     └──────────────────┘    │  • Bitcoin Executor │
                                            │                     │
                                            │  Relayer Service    │
                                            │  • Cross-Chain      │
                                            │  • Profitability    │
                                            │  • Order Monitor    │
                                            └─────────────────────┘
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- NEAR testnet account with private key
- Ethereum testnet (Sepolia) access
- Bitcoin testnet access

### Installation

1. **Install dependencies**:
```bash
cd relayer-services/api-gateway
npm install
```

2. **Configure environment**:
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. **Build and start**:
```bash
npm run build
npm start
```

For development:
```bash
npm run dev
```

## 📡 API Endpoints

### 1inch Fusion+ Integration

The API Gateway provides native 1inch Fusion+ endpoints that connect to our deployed contracts and services (not proxy to 1inch API):

#### Get Quote
```http
GET /api/1inch/quote?chainId=11155111&fromToken=0xaa86ed59bcf10c838F2abDa08D1Ca8C6D1609d43&toToken=wrap.near&amount=1000000000000000000&toChainId=397
```

#### Create Swap
```http
POST /api/1inch/swap
Content-Type: application/json

{
  "chainId": 11155111,
  "fromToken": "0xaa86ed59bcf10c838F2abDa08D1Ca8C6D1609d43",
  "toToken": "wrap.near", 
  "amount": "1000000000000000000",
  "fromAddress": "0x1234567890123456789012345678901234567890",
  "toChainId": 397,
  "toAddress": "alice.near"
}
```

#### Get Supported Tokens
```http
GET /api/1inch/tokens/11155111
```

#### Get Protocols
```http
GET /api/1inch/protocols/11155111
```

**Deployed Contracts:**
- **Fusion+ Factory**: `0xbeEab741D2869404FcB747057f5AbdEffc3A138d`
- **Cross-Chain Registry**: `0x09Ab998Cb3448ad281C116c9fC9e4b01e4533beD`
- **NEAR Adapter**: `0x7019aC48479e5527Cb3a5a99FbEFe5B42125C9A5`
- **Bitcoin Adapter**: `0x15ACc1Cb04F08143e29c39972D9cF5D53D015fF8`

### TEE Solver Endpoints

#### Get TEE Status
```http
GET /api/tee/status
```
**Response**:
```json
{
  "success": true,
  "data": {
    "isHealthy": true,
    "status": {
      "attestationValid": true,
      "trustLevel": "high",
      "ordersProcessed": 25
    },
    "attestation": {
      "valid": true,
      "timestamp": 1704067200000
    }
  }
}
```

#### Analyze Intent
```http
POST /api/tee/analyze
Content-Type: application/json

{
  "id": "intent-123",
  "fromToken": { "symbol": "ETH", "address": "0x...", "chainId": 1 },
  "toToken": { "symbol": "USDC", "address": "0x...", "chainId": 1 },
  "fromAmount": "1000000000000000000",
  "user": "0x1234...",
  "maxSlippage": 50
}
```

#### Submit to TEE
```http
POST /api/tee/submit
Content-Type: application/json

{
  "id": "intent-123",
  "fromToken": { "symbol": "ETH", "address": "0x...", "chainId": 1 },
  "toToken": { "symbol": "USDC", "address": "0x...", "chainId": 1 },
  "fromAmount": "1000000000000000000",
  "minToAmount": "1900000000",
  "user": "0x1234...",
  "maxSlippage": 50,
  "deadline": 1704067800
}
```

### Relayer Endpoints

#### Get Relayer Status
```http
GET /api/relayer/status
```

#### Analyze Profitability
```http
POST /api/relayer/analyze
Content-Type: application/json

{
  "id": "intent-123",
  "fromToken": { "symbol": "ETH", "address": "0x...", "chainId": 1 },
  "toToken": { "symbol": "USDC", "address": "0x...", "chainId": 1 },
  "fromAmount": "1000000000000000000",
  "user": "0x1234..."
}
```

#### Submit to Relayer
```http
POST /api/relayer/submit
Content-Type: application/json

{
  "id": "intent-123",
  "fromToken": { "symbol": "ETH", "address": "0x...", "chainId": 1 },
  "toToken": { "symbol": "USDC", "address": "0x...", "chainId": 1 },
  "fromAmount": "1000000000000000000",
  "minToAmount": "1900000000",
  "user": "0x1234...",
  "maxSlippage": 50,
  "deadline": 1704067800
}
```

### Health Endpoints

#### Basic Health Check
```http
GET /api/health
```

#### Detailed Health Check
```http
GET /api/health/detailed
```

## 🔌 WebSocket Integration

Connect to real-time updates:

```javascript
const ws = new WebSocket('ws://localhost:3001/ws');

// Subscribe to TEE execution updates
ws.send(JSON.stringify({
  type: 'subscribe',
  channel: 'tee-execution-update'
}));

// Subscribe to relayer order updates
ws.send(JSON.stringify({
  type: 'subscribe',
  channel: 'relayer-order-update'
}));

// Handle messages
ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  console.log('Real-time update:', message);
};
```

## 🛡️ Security Features

### Rate Limiting
- 100 requests per 15-minute window per IP
- Configurable limits for different endpoints

### CORS Protection
- Configurable allowed origins
- Credentials support for authenticated requests

### Request Validation
- Input validation using express-validator
- Type checking and sanitization
- Error handling with detailed messages

### Environment Security
- Environment variable validation
- Secure default configurations
- API key protection

## 📊 Monitoring & Metrics

### Health Monitoring
- Service health checks
- Component status tracking
- Error rate monitoring

### Performance Metrics
- Request/response times
- Service availability
- Resource usage

### Real-time Updates
- WebSocket connection metrics
- Active subscription tracking
- Message delivery statistics

## 🚀 Production Deployment

### Environment Variables
Set the following for production:

```bash
NODE_ENV=production
PORT=3001
ALLOWED_ORIGINS=https://your-domain.com

# NEAR Configuration
NEAR_NETWORK=mainnet
NEAR_ACCOUNT_ID=your-production-account.near
NEAR_PRIVATE_KEY=your-production-private-key

# Ethereum Configuration
ETHEREUM_RPC_URL=https://mainnet.infura.io/v3/YOUR_PROJECT_ID
ETHEREUM_PRIVATE_KEY=your-production-ethereum-key

# Bitcoin Configuration
BITCOIN_NETWORK=mainnet
BITCOIN_PRIVATE_KEY=your-production-bitcoin-key
```

### Docker Deployment

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3001
CMD ["npm", "start"]
```

### Load Balancing
- Use nginx or similar for load balancing
- Configure SSL/TLS termination
- Set up health check endpoints

## 🧪 Testing

The API Gateway includes a comprehensive test suite with **200 test cases** covering all critical functionality.

### Test Coverage
- **1inch Fusion+ Integration**: Real deployment testing with TEE solver and relayer services
- **Transaction Lifecycle**: Complete cross-chain transaction flow testing
- **User & Wallet Integration**: Authentication, multi-chain balances, and wallet management
- **Chain Status Monitoring**: Real-time chain health, bridge routes, and congestion data
- **Batch Operations**: Multi-transaction processing and optimization
- **WebSocket Services**: Real-time updates and event broadcasting
- **Service Integration**: TEE solver, relayer, and WebSocket coordination
- **Contract Integration**: Deployed contract validation and ABI compatibility
- **Error Handling**: Comprehensive failure scenarios and recovery testing

### Running Tests

```bash
# Run all tests (200 test cases)
npm test

# Run specific test categories
npm test -- --testPathPattern="fusion"           # Fusion+ integration tests
npm test -- --testPathPattern="transaction"      # Transaction lifecycle tests
npm test -- --testPathPattern="user"            # User/wallet tests
npm test -- --testPathPattern="chain"           # Chain monitoring tests
npm test -- --testPathPattern="batch"           # Batch operation tests
npm test -- --testPathPattern="websocket"       # WebSocket tests

# Run tests with verbose output
npm test -- --verbose
```

### Test Results (Production Ready)
- ✅ **Test Suites**: 15 passed, 15 total
- ✅ **Test Cases**: 200 passed, 200 total  
- ✅ **Success Rate**: 100%
- ⚡ **Execution Time**: ~2.5 seconds

### Test Categories
```
src/
├── __tests__/
│   ├── comprehensive.test.ts           # API architecture validation
│   ├── fusion.integration.test.ts      # Fusion+ cross-chain flows
│   └── contract.integration.test.ts    # Deployed contract testing
├── services/__tests__/
│   └── services.unit.test.ts          # Service interface validation
├── routes/__tests__/
│   ├── oneinch.fusion.test.ts         # 1inch Fusion+ endpoints
│   ├── basic.integration.test.ts       # Route structure validation
│   └── routes.integration.test.ts      # Service integration logic
└── tests/
    ├── routes/
    │   ├── transactions.test.ts        # Transaction lifecycle
    │   ├── users.test.ts              # User/wallet integration
    │   ├── chains.test.ts             # Chain monitoring
    │   └── batch.test.ts              # Batch operations
    ├── services/
    │   └── WebSocketService.enhanced.test.ts # Real-time updates
    ├── integration/
    │   └── full-api.test.ts           # Complete API workflows
    ├── simple.test.ts                 # Basic endpoint tests
    └── demo.test.ts                   # Test demonstration
```

See `TEST_REPORT.md` for detailed test coverage report.

## 📝 API Documentation

### Error Responses

All endpoints return errors in this format:
```json
{
  "success": false,
  "error": "Error description",
  "details": "Detailed error information",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

### Common HTTP Status Codes
- `200` - Success
- `400` - Bad Request (validation errors)
- `404` - Not Found
- `429` - Too Many Requests (rate limited)
- `500` - Internal Server Error
- `503` - Service Unavailable

## 🤝 Contributing

1. Follow conventional commit format
2. Add tests for new features
3. Update documentation
4. Ensure all tests pass

## 📄 License

MIT License - see LICENSE file for details.