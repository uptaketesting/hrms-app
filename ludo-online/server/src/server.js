/**
 * Main Server Entry Point
 * Sets up Express, HTTP server, and WebSocket handler
 */

const express = require('express');
const http = require('http');
const path = require('path');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const config = require('../config');
const WebSocketHandler = require('./network/WebSocketHandler');
const roomManager = require('./rooms/RoomManager');
const auth = require('./auth/auth');

// Initialize Express app
const app = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"], // Allow inline for vanilla JS
      styleSrc: ["'self'", "'unsafe-inline'"], // Allow inline styles
      imgSrc: ["'self'", 'data:', 'blob:'],
      connectSrc: ["'self'", 'ws:', 'wss:']
    }
  }
}));

// CORS configuration
app.use(cors({
  origin: config.allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate limiting for REST endpoints
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  message: { error: 'Too many requests, please try again later' }
});
app.use('/api/', limiter);

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from client directory
const clientPath = path.join(__dirname, '../../client');
console.log('[SERVER] Serving static files from:', clientPath);
app.use(express.static(clientPath));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: Date.now(),
    uptime: process.uptime(),
    sessions: auth.getActiveSessionCount(),
    rooms: roomManager.getStats()
  });
});

// API endpoint to get room list (REST fallback)
app.get('/api/rooms', (req, res) => {
  const rooms = roomManager.getRoomList();
  res.json({ rooms });
});

// API endpoint to get game stats
app.get('/api/stats', (req, res) => {
  res.json({
    sessions: auth.getActiveSessionCount(),
    rooms: roomManager.getStats()
  });
});

// Serve index.html for all other routes (SPA support)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../../client/index.html'));
});

// Create HTTP server
const server = http.createServer(app);

// Initialize WebSocket handler
const wsHandler = new WebSocketHandler(server);

// Graceful shutdown handling
let isShuttingDown = false;

function gracefulShutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  
  console.log(`\n[SERVER] Received ${signal}. Shutting down gracefully...`);
  
  // Close WebSocket connections
  wsHandler.close();
  
  // Close HTTP server
  server.close(() => {
    console.log('[SERVER] HTTP server closed');
    
    // Cleanup rooms
    roomManager.cleanupInactiveRooms();
    
    // Exit process
    process.exit(0);
  });
  
  // Force exit after timeout
  setTimeout(() => {
    console.error('[SERVER] Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Error handling
process.on('uncaughtException', (err) => {
  console.error('[SERVER] Uncaught Exception:', err);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[SERVER] Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('unhandledRejection');
});

// Start server
const PORT = config.port;

server.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════╗
║           🎲 LUDO ONLINE SERVER STARTED                ║
╠════════════════════════════════════════════════════════╣
║  HTTP Server:  http://localhost:${PORT}                  ║
║  WebSocket:    ws://localhost:${PORT}/ws                 ║
║  Environment:  ${config.nodeEnv.padEnd(36)}║
║  Health Check: http://localhost:${PORT}/health             ║
╚════════════════════════════════════════════════════════╝
  `);
});

module.exports = { app, server, wsHandler };
