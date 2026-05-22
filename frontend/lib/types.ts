export interface Card {
  noun: string;
  tooltip: string;
  isSpicy: boolean;
}

export interface Player {
  playerId: string;
  name: string;
  totalScore: number;
}

export interface Round {
  roundNum: number;
  cards: Card[];
  rankings: Record<string, string[]>;
  pairings: Record<string, string>;
  triple: string[] | null;
  scoresThisRound: Record<string, number>;
}

export interface Session {
  id: string;
  sessionCode: string;
  hostPlayerId: string;
  status: 'Lobby' | 'Playing' | 'Finished';
  players: Player[];
  currentRound: number;
  maxRounds: number;
  rounds: Round[];
}

export interface GuessResult {
  targetName: string;
  score: number;
  actual: string[];
  guessed: string[];
  matchInfo: Record<string, 'exact' | 'near' | 'miss'>;
}
