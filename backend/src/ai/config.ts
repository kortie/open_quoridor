import { DifficultyLevel, EvalWeights } from './types.js';

export interface DifficultyConfig {
  maxDepth: number;
  timeLimit: number; // milliseconds
  allowRandomization: boolean;
}

/**
 * Get difficulty configuration
 */
export function getDifficultyConfig(level: DifficultyLevel): DifficultyConfig {
  switch (level) {
    case 'Easy':
      return {
        maxDepth: 1,
        timeLimit: 100,
        allowRandomization: true,
      };
    case 'Normal':
      return {
        maxDepth: 3,
        timeLimit: 500,
        allowRandomization: false,
      };
    case 'Hard':
    case 'VeryHard':
    case 'Expert':
      // Spec: depth 5+, iterative deepening until the time limit.
      return {
        maxDepth: 9,
        timeLimit: 2000,
        allowRandomization: false,
      };
    default:
      return {
        maxDepth: 3,
        timeLimit: 500,
        allowRandomization: false,
      };
  }
}

/**
 * Evaluation weights for different difficulty levels
 * Harder difficulties can tune weights more aggressively
 */
export function getEvalWeights(level: DifficultyLevel): EvalWeights {
  // All difficulties use the same default weights for now
  // Can be customized per difficulty if needed
  return {
    w1: 10.0, // distance advantage
    w2: 1.5,  // wall advantage
    w3: 0.5,  // mobility
    w4: 0.8,  // path diversity
  };
}
