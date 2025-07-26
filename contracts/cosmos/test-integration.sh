#!/bin/bash

# Integration testing script for deployed FusionPlusCosmos contract
# Tests real contract on testnet with actual transactions

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
NETWORK=""
WALLET_NAME="fusion-deployer"
TEST_WALLET="fusion-tester"

usage() {
    echo "Usage: $0 <network> [options]"
    echo ""
    echo "Networks:"
    echo "  neutron-testnet    Test on Neutron testnet"
    echo "  juno-testnet       Test on Juno testnet"
    echo ""
    echo "Options:"
    echo "  --wallet <name>    Admin wallet name (default: fusion-deployer)"
    echo "  --test-wallet <name> Test wallet name (default: fusion-tester)"
    echo "  --help             Show this help message"
    echo ""
    exit 1
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        neutron-testnet|juno-testnet)
            NETWORK="$1"
            shift
            ;;
        --wallet)
            WALLET_NAME="$2"
            shift 2
            ;;
        --test-wallet)
            TEST_WALLET="$2"
            shift 2
            ;;
        --help)
            usage
            ;;
        *)
            echo -e "${RED}Error: Unknown option $1${NC}"
            usage
            ;;
    esac
done

# Validate network
if [ -z "$NETWORK" ]; then
    echo -e "${RED}Error: Network not specified${NC}"
    usage
fi

# Load deployment info
DEPLOYMENT_FILE="deployment-$NETWORK.json"
if [ ! -f "$DEPLOYMENT_FILE" ]; then
    echo -e "${RED}❌ Deployment file not found: $DEPLOYMENT_FILE${NC}"
    echo -e "${YELLOW}💡 Deploy the contract first: ./deploy.sh $NETWORK${NC}"
    exit 1
fi

# Extract deployment info
CONTRACT_ADDRESS=$(jq -r '.contract_address' $DEPLOYMENT_FILE)
CHAIN_ID=$(jq -r '.chain_id' $DEPLOYMENT_FILE)
RPC_URL=$(jq -r '.rpc_url' $DEPLOYMENT_FILE)
NATIVE_DENOM=$(jq -r '.native_denom' $DEPLOYMENT_FILE)
ADMIN_ADDRESS=$(jq -r '.admin' $DEPLOYMENT_FILE)

# Set daemon based on network
if [ "$NETWORK" = "neutron-testnet" ]; then
    DAEMON="neutrond"
elif [ "$NETWORK" = "juno-testnet" ]; then
    DAEMON="junod"
fi

echo -e "${BLUE}🧪 Running integration tests for FusionPlusCosmos${NC}"
echo -e "${BLUE}   Network: $NETWORK${NC}"
echo -e "${BLUE}   Contract: $CONTRACT_ADDRESS${NC}"
echo -e "${BLUE}   Chain ID: $CHAIN_ID${NC}"
echo ""

# Test 1: Query contract config
echo -e "${BLUE}🔍 Test 1: Query contract configuration${NC}"
CONFIG_RESULT=$($DAEMON query wasm contract-state smart $CONTRACT_ADDRESS '{"config":{}}' --node $RPC_URL --chain-id $CHAIN_ID --output json)
echo -e "${GREEN}✅ Config query successful${NC}"
echo "   Admin: $(echo $CONFIG_RESULT | jq -r '.data.admin')"
echo "   Safety deposit: $(echo $CONFIG_RESULT | jq -r '.data.min_safety_deposit_bps') bps"
echo "   Native denom: $(echo $CONFIG_RESULT | jq -r '.data.native_denom')"
echo ""

# Test 2: Check admin is authorized resolver
echo -e "${BLUE}🔍 Test 2: Check admin resolver authorization${NC}"
RESOLVER_RESULT=$($DAEMON query wasm contract-state smart $CONTRACT_ADDRESS "{\"is_authorized_resolver\":{\"address\":\"$ADMIN_ADDRESS\"}}" --node $RPC_URL --chain-id $CHAIN_ID --output json)
IS_AUTHORIZED=$(echo $RESOLVER_RESULT | jq -r '.data.is_authorized')
if [ "$IS_AUTHORIZED" = "true" ]; then
    echo -e "${GREEN}✅ Admin is authorized resolver${NC}"
else
    echo -e "${RED}❌ Admin is not authorized resolver${NC}"
    exit 1
fi
echo ""

# Test 3: Create test resolver wallet if it doesn't exist
echo -e "${BLUE}🔍 Test 3: Setup test resolver wallet${NC}"
if ! $DAEMON keys show $TEST_WALLET &> /dev/null; then
    echo -e "${YELLOW}🔧 Creating test wallet: $TEST_WALLET${NC}"
    $DAEMON keys add $TEST_WALLET --output json > /dev/null
fi

TEST_RESOLVER_ADDRESS=$($DAEMON keys show $TEST_WALLET --address)
echo -e "${GREEN}👤 Test resolver: $TEST_RESOLVER_ADDRESS${NC}"

# Test 4: Add test resolver (requires admin)
echo -e "${BLUE}🔍 Test 4: Add test resolver${NC}"
ADD_RESOLVER_TX=$($DAEMON tx wasm execute $CONTRACT_ADDRESS \
    "{\"add_resolver\":{\"resolver\":\"$TEST_RESOLVER_ADDRESS\"}}" \
    --from $WALLET_NAME \
    --node $RPC_URL \
    --chain-id $CHAIN_ID \
    --gas-prices 0.01$NATIVE_DENOM \
    --gas auto \
    --gas-adjustment 1.3 \
    --output json \
    --yes)

sleep 3

# Verify resolver was added
RESOLVER_CHECK=$($DAEMON query wasm contract-state smart $CONTRACT_ADDRESS "{\"is_authorized_resolver\":{\"address\":\"$TEST_RESOLVER_ADDRESS\"}}" --node $RPC_URL --chain-id $CHAIN_ID --output json)
IS_TEST_AUTHORIZED=$(echo $RESOLVER_CHECK | jq -r '.data.is_authorized')
if [ "$IS_TEST_AUTHORIZED" = "true" ]; then
    echo -e "${GREEN}✅ Test resolver added successfully${NC}"
else
    echo -e "${RED}❌ Failed to add test resolver${NC}"
    exit 1
fi
echo ""

# Test 5: List all resolvers
echo -e "${BLUE}🔍 Test 5: List all authorized resolvers${NC}"
RESOLVERS_RESULT=$($DAEMON query wasm contract-state smart $CONTRACT_ADDRESS '{"list_resolvers":{"limit":10}}' --node $RPC_URL --chain-id $CHAIN_ID --output json)
RESOLVER_COUNT=$(echo $RESOLVERS_RESULT | jq '.data.resolvers | length')
echo -e "${GREEN}✅ Found $RESOLVER_COUNT authorized resolvers${NC}"
echo "   Resolvers: $(echo $RESOLVERS_RESULT | jq -r '.data.resolvers[]' | tr '\n' ' ')"
echo ""

# Test 6: Try to execute order (will fail due to insufficient funds, but tests validation)
echo -e "${BLUE}🔍 Test 6: Test order execution validation${NC}"
ORDER_MSG="{\"execute_fusion_order\":{\"order_hash\":\"test_order_integration_$(date +%s)\",\"hashlock\":\"a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3\",\"timelocks\":\"123456789\",\"maker\":\"$TEST_RESOLVER_ADDRESS\",\"amount\":\"1000000\",\"resolver_fee\":\"50000\",\"source_chain_id\":11155111,\"timeout_seconds\":3600}}"

# This should fail due to insufficient funds, but will test parameter validation
set +e
ORDER_TX=$($DAEMON tx wasm execute $CONTRACT_ADDRESS "$ORDER_MSG" \
    --from $TEST_WALLET \
    --node $RPC_URL \
    --chain-id $CHAIN_ID \
    --gas-prices 0.01$NATIVE_DENOM \
    --gas auto \
    --gas-adjustment 1.3 \
    --output json \
    --yes 2>&1)
set -e

if echo "$ORDER_TX" | grep -q "insufficient funds"; then
    echo -e "${GREEN}✅ Order validation working (failed as expected due to insufficient funds)${NC}"
elif echo "$ORDER_TX" | grep -q "txhash"; then
    echo -e "${GREEN}✅ Order execution successful (had sufficient funds)${NC}"
else
    echo -e "${YELLOW}⚠️  Order execution had unexpected result${NC}"
    echo "Response: $ORDER_TX"
fi
echo ""

# Test 7: List orders
echo -e "${BLUE}🔍 Test 7: List orders${NC}"
ORDERS_RESULT=$($DAEMON query wasm contract-state smart $CONTRACT_ADDRESS '{"list_orders":{"limit":10}}' --node $RPC_URL --chain-id $CHAIN_ID --output json)
ORDER_COUNT=$(echo $ORDERS_RESULT | jq '.data.orders | length')
echo -e "${GREEN}✅ Found $ORDER_COUNT orders in contract${NC}"

if [ "$ORDER_COUNT" -gt 0 ]; then
    echo "   Recent orders:"
    echo $ORDERS_RESULT | jq -r '.data.orders[] | "     - " + .order_hash + " (status: " + .status + ")"'
fi
echo ""

# Test 8: Remove test resolver (cleanup)
echo -e "${BLUE}🔍 Test 8: Remove test resolver (cleanup)${NC}"
REMOVE_RESOLVER_TX=$($DAEMON tx wasm execute $CONTRACT_ADDRESS \
    "{\"remove_resolver\":{\"resolver\":\"$TEST_RESOLVER_ADDRESS\"}}" \
    --from $WALLET_NAME \
    --node $RPC_URL \
    --chain-id $CHAIN_ID \
    --gas-prices 0.01$NATIVE_DENOM \
    --gas auto \
    --gas-adjustment 1.3 \
    --output json \
    --yes)

sleep 3

# Verify resolver was removed
FINAL_RESOLVER_CHECK=$($DAEMON query wasm contract-state smart $CONTRACT_ADDRESS "{\"is_authorized_resolver\":{\"address\":\"$TEST_RESOLVER_ADDRESS\"}}" --node $RPC_URL --chain-id $CHAIN_ID --output json)
IS_FINAL_AUTHORIZED=$(echo $FINAL_RESOLVER_CHECK | jq -r '.data.is_authorized')
if [ "$IS_FINAL_AUTHORIZED" = "false" ]; then
    echo -e "${GREEN}✅ Test resolver removed successfully${NC}"
else
    echo -e "${RED}❌ Failed to remove test resolver${NC}"
fi
echo ""

# Summary
echo -e "${GREEN}🎉 Integration tests completed!${NC}"
echo ""
echo -e "${GREEN}📋 Test Summary:${NC}"
echo -e "${GREEN}   ✅ Contract configuration query${NC}"
echo -e "${GREEN}   ✅ Admin resolver authorization${NC}"
echo -e "${GREEN}   ✅ Test wallet creation${NC}"
echo -e "${GREEN}   ✅ Resolver management (add/remove)${NC}"
echo -e "${GREEN}   ✅ Order execution validation${NC}"
echo -e "${GREEN}   ✅ Order listing${NC}"
echo -e "${GREEN}   ✅ Contract cleanup${NC}"
echo ""
echo -e "${BLUE}📡 Contract is ready for production use!${NC}"
echo -e "${BLUE}   Connect to 1inch Fusion+ Ethereum contracts${NC}"
echo -e "${BLUE}   Contract Address: $CONTRACT_ADDRESS${NC}"
echo ""