/**
 * UI Manager
 * Handles UI updates, modals, and notifications
 */

class UIManager {
  constructor() {
    this.toastTimeout = null;
  }
  
  /**
   * Show error toast notification
   * @param {string} message - Error message
   * @param {number} duration - Display duration in ms
   */
  showError(message, duration = 5000) {
    const toast = document.getElementById('error-toast');
    const messageEl = document.getElementById('error-message');
    
    if (!toast || !messageEl) return;
    
    toast.classList.remove('success');
    toast.classList.add('error');
    messageEl.textContent = message;
    toast.classList.add('show');
    
    if (this.toastTimeout) {
      clearTimeout(this.toastTimeout);
    }
    
    this.toastTimeout = setTimeout(() => {
      toast.classList.remove('show');
    }, duration);
  }
  
  /**
   * Show success toast notification
   * @param {string} message - Success message
   * @param {number} duration - Display duration in ms
   */
  showSuccess(message, duration = 3000) {
    const toast = document.getElementById('error-toast');
    const messageEl = document.getElementById('error-message');
    
    if (!toast || !messageEl) return;
    
    toast.classList.remove('error');
    toast.classList.add('success');
    messageEl.textContent = message;
    toast.classList.add('show');
    
    if (this.toastTimeout) {
      clearTimeout(this.toastTimeout);
    }
    
    this.toastTimeout = setTimeout(() => {
      toast.classList.remove('show');
    }, duration);
  }
  
  /**
   * Show game message
   * @param {string} message - Message to display
   */
  showGameMessage(message) {
    const el = document.getElementById('game-message');
    if (el) {
      el.textContent = message;
    }
  }
  
  /**
   * Update dice display
   * @param {number} value - Dice value (1-6)
   */
  updateDice(value) {
    const dice = document.getElementById('dice');
    if (!dice) return;
    
    dice.classList.remove('rolling');
    
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
   * Show game over modal
   * @param {Object} winner - Winner information
   */
  showGameOver(winner) {
    const modal = document.getElementById('game-over-modal');
    const display = document.getElementById('winner-display');
    
    if (!modal || !display) return;
    
    display.innerHTML = `
      <div class="winner-name">${this.escapeHtml(winner.username)}</div>
      <div>wins the game!</div>
    `;
    
    modal.classList.add('show');
  }
  
  /**
   * Hide game over modal
   */
  hideGameOver() {
    const modal = document.getElementById('game-over-modal');
    if (modal) {
      modal.classList.remove('show');
    }
  }
  
  /**
   * Update turn indicator
   * @param {string} playerName - Current player name
   * @param {string} color - Player color
   */
  updateTurnIndicator(playerName, color) {
    const el = document.getElementById('current-player-indicator');
    if (el) {
      el.textContent = `${playerName}'s Turn`;
      el.style.backgroundColor = `var(--color-${color})`;
    }
  }
  
  /**
   * Enable/disable dice button
   * @param {boolean} enabled
   */
  setDiceButtonEnabled(enabled) {
    const btn = document.getElementById('roll-dice-btn');
    if (btn) {
      btn.disabled = !enabled;
    }
  }
  
  /**
   * Escape HTML to prevent XSS
   * @param {string} text
   * @returns {string}
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
  
  /**
   * Cleanup
   */
  destroy() {
    if (this.toastTimeout) {
      clearTimeout(this.toastTimeout);
    }
  }
}

window.UIManager = UIManager;
