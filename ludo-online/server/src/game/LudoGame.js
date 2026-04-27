/**
 * Ludo Game Engine
 * Server-authoritative game logic, rules validation, and state management
 */

const { 
  PlayerColor, 
  TokenStatus, 
  BOARD_CONFIG, 
  GAME_TIMING,
  VALIDATION_LIMITS,
  ErrorCodes 
} = require('../../../shared/protocol');

/**
 * @class LudoGame
 * Represents a single Ludo game instance
 */
class LudoGame {
  /**
   * Create a new game instance
   * @param {string} roomId - Unique room identifier
   * @param {Array} players - Array of player objects
   */
  constructor(roomId, players) {
    this.roomId = roomId;
    this.players = players.map((p, index) => ({
      ...p,
      color: Object.values(PlayerColor)[index],
      turnOrder: index
    }));
    
    // Initialize game state
    this.state = {
      status: 'waiting', // waiting, playing, finished
      currentPlayerIndex: 0,
      diceValue: null,
      hasRolled: false,
      consecutiveSixes: 0,
      sequenceNumber: 0,
      lastActionTime: Date.now(),
      players: this.players.map(player => ({
        id: player.id,
        username: player.username,
        color: player.color,
        turnOrder: player.turnOrder,
        tokens: this._initializeTokens(player.color),
        hasWon: false,
        rank: null
      })),
      winner: null,
      log: []
    };
    
    // Track finished players for ranking
    this.finishedCount = 0;
  }
  
  /**
   * Initialize tokens for a player
   * @private
   * @param {string} color - Player color
   * @returns {Array} Array of token objects
   */
  _initializeTokens(color) {
    return Array(VALIDATION_LIMITS.MAX_TOKENS_PER_PLAYER).fill(null).map((_, index) => ({
      index,
      status: TokenStatus.IN_BASE,
      position: -1, // -1 means in base
      movesFromStart: 0
    }));
  }
  
  /**
   * Get the current player
   * @returns {Object} Current player object
   */
  getCurrentPlayer() {
    return this.state.players[this.state.currentPlayerIndex];
  }
  
  /**
   * Check if it's a player's turn
   * @param {string} playerId - Player ID to check
   * @returns {boolean}
   */
  isPlayerTurn(playerId) {
    const currentPlayer = this.getCurrentPlayer();
    return currentPlayer && currentPlayer.id === playerId;
  }
  
  /**
   * Validate and execute a dice roll
   * Server-authoritative: generates the actual dice value
   * @param {string} playerId - Player requesting the roll
   * @param {string} nonce - Anti-cheat nonce from client
   * @returns {{success: boolean, diceValue?: number, error?: string}}
   */
  rollDice(playerId, nonce) {
    // Validate it's the player's turn
    if (!this.isPlayerTurn(playerId)) {
      return { success: false, error: ErrorCodes.GAME_NOT_YOUR_TURN };
    }
    
    // Validate they haven't already rolled
    if (this.state.hasRolled) {
      return { success: false, error: 'Already rolled' };
    }
    
    // Generate server-authoritative dice value
    const diceValue = Math.floor(Math.random() * 6) + 1;
    
    // Update state
    this.state.diceValue = diceValue;
    this.state.hasRolled = true;
    this.state.lastActionTime = Date.now();
    this.state.consecutiveSixes = diceValue === 6 ? this.state.consecutiveSixes + 1 : 0;
    
    // Log action
    this._logAction('dice_roll', { playerId, diceValue, nonce });
    
    // Check for three consecutive sixes (penalty rule)
    if (this.state.consecutiveSixes >= 3) {
      this.state.consecutiveSixes = 0;
      this.state.diceValue = 0; // Lose turn
      this._advanceTurn();
      return { 
        success: true, 
        diceValue: 0, 
        message: 'Three sixes! Turn lost.' 
      };
    }
    
    return { success: true, diceValue };
  }
  
  /**
   * Validate and execute a token move
   * @param {string} playerId - Player requesting the move
   * @param {number} tokenIndex - Which token to move (0-3)
   * @param {string} nonce - Anti-cheat nonce
   * @returns {{success: boolean, moved?: boolean, captured?: Object, error?: string}}
   */
  moveToken(playerId, tokenIndex, nonce) {
    // Validate turn
    if (!this.isPlayerTurn(playerId)) {
      return { success: false, error: ErrorCodes.GAME_NOT_YOUR_TURN };
    }
    
    // Validate dice has been rolled
    if (!this.state.hasRolled || this.state.diceValue === null) {
      return { success: false, error: 'Must roll dice first' };
    }
    
    const player = this.state.players.find(p => p.id === playerId);
    const token = player.tokens[tokenIndex];
    const diceValue = this.state.diceValue;
    
    // Validate token exists and can move
    if (!token) {
      return { success: false, error: ErrorCodes.GAME_TOKEN_NOT_AVAILABLE };
    }
    
    // Calculate if move is valid
    const moveResult = this._validateMove(token, diceValue, player.color);
    
    if (!moveResult.valid) {
      return { success: false, error: moveResult.error };
    }
    
    // Execute the move
    const captureInfo = this._executeMove(token, player, diceValue);
    
    // Check for win condition
    const won = this._checkWinCondition(player);
    
    // Advance turn (unless rolled 6)
    if (diceValue !== 6) {
      this._advanceTurn();
    } else {
      this.state.hasRolled = false; // Extra turn for rolling 6
    }
    
    this.state.lastActionTime = Date.now();
    this._incrementSequence();
    this._logAction('token_move', { playerId, tokenIndex, diceValue, nonce });
    
    return {
      success: true,
      moved: true,
      captured: captureInfo,
      extraTurn: diceValue === 6,
      won
    };
  }
  
  /**
   * Validate if a token can move with given dice value
   * @private
   * @param {Object} token - Token object
   * @param {number} diceValue - Dice roll value
   * @param {string} color - Player color
   * @returns {{valid: boolean, error?: string}}
   */
  _validateMove(token, diceValue, color) {
    // Token in base: need 6 to exit
    if (token.status === TokenStatus.IN_BASE) {
      if (diceValue !== 6) {
        return { valid: false, error: 'Need 6 to leave base' };
      }
      return { valid: true };
    }
    
    // Token at home: cannot move
    if (token.status === TokenStatus.AT_HOME) {
      return { valid: false, error: 'Token already at home' };
    }
    
    // Calculate new position
    const newPos = this._calculateNewPosition(token, diceValue, color);
    
    // Check if move exceeds home
    if (newPos.exceedsHome) {
      return { valid: false, error: 'Exact roll needed to reach home' };
    }
    
    return { valid: true };
  }
  
  /**
   * Calculate new position after move
   * @private
   * @param {Object} token - Token object
   * @param {number} diceValue - Dice roll value
   * @param {string} color - Player color
   * @returns {{position: number, exceedsHome: boolean}}
   */
  _calculateNewPosition(token, diceValue, color) {
    const homeEntryOffset = BOARD_CONFIG.HOME_ENTRY_OFFSET[color];
    const totalBoardCells = BOARD_CONFIG.TOTAL_CELLS;
    const homeStretchLength = BOARD_CONFIG.HOME_STRETCH_LENGTH;
    
    // If in home stretch
    if (token.status === TokenStatus.IN_HOME_STRETCH) {
      const newPos = token.position + diceValue;
      const maxHomePos = homeStretchLength - 1; // 0-indexed
      
      if (newPos > maxHomePos) {
        return { position: newPos, exceedsHome: true };
      }
      return { position: newPos, exceedsHome: false };
    }
    
    // On main board
    const currentBoardPos = token.position;
    let newBoardPos = (currentBoardPos + diceValue) % totalBoardCells;
    
    // Check if entering home stretch
    const stepsFromStart = token.movesFromStart + diceValue;
    const stepsToHomeEntry = totalBoardCells - homeEntryOffset;
    
    if (stepsFromStart >= stepsToHomeEntry) {
      // Entering home stretch
      const homeStretchPos = stepsFromStart - stepsToHomeEntry;
      
      if (homeStretchPos >= homeStretchLength) {
        return { position: homeStretchPos, exceedsHome: true };
      }
      
      return { 
        position: homeStretchPos, 
        exceedsHome: false,
        enteringHomeStretch: true 
      };
    }
    
    return { position: newBoardPos, exceedsHome: false };
  }
  
  /**
   * Execute the token move and handle captures
   * @private
   * @param {Object} token - Token to move
   * @param {Object} player - Player object
   * @param {number} diceValue - Dice roll value
   * @returns {Object|null} Capture information if capture occurred
   */
  _executeMove(token, player, diceValue) {
    const color = player.color;
    let captureInfo = null;
    
    // Handle leaving base
    if (token.status === TokenStatus.IN_BASE) {
      token.status = TokenStatus.ON_BOARD;
      token.position = BOARD_CONFIG.START_POSITIONS[color];
      token.movesFromStart = 0;
      return null;
    }
    
    // Calculate new position
    const moveResult = this._calculateNewPosition(token, diceValue, color);
    
    // Update token
    if (moveResult.enteringHomeStretch) {
      token.status = TokenStatus.IN_HOME_STRETCH;
    }
    
    token.position = moveResult.position;
    token.movesFromStart += diceValue;
    
    // Check if reached home
    if (token.status === TokenStatus.IN_HOME_STRETCH && 
        token.position === BOARD_CONFIG.HOME_STRETCH_LENGTH - 1) {
      token.status = TokenStatus.AT_HOME;
    }
    
    // Check for captures (only on main board, not on safe squares)
    if (token.status === TokenStatus.ON_BOARD) {
      captureInfo = this._checkCapture(token.position, player.id);
    }
    
    return captureInfo;
  }
  
  /**
   * Check if move results in capturing opponent tokens
   * @private
   * @param {number} position - Position to check
   * @param {string} playerId - Moving player's ID
   * @returns {Object|null} Capture information
   */
  _checkCapture(position, playerId) {
    // Safe squares cannot capture
    if (BOARD_CONFIG.SAFE_CELLS.includes(position)) {
      return null;
    }
    
    const captured = [];
    
    // Check all other players' tokens
    for (const player of this.state.players) {
      if (player.id === playerId) continue;
      
      for (const token of player.tokens) {
        if (token.status === TokenStatus.ON_BOARD && token.position === position) {
          // Send token back to base
          token.status = TokenStatus.IN_BASE;
          token.position = -1;
          token.movesFromStart = 0;
          captured.push({
            playerId: player.id,
            username: player.username,
            color: player.color,
            tokenIndex: token.index
          });
        }
      }
    }
    
    if (captured.length > 0) {
      this._logAction('capture', { position, capturedBy: playerId, captured });
      return { count: captured.length, captured };
    }
    
    return null;
  }
  
  /**
   * Check if player has won (all tokens at home)
   * @private
   * @param {Object} player - Player to check
   * @returns {boolean}
   */
  _checkWinCondition(player) {
    const allAtHome = player.tokens.every(t => t.status === TokenStatus.AT_HOME);
    
    if (allAtHome && !player.hasWon) {
      player.hasWon = true;
      this.finishedCount++;
      player.rank = this.finishedCount;
      
      this._logAction('player_finished', { 
        playerId: player.id, 
        rank: this.finishedCount 
      });
      
      // Check if game is over
      if (this.finishedCount >= this.state.players.length - 1) {
        this._endGame();
      }
      
      return true;
    }
    
    return false;
  }
  
  /**
   * Advance to next player's turn
   * @private
   */
  _advanceTurn() {
    this.state.hasRolled = false;
    this.state.diceValue = null;
    this.state.consecutiveSixes = 0;
    
    // Find next player who hasn't won
    let attempts = 0;
    do {
      this.state.currentPlayerIndex = (this.state.currentPlayerIndex + 1) % this.state.players.length;
      attempts++;
    } while (
      this.state.players[this.state.currentPlayerIndex].hasWon && 
      attempts < this.state.players.length
    );
    
    this.state.lastActionTime = Date.now();
    this._incrementSequence();
    this._logAction('turn_change', { 
      newPlayerIndex: this.state.currentPlayerIndex 
    });
  }
  
  /**
   * End the game
   * @private
   */
  _endGame() {
    this.state.status = 'finished';
    
    // Determine winner (first to finish)
    const winner = this.state.players.find(p => p.rank === 1);
    if (winner) {
      this.state.winner = {
        playerId: winner.id,
        username: winner.username,
        color: winner.color
      };
    }
    
    this._logAction('game_over', { winner: this.state.winner });
  }
  
  /**
   * Increment sequence number for delta compression
   * @private
   */
  _incrementSequence() {
    this.state.sequenceNumber++;
  }
  
  /**
   * Log an action for replay/debugging
   * @private
   * @param {string} type - Action type
   * @param {Object} data - Action data
   */
  _logAction(type, data) {
    this.state.log.push({
      timestamp: Date.now(),
      type,
      data
    });
    
    // Keep log size manageable
    if (this.state.log.length > 100) {
      this.state.log.shift();
    }
  }
  
  /**
   * Get current game state
   * @returns {Object} Game state
   */
  getState() {
    return {
      ...this.state,
      players: this.state.players.map(p => ({
        id: p.id,
        username: p.username,
        color: p.color,
        tokens: p.tokens.map(t => ({
          index: t.index,
          status: t.status,
          position: t.position,
          movesFromStart: t.movesFromStart
        })),
        hasWon: p.hasWon,
        rank: p.rank
      }))
    };
  }
  
  /**
   * Check if game has timed out
   * @returns {boolean}
   */
  isTimedOut() {
    if (this.state.status !== 'playing') return false;
    return Date.now() - this.state.lastActionTime > GAME_TIMING.TURN_TIMEOUT_MS;
  }
  
  /**
   * Start the game
   */
  start() {
    if (this.state.status !== 'waiting') {
      return { success: false, error: 'Game already started' };
    }
    
    if (this.players.length < 2) {
      return { success: false, error: 'Need at least 2 players' };
    }
    
    this.state.status = 'playing';
    this.state.lastActionTime = Date.now();
    this._logAction('game_started', { playerCount: this.players.length });
    
    return { success: true };
  }
}

module.exports = LudoGame;
