'use server';

import { categorizeCall } from '@/ai/flows/categorize-call';

export async function getCategoryForNotes(notes: string): Promise<{ category?: string; error?: string }> {
  if (!notes || notes.trim().length < 10) {
    return { error: 'Please provide more detailed notes for accurate categorization.' };
  }
  try {
    const result = await categorizeCall({ notes });
    return { category: result.category };
  } catch (error) {
    console.error('AI categorization failed:', error);
    return { error: 'Failed to categorize call due to a server error.' };
  }
}
