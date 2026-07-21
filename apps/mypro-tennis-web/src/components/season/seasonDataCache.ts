import { api } from "../../api";
import type { SeasonData } from "./types";

const SEASON_CACHE_MAX_AGE_MS = 30_000;

let cachedSeason: { playerId: string; data: SeasonData; cachedAt: number } | null = null;
let pendingSeasonRequest: Promise<SeasonData> | null = null;

export function peekSeasonData(playerId?: string | null) {
  return playerId && cachedSeason?.playerId === playerId ? cachedSeason.data : null;
}

export function primeSeasonDataCache(data: SeasonData) {
  cachedSeason = { playerId: data.player.id, data, cachedAt: Date.now() };
  return data;
}

export function invalidateSeasonDataCache() {
  cachedSeason = null;
}

export function requestSeasonData(force = false) {
  if (!force && cachedSeason && Date.now() - cachedSeason.cachedAt < SEASON_CACHE_MAX_AGE_MS) {
    return Promise.resolve(cachedSeason.data);
  }
  if (!pendingSeasonRequest) {
    pendingSeasonRequest = api<SeasonData>("/season")
      .then(primeSeasonDataCache)
      .finally(() => {
        pendingSeasonRequest = null;
      });
  }
  return pendingSeasonRequest;
}
