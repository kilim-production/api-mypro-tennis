export const automaticMatchStatLabels: Record<string, string> = {
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

export function formatAutomaticAction(value: string) {
  const normalized = value.trim().toLocaleLowerCase("fr-FR");
  const labels: Record<string, string> = {
    ace: "Ace imparable",
    "double faute": "Double faute",
    "faute directe": "Faute directe",
    "faute directe adverse": "Faute provoquée",
    "coup droit croisé": "Coup droit décisif",
    "passing long de ligne": "Passing long de ligne",
    "volée gagnante": "Volée gagnante",
    "revers décroisé": "Revers décisif",
    "amortie masquée": "Amortie parfaite"
  };
  return (
    labels[normalized] ??
    value.replace(/(^|\s)\p{L}/gu, (letter) => letter.toLocaleUpperCase("fr-FR"))
  );
}

export function pointForceRatio(values: readonly [number, number]) {
  const first = Math.max(0, Number(values[0]) || 0);
  const second = Math.max(0, Number(values[1]) || 0);
  const total = first + second;
  if (!total) return [50, 50] as const;
  const firstPercent = Math.round((first / total) * 100);
  return [firstPercent, 100 - firstPercent] as const;
}

export function momentumPosition(value: number) {
  const bounded = Math.max(-0.035, Math.min(0.035, Number(value) || 0));
  return Math.round(50 + (bounded / 0.035) * 50);
}

export function timelineWindow(total: number, current: number, size = 20) {
  if (total <= 0) return [];
  const safeSize = Math.max(1, Math.min(size, total));
  const safeCurrent = Math.max(0, Math.min(total - 1, current));
  const preferredStart = safeCurrent - Math.floor(safeSize * 0.6);
  const start = Math.max(0, Math.min(total - safeSize, preferredStart));
  return Array.from({ length: safeSize }, (_, offset) => start + offset);
}

export function formatReplayClock(
  durationMinutes: number | undefined,
  index: number,
  total: number
) {
  const durationSeconds = Math.max(1, Math.round((durationMinutes ?? 6) * 60));
  const ratio = total > 1 ? Math.max(0, Math.min(1, index / (total - 1))) : 1;
  const currentSeconds = Math.round(durationSeconds * ratio);
  const format = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    return `${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  };
  return { current: format(currentSeconds), total: format(durationSeconds) };
}

export function actionInsight(params: {
  winnerName: string;
  loserName: string;
  statLabel: string;
  winnerValue: number;
  loserValue: number;
  bonus: number;
}) {
  const { winnerName, loserName, statLabel, winnerValue, loserValue, bonus } = params;
  const gap = Math.max(0, Math.round(winnerValue - loserValue));
  if (bonus > 0) {
    return `Le ${statLabel.toLocaleLowerCase("fr-FR")} de ${winnerName}, renforcé par sa forme (+${Math.round(bonus)}), crée un avantage de ${gap} sur ${loserName}.`;
  }
  return `${winnerName} exploite son ${statLabel.toLocaleLowerCase("fr-FR")} et prend ${gap} point${gap > 1 ? "s" : ""} d'avantage sur ${loserName}.`;
}
