
import { GoogleGenAI, Type } from "@google/genai";

export interface MarketAdjustment {
  multiplier: number;
  reasoning: string;
  sources: { title: string; uri: string }[];
}

export const getIndustryInsights = async (prompt: string, statsSummary: string) => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `You are a world-class supply chain analyst. 
      The user describes their business as: "${prompt}".
      Recent stats: ${statsSummary}.
      
      Provide 3 strategic insights for their forecasting:
      1. Market factors.
      2. Forecast adjustments.
      3. Risk assessment.`,
      config: { temperature: 0.7, maxOutputTokens: 400 }
    });
    return response.text;
  } catch (error) {
    console.error("AI Insight Error:", error);
    return "Insights currently unavailable.";
  }
};

export const getNarrativeSummary = async (prompt: string, historicalAvg: number, forecastAvg: number, horizon: number) => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const trend = forecastAvg > historicalAvg ? "upward" : "downward";
    const diff = Math.abs(((forecastAvg - historicalAvg) / (historicalAvg || 1)) * 100).toFixed(1);
    
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Generate a short business narrative for a supply chain manager.
      Business: ${prompt}.
      Historical Average Volume: ${historicalAvg}.
      Projected Average Volume (next ${horizon} months): ${forecastAvg}.
      Trend: ${trend} by ${diff}%.
      
      Compare how the next ${horizon} months will differ from the historical trend. Be specific to the industry mentioned. Focus on operational impact.`,
      config: { temperature: 0.8, maxOutputTokens: 500 }
    });
    return response.text;
  } catch (error) {
    return "Narrative generation failed.";
  }
};

export const getMarketTrendAdjustment = async (prompt: string): Promise<MarketAdjustment> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Research current market trends, industry reports, and economic forecasts for: "${prompt}". 
      Look for specific 2024-2025 growth rates or demand shifts from trustworthy sources like Statista, consumer reports, or official trade organizations.
      
      Return a JSON object with:
      1. "multiplier": a number (e.g., 1.15 for 15% growth, 0.90 for 10% decline) that represents the expected market-driven shift.
      2. "reasoning": A brief 2-sentence explanation of why this adjustment is being applied based on your search results.
      
      Respond ONLY with the JSON.`,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            multiplier: { type: Type.NUMBER, description: "The demand multiplier based on market research." },
            reasoning: { type: Type.STRING, description: "Justification for the multiplier." }
          },
          required: ["multiplier", "reasoning"]
        }
      }
    });

    // Safely extract JSON content in case search grounding output includes extra text
    const text = response.text?.trim() || "{}";
    let data;
    try {
      // Find JSON block if model returned extra text despite instruction
      const jsonStart = text.indexOf('{');
      const jsonEnd = text.lastIndexOf('}');
      if (jsonStart !== -1 && jsonEnd !== -1) {
        data = JSON.parse(text.substring(jsonStart, jsonEnd + 1));
      } else {
        data = JSON.parse(text);
      }
    } catch (e) {
      console.warn("Grounding JSON parse failed, using defaults", e);
      data = { multiplier: 1.0, reasoning: "External research data parsing failed." };
    }
    
    // Extract grounding sources as required by guidelines
    const sources: { title: string; uri: string }[] = [];
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    if (chunks) {
      chunks.forEach((chunk: any) => {
        if (chunk.web) {
          sources.push({ title: chunk.web.title, uri: chunk.web.uri });
        }
      });
    }

    return {
      multiplier: typeof data.multiplier === 'number' ? data.multiplier : 1.0,
      reasoning: data.reasoning || "No specific trends identified.",
      sources: sources.slice(0, 5) // Limit to top 5 sources
    };
  } catch (error) {
    console.error("Market Trend Adjustment Error:", error);
    return { multiplier: 1.0, reasoning: "External research unavailable.", sources: [] };
  }
};
