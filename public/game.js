// game.js - Fixed version with working theme, pieces, and intelligent tips
'use strict';

/* === CONFIG === */
const CONFIG = {
    MAX_NAME_LENGTH: 15,
    MAX_PIN_LENGTH: 4,
    MAX_ROOM_ID_LENGTH: 6,
    BOT_MOVE_DELAY: 500,
    COPY_FEEDBACK_DELAY: 1000,
    BLUNDER_THRESHOLD: 200 // centipawn loss to trigger tip
};

const GAME_MODES = {
    HUMAN: 'human',
    BOT: 'bot'
};

const PLAYER_COLORS = {
    WHITE: 'white',
    BLACK: 'black',
    RANDOM: 'random',
    SPECTATOR: 'spectator'
};

/* === GAME STATE === */
let chess = null; // Will be initialized after Chess.js loads
let gameMode = GAME_MODES.HUMAN;
let playerColor = PLAYER_COLORS.WHITE;
let currentRoomId = null;
let selectedSquare = null;
let legalMoves = [];
let botDifficulty = 'easy';
let isSpectator = false;
let socket = null; // Will be initialized after Socket.IO loads
let moveHistory = [];
let lastMoveEvaluation = null;

/* === DOM REFERENCES === */
const getElements = () => ({
    // Screens
    menuScreen: document.getElementById('menuScreen'),
    waitingScreen: document.getElementById('waitingScreen'),
    gameScreen: document.getElementById('gameScreen'),

    // Menu
    playerNameInput: document.getElementById('playerNameInput'),
    createRoomBtn: document.getElementById('createRoomBtn'),
    joinRoomBtn: document.getElementById('joinRoomBtn'),
    humanModeBtn: document.getElementById('humanModeBtn'),
    botModeBtn: document.getElementById('botModeBtn'),
    botDifficultySection: document.getElementById('botDifficultySection'),

    // Overlays
    joinRoomOverlay: document.getElementById('joinRoomOverlay'),
    createRoomOverlay: document.getElementById('createRoomOverlay'),
    closeOverlayBtn: document.getElementById('closeOverlayBtn'),
    closeCreateOverlayBtn: document.getElementById('closeCreateOverlayBtn'),
    roomIdInput: document.getElementById('roomIdInput'),
    joinPinInput: document.getElementById('joinPinInput'),
    createPinInput: document.getElementById('createPinInput'),
    joinRoomConfirmBtn: document.getElementById('joinRoomConfirmBtn'),
    confirmCreateRoomBtn: document.getElementById('confirmCreateRoomBtn'),

    // Waiting
    displayRoomId: document.getElementById('displayRoomId'),
    displayPin: document.getElementById('displayPin'),
    copyRoomIdBtn: document.getElementById('copyRoomIdBtn'),
    cancelWaitingBtn: document.getElementById('cancelWaitingBtn'),

    // Game
    chessBoard: document.getElementById('chessBoard'),
    statusText: document.getElementById('gameStatus'),
    turnIndicator: document.getElementById('turnIndicator'),
    moveList: document.getElementById('moveList'),
    flipBoardBtn: document.getElementById('flipBoardBtn'),
    resetGameBtn: document.getElementById('resetGameBtn'),
    leaveRoomBtn: document.getElementById('leaveRoomBtn'),

    // Player Cards
    topPlayerCard: document.getElementById('topPlayerCard'),
    bottomPlayerCard: document.getElementById('bottomPlayerCard'),

    // Modals
    gameOverModal: document.getElementById('gameOverModal'),
    requestModal: document.getElementById('requestModal'),
    gameOverTitle: document.getElementById('gameOverTitle'),
    gameOverMessage: document.getElementById('gameOverMessage'),
    playAgainBtn: document.getElementById('playAgainBtn'),
    backToMenuBtn: document.getElementById('backToMenuBtn'),
    acceptRequestBtn: document.getElementById('acceptRequestBtn'),
    declineRequestBtn: document.getElementById('declineRequestBtn'),
    tipsBtn: document.getElementById('tipsBtn'),
    tipsModal: document.getElementById('tipsModal'),
    closeTipsBtn: document.getElementById('closeTipsBtn'),
    nextTipBtn: document.getElementById('nextTipBtn'),

    // Connection
    connectionStatus: document.getElementById('connectionStatus'),
    connectionText: document.getElementById('statusText'),

    // Theme
    themeCheckbox: document.getElementById('checkbox')
});

let ui = {};

/* === UTILITY FUNCTIONS === */
function showScreen(screenName) {
    const screens = {
        menu: ui.menuScreen,
        waiting: ui.waitingScreen,
        game: ui.gameScreen
    };
    Object.values(screens).forEach(s => s && s.classList.remove('active'));
    screens[screenName] && screens[screenName].classList.add('active');
}

function updateConnectionStatus(status) {
    if (ui.connectionStatus) {
        ui.connectionStatus.className = `status-toast ${status}`;
        ui.connectionText.textContent = status === 'connected' ? 'Connected' : 'Disconnected';
    }
}

function sanitizeInput(input, maxLength) {
    return input.trim().substring(0, maxLength);
}

function checkUrlParams() {
    const params = new URLSearchParams(window.location.search);
    return params.get('room');
}

/* === INTELLIGENT TIPS SYSTEM === */
const CONTEXTUAL_TIPS = {
    opening: [
        "💡 Control the center with pawns (e4, d4, e5, d5)",
        "💡 Develop knights before bishops (Nf3, Nc3)",
        "💡 Don't move the same piece twice in opening",
        "💡 Castle early for king safety"
    ],
    middlegame: [
        "💡 Look for tactical opportunities: forks, pins, skewers",
        "💡 Control open files with your rooks",
        "💡 Create weak squares in opponent's position",
        "💡 Don't trade pieces without a reason"
    ],
    endgame: [
        "💡 Activate your king in the endgame",
        "💡 Push passed pawns",
        "💡 Cut off the enemy king with your rook",
        "💡 Two connected passed pawns usually beat a rook"
    ],
    blunder: [
        "⚠️ That move lost material! Use the 'Check Before Move' rule",
        "⚠️ Always check if your pieces are protected",
        "⚠️ Look for opponent's threats before moving",
        "⚠️ Take your time - blunders happen when rushing"
    ],
    tactical: [
        "🎯 Look for a fork - attacking two pieces at once",
        "🎯 Check if you can pin an enemy piece",
        "🎯 Can you create a discovered attack?",
        "🎯 Look for skewer opportunities"
    ]
};

function detectGamePhase() {
    const moves = chess.history().length;
    if (moves < 15) return 'opening';
    if (moves > 40) return 'endgame';
    return 'middlegame';
}

function analyzeLastMove() {
    const moves = chess.history({ verbose: true });
    if (moves.length < 2) return null;

    const lastMove = moves[moves.length - 1];

    // Simple blunder detection: did we lose material?
    if (lastMove.captured) {
        // Lost a piece without capture
        return { type: 'blunder', severity: 'high' };
    }

    // Check if piece is hanging
    const movedPiece = chess.get(lastMove.to);
    if (movedPiece) {
        const isDefended = chess.moves({ square: lastMove.to, verbose: true }).length > 0;
        const attackers = getAttackers(lastMove.to, chess.turn() === 'w' ? 'b' : 'w');

        if (attackers.length > 0 && !isDefended) {
            return { type: 'blunder', severity: 'medium' };
        }
    }

    return null;
}

function getAttackers(square, color) {
    const attackers = [];
    const allSquares = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

    for (let file of allSquares) {
        for (let rank = 1; rank <= 8; rank++) {
            const sq = file + rank;
            const piece = chess.get(sq);
            if (piece && piece.color === color) {
                const moves = chess.moves({ square: sq, verbose: true });
                if (moves.find(m => m.to === square)) {
                    attackers.push(sq);
                }
            }
        }
    }
    return attackers;
}

function getContextualTip() {
    const analysis = analyzeLastMove();

    if (analysis && analysis.type === 'blunder') {
        const tips = CONTEXTUAL_TIPS.blunder;
        return tips[Math.floor(Math.random() * tips.length)];
    }

    // Check if stuck (no good moves)
    const moves = chess.moves({ verbose: true });
    if (moves.length < 5 && moves.length > 0) {
        const tips = CONTEXTUAL_TIPS.tactical;
        return tips[Math.floor(Math.random() * tips.length)];
    }

    const phase = detectGamePhase();
    const tips = CONTEXTUAL_TIPS[phase] || CONTEXTUAL_TIPS.middlegame;
    return tips[Math.floor(Math.random() * tips.length)];
}

function showIntelligentTip() {
    if (!chess) return;

    const tip = getContextualTip();
    const phase = detectGamePhase();

    // Create tip notification
    const tipBanner = document.createElement('div');
    tipBanner.className = 'tip-banner';
    tipBanner.innerHTML = `
        <span class="tip-icon">💭</span>
        <div class="tip-content">
            <strong>${phase.toUpperCase()} TIP</strong>
            <p>${tip}</p>
        </div>
        <button class="tip-close">✕</button>
    `;

    document.body.appendChild(tipBanner);

    // Animate in
    setTimeout(() => tipBanner.classList.add('show'), 100);

    // Auto-dismiss after 8 seconds
    const dismiss = () => {
        tipBanner.classList.remove('show');
        setTimeout(() => tipBanner.remove(), 300);
    };

    tipBanner.querySelector('.tip-close').onclick = dismiss;
    setTimeout(dismiss, 8000);
}

/* === BOARD FUNCTIONS === */
function getSquareId(row, col) {
    const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const rank = 8 - row;
    return `${files[col]}${rank}`;
}

function getPieceName(type) {
    const names = {
        'p': 'pawn', 'r': 'rook', 'n': 'knight',
        'b': 'bishop', 'q': 'queen', 'k': 'king'
    };
    return names[type] || '';
}

function initBoard() {
    if (ui.chessBoard) {
        ui.chessBoard.innerHTML = '';
    }
}

function updateBoard(fen, isFlipped) {
    if (!ui.chessBoard) return;

    const boardEl = ui.chessBoard;
    boardEl.innerHTML = '';

    // Parse FEN
    let rows = [];
    let fenRows = fen.split(' ')[0].split('/');

    for (let r = 0; r < 8; r++) {
        let rowStr = fenRows[r];
        let colIdx = 0;
        for (let char of rowStr) {
            if (isNaN(char)) {
                const squareId = getSquareId(r, colIdx);
                rows.push({ id: squareId, piece: char, r, c: colIdx });
                colIdx++;
            } else {
                let count = parseInt(char);
                for (let i = 0; i < count; i++) {
                    const squareId = getSquareId(r, colIdx);
                    rows.push({ id: squareId, piece: null, r, c: colIdx });
                    colIdx++;
                }
            }
        }
    }

    // Board rotation
    boardEl.style.transform = isFlipped ? 'rotate(180deg)' : 'rotate(0deg)';

    rows.forEach(sq => {
        const div = document.createElement('div');
        div.className = `square ${(sq.r + sq.c) % 2 === 0 ? 'light' : 'dark'}`;
        div.dataset.square = sq.id;
        div.setAttribute('role', 'gridcell');
        div.setAttribute('aria-label', `Square ${sq.id}`);

        if (selectedSquare === sq.id) {
            div.classList.add('selected');
        }

        // Check legal moves
        const move = legalMoves.find(m => m.to === sq.id);
        if (move) {
            if (move.captured) div.classList.add('legal-capture');
            else div.classList.add('legal-move');
        }

        if (sq.piece) {
            const pieceDiv = document.createElement('div');
            const color = sq.piece === sq.piece.toUpperCase() ? 'w' : 'b';
            const type = sq.piece.toLowerCase();

            pieceDiv.className = `piece ${color}-${type}`;
            pieceDiv.setAttribute('aria-label', `${color === 'w' ? 'White' : 'Black'} ${getPieceName(type)}`);

            if (isFlipped) {
                pieceDiv.style.transform = 'rotate(180deg)';
            }

            div.appendChild(pieceDiv);
        }

        boardEl.appendChild(div);
    });
}

function flipBoardView() {
    if (!ui.chessBoard) return;

    const current = ui.chessBoard.style.transform;
    const isRotated = current === 'rotate(180deg)';
    ui.chessBoard.style.transform = isRotated ? 'rotate(0deg)' : 'rotate(180deg)';

    document.querySelectorAll('.piece').forEach(p => {
        p.style.transform = ui.chessBoard.style.transform === 'rotate(180deg)' ? 'rotate(180deg)' : 'rotate(0deg)';
    });
}

/* === GAME LOGIC === */
function setGameMode(mode) {
    gameMode = mode;
    if (ui.humanModeBtn) {
        ui.humanModeBtn.classList.toggle('active', mode === GAME_MODES.HUMAN);
        ui.humanModeBtn.setAttribute('aria-pressed', mode === GAME_MODES.HUMAN);
    }
    if (ui.botModeBtn) {
        ui.botModeBtn.classList.toggle('active', mode === GAME_MODES.BOT);
        ui.botModeBtn.setAttribute('aria-pressed', mode === GAME_MODES.BOT);
    }
    if (ui.botDifficultySection) {
        ui.botDifficultySection.classList.toggle('hidden', mode !== GAME_MODES.BOT);
    }
}

function createRoom() {
    const playerName = sanitizeInput(ui.playerNameInput.value, CONFIG.MAX_NAME_LENGTH) || 'Player';
    const pin = sanitizeInput(ui.createPinInput.value, CONFIG.MAX_PIN_LENGTH);

    let requestedColor = PLAYER_COLORS.RANDOM;
    if (document.getElementById('whiteColorBtn')?.classList.contains('active')) requestedColor = PLAYER_COLORS.WHITE;
    if (document.getElementById('blackColorBtn')?.classList.contains('active')) requestedColor = PLAYER_COLORS.BLACK;

    if (socket) {
        socket.emit('create_room', { playerName, pin, color: requestedColor });
    }
}

function joinRoom() {
    const roomId = sanitizeInput(ui.roomIdInput.value, CONFIG.MAX_ROOM_ID_LENGTH).toUpperCase();
    const pin = sanitizeInput(ui.joinPinInput.value, CONFIG.MAX_PIN_LENGTH);
    const playerName = sanitizeInput(ui.playerNameInput.value, CONFIG.MAX_NAME_LENGTH) || 'Player';

    if (!roomId) {
        alert('Please enter a Room ID');
        return;
    }

    if (socket) {
        socket.emit('join_room', { roomId, pin, playerName });
    }
}

function startBotGame() {
    if (!chess) return;

    gameMode = GAME_MODES.BOT;
    isSpectator = false;
    if (ui.createRoomOverlay) ui.createRoomOverlay.classList.add('hidden');

    chess.reset();

    if (playerColor === PLAYER_COLORS.RANDOM) {
        playerColor = Math.random() < 0.5 ? PLAYER_COLORS.WHITE : PLAYER_COLORS.BLACK;
    }

    showScreen('game');
    initBoard();
    updateBoard(chess.fen(), playerColor === PLAYER_COLORS.BLACK);
    updateGameInfo({
        turn: chess.turn() === 'w' ? PLAYER_COLORS.WHITE : PLAYER_COLORS.BLACK,
        isGameOver: false,
        fen: chess.fen(),
        moveHistory: []
    });

    if (playerColor === PLAYER_COLORS.BLACK) {
        setTimeout(makeBotMove, CONFIG.BOT_MOVE_DELAY);
    }
}

function handleSquareClick(squareId) {
    if (!chess || isSpectator) return;

    if (gameMode === GAME_MODES.BOT) {
        const turnColor = chess.turn() === 'w' ? PLAYER_COLORS.WHITE : PLAYER_COLORS.BLACK;
        if (turnColor !== playerColor) return;

        if (selectedSquare === null) {
            const piece = chess.get(squareId);
            if (piece && ((piece.color === 'w' && playerColor === PLAYER_COLORS.WHITE) || (piece.color === 'b' && playerColor === PLAYER_COLORS.BLACK))) {
                selectedSquare = squareId;
                legalMoves = chess.moves({ square: squareId, verbose: true });
                updateBoard(chess.fen(), playerColor === PLAYER_COLORS.BLACK);
            }
        } else {
            const move = legalMoves.find(m => m.to === squareId);
            if (move) {
                chess.move({ from: selectedSquare, to: squareId, promotion: 'q' });
                selectedSquare = null;
                legalMoves = [];
                updateGameState({
                    fen: chess.fen(),
                    isGameOver: chess.game_over(),
                    moveHistory: chess.history({ verbose: true }),
                    turn: chess.turn() === 'w' ? PLAYER_COLORS.WHITE : PLAYER_COLORS.BLACK
                });
                updateBoard(chess.fen(), playerColor === PLAYER_COLORS.BLACK);

                if (!chess.game_over()) {
                    setTimeout(makeBotMove, CONFIG.BOT_MOVE_DELAY);
                }
            } else {
                const piece = chess.get(squareId);
                if (piece && ((piece.color === 'w' && playerColor === PLAYER_COLORS.WHITE) || (piece.color === 'b' && playerColor === PLAYER_COLORS.BLACK))) {
                    selectedSquare = squareId;
                    legalMoves = chess.moves({ square: squareId, verbose: true });
                    updateBoard(chess.fen(), playerColor === PLAYER_COLORS.BLACK);
                } else {
                    selectedSquare = null;
                    legalMoves = [];
                    updateBoard(chess.fen(), playerColor === PLAYER_COLORS.BLACK);
                }
            }
        }
        return;
    }

    // Multiplayer
    if (selectedSquare === null) {
        if (socket) {
            socket.emit('get_legal_moves', { roomId: currentRoomId, square: squareId });
        }
        selectedSquare = squareId;
    } else {
        const move = legalMoves.find(m => m.to === squareId);
        if (move) {
            if (socket) {
                socket.emit('make_move', {
                    roomId: currentRoomId,
                    move: { from: selectedSquare, to: squareId, promotion: 'q' }
                });
            }
            selectedSquare = null;
            legalMoves = [];
        } else {
            if (socket) {
                socket.emit('get_legal_moves', { roomId: currentRoomId, square: squareId });
            }
            selectedSquare = squareId;
        }
    }
}

function makeBotMove() {
    if (!chess || chess.game_over()) return;

    const moves = chess.moves({ verbose: true });
    let move;

    if (botDifficulty === 'easy') {
        move = moves[Math.floor(Math.random() * moves.length)];
    } else {
        const captures = moves.filter(m => m.captured);
        if (captures.length > 0) move = captures[Math.floor(Math.random() * captures.length)];
        else move = moves[Math.floor(Math.random() * moves.length)];
    }

    chess.move(move);
    updateGameState({
        fen: chess.fen(),
        isGameOver: chess.game_over(),
        moveHistory: chess.history({ verbose: true }),
        turn: chess.turn() === 'w' ? PLAYER_COLORS.WHITE : PLAYER_COLORS.BLACK
    });
    updateBoard(chess.fen(), playerColor === PLAYER_COLORS.BLACK);
}

function requestReset() {
    if (gameMode === GAME_MODES.BOT) {
        startBotGame();
    } else {
        if (socket) {
            socket.emit('reset_request', { roomId: currentRoomId });
        }
    }
}

function updateGameState(state) {
    if (!chess) return;

    chess.load(state.fen);

    if (state.isGameOver) {
        if (ui.gameOverTitle) {
            ui.gameOverTitle.textContent = state.winner ? (state.winner === playerColor ? "You Won! 🏆" : "You Lost 😞") : "Draw 🤝";
            if (state.winner === 'draw') ui.gameOverTitle.textContent = "Draw!";
        }

        if (ui.gameOverMessage) {
            ui.gameOverMessage.textContent = state.isCheckmate ? `Checkmate by ${state.turn === PLAYER_COLORS.WHITE ? 'Black' : 'White'}` : "Game Ended";
        }

        if (ui.gameOverModal) {
            ui.gameOverModal.classList.remove('hidden');
        }
    }
}

function updateGameInfo(state) {
    const isTurn = state.turn === playerColor;

    if (ui.turnIndicator) {
        ui.turnIndicator.textContent = state.turn === PLAYER_COLORS.WHITE ? "White's Turn" : "Black's Turn";
        ui.turnIndicator.style.background = isTurn ? 'var(--success-color)' : 'var(--glass-border)';
    }

    if (ui.bottomPlayerCard && ui.topPlayerCard) {
        const myInfo = ui.bottomPlayerCard.querySelector('.info h3');
        const opInfo = ui.topPlayerCard.querySelector('.info h3');

        if (myInfo) myInfo.textContent = ui.playerNameInput?.value || 'Me';
        if (opInfo) opInfo.textContent = 'Opponent';
    }

    if (ui.moveList) {
        ui.moveList.innerHTML = '';
        state.moveHistory.forEach((m, i) => {
            if (i % 2 === 0) {
                const div = document.createElement('div');
                div.textContent = `${Math.floor(i / 2) + 1}. ${m.san}`;
                ui.moveList.appendChild(div);
            } else {
                const last = ui.moveList.lastElementChild;
                if (last) last.textContent += ` ${m.san}`;
            }
        });
        ui.moveList.scrollTop = ui.moveList.scrollHeight;
    }
}

/* === EVENT SETUP === */
function setupEventListeners() {
    // Mode Selection
    ui.humanModeBtn?.addEventListener('click', () => setGameMode(GAME_MODES.HUMAN));
    ui.botModeBtn?.addEventListener('click', () => setGameMode(GAME_MODES.BOT));

    // Difficulty
    document.querySelectorAll('.diff-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.diff-btn').forEach(b => {
                b.classList.remove('active');
                b.setAttribute('aria-checked', 'false');
            });
            e.target.classList.add('active');
            e.target.setAttribute('aria-checked', 'true');
            botDifficulty = e.target.dataset.level;
        });
    });

    // Color Selection
    document.querySelectorAll('.color-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const target = e.target.closest('.color-btn');
            document.querySelectorAll('.color-btn').forEach(b => {
                b.classList.remove('active');
                b.setAttribute('aria-checked', 'false');
            });
            target.classList.add('active');
            target.setAttribute('aria-checked', 'true');

            if (target.id === 'whiteColorBtn') playerColor = PLAYER_COLORS.WHITE;
            else if (target.id === 'blackColorBtn') playerColor = PLAYER_COLORS.BLACK;
            else playerColor = PLAYER_COLORS.RANDOM;
        });
    });

    // Room Management
    ui.createRoomBtn?.addEventListener('click', () => {
        if (gameMode === GAME_MODES.BOT) {
            startBotGame();
        } else {
            ui.createRoomOverlay?.classList.remove('hidden');
        }
    });

    ui.joinRoomBtn?.addEventListener('click', () => ui.joinRoomOverlay?.classList.remove('hidden'));
    ui.closeOverlayBtn?.addEventListener('click', () => ui.joinRoomOverlay?.classList.add('hidden'));
    ui.closeCreateOverlayBtn?.addEventListener('click', () => ui.createRoomOverlay?.classList.add('hidden'));

    ui.confirmCreateRoomBtn?.addEventListener('click', createRoom);
    ui.joinRoomConfirmBtn?.addEventListener('click', joinRoom);

    ui.cancelWaitingBtn?.addEventListener('click', () => {
        if (socket) {
            socket.emit('leave_room', { roomId: currentRoomId });
        }
        showScreen('menu');
        currentRoomId = null;
    });

    ui.copyRoomIdBtn?.addEventListener('click', () => {
        navigator.clipboard.writeText(currentRoomId);
        const originalText = ui.displayRoomId.textContent;
        ui.displayRoomId.textContent = "COPIED!";
        setTimeout(() => ui.displayRoomId.textContent = originalText, CONFIG.COPY_FEEDBACK_DELAY);
    });

    // Game Controls
    ui.flipBoardBtn?.addEventListener('click', flipBoardView);
    ui.resetGameBtn?.addEventListener('click', requestReset);
    ui.leaveRoomBtn?.addEventListener('click', () => {
        if (confirm('Are you sure you want to leave?')) location.reload();
    });

    // Modals
    ui.playAgainBtn?.addEventListener('click', requestReset);
    ui.backToMenuBtn?.addEventListener('click', () => location.reload());
    ui.acceptRequestBtn?.addEventListener('click', () => {
        if (gameMode === GAME_MODES.BOT) startBotGame();
        else if (socket) socket.emit('reset_confirmed', { roomId: currentRoomId });
        ui.requestModal?.classList.add('hidden');
    });
    ui.declineRequestBtn?.addEventListener('click', () => {
        if (socket) socket.emit('reset_declined', { roomId: currentRoomId });
        ui.requestModal?.classList.add('hidden');
    });

    // Intelligent Tips
    ui.tipsBtn?.addEventListener('click', () => {
        showIntelligentTip();
    });

    ui.closeTipsBtn?.addEventListener('click', () => ui.tipsModal?.classList.add('hidden'));
    ui.nextTipBtn?.addEventListener('click', () => {
        showIntelligentTip();
    });

    // Theme Toggle
    if (ui.themeCheckbox) {
        ui.themeCheckbox.addEventListener('change', (e) => {
            const theme = e.target.checked ? 'dark' : 'light';
            document.body.setAttribute('data-theme', theme);
            console.log('Theme changed to:', theme);
        });
    }

    // Board click delegation - FIXED
    if (ui.chessBoard) {
        ui.chessBoard.addEventListener('click', (e) => {
            const square = e.target.closest('.square');
            if (square && square.dataset.square) {
                handleSquareClick(square.dataset.square);
            }
        });
    }
}

function setupSocketListeners() {
    if (!socket) return;

    let reconnectAttempts = 0;

    // Enhanced connection handlers
    socket.on('connect', () => {
        reconnectAttempts = 0;
        updateConnectionStatus('connected');
        console.log('[Socket] Connected');

        // Attempt rejoin if was in a room
        const savedRoom = sessionStorage.getItem('currentRoomId');
        if (savedRoom && currentRoomId) {
            console.log(`[Socket] Reconnected - was in room ${savedRoom}`);
        }
    });

    socket.on('disconnect', (reason) => {
        console.log('[Socket] Disconnected:', reason);
        updateConnectionStatus('disconnected');
    });

    socket.on('reconnect_attempt', (attempt) => {
        reconnectAttempts = attempt;
        console.log(`[Socket] Reconnect attempt ${attempt}/5`);
        updateConnectionStatus('reconnecting', attempt);
    });

    socket.on('reconnect_failed', () => {
        console.error('[Socket] Reconnection failed');
        updateConnectionStatus('failed');
    });

    socket.on('reconnect', (attemptNumber) => {
        console.log('[Socket] Reconnected after', attemptNumber, 'attempts');
        updateConnectionStatus('reconnected');
        setTimeout(() => updateConnectionStatus('connected'), 2000);
    });

    socket.on('connect_error', (error) => {
        console.error('[Socket] Connection error:', error.message);
        updateConnectionStatus('error');
    });

    socket.on('room_created', (data) => {
        currentRoomId = data.roomId;
        playerColor = data.color;
        isSpectator = data.role === 'spectator';

        // Save for reconnection
        sessionStorage.setItem('currentRoomId', currentRoomId);

        if (ui.displayRoomId) ui.displayRoomId.textContent = currentRoomId;
        if (ui.displayPin) ui.displayPin.textContent = data.pin || 'None';
        if (ui.createRoomOverlay) ui.createRoomOverlay.classList.add('hidden');
        showScreen('waiting');
    });

    socket.on('game_start', (data) => {
        updateGameState(data.gameState);
        if (ui.joinRoomOverlay) ui.joinRoomOverlay.classList.add('hidden');
        showScreen('game');
        initBoard();
        updateBoard(data.gameState.fen, playerColor === PLAYER_COLORS.BLACK);
        updateGameInfo(data.gameState);
    });

    socket.on('joined_as_spectator', (data) => {
        updateGameState(data.gameState);
        currentRoomId = data.roomId;
        isSpectator = true;
        playerColor = PLAYER_COLORS.SPECTATOR;
        if (ui.joinRoomOverlay) ui.joinRoomOverlay.classList.add('hidden');
        showScreen('game');
        initBoard();
        updateBoard(data.gameState.fen, false);
        updateGameInfo(data.gameState);
        alert('Room is full. You are watching as a spectator.');
    });

    socket.on('your_color', (data) => {
        playerColor = data.color;
        isSpectator = false;
    });

    socket.on('game_update', (data) => {
        console.log('[Client] Game updated. Turn:', data.gameState.turn);
        updateGameState(data.gameState);
        updateBoard(data.gameState.fen, playerColor === PLAYER_COLORS.BLACK);
        updateGameInfo(data.gameState);

        // Clear selection after move
        selectedSquare = null;
        legalMoves = [];
    });

    socket.on('game_reset', (data) => {
        updateGameState(data.gameState);
        updateBoard(data.gameState.fen, playerColor === PLAYER_COLORS.BLACK);
        updateGameInfo(data.gameState);
        if (ui.gameOverModal) ui.gameOverModal.classList.add('hidden');
        if (ui.requestModal) ui.requestModal.classList.add('hidden');
    });

    socket.on('reset_request', () => {
        if (ui.requestModal) ui.requestModal.classList.remove('hidden');
        const msg = document.getElementById('requestMessage');
        if (msg) msg.textContent = `Opponent wants a rematch.`;
    });

    socket.on('reset_declined', () => alert("Opponent declined the rematch."));
    socket.on('player_disconnected', () => alert('Opponent disconnected!'));

    socket.on('legal_moves', (data) => {
        legalMoves = data.moves;
        console.log('[Client] Received legal moves for', data.square, ':', data.moves.length, 'moves');
        // In multiplayer, update board to show legal move indicators
        if (gameMode === GAME_MODES.HUMAN && chess) {
            updateBoard(chess.fen(), playerColor === PLAYER_COLORS.BLACK);
        }
    });

    socket.on('error', (data) => alert(data.message));
}

/* === INITIALIZATION === */
function init() {
    // Get DOM references
    ui = getElements();

    // Initialize Chess.js
    if (typeof Chess !== 'undefined') {
        chess = new Chess();
    } else {
        console.error('Chess.js not loaded');
        return;
    }

    // Initialize Socket.IO with reconnection configuration
    if (typeof io !== 'undefined') {
        socket = io({
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 10000,
            timeout: 20000,
            transports: ['websocket', 'polling']
        });
    } else {
        console.error('Socket.IO not loaded');
    }

    setupEventListeners();
    setupSocketListeners();

    const roomId = checkUrlParams();
    if (roomId && ui.roomIdInput) {
        ui.roomIdInput.value = roomId;
        ui.joinRoomOverlay?.classList.remove('hidden');
    }

    console.log('Chess Pro initialized successfully!');
}

// Start when DOM and scripts are ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    // DOM already loaded, wait for Chess.js and Socket.IO
    setTimeout(init, 100);
}
