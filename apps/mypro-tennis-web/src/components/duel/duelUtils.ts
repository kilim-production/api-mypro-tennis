import type { Player } from "../../store";

export const duelStatKeys = [
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

export type DuelStatKey = (typeof duelStatKeys)[number];

export const duelStatLabels: Record<DuelStatKey, string> = {
  service: "Service",
  return: "Retour",
  forehand: "Coup droit",
  backhand: "Revers",
  volley: "Volée",
  smash: "Smash",
  dropShot: "Amortie",
  stamina: "Endurance",
  speed: "Vitesse",
  explosiveness: "Explosivité",
  strength: "Force",
  recovery: "Récupération"
};

export const duelComparisonKeys: DuelStatKey[] = [
  "service",
  "return",
  "forehand",
  "stamina",
  "speed",
  "strength"
];

export function duelStat(player: Player, key: DuelStatKey) {
  return Math.round(player.stats[key] ?? 0);
}

export function duelTopStats(player: Player, count = 3) {
  return duelStatKeys
    .map((key) => ({ key, value: duelStat(player, key) }))
    .sort((left, right) => right.value - left.value)
    .slice(0, count);
}

export function duelPlayerStyle(player: Player) {
  const archetype = player.archetype?.trim();
  if (archetype && !["default", "polyvalent", "all_rounder"].includes(archetype.toLowerCase())) {
    return archetype.replaceAll("_", " ");
  }

  const serviceAttack = duelStat(player, "service") + duelStat(player, "volley");
  const baseline =
    duelStat(player, "return") + duelStat(player, "backhand") + duelStat(player, "stamina");
  const movement = duelStat(player, "speed") + duelStat(player, "forehand");

  if (serviceAttack >= Math.max(baseline * 0.68, movement + 8)) return "Attaquant";
  if (baseline >= Math.max(serviceAttack * 1.42, movement * 1.42)) return "Joueur de fond";
  return "Polyvalent";
}

export function duelDifficulty(player: Player, opponent: Player) {
  const difference = player.overall - opponent.overall;
  if (difference >= 6) return { label: "Match favorable", tone: "favorable" as const };
  if (difference <= -6) return { label: "Match difficile", tone: "difficult" as const };
  return { label: "Match équilibré", tone: "balanced" as const };
}

export function duelTacticalRead(player: Player, opponent: Player) {
  const comparisons = duelComparisonKeys.map((key) => ({
    key,
    playerValue: duelStat(player, key),
    opponentValue: duelStat(opponent, key),
    difference: duelStat(player, key) - duelStat(opponent, key)
  }));
  const advantage = [...comparisons].sort(
    (left, right) => right.difference - left.difference
  )[0]!;
  const threats = comparisons.filter((comparison) => comparison.difference < 0);
  const danger = (threats.length ? threats : comparisons).sort(
    (left, right) => right.opponentValue - left.opponentValue
  )[0]!;

  return { comparisons, advantage, danger };
}

export function duelEnergyPercent(player: Player) {
  if (player.actionEnergyMax <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((player.actionEnergy / player.actionEnergyMax) * 100)));
}

export function formatDuelCredits(value: number) {
  return `${new Intl.NumberFormat("fr-FR").format(Math.max(0, Math.round(value)))} CR`;
}
