/**
 * Ludo Online - Main Application Entry Point
 * Initializes and coordinates all game systems
 */

(function() {
  'use strict';
  
  // ============================================================================
  // APPLICATION STATE
  // ============================================================================
  
  const AppState = {
    screen: 'loading',
    player: {
      id: null,
      username: null,
      token: null
    },
    room: {
      id: null,
      code: null,
      players: []
    },
    game: {
      state: null,
      isMyTurn: false,
      hasRolled: false
    },
    ws: null
  };
  
  // ============================================================================
  // DOM ELEMENTS
  // ============================================================================
  
  const Elements = {};
  
  function cacheElements() {
    // Screens
    Elements.screens = {
      loading: document.getElementById('loading-screen'),
      login: document.getElementById('login-screen'),
      lobby: document.getElementById('lobby-screen'),
      room: document.getElementById('room-screen'),
      game: document.getElementById('game-screen')
    };
    
    // Forms & Inputs
    Elements.loginForm = document.getElementById('login-form');
    Elements.usernameInput = document.getElementById('username');
    
    // Lobby
    Elements.playerNameDisplay = document.getElementById('player-name-display');
    Elements.logoutBtn = document.getElementById('logout-btn');
    Elements.createRoomBtn = document.getElementById('create-room-btn');
    Elements.joinRoomBtn = document.getElementById('join-room-btn');
    Elements.roomCodeInput = document.getElementById('room-code-input');
    Elements.refreshRoomsBtn = document.getElementById('refresh-rooms-btn');
    Elements.roomsList = document.getElementById('rooms-list');
    
    // Room
    Elements.roomCodeDisplay = document.getElementById('room-code-display');
    Elements.copyRoomCodeBtn = document.getElementById('copy-room-code-btn');
    Elements.leaveRoomBtn = document.getElementById('leave-room-btn');
    Elements.playersList = document.getElementById('players-list');
    Elements.playerCount = document.getElementById('player-count');
    Elements.startGameBtn = document.getElementById('start-game-btn');
    Elements.roomStatus = document.getElementById('room-status');
    
    // Game
    Elements.gameBoard = document.getElementById('game-board');
    Elements.rollDiceBtn = document.getElementById('roll-dice-btn');
    Elements.diceContainer = document.getElementById('dice-container');
    Elements.currentPlayerIndicator = document.getElementById('current-player-indicator');
    Elements.gameMessage = document.getElementById('game-message');
    Elements.gamePlayersList = document.getElementById('game-players-list');
    Elements.gameRoomCode = document.getElementById('game-room-code');
    Elements.connectionStatus = document.getElementById('connection-status');
    Elements.quitGameBtn = document.getElementById('quit-game-btn');
    
    // Modal
    Elements.gameOverModal = document.getElementById('game-over-modal');
    Elements.winnerDisplay = document.getElementById('winner-display');
    Elements.playAgainBtn = document.getElementById('play-again-btn');
    Elements.backToLobbyBtn = document.getElementById('back-to-lobby-btn');
    
    // Toast
    Elements.errorToast = document.getElementById('error-toast');
    Elements.errorMessage = document.getElementById('error-message');
  }
  
  // ============================================================================
  // SCREEN MANAGEMENT
  // ============================================================================
  
  function showScreen(screenName) {
    Object.values(Elements.screens).forEach(screen => {
      screen.classList.remove('active');
    });
    
    if (Elements.screens[screenName]) {
      Elements.screens[screenName].classList.add('active');
      AppState.screen = screenName;
    }
  }
  
  // ============================================================================
  // WEBSOCKET SETUP
  // ============================================================================
  
  function initWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    AppState.ws = new WebSocketClient(wsUrl);
    
    // Register message handlers
    registerMessageHandlers();
    
    return AppState.ws.connect();
  }
  
  function registerMessageHandlers() {
    const ws = AppState.ws;
    
    // Connection acknowledgment
    ws.on('connection:ack', (msg) => {
      console.log('[App] Connected to server');
    });
    
    // Authentication response
    ws.on('auth:response', (msg) => {
      if (msg.success) {
        AppState.player.id = msg.playerId;
        AppState.player.username = msg.username;
        AppState.player.token = msg.token;
        
        // Store in localStorage for persistence
        localStorage.setItem('ludo_player', JSON.stringify({
          id: msg.playerId,
          username: msg.username,
          token: msg.token
        }));
        
        showScreen('lobby');
        updatePlayerInfo();
      } else {
        showError(msg.error || 'Authentication failed');
      }
    });
    
    // Room updates
    ws.on('room:update', handleRoomUpdate);
    
    // Game state
    ws.on('game:state', handleGameState);
    
    // Dice result
    ws.on('dice:result', handleDiceResult);
    
    // Token moved
    ws.on('token:moved', handleTokenMoved);
    
    // Game over
    ws.on('game:over', handleGameOver);
    
    // Error
    ws.on('error', (msg) => {
      showError(msg.message || 'An error occurred');
    });
    
    // Disconnected
    ws.on('disconnected', () => {
      updateConnectionStatus(false);
      showError('Disconnected from server. Reconnecting...');
    });
  }
  
  // ============================================================================
  // MESSAGE HANDLERS
  // ============================================================================
  
  function handleRoomUpdate(msg) {
    switch (msg.action) {
      case 'created':
        AppState.room.id = msg.roomId;
        AppState.room.code = msg.roomCode;
        AppState.room.players = msg.players;
        showScreen('room');
        updateRoomDisplay();
        break;
        
      case 'player_joined':
        AppState.room.players = msg.players;
        updateRoomDisplay();
        break;
        
      case 'player_left':
        AppState.room.players = msg.players;
        updateRoomDisplay();
        break;
    }
  }
  
  function handleGameState(msg) {
    AppState.game.state = msg.state;
    updateGameDisplay();
  }
  
  function handleDiceResult(msg) {
    // Update dice display
    if (typeof msg.diceValue === 'number') {
      window.renderer.updateDice(msg.diceValue);
    }
    
    // Update game state
    if (msg.gameState) {
      AppState.game.state = msg.gameState;
      updateGameDisplay();
    }
    
    // Show message
    if (msg.message) {
      showMessage(msg.message);
    }
  }
  
  function handleTokenMoved(msg) {
    // Update game state
    if (msg.gameState) {
      AppState.game.state = msg.gameState;
      updateGameDisplay();
    }
    
    // Show capture message
    if (msg.captured && msg.captured.count > 0) {
      showMessage(`Captured ${msg.captured.count} token(s)!`);
    }
  }
  
  function handleGameOver(msg) {
    // Show game over modal
    if (msg.winner) {
      Elements.winnerDisplay.innerHTML = `
        <div class="winner-name">${escapeHtml(msg.winner.username)}</div>
        <div>wins the game!</div>
      `;
    }
    Elements.gameOverModal.classList.add('show');
  }
  
  // ============================================================================
  // UI UPDATES
  // ============================================================================
  
  function updatePlayerInfo() {
    if (AppState.player.username) {
      Elements.playerNameDisplay.textContent = AppState.player.username;
    }
  }
  
  function updateRoomDisplay() {
    Elements.roomCodeDisplay.textContent = AppState.room.code;
    Elements.playerCount.textContent = AppState.room.players.length;
    
    // Update players list
    Elements.playersList.innerHTML = AppState.room.players.map(p => `
      <div class="player-card ${p.role === 'host' ? 'host' : ''}">
        <span class="player-avatar">👤</span>
        <span>${escapeHtml(p.username)}</span>
        ${p.role === 'host' ? '<span>(Host)</span>' : ''}
      </div>
    `).join('');
    
    // Enable start button if host and 2+ players
    const isHost = AppState.room.players.find(p => p.id === AppState.player.id)?.role === 'host';
    Elements.startGameBtn.disabled = !isHost || AppState.room.players.length < 2;
    
    if (AppState.room.players.length < 2) {
      Elements.roomStatus.textContent = 'Waiting for more players...';
    } else if (isHost) {
      Elements.roomStatus.textContent = 'Ready to start!';
    } else {
      Elements.roomStatus.textContent = 'Waiting for host to start...';
    }
  }
  
  function updateGameDisplay() {
    const state = AppState.game.state;
    if (!state) return;
    
    // Render tokens
    if (window.renderer) {
      window.renderer.renderTokens(state.players);
    }
    
    // Update turn indicator
    const currentPlayer = state.players[state.currentPlayerIndex];
    if (currentPlayer) {
      Elements.currentPlayerIndicator.textContent = `${capitalize(currentPlayer.color)}'s Turn`;
      Elements.currentPlayerIndicator.style.color = `var(--color-${currentPlayer.color})`;
    }
    
    // Check if it's my turn
    const myPlayer = state.players.find(p => p.id === AppState.player.id);
    AppState.game.isMyTurn = myPlayer && state.players.indexOf(myPlayer) === state.currentPlayerIndex;
    AppState.game.hasRolled = state.hasRolled;
    
    // Update dice button
    Elements.rollDiceBtn.disabled = !AppState.game.isMyTurn || AppState.game.hasRolled;
    
    if (AppState.game.isMyTurn && !AppState.game.hasRolled) {
      Elements.gameMessage.textContent = 'Your turn! Roll the dice.';
    } else if (AppState.game.isMyTurn) {
      Elements.gameMessage.textContent = 'Select a token to move.';
    } else {
      Elements.gameMessage.textContent = "Waiting for other players...";
    }
    
    // Update players panel
    Elements.gamePlayersList.innerHTML = state.players.map(p => `
      <div class="game-player-item ${state.players.indexOf(p) === state.currentPlayerIndex ? 'current-turn' : ''}">
        <span style="color: var(--color-${p.color})">●</span>
        <span>${escapeHtml(p.username)}</span>
        ${p.hasWon ? '🏆' : ''}
      </div>
    `).join('');
  }
  
  function updateConnectionStatus(connected) {
    if (connected) {
      Elements.connectionStatus.classList.add('connected');
      Elements.connectionStatus.classList.remove('disconnected');
    } else {
      Elements.connectionStatus.classList.add('disconnected');
      Elements.connectionStatus.classList.remove('connected');
    }
  }
  
  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================
  
  function setupEventListeners() {
    // Login
    Elements.loginForm.addEventListener('submit', handleLogin);
    
    // Lobby
    Elements.logoutBtn.addEventListener('click', handleLogout);
    Elements.createRoomBtn.addEventListener('click', handleCreateRoom);
    Elements.joinRoomBtn.addEventListener('click', handleJoinRoom);
    Elements.refreshRoomsBtn.addEventListener('click', handleRefreshRooms);
    
    // Room
    Elements.copyRoomCodeBtn.addEventListener('click', handleCopyRoomCode);
    Elements.leaveRoomBtn.addEventListener('click', handleLeaveRoom);
    Elements.startGameBtn.addEventListener('click', handleStartGame);
    
    // Game
    Elements.rollDiceBtn.addEventListener('click', handleRollDice);
    Elements.quitGameBtn.addEventListener('click', handleQuitGame);
    
    // Modal
    Elements.playAgainBtn.addEventListener('click', handlePlayAgain);
    Elements.backToLobbyBtn.addEventListener('click', handleBackToLobby);
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && AppState.screen === 'game') {
        e.preventDefault();
        if (!Elements.rollDiceBtn.disabled) {
          handleRollDice();
        }
      }
    });
  }
  
  function handleLogin(e) {
    e.preventDefault();
    const username = Elements.usernameInput.value.trim();
    
    if (!username) {
      showError('Please enter a username');
      return;
    }
    
    showScreen('loading');
    
    AppState.ws.send({
      type: 'auth:request',
      timestamp: Date.now(),
      username
    });
  }
  
  function handleLogout() {
    // Clear stored data
    localStorage.removeItem('ludo_player');
    AppState.player = { id: null, username: null, token: null };
    showScreen('login');
  }
  
  function handleCreateRoom() {
    AppState.ws.send({
      type: 'room:create',
      timestamp: Date.now()
    });
  }
  
  function handleJoinRoom() {
    const roomCode = Elements.roomCodeInput.value.trim();
    
    if (!roomCode) {
      showError('Please enter a room code');
      return;
    }
    
    AppState.ws.send({
      type: 'room:join',
      timestamp: Date.now(),
      roomCode: roomCode.toUpperCase()
    });
  }
  
  function handleRefreshRooms() {
    AppState.ws.send({
      type: 'room:list',
      timestamp: Date.now()
    });
  }
  
  function handleCopyRoomCode() {
    navigator.clipboard.writeText(AppState.room.code).then(() => {
      showMessage('Room code copied!');
    }).catch(() => {
      showError('Failed to copy');
    });
  }
  
  function handleLeaveRoom() {
    AppState.ws.send({
      type: 'room:leave',
      timestamp: Date.now(),
      roomId: AppState.room.id
    });
    
    AppState.room = { id: null, code: null, players: [] };
    showScreen('lobby');
  }
  
  function handleStartGame() {
    AppState.ws.send({
      type: 'room:start',
      timestamp: Date.now(),
      roomId: AppState.room.id
    });
    
    showScreen('game');
  }
  
  function handleRollDice() {
    const nonce = generateNonce();
    
    AppState.ws.send({
      type: 'dice:roll',
      timestamp: Date.now(),
      roomId: AppState.room.id,
      playerId: AppState.player.id,
      nonce
    });
    
    // Show rolling animation
    if (window.renderer) {
      window.renderer.rollDiceAnimation();
    }
  }
  
  function handleQuitGame() {
    handleLeaveRoom();
  }
  
  function handlePlayAgain() {
    Elements.gameOverModal.classList.remove('show');
    handleStartGame();
  }
  
  function handleBackToLobby() {
    Elements.gameOverModal.classList.remove('show');
    handleLeaveRoom();
  }
  
  // ============================================================================
  // UTILITY FUNCTIONS
  // ============================================================================
  
  function showError(message) {
    Elements.errorMessage.textContent = message;
    Elements.errorToast.classList.add('show');
    
    setTimeout(() => {
      Elements.errorToast.classList.remove('show');
    }, 5000);
  }
  
  function showMessage(message) {
    Elements.gameMessage.textContent = message;
  }
  
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
  
  function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
  
  function generateNonce() {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
  }
  
  // ============================================================================
  // INITIALIZATION
  // ============================================================================
  
  async function init() {
    try {
      // Cache DOM elements
      cacheElements();
      
      // Setup event listeners
      setupEventListeners();
      
      // Initialize renderer
      window.renderer = new GameRenderer('game-board').init();
      
      // Connect to WebSocket
      await initWebSocket();
      
      // Check for stored session
      const stored = localStorage.getItem('ludo_player');
      if (stored) {
        try {
          const player = JSON.parse(stored);
          AppState.player = player;
          
          // Try to reconnect with token
          AppState.ws.send({
            type: 'auth:request',
            timestamp: Date.now(),
            username: player.username,
            token: player.token
          });
        } catch (e) {
          localStorage.removeItem('ludo_player');
          showScreen('login');
        }
      } else {
        showScreen('login');
      }
      
      // Hide loading screen
      setTimeout(() => {
        if (AppState.screen === 'loading') {
          showScreen('login');
        }
      }, 1000);
      
    } catch (err) {
      console.error('[App] Initialization error:', err);
      showError('Failed to initialize. Please refresh.');
    }
  }
  
  // Start application when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  
})();
