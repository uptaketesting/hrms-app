/**
 * Input Handler
 * Handles user input for game interactions
 */

class InputHandler {
  constructor(game) {
    this.game = game;
    this.setupListeners();
  }
  
  setupListeners() {
    // Token click handling
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('token')) {
        this.handleTokenClick(e.target);
      }
    });
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.code === 'Space') {
        e.preventDefault();
        this.handleSpacebar();
      }
    });
  }
  
  handleTokenClick(tokenEl) {
    if (!this.game || !this.game.isMyTurn) return;
    
    const playerId = tokenEl.dataset.playerId;
    const tokenIndex = parseInt(tokenEl.dataset.tokenIndex, 10);
    
    if (playerId !== this.game.playerId) return;
    
    // Send move request
    this.game.moveToken(tokenIndex);
  }
  
  handleSpacebar() {
    if (!this.game) return;
    
    if (!this.game.hasRolled && this.game.isMyTurn) {
      this.game.rollDice();
    }
  }
}

window.InputHandler = InputHandler;
