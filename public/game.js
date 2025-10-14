// WebSocket connection
let ws;
let playerColor = null;
let playerRole = null;
let currentRoomId = null;
let gameState = null;
let selectedSquare = null;
let legalMoves = [];

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

// Initialize WebSocket connection
function connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
        console.log('Connected to server');
        updateConnectionStatus('connected');
    };

    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        handleServerMessage(data);
    };

    ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        updateConnectionStatus('disconnected');
    };

    ws.onclose = () => {
        console.log('Disconnected from server');
        updateConnectionStatus('disconnected');
        setTimeout(connectWebSocket, 3000);
    };
}

function updateConnectionStatus(status) {
    connectionStatus.className = `status-bar ${status}`;
    if (status === 'connected') {
        statusText.textContent = 'Connected';
    } else if (status === 'disconnected') {
        statusText.textContent = 'Disconnected';
    } else {
        statusText.textContent = 'Connecting...';
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
}

function resetToMenu() {
    currentRoomId = null;
    playerColor = null;
    playerRole = null;
    gameState = null;
    selectedSquare = null;
    legalMoves = [];
    showScreen(menuScreen);
    joinRoomSection.classList.add('hidden');
    roomIdInput.value = '';
}

// Chess Board Management
function initializeBoard() {
    chessBoard.innerHTML = '';
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const square = document.createElement('div');
            const file = String.fromCharCode(97 + col); // a-h
            const rank = 8 - row; // 8-1
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
        square.textContent = position[squareId] || '';
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
    const piece = clickedSquare.textContent;

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
    const playerName = playerNameInput.value.trim() || 'Player';
    ws.send(JSON.stringify({
        type: 'create_room',
        playerName
    }));
});

joinRoomBtn.addEventListener('click', () => {
    joinRoomSection.classList.toggle('hidden');
});

joinRoomConfirmBtn.addEventListener('click', () => {
    const roomId = roomIdInput.value.trim().toUpperCase();
    const playerName = playerNameInput.value.trim() || 'Player';
    
    if (!roomId) {
        alert('Please enter a room ID');
        return;
    }

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

// Initialize
connectWebSocket();
