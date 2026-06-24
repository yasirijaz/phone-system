/** Comfortable ring volume when the agent is available. */
export const IDLE_INCOMING_RING_VOLUME = 0.4;

/** Barely audible when the agent is already on another call. */
export const IN_CALL_INCOMING_RING_VOLUME = 0.08;

const RING_SOUND_URL = '/sounds/reservation.mp3';

export function isAgentOnCallState(options: {
  hasActiveReservation?: boolean;
  userInCall?: boolean;
  connectionStatus?: string | null;
}): boolean {
  if (options.hasActiveReservation || options.userInCall) {
    return true;
  }

  const status = String(options.connectionStatus ?? '').toLowerCase();
  return Boolean(status) && !['pending', 'ringing', 'closed', ''].includes(status);
}

export function incomingRingVolume(isOnCall: boolean): number {
  return isOnCall ? IN_CALL_INCOMING_RING_VOLUME : IDLE_INCOMING_RING_VOLUME;
}

export function createIncomingRingAudio(): HTMLAudioElement {
  const audio = new Audio(RING_SOUND_URL);
  audio.loop = true;
  audio.preload = 'auto';
  return audio;
}

export async function playIncomingRing(
  audio: HTMLAudioElement,
  isOnCall: boolean
): Promise<void> {
  audio.volume = incomingRingVolume(isOnCall);
  audio.loop = true;

  if (!audio.paused) {
    audio.pause();
    audio.currentTime = 0;
  }

  try {
    await audio.play();
  } catch (error) {
    console.warn('Could not play incoming ring:', error);
  }
}

export function stopIncomingRing(audio: HTMLAudioElement | null | undefined): void {
  if (!audio) return;
  audio.pause();
  audio.currentTime = 0;
}
