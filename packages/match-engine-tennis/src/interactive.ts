import type { TennisStatKey, TennisStats, TennisSurface } from "@mypro/sports-tennis";
import type { EnginePlayer, MatchFormat } from "./index";
import {
  COACH_DECK_PROFILE_STAT_KEYS,
  activeCoachDeckEnergyDrainMultiplier,
  activeCoachDeckPointChanceModifier,
  advanceCoachDeckEffects,
  applyCoachDeckCardDecision,
  createCoachDeckRuntimeState,
  prepareCoachDeckWindow,
  resetCoachDeckFocusForNewSet,
  type CoachDeckProfileStats,
  type CoachDeckRuntimeState
} from "./coachDeck";

export type CoachingInstructionCategory =
  | "target"
  | "serve-return"
  | "court-position"
  | "rally"
  | "mental"
  | "physical"
  | "risk";

export type CoachingInstruction = {
  id: string;
  label: string;
  shortLabel: string;
  description: string;
  category: CoachingInstructionCategory;
  durationGames: number;
  energyMultiplier: number;
  errorModifier: number;
  winnerModifier: number;
  initialConfidence: number;
};

export const COACHING_INSTRUCTIONS = [
  {
    id: "attack-backhand",
    label: "Jouer sur le revers",
    shortLabel: "Cibler le revers",
    description: "Insister sur le revers adverse et l'obliger à jouer sous pression.",
    category: "target",
    durationGames: 2,
    energyMultiplier: 1.05,
    errorModifier: 0.006,
    winnerModifier: 0.012,
    initialConfidence: 1
  },
  {
    id: "attack-forehand",
    label: "Jouer sur le coup droit",
    shortLabel: "Cibler le coup droit",
    description: "Insister sur le coup droit adverse lorsqu'il constitue sa faiblesse.",
    category: "target",
    durationGames: 2,
    energyMultiplier: 1.05,
    errorModifier: 0.006,
    winnerModifier: 0.012,
    initialConfidence: 1
  },
  {
    id: "attack-second-serve",
    label: "Attaquer la seconde balle",
    shortLabel: "Attaquer au retour",
    description: "Avancer dans le court et prendre l'initiative sur la seconde balle.",
    category: "serve-return",
    durationGames: 2,
    energyMultiplier: 1.1,
    errorModifier: 0.014,
    winnerModifier: 0.022,
    initialConfidence: 1
  },
  {
    id: "secure-second-serve",
    label: "Sécuriser la seconde balle",
    shortLabel: "Assurer au service",
    description: "Réduire les doubles fautes et engager davantage de premières frappes.",
    category: "serve-return",
    durationGames: 2,
    energyMultiplier: 0.94,
    errorModifier: -0.025,
    winnerModifier: -0.008,
    initialConfidence: 2
  },
  {
    id: "hold-baseline",
    label: "Tenir le fond de court",
    shortLabel: "Fond de court",
    description: "Construire les points depuis la ligne de fond avec patience.",
    category: "court-position",
    durationGames: 3,
    energyMultiplier: 1.02,
    errorModifier: -0.009,
    winnerModifier: -0.003,
    initialConfidence: 1
  },
  {
    id: "rush-net",
    label: "Monter au filet",
    shortLabel: "Prendre le filet",
    description: "Raccourcir les points en utilisant la volée et l'explosivité.",
    category: "court-position",
    durationGames: 2,
    energyMultiplier: 1.14,
    errorModifier: 0.012,
    winnerModifier: 0.026,
    initialConfidence: 1
  },
  {
    id: "extend-rallies",
    label: "Allonger les échanges",
    shortLabel: "Faire durer",
    description: "Tester l'endurance et la régularité de l'adversaire.",
    category: "rally",
    durationGames: 3,
    energyMultiplier: 1.08,
    errorModifier: -0.006,
    winnerModifier: -0.006,
    initialConfidence: 1
  },
  {
    id: "shorten-rallies",
    label: "Raccourcir les échanges",
    shortLabel: "Jouer plus court",
    description: "Chercher rapidement une frappe décisive pour éviter les longs rallyes.",
    category: "rally",
    durationGames: 2,
    energyMultiplier: 1.12,
    errorModifier: 0.018,
    winnerModifier: 0.024,
    initialConfidence: 1
  },
  {
    id: "vary-play",
    label: "Varier le jeu",
    shortLabel: "Changer le rythme",
    description: "Alterner hauteurs, directions et amorties pour casser le rythme.",
    category: "rally",
    durationGames: 3,
    energyMultiplier: 1.03,
    errorModifier: 0.004,
    winnerModifier: 0.011,
    initialConfidence: 2
  },
  {
    id: "stay-calm",
    label: "Rester calme",
    shortLabel: "Garder son calme",
    description: "Stabiliser la confiance et mieux négocier les points sous pression.",
    category: "mental",
    durationGames: 2,
    energyMultiplier: 0.96,
    errorModifier: -0.018,
    winnerModifier: -0.004,
    initialConfidence: 7
  },
  {
    id: "raise-intensity",
    label: "Hausser l'intensité",
    shortLabel: "Mettre la pression",
    description: "Augmenter le rythme et imposer davantage sa présence.",
    category: "mental",
    durationGames: 2,
    energyMultiplier: 1.2,
    errorModifier: 0.011,
    winnerModifier: 0.018,
    initialConfidence: 3
  },
  {
    id: "conserve-energy",
    label: "Économiser son énergie",
    shortLabel: "Souffler",
    description: "Accepter moins d'initiative pour préserver les réserves physiques.",
    category: "physical",
    durationGames: 3,
    energyMultiplier: 0.58,
    errorModifier: -0.01,
    winnerModifier: -0.012,
    initialConfidence: 1
  },
  {
    id: "all-in",
    label: "Tout donner maintenant",
    shortLabel: "Tout donner",
    description: "Dépenser beaucoup d'énergie pour tenter de renverser la dynamique.",
    category: "physical",
    durationGames: 1,
    energyMultiplier: 1.65,
    errorModifier: 0.018,
    winnerModifier: 0.035,
    initialConfidence: 4
  },
  {
    id: "play-safe",
    label: "Assurer le jeu",
    shortLabel: "Jouer prudent",
    description: "Réduire les fautes directes au prix de moins de coups gagnants.",
    category: "risk",
    durationGames: 2,
    energyMultiplier: 0.9,
    errorModifier: -0.035,
    winnerModifier: -0.018,
    initialConfidence: 2
  },
  {
    id: "take-risks",
    label: "Prendre des risques",
    shortLabel: "Jouer agressif",
    description: "Chercher davantage de coups gagnants en acceptant plus de fautes.",
    category: "risk",
    durationGames: 2,
    energyMultiplier: 1.18,
    errorModifier: 0.04,
    winnerModifier: 0.045,
    initialConfidence: 2
  }
] as const satisfies readonly CoachingInstruction[];

export type CoachingInstructionId = (typeof COACHING_INSTRUCTIONS)[number]["id"];
export type CoachWindowType = "PRE_MATCH" | "CHANGEOVER" | "PRESSURE" | "SET_BREAK";
export type InteractiveMatchStatus = "PLAYING" | "AWAITING_COACH" | "FINISHED";

export type InteractiveScoreState = {
  pointValues: [number, number];
  games: [number, number];
  sets: [number, number];
  setHistory: Array<[number, number]>;
  serverIndex: 0 | 1;
  inTieBreak: boolean;
  tieBreakPointCount: number;
};

export type InteractiveScoreView = {
  points: [string, string];
  games: [number, number];
  sets: [number, number];
  setHistory: Array<[number, number]>;
  serverIndex: 0 | 1;
  inTieBreak: boolean;
};

export type ActiveCoachingInstruction = {
  id: CoachingInstructionId;
  remainingGames: number;
  appliedAtPoint: number;
};

export type CoachWindow = {
  id: string;
  type: CoachWindowType;
  title: string;
  analysis: string;
  playerIndex: 0;
  recommendedInstructionIds: CoachingInstructionId[];
  score: InteractiveScoreView;
};

export type CoachingDecision = {
  windowId: string;
  instructionId: CoachingInstructionId | null;
  playerIndex: 0;
  pointIndex: number;
};

export type InteractivePointEvent = {
  index: number;
  serverId: string;
  winnerId: string;
  action: string;
  rallyLength: number;
  score: InteractiveScoreView;
  probabilityForPlayerA: number;
  probabilityBreakdown: InteractiveProbabilityBreakdown;
  roll: number;
  energy: [number, number];
  confidence: [number, number];
  momentum: number;
  isBreakPoint: boolean;
  isSetPoint: boolean;
  isMatchPoint: boolean;
  statKey: TennisStatKey;
  statLabel: string;
  activeInstructionIds: [CoachingInstructionId | null, CoachingInstructionId | null];
  activeCoachCardIds: string[];
};

export type InteractiveProbabilityBreakdown = {
  service: number;
  statistics: number;
  physical: number;
  confidence: number;
  momentum: number;
  surface: number;
  tactic: number;
  risk: number;
  coaching: number;
  coachDeck: number;
  total: number;
};

export type InteractiveMatchState = {
  version: 2 | 3;
  seed: string;
  surface: TennisSurface;
  format: MatchFormat;
  players: [EnginePlayer, EnginePlayer];
  status: InteractiveMatchStatus;
  score: InteractiveScoreState;
  pointIndex: number;
  energy: [number, number];
  confidence: [number, number];
  momentum: number;
  coachingPoints: [number, number];
  activeInstructions: [ActiveCoachingInstruction | null, ActiveCoachingInstruction | null];
  coachWindow: CoachWindow | null;
  coachingHistory: CoachingDecision[];
  coachDeck?: CoachDeckRuntimeState | null;
  events: InteractivePointEvent[];
  lastPressureWindowPoint: number | null;
  lastCoachWindowPoint: number | null;
  winnerId: string | null;
  scoreText: string;
};

export type CreateInteractiveMatchInput = {
  playerA: EnginePlayer;
  playerB: EnginePlayer;
  surface: TennisSurface;
  format: MatchFormat;
  seed: string | number;
  coachDeckCardIds?: readonly string[];
  opponentRanking?: string;
};

type PressureContext = {
  isBreakPoint: boolean;
  isSetPoint: boolean;
  isMatchPoint: boolean;
  beneficiaryIndex: 0 | 1 | null;
};

const pointNames = ["0", "15", "30", "40"] as const;
const MAX_COACHING_POINTS = 3;
const COACH_WINDOW_COOLDOWN_POINTS = 12;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function cloneState(state: InteractiveMatchState) {
  return structuredClone(state);
}

function coachDeckProfileStats(player: EnginePlayer): CoachDeckProfileStats {
  return Object.fromEntries(
    COACH_DECK_PROFILE_STAT_KEYS.map((key) => [key, player.stats[key]])
  ) as CoachDeckProfileStats;
}

function hashRandom(seed: string, pointIndex: number, salt: string) {
  const text = `${seed}:${pointIndex}:${salt}`;
  let value = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    value ^= text.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }
  value += 0x6d2b79f5;
  let mixed = value;
  mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
  mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
  return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
}

function randomInt(seed: string, pointIndex: number, salt: string, min: number, max: number) {
  return Math.floor(hashRandom(seed, pointIndex, salt) * (max - min + 1)) + min;
}

function instructionById(id: CoachingInstructionId) {
  const instruction = COACHING_INSTRUCTIONS.find((item) => item.id === id);
  if (!instruction) throw new Error(`Consigne de coaching inconnue : ${id}`);
  return instruction;
}

function setsNeeded(format: MatchFormat) {
  if (format === "Un set") return 1;
  if (format === "Trois sets gagnants") return 3;
  return 2;
}

function pointsToLabel(points: [number, number], tieBreak: boolean): [string, string] {
  if (tieBreak) return [String(points[0]), String(points[1])];
  if (points[0] >= 3 && points[1] >= 3) {
    if (points[0] === points[1]) return ["40", "40"];
    return points[0] > points[1] ? ["Av.", "40"] : ["40", "Av."];
  }
  return [pointNames[points[0]] ?? "40", pointNames[points[1]] ?? "40"];
}

function gameWinner(points: [number, number], tieBreak: boolean): 0 | 1 | null {
  const target = tieBreak ? 7 : 4;
  if (points[0] >= target && points[0] - points[1] >= 2) return 0;
  if (points[1] >= target && points[1] - points[0] >= 2) return 1;
  return null;
}

function setWinner(games: [number, number], tieBreakWinner: 0 | 1 | null): 0 | 1 | null {
  if (tieBreakWinner !== null) return tieBreakWinner;
  if (games[0] >= 6 && games[0] - games[1] >= 2) return 0;
  if (games[1] >= 6 && games[1] - games[0] >= 2) return 1;
  return null;
}

function scoreView(score: InteractiveScoreState): InteractiveScoreView {
  return {
    points: pointsToLabel(score.pointValues, score.inTieBreak),
    games: [...score.games],
    sets: [...score.sets],
    setHistory: score.setHistory.map((set) => [...set]),
    serverIndex: score.serverIndex,
    inTieBreak: score.inTieBreak
  };
}

function average(stats: TennisStats, keys: TennisStatKey[]) {
  return keys.reduce((sum, key) => sum + stats[key], 0) / keys.length;
}

function surfaceModifier(player: EnginePlayer, surface: TennisSurface) {
  const stats = player.stats;
  const adaptation = (stats.surfaceAdaptation - 50) / 650;
  if (surface === "Terre battue")
    return adaptation + (stats.stamina + stats.consistency - 100) / 950;
  if (surface === "Gazon") return adaptation + (stats.service + stats.volley - 100) / 980;
  if (surface === "Indoor") return adaptation + (stats.service + stats.aggression - 100) / 1050;
  return adaptation + (stats.footwork + stats.baseline - 100) / 1100;
}

function tacticModifier(player: EnginePlayer, opponent: EnginePlayer) {
  const stats = player.stats;
  const opposing = opponent.stats;
  switch (player.tactic) {
    case "Défensif":
      return (stats.consistency + stats.stamina - 100) / 1200;
    case "Agressif":
      return (stats.aggression + stats.forehand - 100) / 1150;
    case "Service-volée":
      return (stats.service + stats.volley + stats.netRush - 150) / 1500;
    case "Contreur":
      return (stats.return + stats.composure - 100) / 1200;
    case "Fond de court":
      return (stats.baseline + stats.backhand + stats.forehand - 150) / 1500;
    case "Attaque du revers adverse":
      return (stats.forehand + stats.focus - opposing.backhand - opposing.footwork) / 1600;
    case "Jeu varié":
      return (stats.dropShot + stats.focus + stats.surfaceAdaptation - 150) / 1500;
    default:
      return (stats.focus + stats.footwork - 100) / 1800;
  }
}

function riskChance(player: EnginePlayer) {
  if (player.risk === "Prudente") return -0.008;
  if (player.risk === "Forte") return 0.012;
  return 0;
}

function instructionChance(
  instructionId: CoachingInstructionId | null,
  player: EnginePlayer,
  opponent: EnginePlayer,
  serving: boolean,
  pressure: boolean
) {
  if (!instructionId) return 0;
  const stats = player.stats;
  const opposing = opponent.stats;
  switch (instructionId) {
    case "attack-backhand":
      return clamp(
        (stats.forehand + stats.focus - opposing.backhand - opposing.footwork) / 1500 + 0.006,
        -0.04,
        0.045
      );
    case "attack-forehand":
      return clamp(
        (stats.backhand + stats.focus - opposing.forehand - opposing.footwork) / 1500 + 0.006,
        -0.04,
        0.045
      );
    case "attack-second-serve":
      return serving
        ? -0.006
        : clamp(
            (stats.return + stats.aggression - opposing.service - opposing.composure) / 1550 +
              0.012,
            -0.035,
            0.05
          );
    case "secure-second-serve":
      return serving
        ? clamp(
            (stats.service + stats.composure - opposing.return - opposing.focus) / 1900 + 0.009,
            -0.025,
            0.035
          )
        : -0.004;
    case "hold-baseline":
      return clamp(
        (stats.baseline +
          stats.consistency +
          stats.forehand +
          stats.backhand -
          opposing.baseline -
          opposing.consistency -
          opposing.forehand -
          opposing.backhand) /
          3000 +
          0.004,
        -0.035,
        0.04
      );
    case "rush-net":
      return clamp(
        (stats.volley +
          stats.netRush +
          stats.explosiveness -
          opposing.return -
          opposing.speed -
          opposing.composure) /
          2200 +
          0.008,
        -0.045,
        0.05
      );
    case "extend-rallies":
      return clamp(
        (stats.stamina +
          stats.consistency +
          stats.recovery -
          opposing.stamina -
          opposing.consistency -
          opposing.recovery) /
          2100 +
          0.006,
        -0.04,
        0.045
      );
    case "shorten-rallies":
      return clamp(
        (stats.aggression +
          stats.strength +
          stats.explosiveness -
          opposing.speed -
          opposing.composure -
          opposing.consistency) /
          2200 +
          0.008,
        -0.04,
        0.05
      );
    case "vary-play":
      return clamp(
        (stats.dropShot +
          stats.focus +
          stats.surfaceAdaptation -
          opposing.speed -
          opposing.composure -
          opposing.focus) /
          2200 +
          0.008,
        -0.035,
        0.045
      );
    case "stay-calm":
      return pressure ? 0.026 : 0.006;
    case "raise-intensity":
      return 0.014;
    case "conserve-energy":
      return -0.012;
    case "all-in":
      return 0.028;
    case "play-safe":
      return -0.004;
    case "take-risks":
      return 0.014;
  }
}

const pointPatterns = [
  {
    key: "service",
    label: "Service",
    a: ["service", "strength", "focus"],
    b: ["return", "footwork", "composure"]
  },
  {
    key: "forehand",
    label: "Coup droit",
    a: ["forehand", "aggression", "footwork"],
    b: ["forehand", "consistency", "speed"]
  },
  {
    key: "backhand",
    label: "Revers",
    a: ["backhand", "focus", "footwork"],
    b: ["backhand", "consistency", "speed"]
  },
  {
    key: "volley",
    label: "Jeu au filet",
    a: ["volley", "netRush", "explosiveness"],
    b: ["return", "speed", "composure"]
  },
  {
    key: "smash",
    label: "Smash",
    a: ["smash", "strength", "explosiveness"],
    b: ["return", "speed", "composure"]
  },
  {
    key: "stamina",
    label: "Échange long",
    a: ["stamina", "recovery", "consistency"],
    b: ["stamina", "recovery", "consistency"]
  },
  {
    key: "dropShot",
    label: "Variation",
    a: ["dropShot", "focus", "surfaceAdaptation"],
    b: ["speed", "footwork", "composure"]
  }
] as const satisfies readonly {
  key: TennisStatKey;
  label: string;
  a: readonly TennisStatKey[];
  b: readonly TennisStatKey[];
}[];

function pressureContext(state: InteractiveMatchState): PressureContext {
  const { pointValues, games, sets, serverIndex, inTieBreak } = state.score;
  for (const candidate of [0, 1] as const) {
    const projected: [number, number] = [...pointValues];
    projected[candidate] += 1;
    if (gameWinner(projected, inTieBreak) !== candidate) continue;
    const projectedGames: [number, number] = [...games];
    projectedGames[candidate] += 1;
    const wouldWinSet = setWinner(projectedGames, inTieBreak ? candidate : null) === candidate;
    const wouldWinMatch = wouldWinSet && sets[candidate] === setsNeeded(state.format) - 1;
    return {
      isBreakPoint: candidate !== serverIndex,
      isSetPoint: wouldWinSet,
      isMatchPoint: wouldWinMatch,
      beneficiaryIndex: candidate
    };
  }
  return { isBreakPoint: false, isSetPoint: false, isMatchPoint: false, beneficiaryIndex: null };
}

function pointProbability(
  state: InteractiveMatchState,
  patternIndex: number,
  pressure: PressureContext
) {
  const pattern = pointPatterns[patternIndex] ?? pointPatterns[0];
  const playerA = state.players[0];
  const playerB = state.players[1];
  const aServing = state.score.serverIndex === 0;
  const aKeys = [...pattern.a];
  const bKeys = [...pattern.b];
  const qualityA =
    pattern.key === "service" && !aServing
      ? average(playerA.stats, bKeys)
      : average(playerA.stats, aKeys);
  const qualityB =
    pattern.key === "service" && !aServing
      ? average(playerB.stats, aKeys)
      : average(playerB.stats, bKeys);
  // A tennis match amplifies every small point advantage over many rallies. Keeping the
  // per-point statistical edge moderate preserves credible upsets without flattening progression.
  const skillEdge = (qualityA - qualityB) / 650;
  // Health and fatigue already determine the match's starting energy. Only the remaining
  // match-local energy is compared here, otherwise physical condition is counted twice.
  const physicalEdge = (state.energy[0] - state.energy[1]) / 780;
  const confidenceEdge = (state.confidence[0] - state.confidence[1]) / 1050;
  const momentumEdge = state.momentum / 1900;
  const activeA = state.activeInstructions[0]?.id ?? null;
  const activeB = state.activeInstructions[1]?.id ?? null;
  const pressurePoint = pressure.beneficiaryIndex !== null;
  const instructionEdge =
    instructionChance(activeA, playerA, playerB, aServing, pressurePoint) -
    instructionChance(activeB, playerB, playerA, !aServing, pressurePoint);
  const serverBase = aServing ? 0.535 : 0.465;
  const surfaceEdge =
    surfaceModifier(playerA, state.surface) - surfaceModifier(playerB, state.surface);
  const tacticEdge = tacticModifier(playerA, playerB) - tacticModifier(playerB, playerA);
  const riskEdge = riskChance(playerA) - riskChance(playerB);
  const coachDeckEdge = activeCoachDeckPointChanceModifier(state.coachDeck);
  const total = clamp(
    serverBase +
      skillEdge +
      physicalEdge +
      confidenceEdge +
      momentumEdge +
      surfaceEdge +
      tacticEdge +
      riskEdge +
      instructionEdge +
      coachDeckEdge,
    0.18,
    0.82
  );
  const rounded = (value: number) => Number(value.toFixed(4));
  return {
    total,
    breakdown: {
      service: rounded(serverBase - 0.5),
      statistics: rounded(skillEdge),
      physical: rounded(physicalEdge),
      confidence: rounded(confidenceEdge),
      momentum: rounded(momentumEdge),
      surface: rounded(surfaceEdge),
      tactic: rounded(tacticEdge),
      risk: rounded(riskEdge),
      coaching: rounded(instructionEdge),
      coachDeck: rounded(coachDeckEdge),
      total: rounded(total)
    }
  };
}

function activeInstructionId(state: InteractiveMatchState, playerIndex: 0 | 1) {
  return state.activeInstructions[playerIndex]?.id ?? null;
}

function instructionEnergyMultiplier(state: InteractiveMatchState, playerIndex: 0 | 1) {
  const id = activeInstructionId(state, playerIndex);
  return id ? instructionById(id).energyMultiplier : 1;
}

function updateEnergyAndConfidence(
  state: InteractiveMatchState,
  winnerIndex: 0 | 1,
  rallyLength: number,
  pressure: PressureContext
) {
  for (const playerIndex of [0, 1] as const) {
    const player = state.players[playerIndex];
    const staminaProtection = clamp((player.stats.stamina + player.stats.recovery) / 260, 0, 0.65);
    const drain =
      (0.22 + rallyLength * 0.035) *
      (1 - staminaProtection) *
      instructionEnergyMultiplier(state, playerIndex) *
      (playerIndex === 0 ? activeCoachDeckEnergyDrainMultiplier(state.coachDeck) : 1);
    state.energy[playerIndex] = Number(clamp(state.energy[playerIndex] - drain, 0, 100).toFixed(2));
    const won = winnerIndex === playerIndex;
    const confidenceChange = (won ? 0.42 : -0.36) * (pressure.beneficiaryIndex !== null ? 1.7 : 1);
    state.confidence[playerIndex] = Number(
      clamp(state.confidence[playerIndex] + confidenceChange, 5, 100).toFixed(2)
    );
  }
  const direction = winnerIndex === 0 ? 1 : -1;
  const pressureWeight = pressure.beneficiaryIndex !== null ? 1.45 : 1;
  state.momentum = Number(
    clamp(state.momentum + direction * 4.2 * pressureWeight, -100, 100).toFixed(2)
  );
}

function pointAction(
  state: InteractiveMatchState,
  winnerIndex: 0 | 1,
  patternIndex: number,
  rallyLength: number
) {
  const serverIndex = state.score.serverIndex;
  const server = state.players[serverIndex];
  const loserIndex = winnerIndex === 0 ? 1 : 0;
  const loser = state.players[loserIndex];
  const winnerInstruction = activeInstructionId(state, winnerIndex);
  const serverWon = winnerIndex === serverIndex;
  const loserInstruction = activeInstructionId(state, loserIndex);
  const winnerEffects = winnerInstruction ? instructionById(winnerInstruction) : null;
  const loserEffects = loserInstruction ? instructionById(loserInstruction) : null;
  const riskError = loser.risk === "Forte" ? 0.025 : loser.risk === "Prudente" ? -0.018 : 0;
  const errorChance = clamp(0.12 + riskError + (loserEffects?.errorModifier ?? 0), 0.025, 0.42);
  const winnerChance = clamp(0.24 + (winnerEffects?.winnerModifier ?? 0), 0.08, 0.48);
  const actionRoll = hashRandom(state.seed, state.pointIndex, "action");
  if (patternIndex === 0 && serverWon && actionRoll < 0.12 + server.stats.service / 900)
    return "ace";
  if (
    patternIndex === 0 &&
    !serverWon &&
    actionRoll < 0.025 + (100 - server.stats.composure) / 1800
  )
    return "double faute";
  if (actionRoll < errorChance) return `faute directe de ${loser.name}`;
  if (actionRoll < errorChance + winnerChance) {
    const winners = [
      "coup droit gagnant",
      "revers long de ligne",
      "volée gagnante",
      "passing croisé",
      "amortie gagnante"
    ];
    return (
      winners[randomInt(state.seed, state.pointIndex, "winner", 0, winners.length - 1)] ??
      "coup gagnant"
    );
  }
  return rallyLength >= 10
    ? "échange remporté après un long rallye"
    : "point construit avec patience";
}

function decrementActiveInstructions(state: InteractiveMatchState) {
  for (const playerIndex of [0, 1] as const) {
    const active = state.activeInstructions[playerIndex];
    if (!active) continue;
    active.remainingGames -= 1;
    if (active.remainingGames <= 0) state.activeInstructions[playerIndex] = null;
  }
}

function analysisForState(state: InteractiveMatchState) {
  const player = state.players[0];
  const opponent = state.players[1];
  if (state.energy[0] < 32)
    return "Votre joueur manque d'énergie. Une consigne trop intense pourrait provoquer une baisse physique.";
  if (state.confidence[0] < 38)
    return "Votre joueur doute dans les points importants. Il faut stabiliser sa confiance.";
  if (opponent.stats.backhand + 2 < opponent.stats.forehand)
    return "Le revers adverse paraît plus fragile que son coup droit.";
  if (opponent.stats.forehand + 2 < opponent.stats.backhand)
    return "Le coup droit adverse est actuellement son côté le moins solide.";
  if (player.stats.stamina > opponent.stats.stamina + 3)
    return "Votre avantage d'endurance peut faire la différence dans les échanges longs.";
  if (player.stats.volley + player.stats.netRush > opponent.stats.return + opponent.stats.speed + 5)
    return "L'adversaire paraît vulnérable lorsque vous prenez le filet.";
  return "Le rapport de force est équilibré. Une adaptation tactique peut faire basculer les prochains jeux.";
}

function recommendedInstructions(state: InteractiveMatchState) {
  const recommendations: CoachingInstructionId[] = [];
  const add = (id: CoachingInstructionId) => {
    if (!recommendations.includes(id)) recommendations.push(id);
  };
  const player = state.players[0];
  const opponent = state.players[1];
  if (state.confidence[0] < 45) add("stay-calm");
  if (state.energy[0] < 40) add("conserve-energy");
  if (opponent.stats.backhand <= opponent.stats.forehand) add("attack-backhand");
  else add("attack-forehand");
  if (player.stats.stamina > opponent.stats.stamina) add("extend-rallies");
  else add("shorten-rallies");
  if (state.score.serverIndex === 0) add("secure-second-serve");
  else add("attack-second-serve");
  add("vary-play");
  return recommendations.slice(0, 3);
}

function createCoachWindow(
  state: InteractiveMatchState,
  type: CoachWindowType,
  title: string
): CoachWindow {
  return {
    id: `${type.toLowerCase()}-${state.pointIndex}`,
    type,
    title,
    analysis: analysisForState(state),
    playerIndex: 0,
    recommendedInstructionIds: recommendedInstructions(state),
    score: scoreView(state.score)
  };
}

function openCoachWindow(state: InteractiveMatchState, type: CoachWindowType, title: string) {
  state.status = "AWAITING_COACH";
  state.coachWindow = createCoachWindow(state, type, title);
  state.lastCoachWindowPoint = state.pointIndex;
  if (state.coachDeck) {
    prepareCoachDeckWindow(state.coachDeck, {
      windowId: state.coachWindow.id,
      pointIndex: state.pointIndex,
      seed: state.seed,
      playerStats: coachDeckProfileStats(state.players[0]),
      opponentStats: coachDeckProfileStats(state.players[1]),
      playerEnergy: state.energy[0],
      opponentEnergy: state.energy[1],
      momentum: state.momentum
    });
  }
}

function canOfferInMatchCoaching(state: InteractiveMatchState) {
  if (state.coachDeck) {
    if (state.coachDeck.focus <= 0) return false;
    const lastWindow = state.lastCoachWindowPoint ?? -COACH_WINDOW_COOLDOWN_POINTS;
    return state.pointIndex - lastWindow >= COACH_WINDOW_COOLDOWN_POINTS;
  }
  if (state.coachingPoints[0] <= 0 || state.activeInstructions[0]) return false;
  const lastWindow = state.lastCoachWindowPoint ?? -COACH_WINDOW_COOLDOWN_POINTS;
  return state.pointIndex - lastWindow >= COACH_WINDOW_COOLDOWN_POINTS;
}

function needsChangeoverIntervention(state: InteractiveMatchState) {
  return (
    Math.abs(state.momentum) >= 18 ||
    state.energy[0] < 52 ||
    state.confidence[0] < 48 ||
    state.activeInstructions[0] === null
  );
}

function scoreText(state: InteractiveMatchState) {
  const sets = [...state.score.setHistory];
  if (state.score.games[0] || state.score.games[1]) sets.push([...state.score.games]);
  return sets.map(([a, b]) => `${a}-${b}`).join(" ");
}

function resolvePoint(state: InteractiveMatchState) {
  const pressure = pressureContext(state);
  const patternIndex = randomInt(
    state.seed,
    state.pointIndex,
    "pattern",
    0,
    pointPatterns.length - 1
  );
  const pattern = pointPatterns[patternIndex] ?? pointPatterns[0];
  const probability = pointProbability(state, patternIndex, pressure);
  const probabilityForPlayerA = probability.total;
  const roll = hashRandom(state.seed, state.pointIndex, "result");
  const winnerIndex: 0 | 1 = roll < probabilityForPlayerA ? 0 : 1;
  const rallyLength = randomInt(
    state.seed,
    state.pointIndex,
    "rally",
    2,
    state.surface === "Terre battue" ? 18 : 13
  );
  const action = pointAction(state, winnerIndex, patternIndex, rallyLength);
  const serverId = state.players[state.score.serverIndex].id;
  state.score.pointValues[winnerIndex] += 1;
  updateEnergyAndConfidence(state, winnerIndex, rallyLength, pressure);

  const wonGame = gameWinner(state.score.pointValues, state.score.inTieBreak);
  let completedGame = false;
  let completedSet = false;
  if (wonGame !== null) {
    completedGame = true;
    state.score.games[wonGame] += 1;
    state.score.pointValues = [0, 0];
    if (state.score.inTieBreak) state.score.tieBreakPointCount = 0;
    const wonSet = setWinner(state.score.games, state.score.inTieBreak ? wonGame : null);
    if (wonSet !== null) {
      completedSet = true;
      state.score.sets[wonSet] += 1;
      state.score.setHistory.push([...state.score.games]);
      state.score.games = [0, 0];
      state.score.inTieBreak = false;
      state.coachingPoints[0] = Math.min(MAX_COACHING_POINTS, state.coachingPoints[0] + 1);
    } else if (state.score.games[0] === 6 && state.score.games[1] === 6) {
      state.score.inTieBreak = true;
    }
    state.score.serverIndex = state.score.serverIndex === 0 ? 1 : 0;
    decrementActiveInstructions(state);
  } else if (state.score.inTieBreak) {
    state.score.tieBreakPointCount += 1;
    if (state.score.tieBreakPointCount === 1 || state.score.tieBreakPointCount % 2 === 1) {
      state.score.serverIndex = state.score.serverIndex === 0 ? 1 : 0;
    }
  }

  const event: InteractivePointEvent = {
    index: state.pointIndex,
    serverId,
    winnerId: state.players[winnerIndex].id,
    action,
    rallyLength,
    score: scoreView(state.score),
    probabilityForPlayerA: Number(probabilityForPlayerA.toFixed(4)),
    probabilityBreakdown: probability.breakdown,
    roll: Number(roll.toFixed(4)),
    energy: [...state.energy],
    confidence: [...state.confidence],
    momentum: state.momentum,
    isBreakPoint: pressure.isBreakPoint,
    isSetPoint: pressure.isSetPoint,
    isMatchPoint: pressure.isMatchPoint,
    statKey: pattern.key,
    statLabel: pattern.label,
    activeInstructionIds: [activeInstructionId(state, 0), activeInstructionId(state, 1)],
    activeCoachCardIds: state.coachDeck?.activeEffects.map((effect) => effect.sourceCardId) ?? []
  };
  state.events.push(event);
  if (state.coachDeck) advanceCoachDeckEffects(state.coachDeck, completedGame);
  state.pointIndex += 1;
  state.scoreText = scoreText(state);

  if (
    state.score.sets[0] >= setsNeeded(state.format) ||
    state.score.sets[1] >= setsNeeded(state.format)
  ) {
    state.status = "FINISHED";
    state.winnerId =
      state.score.sets[0] > state.score.sets[1] ? state.players[0].id : state.players[1].id;
    state.coachWindow = null;
    return;
  }

  if (completedSet) {
    if (state.coachDeck) resetCoachDeckFocusForNewSet(state.coachDeck);
    openCoachWindow(state, "SET_BREAK", "PAUSE ENTRE LES SETS");
    return;
  }
  if (
    completedGame &&
    (state.score.games[0] + state.score.games[1]) % 2 === 1 &&
    canOfferInMatchCoaching(state) &&
    needsChangeoverIntervention(state)
  ) {
    openCoachWindow(state, "CHANGEOVER", "POINT TACTIQUE");
  }
}

export function createInteractiveMatch(input: CreateInteractiveMatchInput): InteractiveMatchState {
  const seed = String(input.seed);
  const serverIndex: 0 | 1 = hashRandom(seed, 0, "server") < 0.5 ? 0 : 1;
  // A match starts from a playable baseline, then reflects the player's persistent condition.
  // This keeps preparation meaningful without forcing depleted careers to begin every match at 20%.
  const startingEnergy = (player: EnginePlayer) =>
    clamp(
      80 + (player.energy - 50) * 0.18 + (player.health - 75) * 0.12 - player.fatigue * 0.22,
      40,
      95
    );
  const startingConfidence = (player: EnginePlayer) =>
    clamp(
      ((player.confidence > 0 ? player.confidence : (player.morale + player.recentForm) / 2) * 2 +
        player.morale +
        player.recentForm) /
        4,
      10,
      100
    );
  const state: InteractiveMatchState = {
    version: 3,
    seed,
    surface: input.surface,
    format: input.format,
    players: [structuredClone(input.playerA), structuredClone(input.playerB)],
    status: "PLAYING",
    score: {
      pointValues: [0, 0],
      games: [0, 0],
      sets: [0, 0],
      setHistory: [],
      serverIndex,
      inTieBreak: false,
      tieBreakPointCount: 0
    },
    pointIndex: 0,
    energy: [startingEnergy(input.playerA), startingEnergy(input.playerB)],
    confidence: [startingConfidence(input.playerA), startingConfidence(input.playerB)],
    momentum: 0,
    coachingPoints: [MAX_COACHING_POINTS, MAX_COACHING_POINTS],
    activeInstructions: [null, null],
    coachWindow: null,
    coachingHistory: [],
    coachDeck: input.coachDeckCardIds
      ? createCoachDeckRuntimeState({
          cardIds: input.coachDeckCardIds,
          seed,
          opponentRanking: input.opponentRanking ?? "NC"
        })
      : null,
    events: [],
    lastPressureWindowPoint: null,
    lastCoachWindowPoint: 0,
    winnerId: null,
    scoreText: ""
  };
  openCoachWindow(state, "PRE_MATCH", "PLAN DE MATCH");
  return state;
}

export function applyCoachingDecision(
  inputState: InteractiveMatchState,
  instructionId: CoachingInstructionId | null
) {
  if (inputState.coachDeck) {
    throw new Error("Cette session attend une carte Coach Deck.");
  }
  if (inputState.status !== "AWAITING_COACH" || !inputState.coachWindow) {
    throw new Error("Aucune décision de coaching n'est attendue.");
  }
  const state = cloneState(inputState);
  const window = state.coachWindow;
  if (!window) throw new Error("Fenêtre de coaching introuvable.");
  if (instructionId) {
    if (state.coachingPoints[0] <= 0) throw new Error("Aucun point de coaching disponible.");
    const instruction = instructionById(instructionId);
    if (window.type !== "PRE_MATCH") state.coachingPoints[0] -= 1;
    state.activeInstructions[0] = {
      id: instructionId,
      remainingGames: instruction.durationGames,
      appliedAtPoint: state.pointIndex
    };
    state.confidence[0] = clamp(state.confidence[0] + instruction.initialConfidence, 5, 100);
  }
  state.coachingHistory.push({
    windowId: window.id,
    instructionId,
    playerIndex: 0,
    pointIndex: state.pointIndex
  });
  state.status = "PLAYING";
  state.coachWindow = null;
  return state;
}

export function applyCoachDeckDecision(
  inputState: InteractiveMatchState,
  cardInstanceId: string | null,
  retainInstanceId: string | null = null
) {
  if (inputState.status !== "AWAITING_COACH" || !inputState.coachWindow) {
    throw new Error("Aucune décision Coach Deck n’est attendue.");
  }
  if (!inputState.coachDeck) throw new Error("Cette session n’utilise pas de Coach Deck.");
  const state = cloneState(inputState);
  const window = state.coachWindow;
  const runtime = state.coachDeck;
  if (!window || !runtime) throw new Error("Fenêtre Coach Deck introuvable.");
  const patternIndex = randomInt(
    state.seed,
    state.pointIndex,
    "pattern",
    0,
    pointPatterns.length - 1
  );
  const basePointChance = pointProbability(state, patternIndex, pressureContext(state)).total;
  const result = applyCoachDeckCardDecision(runtime, {
    windowId: window.id,
    pointIndex: state.pointIndex,
    cardInstanceId,
    retainInstanceId,
    playerStats: coachDeckProfileStats(state.players[0]),
    basePointChance,
    currentMomentum: state.momentum
  });
  const preview = result.preview;
  if (preview) {
    state.energy[0] = Number(clamp(state.energy[0] + preview.energyDelta, 0, 100).toFixed(2));
    state.confidence[0] = Number(
      clamp(state.confidence[0] + preview.confidenceDelta, 5, 100).toFixed(2)
    );
    state.momentum = clamp(state.momentum + preview.momentumDelta, -100, 100);
    if (preview.momentumTowardZero > 0) {
      const correction = Math.min(Math.abs(state.momentum), preview.momentumTowardZero);
      state.momentum += state.momentum < 0 ? correction : -correction;
    }
    state.momentum = Number(clamp(state.momentum, -100, 100).toFixed(2));
  }
  state.status = "PLAYING";
  state.coachWindow = null;
  return state;
}

export function advanceInteractiveMatch(inputState: InteractiveMatchState, maxPoints = 120) {
  if (inputState.status !== "PLAYING") return cloneState(inputState);
  const state = cloneState(inputState);
  let played = 0;
  while (state.status === "PLAYING" && played < maxPoints) {
    const pressure = pressureContext(state);
    const importantPressure =
      pressure.isMatchPoint ||
      pressure.isSetPoint ||
      (pressure.isBreakPoint && state.momentum <= -20);
    if (
      pressure.beneficiaryIndex !== null &&
      importantPressure &&
      canOfferInMatchCoaching(state) &&
      state.lastPressureWindowPoint !== state.pointIndex
    ) {
      state.lastPressureWindowPoint = state.pointIndex;
      openCoachWindow(
        state,
        "PRESSURE",
        pressure.isMatchPoint
          ? "BALLE DE MATCH"
          : pressure.isSetPoint
            ? "BALLE DE SET"
            : pressure.isBreakPoint
              ? "BALLE DE BREAK"
              : "POINT IMPORTANT"
      );
      break;
    }
    resolvePoint(state);
    played += 1;
  }
  return state;
}

export function runInteractiveMatchAutomatically(input: CreateInteractiveMatchInput) {
  let state = createInteractiveMatch(input);
  let guard = 0;
  while (state.status !== "FINISHED" && guard < 1200) {
    if (state.status === "AWAITING_COACH") {
      state = state.coachDeck
        ? applyCoachDeckDecision(state, null)
        : applyCoachingDecision(state, null);
    }
    state = advanceInteractiveMatch(state);
    guard += 1;
  }
  if (state.status !== "FINISHED") throw new Error("Le match interactif n'a pas pu être terminé.");
  return state;
}
