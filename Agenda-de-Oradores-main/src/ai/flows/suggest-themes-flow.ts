'use server';
/**
 * @fileOverview Fluxo para sugestão inteligente de temas de discursos públicos com base em necessidades locais.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const SuggestThemesInputSchema = z.object({
  congregationName: z.string(),
  localNeed: z.string().optional().describe('Uma necessidade específica da congregação correspondente às categorias oficiais ou "aleatório".'),
  historyData: z.array(z.object({
    id: z.number(),
    title: z.string(),
    lastUsed: z.string().nullable(),
    totalUses: z.number(),
  })).describe('Lista de temas com histórico de uso na congregação.'),
});

export type SuggestThemesInput = z.infer<typeof SuggestThemesInputSchema>;

const SuggestThemesOutputSchema = z.object({
  suggestions: z.array(z.object({
    id: z.number(),
    title: z.string(),
    reason: z.string().describe('Explicação curta de por que este tema foi sugerido.'),
  })).min(1).max(5),
  generalAdvice: z.string().describe('Um conselho geral sobre a variedade do alimento espiritual na congregação.'),
});

export type SuggestThemesOutput = z.infer<typeof SuggestThemesOutputSchema>;

export async function suggestThemes(input: SuggestThemesInput): Promise<SuggestThemesOutput> {
  return suggestThemesFlow(input);
}

const prompt = ai.definePrompt({
  name: 'suggestThemesPrompt',
  input: { schema: SuggestThemesInputSchema },
  output: { schema: SuggestThemesOutputSchema },
  prompt: `Você é um assistente especializado na organização de reuniões das Testemunhas de Jeová.
Sua tarefa é ajudar o coordenador da congregação "{{{congregationName}}}" a escolher temas para os próximos discursos públicos.

Contexto de Necessidade Local:
{{#if localNeed}}
O coordenador indicou que a congregação tem uma necessidade específica focada em: **{{{localNeed}}}**. 
Seu objetivo é sugerir temas que se encaixem EXATAMENTE nesta categoria e que NÃO tenham sido usados recentemente.
{{else}}
Não há necessidade específica definida. Foque na variedade geral, priorizando temas nunca usados ou muito antigos.
{{/if}}

Contexto Histórico:
- O objetivo principal é garantir variedade no alimento espiritual.
- Priorize temas que NUNCA foram usados ou que não são proferidos há muito tempo (mais de 6 meses).

Histórico de Temas (Candidatos):
{{#each historyData}}
- Tema #{{id}}: {{title}} (Usado {{totalUses}} vezes, Última vez: {{#if lastUsed}}{{lastUsed}}{{else}}Nunca{{/if}})
{{/each}}

Com base nesses dados e na necessidade indicada, sugira de 3 a 5 temas apropriados e dê um conselho geral curto para a congregação.`,
});

const suggestThemesFlow = ai.defineFlow(
  {
    name: 'suggestThemesFlow',
    inputSchema: SuggestThemesInputSchema,
    outputSchema: SuggestThemesOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);
