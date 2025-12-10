const { PeerServer } = require('peer');
const express = require('express');
const cors = require('cors');
const http = require('http');

// Create Express app
const app = express();

// Enable CORS - allow all origins for tunnel access
app.use(cors({
  origin: '*',
  credentials: true
}));

// Create HTTP server
const server = http.createServer(app);

// Create PeerJS server
const peerServer = PeerServer({
  port: 9001,
  path: '/peerjs',
  allow_discovery: true,
  generateClientId: () => {
    return Math.random().toString(36).substring(2, 9);
  },
  proxied: true
});

peerServer.on('connection', (client) => {
  console.log(`🔗 Peer connected: ${client.id}`);
});

peerServer.on('disconnect', (client) => {
  console.log(`❌ Peer disconnected: ${client.id}`);
});

peerServer.on('error', (err) => {
  console.error('Peer server error:', err);
});

console.log('🚀 PeerJS server with CORS running on port 9001');