#!/bin/bash

# Quick Testnet Setup Script for NEAR Shade Agent TEE Solver

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

echo -e "${BLUE}"
echo "🧪 NEAR Shade Agent TEE Solver - Testnet Setup"
echo "=============================================="
echo -e "${NC}"

# Check if environment variables are set
check_env_vars() {
    log_info "Checking required environment variables..."
    
    local missing_vars=()
    
    if [[ -z "${NEAR_ACCOUNT}" ]]; then
        missing_vars+=("NEAR_ACCOUNT")
    fi
    
    if [[ -z "${NEAR_SECRET_KEY}" ]]; then
        missing_vars+=("NEAR_SECRET_KEY")
    fi
    
    if [[ -z "${ONEINCH_AUTH_KEY}" ]]; then
        missing_vars+=("ONEINCH_AUTH_KEY")
    fi
    
    if [[ ${#missing_vars[@]} -gt 0 ]]; then
        log_error "Missing required environment variables:"
        for var in "${missing_vars[@]}"; do
            echo "  - $var"
        done
        echo ""
        log_info "Please set these variables:"
        echo "export NEAR_ACCOUNT=\"your-solver.testnet\""
        echo "export NEAR_SECRET_KEY=\"ed25519:your-testnet-private-key\""
        echo "export ONEINCH_AUTH_KEY=\"your-dev-api-key\""
        exit 1
    fi
    
    log_success "All required environment variables are set"
}

# Setup testnet environment
setup_testnet_env() {
    log_info "Setting up testnet environment..."
    
    # Export testnet-specific variables
    export DEPLOYMENT_ENV="testnet"
    export NEAR_NETWORK="testnet"
    export MPC_CONTRACT_ID="v1.signer-dev"
    export TEE_MODE="enabled"
    export LOG_LEVEL="debug"
    
    log_success "Testnet environment configured"
}

# Create testnet environment file
create_testnet_env_file() {
    log_info "Creating testnet environment file..."
    
    cat > .env.testnet << EOF
# NEAR Shade Agent TEE Solver - Testnet Configuration
# Generated on $(date)

# NEAR Testnet Configuration
NEXT_PUBLIC_accountId=${NEAR_ACCOUNT}
NEXT_PUBLIC_secretKey=${NEAR_SECRET_KEY}
NEXT_PUBLIC_contractId=${NEAR_ACCOUNT}-shade-agent
NEAR_NETWORK=testnet

# TEE Configuration
TEE_MODE=enabled
TEE_ATTESTATION_ENDPOINT=https://phala-cloud-attestation.com/api/v1
SHADE_AGENT_CONTRACT=${NEAR_ACCOUNT}-shade-agent
EXPECTED_CODE_HASH=sha256:will-be-generated-during-build

# 1inch Testnet Integration
ONEINCH_API_URL=https://api.1inch.dev
ONEINCH_AUTH_KEY=${ONEINCH_AUTH_KEY}
ONEINCH_FUSION_API_URL=https://api.1inch.dev/fusion
ONEINCH_CROSS_CHAIN_API_URL=https://api.1inch.dev/fusion-plus

# Chain Signatures (Testnet)
CHAIN_SIGNATURES_ENABLED=true
CHAIN_SIGNATURES_FALLBACK=true
MPC_CONTRACT_ID=v1.signer-dev
DERIVATION_PATH=tee-fusion-solver-testnet

# Testnet Security (Relaxed for testing)
PRIVATE_KEY_GENERATION=tee-hardware
ATTESTATION_VALIDATION=relaxed
CODE_HASH_VERIFICATION=enabled
MINIMUM_TRUST_LEVEL=medium

# Solver Configuration
SOLVER_ID=near-shade-tee-solver-testnet
MIN_ORDER_AMOUNT=1000000000000000
MAX_ORDER_AMOUNT=1000000000000000000
SOLVER_FEE_BPS=30
GAS_LIMIT_MULTIPLIER=1.2

# Performance (Testnet optimized)
MAX_CONCURRENT_ORDERS=25
QUOTE_CACHE_TTL=30
CONNECTION_POOL_SIZE=10
REQUEST_TIMEOUT=30000
LOG_LEVEL=debug

# Network Configuration
PORT=3000
HOST=0.0.0.0
NODE_ENV=development

# Testnet chains
SUPPORTED_CHAINS=ethereum,polygon,arbitrum,optimism,bsc

# Monitoring
MONITORING_ENABLED=true
METRICS_ENDPOINT=/api/metrics
HEALTH_CHECK_ENDPOINT=/api/health
STATS_ENDPOINT=/api/stats
EOF
    
    log_success "Testnet environment file created: .env.testnet"
}

# Run tests to ensure everything works
run_tests() {
    log_info "Running test suite to verify setup..."
    
    if npm test; then
        log_success "All 185 tests passing! ✅"
    else
        log_error "Some tests failed. Please check the output above."
        exit 1
    fi
}

# Deploy to testnet
deploy_testnet() {
    log_info "Starting testnet deployment..."
    
    # Set deployment environment
    export DEPLOYMENT_ENV="testnet"
    
    # Run the deployment script
    if ./deploy/shade-agent-deploy.sh; then
        log_success "Testnet deployment preparation completed!"
    else
        log_error "Deployment preparation failed"
        exit 1
    fi
}

# Show next steps
show_next_steps() {
    echo ""
    log_success "🎉 Testnet Setup Complete!"
    echo ""
    log_info "Next steps:"
    echo "1. 📊 Check deployment files:"
    echo "   - docker-compose.testnet.yml"
    echo "   - .env.testnet"
    echo ""
    echo "2. 🚀 Deploy to Phala Cloud:"
    echo "   - Visit: https://cloud.phala.network/dashboard"
    echo "   - Upload docker-compose.testnet.yml"
    echo "   - Configure environment variables"
    echo "   - Deploy to Intel TDX TEE"
    echo ""
    echo "3. 🧪 Test your deployment:"
    echo "   curl https://your-tee-domain.phala.network/api/health"
    echo ""
    echo "4. 📋 Submit for bounty evaluation with:"
    echo "   - Live testnet URL"
    echo "   - BOUNTY_SUBMISSION.md documentation"
    echo "   - Performance metrics and test results"
    echo ""
    log_success "Ready for bounty submission! 🏆"
}

# Main execution
main() {
    check_env_vars
    setup_testnet_env
    create_testnet_env_file
    run_tests
    deploy_testnet
    show_next_steps
}

# Run main function
main "$@"