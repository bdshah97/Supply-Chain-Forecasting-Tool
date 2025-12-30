
import { GoogleGenAI, Type } from "@google/genai";
import { AiProvider, AudienceType, OnePagerData } from "../types";

export interface MarketAdjustment {
  multiplier: number;
  reasoning: string;
  sources: { title: string; uri: string }[];
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Robust JSON extraction helper to handle cases where models 
 * include markdown or introductory text despite instructions.
 */
const parseJsonSafely = (text: string) => {
  try {
    const jsonStart = text.indexOf('{');
    const jsonEnd = text.lastIndexOf('}');
    if (jsonStart !== -1 && jsonEnd !== -1) {
      return JSON.parse(text.substring(jsonStart, jsonEnd + 1));
    }
    return JSON.parse(text);
  } catch (e) {
    console.warn("JSON parsing failed for text:", text);
    throw e;
  }
};

const callOpenAI = async (prompt: string, contents: string, isJson: boolean = false) => {
  const apiKey = (process.env as any).OPENAI_API_KEY;
  if (!apiKey) return "OpenAI API Key not found in environment.";
  
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: "gpt-4o",
      response_format: isJson ? { type: "json_object" } : undefined,
      messages: [
        { role: "system", content: "You are a world-class supply chain analyst for SSA & Company." },
        { role: "user", content: `${prompt}\n\nContext: ${contents}` }
      ]
    })
  });
  const data = await response.json();
  return data.choices?.[0]?.message?.content || "OpenAI Response Failed";
};

const callClaude = async (prompt: string, contents: string, isJson: boolean = false) => {
  const apiKey = (process.env as any).ANTHROPIC_API_KEY;
  if (!apiKey) return "Claude API Key not found in environment.";
  
  const jsonInstruction = isJson ? " Respond ONLY with a raw JSON object. Do not include markdown or explanations." : "";

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: "claude-3-5-sonnet-20240620",
      max_tokens: 2048,
      messages: [{ role: "user", content: `${prompt}${jsonInstruction}\n\nContext: ${contents}` }]
    })
  });
  const data = await response.json();
  return data.content?.[0]?.text || "Claude Response Failed";
};

export const getIndustryInsights = async (provider: AiProvider, prompt: string, statsSummary: string) => {
  try {
    const instruction = `Provide exactly 3 concise sentences of strategic insight for this business: "${prompt}". 
    Data Summary: ${statsSummary}.
    Requirement: 
    1. Sentence 1: Key market factor. 
    2. Sentence 2: Recommended action. 
    3. Sentence 3: Primary risk.
    Format as a single paragraph. Do not use lists or bullets.`;
    
    if (provider === AiProvider.OPENAI) return await callOpenAI(instruction, "");
    if (provider === AiProvider.CLAUDE) return await callClaude(instruction, "");
    
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: instruction,
      config: { 
        temperature: 0.7,
        thinkingConfig: { thinkingBudget: 0 } 
      }
    });
    return response.text;
  } catch (error) {
    console.error("AI Error:", error);
    return "Strategic insights currently unavailable.";
  }
};

export const getAnomalyAnalysis = async (provider: AiProvider, industry: string, outliers: any[]) => {
  try {
    const instruction = `Analyze these supply chain anomalies for a business in the ${industry} sector:
    Anomalies: ${JSON.stringify(outliers)}.
    Provide a professional explanation of potential external root causes (e.g., port congestion, promotional spikes, supply shocks) specific to this industry. 
    Keep it to two paragraphs of dense expert analysis.`;

    if (provider === AiProvider.OPENAI) return await callOpenAI(instruction, "");
    if (provider === AiProvider.CLAUDE) return await callClaude(instruction, "");

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: instruction,
      config: { temperature: 0.7 }
    });
    return response.text;
  } catch (error) {
    return "Anomaly analysis could not be completed.";
  }
};

export const getNarrativeSummary = async (
  provider: AiProvider, 
  prompt: string, 
  historicalAvg: number, 
  forecastAvg: number, 
  horizon: number, 
  audience: AudienceType,
  skus: string[]
) => {
  try {
    const trend = forecastAvg > historicalAvg ? "upward" : "downward";
    const diff = Math.abs(((forecastAvg - historicalAvg) / (historicalAvg || 1)) * 100).toFixed(1);
    
    const audienceGuidance: Record<AudienceType, string> = {
      [AudienceType.PLANT_MANAGER]: "Focus on production capacity and labor.",
      [AudienceType.DEMAND_PLANNER]: "Focus on statistical bias and safety stock.",
      [AudienceType.SALES]: "Focus on service levels and order fulfillment.",
      [AudienceType.EXECUTIVE]: "Focus on P&L impact and working capital."
    };

    const isNonExec = audience !== AudienceType.EXECUTIVE;
    const skuPrompt = isNonExec 
      ? `You MUST include a mention of 2 specific SKUs from this list [${skus.slice(0, 5).join(', ')}] as high-priority items to monitor.`
      : "Focus on strategic corporate impact.";

    const instruction = `Write a professional 3-sentence narrative for a ${audience} regarding: "${prompt}".
      Trend: ${trend} by ${diff}% over ${horizon} months.
      Audience Focus: ${audienceGuidance[audience]}.
      ${skuPrompt}
      
      Constraint: Exactly 3 sentences. Single paragraph. No introductory filler.`;

    if (provider === AiProvider.OPENAI) return await callOpenAI(instruction, "");
    if (provider === AiProvider.CLAUDE) return await callClaude(instruction, "");

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: instruction,
      config: { 
        temperature: 0.8,
        thinkingConfig: { thinkingBudget: 0 }
      }
    });
    return response.text;
  } catch (error) {
    return "Business narrative generation failed.";
  }
};

export const getMarketTrendAdjustment = async (provider: AiProvider, prompt: string): Promise<MarketAdjustment> => {
  try {
    if (provider === AiProvider.GEMINI) {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Research current market trends for: "${prompt}". Return JSON with: multiplier (number), reasoning (string).`,
        config: {
          tools: [{ googleSearch: {} }],
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              multiplier: { type: Type.NUMBER },
              reasoning: { type: Type.STRING }
            },
            required: ["multiplier", "reasoning"]
          }
        }
      });

      const text = response.text?.trim() || "{}";
      let data: any = { multiplier: 1.0, reasoning: "Research synthesis in progress." };
      try {
        data = parseJsonSafely(text);
      } catch (e) {
        console.warn("Grounding JSON parse failed, defaulting to 1.0", e);
      }
      
      const sources: { title: string; uri: string }[] = [];
      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
      if (chunks) {
        chunks.forEach((chunk: any) => {
          if (chunk.web) sources.push({ title: chunk.web.title, uri: chunk.web.uri });
        });
      }

      return {
        multiplier: typeof data.multiplier === 'number' ? data.multiplier : 1.0,
        reasoning: data.reasoning || "Trend data parsed from research.",
        sources: sources.slice(0, 5)
      };
    }
    
    // Fallback for non-Gemini providers
    return { multiplier: 1.05, reasoning: "Standard growth adjustment applied (Non-search provider).", sources: [] };
  } catch (error) {
    return { multiplier: 1.0, reasoning: "Adjustment error.", sources: [] };
  }
};

export const getChatResponse = async (
  provider: AiProvider,
  history: ChatMessage[],
  context: string,
  userMessage: string,
  audience: AudienceType
) => {
  try {
    const systemInstruction = `You are an expert supply chain AI assistant for SSA & Company. 
    Audience Persona: ${audience}.
    Context Data: ${context}.
    Instruction: Answer accurately based on dashboard data. Concise, data-driven.`;

    if (provider === AiProvider.GEMINI) {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const contents = [
        ...history.map(msg => ({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }]
        })),
        { role: 'user', parts: [{ text: userMessage }] }
      ];

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents,
        config: { 
          systemInstruction: systemInstruction,
          temperature: 0.7, 
          thinkingConfig: { thinkingBudget: 0 } 
        }
      });
      return response.text;
    }

    if (provider === AiProvider.OPENAI) return await callOpenAI(systemInstruction, userMessage);
    if (provider === AiProvider.CLAUDE) return await callClaude(systemInstruction, userMessage);

    return "Provider not supported.";
  } catch (error) {
    return "I encountered an error processing that request.";
  }
};

export const getOnePagerReport = async (
  provider: AiProvider,
  context: string,
  audience: AudienceType
): Promise<OnePagerData> => {
  const prompt = `Create a professional 1-page supply chain memo for a ${audience} persona. 
  
  CONTEXTUAL SNAPSHOT:
  ${context}

  TASK:
  Synthesize this data into a high-fidelity report. 
  1. Title must be impactful.
  2. Executive Summary should be exactly 3 sentences.
  3. KPIs must use the values from the snapshot (Revenue, Risk, etc).
  4. Strategic Risks must be specific to the context provided.
  5. Outlook must be a visionary 1-sentence statement.

  RETURN FORMAT (JSON ONLY):
  { 
    "title": "...", 
    "executiveSummary": "...", 
    "kpis": [{ "label": "...", "value": "...", "context": "..." }], 
    "strategicRisks": [{ "risk": "...", "impact": "..." }], 
    "recommendations": ["...", "...", "..."], 
    "outlook": "..." 
  }`;

  try {
    if (provider === AiProvider.GEMINI) {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              executiveSummary: { type: Type.STRING },
              kpis: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    label: { type: Type.STRING },
                    value: { type: Type.STRING },
                    context: { type: Type.STRING }
                  }
                }
              },
              strategicRisks: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    risk: { type: Type.STRING },
                    impact: { type: Type.STRING }
                  }
                }
              },
              recommendations: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              },
              outlook: { type: Type.STRING }
            }
          }
        }
      });
      
      const text = response.text?.trim() || "{}";
      return parseJsonSafely(text);
    }
    
    if (provider === AiProvider.OPENAI) {
      const text = await callOpenAI(prompt, "", true);
      return parseJsonSafely(text);
    }

    if (provider === AiProvider.CLAUDE) {
      const text = await callClaude(prompt, "", true);
      return parseJsonSafely(text);
    }

    throw new Error("Provider not supported for reports");
  } catch (e) {
    console.error("Report Generation Error:", e);
    return {
      title: "Quarterly Demand Forecast Report",
      executiveSummary: "Data synthesis failed for the selected model. Please ensure API keys are configured correctly.",
      kpis: [],
      strategicRisks: [],
      recommendations: [],
      outlook: "Forward outlook pending successful analysis."
    };
  }
};
