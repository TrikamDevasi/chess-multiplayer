// dom.js - DOM element references
export const screens = {
    menu: document.getElementById('menuScreen'),
    waiting: document.getElementById('waitingScreen'),
    game: document.getElementById('gameScreen')
};

export const ui = {
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
    pinDisplayRow: document.getElementById('pinDisplayRow'),

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
    topCaptured: document.getElementById('topCaptured'),
    bottomCaptured: document.getElementById('bottomCaptured'),

    // Modals
    gameOverModal: document.getElementById('gameOverModal'),
    requestModal: document.getElementById('requestModal'),
    items: {
        gameOverTitle: document.getElementById('gameOverTitle'),
        gameOverMessage: document.getElementById('gameOverMessage'),
        playAgainBtn: document.getElementById('playAgainBtn'),
        backToMenuBtn: document.getElementById('backToMenuBtn'),
        acceptRequestBtn: document.getElementById('acceptRequestBtn'),
        declineRequestBtn: document.getElementById('declineRequestBtn'),
        tipsBtn: document.getElementById('tipsBtn'),
        tipsModal: document.getElementById('tipsModal'),
        closeTipsBtn: document.getElementById('closeTipsBtn'),
        nextTipBtn: document.getElementById('nextTipBtn')
    },

    // Connection
    connectionStatus: document.getElementById('connectionStatus'),
    connectionText: document.getElementById('statusText')
};

export function showScreen(screenName) {
    Object.values(screens).forEach(s => s.classList.remove('active'));
    screens[screenName].classList.add('active');
}

export function updateTheme() {
    // Theme is handled by CSS variables
}

export function updateConnectionStatus(status) {
    ui.connectionStatus.className = `status-toast ${status}`;
    ui.connectionText.textContent = status === 'connected' ? 'Connected' : 'Disconnected';
}
