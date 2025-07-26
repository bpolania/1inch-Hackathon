# FusionPlusCosmos CosmWasm Contract Makefile
# Provides convenient commands for development, testing, and deployment

.PHONY: help build test clean deploy-neutron deploy-juno test-neutron test-juno schema fmt clippy optimize docker-build

# Default target
help:
	@echo "FusionPlusCosmos CosmWasm Contract"
	@echo ""
	@echo "Available commands:"
	@echo "  build           Build the contract (development)"
	@echo "  optimize        Build optimized contract for deployment"
	@echo "  test            Run unit tests"
	@echo "  test-integration Run integration tests"
	@echo "  schema          Generate JSON schema"
	@echo "  fmt             Format code"
	@echo "  clippy          Run clippy lints"
	@echo "  clean           Clean build artifacts"
	@echo ""
	@echo "Deployment:"
	@echo "  deploy-neutron  Deploy to Neutron testnet"
	@echo "  deploy-juno     Deploy to Juno testnet"
	@echo "  test-neutron    Run integration tests on Neutron"
	@echo "  test-juno       Run integration tests on Juno"
	@echo ""
	@echo "Development:"
	@echo "  dev-setup       Setup development environment"
	@echo "  docker-build    Build using Docker optimizer"
	@echo ""

# Build commands
build:
	@echo "🔧 Building contract..."
	cargo build --release --target wasm32-unknown-unknown

optimize:
	@echo "🏗️ Building optimized contract..."
	./build.sh

docker-build:
	@echo "🐳 Building with Docker optimizer..."
	docker run --rm -v "$$(pwd)":/code \
		--mount type=volume,source="$$(basename "$$(pwd)")_cache",target=/code/target \
		--mount type=volume,source=registry_cache,target=/usr/local/cargo/registry \
		cosmwasm/rust-optimizer:0.12.13

# Testing commands
test:
	@echo "🧪 Running unit tests..."
	cargo test

test-integration:
	@echo "🧪 Running unit and integration tests..."
	cargo test --features integration-tests

# Code quality
fmt:
	@echo "📝 Formatting code..."
	cargo fmt

clippy:
	@echo "📎 Running clippy..."
	cargo clippy --all-targets --all-features -- -D warnings

# Schema generation
schema:
	@echo "📋 Generating schema..."
	cargo schema

# Deployment commands
deploy-neutron:
	@echo "🚀 Deploying to Neutron testnet..."
	./deploy.sh neutron-testnet

deploy-juno:
	@echo "🚀 Deploying to Juno testnet..."
	./deploy.sh juno-testnet

# Integration testing on live networks
test-neutron:
	@echo "🧪 Testing on Neutron testnet..."
	./test-integration.sh neutron-testnet

test-juno:
	@echo "🧪 Testing on Juno testnet..."
	./test-integration.sh juno-testnet

# Development setup
dev-setup:
	@echo "🛠️ Setting up development environment..."
	@echo "Installing Rust target for WebAssembly..."
	rustup target add wasm32-unknown-unknown
	@echo "Installing cosmwasm-check..."
	cargo install cosmwasm-check
	@echo "Making scripts executable..."
	chmod +x build.sh deploy.sh test-integration.sh
	@echo "✅ Development environment ready!"

# Utility commands
clean:
	@echo "🧹 Cleaning build artifacts..."
	cargo clean
	rm -rf artifacts/
	rm -rf schema/

# Contract size check
check-size:
	@if [ -f "./artifacts/fusion_plus_cosmos.wasm" ]; then \
		echo "📊 Contract size: $$(wc -c < ./artifacts/fusion_plus_cosmos.wasm) bytes"; \
		echo "📊 Max recommended: 600000 bytes"; \
	else \
		echo "❌ Contract not built yet. Run 'make optimize' first."; \
	fi

# Full development workflow
dev: clean fmt clippy test optimize check-size
	@echo "🎉 Development workflow completed!"

# Production deployment workflow
deploy-all: optimize deploy-neutron deploy-juno
	@echo "🎉 Deployed to all networks!"

# Full testing workflow
test-all: test test-neutron test-juno
	@echo "🎉 All tests completed!"

# Contract verification
verify:
	@if [ -f "./artifacts/fusion_plus_cosmos.wasm" ]; then \
		echo "🔍 Verifying contract..."; \
		cosmwasm-check ./artifacts/fusion_plus_cosmos.wasm; \
	else \
		echo "❌ Contract not built yet. Run 'make optimize' first."; \
	fi

# Show deployment info
info:
	@echo "📋 Deployment Information:"
	@if [ -f "deployment-neutron-testnet.json" ]; then \
		echo ""; \
		echo "Neutron Testnet:"; \
		echo "  Contract: $$(jq -r '.contract_address' deployment-neutron-testnet.json)"; \
		echo "  Code ID: $$(jq -r '.code_id' deployment-neutron-testnet.json)"; \
		echo "  Chain ID: $$(jq -r '.chain_id' deployment-neutron-testnet.json)"; \
	fi
	@if [ -f "deployment-juno-testnet.json" ]; then \
		echo ""; \
		echo "Juno Testnet:"; \
		echo "  Contract: $$(jq -r '.contract_address' deployment-juno-testnet.json)"; \
		echo "  Code ID: $$(jq -r '.code_id' deployment-juno-testnet.json)"; \
		echo "  Chain ID: $$(jq -r '.chain_id' deployment-juno-testnet.json)"; \
	fi
	@echo ""