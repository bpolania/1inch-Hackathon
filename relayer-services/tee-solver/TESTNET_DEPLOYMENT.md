# 🧪 NEAR Shade Agent TEE Solver - Testnet Deployment Guide

## 🎯 **Testnet Deployment Overview**

This guide walks you through deploying the NEAR Shade Agent TEE solver to **testnet** for safe testing, demonstration, and bounty submission.

### **✅ Why Testnet Deployment is Perfect**

- 🔒 **Risk-Free**: No real funds involved
- 🚀 **Fast Iteration**: Quick testing and debugging  
- 💰 **Free**: All testnet tokens are free
- 🧪 **Demo Ready**: Perfect for bounty submissions
- 📋 **Standard Practice**: Expected for initial deployments

---

## 🛠️ **Step 1: Prerequisites Setup**

### **1.1 Create NEAR Testnet Account**

```bash
# Install NEAR CLI if not already installed
npm install -g near-cli

# Create testnet account
near create-account your-solver.testnet --masterAccount testnet

# Or use NEAR Wallet: https://wallet.testnet.near.org
```

### **1.2 Get 1inch Development API Key**

```bash
# Visit 1inch Developer Portal
# https://docs.1inch.dev/docs/getting-started

# Request development API access
# No special requirements for testnet usage
```

### **1.3 Get Testnet Tokens (Free)**

- **NEAR Testnet**: https://near-faucet.io
- **Ethereum Goerli**: https://goerlifaucet.com  
- **Polygon Mumbai**: https://faucet.polygon.technology
- **Arbitrum Goerli**: https://bridge.arbitrum.io
- **Other Testnets**: Available through respective faucets

---

## 🔧 **Step 2: Environment Configuration**

### **2.1 Set Environment Variables**

```bash
# NEAR Testnet Configuration
export NEAR_ACCOUNT="your-solver.testnet"
export NEAR_NETWORK="testnet"
export NEAR_SECRET_KEY="ed25519:your-testnet-private-key"

# 1inch Development API
export ONEINCH_AUTH_KEY="your-dev-api-key"

# TEE Configuration  
export TEE_MODE="enabled"
export DEPLOYMENT_ENV="testnet"

# Optional: Enable debug logging for testnet
export LOG_LEVEL="debug"
export NODE_ENV="development"
```

### **2.2 Create Testnet Environment File**

```bash
# Copy the testnet template
cp .env.tee .env.testnet

# Edit with your testnet credentials
nano .env.testnet
```

**Key testnet settings:**
```bash
# NEAR Testnet
NEXT_PUBLIC_accountId=your-solver.testnet
NEAR_NETWORK=testnet
MPC_CONTRACT_ID=v1.signer-dev  # Testnet MPC contract

# Testnet Shade Agent Contract
SHADE_AGENT_CONTRACT=your-shade-agent.testnet

# Relaxed security for testnet
MINIMUM_TRUST_LEVEL=medium
ATTESTATION_VALIDATION=relaxed
```

---

## 🚀 **Step 3: Testnet Deployment**

### **3.1 Run Automated Deployment**

```bash
# Make sure you're in the solver directory
cd relayer-services/tee-solver

# Set testnet environment
export DEPLOYMENT_ENV=testnet

# Run the deployment script
./deploy/shade-agent-deploy.sh
```

This will:
1. Build Docker image for testnet
2. Push to registry with testnet tags
3. Create testnet deployment config
4. Generate Phala Cloud setup instructions

### **3.2 Deploy to Phala Cloud (Testnet Mode)**

```bash
# The script generates: docker-compose.testnet.yml
# Use this for Phala Cloud deployment

# Access Phala Cloud Dashboard
open https://cloud.phala.network/dashboard

# Upload the testnet configuration
# Configure testnet environment variables
# Deploy to Intel TDX TEE
```

---

## 🧪 **Step 4: Testnet Testing & Verification**

### **4.1 Health Check**

```bash
# Check TEE solver health
curl https://your-testnet-tee.phala.network/api/health

# Expected response:
{
  "status": "healthy",
  "teeMode": true,
  "network": "testnet",
  "chainsSupported": 7,
  "testsuite": "185/185 passing"
}
```

### **4.2 TEE Attestation Status**

```bash
# Verify TEE attestation
curl https://your-testnet-tee.phala.network/api/tee/status

# Expected response:
{
  "attestationValid": true,
  "trustLevel": "high",
  "registrationStatus": "registered",
  "codeHashValid": true
}
```

### **4.3 Test Quote Generation**

```bash
# Test cross-chain quote (Goerli → Mumbai)
curl -X POST https://your-testnet-tee.phala.network/api/quote \
  -H "Content-Type: application/json" \
  -d '{
    "sourceChain": "ethereum",
    "destinationChain": "polygon", 
    "sourceToken": {
      "address": "0x...",
      "symbol": "USDC",
      "decimals": 6
    },
    "destinationToken": {
      "address": "0x...",
      "symbol": "USDC", 
      "decimals": 6
    },
    "sourceAmount": "1000000",
    "userAddress": "0x..."
  }'

# Expected response:
{
  "requestId": "quote-123",
  "sourceAmount": "1000000",
  "destinationAmount": "995000",
  "solverFee": "5000",
  "route": [...],
  "confidence": 95,
  "teeVerified": true,
  "trustLevel": "high"
}
```

---

## 📊 **Step 5: Testnet Monitoring**

### **5.1 Real-time Statistics**

```bash
# Get solver statistics
curl https://your-testnet-tee.phala.network/api/stats

{
  "quotesGenerated": 42,
  "ordersSubmitted": 38,
  "successRate": 90.5,
  "teeOrders": 30,
  "chainSignatureOrders": 8,
  "privateKeyOrders": 0,
  "averageQuoteTime": 85,
  "trustLevel": "high"
}
```

### **5.2 Performance Metrics**

```bash
# Get performance metrics
curl https://your-testnet-tee.phala.network/api/metrics

{
  "quoteGenerationTime": {
    "avg": 85,
    "p95": 150,
    "p99": 280
  },
  "teeAttestationTime": 450,
  "memoryUsage": "78MB",
  "cpuUsage": "12%",
  "uptime": "2h 15m"
}
```

---

## 🎯 **Step 6: Bounty Submission Preparation**

### **6.1 Testnet Demo URLs**

After deployment, you'll have:

```bash
# Live testnet endpoints
TEE_SOLVER_URL="https://your-solver.phala.network"
HEALTH_CHECK="$TEE_SOLVER_URL/api/health"
TEE_STATUS="$TEE_SOLVER_URL/api/tee/status" 
QUOTE_API="$TEE_SOLVER_URL/api/quote"
STATS_API="$TEE_SOLVER_URL/api/stats"
```

### **6.2 Bounty Submission Checklist**

✅ **Technical Proof**
- [ ] Live testnet deployment URL
- [ ] TEE attestation verification working
- [ ] Cross-chain quote generation functional
- [ ] All 185 tests passing
- [ ] NEAR Chain Signatures integrated

✅ **Documentation**
- [ ] Complete `BOUNTY_SUBMISSION.md`
- [ ] Live API endpoints documented
- [ ] Testnet configuration examples
- [ ] Performance benchmarks

✅ **Security Features**
- [ ] Intel TDX attestation active
- [ ] Hardware entropy key generation
- [ ] Triple-mode signing working
- [ ] Code hash verification enabled

---

## 🔧 **Testnet-Specific Features**

### **Debug Mode Enhancements**

```bash
# Enable debug features for testnet
export DEBUG_MODE=true
export VERBOSE_LOGGING=true
export MOCK_TEE_FALLBACK=true  # For development without full TEE
```

### **Testnet Chain Configuration**

```javascript
// Testnet chains supported
const TESTNET_CHAINS = {
  ethereum: "goerli",      // Ethereum Goerli
  polygon: "mumbai",       // Polygon Mumbai  
  arbitrum: "goerli",      // Arbitrum Goerli
  optimism: "goerli",      // Optimism Goerli
  bsc: "testnet",          // BSC Testnet
  bitcoin: "testnet3",     // Bitcoin Testnet
  solana: "devnet"         // Solana Devnet
};
```

### **Free Testnet Resources**

- **Computing**: Phala Cloud testnet quota
- **Storage**: Free TEE storage limits
- **Bandwidth**: No testnet bandwidth costs
- **Tokens**: All testnet tokens free from faucets

---

## 🎊 **Testnet Deployment Benefits**

### **For Development**
- ✅ Safe experimentation environment
- ✅ Rapid iteration cycles
- ✅ No financial risk
- ✅ Complete feature testing

### **For Demos**
- ✅ Live working system
- ✅ Real TEE attestation
- ✅ Actual cross-chain operations
- ✅ Performance benchmarks

### **For Bounty Submission**
- ✅ Verifiable live deployment
- ✅ Complete functionality demonstration
- ✅ Security features active
- ✅ Professional presentation

---

## 🚀 **Next Steps After Testnet**

1. **Successful Testnet Demo** → Present to bounty evaluators
2. **Bounty Approval** → Consider mainnet deployment
3. **Community Feedback** → Iterate and improve
4. **Production Ready** → Launch commercial service

**Testnet deployment is the perfect first step for showcasing this advanced TEE solver architecture!**

---

## 📞 **Support & Resources**

- **NEAR Testnet**: https://docs.near.org/tools/near-cli
- **Phala Cloud**: https://docs.phala.network  
- **1inch API**: https://docs.1inch.dev
- **Intel TDX**: https://www.intel.com/content/www/us/en/developer/tools/trust-domain-extensions/overview.html

**Happy Testing! 🧪✨**