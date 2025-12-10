#!/bin/bash

# Kill existing cloudflared processes
pkill -f "cloudflared tunnel" || echo "No existing cloudflared processes found"

# Wait a moment
sleep 2

# Start new tunnel
echo "Starting new Cloudflare tunnel..."
cloudflared tunnel --url http://localhost:3000
