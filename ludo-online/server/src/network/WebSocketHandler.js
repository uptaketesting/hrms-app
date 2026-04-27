/**
 * WebSocket Network Handler
 * Manages WebSocket connections, message routing, and client communication
 */

const WebSocket = require('ws');
const { 
  MessageTypes, 
  ErrorCodes, 
  validateBaseMessage,
  createMessage 
} = require('../../../shared/protocol');
const auth = require('../auth/auth');
const roomManager = require('../rooms/RoomManager');
const config = require('../../config');

// Rate limiting store
const rateLimitStore = new Map();

/**
 * @class WebSocketHandler
 * Handles all WebSocket connections and message routing
 */
class WebSocketHandler {
  constructor(server) {
    this.wss = new WebSocket.Server({ 
      server,
      path: '/ws',
      clientTracking: true
    });
    
    // Map of playerId -> Set of WebSocket connections (for reconnection support)
    this.playerConnections = new Map();
    
    // Map of ws -> playerId
    this.wsToPlayer = new WeakMap();
    
    // Nonce cache for anti-replay (nonce -> timestamp)
    this.nonceCache = new Map();
    
    this.setupServer();
    this.startCleanupInterval();
  }
  
  /**
   * Setup WebSocket server event handlers
   */
  setupServer() {
    this.wss.on('connection', (ws, req) => {
      console.log('[WS] New connection');
      
      // Set initial state
      ws.isAlive = true;
      ws.playerId = null;
      
      // Handle messages
      ws.on('message', (data) => {
        try {
          this.handleMessage(ws, data);
        } catch (err) {
          console.error('[WS] Message handling error:', err);
          this.sendError(ws, ErrorCodes.SERVER_ERROR, 'Internal server error');
        }
      });
      
      // Handle pong (keep-alive)
      ws.on('pong', () => {
        ws.isAlive = true;
      });
      
      // Handle disconnection
      ws.on('close', () => {
        this.handleDisconnect(ws);
      });
      
      // Handle errors
      ws.on('error', (err) => {
        console.error('[WS] Connection error:', err);
      });
      
      // Send connection acknowledgment
      this.send(ws, createMessage(MessageTypes.CONNECTION_ACK, {
        message: 'Connected to Ludo server',
        timestamp: Date.now()
      }));
    });
    
    // Keep-alive ping interval
    const pingInterval = setInterval(() => {
      this.wss.clients.forEach((ws) => {
        if (ws.isAlive === false) {
          return ws.terminate();
        }
        
        ws.isAlive = false;
        ws.ping();
      });
    }, 30000);
    
    this.wss.on('close', () => {
      clearInterval(pingInterval);
    });
  }
  
  /**
   * Handle incoming WebSocket message
   * @param {WebSocket} ws - WebSocket connection
   * @param {string} data - Raw message data
   */
  handleMessage(ws, data) {
    // Parse message
    let msg;
    try {
      msg = JSON.parse(data.toString());
    } catch (err) {
      return this.sendError(ws, ErrorCodes.INVALID_MESSAGE, 'Invalid JSON');
    }
    
    // Validate base message structure
    const validation = validateBaseMessage(msg);
    if (!validation.valid) {
      return this.sendError(ws, ErrorCodes.INVALID_MESSAGE, validation.error);
    }
    
    // Check rate limiting
    if (!this.checkRateLimit(ws)) {
      return this.sendError(ws, ErrorCodes.RATE_LIMIT_EXCEEDED, 'Too many requests');
    }
    
    // Route message based on type
    const handler = this.getMessageHandler(msg.type);
    if (handler) {
      handler.call(this, ws, msg);
    } else {
      this.sendError(ws, ErrorCodes.INVALID_MESSAGE, `Unknown message type: ${msg.type}`);
    }
  }
  
  /**
   * Get message handler for a message type
   * @param {string} type - Message type
   * @returns {Function|null}
   */
  getMessageHandler(type) {
    const handlers = {
      [MessageTypes.AUTH_REQUEST]: this.handleAuth.bind(this),
      [MessageTypes.PING]: this.handlePing.bind(this),
      [MessageTypes.ROOM_CREATE]: this.handleRoomCreate.bind(this),
      [MessageTypes.ROOM_JOIN]: this.handleRoomJoin.bind(this),
      [MessageTypes.ROOM_LEAVE]: this.handleRoomLeave.bind(this),
      [MessageTypes.ROOM_LIST]: this.handleRoomList.bind(this),
      [MessageTypes.ROOM_START]: this.handleRoomStart.bind(this),
      [MessageTypes.DICE_ROLL]: this.handleDiceRoll.bind(this),
      [MessageTypes.TOKEN_MOVE]: this.handleTokenMove.bind(this),
      [MessageTypes.RECONNECT]: this.handleReconnect.bind(this),
      [MessageTypes.RESYNC_REQUEST]: this.handleResync.bind(this)
    };
    
    return handlers[type] || null;
  }
  
  /**
   * Handle authentication
   * @param {WebSocket} ws
   * @param {Object} msg
   */
  async handleAuth(ws, msg) {
    const { username, token } = msg;
    
    if (!username) {
      return this.sendError(ws, ErrorCodes.AUTH_MISSING, 'Username required');
    }
    
    let session;
    
    if (token) {
      // Reconnect with existing token
      const validation = auth.validateToken(token);
      if (!validation.valid) {
        return this.sendError(ws, validation.error, 'Invalid or expired token');
      }
      session = auth.getSession(validation.payload.playerId);
      auth.updateSessionActivity(validation.payload.playerId);
    } else {
      // Create new session
      const { validateUsername } = require('../../../shared/protocol');
      const usernameValidation = validateUsername(username);
      
      if (!usernameValidation.valid) {
        return this.sendError(ws, ErrorCodes.INVALID_MESSAGE, usernameValidation.error);
      }
      
      session = auth.createSession(usernameValidation.sanitized);
    }
    
    // Associate connection with player
    ws.playerId = session.playerId;
    
    if (!this.playerConnections.has(session.playerId)) {
      this.playerConnections.set(session.playerId, new Set());
    }
    this.playerConnections.get(session.playerId).add(ws);
    this.wsToPlayer.set(ws, session.playerId);
    
    // Send success response
    this.send(ws, createMessage(MessageTypes.AUTH_RESPONSE, {
      success: true,
      playerId: session.playerId,
      token: auth.generateToken(session.playerId, session.username),
      username: session.username
    }));
    
    console.log(`[AUTH] Player authenticated: ${session.username} (${session.playerId})`);
  }
  
  /**
   * Handle ping/pong
   * @param {WebSocket} ws
   * @param {Object} msg
   */
  handlePing(ws, msg) {
    this.send(ws, createMessage(MessageTypes.PONG, {
      timestamp: msg.timestamp,
      latency: Date.now() - msg.timestamp
    }));
  }
  
  /**
   * Handle room creation
   * @param {WebSocket} ws
   * @param {Object} msg
   */
  handleRoomCreate(ws, msg) {
    const playerId = this.getPlayerId(ws);
    if (!playerId) {
      return this.sendError(ws, ErrorCodes.AUTH_MISSING, 'Not authenticated');
    }
    
    const session = auth.getSession(playerId);
    if (!session) {
      return this.sendError(ws, ErrorCodes.AUTH_EXPIRED, 'Session expired');
    }
    
    const { roomCode, maxPlayers } = msg;
    const result = roomManager.createRoom(session, roomCode, maxPlayers);
    
    if (result.error) {
      return this.sendError(ws, 'ROOM_CREATE_ERROR', result.error);
    }
    
    // Update session
    auth.setPlayerRoom(playerId, result.roomId);
    
    this.send(ws, createMessage(MessageTypes.ROOM_UPDATE, {
      action: 'created',
      roomId: result.roomId,
      roomCode: result.roomCode,
      players: [{ id: session.playerId, username: session.username, role: 'host' }]
    }));
  }
  
  /**
   * Handle joining a room
   * @param {WebSocket} ws
   * @param {Object} msg
   */
  handleRoomJoin(ws, msg) {
    const playerId = this.getPlayerId(ws);
    if (!playerId) {
      return this.sendError(ws, ErrorCodes.AUTH_MISSING, 'Not authenticated');
    }
    
    const session = auth.getSession(playerId);
    const { validateRoomCode } = require('../../../shared/protocol');
    
    const codeValidation = validateRoomCode(msg.roomCode);
    if (!codeValidation.valid) {
      return this.sendError(ws, ErrorCodes.ROOM_INVALID_CODE, codeValidation.error);
    }
    
    const result = roomManager.joinRoom(codeValidation.normalized, session);
    
    if (result.error) {
      return this.sendError(ws, result.error, 'Failed to join room');
    }
    
    // Update session
    auth.setPlayerRoom(playerId, result.room.roomId);
    
    // Notify all players in room
    this.broadcastToRoom(result.room.roomId, createMessage(MessageTypes.ROOM_UPDATE, {
      action: 'player_joined',
      roomId: result.room.roomId,
      roomCode: result.room.roomCode,
      players: result.room.players.map(p => ({
        id: p.id,
        username: p.username,
        role: p.role
      }))
    }));
  }
  
  /**
   * Handle leaving a room
   * @param {WebSocket} ws
   * @param {Object} msg
   */
  handleRoomLeave(ws, msg) {
    const playerId = this.getPlayerId(ws);
    if (!playerId) return;
    
    const session = auth.getSession(playerId);
    if (!session || !session.currentRoomId) return;
    
    const result = roomManager.leaveRoom(session.currentRoomId, playerId);
    
    if (result.success) {
      auth.setPlayerRoom(playerId, null);
      
      // Notify remaining players
      if (result.room && !result.roomClosed) {
        this.broadcastToRoom(result.room.roomId, createMessage(MessageTypes.ROOM_UPDATE, {
          action: 'player_left',
          roomId: result.room.roomId,
          players: result.room.players.map(p => ({
            id: p.id,
            username: p.username,
            role: p.role
          }))
        }));
      }
    }
  }
  
  /**
   * Handle room list request
   * @param {WebSocket} ws
   * @param {Object} msg
   */
  handleRoomList(ws, msg) {
    const rooms = roomManager.getRoomList();
    this.send(ws, createMessage(MessageTypes.ROOM_LIST, { rooms }));
  }
  
  /**
   * Handle starting a game
   * @param {WebSocket} ws
   * @param {Object} msg
   */
  handleRoomStart(ws, msg) {
    const playerId = this.getPlayerId(ws);
    if (!playerId) {
      return this.sendError(ws, ErrorCodes.AUTH_MISSING, 'Not authenticated');
    }
    
    const session = auth.getSession(playerId);
    if (!session || !session.currentRoomId) {
      return this.sendError(ws, 'NOT_IN_ROOM', 'Not in a room');
    }
    
    const result = roomManager.startGame(session.currentRoomId, playerId);
    
    if (!result.success) {
      return this.sendError(ws, 'GAME_START_ERROR', result.error);
    }
    
    // Broadcast game state to all players
    this.broadcastToRoom(session.currentRoomId, createMessage(MessageTypes.GAME_STATE, {
      roomId: session.currentRoomId,
      state: result.gameState,
      sequenceNumber: result.gameState.sequenceNumber
    }));
  }
  
  /**
   * Handle dice roll
   * @param {WebSocket} ws
   * @param {Object} msg
   */
  handleDiceRoll(ws, msg) {
    const playerId = this.getPlayerId(ws);
    if (!playerId) return;
    
    const session = auth.getSession(playerId);
    if (!session || !session.currentRoomId) return;
    
    const room = roomManager.getRoom(session.currentRoomId);
    if (!room || !room.game) return;
    
    // Validate nonce (anti-replay)
    if (this.isNonceUsed(msg.nonce)) {
      return this.sendError(ws, ErrorCodes.GAME_INVALID_DICE, 'Invalid nonce');
    }
    this.cacheNonce(msg.nonce);
    
    // Execute dice roll (server-authoritative)
    const result = room.game.rollDice(playerId, msg.nonce);
    
    if (!result.success) {
      return this.sendError(ws, result.error, 'Dice roll failed');
    }
    
    // Broadcast result
    this.broadcastToRoom(room.roomId, createMessage(MessageTypes.DICE_RESULT, {
      roomId: room.roomId,
      playerId,
      diceValue: result.diceValue,
      message: result.message,
      gameState: room.game.getState()
    }));
  }
  
  /**
   * Handle token move
   * @param {WebSocket} ws
   * @param {Object} msg
   */
  handleTokenMove(ws, msg) {
    const playerId = this.getPlayerId(ws);
    if (!playerId) return;
    
    const session = auth.getSession(playerId);
    if (!session || !session.currentRoomId) return;
    
    const room = roomManager.getRoom(session.currentRoomId);
    if (!room || !room.game) return;
    
    // Validate nonce
    if (this.isNonceUsed(msg.nonce)) {
      return this.sendError(ws, ErrorCodes.GAME_INVALID_MOVE, 'Invalid nonce');
    }
    this.cacheNonce(msg.nonce);
    
    // Validate token index
    const { validateTokenIndex } = require('../../../shared/protocol');
    if (!validateTokenIndex(msg.tokenIndex)) {
      return this.sendError(ws, ErrorCodes.GAME_INVALID_MOVE, 'Invalid token index');
    }
    
    // Execute move (server-authoritative)
    const result = room.game.moveToken(playerId, msg.tokenIndex, msg.nonce);
    
    if (!result.success) {
      return this.sendError(ws, result.error, 'Move failed');
    }
    
    // Broadcast result
    this.broadcastToRoom(room.roomId, createMessage(MessageTypes.TOKEN_MOVED, {
      roomId: room.roomId,
      playerId,
      tokenIndex: msg.tokenIndex,
      captured: result.captured,
      extraTurn: result.extraTurn,
      won: result.won,
      gameState: room.game.getState()
    }));
    
    // Check for game over
    if (room.game.state.status === 'finished') {
      this.broadcastToRoom(room.roomId, createMessage(MessageTypes.GAME_OVER, {
        roomId: room.roomId,
        winner: room.game.state.winner,
        gameState: room.game.getState()
      }));
    }
  }
  
  /**
   * Handle reconnection
   * @param {WebSocket} ws
   * @param {Object} msg
   */
  handleReconnect(ws, msg) {
    const { token } = msg;
    
    if (!token) {
      return this.sendError(ws, ErrorCodes.AUTH_MISSING, 'Token required');
    }
    
    const validation = auth.validateToken(token);
    if (!validation.valid) {
      return this.sendError(ws, validation.error, 'Invalid token');
    }
    
    const session = auth.getSession(validation.payload.playerId);
    if (!session) {
      return this.sendError(ws, ErrorCodes.AUTH_EXPIRED, 'Session not found');
    }
    
    // Reassociate connection
    ws.playerId = session.playerId;
    
    if (!this.playerConnections.has(session.playerId)) {
      this.playerConnections.set(session.playerId, new Set());
    }
    this.playerConnections.get(session.playerId).add(ws);
    this.wsToPlayer.set(ws, session.playerId);
    
    auth.updateSessionActivity(session.playerId);
    
    // If player was in a room, resync state
    if (session.currentRoomId) {
      const room = roomManager.getRoom(session.currentRoomId);
      if (room && room.game) {
        this.send(ws, createMessage(MessageTypes.RESYNC_RESPONSE, {
          roomId: room.roomId,
          roomCode: room.roomCode,
          gameState: room.game.getState()
        }));
      }
    }
    
    this.send(ws, createMessage(MessageTypes.AUTH_RESPONSE, {
      success: true,
      playerId: session.playerId,
      token: auth.generateToken(session.playerId, session.username),
      reconnected: true
    }));
  }
  
  /**
   * Handle resync request
   * @param {WebSocket} ws
   * @param {Object} msg
   */
  handleResync(ws, msg) {
    const playerId = this.getPlayerId(ws);
    if (!playerId) return;
    
    const session = auth.getSession(playerId);
    if (!session || !session.currentRoomId) return;
    
    const room = roomManager.getRoom(session.currentRoomId);
    if (!room || !room.game) return;
    
    this.send(ws, createMessage(MessageTypes.RESYNC_RESPONSE, {
      roomId: room.roomId,
      gameState: room.game.getState()
    }));
  }
  
  /**
   * Handle WebSocket disconnection
   * @param {WebSocket} ws
   */
  handleDisconnect(ws) {
    const playerId = this.wsToPlayer.get(ws);
    
    if (playerId) {
      const connections = this.playerConnections.get(playerId);
      if (connections) {
        connections.delete(ws);
        
        // If no more connections, mark player as disconnected
        if (connections.size === 0) {
          this.playerConnections.delete(playerId);
          console.log(`[WS] Player disconnected: ${playerId}`);
          
          // Optionally handle player disconnect in game
          // (timeout logic handled by game engine)
        }
      }
    }
  }
  
  /**
   * Send message to a specific WebSocket
   * @param {WebSocket} ws
   * @param {Object} msg
   */
  send(ws, msg) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }
  
  /**
   * Broadcast message to all players in a room
   * @param {string} roomId - Room ID
   * @param {Object} msg - Message to broadcast
   */
  broadcastToRoom(roomId, msg) {
    const room = roomManager.getRoom(roomId);
    if (!room) return;
    
    for (const player of room.players) {
      const connections = this.playerConnections.get(player.id);
      if (connections) {
        for (const ws of connections) {
          this.send(ws, msg);
        }
      }
    }
  }
  
  /**
   * Send error message
   * @param {WebSocket} ws
   * @param {string} code - Error code
   * @param {string} message - Error message
   */
  sendError(ws, code, message) {
    this.send(ws, createMessage(MessageTypes.ERROR, {
      code,
      message
    }));
  }
  
  /**
   * Get player ID from WebSocket
   * @param {WebSocket} ws
   * @returns {string|null}
   */
  getPlayerId(ws) {
    return this.wsToPlayer.get(ws) || ws.playerId;
  }
  
  /**
   * Check rate limit for a connection
   * @param {WebSocket} ws
   * @returns {boolean}
   */
  checkRateLimit(ws) {
    const now = Date.now();
    const windowMs = config.rateLimit.windowMs;
    const maxRequests = config.rateLimit.maxRequests;
    
    let record = rateLimitStore.get(ws);
    
    if (!record) {
      record = { count: 1, resetTime: now + windowMs };
      rateLimitStore.set(ws, record);
      return true;
    }
    
    if (now > record.resetTime) {
      record.count = 1;
      record.resetTime = now + windowMs;
      return true;
    }
    
    if (record.count >= maxRequests) {
      return false;
    }
    
    record.count++;
    return true;
  }
  
  /**
   * Check if nonce has been used (anti-replay)
   * @param {string} nonce
   * @returns {boolean}
   */
  isNonceUsed(nonce) {
    return this.nonceCache.has(nonce);
  }
  
  /**
   * Cache a nonce
   * @param {string} nonce
   */
  cacheNonce(nonce) {
    this.nonceCache.set(nonce, Date.now());
    
    // Limit cache size
    if (this.nonceCache.size > 10000) {
      const cutoff = Date.now() - 60000; // 1 minute
      for (const [n, ts] of this.nonceCache.entries()) {
        if (ts < cutoff) {
          this.nonceCache.delete(n);
        }
      }
    }
  }
  
  /**
   * Start cleanup interval for rate limits and nonces
   */
  startCleanupInterval() {
    setInterval(() => {
      const now = Date.now();
      
      // Cleanup rate limits
      for (const [ws, record] of rateLimitStore.entries()) {
        if (now > record.resetTime) {
          rateLimitStore.delete(ws);
        }
      }
      
      // Cleanup old nonces
      const cutoff = now - 60000;
      for (const [nonce, ts] of this.nonceCache.entries()) {
        if (ts < cutoff) {
          this.nonceCache.delete(nonce);
        }
      }
    }, 60000);
  }
  
  /**
   * Close all connections gracefully
   */
  close() {
    this.wss.clients.forEach((ws) => {
      ws.close(1000, 'Server shutting down');
    });
  }
}

module.exports = WebSocketHandler;
