// Connection Monitor utility for better debugging
window.ConnectionMonitor = {
  connections: new Map(),

  addConnection: function(peerId, conn) {
    this.connections.set(peerId, {
      connection: conn,
      status: 'connected',
      lastActivity: Date.now(),
      messagesSent: 0,
      messagesReceived: 0
    });

    conn.on('close', () => {
      console.log(`🔌 Connection closed: ${peerId}`);
      this.connections.delete(peerId);
    });

    conn.on('error', (err) => {
      console.error(`🔌 Connection error with ${peerId}:`, err);
      const info = this.connections.get(peerId);
      if (info) info.status = 'error';
    });

    console.log(`✅ New connection established: ${peerId}`);
  },

  checkHealth: function() {
    const now = Date.now();
    const timeout = 30000; // 30 seconds timeout

    this.connections.forEach((info, peerId) => {
      if (now - info.lastActivity > timeout) {
        console.warn(`⚠️ Connection with ${peerId} appears inactive (last activity: ${now - info.lastActivity}ms ago)`);
      }
    });

    console.log(`📊 Active connections: ${this.connections.size}`);
  },

  logStats: function() {
    console.log('📈 Connection Stats:');
    this.connections.forEach((info, peerId) => {
      console.log(`  ${peerId}: ${info.status}, Sent: ${info.messagesSent}, Received: ${info.messagesReceived}`);
    });
  }
};

// Check connection health every 10 seconds
setInterval(() => {
  window.ConnectionMonitor.checkHealth();
}, 10000);