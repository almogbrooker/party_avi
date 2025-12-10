#!/bin/bash

# Cloudflared Tunnel Manager for Bachelor Party Game
# Manages tunnels for both app (port 3000) and PeerJS server (port 9001)

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
LOG_FILE="/tmp/cloudflared-tunnels.log"
URLS_FILE="PUBLIC_URLS.txt"
PID_FILE="/tmp/cloudflared-pids.txt"

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

print_url() {
    echo -e "${PURPLE}[URL]${NC} $1"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check if port is in use
is_port_in_use() {
    lsof -Pi :$1 -sTCP:LISTEN -t >/dev/null 2>&1
}

# Function to wait for port to be available
wait_for_port() {
    local port=$1
    local timeout=30
    local count=0

    print_status "Waiting for port $port to be ready..."

    while [ $count -lt $timeout ]; do
        if is_port_in_use $port; then
            print_success "Port $port is ready!"
            return 0
        fi
        sleep 1
        count=$((count + 1))
    done

    print_error "Timeout waiting for port $port"
    return 1
}

# Function to stop existing tunnels
stop_existing_tunnels() {
    print_status "Stopping any existing cloudflared tunnels..."

    # Kill any existing cloudflared processes
    pkill -f "cloudflared" 2>/dev/null || true

    # Kill processes using our ports
    lsof -ti:$APP_PORT | xargs kill -9 2>/dev/null || true
    lsof -ti:$PEERJS_PORT | xargs kill -9 2>/dev/null || true

    sleep 2
    print_success "Existing tunnels stopped"
}

# Function to install cloudflared if not present
install_cloudflared() {
    if ! command_exists cloudflared; then
        print_warning "cloudflared not found. Installing..."

        # Detect OS
        if [[ "$OSTYPE" == "darwin"* ]]; then
            # macOS
            if command_exists brew; then
                brew install cloudflared
            else
                print_error "Please install Homebrew first or install cloudflared manually"
                print_error "Visit: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/"
                exit 1
            fi
        elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
            # Linux
            wget -q https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
            sudo dpkg -i cloudflared-linux-amd64.deb
            rm cloudflared-linux-amd64.deb
        else
            print_error "Unsupported OS. Please install cloudflared manually"
            print_error "Visit: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/"
            exit 1
        fi

        print_success "cloudflared installed successfully"
    else
        print_success "cloudflared is already installed"
    fi
}

# Function to start a tunnel
start_tunnel() {
    local port=$1
    local service_name=$2
    local log_file=$3

    print_status "Starting cloudflared tunnel for $service_name (port $port)..."

    # Start cloudflared tunnel in background
    cloudflared tunnel --url localhost:$port > "$log_file" 2>&1 &
    local pid=$!

    echo "$pid" >> "$PID_FILE"

    # Wait for tunnel to initialize
    sleep 5

    # Extract URL from log
    local url=""
    for i in {1..20}; do
        url=$(grep -o "https://[^[:space:]]*\.trycloudflare\.com" "$log_file" | head -1)
        if [ -n "$url" ]; then
            break
        fi
        sleep 1
    done

    if [ -n "$url" ]; then
        print_success "$service_name tunnel ready: $url"
        echo "$url"
    else
        print_error "Failed to get URL for $service_name"
        print_error "Check log: $log_file"
        return 1
    fi
}

# Function to monitor and restart tunnels
monitor_tunnels() {
    local app_url=$1
    local peerjs_url=$2

    print_status "Starting tunnel monitoring..."

    while true; do
        sleep 30

        # Check if tunnels are still responding
        if ! curl -s --max-time 10 "$app_url" >/dev/null 2>&1; then
            print_warning "App tunnel seems unresponsive, checking..."
            if ! pgrep -f "cloudflared.*$APP_PORT" >/dev/null; then
                print_error "App tunnel died! Restarting..."
                start_tunnel $APP_PORT "App" "/tmp/app-tunnel.log"
            fi
        fi

        if ! curl -s --max-time 10 "$peerjs_url" >/dev/null 2>&1; then
            print_warning "PeerJS tunnel seems unresponsive, checking..."
            if ! pgrep -f "cloudflared.*$PEERJS_PORT" >/dev/null; then
                print_error "PeerJS tunnel died! Restarting..."
                start_tunnel $PEERJS_PORT "PeerJS" "/tmp/peerjs-tunnel.log"
            fi
        fi

        print_status "Tunnels monitored - all OK"
    done
}

# Function to display URLs prominently
display_urls() {
    local app_url=$1
    local peerjs_url=$2

    # Clear screen and display header
    clear

    echo -e "${CYAN}╔════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║                    🎮 BACHELOR PARTY GAME 🎮                   ║${NC}"
    echo -e "${CYAN}║                      Public URLs Ready!                      ║${NC}"
    echo -e "${CYAN}╚════════════════════════════════════════════════════════════════╝${NC}"
    echo ""

    echo -e "${GREEN}🌐 GAME APPLICATION URL:${NC}"
    echo -e "${YELLOW}   $app_url${NC}"
    echo ""

    echo -e "${GREEN}🔗 PEERJS SERVER URL:${NC}"
    echo -e "${YELLOW}   $peerjs_url${NC}"
    echo ""

    echo -e "${BLUE}📱 LOCAL URLs:${NC}"
    echo -e "   • App:      http://localhost:$APP_PORT/"
    echo -e "   • PeerJS:   http://localhost:$PEERJS_PORT/"
    echo ""

    echo -e "${PURPLE}💾 URLs saved to: $URLS_FILE${NC}"
    echo ""

    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""

    echo -e "${BLUE}📝 Instructions:${NC}"
    echo "1. Share the Game Application URL with players"
    echo "2. The PeerJS URL is used automatically by the game"
    echo "3. Keep this window open to maintain tunnels"
    echo "4. Press Ctrl+C to stop all tunnels"
    echo ""

    echo -e "${YELLOW}⚠️  Important:${NC}"
    echo "   • Tunnels will auto-restart if they fail"
    echo "   • URLs may change if you restart the script"
    echo "   • Check $LOG_FILE for detailed logs"
    echo ""
}

# Function to save URLs to file
save_urls() {
    local app_url=$1
    local peerjs_url=$2

    cat > "$URLS_FILE" << EOF
╔════════════════════════════════════════════════════════════════╗
║                    🎮 BACHELOR PARTY GAME 🎮                   ║
║                      Public URLs                               ║
╚════════════════════════════════════════════════════════════════╝

🌐 GAME APPLICATION URL:
$app_url

🔗 PEERJS SERVER URL:
$peerjs_url

📱 LOCAL URLs:
• App:      http://localhost:$APP_PORT/
• PeerJS:   http://localhost:$PEERJS_PORT/

Generated: $(date)
EOF

    print_success "URLs saved to $URLS_FILE"
}

# Function to cleanup on exit
cleanup() {
    echo ""
    print_status "Shutting down tunnels..."

    # Kill all cloudflared processes
    pkill -f "cloudflared" 2>/dev/null || true

    # Kill processes by PID if file exists
    if [ -f "$PID_FILE" ]; then
        while read -r pid; do
            kill $pid 2>/dev/null || true
        done < "$PID_FILE"
        rm -f "$PID_FILE"
    fi

    print_success "All tunnels stopped"
    exit 0
}

# Main execution
main() {
    echo -e "${CYAN}🚀 Starting Cloudflared Tunnel Manager for Bachelor Party Game${NC}"
    echo ""

    # Install cloudflared if needed
    install_cloudflared

    # Stop existing tunnels
    stop_existing_tunnels

    # Clean up PID file
    rm -f "$PID_FILE"

    # Start logging
    echo "=== Tunnel Session Started at $(date) ===" >> "$LOG_FILE"

    # Start development server
    print_status "Starting development server..."
    if ! command_exists npm; then
        print_error "npm not found. Please install Node.js"
        exit 1
    fi

    npm run dev > /tmp/dev-server.log 2>&1 &
    local dev_pid=$!
    echo "$dev_pid" >> "$PID_FILE"

    # Wait for app server
    if ! wait_for_port $APP_PORT; then
        print_error "Failed to start app server"
        print_error "Check /tmp/dev-server.log for details"
        cleanup
        exit 1
    fi

    # Note: PeerJS server should be started by the app automatically
    # Wait a bit for it to initialize
    print_status "Waiting for PeerJS server to initialize..."
    sleep 3

    # Start tunnels
    print_status "Starting cloudflared tunnels..."

    # Start app tunnel
    app_url=$(start_tunnel $APP_PORT "App" "/tmp/app-tunnel.log")
    if [ -z "$app_url" ]; then
        print_error "Failed to start app tunnel"
        cleanup
        exit 1
    fi

    # Start PeerJS tunnel
    peerjs_url=$(start_tunnel $PEERJS_PORT "PeerJS" "/tmp/peerjs-tunnel.log")
    if [ -z "$peerjs_url" ]; then
        print_error "Failed to start PeerJS tunnel"
        cleanup
        exit 1
    fi

    # Save URLs to file
    save_urls "$app_url" "$peerjs_url"

    # Display URLs prominently
    display_urls "$app_url" "$peerjs_url"

    # Set up cleanup trap
    trap cleanup INT TERM

    # Start monitoring in background
    monitor_tunnels "$app_url" "$peerjs_url" &
    local monitor_pid=$!
    echo "$monitor_pid" >> "$PID_FILE"

    # Keep script running
    print_success "All tunnels are running and monitored!"
    print_status "Press Ctrl+C to stop all tunnels"

    # Wait for monitoring process or user interrupt
    wait $monitor_pid
}

# Check if script is being sourced or executed
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi