#!/bin/bash

# Unified script to start the Bachelor Party Game with public tunnels
# This script starts:
# 1. The React development server (port 3000)
# 2. The PeerJS server (port 9001)
# 3. Public tunnels for both services using cloudflared

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Configuration
APP_PORT=3000
PEERJS_PORT=9001
LOG_FILE="/tmp/tunnels.log"
URLS_FILE="PUBLIC_URLS.txt"
PID_FILE="/tmp/game-pids.txt"

echo -e "${CYAN}🎮 Bachelor Party QA - Public Access Script${NC}"
echo -e "${CYAN}=============================================${NC}"
echo ""

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to kill processes on a port
kill_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        print_status "Killing process on port $port..."
        lsof -ti:$port | xargs kill -9 2>/dev/null || true
        sleep 1
    fi
}

# Function to wait for service to be ready
wait_for_service() {
    local port=$1
    local service_name=$2
    local timeout=30
    local count=0

    print_status "Waiting for $service_name to be ready on port $port..."

    while [ $count -lt $timeout ]; do
        if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
            print_success "$service_name is ready!"
            return 0
        fi
        sleep 1
        count=$((count + 1))
    done

    print_error "Timeout waiting for $service_name"
    return 1
}

# Function to extract clean URL from cloudflared output
extract_url() {
    local log_file=$1
    local url=""

    for i in {1..30}; do
        url=$(grep -o "https://[^[:space:]]*\.trycloudflare\.com" "$log_file" 2>/dev/null | head -1)
        if [ -n "$url" ]; then
            echo "$url"
            return 0
        fi
        sleep 1
    done

    return 1
}

# Function to update PeerJS URL in the app
update_peerjs_url() {
    local peerjs_url=$1
    local peerjs_ws_url="wss://${peerjs_url#https://}/peerjs"

    # Create/update environment file
    cat > .env.local << EOF
REACT_APP_PEERJS_HOST=${peerjs_url#https://}
REACT_APP_PEERJS_PORT=443
REACT_APP_PEERJS_PATH=/peerjs
REACT_APP_PEERJS_SECURE=true
EOF

    print_success "Updated PeerJS configuration for public access"
}

# Cleanup function
cleanup() {
    echo ""
    print_status "Cleaning up..."

    # Kill all processes
    if [ -f "$PID_FILE" ]; then
        while read -r pid 2>/dev/null; do
            kill $pid 2>/dev/null || true
        done < "$PID_FILE"
        rm -f "$PID_FILE"
    fi

    # Kill any remaining cloudflared processes
    pkill -f "cloudflared tunnel" 2>/dev/null || true

    # Kill processes on our ports
    kill_port $APP_PORT
    kill_port $PEERJS_PORT

    print_success "Cleanup complete"
    exit 0
}

# Set up trap for cleanup
trap cleanup INT TERM EXIT

# Clear PID file
> "$PID_FILE"

# Check dependencies
print_status "Checking dependencies..."

if ! command_exists node; then
    print_error "Node.js is not installed"
    exit 1
fi

if ! command_exists npm; then
    print_error "npm is not installed"
    exit 1
fi

if ! command_exists cloudflared; then
    print_error "cloudflared is not installed"
    echo "Please install it from: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/"
    exit 1
fi

# Kill any existing processes
print_status "Cleaning up existing processes..."
kill_port $APP_PORT
kill_port $PEERJS_PORT
pkill -f "cloudflared tunnel" 2>/dev/null || true

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    print_status "Installing dependencies..."
    npm install
fi

# Start PeerJS server
print_status "Starting PeerJS server on port $PEERJS_PORT..."
node peer-server.cjs > /tmp/peerjs.log 2>&1 &
PEERJS_PID=$!
echo $PEERJS_PID >> "$PID_FILE"
print_success "PeerJS server started (PID: $PEERJS_PID)"

# Wait for PeerJS to be ready
if ! wait_for_service $PEERJS_PORT "PeerJS server"; then
    print_error "Failed to start PeerJS server"
    print_error "Check /tmp/peerjs.log for details"
    exit 1
fi

# Start React development server
print_status "Starting React development server on port $APP_PORT..."
npm run dev > /tmp/app.log 2>&1 &
APP_PID=$!
echo $APP_PID >> "$PID_FILE"
print_success "React app started (PID: $APP_PID)"

# Wait for app to be ready
if ! wait_for_service $APP_PORT "React app"; then
    print_error "Failed to start React app"
    print_error "Check /tmp/app.log for details"
    exit 1
fi

# Start cloudflared tunnels
print_status "Starting cloudflared tunnels..."

# Tunnel for the app
print_status "Creating tunnel for React app..."
cloudflared tunnel --url http://localhost:$APP_PORT > /tmp/app-tunnel.log 2>&1 &
APP_TUNNEL_PID=$!
echo $APP_TUNNEL_PID >> "$PID_FILE"

# Tunnel for PeerJS
print_status "Creating tunnel for PeerJS server..."
cloudflared tunnel --url http://localhost:$PEERJS_PORT > /tmp/peerjs-tunnel.log 2>&1 &
PEER_TUNNEL_PID=$!
echo $PEER_TUNNEL_PID >> "$PID_FILE"

# Wait for tunnels and extract URLs
print_status "Waiting for tunnel URLs..."
APP_URL=$(extract_url /tmp/app-tunnel.log)
PEERJS_URL=$(extract_url /tmp/peerjs-tunnel.log)

if [ -z "$APP_URL" ] || [ -z "$PEERJS_URL" ]; then
    print_error "Failed to obtain tunnel URLs"
    print_error "Check tunnel logs:"
    print_error "  App: /tmp/app-tunnel.log"
    print_error "  PeerJS: /tmp/peerjs-tunnel.log"
    exit 1
fi

# Update PeerJS configuration for public access
update_peerjs_url "$PEERJS_URL"

# Save URLs to file
cat > "$URLS_FILE" << EOF
╔════════════════════════════════════════════════════════════════╗
║                    🎮 BACHELOR PARTY GAME 🎮                   ║
║                      Public URLs                               ║
╚════════════════════════════════════════════════════════════════╝

🌐 GAME APPLICATION URL (Share this with players):
$APP_URL

🔗 PEERJS SERVER URL (Used automatically by the game):
$PEERJS_URL

📱 LOCAL URLs (For you):
• App:      http://localhost:$APP_PORT/
• PeerJS:   http://localhost:$PEERJS_PORT/

Generated: $(date)

Instructions:
1. Share the Game Application URL with all players
2. Players can join using that URL from any device
3. Keep this terminal window open to maintain public access
4. Press Ctrl+C to stop all services
EOF

# Display success message
clear
echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                    ✅ ALL SERVICES READY ✅                     ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${CYAN}🎮 Your Bachelor Party Game is now LIVE and PUBLIC!${NC}"
echo ""
echo -e "${GREEN}📱 Share this URL with players:${NC}"
echo -e "${YELLOW}   $APP_URL${NC}"
echo ""
echo -e "${GREEN}🔗 PeerJS Server URL:${NC}"
echo -e "${YELLOW}   $PEERJS_URL${NC}"
echo ""
echo -e "${BLUE}📊 Services Status:${NC}"
echo -e "   • React App:     Running on port $APP_PORT ✓"
echo -e "   • PeerJS Server: Running on port $PEERJS_PORT ✓"
echo -e "   • App Tunnel:    $APP_URL ✓"
echo -e "   • PeerJS Tunnel: $PEERJS_URL ✓"
echo ""
echo -e "${PURPLE}💾 URLs saved to: $URLS_FILE${NC}"
echo ""
echo -e "${YELLOW}⚠️  Important:${NC}"
echo "   • Keep this window open to maintain public access"
echo "   • URLs may change if you restart this script"
echo "   • Players can join from anywhere with the app URL"
echo ""
echo -e "${RED}• Press Ctrl+C to stop all services${NC}"
echo ""

# Keep script running and monitor services
print_status "Monitoring services... Press Ctrl+C to stop"

while true; do
    sleep 10

    # Check if services are still running
    if ! kill -0 $APP_PID 2>/dev/null; then
        print_error "React app has stopped!"
        break
    fi

    if ! kill -0 $PEERJS_PID 2>/dev/null; then
        print_error "PeerJS server has stopped!"
        break
    fi

    if ! kill -0 $APP_TUNNEL_PID 2>/dev/null; then
        print_error "App tunnel has stopped!"
        break
    fi

    if ! kill -0 $PEER_TUNNEL_PID 2>/dev/null; then
        print_error "PeerJS tunnel has stopped!"
        break
    fi
done