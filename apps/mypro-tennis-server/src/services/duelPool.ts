export const DUEL_POOL_SIZE = 3;
export const DUEL_OVERALL_DELTA = 5;

export type DuelOverallRange = {
  min: number;
  max: number;
  delta: number;
};

export type DuelCandidateHistory = {
  count: number;
  lastPlayedAt: Date | null;
};

export type DuelPoolCandidate = {
  id: string;
  isAi: boolean;
};

export function duelOverallRange(overall: number): DuelOverallRange {
  const safeOverall = Math.max(0, Math.min(100, Math.round(Number(overall) || 0)));
  return {
    min: Math.max(0, safeOverall - DUEL_OVERALL_DELTA),
    max: Math.min(100, safeOverall + DUEL_OVERALL_DELTA),
    delta: DUEL_OVERALL_DELTA
  };
}

export function isWithinDuelOverallRange(playerOverall: number, opponentOverall: number) {
  const range = duelOverallRange(playerOverall);
  return opponentOverall >= range.min && opponentOverall <= range.max;
}

function stableRatio(seed: string) {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
}

export function orderDuelPoolCandidates<T extends DuelPoolCandidate>(
  candidates: readonly T[],
  history: ReadonlyMap<string, DuelCandidateHistory>,
  seed: string
) {
  return [...candidates].sort((left, right) => {
    if (left.isAi !== right.isAi) return left.isAi ? 1 : -1;

    const leftHistory = history.get(left.id) ?? { count: 0, lastPlayedAt: null };
    const rightHistory = history.get(right.id) ?? { count: 0, lastPlayedAt: null };
    if (leftHistory.count !== rightHistory.count) return leftHistory.count - rightHistory.count;

    const leftPlayedAt = leftHistory.lastPlayedAt?.getTime() ?? 0;
    const rightPlayedAt = rightHistory.lastPlayedAt?.getTime() ?? 0;
    if (leftPlayedAt !== rightPlayedAt) return leftPlayedAt - rightPlayedAt;

    return stableRatio(`${seed}-${right.id}`) - stableRatio(`${seed}-${left.id}`);
  });
}

export function duelPoolSlotIsValid(params: {
  playerOverall: number;
  opponentOverall: number;
  dailyLimitReached: boolean;
  playedSinceAssigned: boolean;
}) {
  return (
    isWithinDuelOverallRange(params.playerOverall, params.opponentOverall) &&
    !params.dailyLimitReached &&
    !params.playedSinceAssigned
  );
}
