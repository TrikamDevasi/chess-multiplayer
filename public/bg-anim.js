// bg-anim.js - Generates the decorative background board
document.addEventListener('DOMContentLoaded', () => {
    const board = document.getElementById('decoBoard');
    if (!board) return;

    // Create container for relative positioning
    const boardInner = document.createElement('div');
    boardInner.className = 'deco-board';
    board.appendChild(boardInner);

    // Add the animated knight
    const knight = document.createElement('div');
    knight.className = 'deco-piece';
    // Using the same knight image as requested
    knight.innerHTML = '<img src="https://assets.codepen.io/3186981/knight.png" alt="knight" />';
    boardInner.appendChild(knight);

    // Logic to generate 64 squares with correct classes
    // Files: a-h (0-7), Ranks: 1-8 (0-7 but reversed in CSS top calculation)
    // CSS classes: file-a, file-b... rank-1, rank-2...
    // Color pattern: (file + rank) % 2 !== 0 is light?
    // Standard chess: a1 is black (file 0, rank 0). sum=0 -> black.
    // Wait, a1 is DARK? "a1 ... dark-square". YES.

    const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

    for (let r = 0; r < 8; r++) { // rank 1 to 8 (index 0 to 7)
        for (let f = 0; f < 8; f++) { // file a to h (index 0 to 7)
            const square = document.createElement('div');

            // Determine color
            // a1 (0,0) -> sum 0. If sum even -> dark. If sum odd -> light.
            // Let's check: a1 (dark), b1 (light). b1 is (1,0) -> sum 1.
            const isDark = (r + f) % 2 === 0;

            square.className = `deco-square ${isDark ? 'dark' : 'light'} deco-rank-${r + 1} deco-file-${files[f]}`;

            boardInner.appendChild(square);
        }
    }
});
