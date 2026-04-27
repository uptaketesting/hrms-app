/**
 * Shared Protocol Definitions
 * 
 * This file defines all message types, validation schemas, and constants
 * used for client-server communication. Both client and server import from here.
 */

// ============================================================================
// MESSAGE TYPES
// ============================================================================

/**
 * @enum {string}
 */
const MessageTypes = {
  // Authentication & Connection
  AUTH_REQUEST: 'auth:request',
  AUTH_RESPONSE: 'auth:response',
  CONNECTION_ACK: 'connection:ack',
  CONNECTION_ERROR: 'connection:error',
  
  // Lobby & Room Management
  LOBBY_JOIN: 'lobby:join',
  LOBBY_LEAVE: 'lobby:leave',
  ROOM_CREATE: 'room:create',
  ROOM_JOIN: 'room:join',
  ROOM_LEAVE: 'room:leave',
  ROOM_LIST: 'room:list',
  ROOM_UPDATE: 'room:update',
  ROOM_PLAYER_JOINED: 'room:player:joined',
  ROOM_PLAYER_LEFT: 'room:player:left',
  ROOM_START: 'room:start',
  
  // Game Actions
  GAME_STATE: 'game:state',
  GAME_ACTION: 'game:action',
  DICE_ROLL: 'dice:roll',
  DICE_RESULT: 'dice:result',
  TOKEN_MOVE: 'token:move',
  TOKEN_MOVED: 'token:moved',
  TURN_CHANGE: 'turn:change',
  GAME_OVER: 'game:over',
  
  // Chat & Misc
  CHAT_MESSAGE: 'chat:message',
  PING: 'ping',
  PONG: 'pong',
  ERROR: 'error',
  RECONNECT: 'reconnect',
  RESYNC_REQUEST: 'resync:request',
  RESYNC_RESPONSE: 'resync:response'
};

// ============================================================================
// GAME CONSTANTS
// ============================================================================

/**
 * @enum {string}
 */
const PlayerColor = {
  RED: 'red',
  GREEN: 'green',
  YELLOW: 'yellow',
  BLUE: 'blue'
};

/**
 * @enum {number}
 */
const TokenStatus = {
  IN_BASE: 0,
  ON_BOARD: 1,
  IN_HOME_STRETCH: 2,
  AT_HOME: 3
};

// Board configuration
const BOARD_CONFIG = {
  TOTAL_CELLS: 52,        // Main path cells
  HOME_STRETCH_LENGTH: 6, // Cells in home stretch
  SAFE_CELLS: [0, 8, 13, 21, 26, 34, 39, 47], // Star/safe positions
  START_POSITIONS: {
    [PlayerColor.RED]: 0,
    [PlayerColor.GREEN]: 13,
    [PlayerColor.YELLOW]: 26,
    [PlayerColor.BLUE]: 39
  },
  HOME_ENTRY_OFFSET: {
    [PlayerColor.RED]: 50,
    [PlayerColor.GREEN]: 11,
    [PlayerColor.YELLOW]: 24,
    [PlayerColor.BLUE]: 37
  }
};

// Game timing
const GAME_TIMING = {
  TURN_TIMEOUT_MS: 30000,
  DICE_ANIMATION_MS: 1000,
  MOVE_ANIMATION_MS: 500,
  BETWEEN_TURNS_MS: 1000
};

// Validation limits
const VALIDATION_LIMITS = {
  MAX_ROOM_CODE_LENGTH: 8,
  MIN_ROOM_CODE_LENGTH: 4,
  MAX_CHAT_MESSAGE_LENGTH: 200,
  MAX_USERNAME_LENGTH: 20,
  MIN_DICE_VALUE: 1,
  MAX_DICE_VALUE: 6,
  MAX_TOKENS_PER_PLAYER: 4,
  MAX_PLAYERS_PER_ROOM: 4
};

// ============================================================================
// MESSAGE SCHEMAS
// ============================================================================

/**
 * Base message structure all messages must follow
 * @typedef {Object} BaseMessage
 * @property {string} type - Message type from MessageTypes
 * @property {number} timestamp - Unix timestamp in milliseconds
 * @property {string} [roomId] - Room identifier
 * @property {string} [playerId] - Player identifier
 */

/**
 * @typedef {Object} AuthRequestMessage
 * @property {string} type - 'auth:request'
 * @property {number} timestamp
 * @property {string} username - Player's display name
 * @property {string} [token] - JWT token for reconnection
 */

/**
 * @typedef {Object} AuthResponseMessage
 * @property {string} type - 'auth:response'
 * @property {number} timestamp
 * @property {boolean} success
 * @property {string} [playerId] - Assigned player ID
 * @property {string} [token] - JWT token for session
 * @property {string} [error] - Error message if failed
 */

/**
 * @typedef {Object} RoomCreateMessage
 * @property {string} type - 'room:create'
 * @property {number} timestamp
 * @property {string} roomCode - Custom room code (optional)
 * @property {number} maxPlayers - Maximum players (2-4)
 */

/**
 * @typedef {Object} RoomJoinMessage
 * @property {string} type - 'room:join'
 * @property {number} timestamp
 * @property {string} roomCode - Room code to join
 */

/**
 * @typedef {Object} DiceRollMessage
 * @property {string} type - 'dice:roll'
 * @property {number} timestamp
 * @property {string} roomId
 * @property {string} playerId
 * @property {string} nonce - Anti-cheat nonce
 */

/**
 * @typedef {Object} TokenMoveMessage
 * @property {string} type - 'token:move'
 * @property {number} timestamp
 * @property {string} roomId
 * @property {string} playerId
 * @property {number} tokenIndex - Which token (0-3)
 * @property {string} nonce - Anti-cheat nonce
 */

/**
 * @typedef {Object} GameStateMessage
 * @property {string} type - 'game:state'
 * @property {number} timestamp
 * @property {string} roomId
 * @property {Object} state - Full game state
 * @property {number} sequenceNumber - For delta compression
 */

/**
 * @typedef {Object} ErrorMessage
 * @property {string} type - 'error'
 * @property {number} timestamp
 * @property {string} code - Error code
 * @property {string} message - Human-readable message
 * @property {Object} [details] - Additional error details
 */

// ============================================================================
// ERROR CODES
// ============================================================================

/**
 * @enum {string}
 */
const ErrorCodes = {
  // Authentication
  AUTH_INVALID_TOKEN: 'AUTH_INVALID_TOKEN',
  AUTH_EXPIRED: 'AUTH_EXPIRED',
  AUTH_MISSING: 'AUTH_MISSING',
  
  // Room errors
  ROOM_NOT_FOUND: 'ROOM_NOT_FOUND',
  ROOM_FULL: 'ROOM_FULL',
  ROOM_ALREADY_STARTED: 'ROOM_ALREADY_STARTED',
  ROOM_INVALID_CODE: 'ROOM_INVALID_CODE',
  
  // Game errors
  GAME_NOT_YOUR_TURN: 'GAME_NOT_YOUR_TURN',
  GAME_INVALID_MOVE: 'GAME_INVALID_MOVE',
  GAME_INVALID_DICE: 'GAME_INVALID_DICE',
  GAME_TOKEN_NOT_AVAILABLE: 'GAME_TOKEN_NOT_AVAILABLE',
  GAME_TIMEOUT: 'GAME_TIMEOUT',
  
  // Rate limiting
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  
  // General
  INVALID_MESSAGE: 'INVALID_MESSAGE',
  SERVER_ERROR: 'SERVER_ERROR',
  DISCONNECTED: 'DISCONNECTED'
};

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

/**
 * Validates a message has required base fields
 * @param {Object} msg - Message to validate
 * @returns {{valid: boolean, error?: string}}
 */
function validateBaseMessage(msg) {
  if (!msg || typeof msg !== 'object') {
    return { valid: false, error: 'Message must be an object' };
  }
  
  if (!msg.type || typeof msg.type !== 'string') {
    return { valid: false, error: 'Message must have a type string' };
  }
  
  if (!msg.timestamp || typeof msg.timestamp !== 'number') {
    return { valid: false, error: 'Message must have a timestamp number' };
  }
  
  // Check timestamp is not too old or in the future (anti-cheat)
  const now = Date.now();
  const maxAge = 60000; // 1 minute
  if (msg.timestamp > now + 5000 || msg.timestamp < now - maxAge) {
    return { valid: false, error: 'Invalid timestamp' };
  }
  
  return { valid: true };
}

/**
 * Validates room code format
 * @param {string} code - Room code
 * @returns {{valid: boolean, error?: string}}
 */
function validateRoomCode(code) {
  if (!code || typeof code !== 'string') {
    return { valid: false, error: 'Room code is required' };
  }
  
  const normalized = code.toUpperCase().trim();
  
  if (normalized.length < VALIDATION_LIMITS.MIN_ROOM_CODE_LENGTH ||
      normalized.length > VALIDATION_LIMITS.MAX_ROOM_CODE_LENGTH) {
    return { valid: false, error: `Room code must be ${VALIDATION_LIMITS.MIN_ROOM_CODE_LENGTH}-${VALIDATION_LIMITS.MAX_ROOM_CODE_LENGTH} characters` };
  }
  
  if (!/^[A-Z0-9]+$/.test(normalized)) {
    return { valid: false, error: 'Room code must contain only letters and numbers' };
  }
  
  return { valid: true, normalized };
}

/**
 * Validates username
 * @param {string} username - Username
 * @returns {{valid: boolean, error?: string}}
 */
function validateUsername(username) {
  if (!username || typeof username !== 'string') {
    return { valid: false, error: 'Username is required' };
  }
  
  const trimmed = username.trim();
  
  if (trimmed.length === 0 || trimmed.length > VALIDATION_LIMITS.MAX_USERNAME_LENGTH) {
    return { valid: false, error: `Username must be 1-${VALIDATION_LIMITS.MAX_USERNAME_LENGTH} characters` };
  }
  
  // Basic sanitization
  const sanitized = trimmed.replace(/[<>\"\'&]/g, '');
  if (sanitized.length === 0) {
    return { valid: false, error: 'Username contains invalid characters' };
  }
  
  return { valid: true, sanitized };
}

/**
 * Validates dice roll value (server-side)
 * @param {number} value - Dice value
 * @returns {boolean}
 */
function validateDiceValue(value) {
  return Number.isInteger(value) && 
         value >= VALIDATION_LIMITS.MIN_DICE_VALUE && 
         value <= VALIDATION_LIMITS.MAX_DICE_VALUE;
}

/**
 * Validates token index
 * @param {number} index - Token index
 * @returns {boolean}
 */
function validateTokenIndex(index) {
  return Number.isInteger(index) && 
         index >= 0 && 
         index < VALIDATION_LIMITS.MAX_TOKENS_PER_PLAYER;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Creates a properly formatted message
 * @param {string} type - Message type
 * @param {Object} [payload] - Additional payload
 * @returns {Object} Formatted message
 */
function createMessage(type, payload = {}) {
  return {
    type,
    timestamp: Date.now(),
    ...payload
  };
}

/**
 * Generates a random room code
 * @param {number} length - Code length
 * @returns {string}
 */
function generateRoomCode(length = 6) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No I, O, 0, 1
  let code = '';
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Generates an anti-cheat nonce
 * @returns {string}
 */
function generateNonce() {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15);
}

// ============================================================================
// EXPORTS
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
  // Node.js environment
  module.exports = {
    MessageTypes,
    PlayerColor,
    TokenStatus,
    BOARD_CONFIG,
    GAME_TIMING,
    VALIDATION_LIMITS,
    ErrorCodes,
    validateBaseMessage,
    validateRoomCode,
    validateUsername,
    validateDiceValue,
    validateTokenIndex,
    createMessage,
    generateRoomCode,
    generateNonce
  };
} else {
  // Browser environment
  window.LudoProtocol = {
    MessageTypes,
    PlayerColor,
    TokenStatus,
    BOARD_CONFIG,
    GAME_TIMING,
    VALIDATION_LIMITS,
    ErrorCodes,
    validateBaseMessage,
    validateRoomCode,
    validateUsername,
    validateDiceValue,
    validateTokenIndex,
    createMessage,
    generateRoomCode,
    generateNonce
  };
}
