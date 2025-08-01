#!/bin/bash

# Deployment script for FusionPlusCosmos CosmWasm contract
# Supports Neutron testnet and Juno testnet

set -e

# Configuration
COSMOS_HUB_TESTNET_RPC="https://rpc.theta-testnet.polypore.xyz:443"
COSMOS_HUB_TESTNET_CHAIN_ID="theta-testnet-001"
NEUTRON_TESTNET_RPC="https://neutron-testnet-rpc.polkachu.com:443"
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
    echo "  local-wasmd        Deploy to local wasmd blockchain (local-wasmd)"
    echo "  cosmos-testnet     Deploy to Cosmos Hub testnet (provider)"
    echo "  wasmd-testnet      Deploy to wasmd testnet (malaga-420)"
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
        local-wasmd|cosmos-testnet|wasmd-testnet|neutron-testnet|juno-testnet)
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
    cosmos-testnet)
        # Using the updated RPC endpoint with proper connectivity
        RPC_URL="https://rpc.provider-sentry-01.ics-testnet.polypore.xyz:443"
        CHAIN_ID="provider"
        NATIVE_DENOM="uatom"
        ADDRESS_PREFIX="cosmos"
        ;;
    wasmd-testnet)
        # Standard wasmd testnet (malaga-420)
        RPC_URL="https://rpc.malaga-420.cosmwasm.com:443"
        CHAIN_ID="malaga-420"
        NATIVE_DENOM="umlg"
        ADDRESS_PREFIX="wasm"
        ;;
    local-wasmd)
        # Local wasmd blockchain for testing
        RPC_URL="http://localhost:26657"
        CHAIN_ID="local-wasmd-v2"
        NATIVE_DENOM="stake"
        ADDRESS_PREFIX="wasm"
        ;;
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

# Add Go bin to PATH if needed
export PATH=$PATH:~/go/bin:/usr/local/go/bin

# Check if wasmd is installed
if ! command -v wasmd &> /dev/null; then
    echo -e "${RED}❌ wasmd not found${NC}"
    echo -e "${YELLOW}💡 Install wasmd: go install github.com/CosmWasm/wasmd@latest${NC}"
    echo -e "${YELLOW}   Or make sure ~/go/bin is in your PATH${NC}"
    exit 1
fi

# Set daemon and wallet based on network
if [ "$NETWORK" = "cosmos-testnet" ]; then
    # Use gaiad for Cosmos Hub (supports cosmos1 addresses natively)
    if ! command -v gaiad &> /dev/null; then
        echo -e "${RED}❌ gaiad not found${NC}"
        echo -e "${YELLOW}💡 Install gaiad for Cosmos Hub deployment${NC}"
        exit 1
    fi
    DAEMON="gaiad"
    WALLET_NAME="cosmos-deployer"
elif [ "$NETWORK" = "neutron-testnet" ]; then
    # Use neutrond for Neutron testnet (supports neutron1 addresses natively)
    if ! command -v neutrond &> /dev/null; then
        echo -e "${RED}❌ neutrond not found${NC}"
        echo -e "${YELLOW}💡 Install neutrond for Neutron deployment${NC}"
        exit 1
    fi
    DAEMON="neutrond"
    WALLET_NAME="neutron-deployer"
else
    # Use wasmd for other networks
    DAEMON="wasmd"
fi

# Check wallet exists (use global keystore for local-wasmd)
if [ "$NETWORK" = "local-wasmd" ]; then
    if ! $DAEMON keys show $WALLET_NAME --keyring-backend test &> /dev/null; then
        echo -e "${RED}❌ Wallet '$WALLET_NAME' not found${NC}"
        echo -e "${YELLOW}💡 Create wallet: $DAEMON keys add $WALLET_NAME --keyring-backend test${NC}"
        exit 1
    fi
    DEPLOYER_ADDRESS=$($DAEMON keys show $WALLET_NAME --address --keyring-backend test)
else
    if ! $DAEMON keys show $WALLET_NAME --keyring-backend test --home ./keys &> /dev/null; then
        echo -e "${RED}❌ Wallet '$WALLET_NAME' not found${NC}"
        echo -e "${YELLOW}💡 Create wallet: $DAEMON keys add $WALLET_NAME --keyring-backend test --home ./keys${NC}"
        exit 1
    fi
    DEPLOYER_ADDRESS=$($DAEMON keys show $WALLET_NAME --address --keyring-backend test --home ./keys)
fi
echo -e "${GREEN}👤 Deploying from: $DEPLOYER_ADDRESS${NC}"

# Note: Address might need conversion for different networks
if [[ $DEPLOYER_ADDRESS == wasm1* ]] && [ "$NETWORK" = "neutron-testnet" ]; then
    echo -e "${YELLOW}⚠️  Address has 'wasm' prefix but Neutron expects 'neutron' prefix${NC}"
    echo -e "${YELLOW}💡 You may need to get tokens for this exact address: $DEPLOYER_ADDRESS${NC}"
fi

# Check balance
echo -e "${BLUE}💰 Checking balance...${NC}"
BALANCE=$($DAEMON query bank balances $DEPLOYER_ADDRESS --node $RPC_URL --output json 2>/dev/null | jq -r ".balances[] | select(.denom==\"$NATIVE_DENOM\") | .amount")

if [ -z "$BALANCE" ] || [ "$BALANCE" = "null" ]; then
    echo -e "${YELLOW}⚠️  Could not query balance (RPC issue), but proceeding with deployment${NC}"
    echo -e "${YELLOW}💡 Make sure you have at least 0.1 ATOM for deployment fees${NC}"
    BALANCE="1000000"  # Assume sufficient balance
else
    if [ "$BALANCE" = "0" ]; then
        echo -e "${RED}❌ Insufficient balance for deployment${NC}"
        echo -e "${YELLOW}💡 Get testnet tokens from faucet${NC}"
        if [ "$NETWORK" = "cosmos-testnet" ]; then
            echo -e "${YELLOW}   Cosmos Hub faucet: https://discord.gg/cosmosnetwork (request in #faucet channel)${NC}"
        elif [ "$NETWORK" = "neutron-testnet" ]; then
            echo -e "${YELLOW}   Neutron faucet: https://faucet.pion-1.ntrn.tech/${NC}"
        elif [ "$NETWORK" = "juno-testnet" ]; then
            echo -e "${YELLOW}   Juno faucet: https://faucet.uni.junonetwork.io/${NC}"
        fi
        exit 1
    fi
fi

BALANCE_TOKENS=$(echo "scale=6; $BALANCE / 1000000" | bc)
echo -e "${GREEN}💰 Balance: $BALANCE_TOKENS tokens${NC}"

# Store contract
echo -e "${BLUE}📦 Storing contract on $NETWORK...${NC}"
if [ "$NETWORK" = "local-wasmd" ]; then
    STORE_TX=$($DAEMON tx wasm store $CONTRACT_PATH \
        --from $WALLET_NAME \
        --keyring-backend test \
        --node $RPC_URL \
        --chain-id $CHAIN_ID \
        --gas-prices 0.01$NATIVE_DENOM \
        --gas auto \
        --gas-adjustment 1.3 \
        --output json \
        --yes)
else
    STORE_TX=$($DAEMON tx wasm store $CONTRACT_PATH \
        --from $WALLET_NAME \
        --keyring-backend test \
        --home ./keys \
        --node $RPC_URL \
        --chain-id $CHAIN_ID \
        --gas-prices 0.01$NATIVE_DENOM \
        --gas auto \
        --gas-adjustment 1.3 \
        --output json \
        --yes)
fi

# Extract transaction hash
TX_HASH=$(echo $STORE_TX | jq -r '.txhash')
echo -e "${BLUE}📋 Store TX Hash: $TX_HASH${NC}"

# Wait for transaction confirmation
echo -e "${BLUE}⏳ Waiting for transaction confirmation...${NC}"
sleep 6

# Get code ID from transaction
CODE_ID=$($DAEMON query tx $TX_HASH --node $RPC_URL --output json | jq -r '.logs[0].events[] | select(.type == "store_code") | .attributes[] | select(.key == "code_id") | .value')

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
if [ "$NETWORK" = "local-wasmd" ]; then
    INSTANTIATE_TX=$($DAEMON tx wasm instantiate $CODE_ID "$INIT_MSG" \
        --label "FusionPlusCosmos-v0.1.0" \
        --admin $DEPLOYER_ADDRESS \
        --from $WALLET_NAME \
        --keyring-backend test \
        --node $RPC_URL \
        --chain-id $CHAIN_ID \
        --gas-prices 0.01$NATIVE_DENOM \
        --gas auto \
        --gas-adjustment 1.3 \
        --output json \
        --yes)
else
    INSTANTIATE_TX=$($DAEMON tx wasm instantiate $CODE_ID "$INIT_MSG" \
        --label "FusionPlusCosmos-v0.1.0" \
        --admin $DEPLOYER_ADDRESS \
        --from $WALLET_NAME \
        --keyring-backend test \
        --home ./keys \
        --node $RPC_URL \
        --chain-id $CHAIN_ID \
        --gas-prices 0.01$NATIVE_DENOM \
        --gas auto \
        --gas-adjustment 1.3 \
        --output json \
        --yes)
fi

# Extract transaction hash
INSTANTIATE_TX_HASH=$(echo $INSTANTIATE_TX | jq -r '.txhash')
echo -e "${BLUE}📋 Instantiate TX Hash: $INSTANTIATE_TX_HASH${NC}"

# Wait for transaction confirmation
echo -e "${BLUE}⏳ Waiting for instantiation...${NC}"
sleep 6

# Get contract address from transaction
CONTRACT_ADDRESS=$($DAEMON query tx $INSTANTIATE_TX_HASH --node $RPC_URL --output json | jq -r '.logs[0].events[] | select(.type == "instantiate") | .attributes[] | select(.key == "_contract_address") | .value')

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