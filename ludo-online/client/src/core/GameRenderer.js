/**
 * Game Renderer
 * Renders the Ludo board and tokens using DOM manipulation
 */

class GameRenderer {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.boardElement = null;
    this.tokens = new Map(); // playerId -> token elements
    this.animationFrame = null;
  }
  
  /**
   * Initialize and render the game board
   */
  init() {
    this.container.innerHTML = '';
    
    const board = document.createElement('div');
    board.className = 'board-grid';
    board.id = 'board-grid';
    
    // Create board cells
    this._createBases(board);
    this._createPath(board);
    this._createHomeStretches(board);
    
    this.container.appendChild(board);
    this.boardElement = board;
    
    return this;
  }
  
  /**
   * Create player bases (4 corners)
   * @private
   */
  _createBases(board) {
    const colors = ['red', 'green', 'yellow', 'blue'];
    const positions = [
      { row: 1, col: 1 },      // Red (top-left)
      { row: 1, col: 10 },     // Green (top-right)
      { row: 10, col: 1 },     // Yellow (bottom-left)
      { row: 10, col: 10 }     // Blue (bottom-right)
    ];
    
    colors.forEach((color, index) => {
      const base = document.createElement('div');
      base.className = `base ${color}`;
      base.style.gridRow = `${positions[index].row} / span 6`;
      base.style.gridColumn = `${positions[index].col} / span 6`;
      
      const baseInner = document.createElement('div');
      baseInner.className = 'base-inner';
      
      // Create 4 token slots
      for (let i = 0; i < 4; i++) {
        const slot = document.createElement('div');
        slot.className = 'token-slot';
        slot.dataset.playerColor = color;
        slot.dataset.tokenIndex = i;
        baseInner.appendChild(slot);
      }
      
      base.appendChild(baseInner);
      board.appendChild(base);
    });
  }
  
  /**
   * Create the path around the board
   * @private
   */
  _createPath(board) {
    // Define path cells (simplified - actual Ludo has 52 cells)
    const pathCells = this._getPathCoordinates();
    
    pathCells.forEach((pos, index) => {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.style.gridRow = pos.row;
      cell.style.gridColumn = pos.col;
      cell.dataset.cellIndex = index;
      
      // Mark safe cells
      const safeCells = [0, 8, 13, 21, 26, 34, 39, 47];
      if (safeCells.includes(index)) {
        cell.classList.add('safe');
        cell.textContent = '★';
      }
      
      board.appendChild(cell);
    });
  }
  
  /**
   * Get coordinates for path cells
   * @private
   * @returns {Array} Array of {row, col} objects
   */
  _getPathCoordinates() {
    const coords = [];
    
    // This is a simplified path - real implementation would map all 52 cells
    // Top row (left to right)
    for (let col = 7; col <= 9; col++) coords.push({ row: 7, col });
    // Continue around the board...
    // For brevity, returning placeholder
    for (let i = coords.length; i < 52; i++) {
      coords.push({ row: Math.floor(i / 15) + 1, col: (i % 15) + 1 });
    }
    
    return coords;
  }
  
  /**
   * Create home stretches
   * @private
   */
  _createHomeStretches(board) {
    const colors = ['red', 'green', 'yellow', 'blue'];
    const positions = [
      { row: 8, col: 2, span: 6 },   // Red
      { row: 2, col: 8, span: 6 },   // Green
      { row: 8, col: 10, span: 6 },  // Yellow
      { row: 10, col: 8, span: 6 }   // Blue
    ];
    
    colors.forEach((color, index) => {
      const stretch = document.createElement('div');
      stretch.className = 'home-stretch';
      stretch.style.gridRow = positions[index].row;
      stretch.style.gridColumn = `${positions[index].col} / span ${positions[index].span}`;
      
      // Create 6 cells in home stretch
      for (let i = 0; i < 6; i++) {
        const cell = document.createElement('div');
        cell.className = `cell ${color}`;
        cell.dataset.homeStretch = true;
        cell.dataset.color = color;
        cell.dataset.index = i;
        stretch.appendChild(cell);
      }
      
      board.appendChild(stretch);
    });
    
    // Center home
    const home = document.createElement('div');
    home.className = 'home';
    home.style.gridRow = '8 / span 3';
    home.style.gridColumn = '8 / span 3';
    home.textContent = '🏠';
    board.appendChild(home);
  }
  
  /**
   * Render tokens for all players
   * @param {Array} players - Player data with tokens
   */
  renderTokens(players) {
    // Clear existing tokens
    this.clearTokens();
    
    players.forEach(player => {
      player.tokens.forEach(token => {
        this._createTokenElement(player, token);
      });
    });
  }
  
  /**
   * Create a single token element
   * @private
   * @param {Object} player - Player object
   * @param {Object} token - Token object
   */
  _createTokenElement(player, token) {
    const tokenEl = document.createElement('div');
    tokenEl.className = 'token';
    tokenEl.style.backgroundColor = this._getColorForPlayer(player.color);
    tokenEl.dataset.playerId = player.id;
    tokenEl.dataset.tokenIndex = token.index;
    
    // Position based on token status
    this._positionToken(tokenEl, token, player.color);
    
    this.container.appendChild(tokenEl);
    this.tokens.set(`${player.id}-${token.index}`, tokenEl);
  }
  
  /**
   * Position a token based on its state
   * @private
   * @param {HTMLElement} tokenEl - Token element
   * @param {Object} token - Token data
   * @param {string} color - Player color
   */
  _positionToken(tokenEl, token, color) {
    if (token.status === 0) { // IN_BASE
      const baseSlot = this.container.querySelector(
        `.token-slot[data-player-color="${color}"][data-token-index="${token.index}"]`
      );
      if (baseSlot) {
        const rect = baseSlot.getBoundingClientRect();
        const containerRect = this.container.getBoundingClientRect();
        tokenEl.style.position = 'absolute';
        tokenEl.style.left = (rect.left - containerRect.left + rect.width/2) + 'px';
        tokenEl.style.top = (rect.top - containerRect.top + rect.height/2) + 'px';
      }
    } else if (token.status >= 1) { // ON_BOARD or beyond
      // Position on path (simplified)
      const cellIndex = token.position % 52;
      const cell = this.container.querySelector(`[data-cell-index="${cellIndex}"]`);
      if (cell) {
        const rect = cell.getBoundingClientRect();
        const containerRect = this.container.getBoundingClientRect();
        tokenEl.style.left = (rect.left - containerRect.left + rect.width/2) + 'px';
        tokenEl.style.top = (rect.top - containerRect.top + rect.height/2) + 'px';
      }
    }
  }
  
  /**
   * Get color string for player
   * @private
   * @param {string} color - Color name
   * @returns {string} CSS color
   */
  _getColorForPlayer(color) {
    const colors = {
      red: '#e74c3c',
      green: '#2ecc71',
      yellow: '#f1c40f',
      blue: '#3498db'
    };
    return colors[color] || '#999';
  }
  
  /**
   * Clear all token elements
   */
  clearTokens() {
    this.container.querySelectorAll('.token').forEach(el => el.remove());
    this.tokens.clear();
  }
  
  /**
   * Highlight movable tokens
   * @param {Array} movableTokens - Array of token indices that can move
   */
  highlightMovableTokens(movableTokens) {
    movableTokens.forEach(index => {
      const tokenEl = this.container.querySelector(`.token[data-token-index="${index}"].movable`);
      if (tokenEl) {
        tokenEl.classList.add('movable');
      }
    });
  }
  
  /**
   * Remove movable highlights
   */
  clearHighlights() {
    this.container.querySelectorAll('.token.movable').forEach(el => {
      el.classList.remove('movable');
    });
  }
  
  /**
   * Animate token movement
   * @param {string} playerId - Player ID
   * @param {number} tokenIndex - Token index
   * @param {Object} fromPos - Starting position
   * @param {Object} toPos - Ending position
   * @param {number} duration - Animation duration in ms
   * @returns {Promise}
   */
  animateTokenMove(playerId, tokenIndex, fromPos, toPos, duration = 500) {
    return new Promise(resolve => {
      const tokenKey = `${playerId}-${tokenIndex}`;
      const tokenEl = this.tokens.get(tokenKey);
      
      if (!tokenEl) {
        return resolve();
      }
      
      tokenEl.style.transition = `all ${duration}ms ease`;
      tokenEl.style.left = toPos.x + 'px';
      tokenEl.style.top = toPos.y + 'px';
      
      setTimeout(() => {
        tokenEl.style.transition = '';
        resolve();
      }, duration);
    });
  }
  
  /**
   * Update dice display
   * @param {number} value - Dice value (1-6)
   */
  updateDice(value) {
    const dice = document.getElementById('dice');
    if (!dice) return;
    
    // Remove rolling class
    dice.classList.remove('rolling');
    
    // Rotate to show correct face
    const rotations = {
      1: 'rotateY(0deg)',
      2: 'rotateY(-90deg)',
      3: 'rotateY(-180deg)',
      4: 'rotateY(90deg)',
      5: 'rotateX(-90deg)',
      6: 'rotateX(90deg)'
    };
    
    dice.style.transform = rotations[value] || rotations[1];
  }
  
  /**
   * Trigger dice roll animation
   */
  rollDiceAnimation() {
    const dice = document.getElementById('dice');
    if (dice) {
      dice.classList.add('rolling');
    }
  }
  
  /**
   * Cleanup renderer
   */
  destroy() {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
    }
    this.container.innerHTML = '';
  }
}

// Export for browser
window.GameRenderer = GameRenderer;
