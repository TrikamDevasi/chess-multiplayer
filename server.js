/**
 * Chess Multiplayer Server
 * Real-time chess game server using Socket.IO and chess.js
 * @module server
 */

const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const path = require('path');
const { Chess } = require('chess.js');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

/**
 * In-memory storage for active game rooms
 * @type {Map<string, ChessRoom>}
 */
const rooms = new Map();

/**
 * Represents a chess game room with players and game state
 * @class ChessRoom
 */
class ChessRoom {
    /**
     * Creates a new chess room
     * @param {string} roomId - Unique identifier for the room
     * @param {string|null} pin - Optional PIN for room security
     */
    constructor(roomId, pin) {
        this.roomId = roomId;
        this.pin = pin; // Store the PIN
        this.players = [];
        this.chess = new Chess();
        this.gameOver = false;
        this.winner = null;
        this.spectators = [];
    }

    /**
     * Adds a player to the room (or as spectator if full)
     * @param {string} socketId - Socket ID of the player
     * @param {string} playerName - Display name of the player
     * @returns {{success: boolean, role: string, color?: string}} Join result
     */
    addPlayer(socketId, playerName) {
        if (this.players.length >= 2) {
            // Add as spectator
            this.spectators.push({ socketId, name: playerName });
            return { success: true, role: 'spectator' };
        }

        const color = this.players.length === 0 ? 'white' : 'black';
        this.players.push({
            socketId,
            color,
            name: playerName || `Player ${color}`
        });

        return { success: true, role: 'player', color };
    }

    /**
     * Removes a player from the room
     * @param {string} socketId - Socket ID of the player to remove
     */
    removePlayer(socketId) {
        this.players = this.players.filter(p => p.socketId !== socketId);
        this.spectators = this.spectators.filter(s => s.socketId !== socketId);
    }

    /**
     * Attempts to make a chess move
     * @param {string} color - Color of the player making the move ('white' or 'black')
     * @param {Object} move - Chess move object {from, to, promotion}
     * @returns {{success: boolean, error?: string, move?: Object}} Move result
     */
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

    /**
     * Gets the current game state
     * @returns {Object} Complete game state including FEN, turn, status, etc.
     */
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

    /**
     * Resets the game to initial position
     */
    reset() {
        this.chess.reset();
        this.gameOver = false;
        this.winner = null;
    }
}

io.on('connection', (socket) => {
    console.log('New client connected:', socket.id);

    socket.on('create_room', (data) => {
        // Sanitize player name
        const playerName = (data.playerName || 'Player').substring(0, 20).replace(/[<>"']/g, '');
        const pin = data.pin ? String(data.pin).substring(0, 4) : null; // Validate PIN length

        const roomId = generateRoomId();
        const newRoom = new ChessRoom(roomId, pin);
        const joinResult = newRoom.addPlayer(socket.id, playerName);

        rooms.set(roomId, newRoom);
        socket.join(roomId);

        socket.emit('room_created', {
            roomId,
            pin: pin, // Send back PIN to creator? Maybe not needed, but good for confirmation
            color: joinResult.color,
            role: joinResult.role,
            gameState: newRoom.getGameState()
        });

        console.log(`Room created: ${roomId} with PIN: ${pin ? 'Yes' : 'No'}`);
    });

    socket.on('join_room', (data) => {
        const { roomId, pin } = data;
        const room = rooms.get(roomId);

        if (!room) {
            socket.emit('error', { message: 'Room not found' });
            return;
        }

        // Verify PIN
        if (room.pin && room.pin !== pin) {
            socket.emit('error', { message: 'Incorrect PIN' });
            return;
        }

        const playerName = (data.playerName || 'Player').substring(0, 20).replace(/[<>"']/g, '');
        const joinResult = room.addPlayer(socket.id, playerName);

        socket.join(roomId);

        // Notify user of their role
        if (joinResult.role === 'spectator') {
            socket.emit('joined_as_spectator', {
                roomId: roomId,
                gameState: room.getGameState()
            });
        } else {
            // Notify existing players about new player
            io.to(roomId).emit('game_start', {
                gameState: room.getGameState()
            });

            // Send specifically to the joiner effectively (though game_start covers state)
            socket.emit('your_color', {
                color: joinResult.color,
                role: 'player'
            });
        }

        console.log(`Player joined room: ${roomId} as ${joinResult.role}`);
    });

    socket.on('make_move', (data) => {
        const { roomId, move } = data;
        const room = rooms.get(roomId);

        if (!room) return;

        // Find player color
        const player = room.players.find(p => p.socketId === socket.id);
        if (!player) return; // Spectators can't move

        const result = room.makeMove(player.color, move);

        if (result.success) {
            io.to(roomId).emit('game_update', {
                move: result.move,
                gameState: room.getGameState()
            });
        } else {
            socket.emit('error', { message: result.error });
        }
    });

    socket.on('reset_game', (data) => {
        const { roomId } = data;
        const room = rooms.get(roomId);
        if (room) {
            // Determine who asked
            const player = room.players.find(p => p.socketId === socket.id);
            if (player) {
                socket.to(roomId).emit('reset_request', { requestedBy: player.color });
            }
        }
    });

    socket.on('reset_confirmed', (data) => {
        const { roomId } = data;
        const room = rooms.get(roomId);
        if (room) {
            room.reset();
            io.to(roomId).emit('game_reset', { gameState: room.getGameState() });
        }
    });

    socket.on('reset_declined', (data) => {
        const { roomId } = data;
        socket.to(roomId).emit('reset_declined');
    });

    socket.on('get_legal_moves', (data) => {
        const { roomId, square } = data;
        const room = rooms.get(roomId);
        if (room) {
            const moves = room.chess.moves({ square: square, verbose: true });
            socket.emit('legal_moves', { square, moves });
        }
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
        // Find room user was in
        rooms.forEach((room, roomId) => {
            const wasPlayer = room.players.some(p => p.socketId === socket.id);
            const wasSpectator = room.spectators.some(s => s.socketId === socket.id);

            if (wasPlayer || wasSpectator) {
                room.removePlayer(socket.id);

                io.to(roomId).emit('player_disconnected', { message: 'Opponent disconnected' });

                // If room is empty, delete it
                if (room.players.length === 0 && room.spectators.length === 0) {
                    rooms.delete(roomId);
                    console.log(`Room deleted: ${roomId}`);
                }
            }
        });
    });
});

function generateRoomId() {
    let roomId;
    let attempts = 0;
    do {
        roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
        attempts++;
    } while (rooms.has(roomId) && attempts < 100);
    return roomId;
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Chess server is running on http://localhost:${PORT}`);
});

