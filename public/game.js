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
const backToMenuBtn = document.getElementById('backToMenuBtn');
const modalIcon = document.getElementById('modalIcon');
const modalStats = document.getElementById('modalStats');

const moveCountEl = document.getElementById('moveCount');
const captureCountEl = document.getElementById('captureCount');

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
let localChess = null; // Local chess instance for bot games
let isBotGame = false;

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
            playerRole = 'player'; // CRITICAL FIX: Set role to player
            console.log('Your color set to:', playerColor, 'Role:', playerRole);
            break;

        case 'game_start':
            gameState = data.gameState;
            console.log('Game started! GameState:', gameState);
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
            // Animate the move
            if (data.move) {
                const fromSquare = document.querySelector(`[data-square="${data.move.from}"]`);
                const toSquare = document.querySelector(`[data-square="${data.move.to}"]`);
                
                // Add animation classes
                if (toSquare) toSquare.classList.add('piece-moving');
                if (data.move.captured && toSquare) {
                    toSquare.classList.add('piece-captured');
                }
                
                // Remove animation classes after animation completes
                setTimeout(() => {
                    if (toSquare) {
                        toSquare.classList.remove('piece-moving', 'piece-captured');
                    }
                }, 400);
            }
            
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
            alert('Game has been reset!');
            break;
        
        case 'reset_request':
            // Another player wants to reset the game
            const colorName = data.requestedBy === 'white' ? 'White' : 'Black';
            if (confirm(`${colorName} player wants to start a new game. Do you agree?`)) {
                ws.send(JSON.stringify({
                    type: 'reset_confirmed'
                }));
            } else {
                ws.send(JSON.stringify({
                    type: 'reset_declined'
                }));
            }
            break;
        
        case 'reset_declined':
            alert('Your opponent declined the new game request.');
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
    isBotGame = false;
    localChess = null;
    
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
    if (!gameState) {
        console.warn('renderBoard called but gameState is null');
        return;
    }

    const position = parseFEN(gameState.fen);
    console.log('Rendering board, position:', position);
    
    document.querySelectorAll('.square').forEach(square => {
        const squareId = square.dataset.square;
        const piece = position[squareId];
        
        // Clear square content and classes
        square.innerHTML = '';
        square.classList.remove('selected', 'legal-move', 'legal-capture', 'last-move');
        
        // Add piece with wrapper
        if (piece) {
            const pieceSpan = document.createElement('span');
            pieceSpan.className = 'piece';
            pieceSpan.textContent = piece;
            pieceSpan.style.position = 'relative';
            pieceSpan.style.zIndex = '5';
            square.appendChild(pieceSpan);
        }
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
    console.log('Square clicked:', squareId, 'Player:', playerColor, 'Turn:', gameState?.turn, 'Role:', playerRole);
    
    if (gameState && gameState.isGameOver) {
        console.log('Game is over, ignoring click');
        return;
    }
    
    // For bot games
    if (isBotGame) {
        if (gameState.turn !== playerColor) {
            console.log('Not your turn in bot game');
            return;
        }
        
        const clickedSquare = document.querySelector(`[data-square="${squareId}"]`);
        const pieceElement = clickedSquare.querySelector('.piece');
        const piece = pieceElement ? pieceElement.textContent : '';
        console.log('Bot game - Piece:', piece);

        if (selectedSquare) {
            const move = legalMoves.find(m => m.to === squareId);
            if (move) {
                localChess.move({ from: selectedSquare, to: squareId, promotion: 'q' });
                updateBotGameState();
                clearSelection();
            } else if (piece && isOwnPiece(piece)) {
                selectSquare(squareId);
            } else {
                clearSelection();
            }
        } else {
            if (piece && isOwnPiece(piece)) {
                selectSquare(squareId);
            }
        }
        return;
    }
    
    // For multiplayer games
    if (playerRole !== 'player') {
        console.log('Not a player, role:', playerRole);
        return;
    }
    
    if (!gameState || gameState.turn !== playerColor) {
        console.log('Not your turn. Your color:', playerColor, 'Current turn:', gameState?.turn);
        return;
    }

    const clickedSquare = document.querySelector(`[data-square="${squareId}"]`);
    const pieceElement = clickedSquare.querySelector('.piece');
    const piece = pieceElement ? pieceElement.textContent : '';
    console.log('Multiplayer - Piece:', piece, 'Is own piece:', isOwnPiece(piece));

    if (selectedSquare) {
        const move = legalMoves.find(m => m.to === squareId);
        if (move) {
            console.log('Making move:', selectedSquare, 'to', squareId);
            makeMove({
                from: selectedSquare,
                to: squareId,
                promotion: move.promotion || 'q'
            });
            clearSelection();
        } else if (piece && isOwnPiece(piece)) {
            selectSquare(squareId);
        } else {
            clearSelection();
        }
    } else {
        if (piece && isOwnPiece(piece)) {
            console.log('Selecting square:', squareId);
            selectSquare(squareId);
        } else {
            console.log('No piece or not your piece');
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
    
    // Get legal moves
    if (isBotGame) {
        // Use local chess instance
        legalMoves = localChess.moves({ square: squareId, verbose: true });
        highlightLegalMoves();
    } else {
        // Request from server
        ws.send(JSON.stringify({
            type: 'get_legal_moves',
            square: squareId
        }));
    }
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
    if (!localChess || localChess.game_over()) return;
    
    const moves = localChess.moves({ verbose: true });
    if (moves.length === 0) return;
    
    let selectedMove;
    
    switch (botDifficultyLevel) {
        case 'easy':
            // Random move
            selectedMove = moves[Math.floor(Math.random() * moves.length)];
            break;
            
        case 'medium':
            // Prefer captures and checks
            const goodMoves = moves.filter(m => m.captured || m.san.includes('+'));
            selectedMove = goodMoves.length > 0 
                ? goodMoves[Math.floor(Math.random() * goodMoves.length)]
                : moves[Math.floor(Math.random() * moves.length)];
            break;
            
        case 'hard':
            // Best move using simple evaluation
            selectedMove = getBestMove(moves);
            break;
            
        default:
            selectedMove = moves[Math.floor(Math.random() * moves.length)];
    }
    
    // Make the move
    localChess.move(selectedMove);
    updateBotGameState();
}

function getBestMove(moves) {
    // Simple evaluation: prioritize captures, checks, and center control
    let bestMove = moves[0];
    let bestScore = -9999;
    
    moves.forEach(move => {
        let score = 0;
        
        // Prioritize captures
        if (move.captured) {
            const pieceValues = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
            score += pieceValues[move.captured] * 10;
        }
        
        // Prioritize checks
        if (move.san.includes('+')) score += 5;
        
        // Prioritize checkmate
        if (move.san.includes('#')) score += 1000;
        
        // Prioritize center control
        if (['e4', 'e5', 'd4', 'd5'].includes(move.to)) score += 2;
        
        // Add randomness for variety
        score += Math.random() * 2;
        
        if (score > bestScore) {
            bestScore = score;
            bestMove = move;
        }
    });
    
    return bestMove;
}

function updateBotGameState() {
    // Update game state from local chess instance
    gameState = {
        fen: localChess.fen(),
        pgn: localChess.pgn(),
        turn: localChess.turn() === 'w' ? 'white' : 'black',
        isCheck: localChess.in_check(),
        isCheckmate: localChess.in_checkmate(),
        isStalemate: localChess.in_stalemate(),
        isDraw: localChess.in_draw(),
        isGameOver: localChess.game_over(),
        players: [
            { name: playerNameInput.value.trim() || 'You', color: playerColor },
            { name: '🤖 Bot', color: playerColor === 'white' ? 'black' : 'white' }
        ],
        moveHistory: localChess.history({ verbose: true })
    };
    
    renderBoard();
    updateGameInfo();
    updateMoveHistory();
    
    if (gameState.isGameOver) {
        showGameOver();
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
    let captureCount = 0;
    
    gameState.moveHistory.forEach((move, index) => {
        const moveItem = document.createElement('div');
        moveItem.className = 'move-item';
        const moveNumber = Math.floor(index / 2) + 1;
        const color = index % 2 === 0 ? '⚪' : '⚫';
        moveItem.textContent = `${moveNumber}. ${color} ${move.san}`;
        moveList.appendChild(moveItem);
        
        // Count captures
        if (move.captured) captureCount++;
    });

    // Update stats
    moveCountEl.textContent = Math.ceil(gameState.moveHistory.length / 2);
    captureCountEl.textContent = captureCount;

    // Scroll to bottom
    moveList.scrollTop = moveList.scrollHeight;
}

function showGameOver() {
    setTimeout(() => {
        let statsHTML = '';
        
        if (gameState.isCheckmate) {
            const winner = gameState.turn === 'white' ? 'Black' : 'White';
            gameOverTitle.textContent = 'Checkmate!';
            
            if ((winner === 'White' && playerColor === 'white') || 
                (winner === 'Black' && playerColor === 'black')) {
                gameOverMessage.textContent = 'You Won! 🎉';
                modalIcon.textContent = '🏆';
            } else if (playerRole === 'spectator') {
                gameOverMessage.textContent = `${winner} Wins!`;
                modalIcon.textContent = '👑';
            } else {
                gameOverMessage.textContent = 'You Lost!';
                modalIcon.textContent = '😔';
            }
        } else if (gameState.isStalemate) {
            gameOverTitle.textContent = 'Stalemate!';
            gameOverMessage.textContent = "It's a draw!";
            modalIcon.textContent = '🤝';
        } else if (gameState.isDraw) {
            gameOverTitle.textContent = 'Draw!';
            gameOverMessage.textContent = 'Game ended in a draw!';
            modalIcon.textContent = '🤝';
        }
        
        // Add game statistics
        const totalMoves = Math.ceil(gameState.moveHistory.length / 2);
        const captures = gameState.moveHistory.filter(m => m.captured).length;
        const checks = gameState.moveHistory.filter(m => m.san.includes('+')).length;
        
        statsHTML = `
            <p><strong>Total Moves:</strong> ${totalMoves}</p>
            <p><strong>Captures:</strong> ${captures}</p>
            <p><strong>Checks:</strong> ${checks}</p>
        `;
        
        modalStats.innerHTML = statsHTML;
        gameOverModal.classList.remove('hidden');
    }, 500);
}

function hideGameOver() {
    gameOverModal.classList.add('hidden');
}

// Event Handlers
createRoomBtn.addEventListener('click', () => {
    let playerName = playerNameInput.value.trim() || 'Player';
    playerName = playerName.substring(0, 20).replace(/[<>"']/g, '');
    
    if (gameMode === 'bot') {
        // Start bot game locally
        startBotGame(playerName);
    } else {
        // Create multiplayer room
        if (!ws || ws.readyState !== WebSocket.OPEN) {
            alert('Not connected to server. Please wait...');
            return;
        }
        
        ws.send(JSON.stringify({
            type: 'create_room',
            playerName
        }));
    }
});

function startBotGame(playerName) {
    isBotGame = true;
    
    // Check if Chess.js is loaded
    if (typeof Chess === 'undefined') {
        alert('Chess library not loaded. Please refresh the page.');
        console.error('Chess.js library not found');
        return;
    }
    
    // Determine player color
    if (selectedColor === 'random') {
        playerColor = Math.random() < 0.5 ? 'white' : 'black';
    } else {
        playerColor = selectedColor;
    }
    
    playerRole = 'player';
    
    // Initialize local chess instance
    try {
        localChess = new Chess();
    } catch (error) {
        console.error('Failed to initialize Chess:', error);
        alert('Failed to start bot game. Please refresh the page.');
        return;
    }
    
    // Create initial game state
    gameState = {
        fen: localChess.fen(),
        pgn: localChess.pgn(),
        turn: 'white',
        isCheck: false,
        isCheckmate: false,
        isStalemate: false,
        isDraw: false,
        isGameOver: false,
        players: [
            { name: playerName, color: playerColor },
            { name: '🤖 Bot (' + botDifficultyLevel + ')', color: playerColor === 'white' ? 'black' : 'white' }
        ],
        moveHistory: []
    };
    
    // Show game screen
    showGameScreen();
    
    // CRITICAL: Render the board with pieces
    renderBoard();
    updatePlayerInfo();
    updateGameInfo();
    
    // If player is black, bot makes first move
    if (playerColor === 'black') {
        setTimeout(makeBotMove, 1000);
    }
}

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
        if (isBotGame) {
            // Reset bot game
            const playerName = gameState.players.find(p => p.color === playerColor).name;
            startBotGame(playerName);
        } else {
            // Reset multiplayer game
            ws.send(JSON.stringify({
                type: 'reset_game'
            }));
        }
    }
});

playAgainBtn.addEventListener('click', () => {
    hideGameOver();
    if (isBotGame) {
        const playerName = gameState.players.find(p => p.color === playerColor).name;
        startBotGame(playerName);
    } else {
        ws.send(JSON.stringify({
            type: 'reset_game'
        }));
    }
});

backToMenuBtn.addEventListener('click', () => {
    hideGameOver();
    if (isBotGame) {
        resetToMenu();
    } else {
        if (confirm('Leave the game and return to menu?')) {
            ws.close();
            resetToMenu();
            connectWebSocket();
        }
    }
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
    colorSelectionSection.classList.add('hidden'); // Hide for human mode
    joinRoomBtn.style.display = 'block';
});

botModeBtn.addEventListener('click', () => {
    gameMode = 'bot';
    botModeBtn.classList.add('active');
    humanModeBtn.classList.remove('active');
    botDifficultySection.classList.remove('hidden');
    colorSelectionSection.classList.remove('hidden'); // Show only for bot mode
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

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    // ESC to close modal or go back
    if (e.key === 'Escape') {
        if (!gameOverModal.classList.contains('hidden')) {
            hideGameOver();
        }
    }
    
    // F for flip board (during game)
    if (e.key === 'f' || e.key === 'F') {
        if (gameState && !menuScreen.classList.contains('active')) {
            flipBoard();
        }
    }
    
    // R for reset (with confirmation)
    if ((e.key === 'r' || e.key === 'R') && e.ctrlKey) {
        e.preventDefault();
        if (gameState && !menuScreen.classList.contains('active')) {
            resetGameBtn.click();
        }
    }
});

// Prevent accidental page refresh during game
window.addEventListener('beforeunload', (e) => {
    if (gameState && !menuScreen.classList.contains('active')) {
        e.preventDefault();
        e.returnValue = '';
    }
});

// Initialize
connectWebSocket();
