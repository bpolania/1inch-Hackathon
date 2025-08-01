#!/bin/bash

# 1inch Cross-Chain Integration Startup Script
# Starts all services for complete ETH ↔ NEAR ↔ BTC cross-chain execution

set -e

echo "🚀 Starting 1inch Cross-Chain Integration..."
echo "================================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed. Please install Node.js 18+ and try again.${NC}"
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo -e "${RED}❌ Node.js version 18+ is required. Current version: $(node --version)${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Node.js $(node --version) detected${NC}"

# Function to check if port is available
check_port() {
    local port=$1
    if lsof -i:$port &> /dev/null; then
        echo -e "${YELLOW}⚠️  Port $port is already in use${NC}"
        return 1
    fi
    return 0
}

# Function to install dependencies if needed
install_dependencies() {
    local dir=$1
    local name=$2
    
    if [ ! -d "$dir/node_modules" ]; then
        echo -e "${YELLOW}📦 Installing dependencies for $name...${NC}"
        cd "$dir" && npm install && cd - > /dev/null
        echo -e "${GREEN}✅ Dependencies installed for $name${NC}"
    else
        echo -e "${GREEN}✅ Dependencies already installed for $name${NC}"
    fi
}

# Check required ports
echo "🔍 Checking port availability..."
PORTS=(3000 3001)
for port in "${PORTS[@]}"; do
    if ! check_port $port; then
        echo -e "${RED}❌ Port $port is required but already in use. Please free this port and try again.${NC}"
        exit 1
    fi
done
echo -e "${GREEN}✅ All required ports are available${NC}"

# Install dependencies for all services
echo "📦 Setting up dependencies..."

install_dependencies "./ui" "UI (Next.js)"
install_dependencies "./relayer-services/api-gateway" "API Gateway"

# Check if .env files exist and create from examples if needed
echo "⚙️  Setting up environment configuration..."

if [ ! -f "./ui/.env.local" ]; then
    echo "NEXT_PUBLIC_API_GATEWAY_URL=http://localhost:3001" > ./ui/.env.local
    echo -e "${GREEN}✅ Created UI environment configuration${NC}"
fi

if [ ! -f "./relayer-services/api-gateway/.env" ]; then
    if [ -f "./relayer-services/api-gateway/.env.example" ]; then
        cp "./relayer-services/api-gateway/.env.example" "./relayer-services/api-gateway/.env"
        echo -e "${YELLOW}⚠️  Created API Gateway .env from example. Please configure with your keys.${NC}"
    fi
fi

# Build the API Gateway
echo "🔨 Building API Gateway..."
cd "./relayer-services/api-gateway"
npm run build
cd - > /dev/null
echo -e "${GREEN}✅ API Gateway built successfully${NC}"

# Start services
echo "🚀 Starting services..."

# Function to start a service in background
start_service() {
    local dir=$1
    local name=$2
    local command=$3
    local port=$4
    local log_file="$name.log"
    
    echo -e "${YELLOW}📡 Starting $name on port $port...${NC}"
    cd "$dir"
    nohup $command > "../$log_file" 2>&1 &
    local pid=$!
    cd - > /dev/null
    
    # Wait a moment and check if process is still running
    sleep 2
    if kill -0 $pid 2>/dev/null; then
        echo -e "${GREEN}✅ $name started successfully (PID: $pid)${NC}"
        echo "$pid" > "$name.pid"
        return 0
    else
        echo -e "${RED}❌ Failed to start $name${NC}"
        return 1
    fi
}

# Start API Gateway
if start_service "./relayer-services/api-gateway" "api-gateway" "npm start" "3001"; then
    API_GATEWAY_STARTED=true
else
    echo -e "${RED}❌ Failed to start API Gateway${NC}"
    exit 1
fi

# Wait for API Gateway to be ready
echo "⏳ Waiting for API Gateway to be ready..."
for i in {1..30}; do
    if curl -s http://localhost:3001/api/health > /dev/null 2>&1; then
        echo -e "${GREEN}✅ API Gateway is ready${NC}"
        break
    fi
    if [ $i -eq 30 ]; then
        echo -e "${RED}❌ API Gateway did not become ready in time${NC}"
        exit 1
    fi
    sleep 1
done

# Start UI
if start_service "./ui" "ui" "npm run dev" "3000"; then
    UI_STARTED=true
else
    echo -e "${RED}❌ Failed to start UI${NC}"
    exit 1
fi

# Wait for UI to be ready
echo "⏳ Waiting for UI to be ready..."
for i in {1..60}; do
    if curl -s http://localhost:3000 > /dev/null 2>&1; then
        echo -e "${GREEN}✅ UI is ready${NC}"
        break
    fi
    if [ $i -eq 60 ]; then
        echo -e "${RED}❌ UI did not become ready in time${NC}"
        exit 1
    fi
    sleep 1
done

# Display success message
echo ""
echo "🎉 1inch Cross-Chain Integration is now running!"
echo "================================================"
echo ""
echo -e "${GREEN}🌐 UI:                http://localhost:3000${NC}"
echo -e "${GREEN}🔗 API Gateway:       http://localhost:3001${NC}"
echo -e "${GREEN}📊 Health Check:      http://localhost:3001/api/health${NC}"
echo -e "${GREEN}📡 WebSocket:         ws://localhost:3001/ws${NC}"
echo ""
echo "🛡️ TEE Solver Integration:"
echo "   • Autonomous execution with Chain Signatures"
echo "   • Bitcoin integration via NEAR MPC"
echo "   • TEE attestation verification"
echo ""
echo "🔄 Relayer Service Integration:"
echo "   • Cross-chain ETH ↔ NEAR ↔ BTC execution"
echo "   • Real-time profitability analysis"
echo "   • Bitcoin HTLC creation and monitoring"
echo ""
echo "📡 API Endpoints:"
echo "   • TEE:        http://localhost:3001/api/tee"
echo "   • Relayer:    http://localhost:3001/api/relayer"
echo "   • 1inch:      http://localhost:3001/api/1inch"
echo ""
echo -e "${YELLOW}📝 Log files:${NC}"
echo "   • API Gateway: api-gateway.log"
echo "   • UI:          ui.log"
echo ""
echo -e "${YELLOW}⚠️  Note: Configure your .env files with real keys for production use${NC}"
echo ""
echo "🛑 To stop all services, run: ./stop-cross-chain-integration.sh"

# Keep script running and monitor services
trap 'echo -e "\n${YELLOW}🛑 Shutting down services...${NC}"; ./stop-cross-chain-integration.sh; exit 0' INT

echo ""
echo "Press Ctrl+C to stop all services..."
while true; do
    sleep 1
done