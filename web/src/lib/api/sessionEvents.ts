/**
 * Browser-wide session signals: an expired session (any 401 from the dashboard/account APIs)
 * and sign-out in another tab both send the user back to the sign-in page with a clear notice.
 */
export type SessionEndReason = 'expired' | 'signed_out';

const EVENT_NAME = 'ordium:session-ended';
const CHANNEL_NAME = 'ordium-auth';
let lastNotified = 0;

function channel(): BroadcastChannel | null {
  try {
    return typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(CHANNEL_NAME) : null;
  } catch {
    return null;
  }
}

/** Called by API clients when the server rejects the session cookie. */
export function notifySessionExpired(): void {
  const now = Date.now();
  if (now - lastNotified < 2000) return; // many parallel requests fail at once
  lastNotified = now;
  window.dispatchEvent(new CustomEvent<SessionEndReason>(EVENT_NAME, { detail: 'expired' }));
}

/** Called after a deliberate sign-out so other open tabs leave the dashboard too. */
export function broadcastSignOut(): void {
  const ch = channel();
  ch?.postMessage('signed_out');
  ch?.close();
}

export function onSessionEnded(handler: (reason: SessionEndReason) => void): () => void {
  const local = (event: Event) => handler((event as CustomEvent<SessionEndReason>).detail);
  window.addEventListener(EVENT_NAME, local);
  const ch = channel();
  if (ch) ch.onmessage = message => { if (message.data === 'signed_out') handler('signed_out'); };
  return () => {
    window.removeEventListener(EVENT_NAME, local);
    ch?.close();
  };
}
