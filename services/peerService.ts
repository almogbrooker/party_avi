import { NetworkMessage } from "../types";

// We use a global variable or singleton pattern for simplicity in this context
// to persist the peer connection across React renders without complex Context.

let peerInstance: any = null;
let connections: any[] = [];
let onMessageCallback: ((msg: NetworkMessage, conn: any) => void) | null = null;

export const initializePeer = async (id?: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    // @ts-ignore - PeerJS is loaded via script tag
    const Peer = (window as any).Peer;
    
    if (!Peer) {
      reject(new Error("PeerJS not loaded"));
      return;
    }

    // Create a new ID if not provided (Host), or use provided ID (not really used for PeerJS ID, we use random)
    // We actually just want a random ID for the host, and players connect to it.
    const newPeer = new Peer(id, {
      debug: 1,
    });

    newPeer.on('open', (peerId: string) => {
      console.log('My peer ID is: ' + peerId);
      peerInstance = newPeer;
      resolve(peerId);
    });

    newPeer.on('connection', (conn: any) => {
      connections.push(conn);
      setupConnection(conn);
    });

    newPeer.on('error', (err: any) => {
      console.error('Peer error:', err);
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
      peerInstance = new Peer();
      
      peerInstance.on('open', () => {
        connect(hostId);
      });
      
      peerInstance.on('error', reject);
    } else {
      connect(hostId);
    }

    function connect(destId: string) {
      const conn = peerInstance.connect(destId, { metadata });
      conn.on('open', () => {
        connections.push(conn);
        setupConnection(conn);
        resolve(conn);
      });
      conn.on('error', reject);
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