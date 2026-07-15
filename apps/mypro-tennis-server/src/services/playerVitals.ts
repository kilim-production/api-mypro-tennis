type PlayerVitalSource = {
  energy: number;
  fatigue: number;
  health: number;
  morale: number;
};

export const PLAYER_VITAL_DEFAULTS = {
  energy: 82,
  fatigue: 12,
  health: 95,
  morale: 70
} as const;

export function clampVital(value: number) {
  return Math.max(0, Math.min(100, value));
}

function normalizeVital(value: number, fallback: number) {
  return Number.isFinite(value) && value >= 0 && value <= 100 ? value : fallback;
}

export function normalizedPlayerVitals(player: PlayerVitalSource) {
  return {
    energy: normalizeVital(player.energy, PLAYER_VITAL_DEFAULTS.energy),
    fatigue: normalizeVital(player.fatigue, PLAYER_VITAL_DEFAULTS.fatigue),
    health: normalizeVital(player.health, PLAYER_VITAL_DEFAULTS.health),
    morale: normalizeVital(player.morale, PLAYER_VITAL_DEFAULTS.morale)
  };
}

export function playerVitalsAfterMatch(player: PlayerVitalSource, won: boolean) {
  const current = normalizedPlayerVitals(player);
  return {
    energy: clampVital(current.energy - (won ? 10 : 11)),
    fatigue: clampVital(current.fatigue + (won ? 8 : 9))
  };
}

export function playerVitalsAfterTraining(player: PlayerVitalSource, fatigueCost: number) {
  const current = normalizedPlayerVitals(player);
  return {
    energy: clampVital(current.energy - Math.round(fatigueCost * 0.6)),
    fatigue: clampVital(current.fatigue + fatigueCost),
    morale: clampVital(current.morale + 1)
  };
}
