/**
 * Authentication Module
 * JWT token generation, validation, and session management
 */

const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const config = require('../../config');
const { ErrorCodes } = require('../../../shared/protocol');

// In-memory session store (use Redis in production for scale)
const sessions = new Map();

/**
 * Generate a new JWT token for a player
 * @param {string} playerId - Unique player identifier
 * @param {string} username - Player's display name
 * @returns {string} JWT token
 */
function generateToken(playerId, username) {
  const payload = {
    playerId,
    username,
    iat: Date.now()
  };
  
  return jwt.sign(payload, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn
  });
}

/**
 * Validate and decode a JWT token
 * @param {string} token - JWT token to validate
 * @returns {{valid: boolean, payload?: Object, error?: string}}
 */
function validateToken(token) {
  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    
    // Check if session still exists (not invalidated)
    if (!sessions.has(decoded.playerId)) {
      return { 
        valid: false, 
        error: ErrorCodes.AUTH_EXPIRED 
      };
    }
    
    return { 
      valid: true, 
      payload: decoded 
    };
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return { 
        valid: false, 
        error: ErrorCodes.AUTH_EXPIRED 
      };
    }
    return { 
      valid: false, 
      error: ErrorCodes.AUTH_INVALID_TOKEN 
    };
  }
}

/**
 * Create a new session for a player
 * @param {string} username - Player's display name
 * @returns {{playerId: string, token: string}}
 */
function createSession(username) {
  const playerId = uuidv4();
  const token = generateToken(playerId, username);
  
  // Store session
  sessions.set(playerId, {
    playerId,
    username,
    createdAt: Date.now(),
    lastActivity: Date.now(),
    currentRoomId: null
  });
  
  return { playerId, token };
}

/**
 * Get session data for a player
 * @param {string} playerId - Player ID
 * @returns {Object|null} Session data or null if not found
 */
function getSession(playerId) {
  return sessions.get(playerId) || null;
}

/**
 * Update session activity timestamp
 * @param {string} playerId - Player ID
 */
function updateSessionActivity(playerId) {
  const session = sessions.get(playerId);
  if (session) {
    session.lastActivity = Date.now();
  }
}

/**
 * Set player's current room
 * @param {string} playerId - Player ID
 * @param {string|null} roomId - Room ID or null to clear
 */
function setPlayerRoom(playerId, roomId) {
  const session = sessions.get(playerId);
  if (session) {
    session.currentRoomId = roomId;
    session.lastActivity = Date.now();
  }
}

/**
 * Invalidate a session (logout)
 * @param {string} playerId - Player ID
 */
function invalidateSession(playerId) {
  sessions.delete(playerId);
}

/**
 * Clean up expired sessions
 * Called periodically to prevent memory leaks
 */
function cleanupExpiredSessions() {
  const maxAge = 24 * 60 * 60 * 1000; // 24 hours
  const now = Date.now();
  
  for (const [playerId, session] of sessions.entries()) {
    if (now - session.lastActivity > maxAge) {
      sessions.delete(playerId);
    }
  }
}

/**
 * Get active session count (for monitoring)
 * @returns {number} Number of active sessions
 */
function getActiveSessionCount() {
  return sessions.size;
}

// Run cleanup every hour
setInterval(cleanupExpiredSessions, 60 * 60 * 1000);

module.exports = {
  generateToken,
  validateToken,
  createSession,
  getSession,
  updateSessionActivity,
  setPlayerRoom,
  invalidateSession,
  cleanupExpiredSessions,
  getActiveSessionCount
};
