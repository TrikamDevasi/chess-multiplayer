/**
 * Utility functions for the chess multiplayer game
 * @module utils
 */

// utils.js - Utility functions
import { CONFIG } from './config.js';

/**
 * Checks URL parameters for room ID
 * @returns {string|null} Room ID from URL or null
 */
export function checkUrlParams() {
    const params = new URLSearchParams(window.location.search);
    const roomId = params.get('room');
    return roomId;
}

/**
 * Returns a random chess tip for players
 * @returns {string} Random chess tip
 */
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

/**
 * Sanitizes user input by trimming and limiting length
 * Removes potentially dangerous characters to prevent XSS
 * @param {string} input - Raw user input
 * @param {number} maxLength - Maximum allowed length
 * @returns {string} Sanitized input
 */
export function sanitizeInput(input, maxLength) {
    if (!input || typeof input !== 'string') return '';
    // Remove potentially dangerous characters
    return input.trim()
        .substring(0, maxLength)
        .replace(/[<>"'&]/g, ''); // Basic XSS protection
}
