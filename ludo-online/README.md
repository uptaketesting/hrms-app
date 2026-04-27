# Ludo Online - Real-Time Multiplayer Browser Game

A complete, production-ready browser-based Ludo game with real-time multiplayer support via WebSockets.

## 🎮 Features

- **Real-time Multiplayer**: 2-4 players in the same room
- **Server-Authoritative Architecture**: All game logic validated server-side
- **60fps Gameplay**: Smooth animations using requestAnimationFrame
- **Anti-Cheat Protection**: Server-side dice rolls, move validation, nonce verification
- **Responsive Design**: Works on desktop and mobile browsers
- **Secure**: JWT authentication, rate limiting, CORS, Helmet security headers
- **Minimal Dependencies**: No heavy frameworks, pure vanilla JavaScript

## 📁 Project Structure

```
ludo-online/
├── client/              # Frontend code
│   ├── assets/          # SVGs, icons, fonts
│   ├── src/
│   │   ├── core/        # Game loop, renderer, input handler
│   │   ├── network/     # WebSocket client, message router
│   │   └── ui/          # DOM components, modals, scoreboards
│   ├── index.html
│   ├── styles.css
│   └── package.json
├── server/              # Backend code
│   ├── config/          # Environment, constants
│   ├── src/
│   │   ├── auth/        # JWT/session management
│   │   ├── game/        # Ludo engine, rules, state machine
│   │   ├── rooms/       # Room manager, matchmaking
│   │   ├── network/     # WebSocket server, handlers
│   │   └── server.js    # Entry point
│   └── package.json
├── shared/              # Shared code between client & server
│   └── protocol.js      # Message types, validation schemas
├── tests/               # Test suites
├── .env.example         # Environment variables template
└── README.md
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18 or higher
- npm or yarn

### Installation

1. **Clone or navigate to the project:**
   ```bash
   cd ludo-online
   ```

2. **Install all dependencies:**
   ```bash
   npm run install:all
   ```

3. **Create environment file:**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` and change secrets for production:
   ```
   JWT_SECRET=your-super-secret-jwt-key-change-in-production
   SESSION_SECRET=your-session-secret-change-in-production
   ```

4. **Start development servers:**
   ```bash
   npm run dev
   ```

5. **Open your browser:**
   ```
   http://localhost:3000
   ```

### Production Build

```bash
npm start
```

## 🎲 Game Rules

### Basic Ludo Mechanics

1. **Objective**: Be the first player to move all 4 tokens from base to home
2. **Starting**: Roll a 6 to move a token out of base
3. **Movement**: Tokens move clockwise around the board
4. **Extra Turn**: Rolling a 6 grants an additional turn
5. **Capturing**: Land on opponent's token to send it back to base (except on safe squares)
6. **Safe Squares**: Star-marked positions where tokens cannot be captured
7. **Home Stretch**: Enter the colored path after completing one lap
8. **Winning**: Exact roll required to reach home

### Controls

- **Roll Dice**: Click the dice button or press Spacebar
- **Move Token**: Click on a highlighted token when it's your turn
- **Chat**: Type in the chat box (optional feature)

## 🔐 Security Features

- **JWT Authentication**: Secure session management
- **Server-Side Validation**: All moves validated before execution
- **Rate Limiting**: Prevents spam and DDoS attacks
- **CORS Protection**: Whitelisted origins only
- **Helmet Headers**: Security HTTP headers
- **Anti-Cheat**: 
  - Server-generated dice rolls
  - Move path validation
  - Nonce/timestamp verification
  - Turn order enforcement

## 🛠 Development

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm run install:all` | Install root, client, and server dependencies |
| `npm run dev` | Start both client and server in development mode |
| `npm run dev:server` | Start server with hot-reload |
| `npm run dev:client` | Start client with hot-reload |
| `npm start` | Start production server |
| `npm run lint` | Run ESLint on all source files |
| `npm test` | Run test suite |
| `npm run test:watch` | Run tests in watch mode |

### Testing

```bash
# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Watch mode
npm run test:watch
```

## 🌐 Deployment Checklist

### VPS Setup

1. **Install Node.js 18+**
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```

2. **Clone and install:**
   ```bash
   git clone <your-repo>
   cd ludo-online
   npm run install:all
   ```

3. **Configure environment:**
   ```bash
   cp .env.example .env
   # Edit .env with production values
   ```

4. **Install PM2 (process manager):**
   ```bash
   npm install -g pm2
   ```

5. **Start with PM2:**
   ```bash
   pm2 start server/src/server.js --name ludo-online
   pm2 save
   pm2 startup
   ```

### Reverse Proxy (Nginx)

```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
    
    location /ws {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
    }
}
```

### SSL Certificate (Let's Encrypt)

```bash
sudo apt-get install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

### Environment Variables for Production

```env
NODE_ENV=production
PORT=3000
WS_PORT=3001
JWT_SECRET=<strong-random-secret>
SESSION_SECRET=<strong-random-secret>
ALLOWED_ORIGINS=https://your-domain.com
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

## 📊 Performance Targets

- ✅ 60fps on modern browsers
- ✅ <50ms perceived input lag on stable connection
- ✅ <100KB initial page load
- ✅ Support for 1000+ concurrent connections per server instance
- ✅ Graceful handling of disconnections and reconnections

## 🧪 Testing Manual Scenarios

1. **Multiplayer Sync**: Open multiple browser tabs, join same room, verify state sync
2. **Disconnection**: Close tab mid-game, reconnect, verify state recovery
3. **Invalid Moves**: Try to move out of turn, verify server rejection
4. **Rate Limiting**: Spam clicks, verify rate limit enforcement
5. **Mobile**: Test on mobile devices, verify touch controls work

## 📝 License

MIT License - See LICENSE file for details

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

## 🆘 Troubleshooting

### Common Issues

**"Cannot connect to WebSocket"**
- Check if server is running on correct port
- Verify ALLOWED_ORIGINS includes your domain
- Check firewall settings

**"Invalid token" errors**
- Clear browser cache and cookies
- Regenerate JWT_SECRET in .env
- Check system time is synchronized

**Game lag or stuttering**
- Reduce browser zoom level
- Close other browser tabs
- Check network latency

## 📞 Support

For issues and questions, please open an issue on the GitHub repository.
