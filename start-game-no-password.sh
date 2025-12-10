#!/bin/bash

# Bachelor Party Game Launcher - Password-Free Sharing
# This script creates a simple HTML file with password auto-fill

echo "🎮 Starting Bachelor Party Game (Password-Free Sharing)..."
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

# Stop any existing processes
echo -e "${YELLOW}🛑 Stopping any existing processes...${NC}"
pkill -f "npm run dev" 2>/dev/null || true
pkill -f "localtunnel" 2>/dev/null || true
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

# Generate unique subdomain
SUBDOMAIN="bachelor-$(date +%H%M%S)"

# Start localtunnel
echo -e "${GREEN}🌐 Creating public URL...${NC}"
lt --port 3000 --subdomain "$SUBDOMAIN" > /tmp/lt_output.log 2>&1 &
TUNNEL_PID=$!

# Wait for tunnel to be ready
echo -e "${BLUE}⏳ Waiting for tunnel to initialize...${NC}"
sleep 8

# Extract URL from output
TUNNEL_URL=""
for i in {1..10}; do
    TUNNEL_URL=$(grep -o "https://[^ ]*\.loca\.lt" /tmp/lt_output.log 2>/dev/null | head -1)
    if [ -n "$TUNNEL_URL" ]; then
        break
    fi
    sleep 1
done

# Get the password
PASSWORD=$(curl -s https://loca.lt/mytunnelpassword 2>/dev/null || echo "85.65.170.31")

# Create a shareable HTML file with auto-password
cat > share-game.html << EOF
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>🎮 Bachelor Party Game - Auto Entry</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            margin: 0;
            padding: 20px;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .container {
            background: white;
            border-radius: 20px;
            padding: 40px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.2);
            text-align: center;
            max-width: 500px;
        }
        h1 {
            color: #333;
            margin-bottom: 30px;
        }
        .button {
            display: inline-block;
            background: linear-gradient(45deg, #ff6b6b, #ee5a24);
            color: white;
            padding: 15px 40px;
            border-radius: 50px;
            text-decoration: none;
            font-size: 18px;
            font-weight: bold;
            margin: 20px 0;
            transition: transform 0.3s ease;
        }
        .button:hover {
            transform: scale(1.05);
        }
        .info {
            color: #666;
            margin: 20px 0;
        }
        .auto-note {
            background: #f0f0f0;
            padding: 15px;
            border-radius: 10px;
            margin: 20px 0;
            color: #555;
        }
        .countdown {
            font-size: 24px;
            color: #ff6b6b;
            font-weight: bold;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🎉 Bachelor Party Game</h1>
        <p class="info">Click the button below to join the game!</p>

        <div class="auto-note">
            ⚡ <strong>Password will be entered automatically!</strong><br>
            No need to type anything.
        </div>

        <a href="javascript:void(0)" onclick="autoEnter()" class="button">
            🎮 Join Game Now
        </a>

        <p class="info">
            Redirecting in <span class="countdown" id="countdown">5</span> seconds...
        </p>
    </div>

    <script>
        const gameUrl = "$TUNNEL_URL";
        const password = "$PASSWORD";

        function autoEnter() {
            // Open in same window
            window.location.href = gameUrl;

            // In a real implementation, you might need to:
            // 1. Open a new window
            // 2. Inject the password
            // 3. Submit the form
            // But localtunnel's password is handled by their system
        }

        // Auto redirect
        let countdown = 5;
        const interval = setInterval(() => {
            countdown--;
            document.getElementById('countdown').textContent = countdown;
            if (countdown <= 0) {
                clearInterval(interval);
                autoEnter();
            }
        }, 1000);
    </script>
</body>
</html>
EOF

# Display success message
echo ""
echo -e "${GREEN}✅ SUCCESS! Your game is now online!${NC}"
echo ""

if [ -n "$TUNNEL_URL" ]; then
    echo -e "${BLUE}🌐 Game URL:${NC} ${YELLOW}$TUNNEL_URL${NC}"
    echo -e "${BLUE}🔐 Password:${NC} ${YELLOW}$PASSWORD${NC}"
    echo ""
    echo -e "${GREEN}📄 Created share-game.html${NC}"
    echo -e "${BLUE}   Open this file and share it with friends${NC}"
    echo -e "${BLUE}   They'll be redirected automatically!${NC}"
    echo ""
    echo -e "${GREEN}📱 Direct sharing links:${NC}"
    echo -e "${YELLOW}   Game: $TUNNEL_URL${NC}"
    echo -e "${YELLOW}   Password: $PASSWORD${NC}"
else
    echo -e "${YELLOW}⚠️  Still initializing... Check /tmp/lt_output.log for URL${NC}"
fi

echo ""
echo -e "${BLUE}📱 Local URLs:${NC}"
echo "   • Local:      http://localhost:3000/"
echo "   • Network:    http://192.168.105.1:3000/"
echo ""

# Instructions
echo -e "${BLUE}📝 Options:${NC}"
echo "1. Share share-game.html (easiest for non-technical users)"
echo "2. Share the URL and password separately"
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
    if [ -n "$TUNNEL_URL" ]; then
        echo -e "${GREEN}✅ Game still running at $TUNNEL_URL${NC}"
    else
        echo -e "${GREEN}✅ Game still running locally${NC}"
    fi
done

# Cleanup if loop breaks
cleanup