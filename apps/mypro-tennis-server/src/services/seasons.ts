export const SEASON_DURATION_DAYS = 30;
export const DAY_MS = 24 * 60 * 60 * 1000;
export const SEASON_DURATION_MS = SEASON_DURATION_DAYS * DAY_MS;

const DEFAULT_GLOBAL_SEASON_START_AT = "2026-06-30T22:00:00.000Z";

export function globalSeasonStartAt() {
  const configured = process.env.MYPRO_SEASON_START_AT ?? DEFAULT_GLOBAL_SEASON_START_AT;
  const timestamp = Date.parse(configured);
  if (Number.isNaN(timestamp)) return new Date(DEFAULT_GLOBAL_SEASON_START_AT);
  return new Date(timestamp);
}

export function seasonWindow(now = new Date(), startsFrom = globalSeasonStartAt()) {
  const elapsedFromEpoch = now.getTime() - startsFrom.getTime();
  const index = Math.max(0, Math.floor(elapsedFromEpoch / SEASON_DURATION_MS));
  const startsAt = new Date(startsFrom.getTime() + index * SEASON_DURATION_MS);
  const endsAt = new Date(startsAt.getTime() + SEASON_DURATION_MS);
  const elapsed = Math.max(0, now.getTime() - startsAt.getTime());
  const day = Math.min(SEASON_DURATION_DAYS, Math.floor(elapsed / DAY_MS) + 1);
  const week = Math.min(Math.ceil(SEASON_DURATION_DAYS / 7), Math.floor(elapsed / (7 * DAY_MS)) + 1);

  return {
    index,
    key: `saison-${index + 1}`,
    startsAt,
    endsAt,
    day,
    week,
    remainingDays: Math.max(0, Math.ceil((endsAt.getTime() - now.getTime()) / DAY_MS)),
    progress: Math.max(0, Math.min(100, Math.round((elapsed / SEASON_DURATION_MS) * 100)))
  };
}
