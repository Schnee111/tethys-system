import express from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import { createServer as createViteServer } from "vite";

// Load local environmental context
dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Lazy-initialize Gemini API to prevent app crash on startup if key is initially absent
let aiClient: GoogleGenAI | null = null;
function getAiClient(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("GEMINI_API_KEY process.env parameter is currently absent.");
    }
    aiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// Cognitive proxy endpoint for Tethys AI Planetary Assessment
app.post("/api/analyze", async (req, res) => {
  try {
    const { telemetry, customQuery } = req.body;
    const ai = getAiClient();

    let textPrompt = `You are TETHYS, a high-fidelity cinematic planetary intelligence system designed for deep-space and deep-crust observation. Your tone is highly scientific, cosmic, precise, authoritative, and elegant (no emoji, no conversational filler, no exclamation marks).
    
Below is the active planetary anomalies telemetry captured across Seismic, Solar, and Atmospheric layers:
${telemetry || "No active telemetry events recorded."}
`;

    if (customQuery) {
      textPrompt += `\nAn inquiry of the cognitive core has been raised in real-time:\nInquirer Prompt: "${customQuery}"\nAnalyze the data dynamically and resolve the inquiry with scientific authority.`;
    } else {
      textPrompt += `\nPerform a dynamic synthesis forecast of these active conditions. Predict potential crustal, geomagnetic, or meteorological interactions, highlighting specific epicenters like Honshu or California if relevant, and compile a brief command review outlook (approx 150-200 words).`;
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: textPrompt,
      config: {
        systemInstruction: "You are the TETHYS Core Planetary Artificial Intelligence. Speak with clinical scientific majesty, giving crisp, analytical, hyper-professional deep-space telemetry assessments. Avoid greeting, formatting titles, introduction fluff, or colloquial endings. Output purely the analytical text.",
        temperature: 0.85,
      },
    });

    const outputText = response.text || "Disruption of cognitive relay. Unable to resolve final text coordinates.";
    res.json({ analysis: outputText });
  } catch (error: any) {
    console.error("Gemini API Error in safe Express core:", error);
    res.status(500).json({ error: error?.message || "Internal relay error" });
  }
});

// Configure Vite integration for asset serving & SPA client-side fallback
async function bootServer() {
  if (process.env.NODE_ENV !== "production") {
    console.log("Splicing developer server middleware via Vite...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Serving compiled production assets from dist/ directory...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Tethys command center operational on http://localhost:${PORT}`);
  });
}

bootServer();
