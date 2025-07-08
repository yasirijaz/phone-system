'use server';

/**
 * @fileOverview A call categorization AI agent.
 *
 * - categorizeCall - A function that handles the call categorization process.
 * - CategorizeCallInput - The input type for the categorizeCall function.
 * - CategorizeCallOutput - The return type for the categorizeCall function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const CategorizeCallInputSchema = z.object({
  notes: z.string().describe('The notes taken during the call.'),
});
export type CategorizeCallInput = z.infer<typeof CategorizeCallInputSchema>;

const CategorizeCallOutputSchema = z.object({
  category: z
    .string()
    .describe(
      'The category of the call (e.g., sales, support, personal).' + 
      'If none of these fit, describe a category concisely.'
    ),
});
export type CategorizeCallOutput = z.infer<typeof CategorizeCallOutputSchema>;

export async function categorizeCall(input: CategorizeCallInput): Promise<CategorizeCallOutput> {
  return categorizeCallFlow(input);
}

const prompt = ai.definePrompt({
  name: 'categorizeCallPrompt',
  input: {schema: CategorizeCallInputSchema},
  output: {schema: CategorizeCallOutputSchema},
  prompt: `You are an AI assistant specializing in call categorization.

  Based on the notes provided, determine the most appropriate category for the call.

  Notes: {{{notes}}}
  Category: `,
});

const categorizeCallFlow = ai.defineFlow(
  {
    name: 'categorizeCallFlow',
    inputSchema: CategorizeCallInputSchema,
    outputSchema: CategorizeCallOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
