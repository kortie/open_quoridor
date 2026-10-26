import { DifficultyLevel, EvalWeights } from './types.js';
import { DEFAULT_WEIGHTS, EvalFeatures } from './eval.js';

export interface DifficultyConfig {
  maxDepth: number;
  /** Hard limit per move in milliseconds; the search never runs past it. */
  timeLimit: number;
  /** Legacy switch kept for tools: false disables softmax noise and tie randomisation. */
  allowRandomization: boolean;
  /** Softmax temperature over root scores (eval units, 10 = one step). 0 = always best. */
  softmaxT: number;
  /** Pick uniformly among root moves within this margin of the best. 0 = off. */
  tieDelta: number;
  /** Attacking walls kept per node, best gain first. */
  wallCandidates: number;
  /** Defensive walls (shrink the opponent's best wall against me) per node up to strategicPly. */
  defensiveWalls: number;
  /** Set-up walls (zero gain now, deeper follow-up cut) per node up to strategicPly. */
  setupWalls: number;
  /** Deepest ply (0 = root) at which set-up and defensive walls are generated. */
  strategicPly: number;
  /** Probability that walls are considered at all for this move (root only). */
  wallUseProb: number;
  /** Extra plies of attacking-wall search at the leaves. */
  quiescencePlies: number;
  /** Recognise decided races once walls run out. */
  endgameSolver: boolean;
  /** Plies of extension allowed per line when the side to move has no walls. */
  pawnOnlyExtensions: number;
  /** Allow starting another iteration later when the best move just changed. */
  timeExtension: boolean;
  /**
   * Fraction of timeLimit after which no new iteration starts (an iteration costs
   * several times the previous one, so a late start is mostly wasted).
   */
  iterationStart: number;
  /** Minimum gain for a wall while both players still hold all ten. */
  openingWallMinGain: number;
  /** Late move reductions in the main search. */
  lmr: boolean;
  evalFeatures: EvalFeatures;
  /** Overrides on the default evaluation weights (tools and tuning). */
  evalWeights?: Partial<EvalWeights>;
}

const BASE: DifficultyConfig = {
  maxDepth: 64,
  timeLimit: 1000,
  allowRandomization: true,
  softmaxT: 0,
  tieDelta: 0,
  wallCandidates: 10,
  defensiveWalls: 0,
  setupWalls: 0,
  strategicPly: -1,
  wallUseProb: 1,
  quiescencePlies: 0,
  endgameSolver: true,
  pawnOnlyExtensions: 0,
  timeExtension: false,
  iterationStart: 0.6,
  openingWallMinGain: 2,
  lmr: false,
  evalFeatures: 'full',
};

/**
 * Difficulty configuration. All levels run the same engine; weaker levels are
 * shallower, noisier and forget walls more often.
 */
export function getDifficultyConfig(level: DifficultyLevel): DifficultyConfig {
  // Selfplay showed depth matters little beyond 3-4 plies (a depth-3 VeryHard still takes
  // ~28-37% off a 7-ply Expert); evaluation dominates. So the lower ladder is shaped
  // mostly by root noise (softmaxT) and by how often walls are considered.
  switch (level) {
    case 'Easy':
      return {
        ...BASE,
        maxDepth: 1,
        timeLimit: 150,
        softmaxT: 15,
        wallCandidates: 6,
        wallUseProb: 0.4,
        endgameSolver: false,
        evalFeatures: 'basic',
      };
    case 'Normal':
      return { ...BASE, maxDepth: 2, timeLimit: 300, softmaxT: 6, wallUseProb: 0.8, endgameSolver: false };
    case 'Hard':
      return { ...BASE, maxDepth: 2, timeLimit: 500, softmaxT: 2 };
    case 'VeryHard':
      // Measured at exactly these settings: 90% vs Baseline. Expert only edges it (~55-60%):
      // extra time and features add little once the evaluation is good.
      return {
        ...BASE,
        timeLimit: 1500,
        tieDelta: 0.5,
        wallCandidates: 20,
        quiescencePlies: 1,
        pawnOnlyExtensions: 2,
        timeExtension: true,
      };
    case 'Expert':
      return {
        ...BASE,
        timeLimit: 3000,
        tieDelta: 0.5,
        defensiveWalls: 4,
        setupWalls: 8,
        strategicPly: 0,
        quiescencePlies: 1,
        pawnOnlyExtensions: 4,
        timeExtension: true,
      };
    default:
      return getDifficultyConfig('Normal');
  }
}

/**
 * Evaluation weights for different difficulty levels
 */
export function getEvalWeights(_level: DifficultyLevel): Required<EvalWeights> {
  return { ...DEFAULT_WEIGHTS };
}
