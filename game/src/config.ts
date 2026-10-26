/**
 * Offline build (Android app): the AI runs on-device and no server features
 * (login, leaderboard, game records) are used. Set by `vite build --mode android`.
 */
export const OFFLINE = import.meta.env.VITE_OFFLINE === 'true';
