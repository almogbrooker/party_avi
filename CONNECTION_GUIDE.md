# Connection Guide

## Local Development
- App URL: http://localhost:3000
- PeerJS Server: ws://localhost:9001/peerjs

## Public URLs (for remote players)
- Main App: https://oxford-proved-whale-pond.trycloudflare.com
- PeerJS Server: https://kitty-conditioning-qualifying-privacy.trycloudflare.com/peerjs

## How it works
1. **Host** creates game locally at http://localhost:3000
2. **Host** gets share links with the public tunnel URL
3. **Remote players** (including groom) connect through the public tunnel
4. **All connections** go through the same PeerJS server tunnel

## Important Notes
- The PeerJS tunnel must be running for remote connections
- Both tunnels (app and PeerJS) need to be active
- Refresh the page if connection fails

## Testing Remote Connection
1. Share this URL: https://oxford-proved-whale-pond.trycloudflare.com?code=XXXX
2. Add &role=groom for the groom
3. The app will automatically detect it's running through tunnel
4. Will use the tunneled PeerJS server for connections