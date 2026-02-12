// config.js - Configuration constants
export const CONFIG = {
    MAX_NAME_LENGTH: 15,
    MAX_PIN_LENGTH: 4,
    MAX_ROOM_ID_LENGTH: 6,
    BOT_MOVE_DELAY: 500,
    COPY_FEEDBACK_DELAY: 1000
};

export const GAME_MODES = {
    HUMAN: 'human',
    BOT: 'bot'
};

export const PLAYER_COLORS = {
    WHITE: 'white',
    BLACK: 'black',
    RANDOM: 'random',
    SPECTATOR: 'spectator'
};

export const CONNECTION_STATUS = {
    CONNECTED: 'connected',
    DISCONNECTED: 'disconnected',
    CONNECTING: 'connecting'
};
