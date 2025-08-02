#!/bin/bash

# Stop 1inch Cross-Chain Integration Services

set -e

echo "🛑 Stopping 1inch Cross-Chain Integration..."
echo "============================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to stop a service by PID file
stop_service() {
    local name=$1
    local pid_file="$name.pid"
    
    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file")
        if kill -0 $pid 2>/dev/null; then
            echo -e "${YELLOW}🛑 Stopping $name (PID: $pid)...${NC}"
            kill $pid
            
            # Wait for process to stop
            for i in {1..10}; do
                if ! kill -0 $pid 2>/dev/null; then
                    echo -e "${GREEN}✅ $name stopped successfully${NC}"
                    break
                fi
                sleep 1
            done
            
            # Force kill if still running
            if kill -0 $pid 2>/dev/null; then
                echo -e "${YELLOW}⚠️  Force killing $name...${NC}"
                kill -9 $pid 2>/dev/null || true
            fi
        else
            echo -e "${YELLOW}⚠️  $name was not running${NC}"
        fi
        rm -f "$pid_file"
    else
        echo -e "${YELLOW}⚠️  No PID file found for $name${NC}"
    fi
}

# Stop all services
stop_service "ui"
stop_service "api-gateway"

# Clean up any remaining processes on our ports
echo "🧹 Cleaning up processes on ports 3000-3001..."
for port in 3000 3001; do
    pid=$(lsof -ti:$port 2>/dev/null || true)
    if [ ! -z "$pid" ]; then
        echo -e "${YELLOW}🛑 Killing process on port $port (PID: $pid)${NC}"
        kill -9 $pid 2>/dev/null || true
    fi
done

# Clean up log files
echo "🧹 Cleaning up log files..."
rm -f *.log

echo ""
echo -e "${GREEN}✅ All services stopped successfully${NC}"
echo ""
echo "To restart the integration, run: ./start-cross-chain-integration.sh"