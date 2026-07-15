import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  BarChart3,
  Check,
  ChevronLeft,
  CircleHelp,
  Crosshair,
  Eye,
  Gauge,
  HeartPulse,
  History,
  Layers3,
  ListFilter,
  Pause,
  ShieldCheck,
  Sparkles,
  Target,
  Volume2,
  VolumeX,
  X,
  Zap
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { ApiError, api } from "../../api";
import { useGameStore, type Player } from "../../store";

type CoachingCategory =
  | "target"
  | "serve-return"
  | "court-position"
  | "rally"
  | "mental"
  | "physical"
  | "risk";

type CoachingInstruction = {
  id: string;
  label: string;
  shortLabel: string;
  description: string;
  category: CoachingCategory;
  durationGames: number;
  energyMultiplier: number;
};

type CoachCardFamily = "BOOST" | "COUNTER" | "STATE" | "DECK";

type CoachCard = {
  id: string;
  family: CoachCardFamily;
  name: string;
  shortName: string;
  description: string;
  focusCost: number;
  duration: { unit: "POINTS" | "GAMES" | "IMMEDIATE" | "NEXT_WINDOW"; amount: number };
  primaryStats: string[];
};

type CoachCardPreview = {
  cardId: string;
  variantId: "IMPACT" | "FLOW" | null;
  variantName: string | null;
  focusCost: number;
  intentMatched: boolean;
  scaledStatBoosts: Record<string, number>;
  pointChanceBefore: number;
  pointChanceAfter: number;
  pointChanceDelta: number;
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

type CoachDeckRuntime = {
  hand: Array<{
    instanceId: string;
    cardId: string;
    variantId?: "IMPACT" | "FLOW" | null;
  }>;
  focus: number;
  focusPerSet: number;
  setIndex: number;
  nextCardFocusDiscount: number;
  opponentIntent: {
    id: string;
    label: string;
    description: string;
    targetStats: string[];
    recommendedCardIds: string[];
    confidence: number;
    intensity: 1 | 2 | 3;
    reason: string;
  } | null;
  activeEffects: Array<{
    sourceCardId: string;
    remainingPoints: number | null;
    remainingGames: number | null;
  }>;
  history: Array<{
    windowId: string;
    pointIndex: number;
    cardId: string | null;
    variantId?: "IMPACT" | "FLOW" | null;
    focusSpent: number;
    intentId: string;
    intentMatched: boolean;
    pointChanceDelta: number;
  }>;
};

type CoachIntent = {
  id: string;
  label: string;
  description: string;
  targetStats: string[];
  recommendedCardIds: string[];
  durationPoints: number;
};

type ProbabilityBreakdown = {
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

type ScoreView = {
  points: [string, string];
  games: [number, number];
  sets: [number, number];
  setHistory: Array<[number, number]>;
  serverIndex: 0 | 1;
  inTieBreak: boolean;
};

type InteractivePointEvent = {
  index: number;
  serverId: string;
  winnerId: string;
  action: string;
  rallyLength: number;
  score: ScoreView;
  probabilityForPlayerA: number;
  probabilityBreakdown: ProbabilityBreakdown;
  roll: number;
  energy: [number, number];
  confidence: [number, number];
  momentum: number;
  isBreakPoint: boolean;
  isSetPoint: boolean;
  isMatchPoint: boolean;
  statKey?: string;
  statLabel?: string;
  activeCoachCardIds?: string[];
};

type InteractiveMatchSession = {
  id: string;
  type: string;
  surface: string;
  format: string;
  status: "ACTIVE" | "COMPLETING" | "FINISHED" | "ABANDONED";
  revision: number;
  completedMatchId: string | null;
  playerA: Player;
  playerB: Player;
  coachingInstructions: CoachingInstruction[];
  coachCards: CoachCard[];
  coachIntents?: CoachIntent[];
  coachHandPreviews: Array<{ instanceId: string; preview: CoachCardPreview }>;
  coachDeckRewards: {
    totalMasteryXp: number;
    won: boolean;
    abandoned: boolean;
    cards: Array<{
      cardId: string;
      name: string;
      plays: number;
      intentMatches: number;
      xpGained: number;
      xpBefore: number;
      xpAfter: number;
      levelBefore: number;
      levelAfter: number;
      nextLevelXp: number | null;
      progress: number;
      unlockedVariants: Array<{ id: string; name: string; description: string }>;
    }>;
    unlockedCards: Array<{
      cardId: string;
      name: string;
      family: string;
      unlockLevel: number;
    }>;
  } | null;
  matchState: {
    status: "PLAYING" | "AWAITING_COACH" | "FINISHED";
    score: {
      pointValues: [number, number];
      games: [number, number];
      sets: [number, number];
      setHistory: Array<[number, number]>;
      serverIndex: 0 | 1;
      inTieBreak: boolean;
    };
    pointIndex: number;
    energy: [number, number];
    confidence: [number, number];
    momentum: number;
    coachingPoints: [number, number];
    activeInstructions: [
      { id: string; remainingGames: number } | null,
      { id: string; remainingGames: number } | null
    ];
    coachingHistory: Array<{
      instructionId: string | null;
      pointIndex: number;
    }>;
    coachDeck?: CoachDeckRuntime | null;
    coachWindow: {
      id: string;
      type: "PRE_MATCH" | "CHANGEOVER" | "PRESSURE" | "SET_BREAK";
      title: string;
      analysis: string;
      recommendedInstructionIds: string[];
      score: ScoreView;
    } | null;
    events: InteractivePointEvent[];
    winnerId: string | null;
    scoreText: string;
  };
};

type InteractiveMatchPageProps = {
  resolveHeroSource: (avatar: string) => string | undefined;
  resolvePictureSource: (avatar: string) => string;
};

type FeedbackBalance = "TOO_EASY" | "BALANCED" | "TOO_HARD";

const categoryLabels: Record<CoachingCategory, string> = {
  target: "Zone ciblée",
  "serve-return": "Service et retour",
  "court-position": "Position",
  rally: "Construction",
  mental: "Mental",
  physical: "Physique",
  risk: "Prise de risque"
};

const pointLabels = ["0", "15", "30", "40"];
const tacticalStatLabels: Record<string, string> = {
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
const probabilityFactorLabels: Record<Exclude<keyof ProbabilityBreakdown, "total">, string> = {
  service: "Avantage au service",
  statistics: "Statistiques du point",
  physical: "Énergie et physique",
  confidence: "Confiance",
  momentum: "Momentum",
  surface: "Affinité avec la surface",
  tactic: "Style tactique",
  risk: "Prise de risque",
  coaching: "Consigne classique",
  coachDeck: "Cartes Coach actives"
};
const profileStatKeys = [
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
] as const;
const tacticalStatKeys = [...profileStatKeys];
let sharedAudioContext: AudioContext | null = null;

export function playMatchSound(kind: "confirm" | "positive" | "negative" | "finish") {
  if (typeof window === "undefined") return;
  const AudioContextClass = window.AudioContext;
  if (!AudioContextClass) return;
  sharedAudioContext ??= new AudioContextClass();
  const context = sharedAudioContext;
  if (context.state === "suspended") void context.resume();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const now = context.currentTime;
  const frequencies = {
    confirm: [420, 610],
    positive: [520, 760],
    negative: [310, 220],
    finish: [440, 660]
  } as const;
  const [start, end] = frequencies[kind];
  oscillator.type = kind === "negative" ? "triangle" : "sine";
  oscillator.frequency.setValueAtTime(start, now);
  oscillator.frequency.exponentialRampToValueAtTime(end, now + (kind === "finish" ? 0.34 : 0.16));
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(kind === "finish" ? 0.11 : 0.07, now + 0.025);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + (kind === "finish" ? 0.42 : 0.21));
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(now);
  oscillator.stop(now + (kind === "finish" ? 0.44 : 0.23));
}

function pointValueLabel(value: number) {
  return pointLabels[value] ?? String(value);
}

function scoreFromSession(session: InteractiveMatchSession): ScoreView {
  const state = session.matchState;
  const latest = state.events.at(-1)?.score;
  if (state.coachWindow?.score) return state.coachWindow.score;
  if (latest) return latest;
  return {
    points: [
      pointValueLabel(state.score.pointValues[0]),
      pointValueLabel(state.score.pointValues[1])
    ],
    games: state.score.games,
    sets: state.score.sets,
    setHistory: state.score.setHistory,
    serverIndex: state.score.serverIndex,
    inTieBreak: state.score.inTieBreak
  };
}

function playerName(player: Player) {
  return `${player.firstName} ${player.lastName}`.trim() || player.name;
}

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function startingMatchEnergy(player: Player) {
  return clampPercent(
    Math.max(
      40,
      Math.min(
        95,
        80 + (player.energy - 50) * 0.18 + (player.health - 75) * 0.12 - player.fatigue * 0.22
      )
    )
  );
}

function momentumLabel(momentum: number) {
  if (momentum >= 22) return "Avantage net";
  if (momentum >= 7) return "Dynamique positive";
  if (momentum <= -22) return "Sous forte pression";
  if (momentum <= -7) return "Dynamique adverse";
  return "Match équilibré";
}

function contextLabel(session: InteractiveMatchSession) {
  const latest = session.matchState.events.at(-1);
  if (latest?.isMatchPoint) return "BALLE DE MATCH";
  if (latest?.isSetPoint) return "BALLE DE SET";
  if (latest?.isBreakPoint) return "BALLE DE BREAK";
  if (session.matchState.coachWindow?.type === "SET_BREAK") return "PAUSE ENTRE LES SETS";
  if (session.matchState.coachWindow?.type === "PRE_MATCH") return "AVANT-MATCH";
  return "CHANGEMENT DE CÔTÉ";
}

function matchupInsights(player: Player, opponent: Player) {
  const values = tacticalStatKeys.map((key) => ({
    key,
    label: tacticalStatLabels[key] ?? key,
    player: Math.round(player.stats[key] ?? 0),
    opponent: Math.round(opponent.stats[key] ?? 0)
  }));
  const threat = [...values].sort((a, b) => b.opponent - a.opponent)[0] ?? values[0]!;
  const weaknessPool = values.filter((item) =>
    ["service", "return", "forehand", "backhand", "volley"].includes(item.key)
  );
  const weakness = [...weaknessPool].sort((a, b) => a.opponent - b.opponent)[0] ?? threat;
  const advantage =
    [...values].sort((a, b) => b.player - b.opponent - (a.player - a.opponent))[0] ?? threat;
  return { threat, weakness, advantage };
}

function instructionReason(instruction: CoachingInstruction, player: Player, opponent: Player) {
  const own = (key: string) => Math.round(player.stats[key] ?? 0);
  const rival = (key: string) => Math.round(opponent.stats[key] ?? 0);
  switch (instruction.id) {
    case "attack-backhand":
      return `Revers adverse ${rival("backhand")} · coup droit ${rival("forehand")}`;
    case "attack-forehand":
      return `Coup droit adverse ${rival("forehand")} · revers ${rival("backhand")}`;
    case "extend-rallies":
      return `Endurance ${own("stamina")} contre ${rival("stamina")}`;
    case "shorten-rallies":
      return `Éviter son endurance ${rival("stamina")} · chercher le coup gagnant`;
    case "attack-second-serve":
      return `Votre retour ${own("return")} contre son service ${rival("service")}`;
    case "secure-second-serve":
      return `Votre service ${own("service")} · réduit le risque de double faute`;
    case "rush-net":
      return `Votre volée ${own("volley")} contre son retour ${rival("return")}`;
    case "stay-calm":
      return "Réduit les fautes sous pression et stabilise la confiance";
    case "conserve-energy":
      return "Préserve le physique, mais abandonne une partie de l’initiative";
    case "take-risks":
      return "Plus de coups gagnants, mais aussi davantage de fautes directes";
    default:
      return instruction.description;
  }
}

function MatchBrand() {
  return (
    <div className="interactive-match-brand" aria-label="MYPRO TENNIS">
      <strong>MYPRO</strong>
      <span>TENNIS</span>
    </div>
  );
}

function PlayerHero({
  player,
  side,
  resolveHeroSource,
  resolvePictureSource
}: {
  player: Player;
  side: "left" | "right";
  resolveHeroSource: InteractiveMatchPageProps["resolveHeroSource"];
  resolvePictureSource: InteractiveMatchPageProps["resolvePictureSource"];
}) {
  const hero = resolveHeroSource(player.avatar);
  return (
    <div className={`interactive-player-hero interactive-player-${side}`} aria-hidden="true">
      <div className="interactive-player-aura" />
      <img
        alt=""
        decoding="async"
        draggable={false}
        fetchPriority="high"
        src={hero ?? resolvePictureSource(player.avatar)}
      />
    </div>
  );
}

function StatusMeter({
  icon: Icon,
  label,
  value,
  tone
}: {
  icon: typeof Gauge;
  label: string;
  value: number;
  tone: "energy" | "confidence";
}) {
  const percent = clampPercent(value);
  return (
    <div className={`interactive-status-meter interactive-status-${tone}`}>
      <div className="interactive-status-heading">
        <span>
          <Icon size={14} /> {label}
        </span>
        <strong>{percent}%</strong>
      </div>
      <div className="interactive-status-track" aria-label={`${label} ${percent}%`}>
        <span style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function TacticalCourt({ momentum }: { momentum: number }) {
  const targetRight = momentum >= 0;
  return (
    <div className="interactive-tactical-court" aria-label="Zone tactique conseillée">
      <span className="interactive-court-net" />
      <span className={`interactive-target-zone ${targetRight ? "is-right" : "is-left"}`} />
      <span className="interactive-court-player is-bottom" />
      <span className="interactive-court-player is-top" />
      <span className={`interactive-shot-line ${targetRight ? "is-right" : "is-left"}`} />
    </div>
  );
}

function InstructionCard({
  instruction,
  selected,
  onSelect,
  compact = false,
  disabled = false,
  reason
}: {
  instruction: CoachingInstruction;
  selected: boolean;
  onSelect: () => void;
  compact?: boolean;
  disabled?: boolean;
  reason?: string;
}) {
  const Icon =
    instruction.category === "mental"
      ? ShieldCheck
      : instruction.category === "physical"
        ? Zap
        : Target;
  return (
    <button
      aria-pressed={selected}
      className={`interactive-instruction-card ${selected ? "is-selected" : ""} ${compact ? "is-compact" : ""}`}
      disabled={disabled}
      onClick={onSelect}
      type="button"
    >
      <span className="interactive-instruction-icon">
        <Icon size={compact ? 15 : 18} />
      </span>
      <span className="interactive-instruction-copy">
        <small>{selected ? "✓ Votre choix" : categoryLabels[instruction.category]}</small>
        <strong>{instruction.label}</strong>
        {!compact ? (
          <span className="interactive-instruction-reason">
            {reason ?? instruction.description}
          </span>
        ) : null}
        {!compact ? <em>{instruction.durationGames} jeu(x)</em> : null}
      </span>
      <span className="interactive-radio" aria-hidden="true" />
    </button>
  );
}

const coachCardFamilyLabels: Record<CoachCardFamily, string> = {
  BOOST: "Boost",
  COUNTER: "Contre",
  STATE: "Mental & physique",
  DECK: "Tactique"
};

function coachCardDuration(card: CoachCard) {
  if (card.duration.unit === "IMMEDIATE") return "Immédiat";
  if (card.duration.unit === "NEXT_WINDOW") return "Prochaine décision";
  const unit = card.duration.unit === "GAMES" ? "jeu" : "point";
  return `${card.duration.amount} ${unit}${card.duration.amount > 1 ? "s" : ""}`;
}

function coachCardPreviewLines(preview: CoachCardPreview | undefined) {
  if (!preview) return ["Aperçu en cours de calcul"];
  const lines: string[] = [];
  const boosts = Object.entries(preview.scaledStatBoosts)
    .filter(([, value]) => value > 0)
    .slice(0, 2)
    .map(([key, value]) => `+${Math.round(value)} ${tacticalStatLabels[key] ?? key}`);
  lines.push(...boosts);
  if (preview.energyDelta)
    lines.push(`${preview.energyDelta > 0 ? "+" : ""}${Math.round(preview.energyDelta)} énergie`);
  if (preview.confidenceDelta)
    lines.push(
      `${preview.confidenceDelta > 0 ? "+" : ""}${Math.round(preview.confidenceDelta)} confiance`
    );
  if (preview.draw) lines.push(`Pioche ${preview.draw} carte${preview.draw > 1 ? "s" : ""}`);
  if (preview.discardThenDraw)
    lines.push(
      `Renouvelle ${preview.discardThenDraw} carte${preview.discardThenDraw > 1 ? "s" : ""}`
    );
  if (preview.nextCardFocusDiscount)
    lines.push(`-${preview.nextCardFocusDiscount} Focus sur la prochaine carte`);
  if (preview.energyDrainMultiplier < 0.99) lines.push("Réduit la dépense d’énergie");
  if (lines.length === 0 && preview.pointChanceDelta > 0)
    lines.push("Avantage temporaire sur les prochains points");
  return lines.slice(0, 2);
}

function probabilityFactorEntries(event: InteractivePointEvent) {
  return (
    Object.keys(probabilityFactorLabels) as Array<Exclude<keyof ProbabilityBreakdown, "total">>
  )
    .map((key) => ({
      key,
      label: probabilityFactorLabels[key],
      value: event.probabilityBreakdown[key]
    }))
    .filter((factor) => Math.abs(factor.value) >= 0.001)
    .sort((left, right) => Math.abs(right.value) - Math.abs(left.value));
}

function probabilityEdgeLabel(value: number) {
  const points = Math.round(value * 100);
  if (points === 0) return "0 pt";
  return `${points > 0 ? "+" : ""}${points} pt${Math.abs(points) > 1 ? "s" : ""}`;
}

function CoachDeckMatchCard({
  card,
  preview,
  selected,
  disabled,
  effectiveCost,
  onSelect
}: {
  card: CoachCard;
  preview?: CoachCardPreview | undefined;
  selected: boolean;
  disabled: boolean;
  effectiveCost: number;
  onSelect: () => void;
}) {
  const Icon =
    card.family === "BOOST"
      ? Zap
      : card.family === "COUNTER"
        ? ShieldCheck
        : card.family === "STATE"
          ? HeartPulse
          : Layers3;
  const DiagramIcon =
    card.family === "COUNTER"
      ? ShieldCheck
      : card.family === "STATE"
        ? HeartPulse
        : card.family === "DECK"
          ? Eye
          : Zap;
  return (
    <button
      aria-pressed={selected}
      className={`coach-deck-match-card is-${card.family.toLowerCase()} ${selected ? "is-selected" : ""}`}
      disabled={disabled}
      onClick={onSelect}
      type="button"
    >
      <span className="coach-deck-card-family">
        <Icon size={15} /> {coachCardFamilyLabels[card.family]}
      </span>
      {preview?.variantName ? (
        <span className="coach-deck-card-variant">{preview.variantName}</span>
      ) : null}
      {selected ? (
        <span className="coach-deck-card-selected">
          <Check size={12} /> Votre choix
        </span>
      ) : null}
      <strong>{card.name}</strong>
      <small>{card.description}</small>
      <span className="coach-deck-card-diagram" aria-hidden="true">
        <DiagramIcon className="coach-deck-diagram-symbol" />
        <i />
        <i />
        <i />
        <em />
        <em />
      </span>
      <span className="coach-deck-card-effects">
        {coachCardPreviewLines(preview).map((line) => (
          <em key={line}>{line}</em>
        ))}
      </span>
      <span className="coach-deck-card-footer">
        <em>{coachCardDuration(card)}</em>
        <b>
          <Sparkles size={12} /> {effectiveCost}
        </b>
      </span>
    </button>
  );
}

export function InteractiveMatchPage({
  resolveHeroSource,
  resolvePictureSource
}: InteractiveMatchPageProps) {
  const { id } = useParams();
  const navigate = useNavigate();
  const refreshPlayer = useGameStore((state) => state.refresh);
  const [session, setSession] = useState<InteractiveMatchSession | null>(null);
  const [error, setError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [selectedInstructionId, setSelectedInstructionId] = useState<string | null>(null);
  const [selectedCoachCardInstanceId, setSelectedCoachCardInstanceId] = useState<string | null>(
    null
  );
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [matchupOpen, setMatchupOpen] = useState(false);
  const [pauseOpen, setPauseOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(
    () => localStorage.getItem("mypro-match-sound") === "1"
  );
  const [feedbackBalance, setFeedbackBalance] = useState<FeedbackBalance | null>(null);
  const [feedbackEnjoyment, setFeedbackEnjoyment] = useState<number | null>(null);
  const [feedbackBusy, setFeedbackBusy] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    setError("");
    void api<InteractiveMatchSession>(`/matches/interactive/${id}`)
      .then((payload) => {
        if (cancelled) return;
        setSession(payload);
        setSelectedInstructionId(null);
        setSelectedCoachCardInstanceId(null);
      })
      .catch((caught) => {
        if (!cancelled) setError(caught instanceof Error ? caught.message : "Match introuvable.");
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function reloadCurrentSession(message = "Le match a été actualisé.") {
    if (!id) return;
    const payload = await api<InteractiveMatchSession>(`/matches/interactive/${id}`);
    setSession(payload);
    setSelectedInstructionId(null);
    setSelectedCoachCardInstanceId(null);
    setActionMessage(message);
  }

  async function submitCoachingDecision() {
    if (!id || !session || busy || session.status !== "ACTIVE") return;
    setBusy(true);
    setActionMessage("");
    if (soundEnabled) playMatchSound("confirm");
    const coachDeck = session.matchState.coachDeck;
    const selectedCoachInstance = coachDeck?.hand.find(
      (instance) => instance.instanceId === selectedCoachCardInstanceId
    );
    const selectedCoachCard = session.coachCards.find(
      (card) => card.id === selectedCoachInstance?.cardId
    );
    if (coachDeck) {
      try {
        const payload = await api<InteractiveMatchSession>(`/matches/interactive/${id}/card`, {
          method: "POST",
          body: JSON.stringify({
            revision: session.revision,
            cardInstanceId: selectedCoachCardInstanceId
          })
        });
        setSession(payload);
        setSelectedCoachCardInstanceId(null);
        setActionMessage(
          selectedCoachCard
            ? `✓ Carte jouée : ${selectedCoachCard.name}. Son effet temporaire est maintenant actif.`
            : "✓ Décision enregistrée : votre joueur continue sans dépenser de Focus."
        );
        if (payload.status === "FINISHED" || payload.matchState.status === "FINISHED") {
          if (soundEnabled) {
            playMatchSound(
              payload.matchState.winnerId === payload.playerA.id ? "finish" : "negative"
            );
          }
          await refreshPlayer();
        } else if (soundEnabled) {
          const latest = payload.matchState.events.at(-1);
          playMatchSound(latest?.winnerId === payload.playerA.id ? "positive" : "negative");
        }
      } catch (caught) {
        if (caught instanceof ApiError && caught.status === 409) {
          try {
            await reloadCurrentSession(
              "Le match avait déjà progressé sur un autre appareil. Le score affiché est à jour."
            );
          } catch (reloadError) {
            setActionMessage(
              reloadError instanceof Error ? reloadError.message : "Actualisation impossible."
            );
          }
        } else {
          setActionMessage(caught instanceof Error ? caught.message : "Carte impossible à jouer.");
        }
      } finally {
        setBusy(false);
      }
      return;
    }
    const isFreePlan = session.matchState.coachWindow?.type === "PRE_MATCH";
    const chosenInstruction = session.coachingInstructions.find(
      (instruction) => instruction.id === selectedInstructionId
    );
    const instructionId =
      isFreePlan || session.matchState.coachingPoints[0] > 0 ? selectedInstructionId : null;
    try {
      const payload = await api<InteractiveMatchSession>(`/matches/interactive/${id}/coach`, {
        method: "POST",
        body: JSON.stringify({ revision: session.revision, instructionId })
      });
      setSession(payload);
      setSelectedInstructionId(null);
      setActionMessage(
        chosenInstruction
          ? `✓ Consigne appliquée : ${chosenInstruction.label} pendant ${chosenInstruction.durationGames} jeu(x).${isFreePlan ? " Plan initial gratuit." : " 1 point de coaching utilisé."}`
          : "✓ Décision enregistrée : votre joueur continue sans nouvelle consigne."
      );
      if (payload.status === "FINISHED" || payload.matchState.status === "FINISHED") {
        if (soundEnabled) {
          playMatchSound(
            payload.matchState.winnerId === payload.playerA.id ? "finish" : "negative"
          );
        }
        await refreshPlayer();
      } else if (soundEnabled) {
        const latest = payload.matchState.events.at(-1);
        playMatchSound(latest?.winnerId === payload.playerA.id ? "positive" : "negative");
      }
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 409) {
        try {
          await reloadCurrentSession(
            "Le match avait déjà progressé sur un autre appareil. Le score affiché est à jour."
          );
        } catch (reloadError) {
          setActionMessage(
            reloadError instanceof Error ? reloadError.message : "Actualisation impossible."
          );
        }
      } else {
        setActionMessage(caught instanceof Error ? caught.message : "Consigne impossible.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function abandonMatch() {
    if (!id || !session || busy || session.status !== "ACTIVE") return;
    setBusy(true);
    setActionMessage("");
    try {
      const payload = await api<InteractiveMatchSession>(`/matches/interactive/${id}/abandon`, {
        method: "POST",
        body: JSON.stringify({ revision: session.revision })
      });
      setSession(payload);
      setPauseOpen(false);
      await refreshPlayer();
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 409) {
        try {
          await reloadCurrentSession(
            "Le match a changé sur un autre appareil. Vérifiez le score avant de continuer."
          );
          setPauseOpen(false);
        } catch (reloadError) {
          setActionMessage(
            reloadError instanceof Error ? reloadError.message : "Actualisation impossible."
          );
        }
      } else {
        setActionMessage(caught instanceof Error ? caught.message : "Abandon impossible.");
      }
    } finally {
      setBusy(false);
    }
  }

  function toggleSound() {
    const enabled = !soundEnabled;
    setSoundEnabled(enabled);
    localStorage.setItem("mypro-match-sound", enabled ? "1" : "0");
    if (enabled) playMatchSound("confirm");
  }

  async function sendBetaFeedback(balance: FeedbackBalance, enjoyment?: number) {
    if (!id || feedbackBusy) return;
    setFeedbackBusy(true);
    setFeedbackMessage("");
    try {
      await api(`/matches/interactive/${id}/feedback`, {
        method: "POST",
        body: JSON.stringify({
          balance,
          enjoyment,
          viewport:
            window.innerWidth <= 1100 && window.innerWidth > window.innerHeight
              ? "MOBILE_LANDSCAPE"
              : window.innerWidth > 1100
                ? "DESKTOP"
                : "OTHER",
          comment: ""
        })
      });
      setFeedbackBalance(balance);
      setFeedbackEnjoyment(enjoyment ?? feedbackEnjoyment);
      setFeedbackMessage("Merci, votre avis aidera à équilibrer les prochains matchs.");
    } catch (caught) {
      setFeedbackMessage(caught instanceof Error ? caught.message : "Avis non enregistré.");
    } finally {
      setFeedbackBusy(false);
    }
  }

  const recommendedInstructions = useMemo(() => {
    if (!session) return [];
    const ids = session.matchState.coachWindow?.recommendedInstructionIds ?? [];
    const recommendations = ids
      .map((instructionId) =>
        session.coachingInstructions.find((instruction) => instruction.id === instructionId)
      )
      .filter((instruction): instruction is CoachingInstruction => Boolean(instruction));
    return recommendations.length > 0
      ? recommendations.slice(0, 3)
      : session.coachingInstructions.slice(0, 3);
  }, [session]);

  if (error) {
    return (
      <main className="interactive-match-screen interactive-match-state-screen">
        <MatchBrand />
        <section>
          <CircleHelp size={34} />
          <h1>Impossible de rejoindre le court</h1>
          <p>{error}</p>
          <button onClick={() => navigate("/duel")} type="button">
            <ChevronLeft size={17} /> Retour aux duels
          </button>
        </section>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="interactive-match-screen interactive-match-state-screen" aria-busy="true">
        <MatchBrand />
        <section>
          <span className="interactive-loading-ball" aria-hidden="true" />
          <h1>Entrée sur le court</h1>
          <p>Préparation de l’analyse et des consignes...</p>
        </section>
      </main>
    );
  }

  const score = scoreFromSession(session);
  const playerA = session.playerA;
  const playerB = session.playerB;
  const coachDeck = session.matchState.coachDeck ?? null;
  const isCoachDeck = Boolean(coachDeck);
  const selectedCoachInstance = coachDeck?.hand.find(
    (instance) => instance.instanceId === selectedCoachCardInstanceId
  );
  const selectedCoachCard = session.coachCards.find(
    (card) => card.id === selectedCoachInstance?.cardId
  );
  const selectedCoachPreview = session.coachHandPreviews.find(
    (entry) => entry.instanceId === selectedCoachCardInstanceId
  )?.preview;
  const isPreMatch = session.matchState.coachWindow?.type === "PRE_MATCH";
  const canChooseInstruction = isPreMatch || session.matchState.coachingPoints[0] > 0;
  const insights = matchupInsights(playerA, playerB);
  const analysis =
    session.matchState.coachWindow?.analysis ??
    "Observez l’évolution du score et adaptez votre plan pour le prochain passage.";
  const latestEvent = session.matchState.events.at(-1);
  const selectedInstruction = session.coachingInstructions.find(
    (instruction) => instruction.id === selectedInstructionId
  );
  const visibleInstructions = selectedInstruction
    ? [
        selectedInstruction,
        ...recommendedInstructions.filter(
          (instruction) => instruction.id !== selectedInstruction.id
        )
      ].slice(0, 3)
    : recommendedInstructions;
  const activeInstruction = session.coachingInstructions.find(
    (instruction) => instruction.id === session.matchState.activeInstructions[0]?.id
  );
  const initialEnergy = startingMatchEnergy(playerA);
  const playerAPoints = session.matchState.events.filter(
    (event) => event.winnerId === playerA.id
  ).length;
  const playerBPoints = session.matchState.events.length - playerAPoints;
  const longestRally = session.matchState.events.reduce(
    (longest, event) => Math.max(longest, event.rallyLength),
    0
  );
  const usedInstructions = isCoachDeck
    ? (coachDeck?.history.filter((decision) => decision.cardId !== null).length ?? 0)
    : session.matchState.coachingHistory.filter((decision) => decision.instructionId !== null)
        .length;
  const resultFact =
    session.matchState.winnerId === playerA.id && playerA.overall < playerB.overall
      ? `Exploit : victoire face à un adversaire mieux noté de ${playerB.overall - playerA.overall} point(s).`
      : session.matchState.winnerId === playerA.id
        ? "Votre plan de jeu a tenu jusqu’au dernier point."
        : playerA.overall > playerB.overall
          ? "Contre-performance : l’adversaire a renversé le rapport de force initial."
          : "L’adversaire a confirmé son avantage, mais vos décisions serviront au prochain match.";
  const selectedIntentTargets =
    coachDeck?.opponentIntent?.targetStats.map((key) => tacticalStatLabels[key] ?? key) ?? [];
  const selectedCardStats =
    selectedCoachCard?.primaryStats.map((key) => tacticalStatLabels[key] ?? key) ?? [];
  const tacticalHistory = (coachDeck?.history ?? []).map((decision, index) => {
    const card = session.coachCards.find((candidate) => candidate.id === decision.cardId) ?? null;
    const intent =
      session.coachIntents?.find((candidate) => candidate.id === decision.intentId) ?? null;
    const nextEvent =
      session.matchState.events.find((event) => event.index >= decision.pointIndex) ?? null;
    const chanceAfter = nextEvent?.probabilityForPlayerA ?? null;
    const chanceBefore =
      chanceAfter === null
        ? null
        : Math.max(0.18, Math.min(0.82, chanceAfter - decision.pointChanceDelta));
    return { index, decision, card, intent, nextEvent, chanceBefore, chanceAfter };
  });

  return (
    <main
      className={`interactive-match-screen ${isCoachDeck ? "is-coach-deck" : ""} ${busy ? "is-resolving" : ""}`}
    >
      <div className="interactive-arena-layer" aria-hidden="true" />
      <header className="interactive-match-header">
        <MatchBrand />
        <section
          className="interactive-scoreboard"
          aria-label="Score du match"
          key={session.revision}
        >
          <div className="interactive-score-player is-left">
            <img alt="" src={resolvePictureSource(playerA.avatar)} />
            <span>
              <strong>{playerName(playerA)}</strong>
              <small>{playerA.fftRanking}</small>
            </span>
          </div>
          <div className="interactive-score-center">
            <div className="interactive-set-score">
              <strong>{score.sets[0]}</strong>
              <span>SETS</span>
              <strong>{score.sets[1]}</strong>
            </div>
            <div
              aria-label={`Jeux : ${score.games[0]} à ${score.games[1]}`}
              className="interactive-game-score"
            >
              <strong>{score.games[0]}</strong>
              <span>JEUX</span>
              <strong>{score.games[1]}</strong>
            </div>
            <div className="interactive-point-score">
              <strong>{score.points[0]}</strong>
              <span>POINTS</span>
              <strong>{score.points[1]}</strong>
            </div>
            <em>{contextLabel(session)}</em>
          </div>
          <div className="interactive-score-player is-right">
            <span>
              <strong>{playerName(playerB)}</strong>
              <small>{playerB.fftRanking}</small>
            </span>
            <img alt="" src={resolvePictureSource(playerB.avatar)} />
          </div>
        </section>
        <div className="interactive-header-actions">
          {isCoachDeck ? (
            <button
              aria-label="Historique tactique"
              onClick={() => setHistoryOpen(true)}
              title="Historique tactique"
              type="button"
            >
              <History size={18} />
            </button>
          ) : null}
          <button
            aria-label={soundEnabled ? "Couper le son" : "Activer le son"}
            onClick={toggleSound}
            title={soundEnabled ? "Couper le son" : "Activer le son"}
            type="button"
          >
            {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </button>
          <button
            aria-label="Mettre le match en pause"
            onClick={() => setPauseOpen(true)}
            title="Pause"
            type="button"
          >
            <Pause size={18} />
          </button>
          <button
            aria-label="Aide du match"
            onClick={() => setHelpOpen(true)}
            title="Aide"
            type="button"
          >
            <CircleHelp size={18} />
          </button>
        </div>
      </header>

      <section className="interactive-match-stage">
        <PlayerHero
          player={playerA}
          resolveHeroSource={resolveHeroSource}
          resolvePictureSource={resolvePictureSource}
          side="left"
        />
        <PlayerHero
          player={playerB}
          resolveHeroSource={resolveHeroSource}
          resolvePictureSource={resolvePictureSource}
          side="right"
        />

        {isCoachDeck && coachDeck ? (
          <>
            <aside className="coach-deck-player-dashboard">
              <section className="coach-deck-player-vitals">
                <div>
                  <span>
                    <Zap size={18} /> Énergie
                  </span>
                  <strong>{clampPercent(session.matchState.energy[0])}/100</strong>
                  <i>
                    <b style={{ width: `${clampPercent(session.matchState.energy[0])}%` }} />
                  </i>
                </div>
                <div>
                  <span>
                    <ShieldCheck size={18} /> Confiance
                  </span>
                  <strong>{clampPercent(session.matchState.confidence[0])}</strong>
                  <i>
                    <b style={{ width: `${clampPercent(session.matchState.confidence[0])}%` }} />
                  </i>
                </div>
                <div className="is-momentum">
                  <span>
                    <Activity size={18} /> Momentum
                  </span>
                  <strong>{momentumLabel(session.matchState.momentum)}</strong>
                  <i>
                    {Array.from({ length: 5 }, (_, index) => (
                      <b
                        className={
                          index <
                          Math.max(
                            1,
                            Math.min(5, Math.round((session.matchState.momentum + 50) / 20))
                          )
                            ? "is-filled"
                            : ""
                        }
                        key={index}
                      />
                    ))}
                  </i>
                </div>
              </section>
              <section className="coach-deck-stat-comparison">
                <h2>Comparaison 12 stats</h2>
                {profileStatKeys.map((key) => {
                  const playerValue = Math.round(playerA.stats[key] ?? 0);
                  const opponentValue = Math.round(playerB.stats[key] ?? 0);
                  const targeted = coachDeck.opponentIntent?.targetStats.includes(key) ?? false;
                  return (
                    <div className={targeted ? "is-targeted" : ""} key={key}>
                      <b>{playerValue}</b>
                      <span>{tacticalStatLabels[key]}</span>
                      <i>
                        <em style={{ width: `${clampPercent(playerValue)}%` }} />
                        <em style={{ width: `${clampPercent(opponentValue)}%` }} />
                      </i>
                      <b>{opponentValue}</b>
                    </div>
                  );
                })}
              </section>
            </aside>

            <aside className="coach-deck-opponent-scouting">
              <h2>Scouting adversaire</h2>
              <section className="coach-deck-opponent-level">
                <small>Niveau</small>
                <div>
                  <b>{playerB.fftRanking}</b>
                  <strong>Niv. {playerB.playerLevel}</strong>
                </div>
              </section>
              <section className="coach-deck-scout-block is-strength">
                <small>Point fort</small>
                <strong>{insights.threat.label}</strong>
                <span>{insights.threat.opponent}</span>
                <Zap size={29} />
              </section>
              <section className="coach-deck-scout-block is-weakness">
                <small>Point faible</small>
                <strong>{insights.weakness.label}</strong>
                <span>{insights.weakness.opponent}</span>
                <Target size={29} />
              </section>
              <section className="coach-deck-opponent-style">
                <small>Style de jeu</small>
                <strong>{playerB.archetype}</strong>
                <div aria-hidden="true">
                  <i />
                  <i />
                  <i />
                  <span />
                  <span />
                </div>
              </section>
            </aside>
          </>
        ) : null}

        <aside className="interactive-analysis-panel">
          {isCoachDeck ? (
            <>
              <div className="interactive-panel-kicker">
                <Crosshair size={14} /> Scouting adverse
              </div>
              <h2>{playerName(playerB)}</h2>
              <p>
                {coachDeck?.opponentIntent
                  ? `Lecture basée sur ${coachDeck.opponentIntent.targetStats
                      .map((key) => tacticalStatLabels[key] ?? key)
                      .join(", ")} et l’état actuel du match.`
                  : "Lisez l’intention adverse avant de choisir votre réponse."}
              </p>
              <div className="interactive-analysis-event is-coach-intent">
                <Target size={14} />
                <span>
                  Menace : {insights.threat.label} {insights.threat.opponent}
                </span>
              </div>
              <button
                className="interactive-open-matchup"
                onClick={() => setMatchupOpen(true)}
                type="button"
              >
                <BarChart3 size={14} /> Comparer les 12 stats
              </button>
            </>
          ) : (
            <>
              <div className="interactive-panel-kicker">
                <Activity size={14} /> {isPreMatch ? "Analyse adversaire" : "Analyse live"}
              </div>
              <h2>{session.matchState.coachWindow?.title ?? "Temps fort"}</h2>
              <p>{analysis}</p>
              <div className="interactive-analysis-event">
                <Crosshair size={14} />
                <span>{latestEvent?.action ?? "Lecture tactique prête"}</span>
              </div>
              <TacticalCourt momentum={session.matchState.momentum} />
            </>
          )}
        </aside>

        <div className="interactive-court-perspective" aria-hidden="true">
          <span className="interactive-court-center-line" />
          <span className="interactive-court-service-line" />
          <span className="interactive-court-ball" />
        </div>

        {isCoachDeck && coachDeck?.opponentIntent ? (
          <section className="coach-deck-intent-banner">
            <Target className="coach-deck-intent-icon" size={34} />
            <span>INTENTION ADVERSE</span>
            <strong>{coachDeck.opponentIntent.label}</strong>
            <small>{coachDeck.opponentIntent.description}</small>
            <em>
              Lecture {Math.round(coachDeck.opponentIntent.confidence * 100)} % · Intensité{" "}
              {coachDeck.opponentIntent.intensity}/3
            </em>
          </section>
        ) : isPreMatch ? (
          <section className="interactive-strategy-brief">
            <header>
              <span>SCOUTING DE L’ADVERSAIRE</span>
              <strong>Construisez votre plan de match</strong>
              <small>Le plan initial est gratuit et ne consomme aucun point de coaching.</small>
            </header>
            <div>
              <article className="is-danger">
                <small>Sa principale menace</small>
                <strong>{insights.threat.label}</strong>
                <span>{insights.threat.opponent}</span>
              </article>
              <article className="is-target">
                <small>Zone à cibler</small>
                <strong>{insights.weakness.label}</strong>
                <span>{insights.weakness.opponent}</span>
              </article>
              <article className="is-advantage">
                <small>Votre meilleur avantage</small>
                <strong>{insights.advantage.label}</strong>
                <span>+{Math.max(0, insights.advantage.player - insights.advantage.opponent)}</span>
              </article>
            </div>
            <p>
              Les trois propositions ci-dessous sont calculées à partir de ces écarts. Vous pouvez
              aussi commencer sans plan et garder vos trois interventions pour plus tard.
            </p>
            <button
              className="interactive-open-matchup"
              onClick={() => setMatchupOpen(true)}
              type="button"
            >
              <BarChart3 size={14} /> Comparer les 12 statistiques
            </button>
          </section>
        ) : latestEvent ? (
          <div className="interactive-point-callout" key={latestEvent.index}>
            <span>
              {latestEvent.isMatchPoint
                ? "POINT DÉCISIF"
                : latestEvent.isBreakPoint
                  ? "POINT DE BREAK"
                  : `ÉCHANGE DE ${latestEvent.rallyLength} FRAPPE(S)`}
            </span>
            <strong>{latestEvent.action}</strong>
          </div>
        ) : null}

        {latestEvent && !isPreMatch ? (
          <span
            className={`interactive-point-flash ${latestEvent.winnerId === playerA.id ? "is-left" : "is-right"}`}
            key={`flash-${latestEvent.index}`}
          />
        ) : null}

        <aside className="interactive-player-status">
          <div className="interactive-panel-kicker">
            <BarChart3 size={14} /> État du joueur
          </div>
          <StatusMeter
            icon={Zap}
            label="Énergie"
            tone="energy"
            value={session.matchState.energy[0]}
          />
          <div className="interactive-energy-source">
            <strong>Départ calculé : {initialEnergy}%</strong>
            <small>
              Forme {Math.round(playerA.energy)} · Santé {Math.round(playerA.health)} · Fatigue{" "}
              {Math.round(playerA.fatigue)}
            </small>
          </div>
          <StatusMeter
            icon={Sparkles}
            label="Confiance"
            tone="confidence"
            value={session.matchState.confidence[0]}
          />
          <div className="interactive-momentum-card">
            <span>Momentum</span>
            <strong>{momentumLabel(session.matchState.momentum)}</strong>
            <div className="interactive-momentum-scale">
              <span style={{ left: `${clampPercent(50 + session.matchState.momentum / 2)}%` }} />
            </div>
          </div>
          {isCoachDeck && coachDeck?.activeEffects.length ? (
            <div className="interactive-active-plan is-coach-card-active">
              <Sparkles size={13} />
              <span>{coachDeck.activeEffects.length} effet(s) de carte actif(s)</span>
            </div>
          ) : session.matchState.activeInstructions[0] ? (
            <div className="interactive-active-plan">
              <Target size={13} />
              <span>
                Plan actif : {activeInstruction?.shortLabel ?? "Consigne"} ·{" "}
                {session.matchState.activeInstructions[0]?.remainingGames} jeu(x)
              </span>
            </div>
          ) : null}
        </aside>
      </section>

      {isCoachDeck && coachDeck ? (
        <section className="coach-deck-match-dock">
          <header className="coach-deck-dock-header">
            <span>
              <strong>VOTRE MAIN</strong>
              <small>Choisissez une carte ou laissez votre joueur continuer</small>
            </span>
            <div className="coach-deck-focus" aria-label={`${coachDeck.focus} Focus disponible`}>
              <em>FOCUS</em>
              {Array.from({ length: coachDeck.focusPerSet }, (_, index) => (
                <i className={index < coachDeck.focus ? "is-filled" : ""} key={index} />
              ))}
              <b>
                {coachDeck.focus}/{coachDeck.focusPerSet}
              </b>
            </div>
            <button
              className="coach-deck-stats-button"
              onClick={() => setMatchupOpen(true)}
              type="button"
            >
              <BarChart3 size={15} /> 12 stats
            </button>
            <button
              className="coach-deck-stats-button coach-deck-history-button"
              onClick={() => setHistoryOpen(true)}
              type="button"
            >
              <History size={15} /> Historique
            </button>
          </header>

          <div
            className="coach-deck-hand"
            style={{
              gridTemplateColumns: `repeat(${Math.max(1, coachDeck.hand.length)}, minmax(0, 1fr))`
            }}
          >
            {coachDeck.hand.map((instance) => {
              const card = session.coachCards.find((candidate) => candidate.id === instance.cardId);
              if (!card) return null;
              const preview = session.coachHandPreviews.find(
                (entry) => entry.instanceId === instance.instanceId
              )?.preview;
              const effectiveCost = Math.max(
                0,
                (preview?.focusCost ?? card.focusCost) - coachDeck.nextCardFocusDiscount
              );
              return (
                <CoachDeckMatchCard
                  card={card}
                  disabled={busy || effectiveCost > coachDeck.focus}
                  effectiveCost={effectiveCost}
                  key={instance.instanceId}
                  onSelect={() => setSelectedCoachCardInstanceId(instance.instanceId)}
                  preview={preview}
                  selected={selectedCoachCardInstanceId === instance.instanceId}
                />
              );
            })}
          </div>

          {selectedCoachCard && selectedCoachPreview ? (
            <div className="coach-deck-selected-effect">
              <strong>
                {selectedCoachPreview.intentMatched ? "CONTRE DIRECT" : "BONUS TACTIQUE"} ·{" "}
                {selectedCardStats.join(" + ")}
              </strong>
              <small>
                {Math.round(selectedCoachPreview.pointChanceBefore * 100)} →{" "}
                {Math.round(selectedCoachPreview.pointChanceAfter * 100)} % ·{" "}
                {coachCardDuration(selectedCoachCard)}
              </small>
            </div>
          ) : null}

          <aside
            className={`coach-deck-selection-preview ${selectedCoachCard ? "has-selection" : ""}`}
          >
            <div>
              <small>{selectedCoachCard ? "CARTE SÉLECTIONNÉE" : "DÉCISION ACTUELLE"}</small>
              <strong>{selectedCoachCard?.name ?? "Laisser jouer"}</strong>
              <span>
                {selectedCoachCard
                  ? "La carte sera consommée uniquement après confirmation."
                  : "Aucun Focus dépensé. La main sera renouvelée à la prochaine décision."}
              </span>
            </div>
            {selectedCoachPreview ? (
              <div className="coach-deck-chance-preview">
                <span>
                  <small>Chance estimée</small>
                  <b>{Math.round(selectedCoachPreview.pointChanceBefore * 100)}%</b>
                </span>
                <em>→</em>
                <span className="is-after">
                  <small>Avec la carte</small>
                  <b>{Math.round(selectedCoachPreview.pointChanceAfter * 100)}%</b>
                </span>
                {selectedCoachPreview.intentMatched ? <strong>CONTRE PARFAIT</strong> : null}
              </div>
            ) : null}
            {selectedCoachCard && selectedCoachPreview && coachDeck.opponentIntent ? (
              <div className="coach-deck-choice-explanation">
                <strong>
                  {selectedCoachPreview.intentMatched
                    ? "✓ Réponse directe à l’intention"
                    : "Effet utile, sans contre direct"}
                </strong>
                <span>
                  L’adversaire cible {selectedIntentTargets.join(" + ")}. Cette carte utilise{" "}
                  {selectedCardStats.join(" + ")}.
                </span>
                <small>
                  Résultat estimé :{" "}
                  {Math.round(selectedCoachPreview.pointChanceDelta * 100) >= 0 ? "+" : ""}
                  {Math.round(selectedCoachPreview.pointChanceDelta * 100)} point(s) de chance sur
                  le prochain point. Le résultat reste incertain.
                </small>
              </div>
            ) : null}
            <div className="coach-deck-decision-actions">
              <button
                className={!selectedCoachCard ? "is-selected" : ""}
                disabled={busy}
                onClick={() => setSelectedCoachCardInstanceId(null)}
                type="button"
              >
                Laisser jouer
              </button>
              <button
                className="is-confirm"
                disabled={
                  busy ||
                  session.status !== "ACTIVE" ||
                  session.matchState.status !== "AWAITING_COACH"
                }
                onClick={() => void submitCoachingDecision()}
                type="button"
              >
                <span>
                  {busy ? "ACTION EN COURS..." : selectedCoachCard ? "CONFIRMER" : "CONTINUER"}
                </span>
                <small>
                  {selectedCoachCard ? selectedCoachCard.shortName : "Sans dépenser de Focus"}
                </small>
              </button>
            </div>
          </aside>
          {actionMessage ? (
            <p
              className={`interactive-action-message ${actionMessage.startsWith("✓") ? "is-success" : ""}`}
              role="status"
            >
              {actionMessage}
            </p>
          ) : null}
        </section>
      ) : (
        <section className="interactive-coaching-dock">
          <div className="interactive-coaching-heading">
            <span>
              <strong>{isPreMatch ? "PLAN DE MATCH" : "COACHING"}</strong>
              <small>
                {isPreMatch
                  ? "GRATUIT · 3 INTERVENTIONS CONSERVÉES"
                  : `${session.matchState.coachingPoints[0]} INTERVENTION(S) DISPONIBLE(S)`}
              </small>
            </span>
            <div className="interactive-coaching-tools">
              <button onClick={() => setCatalogOpen(true)} type="button">
                <ListFilter size={15} /> Consignes
              </button>
              <button onClick={() => setMatchupOpen(true)} type="button">
                <BarChart3 size={15} /> Statistiques
              </button>
            </div>
            <button
              className={selectedInstructionId === null ? "is-selected" : ""}
              onClick={() => setSelectedInstructionId(null)}
              type="button"
            >
              {isPreMatch ? "Commencer sans plan" : "Laisser jouer"}
            </button>
          </div>
          <div className="interactive-coaching-options">
            {visibleInstructions.map((instruction) => (
              <InstructionCard
                disabled={!canChooseInstruction}
                instruction={instruction}
                key={instruction.id}
                onSelect={() => setSelectedInstructionId(instruction.id)}
                reason={instructionReason(instruction, playerA, playerB)}
                selected={selectedInstructionId === instruction.id}
              />
            ))}
          </div>
          <button
            className={`interactive-validate-button ${busy ? "is-busy" : ""}`}
            disabled={
              busy || session.status !== "ACTIVE" || session.matchState.status !== "AWAITING_COACH"
            }
            onClick={() => void submitCoachingDecision()}
            type="button"
          >
            <span>
              {busy
                ? "ACTION PRISE EN COMPTE..."
                : isPreMatch
                  ? selectedInstruction
                    ? "CONFIRMER LE PLAN"
                    : "LANCER LE MATCH"
                  : selectedInstruction
                    ? "CONFIRMER"
                    : "LAISSER JOUER"}
            </span>
            <small>
              {!canChooseInstruction
                ? "Continuer sans consigne"
                : (selectedInstruction?.shortLabel ??
                  (isPreMatch ? "Aucun point dépensé" : "Conserver le plan actuel"))}
            </small>
          </button>
          {actionMessage ? (
            <p
              className={`interactive-action-message ${actionMessage.startsWith("✓") ? "is-success" : ""}`}
              role="status"
            >
              {actionMessage}
            </p>
          ) : null}
        </section>
      )}

      {catalogOpen && !isCoachDeck ? (
        <div className="interactive-catalog-overlay" onClick={() => setCatalogOpen(false)}>
          <section
            aria-labelledby="interactive-catalog-title"
            className="interactive-catalog-panel"
            onClick={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <p>Plan de jeu</p>
                <h2 id="interactive-catalog-title">Toutes les consignes</h2>
              </div>
              <button aria-label="Fermer" onClick={() => setCatalogOpen(false)} type="button">
                <X size={18} />
              </button>
            </header>
            <div className="interactive-catalog-grid">
              {session.coachingInstructions.map((instruction) => (
                <InstructionCard
                  compact
                  disabled={!canChooseInstruction}
                  instruction={instruction}
                  key={instruction.id}
                  onSelect={() => {
                    setSelectedInstructionId(instruction.id);
                    setCatalogOpen(false);
                  }}
                  selected={selectedInstructionId === instruction.id}
                />
              ))}
            </div>
          </section>
        </div>
      ) : null}

      {historyOpen && isCoachDeck ? (
        <div
          className="interactive-catalog-overlay coach-deck-history-overlay"
          onClick={() => setHistoryOpen(false)}
        >
          <section
            aria-labelledby="coach-deck-history-title"
            className="interactive-catalog-panel coach-deck-history-panel"
            onClick={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <p>Transparence du match</p>
                <h2 id="coach-deck-history-title">Historique tactique détaillé</h2>
              </div>
              <button aria-label="Fermer" onClick={() => setHistoryOpen(false)} type="button">
                <X size={18} />
              </button>
            </header>
            <div className="coach-deck-history-explainer">
              <CircleHelp />
              <p>
                Chaque point part de 50 %. Le service, les statistiques adaptées à l’échange,
                l’énergie, la confiance, le momentum, la surface, la tactique et vos cartes
                déplacent cette chance. Un tirage d’incertitude décide ensuite le point : mieux
                jouer augmente vos chances sans supprimer les exploits ni les contre-performances.
              </p>
            </div>
            <div className="coach-deck-history-summary">
              <span>
                <small>Décisions</small>
                <strong>{tacticalHistory.length}</strong>
              </span>
              <span>
                <small>Contres directs</small>
                <strong>
                  {tacticalHistory.filter((item) => item.decision.intentMatched).length}
                </strong>
              </span>
              <span>
                <small>Focus dépensé</small>
                <strong>
                  {tacticalHistory.reduce((total, item) => total + item.decision.focusSpent, 0)}
                </strong>
              </span>
              <span>
                <small>Points joués</small>
                <strong>{session.matchState.events.length}</strong>
              </span>
            </div>

            <section className="coach-deck-decision-history">
              <h3>Vos décisions Coach</h3>
              {tacticalHistory.length ? (
                <div>
                  {tacticalHistory.map((item) => (
                    <article key={`${item.decision.windowId}-${item.index}`}>
                      <span className={item.decision.intentMatched ? "is-success" : ""}>
                        {item.index + 1}
                      </span>
                      <div>
                        <small>INTENTION · {item.intent?.label ?? item.decision.intentId}</small>
                        <strong>{item.card?.name ?? "Laisser jouer"}</strong>
                        <p>
                          {item.card
                            ? item.decision.intentMatched
                              ? "Contre direct : la carte répondait précisément à l’intention affichée."
                              : "Bonus appliqué, mais la carte ne contrait pas directement cette intention."
                            : "Aucun Focus dépensé : vous avez gardé vos ressources pour une prochaine décision."}
                        </p>
                        {item.nextEvent ? (
                          <em>
                            Point suivant :{" "}
                            {item.nextEvent.winnerId === playerA.id ? "gagné" : "perdu"} ·{" "}
                            {item.nextEvent.statLabel ??
                              tacticalStatLabels[item.nextEvent.statKey ?? ""] ??
                              "échange"}
                          </em>
                        ) : null}
                      </div>
                      <aside>
                        <small>Chance estimée</small>
                        <strong>
                          {item.chanceBefore === null
                            ? "—"
                            : `${Math.round(item.chanceBefore * 100)} %`}
                          <ChevronLeft className="is-forward" />
                          {item.chanceAfter === null
                            ? "—"
                            : `${Math.round(item.chanceAfter * 100)} %`}
                        </strong>
                        <span>
                          {item.decision.focusSpent} Focus ·{" "}
                          {probabilityEdgeLabel(item.decision.pointChanceDelta)}
                        </span>
                      </aside>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="coach-deck-empty-history">
                  Votre première décision apparaîtra ici avec son intention, son coût et son effet.
                </p>
              )}
            </section>

            <section className="coach-deck-point-history">
              <h3>Calcul des points</h3>
              <div>
                {[...session.matchState.events].reverse().map((event) => {
                  const factors = probabilityFactorEntries(event);
                  return (
                    <details key={event.index}>
                      <summary>
                        <span>POINT {event.index + 1}</span>
                        <strong>
                          {event.statLabel ?? tacticalStatLabels[event.statKey ?? ""] ?? "Échange"}
                        </strong>
                        <em>{Math.round(event.probabilityForPlayerA * 100)} % pour vous</em>
                        <b className={event.winnerId === playerA.id ? "is-won" : "is-lost"}>
                          {event.winnerId === playerA.id ? "GAGNÉ" : "PERDU"}
                        </b>
                      </summary>
                      <div className="coach-deck-point-detail">
                        <p>
                          {event.action} · {event.rallyLength} frappe(s)
                        </p>
                        <div className="coach-deck-probability-formula">
                          <span>
                            <small>Base</small>
                            <strong>50 %</strong>
                          </span>
                          {factors.map((factor) => (
                            <span
                              className={factor.value >= 0 ? "is-positive" : "is-negative"}
                              key={factor.key}
                            >
                              <small>{factor.label}</small>
                              <strong>{probabilityEdgeLabel(factor.value)}</strong>
                            </span>
                          ))}
                          <span className="is-total">
                            <small>Chance finale</small>
                            <strong>{Math.round(event.probabilityForPlayerA * 100)} %</strong>
                          </span>
                        </div>
                        <small>
                          Tirage d’incertitude : {Math.round(event.roll * 100)} %. Votre joueur
                          gagne lorsque le tirage tombe dans sa zone de chance. Ce tirage explique
                          qu’un favori puisse perdre un point, sans annuler l’avantage statistique
                          sur la durée.
                        </small>
                      </div>
                    </details>
                  );
                })}
              </div>
            </section>
          </section>
        </div>
      ) : null}

      {matchupOpen ? (
        <div className="interactive-catalog-overlay" onClick={() => setMatchupOpen(false)}>
          <section
            aria-labelledby="interactive-matchup-title"
            className="interactive-catalog-panel interactive-matchup-panel"
            onClick={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <p>Analyse de l’adversaire</p>
                <h2 id="interactive-matchup-title">Les 12 statistiques utilisées</h2>
              </div>
              <button aria-label="Fermer" onClick={() => setMatchupOpen(false)} type="button">
                <X size={18} />
              </button>
            </header>
            <div className="interactive-matchup-body">
              <div className="interactive-matchup-players">
                <article>
                  <small>Votre joueur</small>
                  <strong>{playerName(playerA)}</strong>
                  <span>Niveau {playerA.overall}</span>
                </article>
                <p>
                  Chaque point utilise plusieurs statistiques selon la situation. Le niveau global
                  est une moyenne, pas le résultat direct du match.
                </p>
                <article>
                  <small>Adversaire</small>
                  <strong>{playerName(playerB)}</strong>
                  <span>Niveau {playerB.overall}</span>
                </article>
              </div>
              <div className="interactive-matchup-grid">
                {profileStatKeys.map((key) => {
                  const playerValue = Math.round(playerA.stats[key] ?? 0);
                  const opponentValue = Math.round(playerB.stats[key] ?? 0);
                  const difference = playerValue - opponentValue;
                  return (
                    <article key={key}>
                      <span
                        className={`interactive-matchup-value ${difference > 0 ? "is-leading" : ""}`}
                      >
                        <small>Vous</small>
                        <strong>{playerValue}</strong>
                      </span>
                      <span className="interactive-matchup-stat">
                        <strong>{tacticalStatLabels[key]}</strong>
                        <small>
                          {difference === 0
                            ? "Équilibre"
                            : difference > 0
                              ? `Avantage +${difference}`
                              : `Retard ${difference}`}
                        </small>
                      </span>
                      <span
                        className={`interactive-matchup-value ${difference < 0 ? "is-leading is-opponent" : ""}`}
                      >
                        <small>Adversaire</small>
                        <strong>{opponentValue}</strong>
                      </span>
                    </article>
                  );
                })}
              </div>
            </div>
          </section>
        </div>
      ) : null}

      {pauseOpen ? (
        <div className="interactive-dialog-overlay">
          <section className="interactive-dialog-panel" aria-labelledby="pause-match-title">
            <Pause size={28} />
            <p>Match en pause</p>
            <h2 id="pause-match-title">Que souhaitez-vous faire ?</h2>
            <span>Votre progression est déjà sauvegardée sur le serveur.</span>
            <div>
              <button className="is-primary" onClick={() => setPauseOpen(false)} type="button">
                Reprendre
              </button>
              <button onClick={() => navigate("/duel")} type="button">
                Sauvegarder et quitter
              </button>
              <button
                className="is-danger"
                disabled={busy}
                onClick={() => void abandonMatch()}
                type="button"
              >
                {busy ? "Abandon..." : "Abandonner le match"}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {helpOpen ? (
        <div className="interactive-dialog-overlay" onClick={() => setHelpOpen(false)}>
          <section
            className="interactive-dialog-panel interactive-help-panel"
            onClick={(event) => event.stopPropagation()}
          >
            <CircleHelp size={28} />
            <p>Mode coach</p>
            <h2>Comprendre le match et gagner</h2>
            <ul>
              <li>
                Le score suit les règles du tennis : points, jeux puis sets. Le premier à gagner
                deux sets remporte ce format de match.
              </li>
              <li>
                Avant chaque point, le moteur compare les statistiques utiles à la situation : les
                12 statistiques visibles du profil participent directement au match.
              </li>
              <li>
                Le serveur, la surface, l’énergie, la confiance, le momentum et votre consigne
                ajustent ensuite la probabilité de gagner le point.
              </li>
              <li>
                Une part d’incertitude reste toujours présente : une bonne consigne améliore vos
                chances, mais ne garantit jamais le point.
              </li>
              <li>
                L’énergie commence sur une base de 80 %, ajustée par la forme, la santé et la
                fatigue. Elle reste comprise entre 40 % et 95 % au coup d’envoi.
              </li>
              <li>
                L’endurance et la récupération ralentissent ensuite la perte d’énergie pendant les
                échanges, surtout lors des longs rallyes.
              </li>
              {isCoachDeck ? (
                <>
                  <li>
                    L’intention adverse annonce sa prochaine stratégie. Les cartes « Contre » sont
                    plus fortes lorsqu’elles répondent directement à cette intention.
                  </li>
                  <li>
                    Chaque carte coûte du Focus et améliore temporairement les statistiques qui y
                    sont inscrites. Le Focus est entièrement restauré au début de chaque set.
                  </li>
                  <li>
                    La comparaison « avant / avec la carte » estime l’effet sur le prochain point.
                    Une carte marquée « Votre choix » ne sera jouée qu’après confirmation.
                  </li>
                  <li>
                    « Laisser jouer » ne dépense aucun Focus. Garder vos meilleures réponses pour
                    une balle de break ou une intention dangereuse fait partie de la stratégie.
                  </li>
                  <li>
                    Pour gagner, combinez vos meilleures statistiques, les faiblesses adverses,
                    votre énergie et le bon timing : aucune carte ne garantit le point.
                  </li>
                </>
              ) : (
                <>
                  <li>
                    Le plan d’avant-match est gratuit. Une consigne marquée « Votre choix » sera
                    appliquée seulement après avoir appuyé sur « Confirmer ».
                  </li>
                  <li>
                    Une consigne agit pendant un à trois jeux. « Laisser jouer » continue sans
                    dépenser de point de coaching.
                  </li>
                  <li>
                    Pour gagner, ciblez une faiblesse adverse avec une force de votre joueur,
                    protégez son énergie et adaptez-vous si la confiance ou le momentum chutent.
                  </li>
                  <li>
                    Vous récupérez un point entre les sets, sans jamais dépasser trois points de
                    coaching.
                  </li>
                </>
              )}
            </ul>
            <div className="interactive-help-actions">
              {isCoachDeck ? (
                <button onClick={() => navigate("/coach-deck/tutorial")} type="button">
                  Rejouer le tutoriel
                </button>
              ) : null}
              <button className="is-primary" onClick={() => setHelpOpen(false)} type="button">
                Compris
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {session.status === "FINISHED" ||
      session.status === "ABANDONED" ||
      session.matchState.status === "FINISHED" ? (
        <div className="interactive-dialog-overlay interactive-result-overlay">
          <section className="interactive-dialog-panel interactive-result-panel">
            <Sparkles size={32} />
            <p>Match terminé</p>
            <h2>{session.matchState.winnerId === playerA.id ? "VICTOIRE" : "DÉFAITE"}</h2>
            <strong>{session.matchState.scoreText}</strong>
            <span>
              {session.status === "ABANDONED"
                ? "Match perdu par abandon."
                : `${session.matchState.pointIndex} points disputés.`}
            </span>
            <div className="interactive-result-metrics">
              <span>
                <small>Points gagnés</small>
                <strong>
                  {playerAPoints} - {playerBPoints}
                </strong>
              </span>
              <span>
                <small>Plus long échange</small>
                <strong>{longestRally} frappes</strong>
              </span>
              <span>
                <small>{isCoachDeck ? "Cartes jouées" : "Consignes utilisées"}</small>
                <strong>{usedInstructions}</strong>
              </span>
              <span>
                <small>Énergie finale</small>
                <strong>{clampPercent(session.matchState.energy[0])}%</strong>
              </span>
            </div>
            <p className="interactive-result-fact">{resultFact}</p>
            {isCoachDeck && session.coachDeckRewards ? (
              <section className="coach-deck-result-rewards">
                <header>
                  <span>
                    <Sparkles size={15} /> PROGRESSION DES CARTES
                  </span>
                  <strong>+{session.coachDeckRewards.totalMasteryXp} XP DE MAÎTRISE</strong>
                </header>
                {session.coachDeckRewards.abandoned ? (
                  <p>La maîtrise n’est pas accordée après un abandon.</p>
                ) : session.coachDeckRewards.cards.length ? (
                  <div className="coach-deck-reward-list">
                    {session.coachDeckRewards.cards.map((reward) => (
                      <article key={reward.cardId}>
                        <div>
                          <strong>{reward.name}</strong>
                          <span>
                            {reward.plays} utilisation{reward.plays > 1 ? "s" : ""}
                            {reward.intentMatches
                              ? ` · ${reward.intentMatches} contre${reward.intentMatches > 1 ? "s" : ""} réussi${reward.intentMatches > 1 ? "s" : ""}`
                              : ""}
                          </span>
                        </div>
                        <b>+{reward.xpGained} XP</b>
                        <i>
                          <span style={{ width: `${Math.round(reward.progress * 100)}%` }} />
                        </i>
                        <small>
                          Maîtrise {reward.levelAfter}
                          {reward.levelAfter > reward.levelBefore ? " · NIVEAU SUPÉRIEUR" : ""}
                        </small>
                        {reward.unlockedVariants.map((variant) => (
                          <em key={variant.id}>VARIANTE DÉBLOQUÉE · {variant.name}</em>
                        ))}
                      </article>
                    ))}
                  </div>
                ) : (
                  <p>Jouez une carte pendant le match pour gagner de la maîtrise.</p>
                )}
                {session.coachDeckRewards.unlockedCards.length ? (
                  <div className="coach-deck-unlocked-cards">
                    <strong>NOUVELLES CARTES</strong>
                    {session.coachDeckRewards.unlockedCards.map((card) => (
                      <span key={card.cardId}>{card.name}</span>
                    ))}
                  </div>
                ) : null}
              </section>
            ) : null}
            <section className="interactive-beta-feedback">
              <p>Ce match vous a semblé...</p>
              <div className="interactive-balance-feedback">
                {[
                  ["TOO_EASY", "Trop facile"],
                  ["BALANCED", "Équilibré"],
                  ["TOO_HARD", "Trop difficile"]
                ].map(([value, label]) => (
                  <button
                    className={feedbackBalance === value ? "is-selected" : ""}
                    disabled={feedbackBusy}
                    key={value}
                    onClick={() => void sendBetaFeedback(value as FeedbackBalance)}
                    type="button"
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="interactive-enjoyment-feedback">
                <span>Plaisir de jeu</span>
                {[1, 2, 3, 4, 5].map((rating) => (
                  <button
                    aria-label={`Plaisir ${rating} sur 5`}
                    className={feedbackEnjoyment === rating ? "is-selected" : ""}
                    disabled={feedbackBusy || !feedbackBalance}
                    key={rating}
                    onClick={() => {
                      setFeedbackEnjoyment(rating);
                      if (feedbackBalance) void sendBetaFeedback(feedbackBalance, rating);
                    }}
                    type="button"
                  >
                    {rating}
                  </button>
                ))}
              </div>
              {feedbackMessage ? <small role="status">{feedbackMessage}</small> : null}
            </section>
            <div>
              <button className="is-primary" onClick={() => navigate("/dashboard")} type="button">
                Retour au hub
              </button>
              <button
                onClick={() => (isCoachDeck ? setHistoryOpen(true) : navigate("/matches"))}
                type="button"
              >
                {isCoachDeck ? "Détail tactique" : "Voir l’historique"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
