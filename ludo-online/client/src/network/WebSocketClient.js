/**
 * WebSocket Client
 * Handles WebSocket connection, message sending/receiving, and reconnection logic
 */

class WebSocketClient {
  constructor(url) {
    this.url = url;
    this.ws = null;
    this.messageHandlers = new Map();
    this.isConnected = false;
    this.isConnecting = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    this.pingInterval = null;
    this.lastPongTime = null;
    this.connectionTimeout = null;
  }
  
  /**
   * Connect to WebSocket server
   * @returns {Promise}
   */
  connect() {
    return new Promise((resolve, reject) => {
      if (this.isConnecting || this.isConnected) {
        return resolve();
      }
      
      this.isConnecting = true;
      console.log('[WS Client] Connecting to:', this.url);
      
      try {
        this.ws = new WebSocket(this.url);
        
        this.ws.onopen = () => {
          console.log('[WS Client] Connected');
          this.isConnected = true;
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          this.startPingInterval();
          resolve();
        };
        
        this.ws.onclose = (event) => {
          console.log('[WS Client] Disconnected:', event.code, event.reason);
          this.isConnected = false;
          this.isConnecting = false;
          this.stopPingInterval();
          this.handleDisconnect();
        };
        
        this.ws.onerror = (error) => {
          console.error('[WS Client] Error:', error);
          this.isConnecting = false;
          reject(error);
        };
        
        this.ws.onmessage = (event) => {
          this.handleMessage(event.data);
        };
        
        // Connection timeout
        this.connectionTimeout = setTimeout(() => {
          if (!this.isConnected && this.isConnecting) {
            this.isConnecting = false;
            this.ws.close();
            reject(new Error('Connection timeout'));
          }
        }, 10000);
        
      } catch (err) {
        this.isConnecting = false;
        reject(err);
      }
    });
  }
  
  /**
   * Handle incoming message
   * @param {string} data - Raw message data
   */
  handleMessage(data) {
    try {
      const msg = JSON.parse(data);
      
      // Update last pong time for PONG messages
      if (msg.type === 'pong') {
        this.lastPongTime = Date.now();
      }
      
      // Call registered handler for this message type
      const handler = this.messageHandlers.get(msg.type);
      if (handler) {
        handler(msg);
      }
      
      // Also call generic message handler if exists
      const genericHandler = this.messageHandlers.get('*');
      if (genericHandler) {
        genericHandler(msg);
      }
      
    } catch (err) {
      console.error('[WS Client] Message parse error:', err);
    }
  }
  
  /**
   * Register message handler
   * @param {string} type - Message type or '*' for all messages
   * @param {Function} handler - Handler function
   */
  on(type, handler) {
    this.messageHandlers.set(type, handler);
  }
  
  /**
   * Remove message handler
   * @param {string} type - Message type
   */
  off(type) {
    this.messageHandlers.delete(type);
  }
  
  /**
   * Send message to server
   * @param {Object} msg - Message object
   * @returns {boolean} Success status
   */
  send(msg) {
    if (!this.isConnected || !this.ws) {
      console.warn('[WS Client] Cannot send: not connected');
      return false;
    }
    
    try {
      this.ws.send(JSON.stringify(msg));
      return true;
    } catch (err) {
      console.error('[WS Client] Send error:', err);
      return false;
    }
  }
  
  /**
   * Start ping interval for keep-alive
   */
  startPingInterval() {
    this.stopPingInterval();
    
    this.pingInterval = setInterval(() => {
      if (this.isConnected) {
        const pingMsg = {
          type: 'ping',
          timestamp: Date.now()
        };
        this.send(pingMsg);
        
        // Check if we received a pong recently
        if (this.lastPongTime && Date.now() - this.lastPongTime > 30000) {
          console.warn('[WS Client] No pong received, connection may be stale');
        }
      }
    }, 15000);
  }
  
  /**
   * Stop ping interval
   */
  stopPingInterval() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }
  
  /**
   * Handle disconnection and attempt reconnect
   */
  handleDisconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[WS Client] Max reconnect attempts reached');
      const handler = this.messageHandlers.get('disconnected');
      if (handler) handler({ maxAttemptsReached: true });
      return;
    }
    
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts);
    this.reconnectAttempts++;
    
    console.log(`[WS Client] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    
    setTimeout(() => {
      this.connect().catch(console.error);
    }, delay);
  }
  
  /**
   * Disconnect from server
   */
  disconnect() {
    this.stopPingInterval();
    this.reconnectAttempts = this.maxReconnectAttempts; // Prevent auto-reconnect
    
    if (this.ws) {
      this.ws.close(1000, 'Client disconnecting');
    }
  }
  
  /**
   * Get connection latency (from last ping/pong)
   * @returns {number|null} Latency in ms
   */
  getLatency() {
    if (this.lastPongTime) {
      return Date.now() - this.lastPongTime;
    }
    return null;
  }
}

// Export for browser
window.WebSocketClient = WebSocketClient;
