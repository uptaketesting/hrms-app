/**
 * Room Manager
 * Handles room creation, player matchmaking, and room lifecycle
 */

const { v4: uuidv4 } = require('uuid');
const { generateRoomCode, ErrorCodes } = require('../../../shared/protocol');
const LudoGame = require('../game/LudoGame');
const config = require('../../config');

// In-memory room store (use Redis in production for scale)
const rooms = new Map();

/**
 * @class RoomManager
 * Singleton pattern for managing all game rooms
 */
class RoomManager {
  constructor() {
    this.rooms = rooms;
  }
  
  /**
   * Create a new room
   * @param {Object} hostPlayer - Host player object
   * @param {string} [customCode] - Optional custom room code
   * @param {number} [maxPlayers] - Maximum players (2-4)
   * @returns {{roomId: string, roomCode: string, error?: string}}
   */
  createRoom(hostPlayer, customCode = null, maxPlayers = config.game.maxPlayersPerRoom) {
    // Validate max players
    if (maxPlayers < 2 || maxPlayers > 4) {
      return { error: 'Max players must be 2-4' };
    }
    
    // Generate or validate room code
    let roomCode;
    if (customCode) {
      const normalized = customCode.toUpperCase().trim();
      if (!/^[A-Z0-9]{4,8}$/.test(normalized)) {
        return { error: 'Invalid room code format' };
      }
      
      // Check if code already exists
      if (this.getRoomByCode(normalized)) {
        return { error: 'Room code already taken' };
      }
      roomCode = normalized;
    } else {
      // Generate unique code
      do {
        roomCode = generateRoomCode(6);
      } while (this.getRoomByCode(roomCode));
    }
    
    const roomId = uuidv4();
    
    // Create room object
    const room = {
      roomId,
      roomCode,
      status: 'waiting', // waiting, playing, finished
      createdAt: Date.now(),
      lastActivity: Date.now(),
      maxPlayers,
      players: [{
        id: hostPlayer.id,
        username: hostPlayer.username,
        role: 'host',
        joinedAt: Date.now(),
        ready: true
      }],
      game: null,
      spectators: []
    };
    
    rooms.set(roomId, room);
    
    return { roomId, roomCode };
  }
  
  /**
   * Join an existing room
   * @param {string} roomCode - Room code
   * @param {Object} player - Player object
   * @returns {{room: Object, error?: string}}
   */
  joinRoom(roomCode, player) {
    const room = this.getRoomByCode(roomCode);
    
    if (!room) {
      return { error: ErrorCodes.ROOM_NOT_FOUND };
    }
    
    if (room.status !== 'waiting') {
      return { error: ErrorCodes.ROOM_ALREADY_STARTED };
    }
    
    if (room.players.length >= room.maxPlayers) {
      return { error: ErrorCodes.ROOM_FULL };
    }
    
    // Check if player already in room
    if (room.players.find(p => p.id === player.id)) {
      return { error: 'Already in room' };
    }
    
    // Add player
    room.players.push({
      id: player.id,
      username: player.username,
      role: 'player',
      joinedAt: Date.now(),
      ready: true
    });
    
    room.lastActivity = Date.now();
    
    return { room };
  }
  
  /**
   * Leave a room
   * @param {string} roomId - Room ID
   * @param {string} playerId - Player ID
   * @returns {{success: boolean, room?: Object, error?: string}}
   */
  leaveRoom(roomId, playerId) {
    const room = rooms.get(roomId);
    
    if (!room) {
      return { error: ErrorCodes.ROOM_NOT_FOUND };
    }
    
    const playerIndex = room.players.findIndex(p => p.id === playerId);
    
    if (playerIndex === -1) {
      // Check spectators
      const specIndex = room.spectators.findIndex(p => p.id === playerId);
      if (specIndex !== -1) {
        room.spectators.splice(specIndex, 1);
      }
      return { success: true };
    }
    
    // If host leaves, transfer host role or close room
    if (room.players[playerIndex].role === 'host') {
      if (room.players.length > 1) {
        // Transfer to first player
        room.players[0].role = 'host';
      } else {
        // Close room
        this.destroyRoom(roomId);
        return { success: true, roomClosed: true };
      }
    }
    
    // Remove player
    room.players.splice(playerIndex, 1);
    room.lastActivity = Date.now();
    
    // If no players left, destroy room
    if (room.players.length === 0) {
      this.destroyRoom(roomId);
      return { success: true, roomClosed: true };
    }
    
    return { success: true, room };
  }
  
  /**
   * Start the game in a room
   * @param {string} roomId - Room ID
   * @param {string} playerId - Player requesting start (must be host)
   * @returns {{success: boolean, game?: Object, error?: string}}
   */
  startGame(roomId, playerId) {
    const room = rooms.get(roomId);
    
    if (!room) {
      return { error: ErrorCodes.ROOM_NOT_FOUND };
    }
    
    const requester = room.players.find(p => p.id === playerId);
    if (!requester || requester.role !== 'host') {
      return { error: 'Only host can start game' };
    }
    
    if (room.players.length < 2) {
      return { error: 'Need at least 2 players to start' };
    }
    
    // Create game instance
    room.game = new LudoGame(roomId, room.players);
    const result = room.game.start();
    
    if (!result.success) {
      return result;
    }
    
    room.status = 'playing';
    room.lastActivity = Date.now();
    
    return { 
      success: true, 
      gameState: room.game.getState() 
    };
  }
  
  /**
   * Get room by ID
   * @param {string} roomId - Room ID
   * @returns {Object|null}
   */
  getRoom(roomId) {
    return rooms.get(roomId) || null;
  }
  
  /**
   * Get room by code
   * @param {string} roomCode - Room code
   * @returns {Object|null}
   */
  getRoomByCode(roomCode) {
    const normalized = roomCode.toUpperCase().trim();
    for (const room of rooms.values()) {
      if (room.roomCode === normalized) {
        return room;
      }
    }
    return null;
  }
  
  /**
   * Get list of available rooms
   * @returns {Array} Array of room summaries
   */
  getRoomList() {
    const list = [];
    for (const room of rooms.values()) {
      if (room.status === 'waiting') {
        list.push({
          roomId: room.roomId,
          roomCode: room.roomCode,
          playerCount: room.players.length,
          maxPlayers: room.maxPlayers,
          createdAt: room.createdAt
        });
      }
    }
    return list.sort((a, b) => b.createdAt - a.createdAt);
  }
  
  /**
   * Destroy a room
   * @param {string} roomId - Room ID
   */
  destroyRoom(roomId) {
    rooms.delete(roomId);
  }
  
  /**
   * Clean up inactive rooms
   * Called periodically to prevent memory leaks
   */
  cleanupInactiveRooms() {
    const maxInactiveTime = 24 * 60 * 60 * 1000; // 24 hours
    const now = Date.now();
    
    for (const [roomId, room] of rooms.entries()) {
      if (now - room.lastActivity > maxInactiveTime) {
        rooms.delete(roomId);
      }
    }
  }
  
  /**
   * Get room count (for monitoring)
   * @returns {Object} Room statistics
   */
  getStats() {
    let waiting = 0;
    let playing = 0;
    let finished = 0;
    let totalPlayers = 0;
    
    for (const room of rooms.values()) {
      if (room.status === 'waiting') waiting++;
      else if (room.status === 'playing') playing++;
      else if (room.status === 'finished') finished++;
      totalPlayers += room.players.length;
    }
    
    return {
      total: rooms.size,
      waiting,
      playing,
      finished,
      totalPlayers
    };
  }
}

// Export singleton instance
module.exports = new RoomManager();
