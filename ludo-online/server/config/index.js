/**
 * Server Configuration
 * Environment variables and constants
 */

require('dotenv').config();

const config = {
  // Server
  port: parseInt(process.env.PORT, 10) || 3000,
  wsPort: parseInt(process.env.WS_PORT, 10) || 3001,
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // Security
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
  sessionSecret: process.env.SESSION_SECRET || 'dev-session-secret',
  jwtExpiresIn: '24h',
  
  // Rate Limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000, // 15 minutes
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 100
  },
  
  // Game Settings
  game: {
    turnTimeoutMs: parseInt(process.env.TURN_TIMEOUT_MS, 10) || 30000,
    maxPlayersPerRoom: parseInt(process.env.MAX_PLAYERS_PER_ROOM, 10) || 4,
    diceAnimationMs: 1000,
    moveAnimationMs: 500,
    betweenTurnsMs: 1000
  },
  
  // CORS
  allowedOrigins: process.env.ALLOWED_ORIGINS 
    ? process.env.ALLOWED_ORIGINS.split(',') 
    : ['http://localhost:3000', 'http://localhost:3001'],
  
  // SSL (for production)
  ssl: {
    enabled: process.env.SSL_KEY_PATH && process.env.SSL_CERT_PATH,
    keyPath: process.env.SSL_KEY_PATH,
    certPath: process.env.SSL_CERT_PATH
  },
  
  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.NODE_ENV === 'production' ? 'json' : 'console'
  }
};

// Validate required configuration
if (config.nodeEnv === 'production') {
  if (config.jwtSecret === 'dev-secret-change-in-production') {
    console.error('ERROR: JWT_SECRET must be set in production!');
    process.exit(1);
  }
  if (config.sessionSecret === 'dev-session-secret') {
    console.error('ERROR: SESSION_SECRET must be set in production!');
    process.exit(1);
  }
}

module.exports = config;
