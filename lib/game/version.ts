export const BUTTON_RUSH_VERSION = 2;

// Scores and challenges from the original single-target game remain in the
// database for history, but V2 rankings only compare runs started after this
// cutoff. This avoids mixing scores earned under different difficulty rules.
export const BUTTON_RUSH_V2_STARTED_AT = new Date('2026-08-25T20:10:00.000Z');
