/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Chess, Square } from "chess.js";
import { motion, AnimatePresence } from "motion/react";
import {
  Trophy,
  Sparkles,
  RotateCcw,
  FlipHorizontal,
  BookOpen,
  Award,
  ArrowRight,
  Flame,
  ChevronRight,
  ChevronDown,
  Info,
  CheckCircle2,
  XCircle,
  HelpCircle,
  AlertCircle,
  Activity,
  User,
  Computer,
  Sparkle,
  Compass,
  History,
  Sliders,
  Wrench,
} from "lucide-react";

import { ENDGAMES } from "./data/endgames";
import { ChessEndgame, Difficulty, PlayHistoryItem, UserStats, CoachResponse } from "./types";
import Chessboard from "./components/Chessboard";

// Local storage key names
const STATS_STORAGE_KEY = "chess_endgame_trainer_stats";

export default function App() {
  // --- STATE DECLARATIONS ---

  // Endgame list states
  const [selectedEndgame, setSelectedEndgame] = useState<ChessEndgame>(ENDGAMES[0]);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    [Difficulty.BEGINNER]: true,
    [Difficulty.INTERMEDIATE]: false,
    [Difficulty.ADVANCED]: false,
    [Difficulty.MASTER]: false,
  });

  // Sidebar mode and custom position form states
  const [sidebarMode, setSidebarMode] = useState<"scenarios" | "custom">("scenarios");
  const [customFen, setCustomFen] = useState<string>("4k3/8/8/8/4K3/4P3/8/8 w - - 0 1");
  const [customTurn, setCustomTurn] = useState<"w" | "b">("w");
  const [customPlayAs, setCustomPlayAs] = useState<"w" | "b">("w");
  const [customDifficulty, setCustomDifficulty] = useState<Difficulty>(Difficulty.INTERMEDIATE);
  const [fenError, setFenError] = useState<string | null>(null);

  // Active chess game states
  const [game, setGame] = useState<Chess>(() => new Chess(ENDGAMES[0].fen));
  const [boardFen, setBoardFen] = useState<string>(ENDGAMES[0].fen);
  const [history, setHistory] = useState<PlayHistoryItem[]>([]);
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  const [kingInCheckSquare, setKingInCheckSquare] = useState<string | null>(null);
  const [isFlipped, setIsFlipped] = useState<boolean>(false);

  // Status and evaluation states
  const [gameStatus, setGameStatus] = useState<
    "playing" | "checkmate_win" | "checkmate_lose" | "draw_stalemate" | "draw_repetition" | "draw_50moves" | "draw_insufficient" | "failed_moves"
  >("playing");
  const [isThinking, setIsThinking] = useState<boolean>(false);
  const [evaluation, setEvaluation] = useState<number>(0); // centipawns relative to White
  const [forcedMate, setForcedMate] = useState<number | null>(null); // mate in X moves

  // Coach states
  const [coachText, setCoachText] = useState<string | null>(null);
  const [coachIdea, setCoachIdea] = useState<string | null>(null);
  const [coachSteps, setCoachSteps] = useState<string[]>([]);
  const [coachLoading, setCoachLoading] = useState<boolean>(false);

  // User Statistics (loaded from LocalStorage)
  const [userStats, setUserStats] = useState<UserStats>({
    completedEndgames: [],
    streak: 0,
    lastPlayedDate: null,
  });

  // Navigation tab for side panel details
  const [activeTab, setActiveTab] = useState<"trainer" | "theory">("trainer");

  // --- LOCAL STORAGE UTILITIES ---

  useEffect(() => {
    const saved = localStorage.getItem(STATS_STORAGE_KEY);
    if (saved) {
      try {
        setUserStats(JSON.parse(saved));
      } catch (e) {
        console.error("Error loading stats", e);
      }
    }
  }, []);

  const saveStats = (updated: UserStats) => {
    setUserStats(updated);
    localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify(updated));
  };

  const markEndgameCompleted = useCallback(
    (endgameId: string) => {
      const today = new Date().toDateString();
      const alreadyCompleted = userStats.completedEndgames.includes(endgameId);
      let updatedCompleted = [...userStats.completedEndgames];

      if (!alreadyCompleted) {
        updatedCompleted.push(endgameId);
      }

      let updatedStreak = userStats.streak;
      if (userStats.lastPlayedDate !== today) {
        if (
          userStats.lastPlayedDate === null ||
          new Date(userStats.lastPlayedDate).getTime() >= new Date().getTime() - 86400000 * 2
        ) {
          updatedStreak += 1;
        } else {
          updatedStreak = 1; // reset streak if missed more than 1 day
        }
      }

      saveStats({
        completedEndgames: updatedCompleted,
        streak: updatedStreak,
        lastPlayedDate: today,
      });
    },
    [userStats]
  );

  // --- GAME LIFE-CYCLE ---

  // Load a new endgame exercise
  const loadEndgame = (endgame: ChessEndgame) => {
    setSelectedEndgame(endgame);
    const newGame = new Chess(endgame.fen);
    setGame(newGame);
    setBoardFen(endgame.fen);
    setHistory([]);
    setLastMove(null);
    setKingInCheckSquare(null);
    setGameStatus("playing");
    setEvaluation(endgame.playerColor === "w" ? 1.5 : -1.5); // base score
    setForcedMate(null);
    setIsThinking(false);

    // Auto-flip board to match player color
    setIsFlipped(endgame.playerColor === "b");

    // Clear coach messages
    setCoachText(null);
    setCoachIdea(null);
    setCoachSteps([]);
  };

  // Helper to get King square in check
  const updateKingInCheck = (chessInstance: Chess) => {
    if (chessInstance.inCheck()) {
      const turn = chessInstance.turn();
      // find the active side's King square
      for (let r = 1; r <= 8; r++) {
        for (let f = 0; f < 8; f++) {
          const fileLetter = String.fromCharCode(97 + f);
          const sq = `${fileLetter}${r}` as Square;
          const piece = chessInstance.get(sq);
          if (piece && piece.type === "k" && piece.color === turn) {
            setKingInCheckSquare(sq);
            return;
          }
        }
      }
    } else {
      setKingInCheckSquare(null);
    }
  };

  // Check game over state and handle objectives
  const checkGameOver = useCallback(
    (chessInstance: Chess) => {
      const playerColor = selectedEndgame.playerColor;
      const isWinObjective =
        selectedEndgame.objective.toLowerCase().includes("checkmate") ||
        selectedEndgame.objective.toLowerCase().includes("promote") ||
        selectedEndgame.objective.toLowerCase().includes("win");

      updateKingInCheck(chessInstance);

      if (chessInstance.isCheckmate()) {
        const losingTurn = chessInstance.turn();
        if (losingTurn !== playerColor) {
          // Computer is checkmated -> Player Wins!
          setGameStatus("checkmate_win");
          markEndgameCompleted(selectedEndgame.id);
          setCoachText("Incredible! You have successfully delivered checkmate. Absolute mastery!");
        } else {
          // Player is checkmated -> Computer Wins
          setGameStatus("checkmate_lose");
          setCoachText("Checkmate! Do not worry, endgames are highly theoretical. Press 'Restart' and try again.");
        }
        return true;
      }

      if (chessInstance.isDraw()) {
        if (!isWinObjective) {
          // The goal was to draw (e.g. Philidor) -> Player Wins!
          setGameStatus("checkmate_win");
          markEndgameCompleted(selectedEndgame.id);
          setCoachText("Superb defense! You successfully held the draw, completing the exercise objective.");
        } else {
          // The goal was to win, but player drew -> Fail
          if (chessInstance.isStalemate()) {
            setGameStatus("draw_stalemate");
            setCoachText("Stalemate! The enemy king has no legal moves. In a winning endgame, this is a drawn result. Be careful next time!");
          } else if (chessInstance.isThreefoldRepetition()) {
            setGameStatus("draw_repetition");
            setCoachText("Draw by threefold repetition. You must actively press for the win rather than repeating moves!");
          } else if (chessInstance.isInsufficientMaterial()) {
            setGameStatus("draw_insufficient");
            setCoachText("Draw by insufficient material. You lack the pieces necessary to deliver checkmate.");
          } else {
            setGameStatus("draw_50moves");
            setCoachText("Draw by 50-move rule. You ran out of moves to win!");
          }
        }
        return true;
      }

      return false;
    },
    [selectedEndgame, markEndgameCompleted]
  );

  // --- COMPUTER ENGINE LOGIC (STOCKFISH API) ---

  const getEngineDepth = (difficulty: Difficulty) => {
    switch (difficulty) {
      case Difficulty.BEGINNER:
        return 5;
      case Difficulty.INTERMEDIATE:
        return 8;
      case Difficulty.ADVANCED:
        return 12;
      case Difficulty.MASTER:
        return 15;
      default:
        return 10;
    }
  };

  const fetchStockfishEvaluation = async (fen: string) => {
    try {
      const url = `https://stockfish.online/api/s/v2.php?fen=${encodeURIComponent(fen)}&depth=10`;
      const response = await fetch(url);
      const data = await response.json();
      if (data.success) {
        if (data.evaluation !== undefined && data.evaluation !== null) {
          setEvaluation(data.evaluation);
        }
        if (data.mate !== undefined) {
          setForcedMate(data.mate);
        } else {
          setForcedMate(null);
        }
      }
    } catch (err) {
      console.warn("Could not retrieve evaluation in background", err);
    }
  };

  const makeComputerMove = useCallback(
    async (chessInstance: Chess) => {
      setIsThinking(true);
      const fen = chessInstance.fen();
      const depth = getEngineDepth(selectedEndgame.difficulty);

      try {
        const url = `https://stockfish.online/api/s/v2.php?fen=${encodeURIComponent(fen)}&depth=${depth}`;
        const response = await fetch(url);
        const data = await response.json();

        if (data.success && data.bestmove) {
          // Parse UCI output format, e.g., "bestmove e2e4 ponder e7e5" -> "e2e4"
          const match = data.bestmove.match(/^bestmove\s+([a-h][1-8][a-h][1-8][qrbn]?)/i);
          if (match) {
            const uciMove = match[1];
            const from = uciMove.substring(0, 2);
            const to = uciMove.substring(2, 4);
            const promo = uciMove.length === 5 ? uciMove.substring(4, 5) : undefined;

            const nextGame = new Chess(chessInstance.fen());
            const executedMove = nextGame.move({ from, to, promotion: promo });

            if (executedMove) {
              setGame(nextGame);
              setBoardFen(nextGame.fen());
              setLastMove({ from, to });

              // Record history
              const historyItem: PlayHistoryItem = {
                san: executedMove.san,
                from,
                to,
                color: executedMove.color,
                fenAfter: nextGame.fen(),
                timestamp: Date.now(),
              };
              setHistory((prev) => [...prev, historyItem]);

              // Update evaluation
              if (data.evaluation !== undefined && data.evaluation !== null) {
                setEvaluation(data.evaluation);
              }
              if (data.mate !== undefined) {
                setForcedMate(data.mate);
              } else {
                setForcedMate(null);
              }

              checkGameOver(nextGame);
            }
          } else {
            throw new Error("Could not parse UCI bestmove");
          }
        } else {
          throw new Error("Stockfish API error or unsuccessful response");
        }
      } catch (error) {
        console.error("Stockfish API call failed, invoking client fallback", error);

        // FALLBACK: Choose a random legal move so the board never locks
        const nextGame = new Chess(chessInstance.fen());
        const moves = nextGame.moves({ verbose: true });
        if (moves.length > 0) {
          // Try to prioritize checks or captures to feel 'semi-intelligent'
          const prioritized = moves.filter((m) => m.san.includes("+") || m.san.includes("x"));
          const chosen = prioritized.length > 0 
            ? prioritized[Math.floor(Math.random() * prioritized.length)]
            : moves[Math.floor(Math.random() * moves.length)];

          const executed = nextGame.move({ from: chosen.from, to: chosen.to, promotion: "q" });
          if (executed) {
            setGame(nextGame);
            setBoardFen(nextGame.fen());
            setLastMove({ from: chosen.from, to: chosen.to });
            setHistory((prev) => [
              ...prev,
              {
                san: executed.san,
                from: chosen.from,
                to: chosen.to,
                color: executed.color,
                fenAfter: nextGame.fen(),
                timestamp: Date.now(),
              },
            ]);
            checkGameOver(nextGame);
          }
        }
      } finally {
        setIsThinking(false);
      }
    },
    [selectedEndgame.difficulty, checkGameOver]
  );

  // Trigger computer move if it is their turn on load or custom setup
  useEffect(() => {
    if (gameStatus === "playing" && !isThinking) {
      const activeTurn = game.turn();
      if (activeTurn !== selectedEndgame.playerColor) {
        const timer = setTimeout(() => {
          makeComputerMove(game);
        }, 500);
        return () => clearTimeout(timer);
      }
    }
  }, [boardFen, selectedEndgame.id, gameStatus, selectedEndgame.playerColor, isThinking, game, makeComputerMove]);

  // --- PLAYER ACTIONS ---

  const handlePlayerMove = (from: string, to: string, promotion?: string) => {
    if (gameStatus !== "playing" || isThinking) return;

    const nextGame = new Chess(game.fen());
    try {
      const executedMove = nextGame.move({ from, to, promotion: promotion || "q" });

      if (executedMove) {
        setGame(nextGame);
        setBoardFen(nextGame.fen());
        setLastMove({ from, to });

        // Add to history
        const historyItem: PlayHistoryItem = {
          san: executedMove.san,
          from,
          to,
          color: executedMove.color,
          fenAfter: nextGame.fen(),
          timestamp: Date.now(),
        };
        const updatedHistory = [...history, historyItem];
        setHistory(updatedHistory);

        // Check for immediate game over
        const isOver = checkGameOver(nextGame);

        if (!isOver) {
          // Fetch evaluation for player's move in the background
          fetchStockfishEvaluation(nextGame.fen());

          // Trigger computer response
          setTimeout(() => {
            makeComputerMove(nextGame);
          }, 400);
        }
      }
    } catch (err) {
      console.warn("Illegal move attempted", err);
    }
  };

  // --- AI MASTER COACH ENDPOINT (GEMINI API) ---

  const askCoachGarry = async (action: "hint" | "explain" | "analyze") => {
    setCoachLoading(true);
    setCoachText(null);
    setCoachIdea(null);
    setCoachSteps([]);

    try {
      const response = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fen: boardFen,
          history: history.map((h) => h.san),
          endgameName: selectedEndgame.name,
          difficulty: selectedEndgame.difficulty,
          playerColor: selectedEndgame.playerColor,
          action,
        }),
      });

      const data = await response.json();

      if (action === "hint") {
        setCoachText(data.message || "Look for active king placement or putting your rook behind passed pawns!");
      } else {
        setCoachText(data.message);
        setCoachIdea(data.keyIdea);
        setCoachSteps(data.nextSteps || []);
      }
    } catch (err) {
      console.error("Error communicating with AI coach", err);
      setCoachText("Garry is analyzing a deep variation right now. Please try asking again in a moment!");
    } finally {
      setCoachLoading(false);
    }
  };

  // --- CALCULATIONS FOR EVAL BAR ---

  // Scale evaluation into a percentage (capped between +5.0 and -5.0 pawns)
  const evalPercentage = useMemo(() => {
    if (forcedMate !== null) {
      // White has a mate in X -> high bar
      if (forcedMate > 0) return 96;
      // Black has a mate in X -> low bar
      return 4;
    }

    // Cap evaluation range
    const cappedEval = Math.max(-5, Math.min(5, evaluation));
    // Center is 50%, +5.0 is 95%, -5.0 is 5%
    return 50 + cappedEval * 9;
  }, [evaluation, forcedMate]);

  // Toggle category list expansion
  const toggleCategory = (difficulty: Difficulty) => {
    setExpandedCategories((prev) => ({
      ...prev,
      [difficulty]: !prev[difficulty],
    }));
  };

  // --- RENDER ---

  const categoryIcons: Record<string, string> = {
    [Difficulty.BEGINNER]: "Compass",
    [Difficulty.INTERMEDIATE]: "Award",
    [Difficulty.ADVANCED]: "Sparkles",
    [Difficulty.MASTER]: "Trophy",
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-sans select-none antialiased">
      {/* Top Navigation Header */}
      <header className="border-b border-neutral-900 bg-neutral-950/80 backdrop-blur sticky top-0 z-40 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-600 p-2 rounded-xl text-neutral-100 shadow-lg shadow-emerald-600/20">
            <Trophy className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-emerald-400 to-teal-200 bg-clip-text text-transparent">
              Chess Endgame Trainer
            </h1>
            <p className="text-xs text-neutral-400 font-mono hidden sm:block">Practice Beginners to Masters against Stockfish</p>
          </div>
        </div>

        {/* User stats widget */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 bg-neutral-900 border border-neutral-800 rounded-full px-3 py-1.5 text-xs font-semibold">
            <Flame className="w-4 h-4 text-orange-500 fill-orange-500" />
            <span>Streak:</span>
            <span className="text-orange-400 font-bold">{userStats.streak}d</span>
          </div>
          <div className="flex items-center gap-1.5 bg-emerald-950/40 border border-emerald-900/60 rounded-full px-3 py-1.5 text-xs font-semibold text-emerald-400">
            <CheckCircle2 className="w-4 h-4" />
            <span>Solved:</span>
            <span className="font-bold">
              {userStats.completedEndgames.length} / {ENDGAMES.length}
            </span>
          </div>
        </div>
      </header>

      {/* Main Body */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Sidebar Left: Endgames and Difficulty Selector */}
        <aside className="w-full lg:w-80 border-r border-neutral-900 bg-neutral-950 flex flex-col shrink-0 overflow-y-auto lg:h-[calc(100vh-73px)] p-4 space-y-4">
          {/* Dual Tab Mode Switcher */}
          <div className="flex bg-neutral-900/60 p-1 rounded-xl border border-neutral-800/60 shrink-0">
            <button
              id="tab-scenarios"
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                sidebarMode === "scenarios"
                  ? "bg-emerald-600 text-neutral-50 font-bold shadow-md"
                  : "text-neutral-400 hover:text-neutral-200"
              }`}
              onClick={() => setSidebarMode("scenarios")}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Scenarios</span>
            </button>
            <button
              id="tab-custom"
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                sidebarMode === "custom"
                  ? "bg-emerald-600 text-neutral-50 font-bold shadow-md"
                  : "text-neutral-400 hover:text-neutral-200"
              }`}
              onClick={() => setSidebarMode("custom")}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Custom Setup</span>
            </button>
          </div>

          {sidebarMode === "scenarios" ? (
            <>
              <div className="px-1">
                <h3 className="text-sm font-semibold text-neutral-400 uppercase tracking-wider font-mono">Select Practice Scenario</h3>
                <p className="text-xs text-neutral-500">Pick an endgame to practice and master</p>
              </div>

              <div className="space-y-2.5">
                {Object.values(Difficulty).map((diff) => {
                  const categoryEndgames = ENDGAMES.filter((eg) => eg.difficulty === diff);
                  const isExpanded = expandedCategories[diff];
                  const completedInCategory = categoryEndgames.filter((eg) =>
                    userStats.completedEndgames.includes(eg.id)
                  ).length;

                  return (
                    <div
                      key={diff}
                      className="border border-neutral-900 rounded-xl overflow-hidden bg-neutral-900/20"
                    >
                      <button
                        id={`category-btn-${diff}`}
                        className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-neutral-900/40 transition-colors"
                        onClick={() => toggleCategory(diff)}
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="text-emerald-500">
                            {diff === Difficulty.BEGINNER && <Compass className="w-4.5 h-4.5" />}
                            {diff === Difficulty.INTERMEDIATE && <Award className="w-4.5 h-4.5" />}
                            {diff === Difficulty.ADVANCED && <Sparkles className="w-4.5 h-4.5" />}
                            {diff === Difficulty.MASTER && <Trophy className="w-4.5 h-4.5" />}
                          </span>
                          <span className="font-bold text-sm tracking-tight">{diff}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono bg-neutral-900 border border-neutral-800 rounded px-1.5 py-0.5 text-neutral-400">
                            {completedInCategory}/{categoryEndgames.length}
                          </span>
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-neutral-500" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-neutral-500" />
                          )}
                        </div>
                      </button>

                      <AnimatePresence initial={false}>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden bg-neutral-950/40 border-t border-neutral-900/60"
                          >
                            <div className="p-1.5 space-y-1">
                              {categoryEndgames.map((eg) => {
                                const isCurrent = selectedEndgame.id === eg.id;
                                const isCompleted = userStats.completedEndgames.includes(eg.id);

                                return (
                                  <button
                                    key={eg.id}
                                    id={`endgame-item-${eg.id}`}
                                    className={`w-full text-left p-2.5 rounded-lg text-xs transition-all flex items-start gap-2.5 relative group ${
                                      isCurrent
                                        ? "bg-emerald-950/40 border border-emerald-800/80 text-emerald-300"
                                        : "hover:bg-neutral-900 border border-transparent text-neutral-300"
                                    }`}
                                    onClick={() => loadEndgame(eg)}
                                  >
                                    {isCompleted ? (
                                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                                    ) : (
                                      <div className="w-4 h-4 rounded-full border border-neutral-700 shrink-0 mt-0.5 group-hover:border-emerald-500 transition-colors" />
                                    )}
                                    <div className="flex-1 min-w-0">
                                      <div className="font-semibold truncate text-sm">{eg.name}</div>
                                      <div className="text-[10px] text-neutral-400 line-clamp-1 mt-0.5">
                                        {eg.objective}
                                      </div>
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            /* Custom Position Setup View */
            <div className="flex-1 flex flex-col space-y-4">
              <div className="px-1">
                <h3 className="text-sm font-semibold text-neutral-400 uppercase tracking-wider font-mono">Setup Custom Board</h3>
                <p className="text-xs text-neutral-500">Practice custom layouts or enter FEN string</p>
              </div>

              {/* Presets Grid */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider font-mono block px-1">Quick Presets</span>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { name: "👑 King + Pawn", fen: "4k3/8/8/8/4K3/4P3/8/8 w - - 0 1", turn: "w" as const, playAs: "w" as const },
                    { name: "🗼 Lucena", fen: "1K1R4/1P6/8/8/3r4/8/8/k7 w - - 0 1", turn: "w" as const, playAs: "w" as const },
                    { name: "🛡️ Philidor", fen: "8/8/r3k3/4P3/8/8/4RK2/8 b - - 0 1", turn: "b" as const, playAs: "b" as const },
                    { name: "⚔️ Queen vs Rook", fen: "4k3/8/8/8/8/8/8/q3K1R1 w - - 0 1", turn: "b" as const, playAs: "b" as const },
                    { name: "🏰 Standard Board", fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", turn: "w" as const, playAs: "w" as const },
                    { name: "🎯 King vs King", fen: "4k3/8/8/8/4K3/8/8/8 w - - 0 1", turn: "w" as const, playAs: "w" as const },
                  ].map((preset, idx) => (
                    <button
                      key={idx}
                      id={`preset-btn-${idx}`}
                      type="button"
                      className="text-left p-2 rounded-lg bg-neutral-900 border border-neutral-800 hover:border-emerald-800 hover:bg-neutral-900/80 transition-all text-xs"
                      onClick={() => {
                        setCustomFen(preset.fen);
                        setCustomTurn(preset.turn);
                        setCustomPlayAs(preset.playAs);
                        setFenError(null);
                      }}
                    >
                      <div className="font-semibold text-neutral-200">{preset.name}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* FEN input box */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider font-mono block px-1">
                  FEN Position String
                </label>
                <textarea
                  id="fen-textarea"
                  value={customFen}
                  onChange={(e) => {
                    const val = e.target.value;
                    setCustomFen(val);
                    try {
                      new Chess(val);
                      setFenError(null);
                      // Auto-sync turn if FEN is complete
                      const parts = val.trim().split(/\s+/);
                      if (parts.length > 1) {
                        const t = parts[1];
                        if (t === "w" || t === "b") {
                          setCustomTurn(t as "w" | "b");
                        }
                      }
                    } catch (err) {
                      setFenError("Invalid chess position layout.");
                    }
                  }}
                  rows={3}
                  className={`w-full text-xs font-mono bg-neutral-900 border ${
                    fenError ? "border-red-900 focus:border-red-500 focus:ring-1 focus:ring-red-500" : "border-neutral-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  } rounded-lg p-2.5 text-neutral-200 placeholder-neutral-600 focus:outline-none resize-none`}
                  placeholder="Paste FEN string here..."
                />
                {fenError ? (
                  <p className="text-[10px] text-red-400 px-1 font-mono">{fenError}</p>
                ) : (
                  <p className="text-[10px] text-neutral-500 px-1 font-mono">Position format is validated</p>
                )}
              </div>

              {/* Whose turn to move */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider font-mono block px-1">
                  Active Turn (Next Move)
                </span>
                <div className="flex bg-neutral-900 p-1 rounded-lg border border-neutral-800">
                  <button
                    id="turn-white-btn"
                    type="button"
                    className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${
                      customTurn === "w"
                        ? "bg-neutral-100 text-neutral-900 shadow"
                        : "text-neutral-400 hover:text-neutral-200"
                    }`}
                    onClick={() => {
                      setCustomTurn("w");
                      const parts = customFen.trim().split(/\s+/);
                      if (parts.length > 1) {
                        parts[1] = "w";
                        setCustomFen(parts.join(" "));
                      }
                    }}
                  >
                    White to Move
                  </button>
                  <button
                    id="turn-black-btn"
                    type="button"
                    className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${
                      customTurn === "b"
                        ? "bg-neutral-100 text-neutral-900 shadow"
                        : "text-neutral-400 hover:text-neutral-200"
                    }`}
                    onClick={() => {
                      setCustomTurn("b");
                      const parts = customFen.trim().split(/\s+/);
                      if (parts.length > 1) {
                        parts[1] = "b";
                        setCustomFen(parts.join(" "));
                      }
                    }}
                  >
                    Black to Move
                  </button>
                </div>
              </div>

              {/* Side the user plays */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider font-mono block px-1">
                  You Play As
                </span>
                <div className="flex bg-neutral-900 p-1 rounded-lg border border-neutral-800">
                  <button
                    id="play-as-white-btn"
                    type="button"
                    className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${
                      customPlayAs === "w"
                        ? "bg-emerald-600 text-neutral-50 shadow-md"
                        : "text-neutral-400 hover:text-neutral-200"
                    }`}
                    onClick={() => setCustomPlayAs("w")}
                  >
                    White
                  </button>
                  <button
                    id="play-as-black-btn"
                    type="button"
                    className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${
                      customPlayAs === "b"
                        ? "bg-emerald-600 text-neutral-50 shadow-md"
                        : "text-neutral-400 hover:text-neutral-200"
                    }`}
                    onClick={() => setCustomPlayAs("b")}
                  >
                    Black
                  </button>
                </div>
              </div>

              {/* Computer engine strength */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider font-mono block px-1">
                  Computer Strength
                </span>
                <select
                  id="custom-difficulty-select"
                  value={customDifficulty}
                  onChange={(e) => setCustomDifficulty(e.target.value as Difficulty)}
                  className="w-full text-xs bg-neutral-900 border border-neutral-800 rounded-lg p-2.5 text-neutral-200 focus:outline-none focus:border-emerald-500"
                >
                  <option value={Difficulty.BEGINNER}>Beginner (Stockfish Depth 5)</option>
                  <option value={Difficulty.INTERMEDIATE}>Intermediate (Stockfish Depth 8)</option>
                  <option value={Difficulty.ADVANCED}>Advanced (Stockfish Depth 12)</option>
                  <option value={Difficulty.MASTER}>Master (Stockfish Depth 15)</option>
                </select>
              </div>

              {/* Launch custom button */}
              <button
                id="start-custom-practice-btn"
                type="button"
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 mt-auto"
                onClick={() => {
                  try {
                    const testGame = new Chess(customFen);
                    // Ensure turn match
                    const parts = customFen.trim().split(/\s+/);
                    if (parts.length > 1) {
                      parts[1] = customTurn;
                    }
                    const finalFen = parts.join(" ");

                    const dynamicEndgame: ChessEndgame = {
                      id: `custom_${Date.now()}`,
                      name: "Custom Practice Position",
                      difficulty: customDifficulty,
                      fen: finalFen,
                      playerColor: customPlayAs,
                      description: "A custom chess position configured for tactical training.",
                      objective: `Play this position as ${customPlayAs === "w" ? "White" : "Black"}. ${
                        customTurn === customPlayAs ? "You have the first move." : "The Computer moves first."
                      }`,
                      theoreticalPlan: "Analyze the position and calculate deep lines. Get live commentary and evaluations from Grandmaster Coach Garry.",
                      hint: "Evaluate candidate moves carefully, optimize piece coordination, and aim to realize your tactical objective!"
                    };

                    loadEndgame(dynamicEndgame);
                  } catch (e) {
                    setFenError("Please enter a valid chess FEN position before practicing.");
                  }
                }}
              >
                <Wrench className="w-4 h-4" />
                <span>Start Practice Session</span>
              </button>
            </div>
          )}

          <div className="mt-auto pt-6 border-t border-neutral-900 text-center text-[10px] text-neutral-500 font-mono">
            <span>Powered by Stockfish Engine</span>
          </div>
        </aside>

        {/* Center Panel: Chess Board and Interactive Training Console */}
        <main className="flex-1 flex flex-col md:flex-row overflow-y-auto lg:h-[calc(100vh-73px)] p-4 md:p-6 gap-6">
          {/* Section 1: The Board Area */}
          <div className="flex-1 flex flex-col items-center justify-start space-y-4 max-w-[780px] mx-auto w-full">
            {/* Top Info Bar */}
            <div className="w-full flex items-center justify-between bg-neutral-900/60 border border-neutral-900 rounded-xl px-4 py-3">
              <div className="flex items-center gap-2.5">
                <span
                  className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full ${
                    selectedEndgame.difficulty === Difficulty.BEGINNER
                      ? "bg-blue-950 text-blue-400 border border-blue-900"
                      : selectedEndgame.difficulty === Difficulty.INTERMEDIATE
                      ? "bg-emerald-950 text-emerald-400 border border-emerald-900"
                      : selectedEndgame.difficulty === Difficulty.ADVANCED
                      ? "bg-amber-950 text-amber-400 border border-amber-900"
                      : "bg-purple-950 text-purple-400 border border-purple-900"
                  }`}
                >
                  {selectedEndgame.difficulty}
                </span>
                <span className="text-xs text-neutral-400 font-mono">
                  Playing as {selectedEndgame.playerColor === "w" ? "White" : "Black"}
                </span>
              </div>

              {/* Status Banner */}
              <div className="flex items-center gap-2 text-xs">
                {isThinking ? (
                  <div className="flex items-center gap-1.5 text-neutral-400">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    <span className="font-mono">Stockfish is thinking...</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-neutral-400 font-mono">
                    <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                    <span>Your turn</span>
                  </div>
                )}
              </div>
            </div>

            {/* Chessboard & Eval Bar row */}
            <div className="relative w-full flex items-stretch gap-3">
              {/* Vertical Lichess-style Evaluation Bar */}
              <div className="w-5 bg-neutral-800 rounded-md overflow-hidden border border-neutral-700 flex flex-col justify-end relative shadow-inner select-none shrink-0">
                {/* Score indicators */}
                <div className="absolute inset-0 flex flex-col justify-between items-center text-[8px] font-bold py-2 font-mono text-neutral-400/80 pointer-events-none z-10">
                  <span>+5</span>
                  <span>0</span>
                  <span>-5</span>
                </div>

                {/* White advantage segment (grows from bottom) */}
                <div
                  className="w-full bg-[#f0ebd8] transition-all duration-500 ease-out"
                  style={{ height: `${evalPercentage}%` }}
                />

                {/* Black advantage segment (rest of the bar is dark) */}
                <div
                  className="w-full bg-neutral-900 transition-all duration-500 ease-out"
                  style={{ height: `${100 - evalPercentage}%` }}
                />

                {/* Micro numerical label overlaid on bar */}
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-black/60 px-1 py-0.5 rounded text-[7px] font-bold text-white font-mono pointer-events-none z-20 whitespace-nowrap">
                  {forcedMate !== null
                    ? `M${Math.abs(forcedMate)}`
                    : evaluation >= 0
                    ? `+${evaluation.toFixed(1)}`
                    : `${evaluation.toFixed(1)}`}
                </div>
              </div>

              {/* The Chess Board */}
              <div className="flex-1 relative">
                <Chessboard
                  fen={boardFen}
                  playerColor={selectedEndgame.playerColor}
                  isInteractive={gameStatus === "playing" && !isThinking}
                  lastMove={lastMove}
                  kingSquare={kingInCheckSquare}
                  onMove={handlePlayerMove}
                />

                {/* Game over full-board overlays */}
                <AnimatePresence>
                  {gameStatus !== "playing" && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="absolute inset-0 bg-neutral-950/80 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center z-30 rounded-lg border border-neutral-800"
                    >
                      {gameStatus === "checkmate_win" ? (
                        <div className="space-y-4 animate-bounce">
                          <div className="mx-auto w-16 h-16 bg-emerald-500 rounded-full flex items-center justify-center text-white shadow-lg shadow-emerald-500/30">
                            <Sparkle className="w-9 h-9 fill-white" />
                          </div>
                          <h3 className="text-2xl font-bold text-emerald-400">Exercise Completed!</h3>
                          <p className="text-sm text-neutral-300 max-w-sm mx-auto">
                            Fantastic work! You have successfully solved the endgame objective. Keep pushing your rating!
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div className="mx-auto w-16 h-16 bg-red-500 rounded-full flex items-center justify-center text-white shadow-lg shadow-red-500/30">
                            <AlertCircle className="w-9 h-9" />
                          </div>
                          <h3 className="text-2xl font-bold text-red-400">
                            {gameStatus === "checkmate_lose"
                              ? "Checkmate!"
                              : gameStatus === "failed_moves"
                              ? "Out of Moves!"
                              : "Draw / Failure"}
                          </h3>
                          <p className="text-sm text-neutral-300 max-w-sm mx-auto">
                            {gameStatus === "checkmate_lose"
                              ? "The computer successfully delivered mate. Reset the board to try again!"
                              : gameStatus === "draw_stalemate"
                              ? "A stalemate draw occurred, but the objective required a win. Keep the enemy king active!"
                              : "You drew the game but your goal was to win. Let's try again with a cleaner technique!"}
                          </p>
                        </div>
                      )}

                      <div className="mt-8 flex flex-col sm:flex-row gap-3">
                        <button
                          id="overlay-retry-btn"
                          className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 transition-all rounded-xl font-bold text-sm shadow-md shadow-emerald-600/20"
                          onClick={() => loadEndgame(selectedEndgame)}
                        >
                          Try Again / Reset
                        </button>
                        {gameStatus === "checkmate_win" && (
                          <button
                            id="overlay-next-btn"
                            className="px-5 py-2.5 bg-neutral-800 hover:bg-neutral-700 active:scale-95 transition-all rounded-xl font-bold text-sm border border-neutral-700 text-neutral-200"
                            onClick={() => {
                              // Load next exercise in order
                              const currentIndex = ENDGAMES.findIndex((eg) => eg.id === selectedEndgame.id);
                              const nextIndex = (currentIndex + 1) % ENDGAMES.length;
                              loadEndgame(ENDGAMES[nextIndex]);
                            }}
                          >
                            Next Endgame
                          </button>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Chessboard Actions / Settings */}
            <div className="w-full grid grid-cols-3 gap-3">
              <button
                id="ctrl-restart"
                className="flex items-center justify-center gap-2 p-2.5 rounded-xl bg-neutral-900 border border-neutral-800 hover:bg-neutral-850 active:scale-95 transition-all text-sm font-semibold hover:border-neutral-700 text-neutral-200"
                onClick={() => loadEndgame(selectedEndgame)}
              >
                <RotateCcw className="w-4 h-4" />
                <span>Restart</span>
              </button>
              <button
                id="ctrl-flip"
                className="flex items-center justify-center gap-2 p-2.5 rounded-xl bg-neutral-900 border border-neutral-800 hover:bg-neutral-850 active:scale-95 transition-all text-sm font-semibold hover:border-neutral-700 text-neutral-200"
                onClick={() => setIsFlipped(!isFlipped)}
              >
                <FlipHorizontal className="w-4 h-4" />
                <span>Flip Board</span>
              </button>
              <div className="flex items-center justify-center gap-1 px-2 py-1 bg-neutral-900/40 border border-neutral-900 rounded-xl font-mono text-[10px] text-neutral-400">
                <Computer className="w-4 h-4 text-emerald-500" />
                <span>Stockfish Depth {getEngineDepth(selectedEndgame.difficulty)}</span>
              </div>
            </div>
          </div>

          {/* Section 2: Coach and Move History Area */}
          <div className="flex-1 flex flex-col space-y-4 max-w-[440px] mx-auto w-full">
            {/* Header / Tabs */}
            <div className="bg-neutral-900/40 border border-neutral-900 rounded-xl p-1 flex">
              <button
                id="tab-trainer"
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                  activeTab === "trainer"
                    ? "bg-neutral-800 text-white shadow-sm"
                    : "text-neutral-400 hover:text-white"
                }`}
                onClick={() => setActiveTab("trainer")}
              >
                Interactive Play
              </button>
              <button
                id="tab-theory"
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                  activeTab === "theory"
                    ? "bg-neutral-800 text-white shadow-sm"
                    : "text-neutral-400 hover:text-white"
                }`}
                onClick={() => setActiveTab("theory")}
              >
                Theory Plan
              </button>
            </div>

            {/* TAB CONTENT: Trainer (Active play controls & move logs) */}
            {activeTab === "trainer" && (
              <div className="space-y-4 flex-1 flex flex-col">
                {/* Active Endgame Details Card */}
                <div className="bg-neutral-900/60 border border-neutral-900 rounded-2xl p-5 space-y-3.5">
                  <div>
                    <h2 className="text-lg font-bold tracking-tight text-white">{selectedEndgame.name}</h2>
                    <p className="text-xs text-neutral-400 mt-1">{selectedEndgame.description}</p>
                  </div>

                  <div className="bg-neutral-950/60 rounded-xl p-3.5 border border-neutral-900 space-y-2">
                    <div className="text-[10px] font-mono text-emerald-400 uppercase tracking-wider font-bold flex items-center gap-1.5">
                      <Award className="w-3.5 h-3.5" />
                      <span>Exercise Objective</span>
                    </div>
                    <p className="text-xs text-neutral-200 leading-relaxed font-semibold">
                      {selectedEndgame.objective}
                    </p>
                  </div>
                </div>

                {/* Master Coach Panel (Gemini API) */}
                <div className="bg-gradient-to-b from-neutral-900 to-neutral-950 border border-neutral-800 rounded-2xl p-5 space-y-4 shadow-xl">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-full bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                        <Sparkle className="w-5 h-5 fill-emerald-400 animate-pulse" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white tracking-tight">Coach Garry</h4>
                        <p className="text-[10px] text-neutral-400 font-mono">Gemini Chess Master</p>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono bg-emerald-950/60 border border-emerald-900/60 text-emerald-400 px-2 py-0.5 rounded-full">
                      Live Coach
                    </span>
                  </div>

                  {/* Coach Action Buttons */}
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      id="coach-hint"
                      disabled={coachLoading || gameStatus !== "playing"}
                      className="p-2 bg-neutral-900 hover:bg-neutral-850 disabled:opacity-40 rounded-xl border border-neutral-800 text-xs font-semibold text-neutral-300 hover:text-white transition-all text-center flex flex-col items-center gap-1"
                      onClick={() => askCoachGarry("hint")}
                    >
                      <HelpCircle className="w-4 h-4 text-emerald-400" />
                      <span>Get Hint</span>
                    </button>
                    <button
                      id="coach-explain"
                      disabled={coachLoading}
                      className="p-2 bg-neutral-900 hover:bg-neutral-850 disabled:opacity-40 rounded-xl border border-neutral-800 text-xs font-semibold text-neutral-300 hover:text-white transition-all text-center flex flex-col items-center gap-1"
                      onClick={() => askCoachGarry("explain")}
                    >
                      <BookOpen className="w-4 h-4 text-blue-400" />
                      <span>Explain Plan</span>
                    </button>
                    <button
                      id="coach-analyze"
                      disabled={coachLoading || history.length === 0}
                      className="p-2 bg-neutral-900 hover:bg-neutral-850 disabled:opacity-40 rounded-xl border border-neutral-800 text-xs font-semibold text-neutral-300 hover:text-white transition-all text-center flex flex-col items-center gap-1"
                      onClick={() => askCoachGarry("analyze")}
                    >
                      <Activity className="w-4 h-4 text-purple-400" />
                      <span>Analyze Play</span>
                    </button>
                  </div>

                  {/* Coach Dialogue box */}
                  <div className="bg-neutral-950 border border-neutral-900/80 rounded-xl p-4 min-h-[110px] flex flex-col justify-center">
                    {coachLoading ? (
                      <div className="flex flex-col items-center justify-center space-y-2 text-neutral-400">
                        <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                        <span className="text-xs font-mono">Garry is calculating...</span>
                      </div>
                    ) : coachText ? (
                      <div className="space-y-3.5 animate-fade-in text-xs leading-relaxed text-neutral-200">
                        <p>{coachText}</p>

                        {/* Additional JSON structure if provided */}
                        {coachIdea && (
                          <div className="bg-emerald-950/20 border border-emerald-900/40 rounded-lg p-2.5">
                            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider font-mono">
                              Key Technical Concept
                            </span>
                            <p className="font-semibold text-emerald-300 mt-1">{coachIdea}</p>
                          </div>
                        )}

                        {coachSteps.length > 0 && (
                          <div className="space-y-1.5 pt-1">
                            <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider font-mono">
                              Tactical Steps to Execute
                            </span>
                            <ul className="space-y-1">
                              {coachSteps.map((step, idx) => (
                                <li key={idx} className="flex items-start gap-1.5 text-neutral-300 text-[11px]">
                                  <ArrowRight className="w-3 h-3 text-emerald-500 shrink-0 mt-0.5" />
                                  <span>{step}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center text-neutral-500 space-y-1 text-xs">
                        <p>Need some advice? Ask Coach Garry above!</p>
                        <p className="text-[10px] text-neutral-600">He will evaluate your current position and moves.</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Move Logs History */}
                <div className="bg-neutral-900/30 border border-neutral-900 rounded-2xl p-4 flex-1 flex flex-col min-h-[140px]">
                  <div className="flex items-center gap-2 mb-2 px-1">
                    <History className="w-4 h-4 text-neutral-400" />
                    <h5 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider font-mono">Move History</h5>
                  </div>

                  <div className="flex-1 overflow-y-auto max-h-[160px] bg-neutral-950/40 rounded-xl p-3 border border-neutral-900/60">
                    {history.length === 0 ? (
                      <div className="h-full flex items-center justify-center text-neutral-600 text-xs">
                        No moves played yet.
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-y-1 gap-x-4 text-xs font-mono">
                        {Array.from({ length: Math.ceil(history.length / 2) }).map((_, idx) => {
                          const wMove = history[idx * 2];
                          const bMove = history[idx * 2 + 1];

                          return (
                            <React.Fragment key={idx}>
                              <div className="flex items-center justify-between py-0.5 border-b border-neutral-900/30">
                                <span className="text-neutral-500">{idx + 1}.</span>
                                <span className="font-semibold text-neutral-200 pr-4">{wMove.san}</span>
                              </div>
                              <div className="flex items-center justify-end py-0.5 border-b border-neutral-900/30">
                                <span className="font-semibold text-neutral-400">
                                  {bMove ? bMove.san : "..."}
                                </span>
                              </div>
                            </React.Fragment>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TAB CONTENT: Theory Plan (The underlying concepts) */}
            {activeTab === "theory" && (
              <div className="bg-neutral-900/60 border border-neutral-900 rounded-2xl p-5 space-y-4 flex-1 flex flex-col">
                <div>
                  <h3 className="text-sm font-semibold text-neutral-400 uppercase tracking-wider font-mono">Endgame Theory</h3>
                  <h2 className="text-lg font-bold text-white mt-1">{selectedEndgame.name}</h2>
                </div>

                <div className="space-y-4 overflow-y-auto text-xs leading-relaxed text-neutral-300 flex-1">
                  <div className="space-y-1.5">
                    <h4 className="font-bold text-neutral-200">The Core Goal</h4>
                    <p>{selectedEndgame.objective}</p>
                  </div>

                  <div className="space-y-1.5 pt-2 border-t border-neutral-900">
                    <h4 className="font-bold text-neutral-200">Starting Position (FEN)</h4>
                    <p className="font-mono bg-neutral-950 p-2.5 rounded border border-neutral-900 text-[10px] break-all select-all">
                      {selectedEndgame.fen}
                    </p>
                  </div>

                  <div className="space-y-1.5 pt-2 border-t border-neutral-900">
                    <h4 className="font-bold text-emerald-400 flex items-center gap-1.5">
                      <Info className="w-4 h-4" />
                      <span>Theoretical Master Strategy</span>
                    </h4>
                    <p className="text-neutral-200 leading-relaxed bg-emerald-950/10 p-3 rounded-xl border border-emerald-950/40">
                      {selectedEndgame.theoreticalPlan}
                    </p>
                  </div>

                  <div className="space-y-1.5 pt-2 border-t border-neutral-900">
                    <h4 className="font-bold text-neutral-200">Target Move Efficiency</h4>
                    <p>
                      An experienced master can typically complete this position within{" "}
                      <span className="text-emerald-400 font-bold font-mono">
                        {selectedEndgame.targetMovesCount || "N/A"} moves
                      </span>
                      . Use this count as a baseline to measure your efficiency!
                    </p>
                  </div>

                  <div className="space-y-1.5 pt-2 border-t border-neutral-900">
                    <h4 className="font-bold text-neutral-200">Default Hint</h4>
                    <p className="italic text-neutral-400">"{selectedEndgame.hint}"</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
