const SESSION_PREFIX = "10tg-game-session-v1:";

type SessionEnvelope = {
  version: 1;
  value: unknown;
};

function canUseSessionStorage() {
  return typeof window !== "undefined" && typeof window.sessionStorage !== "undefined";
}

export function readGameSession<T>(gameKey: string, validate: (value: unknown) => value is T): T | null {
  if (!canUseSessionStorage()) return null;
  try {
    const raw = window.sessionStorage.getItem(`${SESSION_PREFIX}${gameKey}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SessionEnvelope>;
    return parsed.version === 1 && validate(parsed.value) ? parsed.value : null;
  } catch {
    return null;
  }
}

export function writeGameSession(gameKey: string, value: unknown) {
  if (!canUseSessionStorage()) return;
  try {
    const envelope: SessionEnvelope = { version: 1, value };
    window.sessionStorage.setItem(`${SESSION_PREFIX}${gameKey}`, JSON.stringify(envelope));
  } catch {
    // A full or disabled session store must never prevent a game from running.
  }
}
