import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        allowedHosts: ['trycloudflare.com', '.trycloudflare.com', '.loca.lt'],
        // Ensure WebSocket support for PeerJS
        ws: true,
        // Add proper headers for WebRTC
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, Content-Length, X-Requested-With'
        }
      },
      preview: {
        port: 4173,
        host: '0.0.0.0',
        allowedHosts: ['bachelor-party-game.fly.dev', 'fly.dev', '.fly.dev'] // Allow Fly.io hosts
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      // Ensure env vars are available to the client
      envPrefix: 'VITE_',
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
