#!/bin/bash

# Bachelor Party Game Launcher
# This script starts everything needed to run the game online

echo "🎮 Starting Bachelor Party Game..."
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check if npm is installed
if ! command_exists npm; then
    echo -e "${RED}❌ Error: npm is not installed. Please install Node.js first.${NC}"
    echo "Visit: https://nodejs.org/"
    exit 1
fi

# Check if cloudflared is installed
if ! command_exists cloudflared; then
    echo -e "${YELLOW}⚠️  cloudflared not found. Installing...${NC}"
    npm install -g cloudflared
fi

# Stop any existing processes
echo -e "${YELLOW}🛑 Stopping any existing processes...${NC}"
pkill -f "npm run dev" 2>/dev/null || true
pkill -f "cloudflared tunnel" 2>/dev/null || true
sleep 2

# Start the development server
echo -e "${GREEN}🚀 Starting the game server...${NC}"
npm run dev &
DEV_PID=$!
sleep 5

# Wait for server to be ready
echo -e "${BLUE}⏳ Waiting for server to start...${NC}"
sleep 3

# Check if server is running
if ! curl -s http://localhost:5173 >/dev/null; then
    echo -e "${RED}❌ Failed to start the server. Check for errors above.${NC}"
    kill $DEV_PID 2>/dev/null
    exit 1
fi

# Start Cloudflare tunnel
echo -e "${GREEN}☁️  Creating public URL...${NC}"
cloudflared tunnel --url http://localhost:5173 &
TUNNEL_PID=$!

# Wait for tunnel to be ready
echo -e "${BLUE}⏳ Waiting for tunnel to initialize...${NC}"
sleep 10

# Get the tunnel URL
TUNNEL_URL=$(cloudflared tunnel --url http://localhost:5173 2>&1 | grep "https://" | head -1 | grep -o "https://[^ ]*")

if [ -z "$TUNNEL_URL" ]; then
    echo -e "${YELLOW}⏳ Still initializing tunnel...${NC}"
    sleep 5
    TUNNEL_URL=$(cloudflared tunnel --url http://localhost:5173 2>&1 | grep "https://" | head -1 | grep -o "https://[^ ]*")
fi

# Display success message
echo ""
echo -e "${GREEN}✅ SUCCESS! Your game is now online!${NC}"
echo ""
echo -e "${BLUE}🌐 Public URL:${NC} ${YELLOW}$TUNNEL_URL${NC}"
echo ""
echo -e "${BLUE}📱 Local URLs:${NC}"
echo "   • Local:      http://localhost:5173/"
echo "   • Network:    http://192.168.105.1:5173/"
echo ""
echo -e "${GREEN}Share this URL with your friends:${NC}"
echo -e "${YELLOW}$TUNNEL_URL${NC}"
echo ""

# Create a QR code if qrencode is available
if command_exists qrencode; then
    echo -e "${BLUE}📱 Creating QR code...${NC}"
    echo "$TUNNEL_URL" | qrencode -o game-qr.png
    echo -e "${GREEN}QR code saved as game-qr.png${NC}"
fi

# Instructions
echo -e "${BLUE}📝 Instructions:${NC}"
echo "1. Share the URL above with your friends"
echo "2. They can open it on any device"
echo "3. No password needed!"
echo ""
echo -e "${YELLOW}⚠️  Keep this terminal window open${NC}"
echo -e "${YELLOW}   The game stops if you close it${NC}"
echo ""

# Function to cleanup on exit
cleanup() {
    echo ""
    echo -e "${YELLOW}🛑 Shutting down...${NC}"
    kill $DEV_PID 2>/dev/null
    kill $TUNNEL_PID 2>/dev/null
    echo -e "${GREEN}✅ All processes stopped${NC}"
    exit 0
}

# Trap Ctrl+C
trap cleanup INT

# Keep script running
echo -e "${GREEN}🎮 Game is running! Press Ctrl+C to stop.${NC}"
echo ""

# Show status every 30 seconds
while true; do
    sleep 30
    if ! curl -s http://localhost:5173 >/dev/null; then
        echo -e "${RED}❌ Server stopped unexpectedly${NC}"
        break
    fi
    echo -e "${GREEN}✅ Game still running at $TUNNEL_URL${NC}"
done

# Cleanup if loop breaks
cleanup