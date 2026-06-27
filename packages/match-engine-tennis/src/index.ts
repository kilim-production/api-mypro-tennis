import type { RiskMode, TennisStats, TennisSurface, TennisTactic } from "@mypro/sports-tennis";

export type MatchFormat = "Un set" | "Deux sets gagnants" | "Trois sets gagnants";

export type EnginePlayer = {
  id: string;
  name: string;
  stats: TennisStats;
  matchEnergy: number;
  energy: number;
  morale: number;
  fatigue: number;
  health: number;
  confidence: number;
  recentForm: number;
  tactic: TennisTactic;
  risk: RiskMode;
};

export type PointEvent = {
  index: number;
  serverId: string;
  winnerId: string;
  action: string;
  rallyLength: number;
  comment: string;
  position: { ballX: number; ballY: number; playerAX: number; playerAY: number; playerBX: number; playerBY: number };
  ace: boolean;
  doubleFault: boolean;
  unforcedError: boolean;
  winner: boolean;
  score: MatchScore;
  isBreakPoint: boolean;
  isSetPoint: boolean;
  isMatchPoint: boolean;
  statKey?: keyof TennisStats;
  statLabel?: string;
  statValues?: [number, number];
  rawStatValues?: [number, number];
};

export type MatchScore = {
  points: [string, string];
  games: [number, number];
  sets: [number, number];
  setHistory: Array<[number, number]>;
  serverIndex: 0 | 1;
  inTieBreak: boolean;
};

export type MatchResult = {
  winnerId: string;
  loserId: string;
  surface: TennisSurface;
  format: MatchFormat;
  scoreText: string;
  durationMinutes: number;
  events: PointEvent[];
  finalScore: MatchScore;
  momentum: number[];
};

const pointNames = ["0", "15", "30", "40"];

export class SeededRandom {
  private state: number;

  constructor(seed: string | number) {
    const text = String(seed);
    this.state = 2166136261;
    for (let i = 0; i < text.length; i += 1) {
      this.state ^= text.charCodeAt(i);
      this.state = Math.imul(this.state, 16777619);
    }
  }

  next() {
    this.state += 0x6d2b79f5;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  int(min: number, max: number) {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }
}

export function pointsToLabel(points: [number, number], tieBreak: boolean): [string, string] {
  if (tieBreak) return [String(points[0]), String(points[1])];
  if (points[0] >= 3 && points[1] >= 3) {
    if (points[0] === points[1]) return ["40", "40"];
    return points[0] > points[1] ? ["Av.", "40"] : ["40", "Av."];
  }
  return [pointNames[points[0]] ?? "40", pointNames[points[1]] ?? "40"];
}

export function hasWonGame(points: [number, number], tieBreak: boolean): 0 | 1 | null {
  const target = tieBreak ? 7 : 4;
  if (points[0] >= target && points[0] - points[1] >= 2) return 0;
  if (points[1] >= target && points[1] - points[0] >= 2) return 1;
  return null;
}

export function hasWonSet(games: [number, number], tieBreakWinner: 0 | 1 | null): 0 | 1 | null {
  if (tieBreakWinner !== null) return tieBreakWinner;
  if (games[0] >= 6 && games[0] - games[1] >= 2) return 0;
  if (games[1] >= 6 && games[1] - games[0] >= 2) return 1;
  return null;
}

export function setsNeeded(format: MatchFormat) {
  if (format === "Un set") return 1;
  if (format === "Trois sets gagnants") return 3;
  return 2;
}

function weightedAverage(player: EnginePlayer, keys: Array<keyof TennisStats>) {
  return keys.reduce((sum, key) => sum + player.stats[key], 0) / keys.length;
}

function surfaceModifier(player: EnginePlayer, surface: TennisSurface) {
  const adaptation = (player.stats.surfaceAdaptation - 50) / 350;
  if (surface === "Terre battue") return adaptation + (player.stats.stamina + player.stats.consistency - 100) / 500;
  if (surface === "Gazon") return adaptation + (player.stats.service + player.stats.volley - 100) / 520;
  if (surface === "Indoor") return adaptation + (player.stats.service + player.stats.aggression - 100) / 560;
  return adaptation + (player.stats.footwork + player.stats.baseline - 100) / 620;
}

function normalizeTactic(tactic: string): TennisTactic {
  if (tactic.includes("quilibr")) return "\u00c9quilibr\u00e9" as TennisTactic;
  if (tactic.includes("fensif")) return "D\u00e9fensif" as TennisTactic;
  if (tactic.includes("vol")) return "Service-vol\u00e9e" as TennisTactic;
  if (tactic.includes("vari")) return "Jeu vari\u00e9" as TennisTactic;
  const legacy: Record<string, TennisTactic> = {
    "D?fensif": "D\u00e9fensif" as TennisTactic,
    "?quilibr?": "\u00c9quilibr\u00e9" as TennisTactic,
    "Service-vol?e": "Service-vol\u00e9e" as TennisTactic,
    "Jeu vari?": "Jeu vari\u00e9" as TennisTactic
  };
  return legacy[tactic] ?? (tactic as TennisTactic);
}

function tacticModifier(player: EnginePlayer, opponent: EnginePlayer) {
  const stats = player.stats;
  const opp = opponent.stats;
  const map: Record<string, number> = {
    ["D\u00e9fensif" as TennisTactic]: (stats.consistency + stats.stamina - 100) / 650,
    ["\u00c9quilibr\u00e9" as TennisTactic]: (stats.surfaceAdaptation + stats.footwork - 100) / 900,
    Agressif: (stats.aggression + stats.forehand - 100) / 620,
    ["Service-vol\u00e9e" as TennisTactic]: (stats.service + stats.volley + stats.netRush - 150) / 760,
    Contreur: (stats.return + stats.composure - 100) / 650,
    "Fond de court": (stats.baseline + stats.backhand + stats.forehand - 150) / 760,
    "Attaque du revers adverse": (stats.aggression + stats.forehand - opp.backhand - 35) / 700,
    ["Jeu vari\u00e9" as TennisTactic]: (stats.dropShot + stats.surfaceAdaptation + stats.focus - 150) / 760
  };
  return map[normalizeTactic(player.tactic)] ?? 0;
}

function riskModifier(player: EnginePlayer) {
  if (player.risk === "Prudente") return { chance: -0.01, error: -0.04, winner: -0.02 };
  if (player.risk === "Forte") return { chance: 0.018, error: 0.045, winner: 0.04 };
  return { chance: 0, error: 0, winner: 0 };
}

const mirroredPointStats: Array<keyof TennisStats> = [
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
];

const mirroredPointStatLabels: Record<string, string> = {
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

function resolveMirroredPoint(players: readonly [EnginePlayer, EnginePlayer], rng: SeededRandom) {
  const statKey = mirroredPointStats[rng.int(0, mirroredPointStats.length - 1)] ?? "service";
  const rawA = players[0].stats[statKey] ?? 0;
  const rawB = players[1].stats[statKey] ?? 0;
  const valueA = rawA + players[0].matchEnergy;
  const valueB = rawB + players[1].matchEnergy;
  let winnerIndex: 0 | 1;
  if (valueA > valueB) winnerIndex = 0;
  else if (valueB > valueA) winnerIndex = 1;
  else if (rawA > rawB) winnerIndex = 0;
  else if (rawB > rawA) winnerIndex = 1;
  else winnerIndex = rng.next() >= 0.5 ? 0 : 1;
  return {
    winnerIndex,
    statKey,
    statLabel: mirroredPointStatLabels[statKey] ?? statKey,
    statValues: [valueA, valueB] as [number, number],
    rawStatValues: [rawA, rawB] as [number, number]
  };
}

export function pointWinProbability(server: EnginePlayer, receiver: EnginePlayer, surface: TennisSurface, momentum: number) {
  const serveQuality = weightedAverage(server, ["service", "confidence", "focus", "strength"]);
  const returnQuality = weightedAverage(receiver, ["return", "footwork", "focus", "composure"]);
  const rallyQuality = weightedAverage(server, ["forehand", "backhand", "baseline", "consistency"]);
  const defensiveQuality = weightedAverage(receiver, ["speed", "stamina", "consistency", "fightingSpirit"]);
  const vitals =
    (server.energy - receiver.energy) / 1200 -
    (server.fatigue - receiver.fatigue) / 1150 +
    (server.health - receiver.health) / 1350 +
    (server.morale - receiver.morale) / 1500;
  const serviceEdge = 0.062 + (serveQuality - returnQuality) / 560;
  const rallyEdge = (rallyQuality - defensiveQuality) / 860;
  const form = (server.recentForm - receiver.recentForm + server.confidence - receiver.confidence) / 1250;
  return Math.max(
    0.28,
    Math.min(
      0.72,
      0.5 +
        serviceEdge +
        rallyEdge +
        vitals +
        form +
        surfaceModifier(server, surface) -
        surfaceModifier(receiver, surface) +
        tacticModifier(server, receiver) -
        tacticModifier(receiver, server) * 0.55 +
        riskModifier(server).chance -
        riskModifier(receiver).chance * 0.4 +
        momentum
    )
  );
}

function isPressurePoint(points: [number, number], games: [number, number], sets: [number, number]) {
  return points[0] >= 3 || points[1] >= 3 || games[0] >= 5 || games[1] >= 5 || sets[0] > 0 || sets[1] > 0;
}

function pressureFlags(
  serverIndex: 0 | 1,
  points: [number, number],
  games: [number, number],
  sets: [number, number],
  format: MatchFormat
) {
  const receiverIndex = serverIndex === 0 ? 1 : 0;
  const breakPoint = points[receiverIndex] >= 3 && points[receiverIndex] >= points[serverIndex];
  const setPoint = games[serverIndex] >= 5 || games[receiverIndex] >= 5;
  const matchPoint = setPoint && sets[serverIndex] === setsNeeded(format) - 1;
  return { breakPoint, setPoint, matchPoint };
}

function actionForPoint(
  rng: SeededRandom,
  serverWon: boolean,
  server: EnginePlayer,
  receiver: EnginePlayer,
  surface: TennisSurface
) {
  const serverRisk = riskModifier(server);
  const receiverRisk = riskModifier(receiver);
  const aceChance = Math.max(0.02, (server.stats.service - receiver.stats.return) / 650 + (surface === "Gazon" ? 0.025 : 0.01));
  const doubleFaultChance = Math.max(0.008, (55 - server.stats.composure) / 900 + serverRisk.error / 3);
  const errorChance = Math.max(0.06, 0.16 + serverRisk.error + receiverRisk.error / 2);
  const roll = rng.next();
  const rallyLength = surface === "Terre battue" ? rng.int(5, 18) : surface === "Gazon" ? rng.int(1, 9) : rng.int(3, 14);

  if (serverWon && roll < aceChance) {
    return { action: "ace", rallyLength: 1, ace: true, doubleFault: false, unforcedError: false, winner: true };
  }
  if (!serverWon && roll < doubleFaultChance) {
    return { action: "double faute", rallyLength: 1, ace: false, doubleFault: true, unforcedError: true, winner: false };
  }
  if (roll < errorChance) {
    return {
      action: serverWon ? "faute directe adverse" : "faute directe",
      rallyLength,
      ace: false,
      doubleFault: false,
      unforcedError: true,
      winner: false
    };
  }
  const winners = ["coup droit croisé", "passing long de ligne", "volée gagnante", "revers décroisé", "amortie masquée"];
  return {
    action: winners[rng.int(0, winners.length - 1)] ?? "coup gagnant",
    rallyLength,
    ace: false,
    doubleFault: false,
    unforcedError: false,
    winner: true
  };
}


function mirroredPointComment(point: ReturnType<typeof resolveMirroredPoint>, pointWinner: EnginePlayer) {
  return `${point.statLabel} : ${Math.round(point.statValues[0])} contre ${Math.round(point.statValues[1])}. ${pointWinner.name} gagne le point.`;
}

function scoreText(setHistory: Array<[number, number]>, currentGames: [number, number]) {
  const allSets = [...setHistory];
  if (currentGames[0] || currentGames[1]) allSets.push(currentGames);
  return allSets.map(([a, b]) => `${a}-${b}`).join(" ");
}

export function simulateMatch(input: {
  playerA: EnginePlayer;
  playerB: EnginePlayer;
  surface: TennisSurface;
  format: MatchFormat;
  seed: string | number;
}): MatchResult {
  const rng = new SeededRandom(input.seed);
  const players = [input.playerA, input.playerB] as const;
  let serverIndex: 0 | 1 = rng.next() > 0.5 ? 1 : 0;
  const points: [number, number] = [0, 0];
  const games: [number, number] = [0, 0];
  const sets: [number, number] = [0, 0];
  const setHistory: Array<[number, number]> = [];
  const events: PointEvent[] = [];
  const momentumTrace: number[] = [];
  let momentum = 0;
  let inTieBreak = false;
  let tieBreakPointCount = 0;

  while (sets[0] < setsNeeded(input.format) && sets[1] < setsNeeded(input.format) && events.length < 520) {
    const server = players[serverIndex];
    const receiverIndex = serverIndex === 0 ? 1 : 0;
    const receiver = players[receiverIndex];
    const point = resolveMirroredPoint(players, rng);
    const winnerIndex = point.winnerIndex;
    const serverWon = winnerIndex === serverIndex;
    const winner = players[winnerIndex];
    points[winnerIndex] += 1;

    const action = actionForPoint(rng, serverWon, server, receiver, input.surface);
    const flags = pressureFlags(serverIndex, points, games, sets, input.format);
    const gameWinner = hasWonGame(points, inTieBreak);

    if (gameWinner !== null) {
      games[gameWinner] += 1;
      points[0] = 0;
      points[1] = 0;
      if (inTieBreak) {
        tieBreakPointCount = 0;
      }
      const setWinner = hasWonSet(games, inTieBreak ? gameWinner : null);
      if (setWinner !== null) {
        sets[setWinner] += 1;
        setHistory.push([games[0], games[1]]);
        games[0] = 0;
        games[1] = 0;
        inTieBreak = false;
      } else if (games[0] === 6 && games[1] === 6) {
        inTieBreak = true;
      }
      serverIndex = serverIndex === 0 ? 1 : 0;
    } else if (inTieBreak) {
      tieBreakPointCount += 1;
      if (tieBreakPointCount === 1 || tieBreakPointCount % 2 === 1) {
        serverIndex = serverIndex === 0 ? 1 : 0;
      }
    }

    const pressure = isPressurePoint(points, games, sets) ? 1.15 : 1;
    momentum = Math.max(-0.035, Math.min(0.035, momentum + (winnerIndex === 0 ? 0.0055 : -0.0055) * pressure));
    momentumTrace.push(Number(momentum.toFixed(3)));

    events.push({
      index: events.length,
      serverId: server.id,
      winnerId: winner.id,
      action: action.action,
      rallyLength: action.rallyLength,
      comment: mirroredPointComment(point, winner),
      position: {
        ballX: Number((0.2 + rng.next() * 0.6).toFixed(2)),
        ballY: Number((0.12 + rng.next() * 0.76).toFixed(2)),
        playerAX: Number((0.24 + rng.next() * 0.18).toFixed(2)),
        playerAY: Number((0.18 + rng.next() * 0.26).toFixed(2)),
        playerBX: Number((0.58 + rng.next() * 0.18).toFixed(2)),
        playerBY: Number((0.56 + rng.next() * 0.26).toFixed(2))
      },
      ace: action.ace,
      doubleFault: action.doubleFault,
      unforcedError: action.unforcedError,
      winner: action.winner,
      score: {
        points: pointsToLabel(points, inTieBreak),
        games: [games[0], games[1]],
        sets: [sets[0], sets[1]],
        setHistory: [...setHistory],
        serverIndex,
        inTieBreak
      },
      isBreakPoint: flags.breakPoint,
      isSetPoint: flags.setPoint,
      isMatchPoint: flags.matchPoint,
      statKey: point.statKey,
      statLabel: point.statLabel,
      statValues: point.statValues,
      rawStatValues: point.rawStatValues
    });
  }

  const winnerIndex = sets[0] > sets[1] ? 0 : 1;
  const loserIndex = winnerIndex === 0 ? 1 : 0;
  return {
    winnerId: players[winnerIndex].id,
    loserId: players[loserIndex].id,
    surface: input.surface,
    format: input.format,
    scoreText: scoreText(setHistory, games),
    durationMinutes: Math.max(28, Math.round(events.length * 0.65 + rng.int(4, 18))),
    events,
    finalScore: {
      points: pointsToLabel(points, inTieBreak),
      games: [games[0], games[1]],
      sets: [sets[0], sets[1]],
      setHistory,
      serverIndex,
      inTieBreak
    },
    momentum: momentumTrace
  };
}
