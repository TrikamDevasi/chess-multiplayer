// utils.js - Utility functions
import { CONFIG } from './config.js';

export function checkUrlParams() {
    const params = new URLSearchParams(window.location.search);
    const roomId = params.get('room');
    return roomId;
}

export function showRandomTip() {
    const tips = [
        "Control the Center: The center squares (d4, d5, e4, e5) are the most important.",
        "Develop Pieces: Get your Knights and Bishops out before moving the Queen.",
        "King Safety: Castle early to protect your King.",
        "Don't Blunder: Always check if your piece is safe before moving.",
        "Pawns are the Soul: Pawn structure determines the endgame.",
        "Look for Tactics: Forks, pins, and skewers win games."
    ];
    return tips[Math.floor(Math.random() * tips.length)];
}

export function sanitizeInput(input, maxLength) {
    return input.trim().substring(0, maxLength);
}
