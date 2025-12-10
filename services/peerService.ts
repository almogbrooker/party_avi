import { NetworkMessage } from "../types";

// We use a global variable or singleton pattern for simplicity in this context
// to persist the peer connection across React renders without complex Context.

let peerInstance: any = null;
let connections: any[] = [];
let onMessageCallback: ((msg: NetworkMessage, conn: any) => void) | null = null;

// Reusable ICE servers with a public TURN to help mobile/cellular networks connect
const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
  { urls: 'stun:stun.stunprotocol.org:3478' },
  { urls: 'stun:stun.voxgratia.org:3478' },
  // Public TURN service (best-effort, but better than STUN-only on 4G)
  { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
  { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
  { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' }
];

// Determine if we're running locally or through tunnel
const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

// Configure PeerJS based on environment
const getPeerJSConfig = () => {
  if (isLocalhost) {
    // Local development
    return {
      debug: 3,
      host: 'localhost',
      port: 9001,
      secure: false,
      path: '/peerjs',
      pingInterval: 5000,
      keepAlive: true,
      config: {
        iceServers: ICE_SERVERS,
        sdpSemantics: 'unified-plan'
      }
    };
  } else {
    // Remote/tunnel access - use our tunneled PeerJS server
    return {
      debug: 3,
      host: 'kitty-conditioning-qualifying-privacy.trycloudflare.com',
      port: 443,
      secure: true,
      path: '/peerjs',
      pingInterval: 5000,
      keepAlive: true,
      config: {
        iceServers: ICE_SERVERS,
        sdpSemantics: 'unified-plan'
      }
    };
  }
};

const BASE_PEER_OPTIONS = getPeerJSConfig();

console.log('🔌 PeerJS config:', {
  isLocalhost,
  hostname: window.location.hostname,
  host: BASE_PEER_OPTIONS.host,
  port: BASE_PEER_OPTIONS.port,
  secure: BASE_PEER_OPTIONS.secure,
  url: `${BASE_PEER_OPTIONS.secure ? 'wss' : 'ws'}://${BASE_PEER_OPTIONS.host}:${BASE_PEER_OPTIONS.port}/${BASE_PEER_OPTIONS.path}`
});

export const initializePeer = async (id?: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    // @ts-ignore - PeerJS is loaded via script tag
    const Peer = (window as any).Peer;

    if (!Peer) {
      reject(new Error("PeerJS not loaded"));
      return;
    }

    console.log('🚀 Initializing PeerJS with ID:', id || '[auto-generated]');

    // Create a new ID if not provided (Host), or use provided ID
    const newPeer = new Peer(id, BASE_PEER_OPTIONS);
    let settled = false;
    const openTimeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      try { newPeer.destroy(); } catch (e) { console.error('Failed to destroy timed-out host peer', e); }
      reject(new Error('PeerJS initialization timed out. Make sure the PeerJS server is running on port 9001.'));
    }, 25000); // Increased to 25 seconds

    newPeer.on('open', (peerId: string) => {
      console.log('My peer ID is: ' + peerId);
      peerInstance = newPeer;
      if (settled) return;
      settled = true;
      clearTimeout(openTimeout);
      resolve(peerId);
    });

    newPeer.on('connection', (conn: any) => {
      connections.push(conn);
      setupConnection(conn);
    });

    newPeer.on('error', (err: any) => {
      console.error('Peer error:', err);
      if (settled) return;
      settled = true;
      clearTimeout(openTimeout);
      reject(err);
    });
  });
};

export const connectToHost = (hostId: string, metadata: any): Promise<any> => {
  return new Promise((resolve, reject) => {
    if (!peerInstance) {
      // Initialize a peer for the client first
      // @ts-ignore
      const Peer = (window as any).Peer;
      if (!Peer) {
          reject(new Error("PeerJS not loaded"));
          return;
      }

      let peerSettled = false;
      peerInstance = new Peer(BASE_PEER_OPTIONS);
      const peerOpenTimeout = setTimeout(() => {
        if (peerSettled) return;
        peerSettled = true;
        try { peerInstance.destroy(); } catch (e) { console.error('Failed to destroy timed-out client peer', e); }
        reject(new Error('פיתוח PeerJS נכשל. ודא שהשרת פועל ונסה שוב.'));
      }, 20000); // Increased to 20 seconds

      peerInstance.on('open', () => {
        console.log('Client peer opened, connecting to host:', hostId);
        if (peerSettled) return;
        peerSettled = true;
        clearTimeout(peerOpenTimeout);
        connect(hostId);
      });

      peerInstance.on('error', (err: any) => {
        console.error('Peer connection error:', err);
        if (peerSettled) return;
        peerSettled = true;
        clearTimeout(peerOpenTimeout);
        reject(err);
      });
    } else {
      connect(hostId);
    }

    function connect(destId: string) {
      console.log('Attempting to connect to host:', destId);
      const conn = peerInstance.connect(destId, {
        metadata,
        // Add connection options for better reliability
        reliable: true,
        serialization: 'json',
        label: 'game-connection'
      });

      const connTimeout = setTimeout(() => {
        if (!conn.open) {
          console.error('⏰ Connection timeout to host:', destId);
          try { conn.close(); } catch (e) { console.error('Failed to close timed-out connection', e); }
          reject(new Error('לא הצלחנו להתחבר למארח. ודא שהמשחק פתוח ונסה שוב.'));
        }
      }, 20000); // Increased timeout to 20 seconds

      conn.on('open', () => {
        console.log('✅ Successfully connected to host!');
        clearTimeout(connTimeout);
        connections.push(conn);
        setupConnection(conn);
        resolve(conn);
      });

      conn.on('error', (err: any) => {
        console.error('❌ Connection error:', err);
        clearTimeout(connTimeout);
        reject(new Error('שגיאת חיבור: ' + (err.message || err.type || 'בעיית תקשורת')));
      });

      conn.on('close', () => {
        console.log('🔌 Connection to host closed');
        clearTimeout(connTimeout);
      });
    }
  });
};

const setupConnection = (conn: any) => {
  conn.on('data', (data: NetworkMessage) => {
    if (onMessageCallback) {
      onMessageCallback(data, conn);
    }
  });
  conn.on('close', () => {
    console.log('🔌 Connection closed with:', conn.peer);
    connections = connections.filter(c => c !== conn);
  });
  conn.on('error', (err: any) => {
    console.error('🔌 Connection error with', conn.peer, ':', err);
    // Try to reconnect
    if (conn.open) {
      conn.close();
    }
    connections = connections.filter(c => c !== conn);
  });
};

export const broadcastMessage = (msg: NetworkMessage) => {
  connections.forEach(conn => {
    if (conn.open) {
      conn.send(msg);
    }
  });
};

export const sendMessageToHost = (msg: NetworkMessage) => {
  // Client only has one connection usually
  if (connections[0] && connections[0].open) {
    connections[0].send(msg);
  }
};

export const setOnMessage = (cb: (msg: NetworkMessage, conn: any) => void) => {
  onMessageCallback = cb;
};

export const getPeerId = () => peerInstance?.id;

export const disconnectAll = () => {
  connections.forEach(c => c.close());
  peerInstance?.destroy();
  peerInstance = null;
  connections = [];
};
