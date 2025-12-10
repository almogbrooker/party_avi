#!/bin/bash

echo "🎮 Bachelor Party QA Server Startup Script"
echo "=========================================="

# Kill any process using port 3000
echo "🔪 Checking for processes on port 3000..."
if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null ; then
    echo "⚠️  Port 3000 is in use. Killing existing process..."
    lsof -ti:3000 | xargs kill -9
    echo "✅ Port 3000 cleared"
else
    echo "✅ Port 3000 is free"
fi

# Kill any process using port 9001 (PeerJS)
echo "🔪 Checking for processes on port 9001..."
if lsof -Pi :9001 -sTCP:LISTEN -t >/dev/null ; then
    echo "⚠️  Port 9001 is in use. Killing existing process..."
    lsof -ti:9001 | xargs kill -9
    echo "✅ Port 9001 cleared"
else
    echo "✅ Port 9001 is free"
fi

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

echo ""
echo "✅ Servers started successfully!"
echo "=========================================="
echo "📍 Local Dev Server: http://localhost:3000"
echo "📍 PeerJS Server: ws://localhost:9001/peerjs"
echo ""
echo "To stop servers, run: kill $PEER_PID $DEV_PID"
echo "Or press Ctrl+C to stop this script and all servers"
echo ""

# Wait for Ctrl+C
trap 'echo ""; echo "🛑 Stopping servers..."; kill $PEER_PID $DEV_PID; exit' INT

# Keep the script running
wait