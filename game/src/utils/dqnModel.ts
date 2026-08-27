import * as tf from '@tensorflow/tfjs';
import { GameState, Position } from '../types';

export interface DQNModel {
  predict(state: number[]): number[];
  dispose(): void;
}

// State encoder: converts game state to neural network input
export function encodeGameState(state: GameState, isAI: boolean): number[] {
  const boardInput: number[] = [];

  // 1. Board state (9x9 grid - walls and positions)
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      const cell = state.board[row][col];
      let cellValue = 0;

      // Encode walls
      if (cell.walls.top) cellValue += 0.1;
      if (cell.walls.bottom) cellValue += 0.1;
      if (cell.walls.left) cellValue += 0.1;
      if (cell.walls.right) cellValue += 0.1;

      boardInput.push(cellValue);
    }
  }

  // 2. Player positions
  const playerPos = isAI ? state.aiPos : state.playerPos;
  const opponentPos = isAI ? state.playerPos : state.aiPos;
  boardInput.push(playerPos.row / 8); // Normalize to 0-1
  boardInput.push(playerPos.col / 8);
  boardInput.push(opponentPos.row / 8);
  boardInput.push(opponentPos.col / 8);

  // 3. Wall counts
  boardInput.push(state.playerWallsLeft / 10);
  boardInput.push(state.aiWallsLeft / 10);

  // 4. Distance metrics
  const playerGoal = isAI ? { row: 0, col: 4 } : { row: 8, col: 4 };
  const opponentGoal = isAI ? { row: 8, col: 4 } : { row: 0, col: 4 };

  const distToGoal = Math.abs(playerPos.row - playerGoal.row) + Math.abs(playerPos.col - playerGoal.col);
  const distOpponentToGoal =
    Math.abs(opponentPos.row - opponentGoal.row) + Math.abs(opponentPos.col - opponentGoal.col);
  const distToOpponent = Math.abs(playerPos.row - opponentPos.row) + Math.abs(playerPos.col - opponentPos.col);

  boardInput.push(distToGoal / 16); // Normalize
  boardInput.push(distOpponentToGoal / 16);
  boardInput.push(distToOpponent / 16);

  return boardInput;
}

// Create a simple DQN neural network
export function createDQNModel(stateSize: number, actionSize: number): tf.Sequential {
  const model = tf.sequential({
    layers: [
      tf.layers.dense({
        inputShape: [stateSize],
        units: 128,
        activation: 'relu',
        kernelInitializer: 'glorotUniform',
      }),
      tf.layers.dropout({ rate: 0.2 }),
      tf.layers.dense({
        units: 128,
        activation: 'relu',
        kernelInitializer: 'glorotUniform',
      }),
      tf.layers.dropout({ rate: 0.2 }),
      tf.layers.dense({
        units: actionSize,
        activation: 'linear',
        kernelInitializer: 'glorotUniform',
      }),
    ],
  });

  return model;
}

// DQN Agent for playing Quoridor
export class DQNAgent {
  private model: tf.Sequential;
  private epsilon: number = 0.1; // 10% random exploration

  constructor(stateSize: number, actionSize: number) {
    this.model = createDQNModel(stateSize, actionSize);
  }

  // Predict Q-values for a state
  predictQValues(state: number[]): tf.Tensor {
    return tf.tidy(() => {
      const input = tf.tensor2d([state]);
      return this.model.predict(input) as tf.Tensor;
    });
  }

  // Choose action using epsilon-greedy strategy
  chooseAction(qValues: tf.Tensor, legalActions: number[]): number {
    return tf.tidy(() => {
      const qArray = qValues.dataSync();

      // Epsilon-greedy: random action with epsilon probability
      if (Math.random() < this.epsilon) {
        return legalActions[Math.floor(Math.random() * legalActions.length)];
      }

      // Greedy: pick action with highest Q-value among legal actions
      let bestAction = legalActions[0];
      let bestQValue = qArray[bestAction];

      for (const action of legalActions) {
        if (qArray[action] > bestQValue) {
          bestQValue = qArray[action];
          bestAction = action;
        }
      }

      return bestAction;
    });
  }

  // Convert action index to move
  indexToMove(actionIndex: number, validMoves: Position[], validWalls: any[]): Position | any | null {
    // First part of action space: piece moves
    if (actionIndex < validMoves.length) {
      return validMoves[actionIndex];
    }

    // Second part: wall placements
    const wallIndex = actionIndex - validMoves.length;
    if (wallIndex < validWalls.length) {
      return validWalls[wallIndex];
    }

    return null;
  }

  // Clean up resources
  dispose(): void {
    this.model.dispose();
  }
}
