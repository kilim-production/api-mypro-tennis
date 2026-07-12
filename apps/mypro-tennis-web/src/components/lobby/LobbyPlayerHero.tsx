import type { ReactNode } from "react";

type HeroStat = {
  key: string;
  value: number;
  icon: ReactNode;
};

type LobbyPlayerHeroProps = {
  name: string;
  ranking: string;
  portraitSrc: string;
  heroSrc?: string | undefined;
  stats: HeroStat[];
};

export function LobbyPlayerHero({
  name,
  ranking,
  portraitSrc,
  heroSrc,
  stats
}: LobbyPlayerHeroProps) {
  return (
    <div className="lobby-player-card">
      <div className="lobby-player-glow" aria-hidden="true" />
      <div className={`lobby-player-visual ${heroSrc ? "has-cutout" : "is-portrait-fallback"}`}>
        <img src={heroSrc ?? portraitSrc} alt={`Joueur ${name}`} />
      </div>
      <div className="lobby-player-rank">
        <span>{ranking}</span>
        <small>Classement</small>
      </div>
      <div className="lobby-player-name">
        <p>Carrière active</p>
        <h1>{name}</h1>
      </div>
      <div className="lobby-stat-chips">
        {stats.map((item) => (
          <span key={item.key}>
            {item.icon}
            <strong>{Math.round(item.value)}</strong>
          </span>
        ))}
      </div>
    </div>
  );
}
