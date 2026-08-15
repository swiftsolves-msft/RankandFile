export interface Card {
  noun: string;
  tooltip: string;
  tooltipMeme: string;
  category: string;
  isSpicy: boolean;
}

export interface Player {
  /** Durable id that survives a refresh — not the SignalR connection id. */
  playerId: string;
  name: string;
  totalScore: number;
  /** False while the player is away; they keep their score and ranking. */
  isConnected: boolean;
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
  /** How the cards read: 'normal' | 'meme'. */
  cardMode: string;
  /** What a round does: 'icebreaker' | 'conference'. */
  gameMode: string;
  rounds: Round[];
}

// ===== Conference mode =====

export interface ConsensusCard {
  noun: string;
  isSpicy: boolean;
  /** 1-based position in the room's consensus ordering. */
  position: number;
  meanRank: number;
  /** Votes per position; index 0 = position 1. */
  distribution: number[];
  /** Std dev of positions given — higher means the room was split. */
  spread: number;
}

export interface PlayerAlignment {
  playerId: string;
  name: string;
  toRoom: number;
  toHost: number;
}

export interface Outlier {
  playerId: string;
  name: string;
  toRoom: number;
  noun: string;
  theirPosition: number;
  roomPosition: number;
}

/** Computed once per round and broadcast; the host board and each player's
 *  personal report are two projections of this same payload. */
export interface RoundAggregate {
  roundNum: number;
  submittedCount: number;
  playerCount: number;
  consensus: ConsensusCard[];
  alignments: PlayerAlignment[];
  outliers: Outlier[];
  roomAverageAlignment: number;
  hostRanking: string[];
  hasHostRanking: boolean;
  hostToRoom: number;
  mostDivisiveNoun: string | null;
  isFinalRound: boolean;
}

export interface RankingProgress {
  submitted: number;
  total: number;
}

export interface GuessResult {
  targetName: string;
  score: number;
  actual: string[];
  guessed: string[];
  matchInfo: Record<string, 'exact' | 'near' | 'miss'>;
  /** Partner left before ranking — there was nothing to score against. */
  partnerDropped?: boolean;
}
