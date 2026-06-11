type TrackingChallenge = {
  answer: number;
  expiresAt: number;
};

const CHALLENGE_TTL_MS = 5 * 60_000;
const challenges = new Map<string, TrackingChallenge>();

function pruneExpiredChallenges(now = Date.now()) {
  for (const [id, challenge] of challenges) {
    if (challenge.expiresAt <= now) {
      challenges.delete(id);
    }
  }
}

export function createPublicTrackingChallenge() {
  pruneExpiredChallenges();

  const left = Math.floor(Math.random() * 7) + 2;
  const right = Math.floor(Math.random() * 7) + 2;
  const id = crypto.randomUUID();
  const expiresAt = Date.now() + CHALLENGE_TTL_MS;

  challenges.set(id, {
    answer: left + right,
    expiresAt,
  });

  return {
    id,
    prompt: `${left} + ${right}`,
    expiresAt,
  };
}

export function verifyPublicTrackingChallenge(id: string, answer: number) {
  pruneExpiredChallenges();

  const challenge = challenges.get(id);
  if (!challenge) {
    return false;
  }

  challenges.delete(id);

  if (Date.now() > challenge.expiresAt) {
    return false;
  }

  return challenge.answer === answer;
}