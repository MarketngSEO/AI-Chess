/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { Chess, Square } from "chess.js";

interface ChessPiece {
  type: string; // 'p', 'r', 'n', 'b', 'q', 'k'
  color: "w" | "b";
}

const parsePiecesFromFen = (fenString: string): Record<string, ChessPiece> => {
  const pieces: Record<string, ChessPiece> = {};
  if (!fenString) return pieces;
  
  const parts = fenString.trim().split(/\s+/);
  const placement = parts[0];
  const rows = placement.split("/");
  
  const files = ["a", "b", "c", "d", "e", "f", "g", "h"];
  
  for (let r = 0; r < 8; r++) {
    const row = rows[r];
    if (!row) continue;
    
    let fileIdx = 0;
    for (let i = 0; i < row.length; i++) {
      const char = row[i];
      if (/[1-8]/.test(char)) {
        fileIdx += parseInt(char, 10);
      } else {
        const color = char === char.toUpperCase() ? "w" : "b";
        const type = char.toLowerCase();
        const square = `${files[fileIdx]}${8 - r}`;
        pieces[square] = { type, color };
        fileIdx++;
      }
    }
  }
  return pieces;
};

const generateFenFromPieces = (
  pieces: Record<string, ChessPiece>,
  turn: "w" | "b" = "w"
): string => {
  const files = ["a", "b", "c", "d", "e", "f", "g", "h"];
  const rows: string[] = [];
  
  for (let r = 8; r >= 1; r--) {
    let rowStr = "";
    let emptyCount = 0;
    
    for (let f = 0; f < 8; f++) {
      const square = `${files[f]}${r}`;
      const piece = pieces[square];
      
      if (piece) {
        if (emptyCount > 0) {
          rowStr += emptyCount.toString();
          emptyCount = 0;
        }
        const char = piece.color === "w" ? piece.type.toUpperCase() : piece.type.toLowerCase();
        rowStr += char;
      } else {
        emptyCount++;
      }
    }
    
    if (emptyCount > 0) {
      rowStr += emptyCount.toString();
    }
    rows.push(rowStr);
  }
  
  const placement = rows.join("/");
  return `${placement} ${turn} - - 0 1`;
};

interface ChessboardProps {
  fen: string;
  actualFen?: string;
  playerColor: "w" | "b";
  isInteractive: boolean;
  lastMove: { from: string; to: string } | null;
  kingSquare: string | null;
  onMove: (from: string, to: string, promotion?: string) => void;
  // New board editor props
  isEditorMode?: boolean;
  onEditorFenChange?: (newFen: string) => void;
  editorSelectedPiece?: { type: string; color: "w" | "b" } | "delete" | null;
  // Premoves props
  premoves?: Array<{ from: string; to: string; promotion?: string }>;
  onPremove?: (from: string, to: string, promotion?: string) => void;
  onClearPremoves?: () => void;
  isFlipped?: boolean;
}

const getHypotheticalChessState = (
  baseFen: string,
  premoveList: Array<{ from: string; to: string; promotion?: string }>,
  playerColor: "w" | "b"
) => {
  let currentChess = new Chess(baseFen);
  for (const pm of premoveList) {
    try {
      if (currentChess.turn() !== playerColor) {
        const parts = currentChess.fen().split(" ");
        parts[1] = playerColor;
        currentChess = new Chess(parts.join(" "));
      }
      currentChess.move({ from: pm.from, to: pm.to, promotion: pm.promotion || "q" });
    } catch (e) {
      console.warn("Could not apply hypothetical premove in Chessboard", pm, e);
    }
  }
  return currentChess;
};

export default function Chessboard({
  fen,
  actualFen,
  playerColor,
  isInteractive,
  lastMove,
  kingSquare,
  onMove,
  isEditorMode = false,
  onEditorFenChange,
  editorSelectedPiece = null,
  premoves = [],
  onPremove,
  onClearPremoves,
  isFlipped,
}: ChessboardProps) {
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [validMoves, setValidMoves] = useState<string[]>([]);
  const [dragOverSquare, setDragOverSquare] = useState<string | null>(null);
  const [promotionPending, setPromotionPending] = useState<{
    from: string;
    to: string;
  } | null>(null);

  // Chess.com style right click highlights & arrows
  const [highlightedSquares, setHighlightedSquares] = useState<Set<string>>(new Set());
  const [arrows, setArrows] = useState<Array<{ from: string; to: string }>>([]);
  const [rightClickStart, setRightClickStart] = useState<string | null>(null);
  const [rightClickHover, setRightClickHover] = useState<string | null>(null);

  const chess = React.useMemo(() => {
    try {
      return new Chess(fen);
    } catch {
      try {
        return new Chess("8/8/8/8/8/8/8/8 w - - 0 1");
      } catch {
        return new Chess();
      }
    }
  }, [fen]);

  const parsedPieces = React.useMemo(() => parsePiecesFromFen(fen), [fen]);

  // Reset selection when FEN changes (e.g. new game loaded or computer moved)
  useEffect(() => {
    setSelectedSquare(null);
    setValidMoves([]);
    setPromotionPending(null);
    setHighlightedSquares(new Set());
    setArrows([]);
  }, [fen]);

  // Generate board ranks and files depending on board orientation (isFlipped or playerColor)
  const isBoardFlipped = isFlipped !== undefined ? isFlipped : playerColor === "b";
  const ranks = isBoardFlipped ? [1, 2, 3, 4, 5, 6, 7, 8] : [8, 7, 6, 5, 4, 3, 2, 1];
  const files = isBoardFlipped ? ["h", "g", "f", "e", "d", "c", "b", "a"] : ["a", "b", "c", "d", "e", "f", "g", "h"];

  const getPieceAt = (squareName: string) => {
    return parsedPieces[squareName] || null;
  };

  const isPlayerTurn = isInteractive;
  const canPremove = !isPlayerTurn && !isEditorMode && !!onPremove;

  const getPremoveDestinations = (squareName: string): string[] => {
    try {
      const hypotheticalChess = getHypotheticalChessState(actualFen || fen, premoves, playerColor);
      if (hypotheticalChess.turn() !== playerColor) {
        const parts = hypotheticalChess.fen().split(" ");
        parts[1] = playerColor;
        const forcedChess = new Chess(parts.join(" "));
        return forcedChess.moves({ square: squareName as Square, verbose: true }).map(m => m.to as string);
      } else {
        return hypotheticalChess.moves({ square: squareName as Square, verbose: true }).map(m => m.to as string);
      }
    } catch {
      return [];
    }
  };

  const handleSquareClick = (squareName: string) => {
    // Left clicking any square clears right-click highlights/arrows
    if (highlightedSquares.size > 0 || arrows.length > 0) {
      setHighlightedSquares(new Set());
      setArrows([]);
    }

    if (isEditorMode) {
      if (!onEditorFenChange) return;
      const currentPieces = { ...parsedPieces };
      const existing = currentPieces[squareName];
      
      if (editorSelectedPiece === "delete") {
        delete currentPieces[squareName];
      } else if (editorSelectedPiece) {
        if (existing && existing.type === editorSelectedPiece.type && existing.color === editorSelectedPiece.color) {
          // Tap once to erase if the exact same piece is tapped again
          delete currentPieces[squareName];
        } else {
          // Add or replace
          currentPieces[squareName] = {
            type: editorSelectedPiece.type,
            color: editorSelectedPiece.color
          };
        }
      } else {
        // Toggle removal if nothing is selected
        if (existing) {
          delete currentPieces[squareName];
        }
      }
      
      const parts = fen.trim().split(/\s+/);
      const turn = (parts[1] === "w" || parts[1] === "b") ? (parts[1] as "w" | "b") : "w";
      
      const newFen = generateFenFromPieces(currentPieces, turn);
      onEditorFenChange(newFen);
      return;
    }

    if (!isPlayerTurn && !canPremove) return;
    if (promotionPending) return;

    const piece = getPieceAt(squareName);

    // If a valid destination square was clicked
    if (selectedSquare && validMoves.includes(squareName)) {
      const selectedPiece = getPieceAt(selectedSquare);
      const isPawn = selectedPiece?.type === "p";
      const isPromotionRank =
        (selectedPiece?.color === "w" && squareName.endsWith("8")) ||
        (selectedPiece?.color === "b" && squareName.endsWith("1"));

      if (isPlayerTurn) {
        if (isPawn && isPromotionRank) {
          // Promotion triggered
          setPromotionPending({ from: selectedSquare, to: squareName });
        } else {
          // Standard move
          onMove(selectedSquare, squareName);
          setSelectedSquare(null);
          setValidMoves([]);
        }
      } else if (canPremove && onPremove) {
        if (isPawn && isPromotionRank) {
          // Default promotion to Queen for premoves
          onPremove(selectedSquare, squareName, "q");
        } else {
          onPremove(selectedSquare, squareName);
        }
        setSelectedSquare(null);
        setValidMoves([]);
      }
      return;
    }

    // Select a piece belonging to the active player's color
    if (piece && piece.color === playerColor) {
      setSelectedSquare(squareName);
      if (isPlayerTurn) {
        const legalMoves = chess.moves({ square: squareName as Square, verbose: true });
        const destinations = legalMoves.map((m) => m.to);
        setValidMoves(destinations);
      } else if (canPremove) {
        const destinations = getPremoveDestinations(squareName);
        setValidMoves(destinations);
      }
    } else {
      // Clear selection
      setSelectedSquare(null);
      setValidMoves([]);
    }
  };

  const handlePromotionSelect = (pieceType: string) => {
    if (promotionPending) {
      onMove(promotionPending.from, promotionPending.to, pieceType);
      setPromotionPending(null);
      setSelectedSquare(null);
      setValidMoves([]);
    }
  };

  const getLichessPieceUrl = (color: "w" | "b", type: string) => {
    // cburnett theme is standard, modern, and extremely legible
    const pieceCode = `${color}${type.toUpperCase()}`;
    return `https://lichess1.org/assets/piece/cburnett/${pieceCode}.svg`;
  };

  const getSquareCenterPercent = (squareName: string) => {
    const file = squareName[0];
    const rank = parseInt(squareName[1]);
    const c = files.indexOf(file);
    const r = ranks.indexOf(rank);
    return {
      x: ((c + 0.5) / 8) * 100,
      y: ((r + 0.5) / 8) * 100,
    };
  };

  const getArrowPoints = (from: string, to: string) => {
    const p1 = getSquareCenterPercent(from);
    const p2 = getSquareCenterPercent(to);
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) return { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y };
    // Shorten the end point slightly so arrowhead is positioned beautifully
    const shortenAmount = 3.8; // percent of board
    const x2 = p2.x - (dx / len) * shortenAmount;
    const y2 = p2.y - (dy / len) * shortenAmount;
    return { x1: p1.x, y1: p1.y, x2, y2 };
  };

  const handleSquareMouseDown = (e: React.MouseEvent, squareName: string) => {
    if (e.button === 2) {
      e.preventDefault();
      if (premoves && premoves.length > 0) {
        if (onClearPremoves) {
          onClearPremoves();
          return;
        }
      }
      setRightClickStart(squareName);
      setRightClickHover(squareName);
    } else if (e.button === 0) {
      // Left-click clears right-click annotations
      if (highlightedSquares.size > 0 || arrows.length > 0) {
        setHighlightedSquares(new Set());
        setArrows([]);
      }
    }
  };

  const handleSquareMouseEnter = (squareName: string) => {
    if (rightClickStart) {
      setRightClickHover(squareName);
    }
  };

  const handleBoardMouseUp = (e: React.MouseEvent) => {
    if (e.button === 2) {
      e.preventDefault();
      if (rightClickStart) {
        if (rightClickHover === rightClickStart) {
          // Toggle square highlight
          setHighlightedSquares((prev) => {
            const next = new Set(prev);
            if (next.has(rightClickStart)) {
              next.delete(rightClickStart);
            } else {
              next.add(rightClickStart);
            }
            return next;
          });
        } else if (rightClickHover) {
          // Toggle arrow
          setArrows((prev) => {
            const exists = prev.some((a) => a.from === rightClickStart && a.to === rightClickHover);
            if (exists) {
              return prev.filter((a) => !(a.from === rightClickStart && a.to === rightClickHover));
            } else {
              return [...prev, { from: rightClickStart, to: rightClickHover }];
            }
          });
        }
      }
    }
    setRightClickStart(null);
    setRightClickHover(null);
  };

  return (
    <div
      className="relative w-full aspect-square max-w-[720px] mx-auto bg-neutral-900 rounded-lg shadow-2xl overflow-hidden border border-neutral-800"
      onMouseUp={handleBoardMouseUp}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* 8x8 Grid */}
      <div className="grid grid-cols-8 grid-rows-8 w-full h-full">
        {ranks.map((rank) =>
          files.map((file) => {
            const squareName = `${file}${rank}`;
            const isDark = (ranks.indexOf(rank) + files.indexOf(file)) % 2 !== 0;
            const piece = getPieceAt(squareName);

            const isSelected = selectedSquare === squareName;
            const isValidDestination = validMoves.includes(squareName);
            const isLastMoveSrc = lastMove?.from === squareName;
            const isLastMoveDst = lastMove?.to === squareName;
            const isCheck = kingSquare === squareName;
            const isHighlighted = highlightedSquares.has(squareName);
            const isPremoveSrc = premoves.some((pm) => pm.from === squareName);
            const isPremoveDst = premoves.some((pm) => pm.to === squareName);

            // Compute background color classes
            let squareBg = isDark ? "bg-emerald-800" : "bg-[#f0ebd8]";
            if (isHighlighted) {
              squareBg = "bg-[#f0ebd8]";
            }
            if (isSelected) {
              squareBg = "bg-yellow-300/60";
            } else if (isLastMoveSrc || isLastMoveDst) {
              squareBg = isDark ? "bg-[#b1bc50]" : "bg-[#d4dd7d]";
            } else if (isPremoveSrc || isPremoveDst) {
              squareBg = "bg-red-500/35";
            } else if (isCheck) {
              squareBg = "bg-red-500/60 animate-pulse";
            }

            const isDraggedOverValid = dragOverSquare === squareName && validMoves.includes(squareName);

            return (
              <div
                key={squareName}
                id={`square-${squareName}`}
                className={`relative flex items-center justify-center cursor-pointer transition-colors duration-150 select-none ${squareBg} ${
                  isDraggedOverValid ? "ring-4 ring-emerald-500/80 ring-inset z-30 scale-[1.02] shadow-lg" : ""
                }`}
                onClick={() => handleSquareClick(squareName)}
                onMouseDown={(e) => handleSquareMouseDown(e, squareName)}
                onMouseEnter={() => handleSquareMouseEnter(squareName)}
                onDragOver={(e) => {
                  if (isInteractive || canPremove || isEditorMode) {
                    e.preventDefault();
                    if (dragOverSquare !== squareName) {
                      setDragOverSquare(squareName);
                    }
                  }
                }}
                onDragLeave={() => {
                  if (dragOverSquare === squareName) {
                    setDragOverSquare(null);
                  }
                }}
                 onDrop={(e) => {
                  e.preventDefault();
                  setDragOverSquare(null);

                  if (isEditorMode && onEditorFenChange) {
                    const fromSquare = e.dataTransfer.getData("text/plain");
                    const pieceData = e.dataTransfer.getData("text/piece");

                    const currentPieces = { ...parsedPieces };

                    if (pieceData) {
                      try {
                        const pieceObj = JSON.parse(pieceData);
                        currentPieces[squareName] = {
                          type: pieceObj.type,
                          color: pieceObj.color
                        };
                      } catch (err) {
                        console.error("Failed to parse piece data on drop", err);
                      }
                    } else if (fromSquare && fromSquare !== squareName) {
                      const existing = currentPieces[fromSquare];
                      if (existing) {
                        delete currentPieces[fromSquare];
                        currentPieces[squareName] = existing;
                      }
                    }

                    const parts = fen.trim().split(/\s+/);
                    const turn = (parts[1] === "w" || parts[1] === "b") ? (parts[1] as "w" | "b") : "w";
                    const newFen = generateFenFromPieces(currentPieces, turn);
                    onEditorFenChange(newFen);
                    return;
                  }

                  if (isInteractive) {
                    const fromSquare = e.dataTransfer.getData("text/plain");
                    if (fromSquare && fromSquare !== squareName) {
                      const pieceOnFrom = getPieceAt(fromSquare);
                      if (pieceOnFrom && pieceOnFrom.color === playerColor) {
                        const legalMoves = chess.moves({ square: fromSquare as Square, verbose: true });
                        const destinations = legalMoves.map((m) => m.to);
                        if (destinations.includes(squareName)) {
                          const isPawn = pieceOnFrom.type === "p";
                          const isPromotionRank =
                            (pieceOnFrom.color === "w" && squareName.endsWith("8")) ||
                            (pieceOnFrom.color === "b" && squareName.endsWith("1"));

                          if (isPawn && isPromotionRank) {
                            setPromotionPending({ from: fromSquare, to: squareName });
                          } else {
                            onMove(fromSquare, squareName);
                          }
                        }
                      }
                    }
                  } else if (canPremove && onPremove) {
                    const fromSquare = e.dataTransfer.getData("text/plain");
                    if (fromSquare && fromSquare !== squareName) {
                      const pieceOnFrom = getPieceAt(fromSquare);
                      if (pieceOnFrom && pieceOnFrom.color === playerColor) {
                        const destinations = getPremoveDestinations(fromSquare);
                        if (destinations.includes(squareName)) {
                          const isPawn = pieceOnFrom.type === "p";
                          const isPromotionRank =
                            (pieceOnFrom.color === "w" && squareName.endsWith("8")) ||
                            (pieceOnFrom.color === "b" && squareName.endsWith("1"));

                          if (isPawn && isPromotionRank) {
                            onPremove(fromSquare, squareName, "q");
                          } else {
                            onPremove(fromSquare, squareName);
                          }
                        }
                      }
                    }
                  }
                  setSelectedSquare(null);
                  setValidMoves([]);
                }}
              >
                {/* Chess Piece Rendering */}
                {piece && (
                  <img
                    src={getLichessPieceUrl(piece.color, piece.type)}
                    alt={`${piece.color === "w" ? "White" : "Black"} ${piece.type}`}
                    referrerPolicy="no-referrer"
                    className={`w-[85%] h-[85%] z-10 transition-transform hover:scale-105 active:scale-95 ${
                      isEditorMode
                        ? "cursor-grab active:cursor-grabbing"
                        : (isInteractive || canPremove) && piece.color === playerColor
                        ? "cursor-grab active:cursor-grabbing"
                        : "cursor-default"
                    }`}
                    draggable={isEditorMode ? true : ((isInteractive || canPremove) && piece.color === playerColor)}
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/plain", squareName);
                      if (!isEditorMode) {
                        setSelectedSquare(squareName);
                        if (isInteractive) {
                          const legalMoves = chess.moves({ square: squareName as Square, verbose: true });
                          const destinations = legalMoves.map((m) => m.to);
                          setValidMoves(destinations);
                        } else if (canPremove) {
                          const destinations = getPremoveDestinations(squareName);
                          setValidMoves(destinations);
                        }
                      }
                    }}
                    onDragEnd={() => {
                      setDragOverSquare(null);
                      if (!isEditorMode) {
                        setSelectedSquare(null);
                        setValidMoves([]);
                      }
                    }}
                  />
                )}

                {/* Right click highlight */}
                {isHighlighted && (
                  <div className="absolute inset-0 bg-amber-400/40 z-20 pointer-events-none" />
                )}

                {/* Valid Move Indicator Dots */}
                {isValidDestination && (
                  <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
                    {piece ? (
                      // If there is an opponent piece, draw a nice ring indicating capture
                      <div className="w-[80%] h-[80%] border-4 border-emerald-500/50 rounded-full" />
                    ) : (
                      // For empty squares, draw a solid small dot
                      <div className="w-[28%] h-[28%] bg-emerald-500/50 rounded-full" />
                    )}
                  </div>
                )}

                {/* Rank and File Labels */}
                {/* File labels along the bottom rank (rank 1 if White, rank 8 if Black) */}
                {((playerColor === "w" && rank === 1) || (playerColor === "b" && rank === 8)) && (
                  <span
                    className={`absolute bottom-0.5 right-1 text-[10px] font-bold select-none z-30 ${
                      isDark ? "text-[#f0ebd8]/80" : "text-emerald-900/80"
                    }`}
                  >
                    {file}
                  </span>
                )}

                {/* Rank labels along the left file (file 'a' if White, file 'h' if Black) */}
                {((playerColor === "w" && file === "a") || (playerColor === "b" && file === "h")) && (
                  <span
                    className={`absolute top-0.5 left-1 text-[10px] font-bold select-none z-30 ${
                      isDark ? "text-[#f0ebd8]/80" : "text-emerald-900/80"
                    }`}
                  >
                    {rank}
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* SVG Arrows Overlay */}
      <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full pointer-events-none z-40">
        <defs>
          <marker
            id="arrowhead-orange"
            markerWidth="6"
            markerHeight="6"
            refX="4.2"
            refY="3"
            orient="auto"
          >
            <path d="M0,1 L0,5 L5,3 Z" fill="#f6a23e" />
          </marker>
          <marker
            id="arrowhead-red"
            markerWidth="6"
            markerHeight="6"
            refX="4.2"
            refY="3"
            orient="auto"
          >
            <path d="M0,1 L0,5 L5,3 Z" fill="#ef4444" />
          </marker>
        </defs>



        {/* Established Arrows */}
        {arrows.map((arrow, idx) => {
          const pts = getArrowPoints(arrow.from, arrow.to);
          return (
            <line
              key={idx}
              x1={pts.x1}
              y1={pts.y1}
              x2={pts.x2}
              y2={pts.y2}
              stroke="#f6a23e"
              strokeWidth="1.6"
              opacity="0.85"
              markerEnd="url(#arrowhead-orange)"
              strokeLinecap="round"
            />
          );
        })}

        {/* Live Active Drag Arrow */}
        {rightClickStart && rightClickHover && rightClickStart !== rightClickHover && (() => {
          const pts = getArrowPoints(rightClickStart, rightClickHover);
          return (
            <line
              x1={pts.x1}
              y1={pts.y1}
              x2={pts.x2}
              y2={pts.y2}
              stroke="#f6a23e"
              strokeWidth="1.6"
              opacity="0.6"
              markerEnd="url(#arrowhead-orange)"
              strokeLinecap="round"
            />
          );
        })()}
      </svg>

      {/* Pawn Promotion Modal Overlay */}
      {promotionPending && (
        <div className="absolute inset-0 bg-black/75 flex flex-col items-center justify-center z-50 animate-fade-in p-6">
          <div className="bg-neutral-800 rounded-xl p-5 border border-neutral-700 shadow-2xl text-center max-w-sm w-full">
            <h4 className="text-white font-semibold text-lg mb-4">Pawn Promotion</h4>
            <p className="text-neutral-400 text-sm mb-6">Choose a piece to promote your pawn into:</p>
            <div className="grid grid-cols-4 gap-3">
              {[
                { type: "q", label: "Queen" },
                { type: "r", label: "Rook" },
                { type: "b", label: "Bishop" },
                { type: "n", label: "Knight" },
              ].map((promo) => (
                <button
                  key={promo.type}
                  id={`promo-select-${promo.type}`}
                  className="flex flex-col items-center justify-center p-3 rounded-lg bg-neutral-700 hover:bg-neutral-600 border border-neutral-600 transition-all active:scale-95 group"
                  onClick={() => handlePromotionSelect(promo.type)}
                >
                  <img
                    src={getLichessPieceUrl(playerColor, promo.type)}
                    alt={promo.label}
                    referrerPolicy="no-referrer"
                    className="w-12 h-12 mb-1 group-hover:scale-110 transition-transform"
                  />
                  <span className="text-[10px] font-medium text-neutral-300 group-hover:text-white">
                    {promo.label}
                  </span>
                </button>
              ))}
            </div>
            <button
              id="promo-cancel"
              className="mt-6 text-sm text-neutral-400 hover:text-white transition-colors"
              onClick={() => setPromotionPending(null)}
            >
              Cancel Move
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
