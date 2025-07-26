#!/bin/bash

# Deployment script for FusionPlusCosmos CosmWasm contract
# Supports Neutron testnet and Juno testnet

set -e

# Configuration
NEUTRON_TESTNET_RPC="https://rpc-palvus.pion-1.ntrn.tech:443"
NEUTRON_TESTNET_CHAIN_ID="pion-1"
JUNO_TESTNET_RPC="https://rpc.uni.junonetwork.io:443"
JUNO_TESTNET_CHAIN_ID="uni-6"

# Default values
NETWORK=""
WALLET_NAME="fusion-deployer"
CONTRACT_PATH="./artifacts/fusion_plus_cosmos.wasm"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

usage() {
    echo "Usage: $0 <network> [options]"
    echo ""
    echo "Networks:"
    echo "  neutron-testnet    Deploy to Neutron testnet (pion-1)"
    echo "  juno-testnet       Deploy to Juno testnet (uni-6)"
    echo ""
    echo "Options:"
    echo "  --wallet <name>    Wallet name (default: fusion-deployer)"
    echo "  --contract <path>  Contract path (default: ./artifacts/fusion_plus_cosmos.wasm)"
    echo "  --help             Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 neutron-testnet"
    echo "  $0 juno-testnet --wallet my-wallet"
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
        --contract)
            CONTRACT_PATH="$2"
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

# Set network-specific variables
case $NETWORK in
    neutron-testnet)
        RPC_URL="$NEUTRON_TESTNET_RPC"
        CHAIN_ID="$NEUTRON_TESTNET_CHAIN_ID"
        NATIVE_DENOM="untrn"
        ADDRESS_PREFIX="neutron"
        ;;
    juno-testnet)
        RPC_URL="$JUNO_TESTNET_RPC"
        CHAIN_ID="$JUNO_TESTNET_CHAIN_ID"
        NATIVE_DENOM="ujunox"
        ADDRESS_PREFIX="juno"
        ;;
    *)
        echo -e "${RED}Error: Unsupported network: $NETWORK${NC}"
        exit 1
        ;;
esac

echo -e "${BLUE}🚀 Deploying FusionPlusCosmos to $NETWORK${NC}"
echo -e "${BLUE}   Chain ID: $CHAIN_ID${NC}"
echo -e "${BLUE}   RPC: $RPC_URL${NC}"
echo -e "${BLUE}   Wallet: $WALLET_NAME${NC}"
echo ""

# Check if contract file exists
if [ ! -f "$CONTRACT_PATH" ]; then
    echo -e "${RED}❌ Contract file not found: $CONTRACT_PATH${NC}"
    echo -e "${YELLOW}💡 Run ./build.sh first to build the contract${NC}"
    exit 1
fi

# Check if neutrond/junod is installed
if [ "$NETWORK" = "neutron-testnet" ]; then
    if ! command -v neutrond &> /dev/null; then
        echo -e "${RED}❌ neutrond not found${NC}"
        echo -e "${YELLOW}💡 Install neutrond: https://docs.neutron.org/neutron/install${NC}"
        exit 1
    fi
    DAEMON="neutrond"
elif [ "$NETWORK" = "juno-testnet" ]; then
    if ! command -v junod &> /dev/null; then
        echo -e "${RED}❌ junod not found${NC}"
        echo -e "${YELLOW}💡 Install junod: https://docs.junonetwork.io/validators/getting-setup${NC}"
        exit 1
    fi
    DAEMON="junod"
fi

# Check wallet exists
if ! $DAEMON keys show $WALLET_NAME &> /dev/null; then
    echo -e "${RED}❌ Wallet '$WALLET_NAME' not found${NC}"
    echo -e "${YELLOW}💡 Create wallet: $DAEMON keys add $WALLET_NAME${NC}"
    exit 1
fi

# Get wallet address
DEPLOYER_ADDRESS=$($DAEMON keys show $WALLET_NAME --address)
echo -e "${GREEN}👤 Deploying from: $DEPLOYER_ADDRESS${NC}"

# Check balance
echo -e "${BLUE}💰 Checking balance...${NC}"
BALANCE=$($DAEMON query bank balances $DEPLOYER_ADDRESS --node $RPC_URL --chain-id $CHAIN_ID --output json | jq -r ".balances[] | select(.denom==\"$NATIVE_DENOM\") | .amount")

if [ -z "$BALANCE" ] || [ "$BALANCE" = "null" ] || [ "$BALANCE" = "0" ]; then
    echo -e "${RED}❌ Insufficient balance for deployment${NC}"
    echo -e "${YELLOW}💡 Get testnet tokens from faucet${NC}"
    if [ "$NETWORK" = "neutron-testnet" ]; then
        echo -e "${YELLOW}   Neutron faucet: https://faucet.pion-1.ntrn.tech/${NC}"
    elif [ "$NETWORK" = "juno-testnet" ]; then
        echo -e "${YELLOW}   Juno faucet: https://faucet.uni.junonetwork.io/${NC}"
    fi
    exit 1
fi

BALANCE_TOKENS=$(echo "scale=6; $BALANCE / 1000000" | bc)
echo -e "${GREEN}💰 Balance: $BALANCE_TOKENS tokens${NC}"

# Store contract
echo -e "${BLUE}📦 Storing contract on $NETWORK...${NC}"
STORE_TX=$($DAEMON tx wasm store $CONTRACT_PATH \
    --from $WALLET_NAME \
    --node $RPC_URL \
    --chain-id $CHAIN_ID \
    --gas-prices 0.01$NATIVE_DENOM \
    --gas auto \
    --gas-adjustment 1.3 \
    --output json \
    --yes)

# Extract transaction hash
TX_HASH=$(echo $STORE_TX | jq -r '.txhash')
echo -e "${BLUE}📋 Store TX Hash: $TX_HASH${NC}"

# Wait for transaction confirmation
echo -e "${BLUE}⏳ Waiting for transaction confirmation...${NC}"
sleep 6

# Get code ID from transaction
CODE_ID=$($DAEMON query tx $TX_HASH --node $RPC_URL --chain-id $CHAIN_ID --output json | jq -r '.logs[0].events[] | select(.type == "store_code") | .attributes[] | select(.key == "code_id") | .value')

if [ -z "$CODE_ID" ] || [ "$CODE_ID" = "null" ]; then
    echo -e "${RED}❌ Failed to retrieve code ID${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Contract stored with Code ID: $CODE_ID${NC}"

# Prepare instantiation message
INIT_MSG=$(cat <<EOF
{
  "admin": "$DEPLOYER_ADDRESS",
  "min_safety_deposit_bps": 500,
  "native_denom": "$NATIVE_DENOM"
}
EOF
)

echo -e "${BLUE}🏗️  Instantiating contract...${NC}"

# Instantiate contract
INSTANTIATE_TX=$($DAEMON tx wasm instantiate $CODE_ID "$INIT_MSG" \
    --label "FusionPlusCosmos-v0.1.0" \
    --admin $DEPLOYER_ADDRESS \
    --from $WALLET_NAME \
    --node $RPC_URL \
    --chain-id $CHAIN_ID \
    --gas-prices 0.01$NATIVE_DENOM \
    --gas auto \
    --gas-adjustment 1.3 \
    --output json \
    --yes)

# Extract transaction hash
INSTANTIATE_TX_HASH=$(echo $INSTANTIATE_TX | jq -r '.txhash')
echo -e "${BLUE}📋 Instantiate TX Hash: $INSTANTIATE_TX_HASH${NC}"

# Wait for transaction confirmation
echo -e "${BLUE}⏳ Waiting for instantiation...${NC}"
sleep 6

# Get contract address from transaction
CONTRACT_ADDRESS=$($DAEMON query tx $INSTANTIATE_TX_HASH --node $RPC_URL --chain-id $CHAIN_ID --output json | jq -r '.logs[0].events[] | select(.type == "instantiate") | .attributes[] | select(.key == "_contract_address") | .value')

if [ -z "$CONTRACT_ADDRESS" ] || [ "$CONTRACT_ADDRESS" = "null" ]; then
    echo -e "${RED}❌ Failed to retrieve contract address${NC}"
    exit 1
fi

echo -e "${GREEN}🎉 Contract deployed successfully!${NC}"
echo ""
echo -e "${GREEN}📋 Deployment Summary:${NC}"
echo -e "${GREEN}   Network: $NETWORK${NC}"
echo -e "${GREEN}   Chain ID: $CHAIN_ID${NC}"
echo -e "${GREEN}   Code ID: $CODE_ID${NC}"
echo -e "${GREEN}   Contract Address: $CONTRACT_ADDRESS${NC}"
echo -e "${GREEN}   Admin: $DEPLOYER_ADDRESS${NC}"
echo ""

# Save deployment info
DEPLOYMENT_FILE="deployment-$NETWORK.json"
cat > $DEPLOYMENT_FILE <<EOF
{
  "network": "$NETWORK",
  "chain_id": "$CHAIN_ID",
  "rpc_url": "$RPC_URL",
  "native_denom": "$NATIVE_DENOM",
  "code_id": $CODE_ID,
  "contract_address": "$CONTRACT_ADDRESS",
  "admin": "$DEPLOYER_ADDRESS",
  "store_tx_hash": "$TX_HASH",
  "instantiate_tx_hash": "$INSTANTIATE_TX_HASH",
  "deployed_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF

echo -e "${BLUE}💾 Deployment info saved to: $DEPLOYMENT_FILE${NC}"
echo ""
echo -e "${YELLOW}🔧 Next steps:${NC}"
echo -e "${YELLOW}1. Test the contract: ./test-integration.sh $NETWORK${NC}"
echo -e "${YELLOW}2. Add resolver: $DAEMON tx wasm execute $CONTRACT_ADDRESS '{\"add_resolver\":{\"resolver\":\"<resolver_address>\"}}' --from $WALLET_NAME${NC}"
echo -e "${YELLOW}3. Create Fusion+ order through the Ethereum side${NC}"
echo ""