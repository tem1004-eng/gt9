import { GoogleGenAI } from "@google/genai";

// Initialize Gemini
// Note: In a real production app, ensure API_KEY is set in environment variables.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const askGuitarTech = async (prompt: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash', // Using efficient model for quick Q&A
      contents: prompt,
      config: {
        systemInstruction: "You are an expert Guitar Technician and Luthier. You are helpful, concise, and friendly. You help users with guitar tuning, maintenance, string gauges, and basic music theory related to guitar. Keep answers short and practical.",
      }
    });

    return response.text || "I couldn't tune into that request. Try again.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "The Guitar Tech is currently on a break (API Error). Please check your connection or API key.";
  }
};
