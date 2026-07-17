import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  ArrowLeft,
  BarChart3,
  Bot,
  Check,
  ChevronLeft,
  ChevronRight,
  Crosshair,
  DoorOpen,
  Dumbbell,
  FastForward,
  Flame,
  Gauge,
  Hand,
  HeartPulse,
  HelpCircle,
  MoveDown,
  MoveUpRight,
  Pause,
  Play,
  Repeat2,
  RotateCcw,
  Target,
  Volume2,
  VolumeX,
  Wind,
  X,
  Zap
} from "lucide-react";
import { api } from "../../api";
import { useGameStore, type Player } from "../../store";
import { playMatchSound } from "./InteractiveMatchPage";
import {
  actionInsight,
  automaticMatchStatLabels,
  formatAutomaticAction,
  formatReplayClock,
  momentumPosition,
  pointForceRatio,
  timelineWindow
} from "./automaticMatchUtils";
import "./automatic-match.css";

type ReplayEvent = {
  index: number;
  serverId: string;
  winnerId: string;
  action: string;
  rallyLength: number;
  comment: string;
  position: {
    ballX: number;
    ballY: number;
    playerAX: number;
    playerAY: number;
    playerBX: number;
    playerBY: number;
  };
  ace: boolean;
  doubleFault: boolean;
  unforcedError: boolean;
  winner: boolean;
  isBreakPoint: boolean;
  isSetPoint: boolean;
  isMatchPoint: boolean;
  score: { sets: [number, number]; games: [number, number]; points: [string, string] };
  statKey?: string;
  statLabel?: string;
  statValues?: [number, number];
  rawStatValues?: [number, number];
};

type MatchReplay = {
  id: string;
  winnerId: string;
  scoreText: string;
  type: string;
  surface: string;
  durationMinutes?: number;
  playerA: Player;
  playerB: Player;
  replay: { events: ReplayEvent[]; momentum: number[] };
};

type AutomaticMatchPageProps = {
  resolveHeroSource: (avatar: string) => string | undefined;
  resolvePictureSource: (avatar: string) => string;
};

const statIcons: Record<string, LucideIcon> = {
  service: Target,
  return: Repeat2,
  forehand: Crosshair,
  backhand: MoveUpRight,
  volley: Hand,
  smash: Flame,
  dropShot: MoveDown,
  stamina: Gauge,
  speed: Wind,
  explosiveness: Zap,
  strength: Dumbbell,
  recovery: HeartPulse
};

const displayStatKeys = Object.keys(automaticMatchStatLabels);

function clamp(value: number, min = 0, max = 1) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

function isFemale(player: Player) {
  return player.gender.toLocaleLowerCase("fr-FR").startsWith("f");
}

function actionHero(player: Player) {
  return isFemale(player)
    ? "/visuals/match/pp-01-backhand.png"
    : "/visuals/match/pp-02-forehand.png";
}

function playerShortName(player: Player) {
  return player.firstName || player.name.split(" ")[0] || "Joueur";
}

function playerFullName(player: Player) {
  return `${player.firstName} ${player.lastName}`.trim() || player.name;
}

function valueFor(player: Player, key: string) {
  return Math.round(Number(player.stats?.[key]) || 0);
}

function usePageVisibility() {
  const [visible, setVisible] = useState(() => document.visibilityState !== "hidden");
  useEffect(() => {
    const update = () => setVisible(document.visibilityState !== "hidden");
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  return visible;
}

export function AutomaticMatchPage({ resolvePictureSource }: AutomaticMatchPageProps) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const instantResult = searchParams.get("result") === "1";
  const currentPlayer = useGameStore((state) => state.player);
  const [match, setMatch] = useState<MatchReplay | null>(null);
  const [error, setError] = useState("");
  const [retryKey, setRetryKey] = useState(0);
  const [index, setIndex] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [playing, setPlaying] = useState(!instantResult);
  const [soundEnabled, setSoundEnabled] = useState(
    () => localStorage.getItem("mypro-match-sound") !== "0"
  );
  const [feedExpanded, setFeedExpanded] = useState(false);
  const [statsExpanded, setStatsExpanded] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [resultOpen, setResultOpen] = useState(instantResult);
  const pageVisible = usePageVisibility();

  useEffect(() => {
    let cancelled = false;
    setError("");
    setMatch(null);
    setIndex(0);
    setPlaying(!instantResult);
    setResultOpen(instantResult);
    void api<MatchReplay>(`/matches/${id}`)
      .then((payload) => {
        if (cancelled) return;
        setMatch(payload);
        if (instantResult) setIndex(Math.max(0, payload.replay.events.length - 1));
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setError(reason instanceof Error ? reason.message : "Le match n'a pas pu être chargé.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [id, instantResult, retryKey]);

  const events = match?.replay.events ?? [];
  const safeIndex = Math.min(index, Math.max(0, events.length - 1));
  const event = events[safeIndex];
  const finalReached = events.length > 0 && safeIndex >= events.length - 1;

  useEffect(() => {
    if (!playing || !events.length || !pageVisible || finalReached) return;
    const timer = window.setTimeout(
      () => setIndex((current) => Math.min(events.length - 1, current + 1)),
      1050 / speed
    );
    return () => window.clearTimeout(timer);
  }, [events.length, finalReached, pageVisible, playing, safeIndex, speed]);

  useEffect(() => {
    if (!finalReached) return;
    setPlaying(false);
    const timer = window.setTimeout(() => setResultOpen(true), 520);
    return () => window.clearTimeout(timer);
  }, [finalReached]);

  useEffect(() => {
    if (!soundEnabled || !event || instantResult) return;
    playMatchSound(event.winnerId === currentPlayer?.id ? "positive" : "negative");
  }, [currentPlayer?.id, event, instantResult, soundEnabled]);

  if (!match || !event) {
    return (
      <div className="automatic-match automatic-match-loading">
        <div className="automatic-match-loading-card">
          {error ? (
            <Activity aria-hidden="true" />
          ) : (
            <Bot className="auto-match-loader" aria-hidden="true" />
          )}
          <strong>{error ? "MATCH INDISPONIBLE" : "PRÉPARATION DU MATCH"}</strong>
          <span>{error || "Installation des joueurs sur le court…"}</span>
          {error ? (
            <div className="automatic-match-loading-actions">
              <button type="button" onClick={() => setRetryKey((value) => value + 1)}>
                <RotateCcw size={17} /> Réessayer
              </button>
              <Link to="/duel">
                <ArrowLeft size={17} /> Retour au duel
              </Link>
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  const a = match.playerA;
  const b = match.playerB;
  const aWonPoint = event.winnerId === a.id;
  const pointWinner = aWonPoint ? a : b;
  const pointLoser = aWonPoint ? b : a;
  const statKey = event.statKey ?? "service";
  const StatIcon = statIcons[statKey] ?? Activity;
  const statLabel = automaticMatchStatLabels[statKey] ?? event.statLabel ?? "Statistique";
  const rawValues = event.rawStatValues ?? [valueFor(a, statKey), valueFor(b, statKey)];
  const totalValues = event.statValues ?? rawValues;
  const bonuses: [number, number] = [
    Math.max(0, totalValues[0] - rawValues[0]),
    Math.max(0, totalValues[1] - rawValues[1])
  ];
  const ratio = pointForceRatio(totalValues);
  const winnerIndex = aWonPoint ? 0 : 1;
  const loserIndex = aWonPoint ? 1 : 0;
  const pointGap = Math.abs(Math.round(totalValues[0] - totalValues[1]));
  const progress = events.length > 1 ? (safeIndex / (events.length - 1)) * 100 : 100;
  const momentum = match.replay.momentum[safeIndex] ?? 0;
  const momentumLeft = momentumPosition(momentum);
  const timeline = timelineWindow(events.length, safeIndex, 20);
  const clock = formatReplayClock(match.durationMinutes, safeIndex, events.length);
  const recentEvents = events.slice(Math.max(0, safeIndex - 4), safeIndex + 1).reverse();
  const actionTitle = formatAutomaticAction(event.action);
  const explanation = actionInsight({
    winnerName: playerShortName(pointWinner),
    loserName: playerShortName(pointLoser),
    statLabel,
    winnerValue: totalValues[winnerIndex],
    loserValue: totalValues[loserIndex],
    bonus: bonuses[winnerIndex]
  });
  const ballLeft = clamp(event.position.ballX) * 100;
  const ballTop = clamp(event.position.ballY) * 100;

  function jumpTo(next: number) {
    setPlaying(false);
    setResultOpen(false);
    setIndex(Math.max(0, Math.min(events.length - 1, next)));
  }

  function toggleSound() {
    const next = !soundEnabled;
    setSoundEnabled(next);
    localStorage.setItem("mypro-match-sound", next ? "1" : "0");
    if (next) playMatchSound("confirm");
  }

  return (
    <div className="automatic-match">
      <div className="automatic-match-stage">
        <header className="automatic-match-header">
          <div className="automatic-match-brand-block">
            <button
              className="auto-match-square-button auto-match-back"
              type="button"
              aria-label="Retour au duel"
              onClick={() => navigate("/duel")}
            >
              <ArrowLeft />
            </button>
            <Link className="automatic-match-brand" to="/dashboard" aria-label="MYPRO Tennis">
              <strong>MYPRO</strong>
              <span>TENNIS</span>
            </Link>
            <div className="automatic-mode-pill">
              <Bot size={17} /> <span>Mode automatique</span>
            </div>
          </div>

          <section className="automatic-scoreboard" aria-label="Tableau de score">
            <PlayerScoreIdentity
              player={a}
              image={resolvePictureSource(a.avatar)}
              accent="green"
              server={event.serverId === a.id}
            />
            <div className="automatic-score-grid">
              <div className="automatic-score-labels">
                <span>Sets</span>
                <span>Jeux</span>
                <span>Points</span>
              </div>
              <div className="automatic-score-row is-a">
                <strong>{event.score.sets[0]}</strong>
                <strong>{event.score.games[0]}</strong>
                <strong>{event.score.points[0]}</strong>
              </div>
              <div className="automatic-score-row is-b">
                <strong>{event.score.sets[1]}</strong>
                <strong>{event.score.games[1]}</strong>
                <strong>{event.score.points[1]}</strong>
              </div>
            </div>
            <PlayerScoreIdentity
              player={b}
              image={resolvePictureSource(b.avatar)}
              accent="gold"
              server={event.serverId === b.id}
              reverse
            />
          </section>

          <div className="automatic-match-header-actions">
            <button
              className="auto-match-square-button"
              type="button"
              aria-label={soundEnabled ? "Couper le son" : "Activer le son"}
              aria-pressed={soundEnabled}
              onClick={toggleSound}
            >
              {soundEnabled ? <Volume2 /> : <VolumeX />}
            </button>
            <button
              className="auto-match-square-button"
              type="button"
              aria-label={playing ? "Mettre en pause" : "Reprendre la lecture"}
              aria-pressed={playing}
              onClick={() => {
                if (finalReached) setIndex(0);
                setResultOpen(false);
                setPlaying((value) => !value);
              }}
            >
              {playing ? <Pause /> : <Play />}
            </button>
            <button
              className="auto-match-square-button auto-match-help"
              type="button"
              aria-label="Comprendre le match automatique"
              onClick={() => setHelpOpen(true)}
            >
              <HelpCircle />
            </button>
            <button
              className="auto-match-square-button"
              type="button"
              aria-label="Quitter le match"
              onClick={() => navigate("/dashboard")}
            >
              <X />
            </button>
          </div>

          <div className="automatic-score-progress">
            <strong>SET {event.score.sets[0] + event.score.sets[1] + 1}</strong>
            <span>•</span>
            <strong>JEU {event.score.games[0] + event.score.games[1] + 1}</strong>
            <span>•</span>
            <strong>
              POINT <em>{safeIndex + 1}</em>/{events.length}
            </strong>
            <div className="automatic-score-progress-track" aria-hidden="true">
              <span style={{ width: `${progress}%` }} />
            </div>
          </div>
        </header>

        <main className="automatic-match-main">
          <aside className="automatic-match-side automatic-match-feed-panel">
            <div className="automatic-panel-title">Fil du match</div>
            <small className="automatic-panel-kicker">Derniers points</small>
            <div className="automatic-feed-list">
              {recentEvents.map((item) => {
                const wonByA = item.winnerId === a.id;
                const winner = wonByA ? a : b;
                const iconKey = item.statKey ?? "service";
                const Icon = statIcons[iconKey] ?? Activity;
                return (
                  <button
                    className={`automatic-feed-item ${wonByA ? "is-a" : "is-b"} ${item.index === event.index ? "is-current" : ""}`}
                    key={item.index}
                    type="button"
                    onClick={() => jumpTo(item.index)}
                  >
                    <span className="automatic-feed-number">{item.index + 1}</span>
                    <strong>{playerShortName(winner)}</strong>
                    <span className="automatic-feed-action">
                      <Icon size={15} /> {automaticMatchStatLabels[iconKey] ?? iconKey}
                    </span>
                    <b>
                      {item.score.points[0]}-{item.score.points[1]}
                    </b>
                  </button>
                );
              })}
            </div>
            <button
              className="automatic-secondary-action"
              type="button"
              onClick={() => setFeedExpanded(true)}
            >
              Voir tout le fil <BarChart3 size={17} />
            </button>
            <div className="automatic-momentum">
              <div className="automatic-panel-title is-small">Dynamique du match</div>
              <div className="automatic-momentum-labels">
                <strong>{playerShortName(a)}</strong>
                <strong>{playerShortName(b)}</strong>
              </div>
              <div className="automatic-momentum-track">
                <span className="is-a" />
                <span className="is-b" />
                <i style={{ left: `${momentumLeft}%` }} />
              </div>
              <b className={momentum >= 0 ? "is-a" : "is-b"}>
                Avantage {momentum >= 0 ? playerShortName(a) : playerShortName(b)}
              </b>
            </div>
          </aside>

          <section className="automatic-court-scene" aria-label="Action du point">
            <div className="automatic-action-banner">
              <small>
                Échange de {event.rallyLength} frappe{event.rallyLength > 1 ? "s" : ""}
              </small>
              <strong>{actionTitle}</strong>
              <span>{playerShortName(pointWinner)} prend l'initiative et trouve l'angle.</span>
            </div>
            <img
              className={`automatic-action-player automatic-action-player-a ${aWonPoint ? "is-winner" : ""}`}
              src={actionHero(a)}
              alt={`${playerFullName(a)} en action`}
              draggable={false}
              decoding="async"
              fetchPriority="high"
            />
            <img
              className={`automatic-action-player automatic-action-player-b ${!aWonPoint ? "is-winner" : ""}`}
              src={actionHero(b)}
              alt={`${playerFullName(b)} en action`}
              draggable={false}
              decoding="async"
              fetchPriority="high"
            />
            <svg className="automatic-ball-trajectory" viewBox="0 0 100 60" aria-hidden="true">
              <defs>
                <filter id="automatic-glow">
                  <feGaussianBlur stdDeviation="1.2" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              <path
                d={`M ${aWonPoint ? 27 : 73} 46 Q 50 18 ${ballLeft.toFixed(1)} ${(ballTop * 0.55).toFixed(1)}`}
                filter="url(#automatic-glow)"
              />
            </svg>
            <span
              className="automatic-ball"
              style={{ left: `${ballLeft}%`, top: `${Math.min(72, Math.max(25, ballTop))}%` }}
              aria-hidden="true"
            />
            <div className="automatic-mini-court" aria-hidden="true">
              <span className="automatic-mini-court-net" />
              <i
                className="automatic-mini-ball"
                style={{ left: `${ballLeft}%`, top: `${ballTop}%` }}
              />
            </div>
            <div className={`automatic-point-winner ${aWonPoint ? "is-a" : "is-b"}`}>
              <span>
                <Check />
              </span>
              Point remporté par {playerFullName(pointWinner)}
            </div>
          </section>

          <aside className="automatic-match-side automatic-analysis-panel">
            <div className="automatic-panel-title is-centered">Analyse du point</div>
            <div className="automatic-analysis-stat-title">
              <span>
                <StatIcon />
              </span>
              <strong>{statLabel}</strong>
            </div>
            <div className="automatic-analysis-totals">
              <div className="is-a">
                <small>{playerShortName(a)}</small>
                <strong>{Math.round(totalValues[0])}</strong>
              </div>
              <div className="is-b">
                <small>{playerShortName(b)}</small>
                <strong>{Math.round(totalValues[1])}</strong>
              </div>
            </div>
            <div className="automatic-analysis-breakdown">
              <div>
                <b>{Math.round(rawValues[0])}</b>
                <span>Stat de base</span>
                <b>{Math.round(rawValues[1])}</b>
              </div>
              <div>
                <b>+{Math.round(bonuses[0])}</b>
                <span>Bonus forme</span>
                <b>+{Math.round(bonuses[1])}</b>
              </div>
              <div>
                <b>{Math.round(totalValues[0])}</b>
                <span>Total du point</span>
                <b>{Math.round(totalValues[1])}</b>
              </div>
            </div>
            <div className={`automatic-advantage ${aWonPoint ? "is-a" : "is-b"}`}>
              Avantage +{pointGap}
            </div>
            <div className="automatic-force-ratio">
              <div>
                <span>Rapport de force</span>
                <strong>
                  <em>{ratio[0]} %</em> / {ratio[1]} %
                </strong>
              </div>
              <div className="automatic-force-track">
                <span className="is-a" style={{ width: `${ratio[0]}%` }} />
                <span className="is-b" style={{ width: `${ratio[1]}%` }} />
                <i style={{ left: `${ratio[0]}%` }} />
              </div>
            </div>
            <p className="automatic-point-explanation">{explanation}</p>
            <button
              className="automatic-secondary-action"
              type="button"
              onClick={() => setStatsExpanded(true)}
            >
              Voir les 12 statistiques <BarChart3 size={17} />
            </button>
          </aside>
        </main>

        <footer className="automatic-replay-controls">
          <div className="automatic-replay-clock">
            <strong>Replay automatique</strong>
            <span>
              <em>{clock.current}</em> / {clock.total}
            </span>
          </div>
          <div className="automatic-timeline">
            <div className="automatic-timeline-track">
              <span style={{ width: `${progress}%` }} />
            </div>
            <div className="automatic-timeline-points">
              {timeline.map((eventIndex) => {
                const item = events[eventIndex];
                const wonByA = item?.winnerId === a.id;
                return (
                  <button
                    key={eventIndex}
                    type="button"
                    className={`${wonByA ? "is-a" : "is-b"} ${eventIndex === safeIndex ? "is-current" : ""}`}
                    aria-label={`Aller au point ${eventIndex + 1}`}
                    onClick={() => jumpTo(eventIndex)}
                  >
                    <i />
                    <span>{eventIndex + 1}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="automatic-playback-buttons">
            <button
              type="button"
              aria-label="Point précédent"
              onClick={() => jumpTo(safeIndex - 1)}
            >
              <ChevronLeft />
            </button>
            <button
              className="is-primary"
              type="button"
              aria-label={playing ? "Pause" : "Lecture"}
              aria-pressed={playing}
              onClick={() => {
                if (finalReached) setIndex(0);
                setResultOpen(false);
                setPlaying((value) => !value);
              }}
            >
              {playing ? <Pause /> : <Play />}
            </button>
            <button type="button" aria-label="Point suivant" onClick={() => jumpTo(safeIndex + 1)}>
              <ChevronRight />
            </button>
          </div>
          <div className="automatic-speed-controls">
            <small>Vitesse</small>
            <div>
              {[1, 2, 4].map((option) => (
                <button
                  key={option}
                  className={speed === option ? "is-active" : ""}
                  type="button"
                  aria-pressed={speed === option}
                  onClick={() => setSpeed(option)}
                >
                  x{option}
                </button>
              ))}
            </div>
          </div>
          <button
            className={`automatic-footer-sound ${soundEnabled ? "is-active" : ""}`}
            type="button"
            aria-label={soundEnabled ? "Couper le son" : "Activer le son"}
            aria-pressed={soundEnabled}
            onClick={toggleSound}
          >
            {soundEnabled ? <Volume2 /> : <VolumeX />}
          </button>
          <div className="automatic-footer-actions">
            <button
              className="is-result"
              type="button"
              onClick={() => {
                setResultOpen(false);
                setIndex(events.length - 1);
              }}
            >
              <FastForward /> Aller au résultat
            </button>
            <button type="button" onClick={() => navigate("/dashboard")}>
              Quitter le match <DoorOpen />
            </button>
          </div>
        </footer>

        {feedExpanded ? (
          <OverlayPanel title="Fil complet du match" onClose={() => setFeedExpanded(false)}>
            <div className="automatic-full-feed">
              {events
                .slice()
                .reverse()
                .map((item) => {
                  const winner = item.winnerId === a.id ? a : b;
                  return (
                    <button
                      key={item.index}
                      type="button"
                      onClick={() => {
                        jumpTo(item.index);
                        setFeedExpanded(false);
                      }}
                    >
                      <span>Point {item.index + 1}</span>
                      <strong>{playerFullName(winner)}</strong>
                      <em>{automaticMatchStatLabels[item.statKey ?? ""] ?? item.action}</em>
                      <b>
                        {item.score.sets.join("-")} · {item.score.games.join("-")} ·{" "}
                        {item.score.points.join("-")}
                      </b>
                    </button>
                  );
                })}
            </div>
          </OverlayPanel>
        ) : null}

        {statsExpanded ? (
          <OverlayPanel
            title="Comparaison des 12 statistiques"
            onClose={() => setStatsExpanded(false)}
          >
            <div className="automatic-full-stats">
              {displayStatKeys.map((key) => {
                const first = valueFor(a, key);
                const second = valueFor(b, key);
                const Icon = statIcons[key] ?? Activity;
                return (
                  <div key={key}>
                    <b className={first >= second ? "is-best" : ""}>{first}</b>
                    <span>
                      <Icon size={16} /> {automaticMatchStatLabels[key]}
                    </span>
                    <b className={second >= first ? "is-best" : ""}>{second}</b>
                  </div>
                );
              })}
            </div>
          </OverlayPanel>
        ) : null}

        {helpOpen ? (
          <OverlayPanel title="Comprendre le match automatique" onClose={() => setHelpOpen(false)}>
            <div className="automatic-help-copy">
              <p>
                Chaque point oppose une statistique précise des deux joueurs. Le total affiché
                combine la statistique de base et le bonus de forme du match.
              </p>
              <p>
                Le meilleur total remporte le point. Les règles normales du tennis transforment
                ensuite ces points en jeux, puis en sets.
              </p>
              <p>
                Le fil, le rapport de force et les 12 statistiques expliquent le résultat ; ils ne
                modifient jamais le calcul du serveur.
              </p>
            </div>
          </OverlayPanel>
        ) : null}

        {resultOpen && finalReached ? (
          <div
            className="automatic-result-overlay"
            role="dialog"
            aria-modal="true"
            aria-label="Résultat du match"
          >
            <section>
              <button
                type="button"
                aria-label="Fermer le résultat"
                onClick={() => setResultOpen(false)}
              >
                <X />
              </button>
              <small>Match terminé</small>
              <strong>{match.winnerId === currentPlayer?.id ? "Victoire" : "Défaite"}</strong>
              <span>{match.scoreText}</span>
              <p>
                Vainqueur : <b>{playerFullName(match.winnerId === a.id ? a : b)}</b>
              </p>
              <div>
                <button type="button" onClick={() => navigate("/dashboard")}>
                  Retour au hub
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIndex(0);
                    setResultOpen(false);
                    setPlaying(true);
                  }}
                >
                  <RotateCcw size={17} /> Revoir le match
                </button>
              </div>
            </section>
          </div>
        ) : null}
      </div>
      <div className="automatic-orientation-message">
        <RotateCcw />
        <strong>Tournez votre appareil</strong>
        <span>Le match automatique se joue en format paysage.</span>
      </div>
    </div>
  );
}

function PlayerScoreIdentity({
  player,
  image,
  accent,
  server,
  reverse = false
}: {
  player: Player;
  image: string;
  accent: "green" | "gold";
  server: boolean;
  reverse?: boolean;
}) {
  return (
    <div className={`automatic-player-identity is-${accent} ${reverse ? "is-reverse" : ""}`}>
      <img src={image} alt="" draggable={false} decoding="async" />
      <div>
        <strong>{playerFullName(player)}</strong>
        <span>{player.fftRanking || "NC"}</span>
      </div>
      {server ? <i title="Au service">●</i> : null}
    </div>
  );
}

function OverlayPanel({
  title,
  onClose,
  children
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className="automatic-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      <section onClick={(event) => event.stopPropagation()}>
        <header>
          <h2>{title}</h2>
          <button type="button" aria-label="Fermer" onClick={onClose}>
            <X />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}
