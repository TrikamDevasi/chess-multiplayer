// WebSocket connection
let ws;
let playerColor = null;
let playerRole = null;
let currentRoomId = null;
let gameState = null;
let selectedSquare = null;
let legalMoves = [];
let connectionAttempts = 0;
let maxRetries = 10;
let retryTimeout = null;
let connectionStartTime = null;

// Chess piece Unicode characters
const PIECES = {
    'K': '♔', 'Q': '♕', 'R': '♖', 'B': '♗', 'N': '♘', 'P': '♙',
    'k': '♚', 'q': '♛', 'r': '♜', 'b': '♝', 'n': '♞', 'p': '♟'
};

// DOM Elements
const menuScreen = document.getElementById('menuScreen');
const waitingScreen = document.getElementById('waitingScreen');
const gameScreen = document.getElementById('gameScreen');
const connectionStatus = document.getElementById('connectionStatus');
const statusText = document.getElementById('statusText');

const playerNameInput = document.getElementById('playerNameInput');
const createRoomBtn = document.getElementById('createRoomBtn');
const joinRoomBtn = document.getElementById('joinRoomBtn');
const joinRoomSection = document.getElementById('joinRoomSection');
const roomIdInput = document.getElementById('roomIdInput');
const joinRoomConfirmBtn = document.getElementById('joinRoomConfirmBtn');

const displayRoomId = document.getElementById('displayRoomId');
const copyRoomIdBtn = document.getElementById('copyRoomIdBtn');

const chessBoard = document.getElementById('chessBoard');
const currentTurnText = document.getElementById('currentTurnText');
const whitePlayerInfo = document.getElementById('whitePlayerInfo');
const blackPlayerInfo = document.getElementById('blackPlayerInfo');
const gameStatusDiv = document.getElementById('gameStatus');
const moveList = document.getElementById('moveList');
const resetGameBtn = document.getElementById('resetGameBtn');
const leaveRoomBtn = document.getElementById('leaveRoomBtn');

const gameOverModal = document.getElementById('gameOverModal');
const gameOverTitle = document.getElementById('gameOverTitle');
const gameOverMessage = document.getElementById('gameOverMessage');
const playAgainBtn = document.getElementById('playAgainBtn');

const themeSelect = document.getElementById('themeSelect');
const flipBoardBtn = document.getElementById('flipBoardBtn');
let isBoardFlipped = false;

// Game mode elements
const humanModeBtn = document.getElementById('humanModeBtn');
const botModeBtn = document.getElementById('botModeBtn');
const botDifficultySection = document.getElementById('botDifficultySection');
const botDifficulty = document.getElementById('botDifficulty');
const whiteColorBtn = document.getElementById('whiteColorBtn');
const blackColorBtn = document.getElementById('blackColorBtn');
const randomColorBtn = document.getElementById('randomColorBtn');
const colorSelectionSection = document.getElementById('colorSelectionSection');

let gameMode = 'human'; // 'human' or 'bot'
let selectedColor = 'white'; // 'white', 'black', or 'random'
let botDifficultyLevel = 'easy';

// Initialize WebSocket connection
function connectWebSocket() {
    if (!connectionStartTime) {
        connectionStartTime = Date.now();
    }
    
    connectionAttempts++;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    
    updateConnectionStatus('connecting', connectionAttempts);
    
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
        console.log('Connected to server');
        connectionAttempts = 0;
        connectionStartTime = null;
        
        // Clear any pending retry timeouts
        if (retryTimeout) {
            clearTimeout(retryTimeout);
            retryTimeout = null;
        }
        
        updateConnectionStatus('connected');
    };

    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        handleServerMessage(data);
    };

    ws.onerror = (error) => {
        console.error('WebSocket error:', error);
    };

    ws.onclose = () => {
        console.log('Disconnected from server');
        
        if (connectionAttempts < maxRetries) {
            updateConnectionStatus('reconnecting', connectionAttempts);
            const delay = Math.min(3000 + (connectionAttempts * 1000), 10000);
            retryTimeout = setTimeout(connectWebSocket, delay);
        } else {
            updateConnectionStatus('failed');
        }
    };
}

function updateConnectionStatus(status, attempt = 0) {
    connectionStatus.className = `status-bar ${status}`;
    
    // Disable/enable buttons based on connection
    const isConnected = status === 'connected';
    createRoomBtn.disabled = !isConnected;
    joinRoomConfirmBtn.disabled = !isConnected;
    
    if (status === 'connected') {
        statusText.innerHTML = '✓ Connected';
    } else if (status === 'connecting') {
        if (attempt === 1) {
            statusText.innerHTML = '⏳ Connecting to server...';
        } else if (attempt <= 3) {
            statusText.innerHTML = '⏳ Waking up server... (this may take 30 seconds)';
        } else {
            const elapsed = Math.floor((Date.now() - connectionStartTime) / 1000);
            statusText.innerHTML = `⏳ Still waking up... (${elapsed}s elapsed)`;
        }
    } else if (status === 'reconnecting') {
        statusText.innerHTML = `🔄 Reconnecting... (attempt ${attempt}/${maxRetries})`;
    } else if (status === 'failed') {
        statusText.innerHTML = '❌ Connection failed. <a href="javascript:location.reload()" style="color: #1e3c72; text-decoration: underline;">Refresh page</a>';
    } else {
        statusText.innerHTML = '⚠️ Disconnected';
    }
}

function handleServerMessage(data) {
    console.log('Received:', data);

    switch (data.type) {
        case 'room_created':
            currentRoomId = data.roomId;
            playerColor = data.color;
            playerRole = data.role;
            gameState = data.gameState;
            showWaitingScreen();
            break;

        case 'your_color':
            playerColor = data.color;
            break;

        case 'game_start':
            gameState = data.gameState;
            showGameScreen();
            renderBoard();
            updateGameInfo();
            break;

        case 'joined_as_spectator':
            playerRole = 'spectator';
            gameState = data.gameState;
            showGameScreen();
            renderBoard();
            updateGameInfo();
            alert('Room is full. You are spectating.');
            break;

        case 'game_update':
            gameState = data.gameState;
            renderBoard();
            updateGameInfo();
            updateMoveHistory();
            if (gameState.isGameOver) {
                showGameOver();
            }
            break;

        case 'game_reset':
            gameState = data.gameState;
            renderBoard();
            updateGameInfo();
            updateMoveHistory();
            hideGameOver();
            break;

        case 'legal_moves':
            legalMoves = data.moves;
            highlightLegalMoves();
            break;

        case 'player_disconnected':
            alert(data.message);
            resetToMenu();
            break;

        case 'error':
            alert(data.message);
            break;
    }
}

// Screen Management
function showScreen(screen) {
    [menuScreen, waitingScreen, gameScreen].forEach(s => s.classList.remove('active'));
    screen.classList.add('active');
}

function showWaitingScreen() {
    displayRoomId.textContent = currentRoomId;
    showScreen(waitingScreen);
}

function showGameScreen() {
    showScreen(gameScreen);
    initializeBoard();
    updatePlayerInfo();
    
    // Auto-flip board for black player
    if (playerColor === 'black' && !isBoardFlipped) {
        flipBoard();
    }
}

function resetToMenu() {
    currentRoomId = null;
    playerColor = null;
    playerRole = null;
    gameState = null;
    selectedSquare = null;
    legalMoves = [];
    
    // Reset board flip state
    isBoardFlipped = false;
    
    showScreen(menuScreen);
    joinRoomSection.classList.add('hidden');
    roomIdInput.value = '';
}

// Chess Board Management
function initializeBoard() {
    chessBoard.innerHTML = '';
    
    // Determine if we need to flip the board rendering
    const shouldFlip = isBoardFlipped;
    
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const square = document.createElement('div');
            
            // Calculate file and rank based on flip state
            const actualRow = shouldFlip ? (7 - row) : row;
            const actualCol = shouldFlip ? (7 - col) : col;
            
            const file = String.fromCharCode(97 + actualCol); // a-h
            const rank = 8 - actualRow; // 8-1
            const squareId = file + rank;
            
            square.className = 'square';
            square.classList.add((row + col) % 2 === 0 ? 'light' : 'dark');
            square.dataset.square = squareId;
            
            square.addEventListener('click', () => handleSquareClick(squareId));
            
            chessBoard.appendChild(square);
        }
    }
}

function renderBoard() {
    if (!gameState) return;

    const position = parseFEN(gameState.fen);
    
    document.querySelectorAll('.square').forEach(square => {
        const squareId = square.dataset.square;
        const piece = position[squareId];
        
        // Clear square content
        square.innerHTML = '';
        
        // Add piece with wrapper for proper rotation
        if (piece) {
            const pieceSpan = document.createElement('span');
            pieceSpan.className = 'piece';
            pieceSpan.textContent = piece;
            square.appendChild(pieceSpan);
        }
        
        square.classList.remove('selected', 'legal-move', 'legal-capture', 'last-move');
    });

    // Highlight last move
    if (gameState.moveHistory && gameState.moveHistory.length > 0) {
        const lastMove = gameState.moveHistory[gameState.moveHistory.length - 1];
        const fromSquare = document.querySelector(`[data-square="${lastMove.from}"]`);
        const toSquare = document.querySelector(`[data-square="${lastMove.to}"]`);
        if (fromSquare) fromSquare.classList.add('last-move');
        if (toSquare) toSquare.classList.add('last-move');
    }
}

function parseFEN(fen) {
    const position = {};
    const rows = fen.split(' ')[0].split('/');
    
    rows.forEach((row, rowIndex) => {
        let colIndex = 0;
        for (let char of row) {
            if (isNaN(char)) {
                const file = String.fromCharCode(97 + colIndex);
                const rank = 8 - rowIndex;
                position[file + rank] = PIECES[char];
                colIndex++;
            } else {
                colIndex += parseInt(char);
            }
        }
    });
    
    return position;
}

function handleSquareClick(squareId) {
    if (playerRole !== 'player') return;
    if (gameState.isGameOver) return;
    if (gameState.turn !== playerColor) return;

    const clickedSquare = document.querySelector(`[data-square="${squareId}"]`);
    const pieceElement = clickedSquare.querySelector('.piece');
    const piece = pieceElement ? pieceElement.textContent : '';

    // If a square is already selected
    if (selectedSquare) {
        // Check if clicked square is a legal move
        const move = legalMoves.find(m => m.to === squareId);
        if (move) {
            // Make the move
            makeMove({
                from: selectedSquare,
                to: squareId,
                promotion: move.promotion || 'q' // Auto-promote to queen
            });
            clearSelection();
        } else if (piece && isOwnPiece(piece)) {
            // Select different piece
            selectSquare(squareId);
        } else {
            // Deselect
            clearSelection();
        }
    } else {
        // Select a piece
        if (piece && isOwnPiece(piece)) {
            selectSquare(squareId);
        }
    }
}

function isOwnPiece(piece) {
    const whitePieces = ['♔', '♕', '♖', '♗', '♘', '♙'];
    const blackPieces = ['♚', '♛', '♜', '♝', '♞', '♟'];
    
    if (playerColor === 'white') {
        return whitePieces.includes(piece);
    } else {
        return blackPieces.includes(piece);
    }
}

function selectSquare(squareId) {
    clearSelection();
    selectedSquare = squareId;
    
    const square = document.querySelector(`[data-square="${squareId}"]`);
    square.classList.add('selected');
    
    // Request legal moves from server
    ws.send(JSON.stringify({
        type: 'get_legal_moves',
        square: squareId
    }));
}

function clearSelection() {
    selectedSquare = null;
    legalMoves = [];
    document.querySelectorAll('.square').forEach(sq => {
        sq.classList.remove('selected', 'legal-move', 'legal-capture');
    });
}

function highlightLegalMoves() {
    legalMoves.forEach(move => {
        const square = document.querySelector(`[data-square="${move.to}"]`);
        if (square) {
            if (move.captured) {
                square.classList.add('legal-capture');
            } else {
                square.classList.add('legal-move');
            }
        }
    });
}

function makeMove(move) {
    ws.send(JSON.stringify({
        type: 'make_move',
        move: move
    }));
}

function updateGameInfo() {
    if (!gameState) return;

    // Update turn indicator
    const turnText = gameState.turn === 'white' ? "White's Turn" : "Black's Turn";
    currentTurnText.textContent = gameState.isGameOver ? 'Game Over' : turnText;

    // Highlight active player
    whitePlayerInfo.classList.toggle('active', gameState.turn === 'white');
    blackPlayerInfo.classList.toggle('active', gameState.turn === 'black');

    // Update game status
    gameStatusDiv.className = 'game-status';
    if (gameState.isCheckmate) {
        gameStatusDiv.textContent = 'Checkmate!';
        gameStatusDiv.classList.add('checkmate');
    } else if (gameState.isCheck) {
        gameStatusDiv.textContent = 'Check!';
        gameStatusDiv.classList.add('check');
    } else if (gameState.isStalemate) {
        gameStatusDiv.textContent = 'Stalemate!';
    } else if (gameState.isDraw) {
        gameStatusDiv.textContent = 'Draw!';
    } else {
        gameStatusDiv.textContent = '';
    }
    
    // Trigger bot move if it's bot's turn
    if (gameMode === 'bot' && !gameState.isGameOver) {
        const botColor = playerColor === 'white' ? 'black' : 'white';
        if (gameState.turn === botColor) {
            setTimeout(makeBotMove, 500); // Delay for realism
        }
    }
}

// Bot Move Logic
function makeBotMove() {
    if (!gameState || gameState.isGameOver) return;
    
    // Get all legal moves for current position
    const allMoves = [];
    const squares = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const ranks = ['1', '2', '3', '4', '5', '6', '7', '8'];
    
    squares.forEach(file => {
        ranks.forEach(rank => {
            const square = file + rank;
            // Request legal moves from server
            ws.send(JSON.stringify({
                type: 'get_legal_moves',
                square: square
            }));
        });
    });
    
    // For now, make a random move (will be improved with difficulty)
    // This is a simplified version - in production, you'd use chess.js on client side
    setTimeout(() => {
        // Placeholder: In real implementation, collect moves and choose based on difficulty
        console.log('Bot is thinking...');
    }, 300);
}

function updatePlayerInfo() {
    if (!gameState || !gameState.players) return;

    const whitePlayer = gameState.players.find(p => p.color === 'white');
    const blackPlayer = gameState.players.find(p => p.color === 'black');

    if (whitePlayer) {
        whitePlayerInfo.querySelector('.player-name').textContent = whitePlayer.name;
    }
    if (blackPlayer) {
        blackPlayerInfo.querySelector('.player-name').textContent = blackPlayer.name;
    }
}

function updateMoveHistory() {
    if (!gameState || !gameState.moveHistory) return;

    moveList.innerHTML = '';
    gameState.moveHistory.forEach((move, index) => {
        const moveItem = document.createElement('div');
        moveItem.className = 'move-item';
        const moveNumber = Math.floor(index / 2) + 1;
        const color = index % 2 === 0 ? 'White' : 'Black';
        moveItem.textContent = `${moveNumber}. ${move.san}`;
        moveList.appendChild(moveItem);
    });

    // Scroll to bottom
    moveList.scrollTop = moveList.scrollHeight;
}

function showGameOver() {
    setTimeout(() => {
        if (gameState.isCheckmate) {
            const winner = gameState.turn === 'white' ? 'Black' : 'White';
            gameOverTitle.textContent = 'Checkmate!';
            if ((winner === 'White' && playerColor === 'white') || 
                (winner === 'Black' && playerColor === 'black')) {
                gameOverMessage.textContent = 'You Won! 🎉';
            } else if (playerRole === 'spectator') {
                gameOverMessage.textContent = `${winner} Wins!`;
            } else {
                gameOverMessage.textContent = 'You Lost!';
            }
        } else if (gameState.isStalemate) {
            gameOverTitle.textContent = 'Stalemate!';
            gameOverMessage.textContent = "It's a draw!";
        } else if (gameState.isDraw) {
            gameOverTitle.textContent = 'Draw!';
            gameOverMessage.textContent = 'Game ended in a draw!';
        }
        gameOverModal.classList.remove('hidden');
    }, 500);
}

function hideGameOver() {
    gameOverModal.classList.add('hidden');
}

// Event Handlers
createRoomBtn.addEventListener('click', () => {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
        alert('Not connected to server. Please wait...');
        return;
    }
    
    let playerName = playerNameInput.value.trim() || 'Player';
    // Validate and sanitize player name
    playerName = playerName.substring(0, 20).replace(/[<>"']/g, '');
    
    ws.send(JSON.stringify({
        type: 'create_room',
        playerName
    }));
});

joinRoomBtn.addEventListener('click', () => {
    joinRoomSection.classList.toggle('hidden');
});

joinRoomConfirmBtn.addEventListener('click', () => {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
        alert('Not connected to server. Please wait...');
        return;
    }
    
    const roomId = roomIdInput.value.trim().toUpperCase();
    let playerName = playerNameInput.value.trim() || 'Player';
    
    // Validate room ID
    if (!roomId) {
        alert('Please enter a room ID');
        return;
    }
    
    if (!/^[A-Z0-9]{6}$/.test(roomId)) {
        alert('Invalid room ID format. Must be 6 characters.');
        return;
    }
    
    // Validate and sanitize player name
    playerName = playerName.substring(0, 20).replace(/[<>"']/g, '');

    ws.send(JSON.stringify({
        type: 'join_room',
        roomId,
        playerName
    }));
});

copyRoomIdBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(currentRoomId).then(() => {
        copyRoomIdBtn.textContent = '✓';
        setTimeout(() => {
            copyRoomIdBtn.textContent = '📋';
        }, 2000);
    });
});

resetGameBtn.addEventListener('click', () => {
    if (confirm('Start a new game?')) {
        ws.send(JSON.stringify({
            type: 'reset_game'
        }));
    }
});

playAgainBtn.addEventListener('click', () => {
    ws.send(JSON.stringify({
        type: 'reset_game'
    }));
});

leaveRoomBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to leave the room?')) {
        ws.close();
        resetToMenu();
        connectWebSocket();
    }
});

// Allow Enter key to submit
playerNameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        createRoomBtn.click();
    }
});

roomIdInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        joinRoomConfirmBtn.click();
    }
});

// Theme Management
function changeTheme(theme) {
    // Remove all theme classes
    document.body.classList.remove('theme-classic', 'theme-modern', 'theme-wooden', 'theme-dark', 'theme-green', 'theme-bw');
    
    // Add selected theme class
    if (theme !== 'classic') {
        document.body.classList.add(`theme-${theme}`);
    }
    
    // Save theme preference
    localStorage.setItem('chessTheme', theme);
}

// Board Flip
function flipBoard() {
    isBoardFlipped = !isBoardFlipped;
    // Reinitialize and render board with new orientation
    initializeBoard();
    renderBoard();
}

// Theme selector event
themeSelect.addEventListener('change', (e) => {
    changeTheme(e.target.value);
});

// Flip board button
flipBoardBtn.addEventListener('click', () => {
    flipBoard();
});

// Game Mode Selection
humanModeBtn.addEventListener('click', () => {
    gameMode = 'human';
    humanModeBtn.classList.add('active');
    botModeBtn.classList.remove('active');
    botDifficultySection.classList.add('hidden');
    colorSelectionSection.classList.add('hidden');
    joinRoomBtn.style.display = 'block';
});

botModeBtn.addEventListener('click', () => {
    gameMode = 'bot';
    botModeBtn.classList.add('active');
    humanModeBtn.classList.remove('active');
    botDifficultySection.classList.remove('hidden');
    colorSelectionSection.classList.remove('hidden');
    joinRoomBtn.style.display = 'none';
});

// Color Selection
whiteColorBtn.addEventListener('click', () => {
    selectedColor = 'white';
    whiteColorBtn.classList.add('active');
    blackColorBtn.classList.remove('active');
    randomColorBtn.classList.remove('active');
});

blackColorBtn.addEventListener('click', () => {
    selectedColor = 'black';
    blackColorBtn.classList.add('active');
    whiteColorBtn.classList.remove('active');
    randomColorBtn.classList.remove('active');
});

randomColorBtn.addEventListener('click', () => {
    selectedColor = 'random';
    randomColorBtn.classList.add('active');
    whiteColorBtn.classList.remove('active');
    blackColorBtn.classList.remove('active');
});

// Bot Difficulty
botDifficulty.addEventListener('change', (e) => {
    botDifficultyLevel = e.target.value;
});

// Load saved theme on startup
const savedTheme = localStorage.getItem('chessTheme') || 'classic';
themeSelect.value = savedTheme;
changeTheme(savedTheme);

// Initialize
connectWebSocket();
