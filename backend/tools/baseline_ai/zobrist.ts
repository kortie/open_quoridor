import { QState } from './types.js';
import { splitWalls } from './pathfind.js';

/**
 * Zobrist hashing for game state
 * Used for transposition table lookups
 */

let p1PosTable: bigint[][] = []; // [row][col]
let p2PosTable: bigint[][] = []; // [row][col]
let hWallsTable: bigint[] = []; // [bit position]
let vWallsTable: bigint[] = []; // [bit position]
let turnHash: bigint = 0n;

/**
 * Simple pseudo-random number generator using xorshift
 */
function seededRandom(seed: bigint): bigint {
  let s = seed;
  s ^= s << 13n;
  s ^= s >> 7n;
  s ^= s << 17n;
  return s;
}

/**
 * Initialize Zobrist hash tables with pseudo-random values
 */
export function initZobrist(): void {
  // Initialize with deterministic "random" values seeded by position
  p1PosTable = [];
  p2PosTable = [];
  hWallsTable = [];
  vWallsTable = [];

  let seed = 12345n;

  // P1 positions (9x9)
  for (let row = 0; row < 9; row++) {
    p1PosTable[row] = [];
    for (let col = 0; col < 9; col++) {
      seed = seededRandom(seed);
      p1PosTable[row][col] = seed;
    }
  }

  // P2 positions (9x9)
  for (let row = 0; row < 9; row++) {
    p2PosTable[row] = [];
    for (let col = 0; col < 9; col++) {
      seed = seededRandom(seed);
      p2PosTable[row][col] = seed;
    }
  }

  // H-walls (64)
  for (let i = 0; i < 64; i++) {
    seed = seededRandom(seed);
    hWallsTable[i] = seed;
  }

  // V-walls (64)
  for (let i = 0; i < 64; i++) {
    seed = seededRandom(seed);
    vWallsTable[i] = seed;
  }

  // Turn hash
  seed = seededRandom(seed);
  turnHash = seed;
}

/**
 * Calculate Zobrist hash for a game state
 */
/** XOR the table entries for every set bit of a 32-bit word, offset by `base`. */
function xorBits(hash: bigint, word: number, base: number, table: bigint[]): bigint {
  let x = word >>> 0;
  while (x !== 0) {
    const lsb = x & -x;
    hash ^= table[base + 31 - Math.clz32(lsb)];
    x = (x ^ lsb) >>> 0;
  }
  return hash;
}

export function hashState(state: QState): bigint {
  const w = splitWalls(state.h_walls, state.v_walls);
  let hash = p1PosTable[state.p1_row][state.p1_col] ^ p2PosTable[state.p2_row][state.p2_col];
  hash = xorBits(hash, w.hLo, 0, hWallsTable);
  hash = xorBits(hash, w.hHi, 32, hWallsTable);
  hash = xorBits(hash, w.vLo, 0, vWallsTable);
  hash = xorBits(hash, w.vHi, 32, vWallsTable);
  if (state.turn === 1) hash ^= turnHash;
  return hash;
}

/**
 * Update hash when pawn moves
 * This allows incremental hash updates during search for efficiency
 */
export function updateHashPawnMove(
  hash: bigint,
  fromRow: number,
  fromCol: number,
  toRow: number,
  toCol: number,
  playerNum: 0 | 1
): bigint {
  const table = playerNum === 0 ? p1PosTable : p2PosTable;

  // Remove old position
  hash ^= table[fromRow][fromCol];

  // Add new position
  hash ^= table[toRow][toCol];

  // Toggle turn
  hash ^= turnHash;

  return hash;
}

/**
 * Update hash when wall is placed
 */
export function updateHashWallPlace(
  hash: bigint,
  wallBit: number,
  isHorizontal: boolean
): bigint {
  const table = isHorizontal ? hWallsTable : vWallsTable;
  hash ^= table[wallBit];
  hash ^= turnHash; // Toggle turn
  return hash;
}
