# API Documentation

## Socket.IO Events

This document describes all Socket.IO events used in the chess multiplayer game.

### Client → Server Events

#### `create_room`
Creates a new game room.

**Payload:**
```javascript
{
    playerName: string,  // Player's display name (max 20 chars)
    pin: string,        // Optional 4-digit PIN for room security
    color: string       // 'white', 'black', or 'random'
}
```

**Response:** `room_created` event

**Example:**
```javascript
socket.emit('create_room', {
    playerName: 'GrandMaster',
    pin: '1234',
    color: 'white'
});
```

---

#### `join_room`
Joins an existing game room.

**Payload:**
```javascript
{
    roomId: string,     // 6-character room ID
    pin: string,        // PIN if room is protected
    playerName: string  // Player's display name
}
```

**Response:** `game_start` or `joined_as_spectator` event

**Errors:**
- `Room not found` - Invalid room ID
- `Incorrect PIN` - Wrong PIN provided

**Example:**
```javascript
socket.emit('join_room', {
    roomId: 'ABC123',
    pin: '1234',
    playerName: 'ChessNinja'
});
```

---

#### `make_move`
Makes a chess move in the game.

**Payload:**
```javascript
{
    roomId: string,     // Current room ID
    move: {
        from: string,   // Starting square (e.g., 'e2')
        to: string,     // Destination square (e.g., 'e4')
        promotion: string  // Optional: 'q', 'r', 'b', 'n'
    }
}
```

**Response:** `game_update` event on success, `error` event on failure

**Errors:**
- `Not your turn` - Trying to move when it's opponent's turn
- `Invalid move` - Move doesn't follow chess rules

**Example:**
```javascript
socket.emit('make_move', {
    roomId: 'ABC123',
    move: { from: 'e2', to: 'e4' }
});
```

---

#### `get_legal_moves`
Requests legal moves for a specific piece.

**Payload:**
```javascript
{
    roomId: string,     // Current room ID
    square: string      // Square to check (e.g., 'e2')
}
```

**Response:** `legal_moves` event

**Example:**
```javascript
socket.emit('get_legal_moves', {
    roomId: 'ABC123',
    square: 'e2'
});
```

---

#### `reset_game`
Requests a game reset (asks opponent for confirmation).

**Payload:**
```javascript
{
    roomId: string      // Current room ID
}
```

**Response:** Sends `reset_request` to opponent

**Example:**
```javascript
socket.emit('reset_game', {
    roomId: 'ABC123'
});
```

---

#### `reset_confirmed`
Confirms a reset request.

**Payload:**
```javascript
{
    roomId: string      // Current room ID
}
```

**Response:** `game_reset` event to all players

---

#### `reset_declined`
Declines a reset request.

**Payload:**
```javascript
{
    roomId: string      // Current room ID
}
```

**Response:** `reset_declined` event to requester

---

### Server → Client Events

#### `room_created`
Confirms room creation and provides room details.

**Payload:**
```javascript
{
    roomId: string,     // Generated room ID
    pin: string | null, // Room PIN (if set)
    color: string,      // Assigned color
    role: string,       // 'player'
    gameState: Object   // Current game state
}
```

---

#### `game_start`
Indicates the game has started (both players joined).

**Payload:**
```javascript
{
    gameState: {
        fen: string,            // Current board position
        pgn: string,            // Game notation
        turn: string,           // 'white' or 'black'
        isCheck: boolean,       // Is current player in check
        isCheckmate: boolean,   // Is it checkmate
        isStalemate: boolean,   // Is it stalemate
        isDraw: boolean,        // Is it a draw
        isGameOver: boolean,    // Is game over
        winner: string | null,  // Winner color or 'draw'
        players: Array,         // Player information
        moveHistory: Array      // All moves made
    }
}
```

---

#### `joined_as_spectator`
Player joined as spectator (room was full).

**Payload:**
```javascript
{
    roomId: string,
    gameState: Object
}
```

---

#### `your_color`
Informs player of their assigned color.

**Payload:**
```javascript
{
    color: string,      // 'white' or 'black'
    role: string        // 'player'
}
```

---

#### `game_update`
Board state update after a move.

**Payload:**
```javascript
{
    move: Object,       // Move that was made
    gameState: Object   // Updated game state
}
```

---

#### `legal_moves`
Response with legal moves for a piece.

**Payload:**
```javascript
{
    square: string,     // Square that was queried
    moves: Array        // Array of legal move objects
}
```

**Move Object:**
```javascript
{
    from: string,       // Starting square
    to: string,         // Destination square
    piece: string,      // Piece type
    captured: string,   // Captured piece (if any)
    promotion: string,  // Promotion piece (if pawn promotion)
    flags: string       // Move flags (e.g., 'c' for capture)
}
```

---

#### `reset_request`
Opponent wants to reset the game.

**Payload:**
```javascript
{
    requestedBy: string // Color of player requesting
}
```

---

#### `game_reset`
Game has been reset to starting position.

**Payload:**
```javascript
{
    gameState: Object   // Fresh game state
}
```

---

#### `reset_declined`
Opponent declined the reset request.

**Payload:** None

---

#### `player_disconnected`
A player has disconnected from the game.

**Payload:**
```javascript
{
    message: string     // Disconnection message
}
```

---

#### `error`
An error occurred processing a request.

**Payload:**
```javascript
{
    message: string     // Error description
}
```

**Common Errors:**
- `Room not found`
- `Incorrect PIN`
- `Not your turn`
- `Invalid move`

---

## Game State Object

The game state object contains all information about the current game:

```javascript
{
    fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    pgn: "1. e4 e5 2. Nf3 Nc6",
    turn: "white",          // Current turn
    isCheck: false,         // Is current player in check
    isCheckmate: false,     // Is it checkmate
    isStalemate: false,     // Is it stalemate
    isDraw: false,          // Is it a draw
    isGameOver: false,      // Is game finished
    gameOver: false,        // Game over flag
    winner: null,           // null, 'white', 'black', 'draw', or 'stalemate'
    players: [
        { name: "Player 1", color: "white" },
        { name: "Player 2", color: "black" }
    ],
    moveHistory: [
        {
            color: "w",
            from: "e2",
            to: "e4",
            piece: "p",
            san: "e4",
            flags: "b"
        }
        // ... more moves
    ]
}
```

## Connection Flow

### Creating and Joining a Room

```
Client 1                Server                 Client 2
   |                       |                       |
   |--create_room--------->|                       |
   |<-----room_created-----|                       |
   |                       |<------join_room-------|
   |<-----game_start-------|                       |
   |                       |------game_start------>|
   |                       |------your_color------>|
```

### Making Moves

```
Client 1                Server                 Client 2
   |                       |                       |
   |--make_move----------->|                       |
   |<-----game_update------|                       |
   |                       |------game_update----->|
```

### Game Reset

```
Client 1                Server                 Client 2
   |                       |                       |
   |--reset_game---------->|                       |
   |                       |-----reset_request---->|
   |                       |<---reset_confirmed----|
   |<-----game_reset-------|                       |
   |                       |------game_reset------>|
```

## Rate Limiting (Recommended)

While not currently implemented, consider adding rate limits:

- Room creation: 3 per minute per IP
- Moves: 10 per minute per room
- Join attempts: 5 per minute per IP

## Error Handling

Always handle Socket.IO errors gracefully:

```javascript
socket.on('error', (error) => {
    console.error('Game error:', error.message);
    alert(error.message);
});
```
