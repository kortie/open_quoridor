import axiosInstance from './api';

export interface GameRecordData {
  aiLevel: string;
  winner: 'player' | 'ai';
  playerWallsUsed: number;
  aiWallsUsed: number;
  totalMoves: number;
  gameDuration: number;
}

export interface GameRecord extends GameRecordData {
  id: string;
  pointsEarned: number;
  createdAt: string;
}

export async function saveGameRecord(gameData: GameRecordData): Promise<GameRecord> {
  try {
    const pointsEarned = calculatePoints(gameData);

    const response = await axiosInstance.post('/game/save-record', {
      ...gameData,
      pointsEarned,
    });

    return response.data;
  } catch (error) {
    console.error('❌ Failed to save game record:', error);
    throw error;
  }
}

export async function getGameHistory(limit: number = 20, offset: number = 0): Promise<GameRecord[]> {
  try {
    const response = await axiosInstance.get('/game/history', {
      params: { limit, offset },
    });

    return response.data;
  } catch (error) {
    console.error('❌ Failed to fetch game history:', error);
    throw error;
  }
}

export async function getGameStats() {
  try {
    const response = await axiosInstance.get('/game/stats');
    return response.data;
  } catch (error) {
    console.error('❌ Failed to fetch game stats:', error);
    throw error;
  }
}

function calculatePoints(gameData: GameRecordData): number {
  if (gameData.winner !== 'player') return 0;

  const levelPoints: Record<string, number> = {
    Easy: 20,
    Normal: 40,
    Hard: 75,
    VeryHard: 125,
    Expert: 200,
  };

  let points = levelPoints[gameData.aiLevel] || 0;

  // Time bonus (3 minutes threshold)
  if (gameData.gameDuration < 180) {
    points += Math.floor((180 - gameData.gameDuration) / 10);
  }

  // Wall efficiency bonus
  const wallBonus = (10 - gameData.playerWallsUsed) * 2;
  points += wallBonus;

  return points;
}
