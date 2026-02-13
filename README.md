# ♟️ Chess Online Multiplayer

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node Version](https://img.shields.io/badge/node-%3E%3D14.0.0-brightgreen.svg)
![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)

A real-time multiplayer Chess game where two players can play from different devices over the internet using WebSocket technology. Built with chess.js for accurate chess rules and move validation.

> 📖 [Contributing Guide](CONTRIBUTING.md) • 📝 [Changelog](CHANGELOG.md) • 🐛 [Bug Fixes](BUG_FIXES.md)


## ✨ Features

- **Real-time Multiplayer**: Play with friends from different devices
- **Full Chess Rules**: Complete implementation of chess rules including castling, en passant, and pawn promotion
- **Room System**: Create or join game rooms using unique room IDs
- **Beautiful UI**: Modern, responsive chess board with smooth animations
- **Move Validation**: Server-side move validation ensures fair play
- **Move History**: Track all moves made during the game
- **Check/Checkmate Detection**: Automatic detection of check, checkmate, and stalemate
- **Legal Move Highlighting**: Visual indicators for valid moves
- **Spectator Mode**: Room full? Watch the game as a spectator
- **Player Names**: Customize your display name

## 🚀 Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm (comes with Node.js)

### Installation

1. Navigate to the project directory:
```bash
cd chess-multiplayer
```

2. Install dependencies:
```bash
npm install
```

### Running the Server

Start the server with:
```bash
npm start
```

For development with auto-restart:
```bash
npm run dev
```

The server will start on `http://localhost:3000`

## 🎯 How to Play

### Creating a Game

1. Open your browser and go to `http://localhost:3000`
2. Enter your name (optional)
3. Click **"Create Room"**
4. Share the generated Room ID with your opponent
5. Wait for your opponent to join
6. White moves first!

### Joining a Game

1. Open your browser and go to `http://localhost:3000`
2. Enter your name (optional)
3. Click **"Join Room"**
4. Enter the Room ID shared by your friend
5. Click **"Join"** to start playing

### Making Moves

1. Click on a piece to select it
2. Legal moves will be highlighted
3. Click on a highlighted square to move
4. Wait for your opponent's turn

### Playing from Different Devices

#### On Local Network:
1. Find your computer's local IP address:
   - Windows: Run `ipconfig` in Command Prompt
   - Mac/Linux: Run `ifconfig` or `ip addr`
2. Share the URL with your friend: `http://YOUR_IP:3000`
3. Both players can now connect and play

#### Over the Internet:
Deploy to a hosting service (see Deployment section below)

## 🌐 Deployment

### Using Render (Recommended)

1. Push your code to GitHub
2. Go to https://render.com/
3. Create a new Web Service
4. Connect your GitHub repository
5. Render will auto-detect Node.js and deploy
6. Share your deployed URL!

### Using Railway

1. Go to https://railway.app/
2. Create a new project from GitHub
3. Railway auto-deploys
4. Generate a domain and share!

### Using Heroku

```bash
heroku create your-chess-app
git push heroku main
```

## 📁 Project Structure

```
chess-multiplayer/
├── public/
│   ├── index.html      # Main HTML file
│   ├── style.css       # Styles and animations
│   └── game.js         # Client-side game logic
├── server.js           # WebSocket server with chess.js
├── package.json        # Dependencies and scripts
└── README.md          # This file
```

## 🛠️ Technologies Used

- **Backend**: Node.js, Express, WebSocket (ws), chess.js
- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Chess Engine**: chess.js (for rules and validation)
- **Real-time Communication**: WebSocket protocol

## 🎨 Game Features

### Chess Rules Implemented
- ✅ All standard chess moves
- ✅ Castling (kingside and queenside)
- ✅ En passant
- ✅ Pawn promotion (auto-promotes to Queen)
- ✅ Check detection
- ✅ Checkmate detection
- ✅ Stalemate detection
- ✅ Draw conditions
- ✅ Move validation

### UI Features
- ✅ Visual move highlighting
- ✅ Last move indication
- ✅ Check/checkmate status display
- ✅ Move history panel
- ✅ Player turn indicator
- ✅ Connection status indicator
- ✅ Game over modal
- ✅ Spectator support

## 🔧 Configuration

You can change the server port by setting the `PORT` environment variable:

```bash
PORT=8080 npm start
```

## 📝 Chess Rules

### Basic Rules
- White always moves first
- Players alternate turns
- The goal is to checkmate the opponent's king
- A player cannot make a move that puts their own king in check

### Special Moves
- **Castling**: King moves two squares toward a rook, rook jumps over
- **En Passant**: Special pawn capture move
- **Promotion**: Pawns reaching the opposite end promote to Queen (automatic)

### Game End Conditions
- **Checkmate**: King is in check and cannot escape
- **Stalemate**: Player has no legal moves but is not in check
- **Draw**: By agreement, repetition, or insufficient material

## 🐛 Troubleshooting

**Connection Issues:**
- Make sure the server is running
- Check if port 3000 is not blocked by firewall
- Verify both players are on the same network (for local play)

**Room Not Found:**
- Double-check the Room ID
- Ensure the room creator's connection is still active

**Moves Not Working:**
- Verify it's your turn
- Check if the move is legal
- Refresh the page if needed

**Board Not Displaying:**
- Clear browser cache
- Check browser console for errors
- Ensure JavaScript is enabled

## 🎮 Keyboard Shortcuts

- **Enter**: Submit name/room ID in input fields

## 📄 License

MIT License - Feel free to use this project for learning or personal use.

## 🤝 Contributing

Feel free to fork this project and submit pull requests for improvements!

Possible enhancements:
- Add timer/clock functionality
- Add chat feature
- Add move undo/redo
- Add game analysis
- Add different time controls
- Add rating system
- Save game history

## 📧 Support

If you encounter any issues or have questions, please create an issue in the repository.

---

**Enjoy playing Chess with your friends! ♟️**
