import {
  fftRankingPath,
  type FftRanking,
  type TennisStats,
  type TennisStatKey
} from "@mypro/sports-tennis";

export const COACH_DECK_SIZE = 12;
export const COACH_DECK_HAND_SIZE = 4;
export const COACH_DECK_FOCUS_PER_SET = 5;
export const COACH_DECK_MAX_POINT_CHANCE_DELTA = 0.12;

export const COACH_DECK_PROFILE_STAT_KEYS = [
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
] as const satisfies readonly TennisStatKey[];

export type CoachDeckProfileStatKey = (typeof COACH_DECK_PROFILE_STAT_KEYS)[number];
export type CoachDeckProfileStats = Pick<TennisStats, CoachDeckProfileStatKey>;
export type CoachCardFamily = "BOOST" | "COUNTER" | "STATE" | "DECK";
export type CoachCardTier = "STARTER" | "ADVANCED" | "SIGNATURE";
export type CoachCardDurationUnit = "POINTS" | "GAMES" | "IMMEDIATE" | "NEXT_WINDOW";
export type CoachDeckAiTier = "BEGINNER" | "CLUB" | "COMPETITIVE" | "ELITE";
export type CoachCardMasteryVariantId = "IMPACT" | "FLOW";

export const COACH_CARD_MASTERY_LEVEL_XP = [0, 30, 90, 200] as const;

export const COACH_CARD_MASTERY_VARIANTS = [
  {
    id: "IMPACT",
    name: "Impact maximal",
    description: "Effet renforcé de 18 %, mais la carte coûte 1 Focus supplémentaire.",
    unlockMasteryLevel: 1,
    effectMultiplier: 1.18,
    focusDelta: 1
  },
  {
    id: "FLOW",
    name: "Jeu fluide",
    description: "Coût réduit de 1 Focus, avec un effet diminué de 25 %.",
    unlockMasteryLevel: 3,
    effectMultiplier: 0.75,
    focusDelta: -1
  }
] as const satisfies readonly {
  id: CoachCardMasteryVariantId;
  name: string;
  description: string;
  unlockMasteryLevel: number;
  effectMultiplier: number;
  focusDelta: number;
}[];

export function coachCardMasteryLevelForXp(masteryXp: number) {
  const xp = Math.max(0, Math.floor(masteryXp));
  let level = 0;
  for (let index = 1; index < COACH_CARD_MASTERY_LEVEL_XP.length; index += 1) {
    if (xp >= COACH_CARD_MASTERY_LEVEL_XP[index]!) level = index;
  }
  return level;
}

export function coachCardMasteryProgress(masteryXp: number) {
  const xp = Math.max(0, Math.floor(masteryXp));
  const level = coachCardMasteryLevelForXp(xp);
  const levelFloorXp = COACH_CARD_MASTERY_LEVEL_XP[level] ?? 0;
  const nextLevelXp = COACH_CARD_MASTERY_LEVEL_XP[level + 1] ?? null;
  const progress =
    nextLevelXp === null ? 1 : (xp - levelFloorXp) / Math.max(1, nextLevelXp - levelFloorXp);
  return {
    xp,
    level,
    levelFloorXp,
    nextLevelXp,
    progress: rounded(clamp(progress, 0, 1), 3),
    maxLevel: COACH_CARD_MASTERY_LEVEL_XP.length - 1
  };
}

export function coachCardMasteryVariant(variantId: string | null | undefined) {
  return COACH_CARD_MASTERY_VARIANTS.find((variant) => variant.id === variantId) ?? null;
}

export function coachCardVariantUnlocked(
  variantId: string | null | undefined,
  masteryLevel: number
) {
  if (variantId === null || variantId === undefined) return true;
  const variant = coachCardMasteryVariant(variantId);
  return Boolean(variant && masteryLevel >= variant.unlockMasteryLevel);
}

export type OpponentIntentId =
  | "ATTACK_BACKHAND"
  | "ATTACK_FOREHAND"
  | "SERVE_PRESSURE"
  | "RETURN_PRESSURE"
  | "RUSH_NET"
  | "EXTEND_RALLY"
  | "SHORTEN_RALLY"
  | "VARY_RHYTHM";

export type CoachCardEffect =
  | {
      type: "STAT_BOOST";
      boosts: Partial<Record<CoachDeckProfileStatKey, number>>;
      pointChanceModifier: number;
    }
  | {
      type: "COUNTER_INTENT";
      intentIds: readonly OpponentIntentId[];
      boosts: Partial<Record<CoachDeckProfileStatKey, number>>;
      matchedPointChanceModifier: number;
    }
  | {
      type: "MATCH_STATE";
      energyDelta?: number;
      confidenceDelta?: number;
      momentumDelta?: number;
      momentumTowardZero?: number;
      energyDrainMultiplier?: number;
      pointChanceModifier?: number;
    }
  | {
      type: "DECK_CONTROL";
      draw?: number;
      discardThenDraw?: number;
      retain?: number;
      revealIntentPrecision?: number;
      nextCardFocusDiscount?: number;
    };

export type CoachCardDefinition = {
  id: string;
  family: CoachCardFamily;
  tier: CoachCardTier;
  name: string;
  shortName: string;
  description: string;
  focusCost: 1 | 2 | 3;
  unlockLevel: number;
  copyLimit: 1 | 2;
  duration: {
    unit: CoachCardDurationUnit;
    amount: number;
  };
  primaryStats: readonly CoachDeckProfileStatKey[];
  secondaryStats: readonly CoachDeckProfileStatKey[];
  effects: readonly CoachCardEffect[];
};

export type OpponentIntentDefinition = {
  id: OpponentIntentId;
  label: string;
  description: string;
  targetStats: readonly CoachDeckProfileStatKey[];
  recommendedCardIds: readonly string[];
  durationPoints: number;
};

export const OPPONENT_INTENTS = [
  {
    id: "ATTACK_BACKHAND",
    label: "Cibler votre revers",
    description: "L’adversaire veut enfermer les prochains échanges sur votre revers.",
    targetStats: ["backhand", "speed"],
    recommendedCardIds: ["protect-backhand"],
    durationPoints: 3
  },
  {
    id: "ATTACK_FOREHAND",
    label: "Cibler votre coup droit",
    description: "L’adversaire insiste sur votre côté coup droit pour provoquer une balle courte.",
    targetStats: ["forehand", "speed"],
    recommendedCardIds: ["lock-forehand"],
    durationPoints: 3
  },
  {
    id: "SERVE_PRESSURE",
    label: "Imposer son service",
    description: "L’adversaire cherche des points courts derrière une première balle puissante.",
    targetStats: ["return", "speed"],
    recommendedCardIds: ["read-serve"],
    durationPoints: 2
  },
  {
    id: "RETURN_PRESSURE",
    label: "Attaquer votre seconde balle",
    description: "L’adversaire avance au retour et met votre engagement sous pression.",
    targetStats: ["service", "recovery"],
    recommendedCardIds: ["protect-second-serve"],
    durationPoints: 2
  },
  {
    id: "RUSH_NET",
    label: "Prendre le filet",
    description: "L’adversaire raccourcit les échanges en avançant vers le filet.",
    targetStats: ["return", "speed", "explosiveness"],
    recommendedCardIds: ["close-the-net"],
    durationPoints: 3
  },
  {
    id: "EXTEND_RALLY",
    label: "Allonger les échanges",
    description: "L’adversaire veut tester votre endurance et votre récupération.",
    targetStats: ["stamina", "recovery"],
    recommendedCardIds: ["break-the-rhythm", "second-wind"],
    durationPoints: 4
  },
  {
    id: "SHORTEN_RALLY",
    label: "Raccourcir les échanges",
    description: "L’adversaire augmente le risque pour conclure rapidement.",
    targetStats: ["speed", "explosiveness", "recovery"],
    recommendedCardIds: ["break-the-rhythm", "stay-calm"],
    durationPoints: 3
  },
  {
    id: "VARY_RHYTHM",
    label: "Casser votre rythme",
    description: "L’adversaire alterne puissance, trajectoires et amorties.",
    targetStats: ["dropShot", "speed", "recovery"],
    recommendedCardIds: ["break-the-rhythm", "read-the-game"],
    durationPoints: 4
  }
] as const satisfies readonly OpponentIntentDefinition[];

export const COACH_CARDS = [
  {
    id: "power-forehand",
    family: "BOOST",
    tier: "STARTER",
    name: "Coup droit puissant",
    shortName: "Coup droit",
    description: "Prendre l’initiative avec une frappe plus lourde côté coup droit.",
    focusCost: 2,
    unlockLevel: 0,
    copyLimit: 2,
    duration: { unit: "POINTS", amount: 3 },
    primaryStats: ["forehand", "strength"],
    secondaryStats: ["explosiveness"],
    effects: [
      {
        type: "STAT_BOOST",
        boosts: { forehand: 10, strength: 4 },
        pointChanceModifier: 0.018
      }
    ]
  },
  {
    id: "backhand-down-line",
    family: "BOOST",
    tier: "STARTER",
    name: "Revers long de ligne",
    shortName: "Revers solide",
    description: "Renforcer le revers et ouvrir le court avec une trajectoire directe.",
    focusCost: 2,
    unlockLevel: 0,
    copyLimit: 2,
    duration: { unit: "POINTS", amount: 3 },
    primaryStats: ["backhand"],
    secondaryStats: ["speed", "strength"],
    effects: [
      {
        type: "STAT_BOOST",
        boosts: { backhand: 10, speed: 3 },
        pointChanceModifier: 0.017
      }
    ]
  },
  {
    id: "power-serve",
    family: "BOOST",
    tier: "STARTER",
    name: "Service canon",
    shortName: "Service",
    description: "Augmenter la qualité de la première frappe pendant deux points de service.",
    focusCost: 2,
    unlockLevel: 0,
    copyLimit: 2,
    duration: { unit: "POINTS", amount: 2 },
    primaryStats: ["service", "strength"],
    secondaryStats: ["explosiveness"],
    effects: [
      {
        type: "STAT_BOOST",
        boosts: { service: 10, strength: 4 },
        pointChanceModifier: 0.021
      }
    ]
  },
  {
    id: "aggressive-return",
    family: "BOOST",
    tier: "STARTER",
    name: "Retour agressif",
    shortName: "Retour",
    description: "Prendre la balle tôt et neutraliser l’avantage du serveur.",
    focusCost: 2,
    unlockLevel: 0,
    copyLimit: 2,
    duration: { unit: "POINTS", amount: 2 },
    primaryStats: ["return", "speed"],
    secondaryStats: ["explosiveness"],
    effects: [
      {
        type: "STAT_BOOST",
        boosts: { return: 10, speed: 3 },
        pointChanceModifier: 0.021
      }
    ]
  },
  {
    id: "take-the-net",
    family: "BOOST",
    tier: "ADVANCED",
    name: "Prendre le filet",
    shortName: "Volée",
    description: "Avancer derrière une frappe profonde pour conclure à la volée.",
    focusCost: 2,
    unlockLevel: 4,
    copyLimit: 2,
    duration: { unit: "POINTS", amount: 3 },
    primaryStats: ["volley", "explosiveness"],
    secondaryStats: ["speed"],
    effects: [
      {
        type: "STAT_BOOST",
        boosts: { volley: 10, explosiveness: 4 },
        pointChanceModifier: 0.022
      }
    ]
  },
  {
    id: "authoritative-smash",
    family: "BOOST",
    tier: "ADVANCED",
    name: "Smash autoritaire",
    shortName: "Smash",
    description: "Punir les balles hautes avec plus de force et d’explosivité.",
    focusCost: 2,
    unlockLevel: 6,
    copyLimit: 2,
    duration: { unit: "POINTS", amount: 3 },
    primaryStats: ["smash", "strength"],
    secondaryStats: ["explosiveness"],
    effects: [
      {
        type: "STAT_BOOST",
        boosts: { smash: 10, strength: 3, explosiveness: 2 },
        pointChanceModifier: 0.02
      }
    ]
  },
  {
    id: "precise-drop-shot",
    family: "BOOST",
    tier: "ADVANCED",
    name: "Amortie précise",
    shortName: "Amortie",
    description: "Faire avancer l’adversaire avec une variation courte et maîtrisée.",
    focusCost: 2,
    unlockLevel: 8,
    copyLimit: 2,
    duration: { unit: "POINTS", amount: 3 },
    primaryStats: ["dropShot", "speed"],
    secondaryStats: ["recovery"],
    effects: [
      {
        type: "STAT_BOOST",
        boosts: { dropShot: 10, speed: 3 },
        pointChanceModifier: 0.018
      }
    ]
  },
  {
    id: "quick-legs",
    family: "BOOST",
    tier: "STARTER",
    name: "Jambes rapides",
    shortName: "Déplacements",
    description: "Améliorer les déplacements et la première impulsion sur plusieurs points.",
    focusCost: 2,
    unlockLevel: 0,
    copyLimit: 2,
    duration: { unit: "POINTS", amount: 4 },
    primaryStats: ["speed", "explosiveness"],
    secondaryStats: ["recovery"],
    effects: [
      {
        type: "STAT_BOOST",
        boosts: { speed: 8, explosiveness: 5 },
        pointChanceModifier: 0.014
      }
    ]
  },
  {
    id: "protect-backhand",
    family: "COUNTER",
    tier: "STARTER",
    name: "Protéger le revers",
    shortName: "Contre revers",
    description: "Réduire l’efficacité d’une attaque répétée sur votre revers.",
    focusCost: 1,
    unlockLevel: 0,
    copyLimit: 2,
    duration: { unit: "POINTS", amount: 3 },
    primaryStats: ["backhand", "recovery"],
    secondaryStats: ["speed"],
    effects: [
      {
        type: "COUNTER_INTENT",
        intentIds: ["ATTACK_BACKHAND"],
        boosts: { backhand: 8, recovery: 3 },
        matchedPointChanceModifier: 0.034
      }
    ]
  },
  {
    id: "lock-forehand",
    family: "COUNTER",
    tier: "STARTER",
    name: "Verrouiller le coup droit",
    shortName: "Contre coup droit",
    description: "Stabiliser le côté coup droit lorsque l’adversaire le prend pour cible.",
    focusCost: 1,
    unlockLevel: 0,
    copyLimit: 2,
    duration: { unit: "POINTS", amount: 3 },
    primaryStats: ["forehand", "recovery"],
    secondaryStats: ["speed"],
    effects: [
      {
        type: "COUNTER_INTENT",
        intentIds: ["ATTACK_FOREHAND"],
        boosts: { forehand: 8, recovery: 3 },
        matchedPointChanceModifier: 0.034
      }
    ]
  },
  {
    id: "read-serve",
    family: "COUNTER",
    tier: "STARTER",
    name: "Lire le service",
    shortName: "Lire le service",
    description: "Anticiper la direction du service et prendre une meilleure position de retour.",
    focusCost: 1,
    unlockLevel: 0,
    copyLimit: 2,
    duration: { unit: "POINTS", amount: 2 },
    primaryStats: ["return", "speed"],
    secondaryStats: ["recovery"],
    effects: [
      {
        type: "COUNTER_INTENT",
        intentIds: ["SERVE_PRESSURE"],
        boosts: { return: 8, speed: 2 },
        matchedPointChanceModifier: 0.037
      }
    ]
  },
  {
    id: "protect-second-serve",
    family: "COUNTER",
    tier: "ADVANCED",
    name: "Sécuriser la seconde balle",
    shortName: "Seconde balle",
    description: "Retrouver de la qualité au service face à un retour agressif.",
    focusCost: 1,
    unlockLevel: 3,
    copyLimit: 2,
    duration: { unit: "POINTS", amount: 2 },
    primaryStats: ["service", "recovery"],
    secondaryStats: ["strength"],
    effects: [
      {
        type: "COUNTER_INTENT",
        intentIds: ["RETURN_PRESSURE"],
        boosts: { service: 8, recovery: 3 },
        matchedPointChanceModifier: 0.036
      }
    ]
  },
  {
    id: "close-the-net",
    family: "COUNTER",
    tier: "ADVANCED",
    name: "Fermer le filet",
    shortName: "Passing",
    description: "Préparer le passing et le lob contre une montée adverse.",
    focusCost: 1,
    unlockLevel: 5,
    copyLimit: 2,
    duration: { unit: "POINTS", amount: 3 },
    primaryStats: ["return", "speed"],
    secondaryStats: ["explosiveness", "dropShot"],
    effects: [
      {
        type: "COUNTER_INTENT",
        intentIds: ["RUSH_NET"],
        boosts: { return: 6, speed: 4 },
        matchedPointChanceModifier: 0.034
      }
    ]
  },
  {
    id: "break-the-rhythm",
    family: "COUNTER",
    tier: "ADVANCED",
    name: "Casser le rythme",
    shortName: "Variation",
    description: "Modifier la cadence lorsque l’adversaire impose un schéma d’échange.",
    focusCost: 2,
    unlockLevel: 7,
    copyLimit: 2,
    duration: { unit: "POINTS", amount: 4 },
    primaryStats: ["dropShot", "recovery"],
    secondaryStats: ["stamina", "speed"],
    effects: [
      {
        type: "COUNTER_INTENT",
        intentIds: ["EXTEND_RALLY", "SHORTEN_RALLY", "VARY_RHYTHM"],
        boosts: { dropShot: 6, recovery: 4 },
        matchedPointChanceModifier: 0.029
      }
    ]
  },
  {
    id: "second-wind",
    family: "STATE",
    tier: "STARTER",
    name: "Second souffle",
    shortName: "Récupération",
    description: "Récupérer immédiatement puis réduire l’usure des prochains points.",
    focusCost: 2,
    unlockLevel: 0,
    copyLimit: 2,
    duration: { unit: "POINTS", amount: 4 },
    primaryStats: ["recovery", "stamina"],
    secondaryStats: [],
    effects: [
      {
        type: "MATCH_STATE",
        energyDelta: 12,
        energyDrainMultiplier: 0.86
      }
    ]
  },
  {
    id: "stay-calm",
    family: "STATE",
    tier: "STARTER",
    name: "Rester calme",
    shortName: "Confiance",
    description: "Stabiliser la confiance et réduire l’effet d’un momentum défavorable.",
    focusCost: 1,
    unlockLevel: 0,
    copyLimit: 2,
    duration: { unit: "POINTS", amount: 3 },
    primaryStats: ["recovery"],
    secondaryStats: ["stamina"],
    effects: [
      {
        type: "MATCH_STATE",
        confidenceDelta: 10,
        momentumTowardZero: 6,
        pointChanceModifier: 0.008
      }
    ]
  },
  {
    id: "raise-intensity",
    family: "STATE",
    tier: "ADVANCED",
    name: "Hausser l’intensité",
    shortName: "Intensité",
    description: "Dépenser de l’énergie pour reprendre l’initiative immédiatement.",
    focusCost: 2,
    unlockLevel: 4,
    copyLimit: 2,
    duration: { unit: "POINTS", amount: 3 },
    primaryStats: ["explosiveness", "strength"],
    secondaryStats: ["stamina"],
    effects: [
      {
        type: "MATCH_STATE",
        energyDelta: -4,
        confidenceDelta: 4,
        momentumDelta: 7,
        pointChanceModifier: 0.023
      }
    ]
  },
  {
    id: "point-by-point",
    family: "STATE",
    tier: "ADVANCED",
    name: "Point par point",
    shortName: "Recentrage",
    description: "Réduire l’impact d’une mauvaise série sans effacer le score.",
    focusCost: 1,
    unlockLevel: 5,
    copyLimit: 2,
    duration: { unit: "IMMEDIATE", amount: 1 },
    primaryStats: ["recovery", "stamina"],
    secondaryStats: [],
    effects: [
      {
        type: "MATCH_STATE",
        confidenceDelta: 5,
        momentumTowardZero: 12
      }
    ]
  },
  {
    id: "manage-effort",
    family: "STATE",
    tier: "ADVANCED",
    name: "Gérer l’effort",
    shortName: "Économie",
    description: "Accepter moins d’initiative pour préserver l’énergie sur la durée.",
    focusCost: 1,
    unlockLevel: 6,
    copyLimit: 2,
    duration: { unit: "GAMES", amount: 1 },
    primaryStats: ["stamina", "recovery"],
    secondaryStats: [],
    effects: [
      {
        type: "MATCH_STATE",
        energyDrainMultiplier: 0.68,
        pointChanceModifier: -0.008
      }
    ]
  },
  {
    id: "fresh-start",
    family: "STATE",
    tier: "SIGNATURE",
    name: "Repartir de zéro",
    shortName: "Nouveau départ",
    description: "Transformer une pause entre les sets en véritable relance mentale.",
    focusCost: 3,
    unlockLevel: 10,
    copyLimit: 1,
    duration: { unit: "IMMEDIATE", amount: 1 },
    primaryStats: ["recovery", "stamina"],
    secondaryStats: ["strength"],
    effects: [
      {
        type: "MATCH_STATE",
        energyDelta: 8,
        confidenceDelta: 8,
        momentumTowardZero: 18
      }
    ]
  },
  {
    id: "read-the-game",
    family: "DECK",
    tier: "STARTER",
    name: "Lire le jeu",
    shortName: "Lecture",
    description: "Piocher une option et améliorer la précision de l’intention adverse.",
    focusCost: 1,
    unlockLevel: 0,
    copyLimit: 2,
    duration: { unit: "NEXT_WINDOW", amount: 1 },
    primaryStats: ["return"],
    secondaryStats: ["recovery"],
    effects: [
      {
        type: "DECK_CONTROL",
        draw: 1,
        revealIntentPrecision: 0.18
      }
    ]
  },
  {
    id: "prepare-combo",
    family: "DECK",
    tier: "ADVANCED",
    name: "Préparer le prochain point",
    shortName: "Préparation",
    description: "Piocher deux cartes puis choisir celle qui sera écartée.",
    focusCost: 1,
    unlockLevel: 4,
    copyLimit: 2,
    duration: { unit: "IMMEDIATE", amount: 1 },
    primaryStats: ["recovery"],
    secondaryStats: ["stamina"],
    effects: [
      {
        type: "DECK_CONTROL",
        draw: 2,
        discardThenDraw: 1
      }
    ]
  },
  {
    id: "retain-plan",
    family: "DECK",
    tier: "ADVANCED",
    name: "Conserver le plan",
    shortName: "Conserver",
    description: "Garder une carte en main pour la prochaine fenêtre de coaching.",
    focusCost: 1,
    unlockLevel: 7,
    copyLimit: 2,
    duration: { unit: "NEXT_WINDOW", amount: 1 },
    primaryStats: ["stamina"],
    secondaryStats: ["recovery"],
    effects: [
      {
        type: "DECK_CONTROL",
        retain: 1,
        nextCardFocusDiscount: 1
      }
    ]
  },
  {
    id: "rebuild-hand",
    family: "DECK",
    tier: "STARTER",
    name: "Recomposer la main",
    shortName: "Nouvelle main",
    description: "Défausser la main actuelle puis piocher quatre nouvelles cartes.",
    focusCost: 2,
    unlockLevel: 0,
    copyLimit: 2,
    duration: { unit: "IMMEDIATE", amount: 1 },
    primaryStats: ["recovery"],
    secondaryStats: ["stamina"],
    effects: [
      {
        type: "DECK_CONTROL",
        discardThenDraw: 4
      }
    ]
  }
] as const satisfies readonly CoachCardDefinition[];

export type CoachCardId = (typeof COACH_CARDS)[number]["id"];

export const STARTER_COACH_DECK_CARD_IDS = [
  "power-forehand",
  "backhand-down-line",
  "power-serve",
  "aggressive-return",
  "quick-legs",
  "protect-backhand",
  "lock-forehand",
  "read-serve",
  "second-wind",
  "stay-calm",
  "read-the-game",
  "rebuild-hand"
] as const satisfies readonly CoachCardId[];

const cardById = new Map<string, CoachCardDefinition>(COACH_CARDS.map((card) => [card.id, card]));
const intentById = new Map<OpponentIntentId, OpponentIntentDefinition>(
  OPPONENT_INTENTS.map((intent) => [intent.id, intent])
);

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}

function rounded(value: number, digits = 4) {
  return Number(value.toFixed(digits));
}

export function coachCardById(cardId: string) {
  return cardById.get(cardId) ?? null;
}

export function opponentIntentById(intentId: OpponentIntentId) {
  return intentById.get(intentId) ?? null;
}

export type CoachDeckValidation = {
  valid: boolean;
  errors: string[];
  familyCounts: Record<CoachCardFamily, number>;
  totalFocusCost: number;
};

export function validateCoachDeck(
  cardIds: readonly string[],
  options: { playerLevel?: number; unlockedCardIds?: readonly string[] } = {}
): CoachDeckValidation {
  const errors: string[] = [];
  const familyCounts: Record<CoachCardFamily, number> = {
    BOOST: 0,
    COUNTER: 0,
    STATE: 0,
    DECK: 0
  };
  if (cardIds.length !== COACH_DECK_SIZE) {
    errors.push(`Le deck doit contenir exactement ${COACH_DECK_SIZE} cartes.`);
  }
  const copies = new Map<string, number>();
  const unlocked = options.unlockedCardIds ? new Set(options.unlockedCardIds) : null;
  let totalFocusCost = 0;
  for (const cardId of cardIds) {
    const card = coachCardById(cardId);
    if (!card) {
      errors.push(`Carte inconnue : ${cardId}.`);
      continue;
    }
    copies.set(cardId, (copies.get(cardId) ?? 0) + 1);
    familyCounts[card.family] += 1;
    totalFocusCost += card.focusCost;
    if (options.playerLevel !== undefined && card.unlockLevel > options.playerLevel) {
      errors.push(`${card.name} se débloque au niveau ${card.unlockLevel}.`);
    }
    if (unlocked && !unlocked.has(cardId)) {
      errors.push(`${card.name} n’est pas encore débloquée.`);
    }
  }
  for (const [cardId, count] of copies) {
    const card = coachCardById(cardId);
    if (card && count > card.copyLimit) {
      errors.push(`${card.name} est limitée à ${card.copyLimit} exemplaire(s).`);
    }
  }
  return {
    valid: errors.length === 0,
    errors,
    familyCounts,
    totalFocusCost
  };
}

function linkedStatAverage(card: CoachCardDefinition, stats: CoachDeckProfileStats) {
  const keys = [...new Set([...card.primaryStats, ...card.secondaryStats])];
  if (keys.length === 0) return 65;
  return keys.reduce((total, key) => total + stats[key], 0) / keys.length;
}

function cardEffectiveness(card: CoachCardDefinition, stats: CoachDeckProfileStats) {
  return clamp(0.82 + (linkedStatAverage(card, stats) - 30) * 0.004, 0.82, 1.12);
}

export type CoachCardPreviewContext = {
  opponentIntentId?: OpponentIntentId | null;
  basePointChance?: number;
  currentMomentum?: number;
  variantId?: CoachCardMasteryVariantId | null;
};

export type CoachCardPreview = {
  cardId: string;
  variantId: CoachCardMasteryVariantId | null;
  variantName: string | null;
  focusCost: number;
  effectiveness: number;
  intentMatched: boolean;
  scaledStatBoosts: Partial<Record<CoachDeckProfileStatKey, number>>;
  pointChanceBefore: number;
  pointChanceAfter: number;
  pointChanceDelta: number;
  enginePointChanceModifier: number;
  energyDelta: number;
  confidenceDelta: number;
  momentumDelta: number;
  momentumTowardZero: number;
  energyDrainMultiplier: number;
  draw: number;
  discardThenDraw: number;
  retain: number;
  revealIntentPrecision: number;
  nextCardFocusDiscount: number;
};

export function coachCardFocusCost(
  card: CoachCardDefinition,
  variantId: CoachCardMasteryVariantId | null | undefined
) {
  const variant = coachCardMasteryVariant(variantId);
  return clamp(card.focusCost + (variant?.focusDelta ?? 0), 0, COACH_DECK_FOCUS_PER_SET);
}

export function previewCoachCard(
  card: CoachCardDefinition,
  stats: CoachDeckProfileStats,
  context: CoachCardPreviewContext = {}
): CoachCardPreview {
  const variant = coachCardMasteryVariant(context.variantId);
  const variantMultiplier = variant?.effectMultiplier ?? 1;
  const effectiveness = cardEffectiveness(card, stats) * variantMultiplier;
  const boosts: Partial<Record<CoachDeckProfileStatKey, number>> = {};
  let enginePointChanceModifier = 0;
  let energyDelta = 0;
  let confidenceDelta = 0;
  let momentumDelta = 0;
  let momentumTowardZero = 0;
  let energyDrainMultiplier = 1;
  let draw = 0;
  let discardThenDraw = 0;
  let retain = 0;
  let revealIntentPrecision = 0;
  let nextCardFocusDiscount = 0;
  let intentMatched = false;

  const addBoosts = (values: Partial<Record<CoachDeckProfileStatKey, number>>) => {
    for (const key of COACH_DECK_PROFILE_STAT_KEYS) {
      const value = values[key];
      if (value === undefined) continue;
      boosts[key] = (boosts[key] ?? 0) + Math.max(1, Math.round(value * effectiveness));
    }
  };

  for (const effect of card.effects) {
    if (effect.type === "STAT_BOOST") {
      addBoosts(effect.boosts);
      enginePointChanceModifier += effect.pointChanceModifier * effectiveness;
      continue;
    }
    if (effect.type === "COUNTER_INTENT") {
      addBoosts(effect.boosts);
      const matches =
        context.opponentIntentId !== undefined &&
        context.opponentIntentId !== null &&
        effect.intentIds.includes(context.opponentIntentId);
      intentMatched ||= matches;
      if (matches) enginePointChanceModifier += effect.matchedPointChanceModifier * effectiveness;
      continue;
    }
    if (effect.type === "MATCH_STATE") {
      energyDelta += (effect.energyDelta ?? 0) * effectiveness;
      confidenceDelta += (effect.confidenceDelta ?? 0) * effectiveness;
      momentumDelta += (effect.momentumDelta ?? 0) * effectiveness;
      momentumTowardZero += (effect.momentumTowardZero ?? 0) * effectiveness;
      if (effect.energyDrainMultiplier !== undefined) {
        energyDrainMultiplier *= 1 - (1 - effect.energyDrainMultiplier) * effectiveness;
      }
      enginePointChanceModifier += (effect.pointChanceModifier ?? 0) * effectiveness;
      continue;
    }
    const scaleDeckValue = (value: number | undefined) => {
      if (!value) return 0;
      if (variant?.id === "IMPACT") return Math.ceil(value * variantMultiplier);
      if (variant?.id === "FLOW") return Math.floor(value * variantMultiplier);
      return value;
    };
    draw += scaleDeckValue(effect.draw);
    discardThenDraw += scaleDeckValue(effect.discardThenDraw);
    retain += scaleDeckValue(effect.retain);
    revealIntentPrecision += effect.revealIntentPrecision ?? 0;
    nextCardFocusDiscount += scaleDeckValue(effect.nextCardFocusDiscount);
  }

  const boostedStatTotal = Object.values(boosts).reduce<number>(
    (total, value) => total + (value ?? 0),
    0
  );
  enginePointChanceModifier += boostedStatTotal / 1950;
  let rawPointChanceDelta = enginePointChanceModifier;
  rawPointChanceDelta += energyDelta / 900;
  rawPointChanceDelta += confidenceDelta / 1250;
  rawPointChanceDelta += momentumDelta / 1800;
  if ((context.currentMomentum ?? 0) < 0) {
    rawPointChanceDelta +=
      Math.min(momentumTowardZero, Math.abs(context.currentMomentum ?? 0)) / 2100;
  }

  const pointChanceBefore = clamp(context.basePointChance ?? 0.5, 0.18, 0.82);
  const pointChanceDelta = clamp(
    rawPointChanceDelta,
    -COACH_DECK_MAX_POINT_CHANCE_DELTA,
    COACH_DECK_MAX_POINT_CHANCE_DELTA
  );
  const pointChanceAfter = clamp(pointChanceBefore + pointChanceDelta, 0.18, 0.82);

  return {
    cardId: card.id,
    variantId: variant?.id ?? null,
    variantName: variant?.name ?? null,
    focusCost: coachCardFocusCost(card, variant?.id),
    effectiveness: rounded(effectiveness, 3),
    intentMatched,
    scaledStatBoosts: boosts,
    pointChanceBefore: rounded(pointChanceBefore),
    pointChanceAfter: rounded(pointChanceAfter),
    pointChanceDelta: rounded(pointChanceAfter - pointChanceBefore),
    enginePointChanceModifier: rounded(
      clamp(
        enginePointChanceModifier,
        -COACH_DECK_MAX_POINT_CHANCE_DELTA,
        COACH_DECK_MAX_POINT_CHANCE_DELTA
      )
    ),
    energyDelta: rounded(energyDelta, 2),
    confidenceDelta: rounded(confidenceDelta, 2),
    momentumDelta: rounded(momentumDelta, 2),
    momentumTowardZero: rounded(momentumTowardZero, 2),
    energyDrainMultiplier: rounded(clamp(energyDrainMultiplier, 0.45, 1.4), 3),
    draw,
    discardThenDraw,
    retain,
    revealIntentPrecision: rounded(revealIntentPrecision, 2),
    nextCardFocusDiscount
  };
}

export function coachDeckAiTierForRanking(ranking: string): CoachDeckAiTier {
  const rankingIndex = fftRankingPath.indexOf(ranking as FftRanking);
  const safeIndex = rankingIndex < 0 ? 0 : rankingIndex;
  if (safeIndex >= 16) return "ELITE";
  if (safeIndex >= 10) return "COMPETITIVE";
  if (safeIndex >= 5) return "CLUB";
  return "BEGINNER";
}

const intentPrecisionByTier: Record<CoachDeckAiTier, number> = {
  BEGINNER: 0.72,
  CLUB: 0.82,
  COMPETITIVE: 0.9,
  ELITE: 0.96
};

function seededUnit(seed: string) {
  let value = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    value ^= seed.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }
  value += 0x6d2b79f5;
  value = Math.imul(value ^ (value >>> 15), value | 1);
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
  return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
}

export type GeneratedOpponentIntent = OpponentIntentDefinition & {
  confidence: number;
  intensity: 1 | 2 | 3;
  aiTier: CoachDeckAiTier;
  reason: string;
};

export function generateOpponentIntent(input: {
  playerStats: CoachDeckProfileStats;
  opponentStats: CoachDeckProfileStats;
  opponentRanking: string;
  playerEnergy: number;
  opponentEnergy: number;
  momentum: number;
  seed: string;
  windowIndex: number;
}): GeneratedOpponentIntent {
  const player = input.playerStats;
  const opponent = input.opponentStats;
  const scores: Record<OpponentIntentId, number> = {
    ATTACK_BACKHAND: 100 - player.backhand + opponent.forehand * 0.35 + opponent.strength * 0.15,
    ATTACK_FOREHAND: 100 - player.forehand + opponent.backhand * 0.35 + opponent.strength * 0.15,
    SERVE_PRESSURE:
      opponent.service * 0.55 + opponent.strength * 0.25 + opponent.explosiveness * 0.2,
    RETURN_PRESSURE: opponent.return * 0.55 + opponent.speed * 0.25 + (100 - player.service) * 0.2,
    RUSH_NET: opponent.volley * 0.5 + opponent.explosiveness * 0.25 + (100 - player.return) * 0.25,
    EXTEND_RALLY:
      opponent.stamina * 0.35 +
      opponent.recovery * 0.35 +
      (100 - player.stamina) * 0.2 +
      (100 - input.playerEnergy) * 0.1,
    SHORTEN_RALLY:
      opponent.forehand * 0.25 +
      opponent.strength * 0.25 +
      opponent.explosiveness * 0.25 +
      (100 - input.opponentEnergy) * 0.25,
    VARY_RHYTHM: opponent.dropShot * 0.4 + opponent.speed * 0.25 + (100 - player.speed) * 0.2 + 12
  };
  const candidates = OPPONENT_INTENTS.map((intent) => {
    const noise = (seededUnit(`${input.seed}:${input.windowIndex}:${intent.id}`) - 0.5) * 12;
    return { intent, score: scores[intent.id] + noise };
  }).sort((left, right) => right.score - left.score);
  const selected = candidates[0] ?? { intent: OPPONENT_INTENTS[0], score: 50 };
  const second = candidates[1]?.score ?? selected.score;
  const tier = coachDeckAiTierForRanking(input.opponentRanking);
  const gap = Math.max(0, selected.score - second);
  const confidence = clamp(intentPrecisionByTier[tier] + gap / 180, 0.65, 0.99);
  const pressure = Math.abs(input.momentum) >= 30 || input.playerEnergy <= 35;
  const intensity: 1 | 2 | 3 = tier === "ELITE" && pressure ? 3 : tier === "BEGINNER" ? 1 : 2;
  return {
    ...selected.intent,
    confidence: rounded(confidence, 2),
    intensity,
    aiTier: tier,
    reason: `Choix fondé sur ${selected.intent.targetStats.join(", ")} et l’état actuel du match.`
  };
}

export type CoachDeckBalanceReport = {
  simulatedMatches: number;
  maximumObservedPointChanceDelta: number;
  minimumObservedPointChanceDelta: number;
  averagePointChanceDeltaByCard: Record<string, number>;
  cardsAboveSafetyLimit: string[];
};

function syntheticStats(seed: string): CoachDeckProfileStats {
  return Object.fromEntries(
    COACH_DECK_PROFILE_STAT_KEYS.map((key) => [
      key,
      35 + Math.floor(seededUnit(`${seed}:${key}`) * 56)
    ])
  ) as CoachDeckProfileStats;
}

export function simulateCoachDeckBalance(simulatedMatches = 10_000): CoachDeckBalanceReport {
  const totals = new Map<string, { delta: number; count: number }>();
  let maximumObservedPointChanceDelta = -Infinity;
  let minimumObservedPointChanceDelta = Infinity;
  for (let matchIndex = 0; matchIndex < simulatedMatches; matchIndex += 1) {
    const card = COACH_CARDS[matchIndex % COACH_CARDS.length]!;
    const stats = syntheticStats(`coach-deck-balance:${matchIndex}`);
    const counterEffect = card.effects.find((effect) => effect.type === "COUNTER_INTENT");
    const randomIntent = OPPONENT_INTENTS[matchIndex % OPPONENT_INTENTS.length]!.id;
    const opponentIntentId =
      counterEffect && matchIndex % 2 === 0 ? counterEffect.intentIds[0] : randomIntent;
    const basePointChance = 0.38 + seededUnit(`base:${matchIndex}`) * 0.24;
    const currentMomentum = -40 + seededUnit(`momentum:${matchIndex}`) * 80;
    const preview = previewCoachCard(card, stats, {
      opponentIntentId: opponentIntentId ?? null,
      basePointChance,
      currentMomentum
    });
    const aggregate = totals.get(card.id) ?? { delta: 0, count: 0 };
    aggregate.delta += preview.pointChanceDelta;
    aggregate.count += 1;
    totals.set(card.id, aggregate);
    maximumObservedPointChanceDelta = Math.max(
      maximumObservedPointChanceDelta,
      preview.pointChanceDelta
    );
    minimumObservedPointChanceDelta = Math.min(
      minimumObservedPointChanceDelta,
      preview.pointChanceDelta
    );
  }
  const averagePointChanceDeltaByCard = Object.fromEntries(
    COACH_CARDS.map((card) => {
      const aggregate = totals.get(card.id) ?? { delta: 0, count: 1 };
      return [card.id, rounded(aggregate.delta / aggregate.count)];
    })
  );
  return {
    simulatedMatches,
    maximumObservedPointChanceDelta: rounded(maximumObservedPointChanceDelta),
    minimumObservedPointChanceDelta: rounded(minimumObservedPointChanceDelta),
    averagePointChanceDeltaByCard,
    cardsAboveSafetyLimit: COACH_CARDS.filter(
      (card) =>
        Math.abs(averagePointChanceDeltaByCard[card.id] ?? 0) > COACH_DECK_MAX_POINT_CHANCE_DELTA
    ).map((card) => card.id)
  };
}

export type CoachDeckCardInstance = {
  instanceId: string;
  cardId: CoachCardId;
  variantId?: CoachCardMasteryVariantId | null;
};

export type ActiveCoachDeckEffect = {
  sourceCardId: CoachCardId;
  pointChanceModifier: number;
  energyDrainMultiplier: number;
  statBoosts: Partial<Record<CoachDeckProfileStatKey, number>>;
  remainingPoints: number | null;
  remainingGames: number | null;
};

export type CoachDeckPlayHistoryEntry = {
  windowId: string;
  pointIndex: number;
  cardId: CoachCardId | null;
  variantId?: CoachCardMasteryVariantId | null;
  focusSpent: number;
  intentId: OpponentIntentId;
  intentMatched: boolean;
  pointChanceDelta: number;
};

export type CoachDeckRuntimeState = {
  version: 1;
  deckCardIds: CoachCardId[];
  drawPile: CoachDeckCardInstance[];
  hand: CoachDeckCardInstance[];
  discardPile: CoachDeckCardInstance[];
  focus: number;
  focusPerSet: number;
  setIndex: number;
  shuffleCount: number;
  windowId: string | null;
  opponentRanking: string;
  opponentIntent: GeneratedOpponentIntent | null;
  activeEffects: ActiveCoachDeckEffect[];
  history: CoachDeckPlayHistoryEntry[];
  nextHandDrawBonus: number;
  burnBeforeNextDraw: number;
  nextIntentPrecisionBonus: number;
  nextCardFocusDiscount: number;
};

function shuffleCoachDeckInstances(
  cards: readonly CoachDeckCardInstance[],
  seed: string,
  shuffleCount: number
) {
  const shuffled = cards.map((card) => ({ ...card }));
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const target = Math.floor(seededUnit(`${seed}:deck:${shuffleCount}:${index}`) * (index + 1));
    [shuffled[index], shuffled[target]] = [shuffled[target]!, shuffled[index]!];
  }
  return shuffled;
}

export function createCoachDeckRuntimeState(input: {
  cardIds: readonly string[];
  cardVariants?: Readonly<Record<string, CoachCardMasteryVariantId | null>>;
  seed: string;
  opponentRanking: string;
}): CoachDeckRuntimeState {
  if (input.cardIds.length !== COACH_DECK_SIZE) {
    throw new Error(`Un Coach Deck doit contenir ${COACH_DECK_SIZE} cartes.`);
  }
  const instances = input.cardIds.map((cardId, index) => {
    const card = coachCardById(cardId);
    if (!card) throw new Error(`Carte Coach Deck inconnue : ${cardId}.`);
    return {
      instanceId: `${index}-${card.id}`,
      cardId: card.id as CoachCardId,
      variantId: input.cardVariants?.[card.id] ?? null
    };
  });
  return {
    version: 1,
    deckCardIds: instances.map((card) => card.cardId),
    drawPile: shuffleCoachDeckInstances(instances, input.seed, 0),
    hand: [],
    discardPile: [],
    focus: COACH_DECK_FOCUS_PER_SET,
    focusPerSet: COACH_DECK_FOCUS_PER_SET,
    setIndex: 0,
    shuffleCount: 1,
    windowId: null,
    opponentRanking: input.opponentRanking,
    opponentIntent: null,
    activeEffects: [],
    history: [],
    nextHandDrawBonus: 0,
    burnBeforeNextDraw: 0,
    nextIntentPrecisionBonus: 0,
    nextCardFocusDiscount: 0
  };
}

function recycleCoachDeckDiscard(runtime: CoachDeckRuntimeState, seed: string) {
  if (runtime.drawPile.length > 0 || runtime.discardPile.length === 0) return;
  runtime.drawPile = shuffleCoachDeckInstances(runtime.discardPile, seed, runtime.shuffleCount);
  runtime.discardPile = [];
  runtime.shuffleCount += 1;
}

function drawCoachDeckCard(runtime: CoachDeckRuntimeState, seed: string) {
  recycleCoachDeckDiscard(runtime, seed);
  const card = runtime.drawPile.shift();
  if (card) runtime.hand.push(card);
  return card ?? null;
}

function discardCoachDeckHand(
  runtime: CoachDeckRuntimeState,
  retainedInstanceId: string | null = null
) {
  const retained = retainedInstanceId
    ? (runtime.hand.find((card) => card.instanceId === retainedInstanceId) ?? null)
    : null;
  runtime.discardPile.push(
    ...runtime.hand.filter((card) => card.instanceId !== retained?.instanceId)
  );
  runtime.hand = retained ? [retained] : [];
}

export function prepareCoachDeckWindow(
  runtime: CoachDeckRuntimeState,
  input: {
    windowId: string;
    pointIndex: number;
    seed: string;
    playerStats: CoachDeckProfileStats;
    opponentStats: CoachDeckProfileStats;
    playerEnergy: number;
    opponentEnergy: number;
    momentum: number;
  }
) {
  if (runtime.windowId === input.windowId) return runtime;
  discardCoachDeckHand(runtime);
  for (let index = 0; index < runtime.burnBeforeNextDraw; index += 1) {
    recycleCoachDeckDiscard(runtime, input.seed);
    const burned = runtime.drawPile.shift();
    if (burned) runtime.discardPile.push(burned);
  }
  const targetHandSize = COACH_DECK_HAND_SIZE + runtime.nextHandDrawBonus;
  while (runtime.hand.length < targetHandSize) {
    if (!drawCoachDeckCard(runtime, input.seed)) break;
  }
  const generatedIntent = generateOpponentIntent({
    playerStats: input.playerStats,
    opponentStats: input.opponentStats,
    opponentRanking: runtime.opponentRanking,
    playerEnergy: input.playerEnergy,
    opponentEnergy: input.opponentEnergy,
    momentum: input.momentum,
    seed: input.seed,
    windowIndex: input.pointIndex
  });
  runtime.opponentIntent = {
    ...generatedIntent,
    confidence: rounded(
      clamp(generatedIntent.confidence + runtime.nextIntentPrecisionBonus, 0.65, 0.99),
      2
    )
  };
  runtime.windowId = input.windowId;
  runtime.nextHandDrawBonus = 0;
  runtime.burnBeforeNextDraw = 0;
  runtime.nextIntentPrecisionBonus = 0;
  return runtime;
}

export type CoachDeckDecisionResult = {
  card: CoachCardDefinition | null;
  preview: CoachCardPreview | null;
  focusSpent: number;
};

export function applyCoachDeckCardDecision(
  runtime: CoachDeckRuntimeState,
  input: {
    windowId: string;
    pointIndex: number;
    cardInstanceId: string | null;
    retainInstanceId?: string | null;
    playerStats: CoachDeckProfileStats;
    basePointChance: number;
    currentMomentum: number;
  }
): CoachDeckDecisionResult {
  if (!runtime.windowId || runtime.windowId !== input.windowId || !runtime.opponentIntent) {
    throw new Error("Cette fenêtre Coach Deck n’est plus active.");
  }
  if (input.cardInstanceId === null) {
    runtime.history.push({
      windowId: input.windowId,
      pointIndex: input.pointIndex,
      cardId: null,
      variantId: null,
      focusSpent: 0,
      intentId: runtime.opponentIntent.id,
      intentMatched: false,
      pointChanceDelta: 0
    });
    discardCoachDeckHand(runtime);
    runtime.windowId = null;
    return { card: null, preview: null, focusSpent: 0 };
  }
  const instance = runtime.hand.find((card) => card.instanceId === input.cardInstanceId);
  if (!instance) throw new Error("Cette carte n’est pas dans votre main.");
  const card = coachCardById(instance.cardId);
  if (!card) throw new Error("Carte Coach Deck introuvable.");
  const focusSpent = Math.max(
    0,
    coachCardFocusCost(card, instance.variantId) - runtime.nextCardFocusDiscount
  );
  if (focusSpent > runtime.focus) throw new Error("Focus insuffisant pour jouer cette carte.");
  const preview = previewCoachCard(card, input.playerStats, {
    opponentIntentId: runtime.opponentIntent.id,
    basePointChance: input.basePointChance,
    currentMomentum: input.currentMomentum,
    variantId: instance.variantId ?? null
  });
  runtime.focus -= focusSpent;
  runtime.nextCardFocusDiscount = 0;
  const deckEffect = card.effects.find((effect) => effect.type === "DECK_CONTROL");
  if (deckEffect) {
    runtime.nextHandDrawBonus += deckEffect.draw ?? 0;
    runtime.burnBeforeNextDraw += deckEffect.discardThenDraw ?? 0;
    runtime.nextIntentPrecisionBonus += deckEffect.revealIntentPrecision ?? 0;
    runtime.nextCardFocusDiscount += deckEffect.nextCardFocusDiscount ?? 0;
  }
  const retainedInstanceId =
    deckEffect?.retain && input.retainInstanceId !== input.cardInstanceId
      ? (input.retainInstanceId ?? null)
      : null;
  runtime.discardPile.push(instance);
  runtime.hand = runtime.hand.filter((item) => item.instanceId !== instance.instanceId);
  discardCoachDeckHand(runtime, retainedInstanceId);
  const hasPersistentEffect =
    card.duration.unit === "POINTS" ||
    card.duration.unit === "GAMES" ||
    preview.energyDrainMultiplier !== 1;
  if (hasPersistentEffect) {
    runtime.activeEffects.push({
      sourceCardId: card.id as CoachCardId,
      pointChanceModifier: preview.enginePointChanceModifier,
      energyDrainMultiplier: preview.energyDrainMultiplier,
      statBoosts: preview.scaledStatBoosts,
      remainingPoints: card.duration.unit === "POINTS" ? card.duration.amount : null,
      remainingGames: card.duration.unit === "GAMES" ? card.duration.amount : null
    });
  }
  runtime.history.push({
    windowId: input.windowId,
    pointIndex: input.pointIndex,
    cardId: card.id as CoachCardId,
    variantId: instance.variantId ?? null,
    focusSpent,
    intentId: runtime.opponentIntent.id,
    intentMatched: preview.intentMatched,
    pointChanceDelta: preview.pointChanceDelta
  });
  runtime.windowId = null;
  return { card, preview, focusSpent };
}

export function advanceCoachDeckEffects(runtime: CoachDeckRuntimeState, completedGame: boolean) {
  for (const effect of runtime.activeEffects) {
    if (effect.remainingPoints !== null) effect.remainingPoints -= 1;
    if (completedGame && effect.remainingGames !== null) effect.remainingGames -= 1;
  }
  runtime.activeEffects = runtime.activeEffects.filter(
    (effect) =>
      (effect.remainingPoints === null || effect.remainingPoints > 0) &&
      (effect.remainingGames === null || effect.remainingGames > 0)
  );
}

export function resetCoachDeckFocusForNewSet(runtime: CoachDeckRuntimeState) {
  runtime.setIndex += 1;
  runtime.focus = runtime.focusPerSet;
}

export function activeCoachDeckPointChanceModifier(
  runtime: CoachDeckRuntimeState | null | undefined
) {
  return clamp(
    runtime?.activeEffects.reduce((total, effect) => total + effect.pointChanceModifier, 0) ?? 0,
    -COACH_DECK_MAX_POINT_CHANCE_DELTA,
    COACH_DECK_MAX_POINT_CHANCE_DELTA
  );
}

export function activeCoachDeckEnergyDrainMultiplier(
  runtime: CoachDeckRuntimeState | null | undefined
) {
  return clamp(
    runtime?.activeEffects.reduce(
      (multiplier, effect) => multiplier * effect.energyDrainMultiplier,
      1
    ) ?? 1,
    0.45,
    1.4
  );
}
