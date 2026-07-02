import { fftRankIndex } from "@mypro/sports-tennis";

function seededHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function orderPlayersForSingles<
  T extends { id: string; fftRanking: string; overall: number; budget: number }
>(players: T[], seed: string) {
  return [...players].sort((left, right) => {
    const rankingDelta = fftRankIndex(right.fftRanking) - fftRankIndex(left.fftRanking);
    if (rankingDelta !== 0) return rankingDelta;

    const levelDelta = right.overall - left.overall;
    if (levelDelta !== 0) return levelDelta;

    const budgetDelta = right.budget - left.budget;
    if (budgetDelta !== 0) return budgetDelta;

    return seededHash(`${seed}-${right.id}`) - seededHash(`${seed}-${left.id}`);
  });
}
