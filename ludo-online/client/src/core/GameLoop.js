/**
 * Game Loop
 * Main game loop using requestAnimationFrame for 60fps rendering
 */

class GameLoop {
  constructor(callback) {
    this.callback = callback;
    this.isRunning = false;
    this.lastFrameTime = 0;
    this.animationFrameId = null;
  }
  
  /**
   * Start the game loop
   */
  start() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.lastFrameTime = performance.now();
    this.loop(this.lastFrameTime);
  }
  
  /**
   * Stop the game loop
   */
  stop() {
    this.isRunning = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }
  
  /**
   * Main loop function
   * @param {number} currentTime - Current time in milliseconds
   */
  loop(currentTime) {
    if (!this.isRunning) return;
    
    const deltaTime = currentTime - this.lastFrameTime;
    this.lastFrameTime = currentTime;
    
    // Call the update callback with delta time
    if (this.callback) {
      this.callback(deltaTime, currentTime);
    }
    
    // Schedule next frame
    this.animationFrameId = requestAnimationFrame((time) => this.loop(time));
  }
  
  /**
   * Get current FPS
   * @returns {number} Approximate FPS
   */
  getFPS() {
    return Math.round(1000 / (this.lastFrameTime ? performance.now() - this.lastFrameTime : 16));
  }
}

window.GameLoop = GameLoop;
