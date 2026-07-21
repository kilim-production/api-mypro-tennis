import { useCallback, useEffect, useState } from "react";
import type React from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Coins,
  Eye,
  Gem,
  Gift,
  HelpCircle,
  Lock,
  PackageOpen,
  Play,
  Repeat2,
  Settings,
  Shield,
  Target,
  Ticket,
  Trophy,
  X,
  Zap
} from "lucide-react";
import { api } from "../../api";
import { useGameStore, type Player } from "../../store";
import {
  formatSeasonCredits,
  formatSeasonEndRemaining,
  formatSeasonRemaining,
  seasonDisplayNumber,
  seasonChampionshipPath,
  seasonEntryStatus,
  seasonNextRanking,
  seasonTacticalInsights,
  seasonTournamentBranch,
  seasonTournamentRoundCount,
  seasonTournamentRoundLabel
} from "./seasonUtils";
import {
  invalidateSeasonDataCache,
  peekSeasonData,
  requestSeasonData
} from "./seasonDataCache";
import type {
  ChestRarity,
  SeasonChestRewards,
  SeasonCompetition,
  SeasonDailyReward,
  SeasonData,
  SeasonEntry
} from "./types";
import "./season.css";

type MatchCreationResult = { match: { id: string } };

type SeasonPageProps = {
  resolveHeroSource: (avatar: string) => string | undefined;
  resolvePictureSource: (avatar: string) => string;
};

function SeasonHeader({
  seasonKey,
  player,
  onBack,
  onHelp,
  onSettings
}: {
  seasonKey: string | undefined;
  player: Player | null;
  onBack: () => void;
  onHelp: () => void;
  onSettings: () => void;
}) {
  return (
    <header className="season-header">
      <button className="season-icon-button season-back" onClick={onBack} type="button">
        <ArrowLeft aria-hidden="true" size={25} />
        <span className="sr-only">Retour au hub</span>
      </button>
      <div className="season-brand" aria-label="MyPro Tennis">
        <strong>MYPRO</strong>
        <span>TENNIS</span>
      </div>
      <h1>SAISON {seasonDisplayNumber(seasonKey)}</h1>
      <div className="season-header-actions">
        <div className="season-resource season-resource-energy" aria-label="Énergie">
          <Zap aria-hidden="true" size={20} />
          <span>
            <small>Énergie</small>
            <strong>{player ? `${player.actionEnergy}/${player.actionEnergyMax}` : "—"}</strong>
          </span>
        </div>
        <div className="season-resource season-resource-gems" aria-label="Gemmes">
          <Gem aria-hidden="true" size={19} />
          <span>
            <small>Gemmes</small>
            <strong>{player?.gems.toLocaleString("fr-FR") ?? "—"}</strong>
          </span>
        </div>
        <div className="season-resource season-resource-credits" aria-label="Crédits">
          <Coins aria-hidden="true" size={20} />
          <span>
            <small>Crédits</small>
            <strong>{player ? formatSeasonCredits(player.budget) : "—"}</strong>
          </span>
        </div>
        <button className="season-icon-button season-header-help" onClick={onHelp} type="button">
          <HelpCircle aria-hidden="true" size={20} />
          <span className="sr-only">Ouvrir le tutoriel</span>
        </button>
        <button className="season-icon-button" onClick={onSettings} type="button">
          <Settings aria-hidden="true" size={20} />
          <span className="sr-only">Réglages</span>
        </button>
        <button className="season-icon-button season-close" onClick={onBack} type="button">
          <X aria-hidden="true" size={23} />
          <span className="sr-only">Fermer</span>
        </button>
      </div>
    </header>
  );
}

function SeasonButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`game-button inline-flex items-center justify-center gap-2 rounded-md bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:opacity-50 ${props.className ?? ""}`}
    />
  );
}

function useCloseOnEscape(onClose: () => void) {
  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [onClose]);
}

function SeasonPageSkeleton() {
  return (
    <div aria-busy="true" className="season-legacy-workspace season-page-skeleton" role="status">
      <span className="sr-only">Chargement de la saison</span>
      <div aria-hidden="true" className="season-overview-band season-skeleton-block">
        <span />
        <span />
        <span />
      </div>
      <div aria-hidden="true" className="season-competition-tabs season-skeleton-tabs">
        <span />
        <span />
        <span />
      </div>
      <div aria-hidden="true" className="season-competition-workspace season-skeleton-workspace">
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}

function usePageVisible() {
  const [visible, setVisible] = useState(() => !document.hidden);
  useEffect(() => {
    const update = () => setVisible(!document.hidden);
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  return visible;
}

function Countdown({ endAt, doneLabel = "Terminé" }: { endAt?: string | null; doneLabel?: string }) {
  const [now, setNow] = useState(() => Date.now());
  const visible = usePageVisible();
  useEffect(() => {
    setNow(Date.now());
    if (!visible) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [visible]);
  if (!endAt) return <span>Pas de timer</span>;
  const remaining = new Date(endAt).getTime() - now;
  return <span>{remaining <= 0 ? doneLabel : formatSeasonRemaining(remaining)}</span>;
}

function SeasonEndCountdown({ endAt }: { endAt: string }) {
  const [now, setNow] = useState(() => Date.now());
  const visible = usePageVisible();
  useEffect(() => {
    setNow(Date.now());
    if (!visible) return;
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, [visible]);
  const remaining = new Date(endAt).getTime() - now;
  return <span>{remaining <= 0 ? "Terminée" : formatSeasonEndRemaining(remaining)}</span>;
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-white/10 bg-white/[0.04] p-3">
      <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">{label}</div>
      <div className="mt-1 truncate text-sm font-black text-slate-100" title={value}>
        {value}
      </div>
    </div>
  );
}

function raritySlug(rarity: ChestRarity) {
  return rarity
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function SeasonRewardModal({
  rewards,
  rarity,
  onClose
}: {
  rewards: SeasonChestRewards;
  rarity: ChestRarity;
  onClose: () => void;
}) {
  useCloseOnEscape(onClose);
  return createPortal(
    <div className="game-modal-overlay" onClick={onClose} role="presentation">
      <div
        aria-labelledby="season-reward-title"
        aria-modal="true"
        className="game-modal-panel panel max-w-3xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className="game-modal-header">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-emerald-300">
              Récompense quotidienne
            </p>
            <h2 className="text-2xl font-black" id="season-reward-title">
              Contenu récupéré
            </h2>
          </div>
          <SeasonButton aria-label="Fermer" autoFocus className="px-3" onClick={onClose}>
            <X size={17} />
          </SeasonButton>
        </div>
        <div className="mt-5 grid gap-5 sm:grid-cols-[170px_1fr]">
          <div className="grid place-items-center rounded-md border border-emerald-300/20 bg-emerald-300/5 p-4">
            <img
              alt={`Sac ${rarity}`}
              className="max-h-36 w-full object-contain"
              src={`/visuals/chests/tennis-bag-${raritySlug(rarity)}.webp`}
            />
            <strong className="mt-2 text-emerald-200">{rarity}</strong>
          </div>
          <div className="season-module-modal-list grid content-start gap-3">
            <div className="season-module-reward-grid">
              <MiniMetric label="Crédits" value={formatSeasonCredits(rewards.money)} />
              <MiniMetric label="Gemmes" value={`${rewards.gems}`} />
              <MiniMetric label="Cartes" value={`${rewards.cards.length}`} />
            </div>
            {rewards.cards.length ? (
              <div className="rounded-md border border-white/10 bg-white/[0.04] p-3">
                <h3 className="text-sm font-black uppercase tracking-[0.12em] text-emerald-300">
                  Cartes de statistiques
                </h3>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {rewards.cards.map((card) => (
                    <div className="rounded bg-black/20 p-2 text-sm" key={card.statKey}>
                      <strong>{card.label}</strong>
                      <span className="ml-2 text-emerald-300">+{card.copies} copie(s)</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            {rewards.cosmetics.length ? (
              <div className="rounded-md border border-white/10 bg-white/[0.04] p-3">
                <h3 className="text-sm font-black uppercase tracking-[0.12em] text-emerald-300">
                  Nouveaux objets
                </h3>
                <div className="mt-2 grid gap-2">
                  {rewards.cosmetics.map((item) => (
                    <div className="rounded bg-black/20 p-2 text-sm" key={item.id}>
                      <strong>{item.name}</strong> · {item.rarity}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
        <SeasonButton className="mt-5 w-full" onClick={onClose}>
          Continuer
        </SeasonButton>
      </div>
    </div>,
    document.body
  );
}

function DailyRewardIcon({ reward }: { reward: SeasonDailyReward }) {
  if (reward.type === "money") return <Coins aria-label="Crédits" size={20} />;
  if (reward.type === "gems") return <Gem aria-label="Gemmes" size={19} />;
  return <PackageOpen aria-label="Sac" size={19} />;
}

function SeasonOverviewBand({
  season,
  rewards,
  busy,
  onClaim,
  onOpenTimeline
}: {
  season: SeasonData["season"];
  rewards: SeasonDailyReward[];
  busy: boolean;
  onClaim: () => void;
  onOpenTimeline: () => void;
}) {
  const claimable = rewards.find((reward) => reward.claimable);
  const current = claimable ?? rewards.find((reward) => reward.current) ?? rewards[season.day - 1];
  const windowStart = Math.max(1, Math.min(season.day - 3, 25));
  const nearbyRewards = rewards.filter(
    (reward) => reward.day >= windowStart && reward.day <= windowStart + 4 && reward.day < 30
  );
  const finalReward = rewards.find((reward) => reward.day === 30);
  const progress = Math.max(0, Math.min(100, season.progress));

  return (
    <section className="season-overview-band" aria-label="Progression et récompenses de saison">
      <div className="season-progress-summary">
        <p>Saison en cours</p>
        <h2>Jour {season.day} / 30</h2>
        <strong>Semaine {season.week}</strong>
        <div className="season-progress-row">
          <div className="season-progress-track" aria-label={`Progression ${progress}%`}>
            <span style={{ width: `${progress}%` }} />
          </div>
          <b>{progress}%</b>
        </div>
        <small>
          Fin dans <SeasonEndCountdown endAt={season.endsAt} />
        </small>
      </div>

      <div className="season-reward-summary">
        <div className="season-reward-summary-heading">
          <span>Récompense du jour</span>
          <b>· {current?.rewardValue ?? current?.label ?? "À venir"}</b>
        </div>
        <div className="season-compact-track">
          <div className="season-compact-days">
            {nearbyRewards.map((reward) => (
              <button
                aria-label={`Jour ${reward.day} : ${reward.label}`}
                className={`season-compact-node ${
                  reward.claimed
                    ? "is-claimed"
                    : reward.claimable
                      ? "is-claimable"
                      : reward.missed
                        ? "is-missed"
                        : "is-locked"
                }`}
                key={reward.day}
                onClick={onOpenTimeline}
                type="button"
              >
                <span>
                  {reward.claimed ? (
                    <CheckCircle2 aria-hidden="true" />
                  ) : reward.claimable ? (
                    <Gift aria-hidden="true" />
                  ) : reward.missed ? (
                    <X aria-hidden="true" />
                  ) : (
                    <Lock aria-hidden="true" />
                  )}
                </span>
                <b>J{reward.day}</b>
              </button>
            ))}
          </div>

          <button
            aria-label="Afficher les 30 récompenses"
            className="season-track-ellipsis"
            onClick={onOpenTimeline}
            type="button"
          >
            •••
          </button>

          {finalReward ? (
            <button
              aria-label={`Jour 30 : ${finalReward.label}`}
              className={`season-final-reward ${
                finalReward.claimed
                  ? "is-claimed"
                  : finalReward.claimable
                    ? "is-claimable"
                    : "is-locked"
              }`}
              onClick={onOpenTimeline}
              type="button"
            >
              <span>
                <img
                  alt=""
                  aria-hidden="true"
                  src="/visuals/chests/tennis-bag-mythique.webp"
                />
              </span>
              <b>J30</b>
            </button>
          ) : null}

          <SeasonButton
            aria-busy={busy}
            className="season-overview-claim"
            disabled={!claimable || busy}
            onClick={onClaim}
          >
            {busy ? "Ouverture..." : claimable ? "Récupérer" : "Récupérée"}
          </SeasonButton>
        </div>
      </div>
    </section>
  );
}

function competitionTabState(competition: SeasonCompetition) {
  const status = competition.entry?.status;
  if (status === "ELIMINE") return { label: "Éliminé", tone: "eliminated" } as const;
  if (status === "VAINQUEUR" || status === "CHAMPION_NATIONAL") {
    return { label: "Vainqueur", tone: "winner" } as const;
  }
  if (competition.entry) return { label: "Inscrit", tone: "registered" } as const;
  if (!competition.playableNow) return { label: "Verrouillé", tone: "locked" } as const;
  return {
    label: `${competition.energyCost} énergie${competition.energyCost > 1 ? "s" : ""}`,
    tone: "available"
  } as const;
}

function CompetitionTabIcon({ type }: { type: SeasonCompetition["type"] }) {
  if (type === "daily") return <Trophy aria-hidden="true" />;
  if (type === "weekly") return <CalendarDays aria-hidden="true" />;
  return <Shield aria-hidden="true" />;
}

function SeasonCompetitionTabs({
  competitions,
  active,
  onChange
}: {
  competitions: SeasonCompetition[];
  active: SeasonCompetition["type"];
  onChange: (type: SeasonCompetition["type"]) => void;
}) {
  const selectTab = (index: number) => {
    const competition = competitions[index];
    if (!competition) return;
    onChange(competition.type);
    window.requestAnimationFrame(() => document.getElementById(`season-tab-${competition.type}`)?.focus());
  };

  return (
    <div className="season-competition-tabs" aria-label="Compétitions de la saison" role="tablist">
      {competitions.map((competition, index) => {
        const state = competitionTabState(competition);
        const selected = active === competition.type;
        return (
          <button
            aria-controls="season-active-competition"
            aria-selected={selected}
            className={selected ? "is-active" : ""}
            data-state={state.tone}
            id={`season-tab-${competition.type}`}
            key={competition.type}
            onClick={() => onChange(competition.type)}
            onKeyDown={(event) => {
              if (event.key === "ArrowRight") {
                event.preventDefault();
                selectTab((index + 1) % competitions.length);
              } else if (event.key === "ArrowLeft") {
                event.preventDefault();
                selectTab((index - 1 + competitions.length) % competitions.length);
              } else if (event.key === "Home") {
                event.preventDefault();
                selectTab(0);
              } else if (event.key === "End") {
                event.preventDefault();
                selectTab(competitions.length - 1);
              }
            }}
            role="tab"
            tabIndex={selected ? 0 : -1}
            type="button"
          >
            <CompetitionTabIcon type={competition.type} />
            <span>
              <strong>
                {competition.type === "daily"
                  ? "Tournoi journalier"
                  : competition.type === "weekly"
                    ? "Tournoi hebdomadaire"
                    : "Championnat individuel"}
              </strong>
              <small>{state.label}</small>
            </span>
          </button>
        );
      })}
    </div>
  );
}

function journeyStatus(competition: SeasonCompetition) {
  const status = competition.entry?.status;
  if (status === "ELIMINE") return { label: "Éliminé", tone: "eliminated" } as const;
  if (status === "CHAMPION_NATIONAL") {
    return { label: "Champion national", tone: "winner" } as const;
  }
  if (status === "VAINQUEUR") return { label: "Vainqueur", tone: "winner" } as const;
  if (competition.entry) return { label: "En course", tone: "active" } as const;
  if (competition.playableNow) return { label: "Inscription ouverte", tone: "available" } as const;
  return { label: "Verrouillé", tone: "locked" } as const;
}

function SeasonJourneyPanel({
  competition,
  onHistory
}: {
  competition: SeasonCompetition;
  onHistory: () => void;
}) {
  const entry = competition.entry;
  const status = journeyStatus(competition);
  const isChampionship = competition.type === "individual";
  const totalRounds = isChampionship
    ? Math.max(1, entry?.bracket.path?.length ?? competition.drawSize)
    : seasonTournamentRoundCount(competition.drawSize);
  const victories = entry?.matches.filter((match) => match.won).length ?? 0;
  const roundLabel = !entry
    ? isChampionship
      ? "Objectif FFT"
      : "Inscription"
    : entry.status === "VAINQUEUR" || entry.status === "CHAMPION_NATIONAL"
      ? "Parcours terminé"
      : entry.status === "ELIMINE"
        ? "Éliminé du parcours"
        : isChampionship
          ? (entry.bracket.path?.[entry.currentRound]?.label ?? `Palier ${entry.currentRound + 1}`)
          : seasonTournamentRoundLabel(competition.drawSize, entry.currentRound);
  const formatLabel = isChampionship ? "Pyramide FFT" : `Tableau ${competition.drawSize}`;

  return (
    <section className="season-journey-panel">
      <h2>Mon parcours</h2>
      <div className="season-journey-hero">
        <div className="season-journey-emblem" aria-hidden="true">
          <span><Trophy /></span>
        </div>
        <div className="season-journey-heading">
          <p>{formatLabel}</p>
          <strong>{roundLabel}</strong>
          <b>{victories} victoire{victories > 1 ? "s" : ""}</b>
          <span data-tone={status.tone}>{status.label}</span>
        </div>
      </div>

      <div className="season-journey-finances">
        <div>
          <Ticket aria-hidden="true" />
          <span>{entry ? "Inscription payée" : "Frais d'inscription"}</span>
          <strong>{formatSeasonCredits(entry?.entryFee ?? competition.entryFee)}</strong>
        </div>
        <div>
          <Coins aria-hidden="true" />
          <span>{status.tone === "winner" ? "Dotation gagnée" : "Dotation"}</span>
          <strong>{formatSeasonCredits(entry?.cashPrize ?? competition.cashPrize)}</strong>
        </div>
      </div>

      <div
        aria-label={`Progression : ${Math.min(entry?.currentRound ?? 0, totalRounds)} tour(s) sur ${totalRounds}`}
        className="season-journey-rail"
        role="list"
      >
        {Array.from({ length: totalRounds }, (_, index) => {
          const match = entry?.matches[index];
          const current = Boolean(
            entry &&
              index === entry.currentRound &&
              !["ELIMINE", "VAINQUEUR", "CHAMPION_NATIONAL"].includes(entry.status)
          );
          return (
            <span
              className={
                match?.won
                  ? "is-won"
                  : match
                    ? "is-lost"
                    : current
                      ? "is-current"
                      : "is-upcoming"
              }
              aria-label={match ? `${match.won ? "Victoire" : "Défaite"} ${match.scoreText ?? ""}` : `Tour ${index + 1}`}
              key={index}
              role="listitem"
              title={match ? `${match.won ? "Victoire" : "Défaite"} ${match.scoreText ?? ""}` : `Tour ${index + 1}`}
            >
              {match?.won ? <CheckCircle2 aria-hidden="true" /> : index + 1}
            </span>
          );
        })}
        <span
          aria-label={status.tone === "winner" ? "Trophée remporté" : "Trophée à remporter"}
          className={`season-journey-trophy ${status.tone === "winner" ? "is-won" : ""}`}
          role="listitem"
        >
          <Trophy aria-hidden="true" />
        </span>
      </div>

      <button
        className="season-journey-history"
        disabled={!entry}
        onClick={onHistory}
        type="button"
      >
        <Eye aria-hidden="true" />
        <span>{entry ? "Historique" : "Aucun historique"}</span>
      </button>
    </section>
  );
}

function SeasonDuelPlayer({
  player,
  side,
  resolveHeroSource,
  resolvePictureSource
}: {
  player: Player;
  side: "player" | "opponent";
  resolveHeroSource: SeasonPageProps["resolveHeroSource"];
  resolvePictureSource: SeasonPageProps["resolvePictureSource"];
}) {
  const portrait = resolvePictureSource(player.avatar);
  const hasCinematicHero = Boolean(resolveHeroSource(player.avatar));
  return (
    <div className={`season-duel-player is-${side}`} data-cinematic-portrait={hasCinematicHero || undefined}>
      <div className="season-duel-portrait">
        <img
          alt={`${player.firstName} ${player.lastName}`}
          decoding="async"
          draggable={false}
          src={portrait}
        />
      </div>
      <div className="season-duel-identity">
        <strong>{player.firstName}</strong>
        <strong>{player.lastName}</strong>
        <span>{player.fftRanking}</span>
        <b aria-label={`Note globale ${player.overall}`}>{player.overall}</b>
      </div>
    </div>
  );
}

function SeasonNextMatchPanel({
  competition,
  player,
  busy,
  onPlay,
  onOpen,
  resolveHeroSource,
  resolvePictureSource
}: {
  competition: SeasonCompetition;
  player: Player;
  busy: boolean;
  onPlay: () => void;
  onOpen: () => void;
  resolveHeroSource: SeasonPageProps["resolveHeroSource"];
  resolvePictureSource: SeasonPageProps["resolvePictureSource"];
}) {
  const entry = competition.entry;
  if (!entry) return null;
  const opponent = entry.nextOpponent ?? null;
  const terminal = ["ELIMINE", "VAINQUEUR", "CHAMPION_NATIONAL"].includes(entry.status);
  const terminalTone = entry.status === "ELIMINE" ? "eliminated" : "winner";
  const terminalMessage = entry.status === "ELIMINE"
    ? "Votre parcours s'arrête à ce tour. Le tableau et les replays restent disponibles."
    : entry.status === "CHAMPION_NATIONAL"
      ? "Le parcours FFT est achevé : vous êtes champion national amateur."
      : "Le tournoi est remporté. Consultez le tableau et les résultats complets.";
  const roundLabel =
    competition.type === "individual"
      ? (entry.bracket.path?.[entry.currentRound]?.label ?? `Palier ${entry.currentRound + 1}`)
      : seasonTournamentRoundLabel(competition.drawSize, entry.currentRound);
  const insights = opponent ? seasonTacticalInsights(player.stats, opponent.stats) : null;

  return (
    <section className={`season-next-match-panel${terminal ? ` is-${terminalTone}` : ""}`}>
      <header>
        <h2>{terminal ? "Parcours terminé" : "Prochain match"}</h2>
        <p>{competition.title} · {roundLabel}</p>
      </header>

      {opponent && !terminal ? (
        <>
          <div className="season-versus-stage">
            <SeasonDuelPlayer
              player={player}
              resolveHeroSource={resolveHeroSource}
              resolvePictureSource={resolvePictureSource}
              side="player"
            />
            <div className="season-versus-mark" aria-hidden="true">VS</div>
            <SeasonDuelPlayer
              player={opponent}
              resolveHeroSource={resolveHeroSource}
              resolvePictureSource={resolvePictureSource}
              side="opponent"
            />
          </div>

          {insights ? (
            <div className="season-tactical-strip">
              <div className="is-advantage">
                <Target aria-hidden="true" />
                <span><small>Votre avantage</small><strong>{insights.advantage.label} {insights.advantage.delta >= 0 ? "+" : ""}{insights.advantage.delta}</strong></span>
              </div>
              <div className="is-danger">
                <Repeat2 aria-hidden="true" />
                <span><small>À surveiller</small><strong>{insights.danger.label} {insights.danger.opponentValue}</strong></span>
              </div>
            </div>
          ) : null}

          <div className="season-match-availability">
            <CheckCircle2 aria-hidden="true" /> Jouable maintenant
          </div>
          <button aria-busy={busy} className="season-play-match" disabled={busy} onClick={onPlay} type="button">
            <span><Play aria-hidden="true" /></span>
            {busy ? "Préparation du match..." : "Jouer le match"}
          </button>
        </>
      ) : (
        <div className="season-next-match-empty">
          {entry.status === "ELIMINE" ? <X aria-hidden="true" /> : terminal ? <Trophy aria-hidden="true" /> : <Target aria-hidden="true" />}
          <strong>{terminal ? seasonEntryStatus(entry) : "Adversaire en préparation"}</strong>
          <span>
            {terminal
              ? terminalMessage
              : "Le prochain adversaire sera disponible après l'actualisation de la saison."}
          </span>
        </div>
      )}

      <button className="season-view-bracket" onClick={onOpen} type="button">
        {competition.type === "individual" ? "Voir le parcours" : "Voir le tableau"}
      </button>
    </section>
  );
}

function SeasonBracketPreview({
  competition,
  onOpen
}: {
  competition: SeasonCompetition;
  onOpen: () => void;
}) {
  const entry = competition.entry;
  if (!entry) return null;
  const isIndividual = competition.type === "individual";
  const allSteps = isIndividual
    ? seasonChampionshipPath(entry)
    : seasonTournamentBranch(entry);
  const windowStart = isIndividual
    ? Math.max(0, Math.min(entry.currentRound - 1, Math.max(0, allSteps.length - 4)))
    : 0;
  const visibleSteps = isIndividual ? allSteps.slice(windowStart, windowStart + 4) : allSteps;
  const finalStep = allSteps.at(-1);
  const showFinalTarget = Boolean(
    isIndividual && finalStep && windowStart + visibleSteps.length < allSteps.length
  );

  return (
    <aside className={`season-match-conditions season-bracket-preview${isIndividual ? " is-path" : " is-draw"}`}>
      <header>
        <h2>{isIndividual ? "Parcours FFT" : "Mini-tableau"}</h2>
        <p>
          {isIndividual
            ? `${entry.matches.length} étape${entry.matches.length > 1 ? "s" : ""} franchie${entry.matches.length > 1 ? "s" : ""} · Objectif -15`
            : `Tableau ${competition.drawSize} · ${entry.matches.length} victoire${entry.matches.length > 1 ? "s" : ""}`}
        </p>
      </header>

      <div className="season-mini-bracket">
        {visibleSteps.map((step, index) => (
          <div className={`season-mini-step is-${step.state}`} key={`${step.label}-${windowStart + index}`}>
            <span className="season-mini-step-state" aria-hidden="true">
              {step.state === "won" ? (
                <CheckCircle2 />
              ) : step.state === "lost" ? (
                <X />
              ) : step.state === "current" ? (
                <Target />
              ) : (
                <Lock />
              )}
            </span>
            <span className="season-mini-step-copy">
              <small>{step.label}</small>
              <strong>{step.opponentRanking}</strong>
              <em>{step.opponentLabel}</em>
              {step.scoreText ? <b>{step.scoreText}</b> : null}
            </span>
          </div>
        ))}
        {showFinalTarget && finalStep ? (
          <div className="season-mini-step is-final is-locked">
            <span className="season-mini-step-state" aria-hidden="true"><Trophy /></span>
            <span className="season-mini-step-copy">
              <small>Objectif final</small>
              <strong>{finalStep.opponentRanking}</strong>
              <em>Champion national</em>
            </span>
          </div>
        ) : null}
      </div>

      <div className="season-bracket-meta">
        <span><Zap aria-hidden="true" /> {competition.energyCost} énergie</span>
        <span><Coins aria-hidden="true" /> {formatSeasonCredits(entry.cashPrize)}</span>
      </div>
      <button onClick={onOpen} type="button">
        {competition.type === "individual" ? "Parcours complet" : "Tableau complet"}
      </button>
    </aside>
  );
}

function SeasonRegistrationPanel({
  competition,
  player,
  busy,
  onRegister
}: {
  competition: SeasonCompetition;
  player: Player;
  busy: boolean;
  onRegister: () => void;
}) {
  const hasEnergy = player.actionEnergy >= competition.energyCost;
  const hasCredits = player.budget >= competition.entryFee;
  const available = competition.playableNow;
  const blockedReason = !available
    ? "Cette période d'inscription est terminée."
    : !hasEnergy
      ? `Énergie insuffisante : ${competition.energyCost} requise.`
      : !hasCredits
        ? `Crédits insuffisants : ${formatSeasonCredits(competition.entryFee)} requis.`
        : "Joueur et ressources prêts.";
  const periodBoundary = competition.nextPlayableAt ?? competition.currentPeriodEndsAt;

  return (
    <section className="season-registration-panel">
      <header>
        <p>Inscription à la compétition</p>
        <h2>{competition.title}</h2>
        <span>{competition.subtitle}</span>
      </header>

      <div className="season-registration-core">
        <div className="season-registration-emblem" aria-hidden="true">
          {competition.type === "individual" ? <Shield /> : <Trophy />}
        </div>
        <div className="season-registration-rules">
          <div>
            <small>Format</small>
            <strong>{competition.type === "individual" ? "Pyramide FFT" : `Tableau ${competition.drawSize}`}</strong>
          </div>
          <div>
            <small>Zone de niveau</small>
            <strong>{competition.rankingRange.best} à {competition.rankingRange.worst}</strong>
          </div>
          <div>
            <small>Règle</small>
            <strong>Une défaite élimine</strong>
          </div>
        </div>
      </div>

      <div className="season-registration-window" data-available={available || undefined}>
        <CalendarDays aria-hidden="true" />
        <span>
          <small>{available ? "Inscriptions ouvertes" : "Prochaine disponibilité"}</small>
          <strong>
            {available ? (
              <>Encore <Countdown endAt={periodBoundary} /></>
            ) : (
              <Countdown endAt={periodBoundary} doneLabel="Ouverture imminente" />
            )}
          </strong>
        </span>
      </div>

      <div className="season-registration-checks">
        <div data-ready={hasEnergy || undefined}>
          <Zap aria-hidden="true" />
          <span><small>Énergie</small><strong>{player.actionEnergy}/{competition.energyCost}</strong></span>
          {hasEnergy ? <CheckCircle2 aria-label="Énergie suffisante" /> : <X aria-label="Énergie insuffisante" />}
        </div>
        <div data-ready={hasCredits || undefined}>
          <Coins aria-hidden="true" />
          <span><small>Crédits</small><strong>{formatSeasonCredits(player.budget)} / {formatSeasonCredits(competition.entryFee)}</strong></span>
          {hasCredits ? <CheckCircle2 aria-label="Crédits suffisants" /> : <X aria-label="Crédits insuffisants" />}
        </div>
      </div>

      <div className="season-registration-status" data-ready={available && hasEnergy && hasCredits || undefined}>
        {available && hasEnergy && hasCredits ? <CheckCircle2 /> : <Lock />}
        {blockedReason}
      </div>

      <button
        aria-busy={busy}
        className="season-register-button"
        disabled={busy || !available || !hasEnergy || !hasCredits}
        onClick={onRegister}
        type="button"
      >
        {busy ? "Inscription en cours..." : "S'inscrire"}
      </button>
    </section>
  );
}

function SeasonRegistrationSummary({ competition }: { competition: SeasonCompetition }) {
  return (
    <aside className="season-registration-summary">
      <header>
        <Gift aria-hidden="true" />
        <div><small>Dotation maximale</small><strong>{formatSeasonCredits(competition.cashPrize)}</strong></div>
      </header>
      <div className="season-registration-investment">
        <h2>Engagement</h2>
        <div><span><Zap /> Coût d'action</span><strong>{competition.energyCost} énergie</strong></div>
        <div><span><Ticket /> Frais d'entrée</span><strong>{formatSeasonCredits(competition.entryFee)}</strong></div>
        <div><span><CalendarDays /> Fréquence</span><strong>{competition.frequency}</strong></div>
      </div>
      <div className="season-registration-notice">
        <Shield aria-hidden="true" />
        <span>
          <strong>Transaction sécurisée</strong>
          <small>Les ressources sont débitées uniquement si l'inscription est validée par le serveur.</small>
        </span>
      </div>
    </aside>
  );
}

function SeasonDailyRewardsTimeline({
  rewards,
  onClaim,
  busy
}: {
  rewards: SeasonDailyReward[];
  onClaim: () => void;
  busy: boolean;
}) {
  const current = rewards.find((reward) => reward.current);
  const claimable = rewards.find((reward) => reward.claimable);
  return (
    <section className="panel overflow-hidden p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-emerald-300">
            Récompense journalière
          </p>
          <h2 className="text-2xl font-black">
            {claimable ? "Votre récompense est prête" : "Timeline de saison"}
          </h2>
          <p className="mt-1 text-sm text-slate-300">
            Jour {current?.day ?? 1} · {current?.label ?? "Récompense à venir"} · le jour 30 offre
            toujours un sac Mythique.
          </p>
        </div>
        <SeasonButton
          aria-busy={busy}
          className={`min-h-12 px-5 ${claimable ? "season-reward-claim" : ""}`}
          disabled={!claimable || busy}
          onClick={onClaim}
        >
          <Gift size={18} /> {busy ? "Ouverture..." : claimable ? "Récupérer" : "Déjà récupérée"}
        </SeasonButton>
      </div>
      <div className="season-reward-timeline mt-5">
        {rewards.map((reward) => (
          <div
            className={`season-reward-node ${
              reward.claimed
                ? "is-claimed"
                : reward.claimable
                  ? "is-claimable"
                  : reward.missed
                    ? "is-missed"
                    : reward.locked
                      ? "is-locked"
                      : ""
            }`}
            key={reward.day}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                J{reward.day}
              </span>
              {reward.claimed ? (
                <CheckCircle2 size={15} />
              ) : reward.locked ? (
                <Lock size={14} />
              ) : null}
            </div>
            <div className="mt-3 grid h-10 w-10 place-items-center rounded-md bg-white/10 text-emerald-200">
              <DailyRewardIcon reward={reward} />
            </div>
            <div className="mt-2 min-h-8 text-xs font-black leading-tight">{reward.label}</div>
            <div className="mt-2 text-[10px] uppercase tracking-[0.14em] text-slate-500">
              {reward.claimed
                ? "Pris"
                : reward.claimable
                  ? "Prêt"
                  : reward.missed
                    ? "Manqué"
                    : "Verrouillé"}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function SeasonRewardsModal({
  rewards,
  busy,
  onClaim,
  onClose
}: {
  rewards: SeasonDailyReward[];
  busy: boolean;
  onClaim: () => void;
  onClose: () => void;
}) {
  useCloseOnEscape(onClose);
  return createPortal(
    <div className="game-modal-overlay" onClick={onClose} role="presentation">
      <div
        aria-label="Récompenses de la saison"
        aria-modal="true"
        className="game-modal-panel panel season-rewards-modal"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <button
          aria-label="Fermer la timeline"
          autoFocus
          className="season-icon-button season-rewards-modal-close"
          onClick={onClose}
          type="button"
        >
          <X size={20} />
        </button>
        <SeasonDailyRewardsTimeline busy={busy} onClaim={onClaim} rewards={rewards} />
      </div>
    </div>,
    document.body
  );
}

function ChampionshipJourney({ entry }: { entry: SeasonEntry }) {
  const path = seasonChampionshipPath(entry);
  return (
    <div className="season-full-path">
      {path.map((step, index) => {
        return (
          <div className={`season-full-path-step is-${step.state}`} key={`${step.label}-${index}`}>
            <span className="season-full-path-index">
              {step.state === "won" ? <CheckCircle2 /> : step.state === "lost" ? <X /> : step.state === "current" ? <Target /> : <Lock />}
            </span>
            <div className="season-full-path-copy">
              <small>Étape {index + 1}</small>
              <strong>{step.label}</strong>
              <span>{step.opponentLabel} · {step.opponentRanking}</span>
            </div>
            <div className="season-full-path-result">
              <strong>{step.state === "won" ? "Victoire" : step.state === "lost" ? "Défaite" : step.state === "current" ? "Prochain" : "Verrouillé"}</strong>
              {step.scoreText ? <span>{step.scoreText}</span> : null}
              {step.replayMatchId ? (
                <Link to={`/match/${step.replayMatchId}`}>
                  <Eye /> Replay
                </Link>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TournamentBracket({ entry }: { entry: SeasonEntry }) {
  const rounds = entry.bracket.rounds ?? [];
  if (!rounds.length) {
    return (
      <div className="mt-4 rounded-md border border-white/10 bg-white/[0.04] p-4 text-sm text-slate-300">
        Le tableau complet sera généré à l'ouverture de la compétition.
      </div>
    );
  }
  return (
    <div className="season-full-bracket-scroll">
      <div className="season-module-bracket-rounds">
        {rounds.map((round) => (
          <section className="season-full-bracket-round" key={round.name}>
            <h3>{round.name}</h3>
            <div>
              {round.matches.map((match, index) => (
                <div className={`season-full-bracket-match${match.playedByPlayer ? " is-player-match" : ""}`} key={index}>
                  {[match.left, match.right].map((side, sideIndex) => {
                    const winner = Boolean(
                      side && match.winner && side.label === match.winner.label && side.ranking === match.winner.ranking
                    );
                    return (
                      <div
                        className={`season-full-bracket-side${side?.isPlayer ? " is-player" : ""}${winner ? " is-winner" : ""}${!side ? " is-empty" : ""}`}
                        key={`${sideIndex}-${side?.label ?? "empty"}`}
                      >
                        <span>{side?.label ?? "À déterminer"}</span>
                        <strong>{side?.ranking ?? "—"}</strong>
                      </div>
                    );
                  })}
                  {match.scoreText || match.replayMatchId ? (
                    <footer>
                      <span>{match.scoreText ?? "Match terminé"}</span>
                      {match.replayMatchId ? (
                        <Link to={`/match/${match.replayMatchId}`}><Eye /> Replay</Link>
                      ) : null}
                    </footer>
                  ) : null}
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function SeasonEntryDetails({
  competition,
  initialTab,
  onClose
}: {
  competition: SeasonCompetition;
  initialTab: "summary" | "board";
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"summary" | "board">(initialTab);
  useCloseOnEscape(onClose);
  const entry = competition.entry;
  if (!entry) return null;
  const latestMatch = entry.matches.at(-1);
  const wonMatches = entry.matches.filter((match) => match.won).length;
  return createPortal(
    <div className="game-modal-overlay" onClick={onClose} role="presentation">
      <div
        aria-labelledby="season-entry-title"
        aria-modal="true"
        className="game-modal-panel panel season-entry-modal"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className="game-modal-header">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-emerald-300">
              {competition.title}
            </p>
            <h2 className="text-2xl font-black" id="season-entry-title">
              {competition.type === "individual" ? "Parcours du championnat" : "Tableau du tournoi"}
            </h2>
          </div>
          <SeasonButton aria-label="Fermer" autoFocus className="px-3" onClick={onClose}>
            <X size={17} />
          </SeasonButton>
        </div>
        <div className="segmented-tabs mt-4">
          <button className={tab === "summary" ? "is-active" : ""} onClick={() => setTab("summary")} type="button">
            <span>Résumé</span><small>{seasonEntryStatus(entry)}</small>
          </button>
          <button className={tab === "board" ? "is-active" : ""} onClick={() => setTab("board")} type="button">
            <span>{competition.type === "individual" ? "Parcours" : "Tableau"}</span><small>Détail</small>
          </button>
        </div>
        {tab === "summary" ? (
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <section className="rounded-md border border-white/10 bg-white/[0.04] p-4">
              <h3 className="text-xl font-black">{seasonEntryStatus(entry)}</h3>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <MiniMetric label="Matchs joués" value={`${entry.matches.length}`} />
                <MiniMetric label="Victoires" value={`${wonMatches}`} />
                <MiniMetric label="Prochain rang" value={seasonNextRanking(entry) ?? "Terminé"} />
                <MiniMetric label="Dotation" value={formatSeasonCredits(entry.cashPrize)} />
              </div>
            </section>
            <section className="rounded-md border border-cyan-300/20 bg-cyan-300/10 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-200">Dernier événement</p>
              <h3 className="mt-2 text-xl font-black">
                {latestMatch ? `${latestMatch.won ? "Victoire" : "Défaite"} · ${latestMatch.scoreText ?? "Score"}` : "Premier match à venir"}
              </h3>
              {latestMatch ? (
                <Link className="mt-4 inline-flex items-center gap-2 text-sm font-black text-emerald-300" to={`/match/${latestMatch.matchId}`}>
                  <Eye size={16} /> Voir le replay
                </Link>
              ) : null}
            </section>
            <SeasonButton className="lg:col-span-2" onClick={() => setTab("board")}>
              Ouvrir le détail
            </SeasonButton>
          </div>
        ) : competition.type === "individual" ? (
          <ChampionshipJourney entry={entry} />
        ) : (
          <TournamentBracket entry={entry} />
        )}
      </div>
    </div>,
    document.body
  );
}

export function SeasonPage({ resolveHeroSource, resolvePictureSource }: SeasonPageProps) {
  const refresh = useGameStore((state) => state.refresh);
  const storePlayer = useGameStore((state) => state.player);
  const [data, setData] = useState<SeasonData | null>(() => peekSeasonData(storePlayer?.id));
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [seasonTab, setSeasonTab] = useState<SeasonCompetition["type"]>("daily");
  const [selectedCompetition, setSelectedCompetition] = useState<{
    competition: SeasonCompetition;
    tab: "summary" | "board";
  } | null>(null);
  const [dailyRewardOpening, setDailyRewardOpening] = useState<{
    rewards: SeasonChestRewards;
    rarity: ChestRarity;
  } | null>(null);
  const [rewardsTimelineOpen, setRewardsTimelineOpen] = useState(false);
  const [claimingReward, setClaimingReward] = useState(false);
  const [playingEntryId, setPlayingEntryId] = useState<string | null>(null);
  const [registeringType, setRegisteringType] = useState<SeasonCompetition["type"] | null>(null);
  const navigate = useNavigate();

  const load = useCallback(async (force = false) => {
    try {
      const nextData = await requestSeasonData(force);
      setData(nextData);
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Saison indisponible.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!data) return;
    const portraits = new Set<string>();
    portraits.add(resolvePictureSource(data.player.avatar));
    data.competitions.forEach((competition) => {
      if (competition.entry?.nextOpponent) {
        portraits.add(resolvePictureSource(competition.entry.nextOpponent.avatar));
      }
    });
    portraits.forEach((source) => {
      const image = new Image();
      image.decoding = "async";
      image.src = source;
    });
  }, [data, resolvePictureSource]);

  async function register(type: SeasonCompetition["type"]) {
    if (registeringType) return;
    setMessage("");
    setRegisteringType(type);
    try {
      await api(`/season/${type}/register`, { method: "POST" });
      setMessage("Inscription validée. L'énergie a été débitée côté serveur.");
      await Promise.all([load(true), refresh()]);
    } catch (registerError) {
      setMessage(registerError instanceof Error ? registerError.message : "Inscription impossible.");
    } finally {
      setRegisteringType(null);
    }
  }

  async function play(entryId: string) {
    if (playingEntryId) return;
    setMessage("");
    setPlayingEntryId(entryId);
    try {
      const result = await api<MatchCreationResult>(`/season/entries/${entryId}/play`, { method: "POST" });
      invalidateSeasonDataCache();
      navigate(`/match/${result.match.id}`);
      void refresh();
    } catch (playError) {
      setMessage(playError instanceof Error ? playError.message : "Match impossible.");
    } finally {
      setPlayingEntryId(null);
    }
  }

  async function claimDailyReward() {
    if (claimingReward) return;
    setMessage("");
    setClaimingReward(true);
    try {
      const result = await api<{ dailyReward: SeasonDailyReward; rewards: SeasonChestRewards }>(
        "/season/rewards/daily/claim",
        { method: "POST" }
      );
      setDailyRewardOpening({
        rewards: result.rewards,
        rarity: result.dailyReward.type === "chest" ? (result.dailyReward.rarity ?? "Bronze") : "Bronze"
      });
      setRewardsTimelineOpen(false);
      await Promise.all([load(true), refresh()]);
    } catch (claimError) {
      setMessage(claimError instanceof Error ? claimError.message : "Récompense impossible.");
    } finally {
      setClaimingReward(false);
    }
  }

  const activeCompetition =
    data?.competitions.find((competition) => competition.type === seasonTab) ??
    data?.competitions[0];

  return (
    <div className="season-cinematic">
      <section className="season-stage">
        <SeasonHeader
          onBack={() => navigate("/dashboard")}
          onHelp={() => {
            localStorage.setItem("mypro-tutorial-active", "1");
            navigate("/dashboard");
          }}
          onSettings={() => navigate("/settings")}
          player={data?.player ?? storePlayer}
          seasonKey={data?.season.key}
        />
        <main className="season-content">
          {!data && !error ? (
            <SeasonPageSkeleton />
          ) : !data ? (
            <section className="season-module-error panel p-5">
              <div>
                <Trophy className="mx-auto text-rose-300" size={34} />
                <h2 className="mt-3 text-xl font-black">Saison indisponible</h2>
                <p className="mt-2 text-sm text-rose-200">{error}</p>
                <SeasonButton className="mt-4" onClick={() => void load()}>
                  Réessayer
                </SeasonButton>
              </div>
            </section>
          ) : (
            <div className="season-legacy-workspace grid gap-4">
              <SeasonOverviewBand
                busy={claimingReward}
                onClaim={() => void claimDailyReward()}
                onOpenTimeline={() => setRewardsTimelineOpen(true)}
                rewards={data.dailyRewards}
                season={data.season}
              />

              {message || error ? (
                <div className="season-notice-stack" role="status">
                  {message ? <div className="season-inline-notice is-success">{message}</div> : null}
                  {error ? (
                    <div className="season-inline-notice is-warning">
                      Actualisation différée : {error}
                    </div>
                  ) : null}
                </div>
              ) : null}

              <SeasonCompetitionTabs
                active={seasonTab}
                competitions={data.competitions}
                onChange={setSeasonTab}
              />

              {activeCompetition ? (
                <div
                  aria-labelledby={`season-tab-${activeCompetition.type}`}
                  id="season-active-competition"
                  role="tabpanel"
                >
                  <div className="season-competition-workspace">
                    <SeasonJourneyPanel
                      competition={activeCompetition}
                      onHistory={() => setSelectedCompetition({ competition: activeCompetition, tab: "summary" })}
                    />
                    {activeCompetition.entry ? (
                      <>
                        <SeasonNextMatchPanel
                          busy={playingEntryId === activeCompetition.entry.id}
                          competition={activeCompetition}
                          onOpen={() => setSelectedCompetition({ competition: activeCompetition, tab: "board" })}
                          onPlay={() => void play(activeCompetition.entry!.id)}
                          player={data.player}
                          resolveHeroSource={resolveHeroSource}
                          resolvePictureSource={resolvePictureSource}
                        />
                        <SeasonBracketPreview
                          competition={activeCompetition}
                          onOpen={() => setSelectedCompetition({ competition: activeCompetition, tab: "board" })}
                        />
                      </>
                    ) : (
                      <>
                        <SeasonRegistrationPanel
                          busy={registeringType === activeCompetition.type}
                          competition={activeCompetition}
                          onRegister={() => void register(activeCompetition.type)}
                          player={data.player}
                        />
                        <SeasonRegistrationSummary competition={activeCompetition} />
                      </>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </main>
      </section>
      {selectedCompetition ? (
        <SeasonEntryDetails
          competition={selectedCompetition.competition}
          initialTab={selectedCompetition.tab}
          onClose={() => setSelectedCompetition(null)}
        />
      ) : null}
      {dailyRewardOpening ? (
        <SeasonRewardModal onClose={() => setDailyRewardOpening(null)} rarity={dailyRewardOpening.rarity} rewards={dailyRewardOpening.rewards} />
      ) : null}
      {rewardsTimelineOpen && data ? (
        <SeasonRewardsModal
          busy={claimingReward}
          onClaim={() => void claimDailyReward()}
          onClose={() => setRewardsTimelineOpen(false)}
          rewards={data.dailyRewards}
        />
      ) : null}
    </div>
  );
}
