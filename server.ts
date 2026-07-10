/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
import { createServer as createViteServer } from "vite";

// Load environment variables
dotenv.config();

const app = express();
const PORT = 3000;

// Initialize Google GenAI SDK server-side
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

app.use(express.json());

// --- API ROUTES ---

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// Master Chess Coach endpoint using Gemini 3.5 Flash
app.post("/api/coach", async (req, res) => {
  try {
    const { fen, history, endgameName, difficulty, playerColor, action } = req.body;

    if (!fen || !endgameName || !difficulty || !action) {
      return res.status(400).json({ error: "Missing required parameters" });
    }

    const sideText = playerColor === "w" ? "White" : "Black";
    let prompt = "";

    if (action === "hint") {
      prompt = `The player is practicing the chess endgame: "${endgameName}" (Difficulty: ${difficulty}).
They are playing as ${sideText}.
Current position FEN: "${fen}"
Move history so far: ${JSON.stringify(history)}

Please provide a subtle, encouraging chess hint (1-2 sentences max). Do NOT explicitly give away the best move coordinates (e.g. do not say "play Rd4"). Instead, point the player in the right direction logically (e.g., "Think about how you can cut off the king using your rook" or "Seize the opposition with your king"). Keep it inspiring!`;
    } else if (action === "explain") {
      prompt = `The player is practicing the chess endgame: "${endgameName}" (Difficulty: ${difficulty}).
They are playing as ${sideText}.
Current position FEN: "${fen}"

Please provide a structured, master-level explanation of the winning or drawing strategy for this position.
Format your response as a JSON object matching this schema:
{
  "message": "A warm, high-level summary of the theoretical objective and mindset (2-3 sentences).",
  "keyIdea": "The main technical concept or trick to remember (e.g., 'Opposition', 'Building a Bridge', 'Zugzwang').",
  "nextSteps": [
    "Step 1 to focus on right now",
    "Step 2 to follow after",
    "Step 3 or potential pitfalls to avoid"
  ]
}`;
    } else {
      // Analyze history / last move
      prompt = `The player is practicing the chess endgame: "${endgameName}" (Difficulty: ${difficulty}).
They are playing as ${sideText}.
Current position FEN: "${fen}"
Full move history in this session: ${JSON.stringify(history)}

Please analyze the moves they've made so far. Are they on the right track? Have they committed a slip?
Format your response as a JSON object matching this schema:
{
  "message": "A helpful, encouraging analysis of their play (2-3 sentences), explaining whether they are making progress, following the correct technical strategy, or if they fell into a stalemate/repetition hazard.",
  "keyIdea": "The key technical advice for the current board state.",
  "nextSteps": [
    "What they should look for in their next move.",
    "A warning about a potential mistake or draw/mate threat."
  ]
}`;
    }

    const systemInstruction = `You are "Garry", a world-class Grandmaster Chess Coach. You specialize in teaching endgame theory in an encouraging, highly educational, and friendly manner. You use simple language but maintain chess precision. When returning JSON, follow the requested schema exactly. Always ensure your explanations are grounded in chess rules.`;

    const responseMimeType = action === "hint" ? "text/plain" : "application/json";

    const config: any = {
      systemInstruction,
      temperature: 0.7,
    };

    if (responseMimeType === "application/json") {
      config.responseMimeType = "application/json";
      config.responseSchema = {
        type: Type.OBJECT,
        properties: {
          message: { type: Type.STRING },
          keyIdea: { type: Type.STRING },
          nextSteps: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          }
        },
        required: ["message", "keyIdea", "nextSteps"]
      };
    }

    const result = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config,
    });

    const responseText = result.text || "";

    if (action === "hint") {
      return res.json({ message: responseText });
    } else {
      try {
        const parsedJson = JSON.parse(responseText.trim());
        return res.json(parsedJson);
      } catch (parseErr) {
        console.error("Failed to parse JSON response from Gemini:", responseText);
        // Fallback response format
        return res.json({
          message: responseText,
          keyIdea: "Strategy analysis complete",
          nextSteps: ["Observe the board carefully", "Look for king safety and pawn progress"]
        });
      }
    }

  } catch (error: any) {
    console.error("Coach API error:", error);
    return res.status(500).json({
      message: "Garry the Coach is taking a short thinking break. Please try again in a moment!",
      keyIdea: "Error connecting to AI Coach",
      nextSteps: ["Check your API configuration", "Retry requesting guidance"]
    });
  }
});

// --- VITE DEV / PRODUCTION MIDDLEWARE ---

async function setupVite() {
  if (process.env.NODE_ENV !== "production") {
    // Development mode
    console.log("Starting server in DEVELOPMENT mode with Vite middleware...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production mode
    console.log("Starting server in PRODUCTION mode...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

setupVite().catch((err) => {
  console.error("Failed to start server:", err);
});
