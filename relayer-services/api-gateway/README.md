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

The API Gateway includes a comprehensive test suite with **46 test cases** covering all critical functionality.

### Test Coverage
- **Unit Tests**: Service interfaces, response validation, and configuration
- **Integration Tests**: Route validation, service integration logic, and error handling
- **Comprehensive Tests**: Overall API Gateway architecture and data structures
- **Error Handling**: Service failures, validation errors, and async operations

### Running Tests

```bash
# Run all tests (46 test cases)
npm test

# Run specific test suites
npm test -- --testPathPattern="services.unit.test.ts"
npm test -- --testPathPattern="routes.integration.test.ts"
npm test -- --testPathPattern="comprehensive.test.ts"

# Run tests with verbose output
npm test -- --verbose
```

### Test Results
- ✅ **Test Suites**: 4 passed, 4 total
- ✅ **Test Cases**: 46 passed, 46 total
- ✅ **Success Rate**: 100%
- ⚡ **Execution Time**: ~1 second

### Test Structure
```
src/
├── __tests__/
│   ├── setup.ts                    # Test configuration
│   └── comprehensive.test.ts       # Architecture validation
├── services/__tests__/
│   └── services.unit.test.ts       # Service unit tests
└── routes/__tests__/
    ├── basic.integration.test.ts   # Basic API structure
    └── routes.integration.test.ts  # Route integration logic
```

See `TEST_SUMMARY.md` for detailed test documentation.

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