#!/bin/bash

# Bachelor Party Game Launcher
# This script starts everything needed to run the game online
#
# Usage:
#   ./start-game.sh        # Starts the game with a random ngrok URL
#
# The game will be available at a ngrok.io URL with no password required

# Parse command line arguments
SUBDOMAIN=""
if [ "$1" != "" ]; then
    SUBDOMAIN="$1"
fi

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

# Check if localtunnel is installed
if ! command_exists lt && ! npm list -g localtunnel >/dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  localtunnel not found. Installing...${NC}"
    npm install -g localtunnel
fi

# Stop any existing processes
echo -e "${YELLOW}🛑 Stopping any existing processes...${NC}"
pkill -f "npm run dev" 2>/dev/null || true
pkill -f "ngrok" 2>/dev/null || true
pkill -f "localtunnel" 2>/dev/null || true
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
if ! curl -s http://localhost:3000 >/dev/null; then
    echo -e "${RED}❌ Failed to start the server. Check for errors above.${NC}"
    kill $DEV_PID 2>/dev/null
    exit 1
fi

# Determine subdomain
DEFAULT_SUBDOMAIN="bachelor-party-game-$(date +%H%M%S)"
if [ "$SUBDOMAIN" != "" ]; then
    DEFAULT_SUBDOMAIN="$SUBDOMAIN"
fi

# Start localtunnel
echo -e "${GREEN}🌐 Creating public URL...${NC}"
lt --port 3000 --subdomain "$DEFAULT_SUBDOMAIN" 2>/dev/null &
TUNNEL_PID=$!

# Wait for tunnel to be ready
echo -e "${BLUE}⏳ Waiting for tunnel to initialize...${NC}"
sleep 8

# Get the tunnel URL (localtunnel provides predictable URL)
TUNNEL_URL="https://$DEFAULT_SUBDOMAIN.loca.lt"

# Try to get the actual URL if the custom subdomain is taken
if ! curl -s "$TUNNEL_URL" >/dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  Custom subdomain taken, getting random URL...${NC}"
    # If custom subdomain fails, use random URL
    # Capture the output to get the URL
    LT_OUTPUT=$(timeout 10s lt --port 3000 2>&1)
    TUNNEL_PID=$!
    sleep 5
    # Extract URL from output
    TUNNEL_URL=$(echo "$LT_OUTPUT" | grep -o "https://[^ ]*\.loca\.lt" | head -1)
    if [ -z "$TUNNEL_URL" ]; then
        # Fallback: any https URL from output
        TUNNEL_URL=$(echo "$LT_OUTPUT" | grep -o "https://[^ ]*" | head -1)
    fi
fi

# Get the password for localtunnel
PASSWORD=$(curl -s https://loca.lt/mytunnelpassword 2>/dev/null || echo "")

# Display success message
echo ""
echo -e "${GREEN}✅ SUCCESS! Your game is now online!${NC}"
echo ""
echo -e "${BLUE}🌐 Public URL:${NC} ${YELLOW}$TUNNEL_URL${NC}"
if [ -n "$PASSWORD" ]; then
    echo -e "${BLUE}🔐 Password:${NC} ${YELLOW}$PASSWORD${NC}"
fi
echo ""
echo -e "${BLUE}📱 Local URLs:${NC}"
echo "   • Local:      http://localhost:3000/"
echo "   • Network:    http://192.168.105.1:3000/"
echo ""
echo -e "${GREEN}Share this URL with your friends:${NC}"
echo -e "${YELLOW}$TUNNEL_URL${NC}"
if [ -n "$PASSWORD" ]; then
    echo -e "${YELLOW}Password: $PASSWORD${NC}"
fi
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
echo "2. They will need to enter the password shown above"
echo "3. The password is your public IP address"
echo "4. This keeps the tunnel secure from abuse"
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
    if ! curl -s http://localhost:3000 >/dev/null; then
        echo -e "${RED}❌ Server stopped unexpectedly${NC}"
        break
    fi
    echo -e "${GREEN}✅ Game still running at $TUNNEL_URL${NC}"
done

# Cleanup if loop breaks
cleanup