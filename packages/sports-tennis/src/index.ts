export type TennisSurface = "Dur" | "Terre battue" | "Gazon" | "Indoor";
export type TennisTactic =
  | "Défensif"
  | "Équilibré"
  | "Agressif"
  | "Service-volée"
  | "Contreur"
  | "Fond de court"
  | "Attaque du revers adverse"
  | "Jeu varié";
export type RiskMode = "Prudente" | "Normale" | "Forte";
export type CareerStage = "Amateur" | "Pré-pro" | "Professionnel";

export const fftRankingPath = [
  "NC",
  "40/2",
  "40/1",
  "40",
  "30/5",
  "30/4",
  "30/3",
  "30/2",
  "30/1",
  "30",
  "15/5",
  "15/4",
  "15/3",
  "15/2",
  "15/1",
  "15",
  "5/6",
  "4/6",
  "3/6",
  "2/6",
  "1/6",
  "0",
  "-2/6",
  "-4/6",
  "-15"
] as const;
export type FftRanking = (typeof fftRankingPath)[number];
export const fftFullRankingPath = fftRankingPath;
export type FftFullRanking = FftRanking;
export const fftNegativeValidationPoints = 3500;

export const fftRankingMeta: Record<FftRanking, { series: string; requiredPoints: number; label: string }> = {
  NC: { series: "Non classé", requiredPoints: 0, label: "Premier pas en compétition" },
  "40/2": { series: "4e série", requiredPoints: 30, label: "Entrée en classement FFT" },
  "40/1": { series: "4e série", requiredPoints: 60, label: "Premiers repères en tournoi" },
  "40": { series: "4e série", requiredPoints: 90, label: "Base compétitive installée" },
  "30/5": { series: "4e série", requiredPoints: 130, label: "Progression de club" },
  "30/4": { series: "4e série", requiredPoints: 180, label: "Rythme de match régulier" },
  "30/3": { series: "4e série", requiredPoints: 240, label: "Niveau club solide" },
  "30/2": { series: "4e série", requiredPoints: 310, label: "Compétiteur confirmé" },
  "30/1": { series: "4e série", requiredPoints: 390, label: "Haut de 4e série" },
  "30": { series: "3e série", requiredPoints: 480, label: "Entrée en 3e série" },
  "15/5": { series: "3e série", requiredPoints: 590, label: "3e série lancée" },
  "15/4": { series: "3e série", requiredPoints: 720, label: "Niveau régional" },
  "15/3": { series: "3e série", requiredPoints: 870, label: "Régularité confirmée" },
  "15/2": { series: "3e série", requiredPoints: 1040, label: "Porte du haut niveau amateur" },
  "15/1": { series: "3e série", requiredPoints: 1230, label: "Point de référence amateur" },
  "15": { series: "2e série", requiredPoints: 1450, label: "Entrée en deuxième série" },
  "5/6": { series: "2e série", requiredPoints: 1680, label: "Niveau régional confirmé" },
  "4/6": { series: "2e série", requiredPoints: 1920, label: "Niveau national jeune" },
  "3/6": { series: "2e série", requiredPoints: 2170, label: "Niveau national solide" },
  "2/6": { series: "2e série", requiredPoints: 2440, label: "Candidat au haut niveau" },
  "1/6": { series: "2e série", requiredPoints: 2720, label: "Référence nationale" },
  "0": { series: "2e série", requiredPoints: 3000, label: "Seuil élite amateur" },
  "-2/6": { series: "Négatifs", requiredPoints: 3260, label: "Pré-pro national" },
  "-4/6": { series: "Négatifs", requiredPoints: 3420, label: "Très haut niveau amateur" },
  "-15": { series: "Négatifs", requiredPoints: 3500, label: "Classement à valider pour passer professionnel" }
};

export function getCareerStage(fftRanking: FftRanking, proUnlocked: boolean): CareerStage {
  if (proUnlocked) return "Professionnel";
  return ["-2/6", "-4/6", "-15"].includes(fftRanking) ? "Pré-pro" : "Amateur";
}

export function getFftRankingForPoints(points: number): FftRanking {
  return [...fftRankingPath]
    .reverse()
    .find((ranking) => points >= fftRankingMeta[ranking].requiredPoints) ?? "NC";
}

export function isProfessionalUnlocked(fftRanking: FftRanking, fftRankingValidated: boolean) {
  return fftRanking === "-15" && fftRankingValidated;
}

export function isFftNegativeValidated(points: number, fftRanking: FftRanking) {
  return fftRanking === "-15" && points >= fftNegativeValidationPoints;
}

export function nextFftRanking(fftRanking: FftRanking) {
  const index = fftRankingPath.indexOf(fftRanking);
  return fftRankingPath[index + 1] ?? null;
}

export function amateurMatchPoints(input: { won: boolean; opponentOverall: number; playerOverall: number; official?: boolean }) {
  if (!input.official) return 0;
  const levelDelta = input.opponentOverall - input.playerOverall;
  if (input.won) return Math.max(30, Math.round(80 + levelDelta * 5));
  return levelDelta >= 6 ? 18 : 6;
}

type FftNorm = { female: { minimum: number; wins: number }; male: { minimum: number; wins: number } };

export const fftNorms: Record<FftFullRanking, FftNorm> = {
  NC: { female: { minimum: 0, wins: 0 }, male: { minimum: 0, wins: 0 } },
  "40/2": { female: { minimum: 0, wins: 6 }, male: { minimum: 0, wins: 6 } },
  "40/1": { female: { minimum: 0, wins: 6 }, male: { minimum: 0, wins: 6 } },
  "40": { female: { minimum: 0, wins: 6 }, male: { minimum: 0, wins: 6 } },
  "30/5": { female: { minimum: 6, wins: 6 }, male: { minimum: 6, wins: 6 } },
  "30/4": { female: { minimum: 70, wins: 6 }, male: { minimum: 70, wins: 6 } },
  "30/3": { female: { minimum: 120, wins: 6 }, male: { minimum: 120, wins: 6 } },
  "30/2": { female: { minimum: 170, wins: 6 }, male: { minimum: 170, wins: 6 } },
  "30/1": { female: { minimum: 210, wins: 6 }, male: { minimum: 210, wins: 6 } },
  "30": { female: { minimum: 265, wins: 8 }, male: { minimum: 285, wins: 8 } },
  "15/5": { female: { minimum: 295, wins: 8 }, male: { minimum: 305, wins: 8 } },
  "15/4": { female: { minimum: 305, wins: 8 }, male: { minimum: 315, wins: 8 } },
  "15/3": { female: { minimum: 310, wins: 8 }, male: { minimum: 325, wins: 8 } },
  "15/2": { female: { minimum: 330, wins: 8 }, male: { minimum: 340, wins: 8 } },
  "15/1": { female: { minimum: 350, wins: 8 }, male: { minimum: 370, wins: 8 } },
  "15": { female: { minimum: 390, wins: 9 }, male: { minimum: 430, wins: 9 } },
  "5/6": { female: { minimum: 400, wins: 9 }, male: { minimum: 445, wins: 9 } },
  "4/6": { female: { minimum: 430, wins: 9 }, male: { minimum: 445, wins: 9 } },
  "3/6": { female: { minimum: 500, wins: 10 }, male: { minimum: 485, wins: 10 } },
  "2/6": { female: { minimum: 560, wins: 11 }, male: { minimum: 515, wins: 10 } },
  "1/6": { female: { minimum: 610, wins: 12 }, male: { minimum: 565, wins: 11 } },
  "0": { female: { minimum: 630, wins: 14 }, male: { minimum: 625, wins: 12 } },
  "-2/6": { female: { minimum: 750, wins: 15 }, male: { minimum: 780, wins: 15 } },
  "-4/6": { female: { minimum: 750, wins: 16 }, male: { minimum: 880, wins: 17 } },
  "-15": { female: { minimum: 800, wins: 17 }, male: { minimum: 950, wins: 19 } }
};

export type FftOfficialResult = {
  won: boolean;
  opponentRanking: FftFullRanking;
  playedAt: Date | string;
  coefficient?: number;
};

export function fftRankIndex(ranking: string) {
  const index = fftFullRankingPath.indexOf(ranking as FftFullRanking);
  return index === -1 ? fftFullRankingPath.indexOf("NC") : index;
}

export function fftVictoryPoints(candidateRanking: FftFullRanking, opponentRanking: FftFullRanking, coefficient = 1) {
  if (candidateRanking === "NC" && opponentRanking === "NC") return Math.round(30 * coefficient);
  const delta = fftRankIndex(opponentRanking) - fftRankIndex(candidateRanking);
  const points = delta >= 2 ? 120 : delta === 1 ? 90 : delta === 0 ? 60 : delta === -1 ? 30 : delta === -2 ? 20 : delta === -3 ? 15 : 0;
  return Math.round(points * coefficient);
}

function fftSeries(ranking: FftFullRanking) {
  const index = fftRankIndex(ranking);
  if (index <= fftRankIndex("30/1")) return "4";
  if (index <= fftRankIndex("15/1")) return "3";
  if (index <= fftRankIndex("0")) return "2-positive";
  return "2-negative";
}

export function fftDeltaBonus(candidateRanking: FftFullRanking, delta: number) {
  const series = fftSeries(candidateRanking);
  if (series === "4") {
    if (delta >= 25) return 6;
    if (delta >= 20) return 5;
    if (delta >= 15) return 4;
    if (delta >= 10) return 3;
    if (delta >= 5) return 2;
    if (delta >= 0) return 1;
    return 0;
  }
  if (series === "3") {
    if (delta >= 40) return 6;
    if (delta >= 30) return 5;
    if (delta >= 23) return 4;
    if (delta >= 15) return 3;
    if (delta >= 8) return 2;
    if (delta >= 0) return 1;
    return 0;
  }
  if (series === "2-positive") {
    if (delta <= -41) return -3;
    if (delta <= -31) return -2;
    if (delta <= -21) return -1;
    if (delta <= -1) return 0;
    if (delta >= 40) return 6;
    if (delta >= 30) return 5;
    if (delta >= 23) return 4;
    if (delta >= 15) return 3;
    if (delta >= 8) return 2;
    return 1;
  }
  if (delta <= -81) return -5;
  if (delta <= -61) return -4;
  if (delta <= -41) return -3;
  if (delta <= -31) return -2;
  if (delta <= -21) return -1;
  if (delta <= -1) return 0;
  if (delta >= 45) return 7;
  if (delta >= 35) return 6;
  if (delta >= 30) return 5;
  if (delta >= 25) return 4;
  if (delta >= 20) return 3;
  if (delta >= 10) return 2;
  return 1;
}

export function calculateFftRanking(input: {
  currentRanking: FftFullRanking;
  gender: "Femme" | "Homme";
  results: FftOfficialResult[];
  now?: Date | string;
}) {
  const now = new Date(input.now ?? new Date());
  const seasonStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const results = input.results.filter((result) => new Date(result.playedAt).getTime() >= seasonStart.getTime());
  const genderKey = input.gender === "Homme" ? "male" : "female";
  const currentIndex = fftRankIndex(input.currentRanking);
  let best = input.currentRanking;
  let bestPoints = 0;
  let bestTakenWins = 0;

  for (let index = currentIndex; index < fftFullRankingPath.length; index += 1) {
    const candidate = fftFullRankingPath[index]!;
    const norm = fftNorms[candidate][genderKey];
    const wins = results.filter((result) => result.won);
    const sameOrBetterWin = wins.some((result) => fftRankIndex(result.opponentRanking) >= fftRankIndex(candidate));
    if (candidate !== input.currentRanking && !sameOrBetterWin) break;

    const losses = results.filter((result) => !result.won);
    const equalLosses = losses.filter((result) => fftRankIndex(result.opponentRanking) === fftRankIndex(candidate)).length;
    const oneBelowLosses = losses.filter((result) => fftRankIndex(result.opponentRanking) === fftRankIndex(candidate) - 1).length;
    const bigLosses = losses.filter((result) => fftRankIndex(result.opponentRanking) <= fftRankIndex(candidate) - 2).length;
    const delta = wins.length - equalLosses - 2 * oneBelowLosses - 5 * bigLosses;
    const winsToKeep = Math.max(0, norm.wins + fftDeltaBonus(candidate, delta));
    const victoryPoints = wins
      .map((result) => fftVictoryPoints(candidate, result.opponentRanking, result.coefficient ?? 1))
      .sort((a, b) => b - a);
    const points = victoryPoints.slice(0, winsToKeep).reduce((sum, value) => sum + value, 0);
    if (points >= norm.minimum) {
      best = candidate;
      bestPoints = points;
      bestTakenWins = winsToKeep;
    } else if (candidate !== input.currentRanking) {
      break;
    }
  }

  const fftRankingValidated = best === "-15" && bestPoints >= fftNorms["-15"][genderKey].minimum;
  return {
    ranking: best,
    points: bestPoints,
    takenWins: bestTakenWins,
    matchCount: results.length,
    wins: results.filter((result) => result.won).length,
    losses: results.filter((result) => !result.won).length,
    fftRankingValidated,
    proUnlocked: best === "-15" && fftRankingValidated
  };
}

export const statKeys = [
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
  "recovery",
  "focus",
  "confidence",
  "composure",
  "fightingSpirit",
  "consistency",
  "aggression",
  "baseline",
  "netRush",
  "footwork",
  "surfaceAdaptation"
] as const;

export type TennisStatKey = (typeof statKeys)[number];
export type TennisStats = Record<TennisStatKey, number>;

export const statLabels: Record<TennisStatKey, string> = {
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
  recovery: "Récupération",
  focus: "Concentration",
  confidence: "Confiance",
  composure: "Sang-froid",
  fightingSpirit: "Combativité",
  consistency: "Régularité",
  aggression: "Agressivité",
  baseline: "Jeu de fond de court",
  netRush: "Montée au filet",
  footwork: "Qualité de déplacement",
  surfaceAdaptation: "Adaptation de surface"
};

export const baseStats: TennisStats = {
  service: 0,
  return: 0,
  forehand: 0,
  backhand: 0,
  volley: 0,
  smash: 0,
  dropShot: 0,
  stamina: 0,
  speed: 0,
  explosiveness: 0,
  strength: 0,
  recovery: 0,
  focus: 0,
  confidence: 0,
  composure: 0,
  fightingSpirit: 0,
  consistency: 0,
  aggression: 0,
  baseline: 0,
  netRush: 0,
  footwork: 0,
  surfaceAdaptation: 0
};

export const playableStatKeys = [
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

export const archetypeModifiers: Record<string, Partial<TennisStats>> = {
  "Gros service": { service: 7, smash: 4, strength: 5, explosiveness: 3, recovery: 2, forehand: 2, stamina: 2 },
  "Relanceur": { return: 7, backhand: 4, speed: 4, stamina: 3, recovery: 3, forehand: 2, dropShot: 2 },
  "Frappeur de fond": { forehand: 6, backhand: 5, stamina: 4, strength: 3, speed: 3, service: 2, recovery: 2 },
  "Athlète endurant": { stamina: 6, recovery: 5, speed: 4, explosiveness: 3, return: 3, backhand: 2, forehand: 2 },
  "Joueur complet": { service: 3, return: 3, forehand: 3, backhand: 3, volley: 2, smash: 2, dropShot: 2, stamina: 2, speed: 2, explosiveness: 1, strength: 1, recovery: 1 }
};

export function createStatsForArchetype(archetype: string): TennisStats {
  const stats = { ...baseStats };
  const modifiers = archetypeModifiers[archetype] ?? archetypeModifiers["Joueur complet"] ?? {};
  for (const [key, value] of Object.entries(modifiers)) {
    stats[key as TennisStatKey] = Math.max(0, Math.min(100, stats[key as TennisStatKey] + (value ?? 0)));
  }
  return stats;
}

export const trainings = [
  {
    id: "service-basket",
    name: "Panier de services",
    category: "Technique",
    durationMinutes: 3,
    cost: 150,
    fatigue: 9,
    difficulty: "Moyenne",
    risk: 4,
    gains: { service: 0.8, confidence: 0.2 }
  },
  {
    id: "return-work",
    name: "Travail du retour",
    category: "Technique",
    durationMinutes: 4,
    cost: 130,
    fatigue: 8,
    difficulty: "Moyenne",
    risk: 3,
    gains: { return: 0.75, focus: 0.25 }
  },
  {
    id: "endurance",
    name: "Endurance",
    category: "Physique",
    durationMinutes: 5,
    cost: 90,
    fatigue: 12,
    difficulty: "Élevée",
    risk: 6,
    gains: { stamina: 0.85, recovery: 0.2 }
  },
  {
    id: "pressure",
    name: "Gestion de la pression",
    category: "Mental",
    durationMinutes: 3,
    cost: 180,
    fatigue: 4,
    difficulty: "Fine",
    risk: 1,
    gains: { composure: 0.55, focus: 0.45, confidence: 0.2 }
  },
  {
    id: "clay-plan",
    name: "Plan de jeu sur terre battue",
    category: "Tactique",
    durationMinutes: 4,
    cost: 160,
    fatigue: 5,
    difficulty: "Moyenne",
    risk: 2,
    gains: { baseline: 0.45, surfaceAdaptation: 0.5, consistency: 0.2 }
  },
  {
    id: "net-play",
    name: "Jeu au filet",
    category: "Technique",
    durationMinutes: 4,
    cost: 140,
    fatigue: 7,
    difficulty: "Technique",
    risk: 4,
    gains: { volley: 0.7, netRush: 0.45, smash: 0.2 }
  }
];

export const demoTournaments = [
  {
    id: "azure-open",
    name: "Open d'Azur",
    location: "Port-Lumière",
    surface: "Dur" as TennisSurface,
    category: "Régional",
    entryFee: 250,
    prize: 1800,
    points: 80,
    players: 16,
    recommendedLevel: 46
  },
  {
    id: "terra-cup",
    name: "Coupe Terra Nova",
    location: "Montclar",
    surface: "Terre battue" as TennisSurface,
    category: "National",
    entryFee: 550,
    prize: 4200,
    points: 180,
    players: 16,
    recommendedLevel: 55
  },
  {
    id: "northern-indoor",
    name: "Northern Indoor Series",
    location: "Val-Nord",
    surface: "Indoor" as TennisSurface,
    category: "International",
    entryFee: 900,
    prize: 9000,
    points: 320,
    players: 16,
    recommendedLevel: 64
  }
];
