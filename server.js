const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const { Chess } = require('chess.js');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Game rooms storage
const rooms = new Map();

class ChessRoom {
    constructor(roomId) {
        this.roomId = roomId;
        this.players = [];
        this.chess = new Chess();
        this.gameOver = false;
        this.winner = null;
        this.spectators = [];
    }

    addPlayer(ws, playerName) {
        if (this.players.length >= 2) {
            // Add as spectator
            this.spectators.push({ ws, name: playerName });
            return { success: true, role: 'spectator' };
        }
        
        const color = this.players.length === 0 ? 'white' : 'black';
        this.players.push({
            ws,
            color,
            name: playerName || `Player ${color}`
        });
        
        return { success: true, role: 'player', color };
    }

    makeMove(color, move) {
        // Check if it's the player's turn
        const currentTurn = this.chess.turn() === 'w' ? 'white' : 'black';
        if (currentTurn !== color) {
            return { success: false, error: 'Not your turn' };
        }

        try {
            const result = this.chess.move(move);
            if (!result) {
                return { success: false, error: 'Invalid move' };
            }

            // Check game status
            if (this.chess.isGameOver()) {
                this.gameOver = true;
                if (this.chess.isCheckmate()) {
                    this.winner = color;
                } else if (this.chess.isDraw()) {
                    this.winner = 'draw';
                } else if (this.chess.isStalemate()) {
                    this.winner = 'stalemate';
                }
            }

            return { success: true, move: result };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    broadcast(message, excludeWs = null) {
        const allConnections = [
            ...this.players.map(p => p.ws),
            ...this.spectators.map(s => s.ws)
        ];

        allConnections.forEach(ws => {
            if (ws !== excludeWs && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify(message));
            }
        });
    }

    getGameState() {
        return {
            fen: this.chess.fen(),
            pgn: this.chess.pgn(),
            turn: this.chess.turn() === 'w' ? 'white' : 'black',
            isCheck: this.chess.isCheck(),
            isCheckmate: this.chess.isCheckmate(),
            isStalemate: this.chess.isStalemate(),
            isDraw: this.chess.isDraw(),
            isGameOver: this.chess.isGameOver(),
            gameOver: this.gameOver,
            winner: this.winner,
            players: this.players.map(p => ({ name: p.name, color: p.color })),
            moveHistory: this.chess.history({ verbose: true })
        };
    }

    reset() {
        this.chess.reset();
        this.gameOver = false;
        this.winner = null;
    }
}

wss.on('connection', (ws) => {
    console.log('New client connected');
    let currentRoom = null;
    let playerColor = null;
    let playerRole = null;

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);

            switch (data.type) {
                case 'create_room':
                    // Sanitize player name
                    const sanitizedCreateName = (data.playerName || 'Player')
                        .substring(0, 20)
                        .replace(/[<>"']/g, '');
                    
                    const roomId = generateRoomId();
                    const newRoom = new ChessRoom(roomId);
                    const createResult = newRoom.addPlayer(ws, sanitizedCreateName);
                    rooms.set(roomId, newRoom);
                    currentRoom = roomId;
                    playerColor = createResult.color;
                    playerRole = createResult.role;
                    
                    ws.send(JSON.stringify({
                        type: 'room_created',
                        roomId,
                        color: playerColor,
                        role: playerRole,
                        gameState: newRoom.getGameState()
                    }));
                    console.log(`Room created: ${roomId}`);
                    break;

                case 'join_room':
                    // Validate room ID format
                    if (!data.roomId || !/^[A-Z0-9]{6}$/.test(data.roomId)) {
                        ws.send(JSON.stringify({
                            type: 'error',
                            message: 'Invalid room ID format'
                        }));
                        return;
                    }
                    
                    const room = rooms.get(data.roomId);
                    if (!room) {
                        ws.send(JSON.stringify({
                            type: 'error',
                            message: 'Room not found'
                        }));
                        return;
                    }

                    // Sanitize player name
                    const sanitizedJoinName = (data.playerName || 'Player')
                        .substring(0, 20)
                        .replace(/[<>"']/g, '');
                    
                    const joinResult = room.addPlayer(ws, sanitizedJoinName);
                    currentRoom = data.roomId;
                    playerColor = joinResult.color;
                    playerRole = joinResult.role;

                    if (playerRole === 'spectator') {
                        ws.send(JSON.stringify({
                            type: 'joined_as_spectator',
                            roomId: data.roomId,
                            gameState: room.getGameState()
                        }));
                    } else {
                        // Notify all players and spectators
                        room.broadcast({
                            type: 'game_start',
                            gameState: room.getGameState()
                        });

                        // Send individual color info
                        room.players.forEach(player => {
                            if (player.ws.readyState === WebSocket.OPEN) {
                                player.ws.send(JSON.stringify({
                                    type: 'your_color',
                                    color: player.color
                                }));
                            }
                        });
                    }
                    console.log(`Player joined room: ${data.roomId} as ${playerRole}`);
                    break;

                case 'make_move':
                    if (!currentRoom || playerRole !== 'player') {
                        ws.send(JSON.stringify({
                            type: 'error',
                            message: 'Not authorized to make moves'
                        }));
                        return;
                    }

                    const gameRoom = rooms.get(currentRoom);
                    if (!gameRoom) {
                        ws.send(JSON.stringify({
                            type: 'error',
                            message: 'Room not found'
                        }));
                        return;
                    }

                    const moveResult = gameRoom.makeMove(playerColor, data.move);
                    if (moveResult.success) {
                        gameRoom.broadcast({
                            type: 'game_update',
                            move: moveResult.move,
                            gameState: gameRoom.getGameState()
                        });
                    } else {
                        ws.send(JSON.stringify({
                            type: 'error',
                            message: moveResult.error
                        }));
                    }
                    break;

                case 'reset_game':
                    if (!currentRoom) return;
                    
                    const resetRoom = rooms.get(currentRoom);
                    if (resetRoom) {
                        resetRoom.reset();
                        resetRoom.broadcast({
                            type: 'game_reset',
                            gameState: resetRoom.getGameState()
                        });
                    }
                    break;

                case 'get_legal_moves':
                    if (!currentRoom) return;
                    
                    const legalRoom = rooms.get(currentRoom);
                    if (legalRoom) {
                        const moves = legalRoom.chess.moves({ square: data.square, verbose: true });
                        ws.send(JSON.stringify({
                            type: 'legal_moves',
                            square: data.square,
                            moves: moves
                        }));
                    }
                    break;
            }
        } catch (error) {
            console.error('Error processing message:', error);
            ws.send(JSON.stringify({
                type: 'error',
                message: 'Server error'
            }));
        }
    });

    ws.on('close', () => {
        console.log('Client disconnected');
        if (currentRoom) {
            const room = rooms.get(currentRoom);
            if (room) {
                room.broadcast({
                    type: 'player_disconnected',
                    message: 'Opponent disconnected'
                });
                
                // Clean up empty rooms
                setTimeout(() => {
                    const allConnections = [
                        ...room.players.map(p => p.ws),
                        ...room.spectators.map(s => s.ws)
                    ];
                    if (allConnections.every(ws => ws.readyState !== WebSocket.OPEN)) {
                        rooms.delete(currentRoom);
                        console.log(`Room deleted: ${currentRoom}`);
                    }
                }, 5000);
            }
        }
    });
});

function generateRoomId() {
    // Generate unique room ID with collision check
    let roomId;
    let attempts = 0;
    do {
        roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
        attempts++;
        if (attempts > 100) {
            // Fallback to timestamp-based ID if too many collisions
            roomId = Date.now().toString(36).substring(-6).toUpperCase();
            break;
        }
    } while (rooms.has(roomId));
    
    return roomId;
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Chess server is running on http://localhost:${PORT}`);
});
