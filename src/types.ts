/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum Difficulty {
  BEGINNER = "Beginner",
  INTERMEDIATE = "Intermediate",
  ADVANCED = "Advanced",
  MASTER = "Master",
}

export interface ChessEndgame {
  id: string;
  name: string;
  difficulty: Difficulty;
  fen: string;
  playerColor: "w" | "b"; // Side the user plays
  description: string;
  objective: string; // e.g. "Checkmate the black king" or "Hold a draw"
  theoreticalPlan: string; // Explanation of the winning/drawing plan
  targetMovesCount?: number; // Estimated number of moves to complete
  hint: string; // Instant hint
}

export interface EndgameCategory {
  difficulty: Difficulty;
  description: string;
  icon: string;
  endgameIds: string[];
}

export interface PlayHistoryItem {
  san: string;
  from: string;
  to: string;
  color: "w" | "b";
  fenAfter: string;
  timestamp: number;
}

export interface UserStats {
  completedEndgames: string[]; // List of endgame IDs completed
  streak: number;
  lastPlayedDate: string | null;
}

export interface CoachResponse {
  message: string;
  keyIdea?: string;
  nextSteps?: string[];
}
