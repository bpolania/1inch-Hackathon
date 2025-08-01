# Phase 2 Testing Guide - CosmosDestinationChain Adapter

## Quick Test Commands

### 1. Run All Phase 2 Tests
```bash
npm test -- test/CosmosDestinationChain.test.js
```

### 2. Test Specific Features
```bash
# Address validation tests
npm test -- --grep "Address Validation"

# Cost estimation tests  
npm test -- --grep "Cost Estimation"

# Multi-chain support tests
npm test -- --grep "Multi-Chain"

# Parameter validation tests
npm test -- --grep "Parameter Validation"
```

### 3. Deploy and Test Locally
```bash
# Terminal 1: Start local blockchain
npx hardhat node

# Terminal 2: Deploy locally  
npm run deploy:local

# Terminal 2: Run integration tests
npm run test:local
```

## Manual Testing Scenarios

### Test 1: Address Validation
```javascript
// Test valid Neutron addresses
const validNeutronAddr = "neutron1abc123def456ghi789jkl012mno345pqr678stu";
await cosmosAdapter.validateDestinationAddress(validNeutronAddr);

// Test valid Juno addresses  
const validJunoAddr = "juno1abc123def456ghi789jkl012mno345pqr678stu";
await junoAdapter.validateDestinationAddress(validJunoAddr);
```

### Test 2: Cost Estimation
```javascript
// Test simple transfer cost
const simpleCost = await cosmosAdapter.estimateExecutionCost(
  ethers.parseEther("1"), // 1 token
  "simple_transfer", 
  "neutron1recipient..."
);

// Test complex execution cost
const complexCost = await cosmosAdapter.estimateExecutionCost(
  ethers.parseEther("100"), // 100 tokens
  JSON.stringify({execute: {contract_addr: "...", msg: {...}}}),
  "neutron1contract..."
);
```

### Test 3: Parameter Encoding
```javascript
// Test CosmWasm execution parameters
const params = await cosmosAdapter.encodeExecutionParams(
  "neutron1contract123...",
  JSON.stringify({execute_msg: "test"}),
  ["100000untrn"], // funds
  300000 // gas limit
);
```

### Test 4: Safety Deposit Calculation
```javascript
// Test 5% safety deposit calculation
const deposit = await cosmosAdapter.calculateSafetyDeposit(
  ethers.parseEther("20") // 20 tokens = 1 token deposit (5%)
);
```

## Expected Results

### ✅ All Tests Should Pass:
- **29 CosmosDestinationChain tests**
- **39 Integration tests** (when running test:local)
- **Multi-chain support** for Neutron, Juno, Cosmos Hub

### ✅ Key Functionality:
- **Address Validation**: Proper bech32 format checking
- **Cost Estimation**: Base costs + complexity scaling  
- **Parameter Encoding**: CosmWasm execution parameters
- **Safety Deposits**: 5% calculation across all chains
- **Token Support**: Native Cosmos tokens (untrn, ujuno, uatom)

## Troubleshooting

### If Tests Fail:
1. Check that all dependencies are installed: `npm install`
2. Compile contracts: `npm run compile`  
3. Restart local node if needed: `npx hardhat node --reset`

### If Deployment Fails:
1. Make sure local node is running: `npx hardhat node`
2. Check account has ETH balance
3. Try: `npm run deploy:local -- --reset`

## Test Coverage Summary

The Phase 2 implementation covers:
- ✅ **Contract Deployment** (4 tests)
- ✅ **Address Validation** (7 tests) 
- ✅ **Parameter Validation** (5 tests)
- ✅ **Safety Deposits** (2 tests)
- ✅ **Token Format** (3 tests)
- ✅ **Feature Support** (2 tests)
- ✅ **Cost Estimation** (3 tests)
- ✅ **Order Metadata** (1 test)
- ✅ **Default Parameters** (1 test)
- ✅ **Multi-Chain Support** (1 test)

**Total: 29/29 tests passing** ✅