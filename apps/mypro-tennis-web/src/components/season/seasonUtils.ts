import type { SeasonCompetition, SeasonEntry } from "./types";

const seasonStats = [
  ["service", "Service"],
  ["return", "Retour"],
  ["forehand", "Coup droit"],
  ["backhand", "Revers"],
  ["volley", "Volée"],
  ["smash", "Smash"],
  ["dropShot", "Amortie"],
  ["stamina", "Endurance"],
  ["speed", "Vitesse"],
  ["explosiveness", "Explosivité"],
  ["strength", "Force"],
  ["recovery", "Récupération"]
] as const;

export type SeasonPathStep = {
  label: string;
  opponentLabel: string;
  opponentRanking: string;
  state: "won" | "lost" | "current" | "locked";
  scoreText?: string | undefined;
  replayMatchId?: string | undefined;
};

export function formatSeasonCredits(value: number) {
  return `${value.toLocaleString("fr-FR")} CR`;
}

export function formatSeasonRemaining(ms: number) {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  if (hours > 0) {
    return `${hours}h ${String(minutes).padStart(2, "0")}m ${String(rest).padStart(2, "0")}s`;
  }
  return `${minutes}m ${String(rest).padStart(2, "0")}s`;
}

export function formatSeasonEndRemaining(ms: number) {
  const hours = Math.max(0, Math.ceil(ms / 3_600_000));
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return `${days}j ${String(remainingHours).padStart(2, "0")}h`;
}

export function seasonCompetitionLabel(type: SeasonCompetition["type"]) {
  if (type === "daily") return "Journalier";
  if (type === "weekly") return "Hebdomadaire";
  return "Championnat";
}

export function seasonDisplayNumber(key?: string | null) {
  const match = key?.match(/(\d+)/);
  return match?.[1] ?? "1";
}

export function seasonEntryStatus(entry: SeasonEntry | null) {
  if (!entry) return "Non inscrit";
  return entry.championTitle ?? entry.status.replaceAll("_", " ");
}

export function seasonNextRanking(entry: SeasonEntry | null) {
  if (!entry) return null;
  if (entry.bracket.mode === "pyramide") {
    return entry.bracket.path?.[entry.currentRound]?.ranking ?? null;
  }
  return entry.bracket.opponents?.[entry.currentRound]?.ranking ?? null;
}

export function seasonTournamentRoundCount(drawSize: number) {
  return Math.max(1, Math.ceil(Math.log2(Math.max(2, drawSize))));
}

export function seasonTournamentRoundLabel(drawSize: number, currentRound: number) {
  const matches = Math.max(1, Math.round(drawSize / 2 ** (currentRound + 1)));
  if (matches === 1) return "Finale";
  if (matches === 2) return "1/2 finale";
  if (matches === 4) return "1/4 de finale";
  if (matches === 8) return "1/8 de finale";
  return `Tour ${currentRound + 1}`;
}

export function seasonTacticalInsights(
  playerStats: Record<string, number>,
  opponentStats: Record<string, number>
) {
  const compared = seasonStats.map(([key, label]) => ({
    key,
    label,
    playerValue: playerStats[key] ?? 0,
    opponentValue: opponentStats[key] ?? 0,
    delta: (playerStats[key] ?? 0) - (opponentStats[key] ?? 0)
  }));
  const advantage = compared.reduce((best, item) => (item.delta > best.delta ? item : best));
  const danger = compared.reduce((best, item) =>
    item.opponentValue > best.opponentValue ? item : best
  );
  return { advantage, danger };
}

export function seasonTournamentBranch(entry: SeasonEntry): SeasonPathStep[] {
  return (entry.bracket.rounds ?? []).map((round, roundIndex) => {
    const playerMatch = round.matches.find(
      (match) => Boolean(match.left?.isPlayer || match.right?.isPlayer)
    );
    if (!playerMatch) {
      return {
        label: round.name,
        opponentLabel: "À déterminer",
        opponentRanking: "—",
        state: "locked"
      };
    }
    const opponent = playerMatch.left?.isPlayer ? playerMatch.right : playerMatch.left;
    const state = playerMatch.winner
      ? playerMatch.winner.isPlayer
        ? "won"
        : "lost"
      : roundIndex === entry.currentRound
        ? "current"
        : "locked";
    return {
      label: round.name,
      opponentLabel: opponent?.label ?? "À déterminer",
      opponentRanking: opponent?.ranking ?? "—",
      state,
      scoreText: playerMatch.scoreText,
      replayMatchId: playerMatch.replayMatchId
    };
  });
}

export function seasonChampionshipPath(entry: SeasonEntry): SeasonPathStep[] {
  const terminal = ["ELIMINE", "VAINQUEUR", "CHAMPION_NATIONAL"].includes(entry.status);
  return (entry.bracket.path ?? []).map((step, index) => {
    const match = entry.matches[index];
    const isCurrent = !terminal && index === entry.currentRound;
    const preview = isCurrent ? entry.nextOpponent : null;
    return {
      label: step.label ?? `Palier ${index + 1}`,
      opponentLabel: match?.opponentName ??
        (preview ? `${preview.firstName} ${preview.lastName}` : "À déterminer"),
      opponentRanking: match?.opponentRanking ?? preview?.fftRanking ?? step.ranking,
      state: match ? (match.won ? "won" : "lost") : isCurrent ? "current" : "locked",
      scoreText: match?.scoreText,
      replayMatchId: match?.matchId
    };
  });
}
