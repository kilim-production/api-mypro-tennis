export type StatBlock = Record<string, number>;

export type AthleteVitals = {
  energy: number;
  morale: number;
  fatigue: number;
  health: number;
  reputation: number;
  budget: number;
  rankingPoints: number;
  worldRank: number;
};

export const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));
export const ACTION_ENERGY_MAX = 10;
export const ACTION_ENERGY_RECHARGE_MINUTES = 30;

export const OVERALL_STAT_KEYS = [
  "service",
  "return",
  "forehand",
  "backhand",
  "volley",
  "smash",
  "dropShot",
  "stamina",
  "speed",
  "explosiveness",
  "strength",
  "recovery"
] as const;

export function calculateOverall(stats: StatBlock): number {
  const total = OVERALL_STAT_KEYS.reduce((sum, key) => {
    const value = stats[key];
    return sum + (typeof value === "number" && Number.isFinite(value) ? clamp(value, 0, 100) : 0);
  }, 0);
  return Math.round(total / OVERALL_STAT_KEYS.length);
}

export function trainingGain(
  baseGain: number,
  primaryBonus: number,
  secondaryBonus: number,
  fatigue: number
) {
  const fatiguePenalty = fatigue > 65 ? 0.65 : fatigue > 40 ? 0.85 : 1;
  return Number((baseGain * (1 + primaryBonus + secondaryBonus) * fatiguePenalty).toFixed(2));
}

export function recoverVitals(
  vitals: Pick<AthleteVitals, "energy" | "fatigue" | "health" | "morale">,
  hours: number
) {
  return {
    energy: clamp(vitals.energy + hours * 4),
    fatigue: clamp(vitals.fatigue - hours * 3),
    health: clamp(vitals.health + hours * 1.5),
    morale: clamp(vitals.morale + hours * 0.8)
  };
}

export function rankingDelta(winnerRank: number, loserRank: number, categoryMultiplier = 1) {
  const upsetBonus = Math.max(0, winnerRank - loserRank) * 0.08;
  return Math.round((22 + upsetBonus) * categoryMultiplier);
}

export function getActionEnergySnapshot(
  actionEnergy: number,
  updatedAtInput: Date | string,
  nowInput: Date | string = new Date(),
  rechargeMinutes = ACTION_ENERGY_RECHARGE_MINUTES
) {
  const updatedAt = new Date(updatedAtInput);
  const now = new Date(nowInput);
  const rechargeMs = Math.max(1, rechargeMinutes) * 60_000;
  const elapsedSlots = Math.max(
    0,
    Math.floor((now.getTime() - updatedAt.getTime()) / rechargeMs)
  );
  const value = Math.min(ACTION_ENERGY_MAX, actionEnergy + elapsedSlots);
  const normalizedUpdatedAt =
    elapsedSlots > 0
      ? new Date(updatedAt.getTime() + elapsedSlots * rechargeMs)
      : updatedAt;
  const nextRechargeAt =
    value >= ACTION_ENERGY_MAX
      ? null
      : new Date(normalizedUpdatedAt.getTime() + rechargeMs);
  return { value, updatedAt: normalizedUpdatedAt, max: ACTION_ENERGY_MAX, nextRechargeAt, rechargeMinutes };
}

export function spendActionEnergy(
  actionEnergy: number,
  updatedAtInput: Date | string,
  nowInput: Date | string = new Date(),
  amount = 1,
  rechargeMinutes = ACTION_ENERGY_RECHARGE_MINUTES
) {
  const snapshot = getActionEnergySnapshot(actionEnergy, updatedAtInput, nowInput, rechargeMinutes);
  if (snapshot.value < amount) return { ...snapshot, spent: false, remaining: snapshot.value };
  return { ...snapshot, spent: true, remaining: snapshot.value - amount };
}

export function scaleDevelopmentCost(baseCost: number, powerLevel: number, rate = 1.34) {
  return Math.round(baseCost * Math.pow(rate, Math.max(0, powerLevel - 1)));
}

export function scaleDevelopmentMinutes(baseMinutes: number, powerLevel: number, rate = 1.26) {
  return Math.max(1, Math.round(baseMinutes * Math.pow(rate, Math.max(0, powerLevel - 1))));
}

export function trainingPowerLevel(overall: number) {
  return Math.max(1, Math.floor(overall / 8));
}

export const TRAINING_CARD_BASE_THRESHOLD = 4;
export const TRAINING_CARD_GROWTH = 1.72;
export const TRAINING_CARD_UNLOCK_COST_GROWTH = 2.15;

export function trainingCardThreshold(level: number) {
  return Math.max(
    1,
    Math.round(TRAINING_CARD_BASE_THRESHOLD * Math.pow(TRAINING_CARD_GROWTH, Math.max(0, level)))
  );
}

export function trainingCardCopiesForLevel(level: number) {
  let total = 0;
  for (let current = 0; current < Math.max(0, level); current += 1) {
    total += trainingCardThreshold(current);
  }
  return total;
}

export function trainingCardLevelForCopies(copies: number) {
  let level = 0;
  while (copies >= trainingCardCopiesForLevel(level + 1)) {
    level += 1;
  }
  return level;
}

export function trainingCardProgress(copies: number) {
  const level = trainingCardLevelForCopies(copies);
  const currentFloor = trainingCardCopiesForLevel(level);
  const nextFloor = trainingCardCopiesForLevel(level + 1);
  return {
    level,
    copies,
    currentFloor,
    nextFloor,
    copiesIntoLevel: copies - currentFloor,
    copiesNeeded: nextFloor - currentFloor,
    remaining: Math.max(0, nextFloor - copies)
  };
}

export function trainingCardUnlockCost(levelToUnlock: number) {
  return Math.ceil(Math.pow(TRAINING_CARD_UNLOCK_COST_GROWTH, Math.max(0, levelToUnlock - 1)));
}

export const PLAYER_MAX_LEVEL = 100;

export function playerXpForNextLevel(level: number) {
  const safeLevel = Math.max(0, Math.min(PLAYER_MAX_LEVEL - 1, Math.floor(level)));
  return Math.round(100 + safeLevel * 45 + safeLevel * safeLevel * 6);
}

export function playerTotalXpForLevel(level: number) {
  const safeLevel = Math.max(0, Math.min(PLAYER_MAX_LEVEL, Math.floor(level)));
  let total = 0;
  for (let current = 0; current < safeLevel; current += 1) {
    total += playerXpForNextLevel(current);
  }
  return total;
}

export function playerLevelFromXp(xp: number) {
  const safeXp = Math.max(0, Math.floor(xp));
  let level = 0;
  while (level < PLAYER_MAX_LEVEL && safeXp >= playerTotalXpForLevel(level + 1)) {
    level += 1;
  }
  return level;
}

export function playerLevelProgress(xp: number) {
  const level = playerLevelFromXp(xp);
  const currentFloor = playerTotalXpForLevel(level);
  const nextFloor =
    level >= PLAYER_MAX_LEVEL ? currentFloor : playerTotalXpForLevel(level + 1);
  return {
    level,
    xp: Math.max(0, Math.floor(xp)),
    currentFloor,
    nextFloor,
    xpIntoLevel: Math.max(0, Math.floor(xp) - currentFloor),
    xpNeeded: Math.max(0, nextFloor - currentFloor),
    remaining: Math.max(0, nextFloor - Math.max(0, Math.floor(xp))),
    maxLevel: PLAYER_MAX_LEVEL
  };
}
