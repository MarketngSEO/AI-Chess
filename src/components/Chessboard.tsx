/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { Chess, Square } from "chess.js";

interface ChessboardProps {
  fen: string;
  playerColor: "w" | "b";
  isInteractive: boolean;
  lastMove: { from: string; to: string } | null;
  kingSquare: string | null;
  onMove: (from: string, to: string, promotion?: string) => void;
}

export default function Chessboard({
  fen,
  playerColor,
  isInteractive,
  lastMove,
  kingSquare,
  onMove,
}: ChessboardProps) {
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [validMoves, setValidMoves] = useState<string[]>([]);
  const [promotionPending, setPromotionPending] = useState<{
    from: string;
    to: string;
  } | null>(null);

  const chess = React.useMemo(() => new Chess(fen), [fen]);

  // Reset selection when FEN changes (e.g. new game loaded or computer moved)
  useEffect(() => {
    setSelectedSquare(null);
    setValidMoves([]);
    setPromotionPending(null);
  }, [fen]);

  // Generate board ranks and files depending on board orientation (playerColor)
  const ranks = playerColor === "w" ? [8, 7, 6, 5, 4, 3, 2, 1] : [1, 2, 3, 4, 5, 6, 7, 8];
  const files = playerColor === "w" ? ["a", "b", "c", "d", "e", "f", "g", "h"] : ["h", "g", "f", "e", "d", "c", "b", "a"];

  const getPieceAt = (squareName: string) => {
    try {
      return chess.get(squareName as Square);
    } catch {
      return null;
    }
  };

  const handleSquareClick = (squareName: string) => {
    if (!isInteractive) return;
    if (promotionPending) return;

    const piece = getPieceAt(squareName);

    // If a valid destination square was clicked
    if (selectedSquare && validMoves.includes(squareName)) {
      const selectedPiece = getPieceAt(selectedSquare);
      const isPawn = selectedPiece?.type === "p";
      const isPromotionRank =
        (selectedPiece?.color === "w" && squareName.endsWith("8")) ||
        (selectedPiece?.color === "b" && squareName.endsWith("1"));

      if (isPawn && isPromotionRank) {
        // Promotion triggered
        setPromotionPending({ from: selectedSquare, to: squareName });
      } else {
        // Standard move
        onMove(selectedSquare, squareName);
        setSelectedSquare(null);
        setValidMoves([]);
      }
      return;
    }

    // Select a piece belonging to the active player's color
    if (piece && piece.color === playerColor) {
      setSelectedSquare(squareName);
      const legalMoves = chess.moves({ square: squareName as Square, verbose: true });
      const destinations = legalMoves.map((m) => m.to);
      setValidMoves(destinations);
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

  return (
    <div className="relative w-full aspect-square max-w-[720px] mx-auto bg-neutral-900 rounded-lg shadow-2xl overflow-hidden border border-neutral-800">
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

            // Compute background color classes
            let squareBg = isDark ? "bg-emerald-800" : "bg-[#f0ebd8]";
            if (isSelected) {
              squareBg = "bg-yellow-300/60";
            } else if (isLastMoveSrc || isLastMoveDst) {
              squareBg = isDark ? "bg-[#b1bc50]" : "bg-[#d4dd7d]";
            } else if (isCheck) {
              squareBg = "bg-red-500/60 animate-pulse";
            }

            return (
              <div
                key={squareName}
                id={`square-${squareName}`}
                className={`relative flex items-center justify-center cursor-pointer transition-colors duration-150 select-none ${squareBg}`}
                onClick={() => handleSquareClick(squareName)}
              >
                {/* Chess Piece Rendering */}
                {piece && (
                  <img
                    src={getLichessPieceUrl(piece.color, piece.type)}
                    alt={`${piece.color === "w" ? "White" : "Black"} ${piece.type}`}
                    referrerPolicy="no-referrer"
                    className={`w-[85%] h-[85%] z-10 transition-transform hover:scale-105 active:scale-95 ${
                      isInteractive && piece.color === playerColor
                        ? "cursor-grab"
                        : "cursor-default"
                    }`}
                    draggable={isInteractive && piece.color === playerColor}
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/plain", squareName);
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      const fromSquare = e.dataTransfer.getData("text/plain");
                      if (fromSquare && fromSquare !== squareName) {
                        // Simulate a click on the starting square and then the destination square
                        if (isInteractive) {
                          const pieceOnFrom = getPieceAt(fromSquare);
                          if (pieceOnFrom && pieceOnFrom.color === playerColor) {
                            // First select the piece
                            setSelectedSquare(fromSquare);
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
                      }
                    }}
                  />
                )}

                {/* Valid Move Indicator Dots */}
                {isValidDestination && (
                  <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
                    {piece ? (
                      // If there is an opponent piece, draw a nice ring indicating capture
                      <div className="w-[80%] h-[80%] border-4 border-black/25 rounded-full" />
                    ) : (
                      // For empty squares, draw a solid small dot
                      <div className="w-[28%] h-[28%] bg-black/25 rounded-full" />
                    )}
                  </div>
                )}

                {/* Rank and File Labels */}
                {/* File labels along the bottom rank (rank 1 if White, rank 8 if Black) */}
                {((playerColor === "w" && rank === 1) || (playerColor === "b" && rank === 8)) && (
                  <span
                    className={`absolute bottom-0.5 right-1 text-[10px] font-bold select-none ${
                      isDark ? "text-[#f0ebd8]/80" : "text-emerald-900/80"
                    }`}
                  >
                    {file}
                  </span>
                )}

                {/* Rank labels along the left file (file 'a' if White, file 'h' if Black) */}
                {((playerColor === "w" && file === "a") || (playerColor === "b" && file === "h")) && (
                  <span
                    className={`absolute top-0.5 left-1 text-[10px] font-bold select-none ${
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
