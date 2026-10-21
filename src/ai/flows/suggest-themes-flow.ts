import { GoogleGenAI, Type } from "@google/genai";

export interface SuggestThemesInput {
  congregationName: string;
  localNeed?: string;
  historyData: {
    id: number;
    title: string;
    lastUsed: string | null;
    totalUses: number;
  }[];
}

export interface SuggestThemesOutput {
  suggestions: {
    id: number;
    title: string;
    reason: string;
  }[];
  generalAdvice: string;
}

export async function suggestThemes(input: SuggestThemesInput): Promise<SuggestThemesOutput> {
  // @ts-ignore
  const apiKey = (typeof process !== "undefined" && process.env?.GEMINI_API_KEY) || import.meta.env?.VITE_GEMINI_API_KEY || "";
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not defined");
  }

  const ai = new GoogleGenAI({ apiKey });

  const promptText = `Você é um assistente especializado na organização de reuniões das Testemunhas de Jeová.
Sua tarefa é ajudar o coordenador da congregação "${input.congregationName}" a escolher temas para os próximos discursos públicos.

Contexto de Necessidade Local:
${input.localNeed ? `O coordenador indicou que a congregação tem uma necessidade específica focada em: **${input.localNeed}**. Seu objetivo é sugerir temas que se encaixem EXATAMENTE nesta categoria e que NÃO tenham sido usados recentemente.` : "Não há necessidade específica definida. Foque na variedade geral, priorizando temas nunca usados ou muito antigos."}

Contexto Histórico:
- O objetivo principal é garantir variedade no alimento espiritual.
- Priorize temas que NUNCA foram usados ou que não são proferidos há muito tempo (mais de 6 meses).

Histórico de Temas (Candidatos):
${input.historyData.map(t => `- Tema #${t.id}: ${t.title} (Usado ${t.totalUses} vezes, Última vez: ${t.lastUsed ? t.lastUsed : "Nunca"})`).join('\n')}

Com base nesses dados e na necessidade indicada, sugira de 3 a 5 temas apropriados do histórico de temas acima (com o ID e o título exato) e dê um conselho geral curto para a congregação.`;

  const response = await ai.models.generateContent({
    model: "gemini-3.5-flash",
    contents: promptText,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          suggestions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.INTEGER },
                title: { type: Type.STRING },
                reason: { type: Type.STRING },
              },
              required: ["id", "title", "reason"],
            },
          },
          generalAdvice: { type: Type.STRING },
        },
        required: ["suggestions", "generalAdvice"],
      },
    },
  });

  const text = response.text;
  if (!text) {
    throw new Error("No response from Gemini");
  }

  return JSON.parse(text) as SuggestThemesOutput;
}
