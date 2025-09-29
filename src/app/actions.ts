'use server';

import { categorizeCall } from '@/ai/flows/categorize-call';
import { transcribeAudio } from '@/ai/flows/transcribe-audio';

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

export async function getTranscriptionForAudio(audioUrl: string, callLogId: number): Promise<{ transcription?: string; error?: string }> {
  if (!audioUrl) {
    return { error: 'Audio URL is missing.' };
  }
  try {
    const fullUrl = `${process.env.NEXT_PUBLIC_API_URL}/api/twilio/recordings/stream?url=${encodeURIComponent(audioUrl)}`;
    const result = await transcribeAudio({ audioUrl: fullUrl });
    
    // Here you would typically save the transcription to your database
    // For now, we just return it.
    console.log(`Transcription for call ${callLogId}:`, result.transcription);

    return { transcription: result.transcription };
  } catch (error) {
    console.error('AI transcription failed:', error);
    return { error: 'Failed to transcribe audio due to a server error.' };
  }
}
