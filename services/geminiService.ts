import { GoogleGenAI } from "@google/genai";
import { AnalysisResult, GroundingChunk } from "../types";

// Initialize the client with the API key from the environment
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Analyzes an image of artwork and generates a German essay using Gemini 2.5 Flash.
 * It utilizes Google Search grounding to ensure accuracy.
 *
 * @param base64Image The base64 encoded image string (raw data, no prefix).
 * @param mimeType The mime type of the image (e.g., 'image/jpeg').
 * @returns The generated text and grounding metadata.
 */
export const analyzeArtwork = async (
  base64Image: string,
  mimeType: string
): Promise<AnalysisResult> => {
  try {
    const model = 'gemini-2.5-flash';
    
    const prompt = `
      Du bist ein sachkundiger Kunsthistoriker und Museumsführer.
      Analysiere dieses Bild eines Kunstwerks.
      
      Bitte erstelle einen informativen Text im Stil eines Audioguides auf Deutsch.
      
      WICHTIG:
      - Verzichte auf jegliche Anrede, Begrüßung oder formelle Einleitung (wie "Sehr geehrte Damen und Herren", "Willkommen" oder ähnliches).
      - Starte direkt mit der Beschreibung oder Geschichte des Kunstwerks.
      - Der Tonfall sollte erzählerisch, fesselnd und informativ sein.
      
      Der Text sollte folgende Punkte abdecken:
      1. Identifizierung des Kunstwerks (Titel, Künstler, Entstehungsjahr).
      2. Eine Beschreibung des Stils und der Technik.
      3. Historischer Hintergrund und Kontext.
      4. Interessante Fakten oder symbolische Bedeutungen.
      
      Benutze Google Search, um Fakten und Details zu verifizieren.
      Formatiere den Text mit Markdown für gute Lesbarkeit (Überschriften, Fettgedrucktes).
    `;

    const response = await ai.models.generateContent({
      model: model,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Image,
            },
          },
          {
            text: prompt,
          },
        ],
      },
      config: {
        // Enable Google Search Grounding
        tools: [{ googleSearch: {} }],
        temperature: 0.4, // Slightly lower temperature for more factual accuracy
      },
    });

    const text = response.text || "Keine Informationen gefunden.";
    
    // Extract grounding chunks if available
    const groundingChunks = 
      (response.candidates?.[0]?.groundingMetadata?.groundingChunks as GroundingChunk[]) || [];

    return {
      text,
      groundingChunks,
    };

  } catch (error) {
    console.error("Gemini API Error:", error);
    throw new Error("Die Analyse ist fehlgeschlagen. Bitte versuchen Sie es erneut.");
  }
};