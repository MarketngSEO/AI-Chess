/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ChessEndgame, Difficulty } from "../types";

export const ENDGAMES: ChessEndgame[] = [
  // --- BEGINNER ENDGAMES ---
  {
    id: "k_q_k",
    name: "King + Queen vs King",
    difficulty: Difficulty.BEGINNER,
    fen: "4k3/8/8/8/8/8/8/3QK3 w - - 0 1",
    playerColor: "w",
    description: "The most fundamental checkmate. Learn how to restrict the enemy king with your Queen and deliver the finishing blow.",
    objective: "Checkmate the Black King in under 15 moves without causing a stalemate.",
    theoreticalPlan: "Use the 'Knight's shadow' box method: move your Queen so that she stands a knight's jump away from the black king. Each time the black king moves, mirror its move with your Queen to shrink the box. Once the king is trapped on the edge of the board, leave the Queen there, march your own King up to support, and deliver a protected checkmate on the edge. WARNING: Always ensure the enemy king has at least one legal square to move to, otherwise it is a stalemate (draw)!",
    targetMovesCount: 12,
    hint: "Move your queen a knight's jump away from the enemy king (e.g. Qd2 or Qf3) to shrink his movement box."
  },
  {
    id: "k_r_k",
    name: "King + Rook vs King",
    difficulty: Difficulty.BEGINNER,
    fen: "4k3/8/8/8/8/8/8/3RK3 w - - 0 1",
    playerColor: "w",
    description: "A vital endgame skill. Unlike a queen, a rook cannot force the king back alone; your king must actively participate in pushing the enemy king.",
    objective: "Checkmate the Black King in under 20 moves.",
    theoreticalPlan: "Cut the enemy king off along a rank or file with your rook. Bring your own king forward. You must create 'opposition' where the two kings face each other with one square between them, and it is the enemy's turn to move. When they are in opposition, checking with the rook forces their king backwards. Repeat this until they are on the back rank, then deliver the final mate.",
    targetMovesCount: 16,
    hint: "Use your rook to cut off the black king on the 4th rank (Rd4) first, then bring your king up to assist."
  },
  {
    id: "k_p_k_simple",
    name: "King + Pawn vs King (The Opposition)",
    difficulty: Difficulty.BEGINNER,
    fen: "4k3/8/8/8/4K3/4P3/8/8 w - - 0 1",
    playerColor: "w",
    description: "Master the rule of key squares and opposition. This is the bedrock of all pawn endgames.",
    objective: "Promote your pawn into a Queen or Rook while keeping it safe.",
    theoreticalPlan: "The Golden Rule of King + Pawn endgames: Your king MUST be in front of your pawn! Advance your king to e5. By controlling key squares ahead of the pawn (e6, d6, f6) and keeping 'opposition' (forcing the enemy king to step aside), you will guide your pawn safely to promotion.",
    targetMovesCount: 10,
    hint: "Do NOT push the pawn immediately! Play Ke5 first to seize opposition in front of your pawn."
  },

  // --- INTERMEDIATE ENDGAMES ---
  {
    id: "k_rr_k",
    name: "Double Rook Lawnmower",
    difficulty: Difficulty.INTERMEDIATE,
    fen: "4k3/8/8/8/8/8/8/R3K2R w KQ - 0 1",
    playerColor: "w",
    description: "Learn how to coordinate two rooks to easily checkmate the king without even needing your own king's help.",
    objective: "Deliver checkmate using your two rooks.",
    theoreticalPlan: "Use the 'lawnmower' (or rook roller) technique. One rook stands on a rank to act as a barrier, preventing the king from stepping forward. The other rook delivers a check on the next rank, forcing the enemy king back. They take turns checking and holding, marching the king rank-by-rank to the edge of the board for checkmate. Watch out for the black king attacking your rooks; place them on opposite sides of the board!",
    targetMovesCount: 8,
    hint: "Move Rh7 to control the 7th rank, forcing the king to the 8th, then checkmate with Ra8!"
  },
  {
    id: "k_bb_k",
    name: "Two Bishops Checkmate",
    difficulty: Difficulty.INTERMEDIATE,
    fen: "4k3/8/8/8/8/8/8/2B1KB2 w - - 0 1",
    playerColor: "w",
    description: "A beautiful checkmate demonstrating diagonal control. It requires careful coordination to avoid stalemate.",
    objective: "Force the Black King into a corner and checkmate him using your two bishops.",
    theoreticalPlan: "Bishops work in pairs to create diagonal nets. Bring your king and bishops active. Squeeze the enemy king toward the corner of the board. The bishops will block exit routes on diagonals, while your king controls the squares directly in front of the enemy king. Once the enemy king is on the corner square (a8/h8/a1/h1) and adjacent squares, deliver checkmate.",
    targetMovesCount: 18,
    hint: "Use your bishops together on adjacent diagonals (like d2 and e2) to block the king's escape paths, then bring your king up."
  },
  {
    id: "lucena",
    name: "The Lucena Position (Building a Bridge)",
    difficulty: Difficulty.INTERMEDIATE,
    fen: "1K1R4/1P6/8/8/3r4/8/8/k7 w - - 0 1",
    playerColor: "w",
    description: "The single most important Rook endgame position. If you know the Lucena, you can win almost any active Rook + Pawn endgame.",
    objective: "Successfully escape the black rook's checks and promote your b-pawn.",
    theoreticalPlan: "The winning formula is 'building a bridge': 1. Check the black king to drive him away from the pawn. 2. Move your rook to the 4th rank (Rd4). 3. Walk your white king out from the shelter of the pawn (e.g., Kb7). 4. When the black rook starts checking you, step your king down. Once your king reaches the 4th rank, use your rook to block the check (e.g. Rb4), which shields the king and guarantees promotion!",
    targetMovesCount: 11,
    hint: "First check the black king with Rd1+ to push him further away, then move your rook to the 4th rank (Rd4) to prepare the bridge!"
  },
  {
    id: "philidor",
    name: "The Philidor Position (Third Rank Defense)",
    difficulty: Difficulty.INTERMEDIATE,
    fen: "8/8/r3k3/4P3/8/8/4RK2/8 b - - 0 1",
    playerColor: "b",
    description: "The gold standard of rook endgame defense. Learn how to draw a pawn-down rook endgame with ease.",
    objective: "Hold a draw against White's active King, Rook, and Pawn.",
    theoreticalPlan: "The standard drawing method: 1. Keep your rook on the 3rd rank (here, the 6th rank for black, e.g. Ra6) to cut off the white king. The white king cannot advance as long as your rook guards the rank. 2. The moment white pushes their pawn (e5-e6), your king is safe. Immediately move your rook to the back rank (e.g. Ra1). 3. Now, White's king has lost its pawn shield! Deliver continuous checks from behind (Ra1-h1, etc.) to force a draw.",
    targetMovesCount: 10,
    hint: "Keep your rook on the 6th rank (e.g. Ra6) to keep the white king out. Only drop it to the 1st rank once the e-pawn advances!"
  },

  // --- ADVANCED ENDGAMES ---
  {
    id: "k_bn_k",
    name: "Bishop + Knight Checkmate",
    difficulty: Difficulty.ADVANCED,
    fen: "4k3/8/8/8/8/8/8/2N1K1B1 w - - 0 1",
    playerColor: "w",
    description: "The ultimate test of piece coordination. You have 50 moves to force checkmate in the corner of your bishop's color.",
    objective: "Force the Black King into a light-squared corner (like a8 or h1) and deliver checkmate.",
    theoreticalPlan: "This is a complex 3-stage process: 1. Drive the black king to any edge of the board using your king, bishop, and knight. 2. If he escapes to a dark corner (which he will, since it's safe for him), use the famous 'W-maneuver' with your knight to force him into a light corner (a8 or h1). 3. Once trapped in the light corner, use your bishop to deliver the mate while the knight covers the escape squares.",
    targetMovesCount: 28,
    hint: "Bring your King and pieces active to force the black king to the edge, then steer him towards the light-squared corners."
  },
  {
    id: "q_v_r",
    name: "Queen vs Rook (Zugzwang)",
    difficulty: Difficulty.ADVANCED,
    fen: "4k3/8/8/8/8/8/3r4/3QK3 w - - 0 1",
    playerColor: "w",
    description: "A queen beats a rook, but the defender can hold out for a long time if they stay close to their king. Use zugzwang to separate them.",
    objective: "Separate the Black Rook from the King, capture it, and deliver checkmate.",
    theoreticalPlan: "Use your Queen and King to push the enemy king and rook to the edge. You must find a 'zugzwang' position where any move Black makes ruins their defense. Force the black rook to step away from the safety of its king. Once the rook is separated, find a tactical double-attack check that forks the king and rook to capture it.",
    targetMovesCount: 15,
    hint: "Check with your queen to find a fork, or play waiting moves with your King to create a zugzwang where Black is forced to move their rook away from the king."
  },
  {
    id: "opposite_bishops",
    name: "Opposite-Colored Bishops Blockade",
    difficulty: Difficulty.ADVANCED,
    fen: "8/8/4b3/3p4/8/3B4/4K3/k7 b - - 0 1",
    playerColor: "b",
    description: "Opposite-colored bishop endgames are famously drawish, even when you are a pawn down. Learn the blockading technique.",
    objective: "Secure a draw by blockading White's pawn and preventing their king from breaking in.",
    theoreticalPlan: "To draw, you must establish a blockade. Place your bishop on the diagonal controlling the d-pawn's path (e.g. keeping it active along the h1-a8 diagonal). Bring your king to support the blockade. White's bishop cannot help clear your bishop because they run on opposite colored squares! White will never be able to push the pawn to promotion.",
    targetMovesCount: 8,
    hint: "Move your king up towards d6/e7 to support the blockade, and keep your bishop controlling the d4/d3 advancement squares."
  },

  // --- MASTER ENDGAMES ---
  {
    id: "r_b_v_r",
    name: "Rook + Bishop vs Rook (The Squeeze)",
    difficulty: Difficulty.MASTER,
    fen: "5k2/8/8/8/8/r7/2R2B2/2K5 w - - 0 1",
    playerColor: "w",
    description: "One of the most complex non-pawn endgames. Even Grandmasters struggle to win or defend this in tournament play.",
    objective: "Coordinate your Rook and Bishop to create checkmate threats or win Black's rook.",
    theoreticalPlan: "Your main tool is to drive the defending King to the back rank. Use your Bishop to shield your King from checks, and use your Rook to restrict the defending Rook. Create mating threats that force the opponent into zugzwang or force their rook to block, allowing tactical skewers or pins.",
    targetMovesCount: 25,
    hint: "Start by active placement. Check the king with Bc5+ to force him back and create tactical lines for your rook."
  },
  {
    id: "q_p_v_q",
    name: "Queen + Pawn vs Queen (Perpetual Escape)",
    difficulty: Difficulty.MASTER,
    fen: "8/P7/2k5/1q6/8/8/3Q4/3K4 w - - 0 1",
    playerColor: "w",
    description: "An incredibly deep battle. The defending queen will launch endless checks; you must hide your king and advance your passed pawn.",
    objective: "Avoid the black queen's perpetual checks and promote your pawn.",
    theoreticalPlan: "To promote the pawn, your King must find a safe haven from checks, or you must force a trade of queens. Use your own Queen to shield checks, or hide your king near the opponent's king (where they can't check without checking themselves, or where you have cross-checks). Once a check is blocked, march the pawn to promotion.",
    targetMovesCount: 22,
    hint: "Use your Queen to block checks and prepare a cross-check (e.g. Qd6+ or Qb4+) that forces a queen trade, or shields your king to promote the pawn."
  }
];
