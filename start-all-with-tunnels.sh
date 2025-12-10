#!/bin/bash

echo "🎮 Bachelor Party QA Server & Tunnel Startup Script"
echo "=================================================="

# Kill any process on ports 3000 and 9001
echo "🔪 Checking for processes on port 3000..."
if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null ; then
    echo "⚠️  Port 3000 is in use. Killing existing process..."
    lsof -ti:3000 | xargs kill -9
    echo "✅ Port 3000 cleared"
else
    echo "✅ Port 3000 is free"
fi

echo "🔪 Checking for processes on port 9001..."
if lsof -Pi :9001 -sTCP:LISTEN -t >/dev/null ; then
    echo "⚠️  Port 9001 is in use. Killing existing process..."
    lsof -ti:9001 | xargs kill -9
    echo "✅ Port 9001 cleared"
else
    echo "✅ Port 9001 is free"
fi

# Kill any existing cloudflared tunnels
echo "🔪 Checking for existing cloudflared tunnels..."
pkill -f "cloudflared tunnel" 2>/dev/null && echo "✅ Killed existing tunnels" || echo "✅ No existing tunnels found"

echo ""
echo "🚀 Starting servers..."

# Start PeerJS server on port 9001
echo "📡 Starting PeerJS server on port 9001..."
node peer-server.cjs &
PEER_PID=$!
echo "PeerJS server PID: $PEER_PID"

# Wait a moment for PeerJS to start
sleep 2

# Start the dev server
echo "🌐 Starting development server..."
npm run dev &
DEV_PID=$!
echo "Dev server PID: $DEV_PID"

# Wait for dev server to start
sleep 3

echo ""
echo "🌍 Creating tunnels for public access..."

# Create tunnel for the app (port 3000)
echo "🚇 Creating tunnel for app..."
cloudflared tunnel --url http://localhost:3000 &
APP_TUNNEL_PID=$!

# Create tunnel for PeerJS (port 9001)
echo "🚇 Creating tunnel for PeerJS..."
cloudflared tunnel --url http://localhost:9001 &
PEER_TUNNEL_PID=$!

# Wait for tunnels to be ready
sleep 10

echo ""
echo "✅ Everything started successfully!"
echo "=================================================="
echo ""
echo "📍 LOCAL ACCESS:"
echo "   • Dev Server: http://localhost:3000"
echo "   • PeerJS Server: ws://localhost:9001/peerjs"
echo ""
echo "📍 REMOTE PLAYERS CAN CONNECT WITH:"
echo "   • Check the cloudflared output above for the public URLs"
echo "   • The URLs will look like: https://something.trycloudflare.com"
echo ""
echo "To stop everything, press Ctrl+C"
echo ""

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "🛑 Stopping all services..."
    kill $PEER_PID $DEV_PID $APP_TUNNEL_PID $PEER_TUNNEL_PID 2>/dev/null
    pkill -f "cloudflared tunnel" 2>/dev/null
    echo "✅ All stopped"
    exit 0
}

# Wait for Ctrl+C
trap cleanup INT

# Keep the script running
wait