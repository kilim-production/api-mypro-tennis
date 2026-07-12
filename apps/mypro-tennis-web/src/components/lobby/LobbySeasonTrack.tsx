import { Check, Gift } from "lucide-react";

type LobbySeasonTrackProps = {
  seasonLabel: string;
  day?: number | undefined;
  rewardReady: boolean;
  onClick: () => void;
};

function visibleDays(day: number) {
  const start = Math.max(1, Math.min(25, day - 4));
  return Array.from({ length: 6 }, (_, index) => start + index);
}

export function LobbySeasonTrack({
  seasonLabel,
  day,
  rewardReady,
  onClick
}: LobbySeasonTrackProps) {
  const currentDay = day ?? 1;

  return (
    <button className="lobby-season-track" onClick={onClick} type="button">
      <div className="lobby-season-title">
        <strong>{seasonLabel}</strong>
        <span>Jour {day ?? "…"}/30</span>
      </div>
      <div className="lobby-season-progress" aria-label={`Progression : jour ${currentDay} sur 30`}>
        <i aria-hidden="true" />
        {visibleDays(currentDay).map((visibleDay) => {
          const state =
            visibleDay < currentDay ? "is-done" : visibleDay === currentDay ? "is-current" : "";
          return (
            <span className={state} key={visibleDay}>
              {visibleDay < currentDay ? <Check size={12} /> : visibleDay}
            </span>
          );
        })}
        <span className="is-reward" aria-label="Coffre de fin de progression">
          <Gift size={15} />
        </span>
      </div>
      <div className="lobby-daily-reward">
        <span>Récompense du jour</span>
        <strong>{rewardReady ? "Récupérer" : "Voir la saison"}</strong>
      </div>
    </button>
  );
}
