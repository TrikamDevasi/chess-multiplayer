// board.js - Chess board rendering and interaction
import { ui } from './dom.js';

export function initBoard() {
    const boardEl = ui.chessBoard;
    boardEl.innerHTML = '';
}

export function updateBoard(fen, isFlipped, selectedSquare, legalMoves) {
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
    if (isFlipped) {
        ui.chessBoard.style.transform = 'rotate(180deg)';
    } else {
        ui.chessBoard.style.transform = 'rotate(0deg)';
    }

    rows.forEach(sq => {
        const div = document.createElement('div');
        div.className = `square ${(sq.r + sq.c) % 2 === 0 ? 'light' : 'dark'}`;
        div.dataset.square = sq.id;
        div.setAttribute('role', 'gridcell');
        div.setAttribute('aria-label', `Square ${sq.id}`);

        if (selectedSquare === sq.id) div.classList.add('selected');

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

            if (isFlipped) pieceDiv.style.transform = 'rotate(180deg)';

            div.appendChild(pieceDiv);
        }

        boardEl.appendChild(div);
    });
}

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

export function flipBoard() {
    const current = ui.chessBoard.style.transform;
    const isRotated = current === 'rotate(180deg)';
    ui.chessBoard.style.transform = isRotated ? 'rotate(0deg)' : 'rotate(180deg)';

    document.querySelectorAll('.piece').forEach(p => {
        p.style.transform = ui.chessBoard.style.transform === 'rotate(180deg)' ? 'rotate(180deg)' : 'rotate(0deg)';
    });
}
