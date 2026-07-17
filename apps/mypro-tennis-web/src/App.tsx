import { useEffect, useMemo, useState } from "react";
import type React from "react";
import { lazy, Suspense } from "react";
import { createPortal } from "react-dom";
import {
  Link,
  NavLink,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams
} from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  BarChart3,
  Bell,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Coins,
  Crosshair,
  Dumbbell,
  Eye,
  FastForward,
  Flame,
  Gauge,
  Gem,
  Gift,
  Hand,
  HelpCircle,
  HeartPulse,
  History,
  Image,
  Lock,
  LogOut,
  LogIn,
  Menu,
  MoveDown,
  MoveUpRight,
  MessageCircle,
  PackageOpen,
  Pause,
  Play,
  Repeat2,
  Search,
  Settings,
  Shield,
  SkipForward,
  Sparkles,
  Swords,
  Target,
  Trophy,
  Upload,
  UserPlus,
  Users,
  Volume2,
  VolumeX,
  Wifi,
  Wind,
  X,
  Zap
} from "lucide-react";
import { countries, countryLabel, normalizeCountryCode, type Country } from "@mypro/shared";
import { API_URL, SOCKET_URL, api, saveToken, warmApi } from "./api";
import { LobbyActionButton } from "./components/lobby/LobbyActionButton";
import { LobbyPlayerHero } from "./components/lobby/LobbyPlayerHero";
import { LobbySeasonTrack } from "./components/lobby/LobbySeasonTrack";
import { InteractiveMatchPage, playMatchSound } from "./components/match/InteractiveMatchPage";
import { useGameStore, type GameNotification, type Player } from "./store";

const loadCoachDeckBuilder = () => import("./components/coach-deck/CoachDeckBuilderPage");
const loadCoachDeckTutorial = () => import("./components/coach-deck/CoachDeckTutorialPage");
const loadCollection = () => import("./components/collection/CollectionPage");
const loadSkills = () => import("./components/skills/SkillsPage");
const loadClub = () => import("./components/club/ClubPage");
const loadDuel = () => import("./components/duel/DuelPage");
const loadAutomaticMatch = () => import("./components/match/AutomaticMatchPage");

const CoachDeckBuilderPage = lazy(() =>
  loadCoachDeckBuilder().then((module) => ({ default: module.CoachDeckBuilderPage }))
);
const CoachDeckTutorialPage = lazy(() =>
  loadCoachDeckTutorial().then((module) => ({ default: module.CoachDeckTutorialPage }))
);
const CollectionCinematicPage = lazy(() =>
  loadCollection().then((module) => ({ default: module.CollectionPage }))
);
const SkillsCinematicPage = lazy(() =>
  loadSkills().then((module) => ({ default: module.SkillsPage }))
);
const ClubPage = lazy(() => loadClub().then((module) => ({ default: module.ClubPage })));
const DuelPage = lazy(() => loadDuel().then((module) => ({ default: module.DuelPage })));
const AutomaticMatchPage = lazy(() =>
  loadAutomaticMatch().then((module) => ({ default: module.AutomaticMatchPage }))
);

const socketUrl = SOCKET_URL;
const discordInviteUrl = import.meta.env.VITE_DISCORD_INVITE_URL ?? "";

const nav = [
  ["Tableau de bord", "/dashboard", Activity],
  ["Mon joueur", "/player", Shield],
  ["Compétences", "/skills", Target],
  ["Collection", "/collection", PackageOpen],
  ["Mon club", "/club", Users],
  ["Saison en cours", "/season", Trophy],
  ["Duel", "/duel", Swords],
  ["Historique", "/matches", History],
  ["Classement", "/rankings", BarChart3],
  ["Joueurs en ligne", "/online", Wifi],
  ["Communauté", "/community", MessageCircle]
] as const;

const mobileNav = [
  ["Accueil", "/dashboard", Activity],
  ["Duel", "/duel", Swords],
  ["Saison", "/season", Trophy],
  ["Collection", "/collection", PackageOpen],
  ["Club", "/club", Users]
] as const;

const routeDataPaths: Record<string, readonly string[]> = {
  "/player": ["/players/me/career"],
  "/skills": ["/skills"],
  "/collection": ["/chests"],
  "/club": ["/clubs/me"],
  "/season": ["/season"],
  "/tournaments": ["/tournaments"],
  "/duel": ["/matches/duel-pool"],
  "/matches": ["/matches"],
  "/rankings": ["/rankings"]
};

const routeModuleLoaders: Record<string, (() => Promise<unknown>) | undefined> = {
  "/skills": loadSkills,
  "/collection": loadCollection,
  "/collection/coach-deck": loadCoachDeckBuilder,
  "/coach-deck/tutorial": loadCoachDeckTutorial,
  "/club": loadClub
};

function prefetchRouteData(path: string) {
  void routeModuleLoaders[path]?.().catch(() => undefined);
  for (const dataPath of routeDataPaths[path] ?? []) {
    void api<unknown>(dataPath).catch(() => undefined);
  }
}

function notificationTarget(notification: GameNotification) {
  const type = notification.type.toUpperCase();
  const text = `${notification.title} ${notification.body}`.toLowerCase();
  if (type === "SKILLS" || text.includes("compétence") || text.includes("niveau joueur"))
    return "/skills";
  if (type === "COLLECTION" || text.includes("collection") || text.includes("carte"))
    return "/collection";
  if (type === "CLUB" || text.includes("club")) return "/club";
  if (type === "SEASON_REWARD") return "/season";
  if (type === "DEFI" || type === "DÉFI" || text.includes("défi") || text.includes("match"))
    return "/matches";
  if (type === "SAISON" || text.includes("tournoi") || text.includes("championnat"))
    return "/season";
  if (type === "TUTORIEL" || text.includes("bienvenue")) return "/dashboard";
  return "/dashboard";
}

function notificationBadgeTarget(notification: GameNotification, compactNav = false) {
  const target: string = notificationTarget(notification);
  if (!compactNav) return target;
  if (target === "/skills") return "/dashboard";
  if (target === "/matches") return "/duel";
  if (target === "/rankings" || target === "/online" || target === "/community")
    return "/dashboard";
  return target;
}

function notificationBelongsToPath(notification: GameNotification, path: string) {
  return (
    notificationTarget(notification) === path ||
    notificationBadgeTarget(notification, true) === path
  );
}

const statLabels: Record<string, string> = {
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
  baseline: "Fond de court",
  netRush: "Filet",
  footwork: "Déplacement",
  surfaceAdaptation: "Surfaces"
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

const statVisuals: Record<
  (typeof profileStatKeys)[number],
  { Icon: typeof Target; color: string; glow: string; short: string }
> = {
  service: { Icon: Target, color: "#5eead4", glow: "rgba(94,234,212,.24)", short: "SV" },
  return: { Icon: Repeat2, color: "#67e8f9", glow: "rgba(103,232,249,.22)", short: "RT" },
  forehand: { Icon: Crosshair, color: "#86efac", glow: "rgba(134,239,172,.22)", short: "CD" },
  backhand: { Icon: MoveUpRight, color: "#a7f3d0", glow: "rgba(167,243,208,.2)", short: "RV" },
  volley: { Icon: Hand, color: "#fde68a", glow: "rgba(253,230,138,.18)", short: "VO" },
  smash: { Icon: Flame, color: "#fca5a5", glow: "rgba(252,165,165,.2)", short: "SM" },
  dropShot: { Icon: MoveDown, color: "#c4b5fd", glow: "rgba(196,181,253,.2)", short: "AM" },
  stamina: { Icon: Gauge, color: "#93c5fd", glow: "rgba(147,197,253,.2)", short: "EN" },
  speed: { Icon: Wind, color: "#7dd3fc", glow: "rgba(125,211,252,.22)", short: "VI" },
  explosiveness: { Icon: Zap, color: "#fef08a", glow: "rgba(254,240,138,.18)", short: "EX" },
  strength: { Icon: Dumbbell, color: "#fdba74", glow: "rgba(253,186,116,.18)", short: "FO" },
  recovery: { Icon: HeartPulse, color: "#f9a8d4", glow: "rgba(249,168,212,.18)", short: "RE" }
};

function statVisual(key: string) {
  return statVisuals[key as keyof typeof statVisuals] ?? statVisuals.service;
}

const stat = (player: Player, key: string) => player.stats[key] ?? 0;

function formatCredits(value: number) {
  return `${value.toLocaleString("fr-FR")} CR`;
}

function nationalityLabel(value: string) {
  return countryLabel(value);
}

const landingFacts: Array<[string, string]> = [
  ["Saison", "30 jours réels"],
  ["Duel", "3 adversaires proposés"],
  ["Club", "championnat par équipe"],
  ["Match", "calcul serveur point par point"]
];

const authBenefits: Array<[string, string]> = [
  ["Classement initial", "NC"],
  ["Sacs offerts", "2 Bronze · 1 Argent · 1 Or"],
  ["Énergie", "10 points rechargeables"],
  ["Modes", "Duel · saison · club · collection"]
];

type AvatarPicture = { kind: "preset"; id: string } | { kind: "upload"; dataUrl: string };
type PictureAvatarPayload = {
  type: "picture-v1";
  initials: string;
  picture: AvatarPicture;
};
type StoredAvatarPayload = {
  type?: string;
  initials?: string;
  picture?: AvatarPicture;
};

const maxProfilePictureBytes = 120 * 1024;

const personalPictures = [
  { id: "pp-01", label: "Central", image: "/profile-pictures/pp-01.jpg" },
  { id: "pp-02", label: "Azur", image: "/profile-pictures/pp-02.jpg" },
  { id: "pp-03", label: "Corail", image: "/profile-pictures/pp-03.jpg" },
  { id: "pp-04", label: "Or", image: "/profile-pictures/pp-04.jpg" },
  { id: "pp-05", label: "Indigo", image: "/profile-pictures/pp-05.jpg" },
  { id: "pp-06", label: "Ardoise", image: "/profile-pictures/pp-06.jpg" },
  { id: "pp-07", label: "Menthe", image: "/profile-pictures/pp-07.jpg" },
  { id: "pp-08", label: "Rubis", image: "/profile-pictures/pp-08.jpg" },
  { id: "pp-09", label: "Nuit", image: "/profile-pictures/pp-09.jpg" },
  { id: "pp-10", label: "Blanc", image: "/profile-pictures/pp-10.jpg" }
] as const;

const lobbyHeroPictures: Partial<Record<(typeof personalPictures)[number]["id"], string>> = {
  "pp-01": "/visuals/players/pp-01-hero.webp",
  "pp-02": "/visuals/players/pp-02-hero.webp",
  "pp-03": "/visuals/players/pp-03-hero.webp",
  "pp-04": "/visuals/players/pp-04-hero.webp",
  "pp-05": "/visuals/players/pp-05-hero.webp",
  "pp-06": "/visuals/players/pp-06-hero.webp",
  "pp-07": "/visuals/players/pp-07-hero.webp",
  "pp-08": "/visuals/players/pp-08-hero.webp",
  "pp-09": "/visuals/players/pp-09-hero.webp",
  "pp-10": "/visuals/players/pp-10-hero.webp"
};

function presetPictureForSeed(seed: string) {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return personalPictures[(hash >>> 0) % personalPictures.length] ?? personalPictures[0];
}

function initialsFromName(firstName: string, lastName: string) {
  return `${firstName[0] ?? "M"}${lastName[0] ?? "P"}`.toUpperCase();
}

function parseAvatar(avatar: string): PictureAvatarPayload | null {
  try {
    const parsed = JSON.parse(avatar) as StoredAvatarPayload;
    if (parsed.type === "picture-v1" && parsed.initials && parsed.picture)
      return parsed as PictureAvatarPayload;
    if (parsed.type === "body-v1" && parsed.initials)
      return {
        type: "picture-v1",
        initials: parsed.initials,
        picture: { kind: "preset", id: "pp-01" }
      };
  } catch {
    return null;
  }
  return null;
}

function legacyAvatarPayload(avatar: string): PictureAvatarPayload {
  return {
    type: "picture-v1",
    initials: avatar || "MP",
    picture: { kind: "preset", id: presetPictureForSeed(avatar || "MP").id }
  };
}

function avatarInitials(avatar: string) {
  return parseAvatar(avatar)?.initials ?? legacyAvatarPayload(avatar).initials;
}

function avatarPictureSource(avatar: string) {
  const payload = parseAvatar(avatar) ?? legacyAvatarPayload(avatar);
  if (payload.picture.kind === "upload") return payload.picture.dataUrl;
  const pictureId = payload.picture.id;
  return personalPictures.find((item) => item.id === pictureId)?.image ?? personalPictures[0].image;
}

function ProfilePicture({
  avatar,
  picture,
  initials,
  size = "md"
}: {
  avatar?: string;
  picture?: AvatarPicture;
  initials?: string;
  size?: "sm" | "md" | "lg";
}) {
  const payload = avatar ? (parseAvatar(avatar) ?? legacyAvatarPayload(avatar)) : null;
  const selectedPicture = picture ?? payload?.picture;
  const label = initials ?? payload?.initials ?? (avatar ? avatarInitials(avatar) : "MP");
  const sizeClass =
    size === "lg"
      ? "h-28 w-28 text-3xl"
      : size === "sm"
        ? "h-14 w-14 text-lg"
        : "h-20 w-20 text-2xl";
  if (selectedPicture?.kind === "upload") {
    return (
      <img
        alt={`Photo de profil ${label}`}
        className={`profile-picture ${sizeClass}`}
        decoding="async"
        draggable={false}
        loading="lazy"
        src={selectedPicture.dataUrl}
      />
    );
  }
  const preset =
    personalPictures.find((item) => item.id === selectedPicture?.id) ?? personalPictures[0];
  return (
    <img
      alt={`Photo de profil ${label}`}
      className={`profile-picture profile-picture-preset ${sizeClass}`}
      decoding="async"
      draggable={false}
      loading="lazy"
      src={preset.image}
    />
  );
}

function avatarHeroSource(avatar: string) {
  const payload = parseAvatar(avatar) ?? legacyAvatarPayload(avatar);
  if (payload.picture.kind !== "preset") return undefined;
  const pictureId = payload.picture.id;
  const preset = personalPictures.find((item) => item.id === pictureId);
  return preset ? lobbyHeroPictures[preset.id] : undefined;
}

type Tournament = {
  id: string;
  name: string;
  location: string;
  surface: string;
  category: string;
  startsAt: string;
  prize: number;
  points: number;
  recommendedLevel: number;
  kind: string;
  schedule: Array<{ court: string; round: string; startsAt: string }>;
};
type SeasonEntry = {
  id: string;
  competitionType: string;
  status: string;
  currentRound: number;
  energyCost: number;
  entryFee: number;
  cashPrize: number;
  championTitle?: string | null;
  bracket: {
    mode: string;
    range?: { best: string; worst: string };
    path?: Array<{ round?: number; ranking: string; label?: string; targetOverall?: number }>;
    opponents?: Array<{ seed?: number; round?: number; ranking: string; targetOverall?: number }>;
    rounds?: Array<{
      name: string;
      matches: Array<{
        left: { label: string; ranking: string; isPlayer?: boolean } | null;
        right: { label: string; ranking: string; isPlayer?: boolean } | null;
        winner: { label: string; ranking: string; isPlayer?: boolean } | null;
        scoreText?: string;
        playedByPlayer?: boolean;
        replayMatchId?: string;
      }>;
    }>;
    completedTournament?: {
      status: string;
      winnerName: string;
      winnerRanking: string;
      finishedAt: string;
      rounds: Array<{
        name: string;
        matches: Array<{
          leftLabel: string;
          leftRanking: string;
          rightLabel: string;
          rightRanking: string;
          winnerLabel: string;
          winnerRanking: string;
          scoreText: string;
          playedByPlayer: boolean;
        }>;
      }>;
    };
  };
  matches: Array<{
    matchId: string;
    ranking: string;
    won: boolean;
    scoreText?: string;
    playedAt?: string;
    opponentName?: string;
    opponentRanking?: string;
  }>;
};
type TournamentBracketRound = NonNullable<SeasonEntry["bracket"]["rounds"]>[number];
type SeasonCompetition = {
  type: "daily" | "weekly" | "individual";
  title: string;
  subtitle: string;
  energyCost: number;
  entryFee: number;
  cashPrize: number;
  frequency: string;
  drawSize: number;
  playableNow: boolean;
  nextPlayableAt: string | null;
  currentPeriodEndsAt: string;
  rankingRange: { best: string; worst: string };
  entry: SeasonEntry | null;
};
type SeasonDailyReward = {
  day: number;
  type: "money" | "gems" | "chest";
  money?: number;
  gems?: number;
  rarity?: ChestRarity;
  label: string;
  rewardValue: string;
  claimed: boolean;
  claimedAt: string | null;
  claimable: boolean;
  missed: boolean;
  locked: boolean;
  current: boolean;
};
type SeasonData = {
  season: {
    key: string;
    startsAt: string;
    endsAt: string;
    day: number;
    week: number;
    remainingDays: number;
    progress: number;
  };
  player: Player;
  dailyRewards: SeasonDailyReward[];
  competitions: SeasonCompetition[];
};
type CareerProfile = {
  palmares: {
    titles: number;
    tournamentTitles: number;
    nationalTitles: number;
    finals: number;
    wins: number;
    losses: number;
    competitions: Array<{ type: string; played: number; titles: number; bestRound: number }>;
    recentTitles: Array<{ id: string; label: string; type: string; date: string; status: string }>;
  };
  rankingSimulation: {
    currentRanking: string;
    simulatedRanking: string;
    points: number;
    minimum: number;
    nextRanking: string | null;
    nextMinimum: number | null;
    pointsToNext: number | null;
    takenWins: number;
    winsToKeep: number;
    delta: number;
    matchCount: number;
    wins: number;
    losses: number;
    fftRankingValidated: boolean;
    proUnlocked: boolean;
    victories: Array<{
      id: string;
      playedAt: string;
      competitionType: string;
      opponentRanking: string;
      points: number;
      coefficient: number;
      retained: boolean;
    }>;
    results: Array<{
      id: string;
      playedAt: string;
      competitionType: string;
      won: boolean;
      ownRanking: string;
      opponentRanking: string;
      coefficient: number;
    }>;
  };
};
type RankedPlayer = Player & { rank: number };
type MatchSummaryPlayer = Pick<Player, "id" | "firstName" | "lastName" | "fftRanking" | "avatar">;
type MatchListItem = {
  id: string;
  winnerId: string;
  scoreText: string;
  type: string;
  surface: string;
  durationMinutes?: number;
  playerA: MatchSummaryPlayer;
  playerB: MatchSummaryPlayer;
};
type DuelPool = {
  allowedRankings: string[];
  opponents: Player[];
};
type DuelSearch = {
  allowedRankings: string[];
  results: Player[];
};
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
type MatchReplay = Omit<MatchListItem, "playerA" | "playerB"> & {
  playerA: Player;
  playerB: Player;
  replay: { events: ReplayEvent[]; momentum: number[] };
};
type PresenceUser = { userId: string; displayName: string; connectedAt: string };
type ChestRarity = "Bronze" | "Argent" | "Or" | "Légendaire" | "Mythique";

type TennisBagChest = {
  id: string;
  rarity: ChestRarity;
  slotIndex: number;
  source: string;
  status: string;
  unlockStartedAt: string;
  unlocksAt: string;
  durationMinutes: number;
  canOpen: boolean;
  remainingMs: number;
  speedUpCost: number;
};
type ChestCard = {
  statKey: string;
  label: string;
  copies: number;
  totalCopies: number;
  levelBefore: number;
  levelAfter: number;
  bonus: number;
  nextRequired: number;
};
type ChestRewards = {
  cards: ChestCard[];
  money: number;
  gems: number;
  cosmetics: Array<{
    id: string;
    name: string;
    rarity: ChestRarity;
    bonuses: Record<string, number>;
  }>;
  statBonuses: Record<string, number>;
};
type PlayerCosmeticItem = {
  id: string;
  cosmeticId: string;
  name: string;
  rarity: ChestRarity;
  bonuses: Record<string, number>;
  upgradeLevel: number;
  nextUpgradeCost: number | null;
  canUpgrade: boolean;
  equippedSlot: number | null;
  ownedAt: string;
};
type ChestState = {
  slots: Array<{ slotIndex: number; chest: TennisBagChest | null }>;
  cards: Array<{
    statKey: string;
    label: string;
    copies: number;
    level: number;
    earnedLevel: number;
    copiesIntoLevel: number;
    copiesNeeded: number;
    remaining: number;
    unlockable: boolean;
    unlockCost: number;
  }>;
  cosmetics: PlayerCosmeticItem[];
  gems: number;
};
function usePageVisible() {
  const [visible, setVisible] = useState(() => !document.hidden);
  useEffect(() => {
    const update = () => setVisible(!document.hidden);
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  return visible;
}

function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  const pageVisible = usePageVisible();
  useEffect(() => {
    setNow(Date.now());
    if (!pageVisible) return;
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs, pageVisible]);
  return now;
}

function formatRemaining(ms: number) {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  if (hours > 0)
    return `${hours}h ${String(minutes).padStart(2, "0")}m ${String(rest).padStart(2, "0")}s`;
  return `${minutes}m ${String(rest).padStart(2, "0")}s`;
}

function formatLobbyRemaining(ms: number) {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  if (hours > 0) {
    return `${String(hours).padStart(2, "0")}h ${String(minutes).padStart(2, "0")}m`;
  }
  return `${String(minutes).padStart(2, "0")}m ${String(rest).padStart(2, "0")}s`;
}

function chestRemainingAt(chest: TennisBagChest, now = Date.now()) {
  return Math.max(0, new Date(chest.unlocksAt).getTime() - now);
}

function chestSpeedUpCostAt(chest: TennisBagChest, now = Date.now()) {
  return Math.max(1, Math.ceil(chestRemainingAt(chest, now) / (10 * 60_000)));
}

function Countdown({
  endAt,
  doneLabel = "Terminé"
}: {
  endAt: string | null | undefined;
  doneLabel?: string;
}) {
  const now = useNow();
  if (!endAt) return <span>Pas de timer</span>;
  const remaining = new Date(endAt).getTime() - now;
  return <span>{remaining <= 0 ? doneLabel : formatRemaining(remaining)}</span>;
}

const fftPath = [
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
];

const fftThresholds: Record<string, number> = {
  NC: 0,
  "40/2": 30,
  "40/1": 60,
  "40": 90,
  "30/5": 130,
  "30/4": 180,
  "30/3": 240,
  "30/2": 310,
  "30/1": 390,
  "30": 480,
  "15/5": 590,
  "15/4": 720,
  "15/3": 870,
  "15/2": 1040,
  "15/1": 1230,
  "15": 1450,
  "5/6": 1680,
  "4/6": 1920,
  "3/6": 2170,
  "2/6": 2440,
  "1/6": 2720,
  "0": 3000,
  "-2/6": 3260,
  "-4/6": 3420,
  "-15": 3500
};
const proValidationThreshold = 3500;

function CareerPathCard({ player }: { player: Player }) {
  const currentIndex = Math.max(0, fftPath.indexOf(player.fftRanking));
  const nextRanking = fftPath[currentIndex + 1];
  const target =
    player.fftRanking === "-15"
      ? proValidationThreshold
      : nextRanking
        ? (fftThresholds[nextRanking] ?? proValidationThreshold)
        : proValidationThreshold;
  const previous = fftThresholds[player.fftRanking] ?? 0;
  const progress = player.proUnlocked
    ? 100
    : Math.max(
        0,
        Math.min(100, ((player.amateurPoints - previous) / Math.max(1, target - previous)) * 100)
      );
  return (
    <article className="panel p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-emerald-300">Parcours FFT</p>
          <h2 className="text-2xl font-black">{player.careerStage}</h2>
        </div>
        <div className="rounded-md bg-white/[0.08] px-4 py-2 text-xl font-black">
          {player.fftRanking}
        </div>
      </div>
      <p className="mt-3 text-sm text-slate-300">
        Départ non classé. Le circuit professionnel reste verrouillé jusqu'à validation du
        classement -15.
      </p>
      <div className="mt-4 h-2 rounded-full bg-white/[0.08]">
        <div className="h-full rounded-full bg-emerald-300" style={{ width: `${progress}%` }} />
      </div>
      <div className="mt-3 flex flex-wrap justify-between gap-2 text-sm text-slate-300">
        <span>{player.amateurPoints} points amateur</span>
        <span>
          {player.proUnlocked
            ? "Circuit pro débloqué"
            : player.fftRanking === "-15"
              ? "Validation -15 en cours"
              : `Objectif ${nextRanking ?? "-15"}`}
        </span>
      </div>
      {!player.proUnlocked ? (
        <div className="mt-4 rounded-md border border-amber-300/20 bg-amber-300/10 p-3 text-sm text-amber-100">
          Accès pro bloqué : validez -15 pour entrer dans le circuit professionnel MyPro.
        </div>
      ) : null}
    </article>
  );
}

function rarityClass(rarity: ChestRarity) {
  return `rarity-${rarity
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")}`;
}

function tennisBagImagePath(rarity: ChestRarity) {
  return `/visuals/chests/tennis-bag-${rarityClass(rarity).replace("rarity-", "")}.webp`;
}

function cosmeticIconPath(name: string) {
  const normalized = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (normalized.includes("poignets")) return "/visuals/cosmetics/wristbands-emerald.jpg";
  if (normalized.includes("casquette")) return "/visuals/cosmetics/academy-cap.jpg";
  if (normalized.includes("surgrip")) return "/visuals/cosmetics/premium-overgrip.jpg";
  if (normalized.includes("sac")) return "/visuals/cosmetics/signature-bag.jpg";
  if (normalized.includes("t-shirt")) return "/visuals/cosmetics/junior-shirt.jpg";
  if (normalized.includes("bandeau")) return "/visuals/cosmetics/night-headband.jpg";
  return "/visuals/cosmetics/signature-bag.jpg";
}

function CosmeticIcon({
  item,
  compact = false
}: {
  item: Pick<PlayerCosmeticItem, "name" | "rarity">;
  compact?: boolean;
}) {
  return (
    <div
      className={`cosmetic-icon relative overflow-hidden rounded-md border border-white/10 bg-slate-950/50 ${rarityClass(item.rarity)} ${
        compact ? "h-14 w-14" : "aspect-square w-full"
      }`}
    >
      <img
        alt={item.name}
        className="h-full w-full object-cover"
        decoding="async"
        draggable={false}
        loading="lazy"
        src={cosmeticIconPath(item.name)}
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/55 via-transparent to-white/5" />
    </div>
  );
}

function TennisBagVisual({ rarity, opening = false }: { rarity: ChestRarity; opening?: boolean }) {
  return (
    <div className={`tennis-bag ${rarityClass(rarity)} ${opening ? "tennis-bag-opening" : ""}`}>
      <img
        alt={`Sac ${rarity}`}
        decoding="async"
        draggable={false}
        src={tennisBagImagePath(rarity)}
      />
    </div>
  );
}

function RewardModal({
  rewards,
  onClose,
  rarity = "Mythique",
  eyebrow = "Sac ouvert"
}: {
  rewards: ChestRewards;
  onClose: () => void;
  rarity?: ChestRarity;
  eyebrow?: string;
}) {
  const unlockedCards = rewards.cards.filter((card) => card.bonus > 0);
  return createPortal(
    <div className="game-modal-overlay">
      <div className="game-modal-panel panel relative max-w-2xl text-center">
        <button
          className="absolute right-4 top-4 rounded-md bg-white/10 p-2 text-slate-200 hover:bg-white/15"
          onClick={onClose}
          aria-label="Fermer les récompenses"
          type="button"
        >
          <X size={18} />
        </button>
        <div className="mx-auto w-40">
          <TennisBagVisual rarity={rarity} opening />
        </div>
        <p className="mt-3 text-sm font-bold uppercase tracking-[0.28em] text-emerald-300">
          {eyebrow}
        </p>
        <h2 className="mt-1 text-3xl font-black">Récompenses obtenues</h2>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <Metric label="Crédits" value={formatCredits(rewards.money)} />
          <Metric label="Gemmes" value={rewards.gems} />
          <Metric
            label="Paliers prêts"
            value={`+${unlockedCards.reduce((sum, card) => sum + card.bonus, 0)}`}
          />
        </div>
        {rewards.cards.length ? (
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {rewards.cards.map((card, index) => (
              <div
                key={`${card.statKey}-${index}`}
                className={`reward-card ${card.bonus > 0 ? "reward-card-boost" : ""}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs uppercase tracking-[0.18em] text-slate-400">
                      Carte stat
                    </div>
                    <div className="mt-1 text-lg font-black">{card.label}</div>
                  </div>
                  <StatIcon statKey={card.statKey} />
                </div>
                <div className="mt-2 text-sm text-emerald-200">+{card.copies} doublon(s)</div>
                <div className="mt-1 text-xs text-slate-300">Palier atteint {card.levelAfter}</div>
                {card.bonus > 0 ? (
                  <div className="mt-2 rounded-md bg-emerald-300 px-2 py-1 text-sm font-black text-slate-950">
                    À débloquer +{card.bonus}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
        {unlockedCards.length > 0 ? (
          <p className="mt-4 text-sm text-emerald-200">
            Palier prêt : {unlockedCards.map((card) => `${card.label} +${card.bonus}`).join(", ")}.
            Débloquez-le dans Collection.
          </p>
        ) : null}
        {rewards.cosmetics.length > 0 ? (
          <div className="mt-4 grid gap-2">
            {rewards.cosmetics.map((item) => (
              <div
                key={item.id}
                className={`rounded-md border border-white/10 bg-white/[0.04] p-3 text-left ${rarityClass(item.rarity)}`}
              >
                <div className="grid grid-cols-[64px_minmax(0,1fr)] gap-3">
                  <CosmeticIcon item={item} compact />
                  <div className="min-w-0">
                    <div className="text-xs uppercase tracking-[0.18em] text-sky-200">
                      Cosmétique {item.rarity}
                    </div>
                    <div className="mt-1 truncate font-black">{item.name}</div>
                    <div className="mt-3">
                      <StatBonusPills bonuses={item.bonuses} />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : null}
        <Button className="mt-6" onClick={onClose}>
          Fermer
        </Button>
      </div>
    </div>,
    document.body
  );
}

function Button(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`game-button inline-flex items-center justify-center gap-2 rounded-md bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:opacity-50 ${props.className ?? ""}`}
    />
  );
}

function Field(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="game-field w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 outline-none focus:border-emerald-300"
    />
  );
}

function GoogleButton({
  children,
  onClick,
  disabled
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      className="inline-flex w-full items-center justify-center gap-3 rounded-md border border-white/15 bg-white px-4 py-2 text-sm font-black text-slate-950 transition hover:bg-slate-100 disabled:opacity-60"
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      <span className="grid h-6 w-6 place-items-center rounded-full bg-slate-950 text-sm font-black text-white">
        G
      </span>
      {children}
    </button>
  );
}

function NotificationCenter({ compact = false }: { compact?: boolean }) {
  const notifications = useGameStore((state) => state.notifications);
  const refresh = useGameStore((state) => state.refresh);
  const markNotificationsRead = useGameStore((state) => state.markNotificationsRead);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const unread = notifications.filter((notification) => !notification.readAt);

  function openNotification(notification: GameNotification) {
    if (!notification.readAt) {
      markNotificationsRead([notification.id]);
      void api(`/notifications/${notification.id}/read`, { method: "PATCH" }).catch(() =>
        refresh()
      );
    }
    setOpen(false);
    navigate(notificationTarget(notification));
  }

  function readAll() {
    markNotificationsRead();
    void api("/notifications/read-all", { method: "POST" }).catch(() => refresh());
  }

  return (
    <div className="relative">
      <button
        className={`relative inline-flex items-center justify-center gap-2 rounded-md bg-white/10 px-3 py-2 text-sm font-semibold text-slate-100 transition hover:bg-white/15 ${
          compact ? "h-9 w-9 px-0" : ""
        }`}
        onClick={() => setOpen((value) => !value)}
        type="button"
        aria-label="Notifications"
      >
        <Bell size={16} />
        {!compact ? <span>{unread.length} notification(s)</span> : null}
        {unread.length ? (
          <span className="absolute -right-1 -top-1 grid min-h-5 min-w-5 place-items-center rounded-full bg-emerald-300 px-1 text-[11px] font-black text-slate-950">
            {unread.length}
          </span>
        ) : null}
      </button>
      {open ? (
        <div className="absolute right-0 top-[calc(100%+0.6rem)] z-50 w-[min(360px,calc(100vw-2rem))] overflow-hidden rounded-lg border border-white/10 bg-slate-950 shadow-2xl shadow-black/50">
          <div className="flex items-center justify-between gap-3 border-b border-white/10 p-4">
            <div>
              <p className="text-sm font-black">Notifications</p>
              <p className="text-xs text-slate-400">{unread.length} non lue(s)</p>
            </div>
            {unread.length ? (
              <button
                className="rounded-md bg-white/10 px-3 py-2 text-xs font-bold text-slate-100 hover:bg-white/15"
                onClick={() => void readAll()}
                type="button"
              >
                Tout lire
              </button>
            ) : null}
          </div>
          <div className="max-h-[380px] overflow-auto p-2">
            {notifications.length ? (
              notifications.map((notification) => (
                <button
                  key={notification.id}
                  className={`grid w-full gap-1 rounded-md p-3 text-left transition hover:bg-white/[0.08] ${
                    notification.readAt ? "text-slate-400" : "bg-emerald-300/10 text-slate-100"
                  }`}
                  onClick={() => void openNotification(notification)}
                  type="button"
                >
                  <div className="flex items-start justify-between gap-3">
                    <strong>{notification.title}</strong>
                    {!notification.readAt ? (
                      <span className="mt-1 h-2 w-2 rounded-full bg-emerald-300" />
                    ) : null}
                  </div>
                  <span className="text-sm leading-5">{notification.body}</span>
                  <span className="text-xs text-slate-500">
                    {new Date(notification.createdAt).toLocaleString("fr-FR")}
                  </span>
                </button>
              ))
            ) : (
              <p className="p-4 text-sm text-slate-400">Aucune notification pour le moment.</p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  const user = useGameStore((state) => state.user);
  const player = useGameStore((state) => state.player);
  const notifications = useGameStore((state) => state.notifications);
  const logout = useGameStore((state) => state.logout);
  const refresh = useGameStore((state) => state.refresh);
  const markNotificationsRead = useGameStore((state) => state.markNotificationsRead);
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const showGameNav =
    user && !["/", "/login", "/signup", "/oauth/google"].includes(location.pathname);
  const isDashboard = location.pathname === "/dashboard";
  const isCollection = location.pathname === "/collection";
  const isSkills = location.pathname === "/skills";
  const isClub = location.pathname === "/club";
  const isDuel = location.pathname === "/duel";
  const isAutomaticMatch = location.pathname.startsWith("/match/");
  const isFullScreenGamePage =
    isDashboard || isCollection || isSkills || isClub || isDuel || isAutomaticMatch;
  const navBadges = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const notification of notifications) {
      if (notification.readAt) continue;
      const target = notificationBadgeTarget(notification, false);
      counts[target] = (counts[target] ?? 0) + 1;
    }
    return counts;
  }, [notifications]);
  const mobileNavBadges = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const notification of notifications) {
      if (notification.readAt) continue;
      const target = notificationBadgeTarget(notification, true);
      counts[target] = (counts[target] ?? 0) + 1;
    }
    return counts;
  }, [notifications]);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!player) return;
    if (
      localStorage.getItem("mypro-tutorial-active") === "1" &&
      localStorage.getItem("mypro-tutorial-done") !== "1"
    ) {
      setTutorialOpen(true);
    }
  }, [location.pathname, player]);

  useEffect(() => {
    if (!showGameNav || !user) return;
    const pageNotifications = notifications.filter(
      (notification) =>
        !notification.readAt && notificationBelongsToPath(notification, location.pathname)
    );
    if (!pageNotifications.length) return;

    let cancelled = false;
    markNotificationsRead(pageNotifications.map((notification) => notification.id));
    void Promise.all(
        pageNotifications.map((notification) =>
          api(`/notifications/${notification.id}/read`, { method: "PATCH" })
        )
      ).catch(() => {
        if (!cancelled) void refresh();
      });

    return () => {
      cancelled = true;
    };
  }, [location.pathname, markNotificationsRead, notifications, refresh, showGameNav, user]);

  function openTutorial() {
    localStorage.setItem("mypro-tutorial-active", "1");
    setTutorialOpen(true);
  }

  return (
    <div className="min-h-screen">
      <header
        className={`app-header sticky top-0 z-20 border-b border-white/10 bg-midnight/92 backdrop-blur ${
          isFullScreenGamePage ? "dashboard-header" : ""
        }`}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
          <Link to="/" className="leading-none">
            <div className="text-xl font-black tracking-[0.18em] text-white">MYPRO</div>
            <div className="text-xs font-bold tracking-[0.34em] text-emerald-300">TENNIS</div>
          </Link>
          <div className="header-actions">
            {user ? (
              <>
                {showGameNav ? (
                  <button
                    type="button"
                    className="header-icon-button"
                    aria-label="Ouvrir le menu"
                    title="Menu"
                    onClick={() => setMenuOpen(true)}
                  >
                    <Menu size={18} />
                  </button>
                ) : null}
                {player ? (
                  <div className="mobile-resource-strip">
                    <span className="resource-pill resource-energy" aria-label="Énergie">
                      <Zap size={15} />
                      <strong>
                        {player.actionEnergy}/{player.actionEnergyMax}
                      </strong>
                      <small>Énergie</small>
                    </span>
                    <span className="resource-pill resource-gems" aria-label="Gemmes">
                      <Gem size={15} />
                      <strong>{player.gems}</strong>
                      <small>Gemmes</small>
                    </span>
                  </div>
                ) : null}
                <NotificationCenter compact />
                {player && showGameNav ? (
                  <button
                    type="button"
                    className="header-icon-button"
                    aria-label="Ouvrir le tutoriel"
                    title="Tutoriel"
                    onClick={openTutorial}
                  >
                    <HelpCircle size={18} />
                  </button>
                ) : null}
                {showGameNav ? (
                  <Link
                    to="/settings"
                    className="header-icon-button"
                    aria-label="Réglages"
                    title="Réglages"
                  >
                    <Settings size={18} />
                  </Link>
                ) : null}
                <Button
                  onClick={logout}
                  className="hidden bg-white/10 px-3 py-2 text-xs text-white hover:bg-white/15 sm:inline-flex"
                >
                  <LogOut size={15} />
                  Déconnexion
                </Button>
              </>
            ) : (
              <Link
                to="/login"
                className="inline-flex items-center gap-2 rounded-md bg-emerald-400 px-3 py-2 text-xs font-black text-slate-950"
              >
                <LogIn size={15} /> Connexion
              </Link>
            )}
          </div>
        </div>
      </header>
      <div
        className={
          isFullScreenGamePage
            ? "app-shell-content dashboard-shell-content mx-auto grid w-full max-w-none gap-0 p-0"
            : "app-shell-content mx-auto grid max-w-7xl gap-4 px-3 py-4 pb-24 sm:px-4 sm:py-5"
        }
      >
        <main className={`min-w-0 ${isFullScreenGamePage ? "dashboard-main" : ""}`}>
          {children}
        </main>
      </div>
      {showGameNav && !isFullScreenGamePage ? <MobileBottomNav badges={mobileNavBadges} /> : null}
      {!isFullScreenGamePage ? (
        <footer className="app-footer mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-3 px-4 pb-24 text-center text-[11px] font-black uppercase tracking-[0.28em] text-slate-500 lg:pb-5">
          <span>KILIM GAMES PRODUCTION</span>
          <span className="text-slate-700">·</span>
          <Link className="transition hover:text-emerald-300" to="/community">
            Communauté
          </Link>
        </footer>
      ) : null}
      {showGameNav && menuOpen
        ? createPortal(
            <div
              className="game-modal-overlay header-menu-overlay"
              onClick={() => setMenuOpen(false)}
            >
              <nav className="panel header-menu-panel" onClick={(event) => event.stopPropagation()}>
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.24em] text-emerald-300">
                      Navigation
                    </p>
                    <h2 className="text-2xl font-black">Menu du jeu</h2>
                  </div>
                  <button
                    type="button"
                    className="header-icon-button"
                    aria-label="Fermer le menu"
                    onClick={() => setMenuOpen(false)}
                  >
                    <X size={18} />
                  </button>
                </div>
                <div className="grid gap-2">
                  {nav.map(([label, path, Icon]) => (
                    <NavLink
                      key={path}
                      to={path}
                      onFocus={() => prefetchRouteData(path)}
                      onPointerEnter={() => prefetchRouteData(path)}
                      className={({ isActive }) =>
                        `header-menu-link ${isActive ? "is-active" : ""}`
                      }
                    >
                      <Icon size={18} />
                      <span className="min-w-0 flex-1">{label}</span>
                      {navBadges[path] ? (
                        <span className="grid h-6 min-w-6 place-items-center rounded-full bg-cyan-300 px-1 text-xs font-black text-slate-950">
                          {navBadges[path]}
                        </span>
                      ) : null}
                    </NavLink>
                  ))}
                </div>
              </nav>
            </div>,
            document.body
          )
        : null}
      {tutorialOpen && player ? <TutorialModal onClose={() => setTutorialOpen(false)} /> : null}
    </div>
  );
}

function MobileBottomNav({ badges }: { badges: Record<string, number> }) {
  return (
    <nav className="mobile-bottom-nav lg:hidden" aria-label="Navigation principale">
      {mobileNav.map(([label, path, Icon]) => (
        <NavLink
          key={path}
          to={path}
          onFocus={() => prefetchRouteData(path)}
          onPointerEnter={() => prefetchRouteData(path)}
          className={({ isActive }) => `mobile-bottom-link ${isActive ? "is-active" : ""}`}
        >
          <span className="relative">
            <Icon size={21} />
            {badges[path] ? <span className="mobile-bottom-badge">{badges[path]}</span> : null}
          </span>
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

function NeedAuth({ children }: { children: React.ReactNode }) {
  const user = useGameStore((state) => state.user);
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function NeedPlayer({ children }: { children: React.ReactNode }) {
  const player = useGameStore((state) => state.player);
  if (!player) return <Navigate to="/create-player" replace />;
  return <>{children}</>;
}

function HomeRoute() {
  const user = useGameStore((state) => state.user);
  const player = useGameStore((state) => state.player);
  if (user && player) return <Navigate to="/dashboard" replace />;
  if (user) return <Navigate to="/create-player" replace />;
  return <Landing />;
}

function Landing() {
  const pillars = [
    {
      title: "Carrière FFT",
      body: "Commencez non classé, progressez dans toute la pyramide amateur et validez -15 pour ouvrir le circuit pro.",
      icon: Trophy
    },
    {
      title: "Sacs et collection",
      body: "Gagnez des sacs de tennis, collectionnez les 12 cartes statistiques et débloquez vos bonus au bon moment.",
      icon: PackageOpen
    },
    {
      title: "Multijoueur persistant",
      body: "Affrontez des profils réels ou IA, rejoignez un club, disputez des championnats par équipe et suivez votre rang.",
      icon: Users
    }
  ];
  return (
    <div className="grid gap-6">
      <section className="landing-hero relative overflow-hidden rounded-lg border border-white/10 p-5 shadow-glow md:p-8 xl:p-10">
        <div className="grid items-center gap-8 xl:grid-cols-[1fr_440px]">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-md border border-emerald-300/25 bg-emerald-300/10 px-3 py-2 text-xs font-black uppercase tracking-[0.22em] text-emerald-200">
              <Sparkles size={15} />
              Saison persistante · tennis manager MMO
            </div>
            <h1 className="mt-5 text-4xl font-black leading-tight text-white md:text-5xl xl:text-6xl">
              De non classé à légende du circuit MyPro.
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-200">
              Créez votre joueur, montez les classements FFT, ouvrez des sacs de tennis, construisez
              votre collection de cartes statistiques et défiez d'autres carrières en ligne.
            </p>
            <div className="mt-7 grid gap-3 sm:flex sm:flex-wrap">
              <Link
                to="/signup"
                className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-emerald-400 px-5 py-3 font-black text-slate-950 transition hover:bg-emerald-300 sm:w-auto"
              >
                <UserPlus size={18} /> Commencer l'aventure
              </Link>
              <Link
                to="/login"
                className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-white/15 bg-white/[0.04] px-5 py-3 font-bold text-white transition hover:bg-white/[0.08] sm:w-auto"
              >
                <LogIn size={18} /> Se connecter
              </Link>
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <Metric label="Départ carrière" value="NC" />
              <Metric label="Énergie" value="10 / jour" />
              <Metric label="Objectif amateur" value="-15" />
            </div>
          </div>
          <div className="landing-card">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-emerald-300">
                  Votre futur joueur
                </p>
                <h2 className="mt-1 text-2xl font-black">Profil complet</h2>
              </div>
              <ProfilePicture initials="MP" picture={{ kind: "preset", id: "pp-09" }} />
            </div>
            <div className="mt-5 grid gap-3">
              {(["service", "forehand", "speed", "recovery"] as const).map((key, index) => {
                const values = [34, 28, 31, 26];
                const visual = statVisual(key);
                return (
                  <div key={key} className="stat-card">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <StatIcon statKey={key} />
                        <div>
                          <div className="font-black">{statLabels[key]}</div>
                          <div className="text-xs text-slate-400">Carte {visual.short}</div>
                        </div>
                      </div>
                      <strong>{values[index]}</strong>
                    </div>
                    <div className="mt-3 h-2 rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${values[index]}%`, backgroundColor: visual.color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-5 rounded-md border border-cyan-300/20 bg-cyan-300/10 p-4">
              <div className="flex items-center gap-3">
                <TennisBagVisual rarity="Or" />
                <div>
                  <p className="font-black">Sac Or de départ</p>
                  <p className="mt-1 text-sm text-slate-300">
                    Cartes, argent, cosmétiques et parfois gemmes.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      <section className="landing-pillars grid gap-4 md:grid-cols-3">
        {pillars.map(({ title, body, icon: Icon }) => (
          <article key={title} className="panel p-5">
            <div className="mb-4 grid h-11 w-11 place-items-center rounded-md bg-emerald-300/12 text-emerald-200">
              <Icon size={22} />
            </div>
            <h2 className="text-lg font-black">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">{body}</p>
          </article>
        ))}
      </section>
      <section className="replay-control-panel panel p-5">
        <div className="grid gap-4 md:grid-cols-4">
          {landingFacts.map(([label, value]) => (
            <Metric key={label} label={label} value={value} />
          ))}
        </div>
      </section>
    </div>
  );
}

function AuthPage({ mode }: { mode: "login" | "signup" }) {
  const isLogin = mode === "login";
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState(mode === "login" ? "demo@mypro-tennis.local" : "");
  const [password, setPassword] = useState(mode === "login" ? "demo1234" : "");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState(searchParams.get("oauthError") ?? "");
  const navigate = useNavigate();
  const login = useGameStore((state) => state.login);
  const signup = useGameStore((state) => state.signup);
  function startGoogle() {
    window.location.href = `${API_URL}/auth/google/start?mode=${mode}`;
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    try {
      if (mode === "login") await login(email, password);
      else await signup(displayName, email, password);
      navigate(mode === "login" ? "/dashboard" : "/create-player");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connexion impossible.");
    }
  }
  return (
    <div className="auth-scene mx-auto grid max-w-5xl gap-5 lg:grid-cols-[1fr_430px]">
      <section className="panel overflow-hidden p-6">
        <p className="text-sm font-bold uppercase tracking-[0.24em] text-emerald-300">
          {isLogin ? "Retour sur le circuit" : "Nouvelle carrière"}
        </p>
        <h1 className="mt-2 text-3xl font-black">
          {isLogin ? "Reprendre votre saison MyPro" : "Créer votre compte joueur"}
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          {isLogin
            ? "Retrouvez votre joueur, vos sacs en attente, votre collection et vos compétitions en cours."
            : "Votre aventure commence non classé. Choisissez un archétype, ouvrez vos premiers sacs et lancez vos premiers duels."}
        </p>
        <form onSubmit={submit} className="mt-5 grid gap-3">
          {!isLogin ? (
            <label className="grid gap-2 text-sm font-semibold text-slate-200">
              Nom affiché
              <Field
                placeholder="Exemple : Alex Moreau"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
              />
            </label>
          ) : null}
          <label className="grid gap-2 text-sm font-semibold text-slate-200">
            Email
            <Field
              type="email"
              placeholder="vous@exemple.fr"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-slate-200">
            Mot de passe
            <Field
              type="password"
              placeholder="Votre mot de passe"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          {error ? (
            <p className="rounded-md bg-red-500/15 p-3 text-sm text-red-100">{error}</p>
          ) : null}
          <Button type="submit" className="justify-center">
            {isLogin ? <LogIn size={17} /> : <UserPlus size={17} />}
            {isLogin ? "Entrer dans le jeu" : "Démarrer ma carrière"}
          </Button>
        </form>
        <div className="my-5 flex items-center gap-3 text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
          <span className="h-px flex-1 bg-white/10" />
          ou
          <span className="h-px flex-1 bg-white/10" />
        </div>
        <GoogleButton onClick={startGoogle}>
          {isLogin ? "Continuer avec Google" : "Créer mon compte avec Google"}
        </GoogleButton>
        <div className="mt-5 rounded-md border border-white/10 bg-white/[0.04] p-3 text-sm text-slate-300">
          {isLogin ? (
            <>
              Pas encore de joueur ?{" "}
              <Link className="font-bold text-emerald-300" to="/signup">
                Créer une carrière
              </Link>
            </>
          ) : (
            <>
              Déjà une carrière ?{" "}
              <Link className="font-bold text-emerald-300" to="/login">
                Se connecter
              </Link>
            </>
          )}
        </div>
      </section>
      <aside className="panel auth-highlight p-6">
        <p className="text-sm font-bold uppercase tracking-[0.24em] text-emerald-300">
          Inclus au départ
        </p>
        <h2 className="mt-2 text-2xl font-black">Votre première saison démarre vite</h2>
        <div className="mt-5 grid gap-3">
          {authBenefits.map(([label, value]) => (
            <Metric key={label} label={label} value={value} />
          ))}
        </div>
        <div className="mt-5 rounded-md border border-emerald-300/20 bg-emerald-300/10 p-4">
          <div className="flex items-center gap-3">
            <Trophy className="text-emerald-300" size={24} />
            <p className="text-sm leading-6 text-emerald-50">
              Objectif amateur : grimper classement après classement jusqu'à -15 et prouver que
              votre joueur mérite le circuit professionnel MyPro.
            </p>
          </div>
        </div>
      </aside>
    </div>
  );
}

function GoogleOAuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const refresh = useGameStore((state) => state.refresh);
  const [message, setMessage] = useState("Connexion Google en cours...");
  useEffect(() => {
    const token = searchParams.get("token");
    if (!token) {
      setMessage("Retour Google invalide.");
      return;
    }
    saveToken(token);
    void refresh().then(() => {
      const state = useGameStore.getState();
      navigate(state.player ? "/dashboard" : "/create-player", { replace: true });
    });
  }, [navigate, refresh, searchParams]);
  return <section className="panel p-5 text-sm text-slate-200">{message}</section>;
}

function CreatePlayer() {
  const textFields = [
    ["firstName", "Prénom"],
    ["lastName", "Nom"]
  ] as const;
  const selectFields = [
    ["gender", "Sexe", ["Femme", "Homme"]],
    ["dominantHand", "Main dominante", ["Droite", "Gauche"]],
    ["backhand", "Revers", ["Une main", "Deux mains"]],
    [
      "archetype",
      "Archétype",
      ["Gros service", "Relanceur", "Frappeur de fond", "Athlète endurant", "Joueur complet"]
    ]
  ] as const;
  const [creationStep, setCreationStep] = useState<"identity" | "photo">("identity");
  const [form, setForm] = useState({
    firstName: "Alex",
    lastName: "Moreau",
    nationality: "FR",
    gender: "Femme",
    dominantHand: "Droite",
    backhand: "Deux mains",
    archetype: "Joueur complet",
    avatarPicture: { kind: "preset", id: "pp-01" } as AvatarPicture
  });
  const [pictureError, setPictureError] = useState("");
  const refresh = useGameStore((state) => state.refresh);
  const navigate = useNavigate();

  function usePresetPicture(id: string) {
    setPictureError("");
    setForm({ ...form, avatarPicture: { kind: "preset", id } });
  }

  function importPicture(file: File | undefined) {
    setPictureError("");
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setPictureError("Format refusé. Utilisez JPG, PNG ou WebP.");
      return;
    }
    if (file.size > maxProfilePictureBytes) {
      setPictureError("Image trop lourde. Limite : 120 Ko.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === "string" ? reader.result : "";
      if (!dataUrl.startsWith("data:image/")) {
        setPictureError("Image invalide.");
        return;
      }
      setForm({ ...form, avatarPicture: { kind: "upload", dataUrl } });
    };
    reader.onerror = () => setPictureError("Lecture de l'image impossible.");
    reader.readAsDataURL(file);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    await api("/players", { method: "POST", body: JSON.stringify(form) });
    localStorage.setItem("mypro-tutorial-active", "1");
    await refresh();
    navigate("/dashboard");
  }
  return (
    <section className="panel p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.22em] text-emerald-300">
            Nouvelle carrière
          </p>
          <h1 className="mt-1 text-2xl font-black">Création du joueur</h1>
        </div>
        <div className="rounded-md border border-emerald-300/25 bg-emerald-300/10 px-3 py-2 text-sm font-black text-emerald-100">
          Départ NC · Niveau 0
        </div>
      </div>
      <div className="segmented-tabs mt-5">
        {[
          ["identity", "Identité", "Profil"],
          ["photo", "Photo", "Avatar"]
        ].map(([value, label, meta]) => (
          <button
            className={creationStep === value ? "is-active" : ""}
            key={value}
            onClick={() => setCreationStep(value as "identity" | "photo")}
            type="button"
          >
            <span>{label}</span>
            <small>{meta}</small>
          </button>
        ))}
      </div>
      <form onSubmit={submit} className="mt-5 grid gap-4 md:grid-cols-2">
        {creationStep === "identity" ? (
          <>
            {textFields.map(([key, label]) => (
              <label key={key} className="grid gap-2 text-sm font-semibold text-slate-200">
                <span>{label}</span>
                <Field
                  value={form[key]}
                  onChange={(event) => setForm({ ...form, [key]: event.target.value })}
                />
              </label>
            ))}
            <label className="grid gap-2 text-sm font-semibold text-slate-200">
              <span>Nationalité</span>
              <select
                className="rounded-md border border-white/10 bg-slate-950 px-3 py-2"
                value={form.nationality}
                onChange={(event) => setForm({ ...form, nationality: event.target.value })}
              >
                {countries.map((country: Country) => (
                  <option key={country.code} value={country.code}>
                    {country.label}
                  </option>
                ))}
              </select>
            </label>
            {selectFields.map(([key, label, values]) => (
              <label key={key} className="grid gap-2 text-sm font-semibold text-slate-200">
                <span>{label}</span>
                <select
                  className="rounded-md border border-white/10 bg-slate-950 px-3 py-2"
                  value={form[key] as string}
                  onChange={(event) => setForm({ ...form, [key]: event.target.value })}
                >
                  {values.map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
              </label>
            ))}
            <Button
              className="md:col-span-2"
              onClick={() => setCreationStep("photo")}
              type="button"
            >
              Continuer vers la photo <ChevronRight size={16} />
            </Button>
          </>
        ) : null}
        {creationStep === "photo" ? (
          <section className="rounded-md border border-white/10 bg-white/[0.04] p-4 md:col-span-2">
            <div className="grid gap-5 lg:grid-cols-[180px_1fr]">
              <div>
                <p className="text-sm font-semibold text-emerald-300">Photo de profil</p>
                <div className="mt-4 grid place-items-center rounded-md bg-slate-950/70 p-4">
                  <ProfilePicture
                    picture={form.avatarPicture}
                    initials={initialsFromName(form.firstName, form.lastName)}
                    size="lg"
                  />
                </div>
              </div>
              <div className="grid gap-4">
                <div>
                  <p className="text-sm font-semibold text-slate-200">
                    Choisir une Personal Picture
                  </p>
                  <div className="mt-3 grid grid-cols-5 gap-2 sm:grid-cols-10">
                    {personalPictures.map((picture) => (
                      <button
                        key={picture.id}
                        type="button"
                        className={`rounded-md border p-1 transition ${form.avatarPicture.kind === "preset" && form.avatarPicture.id === picture.id ? "border-emerald-300 bg-emerald-300/10" : "border-white/10 bg-white/[0.03] hover:bg-white/[0.08]"}`}
                        onClick={() => usePresetPicture(picture.id)}
                        title={picture.label}
                      >
                        <ProfilePicture
                          picture={{ kind: "preset", id: picture.id }}
                          initials={initialsFromName(form.firstName, form.lastName)}
                          size="sm"
                        />
                      </button>
                    ))}
                  </div>
                </div>
                <label className="grid gap-2 text-sm font-semibold text-slate-200">
                  <span>Importer une photo</span>
                  <input
                    className="rounded-md border border-white/10 bg-slate-950 px-3 py-2 text-sm"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(event) => importPicture(event.target.files?.[0])}
                  />
                </label>
                <p className="text-xs text-slate-400">
                  Formats acceptés : JPG, PNG, WebP. Poids maximum : 120 Ko. L'image est stockée en
                  version légère pour ne pas ralentir le jeu.
                </p>
                {pictureError ? (
                  <p className="rounded-md bg-red-500/15 p-3 text-sm text-red-100">
                    {pictureError}
                  </p>
                ) : null}
              </div>
            </div>
          </section>
        ) : null}
        {creationStep === "photo" ? (
          <div className="grid gap-3 md:col-span-2 md:grid-cols-2">
            <Button
              className="bg-white/10 text-white hover:bg-white/15"
              onClick={() => setCreationStep("identity")}
              type="button"
            >
              Retour à l'identité
            </Button>
            <Button type="submit">
              <Shield size={17} /> Lancer la carrière
            </Button>
          </div>
        ) : null}
      </form>
    </section>
  );
}

function StatIcon({ statKey, size = "md" }: { statKey: string; size?: "sm" | "md" | "lg" }) {
  const visual = statVisual(statKey);
  const Icon = visual.Icon;
  const sizeClass = size === "lg" ? "h-12 w-12" : size === "sm" ? "h-8 w-8" : "h-10 w-10";
  const iconSize = size === "lg" ? 24 : size === "sm" ? 16 : 20;
  return (
    <span
      className={`stat-icon ${sizeClass}`}
      style={{ color: visual.color, boxShadow: `0 0 24px ${visual.glow}` }}
      title={statLabels[statKey] ?? statKey}
    >
      <Icon size={iconSize} />
    </span>
  );
}

function StatBonusPills({ bonuses }: { bonuses: Record<string, number> }) {
  const entries = Object.entries(bonuses).filter(([, value]) => value > 0);
  if (!entries.length) return <span className="text-sm text-slate-400">Bonus à révéler</span>;
  return (
    <div className="flex flex-wrap gap-2">
      {entries.map(([key, value]) => (
        <span key={key} className="stat-bonus-pill">
          <StatIcon statKey={key} size="sm" />
          <span>{statLabels[key] ?? key}</span>
          <strong>+{value}</strong>
        </span>
      ))}
    </div>
  );
}

function StatBars({ player }: { player: Player }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {Object.entries(player.stats)
        .slice(0, 12)
        .map(([key, value]) => {
          const visual = statVisual(key);
          return (
            <div key={key} className="stat-card">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <StatIcon statKey={key} />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-black text-white">
                      {statLabels[key] ?? key}
                    </div>
                    <div className="text-xs text-slate-400">Carte {visual.short}</div>
                  </div>
                </div>
                <strong className="text-xl text-white">{Math.round(value)}</strong>
              </div>
              <div className="mt-3 h-2 rounded-full bg-white/[0.08]">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${value}%`, backgroundColor: visual.color }}
                />
              </div>
            </div>
          );
        })}
    </div>
  );
}

type TutorialStep = {
  title: string;
  body: string;
  action: string;
  path: string;
  icon: LucideIcon;
};

const baseTutorialSteps: TutorialStep[] = [
  {
    title: "Récupérer les sacs de départ",
    body: "Votre carrière commence avec 2 sacs Bronze, 1 sac Argent et 1 sac Or. Les Bronze sont ouvrables immédiatement, les autres suivent leur timer.",
    action: "Voir les sacs",
    path: "/dashboard",
    icon: PackageOpen
  },
  {
    title: "Faire évoluer la collection",
    body: "Les sacs donnent des cartes de statistiques et des objets cosmétiques. Les cartes débloquent des bonus payants, les objets équipés peuvent être améliorés sur 3 niveaux.",
    action: "Ouvrir la collection",
    path: "/collection",
    icon: Sparkles
  },
  {
    title: "Dépenser les points de compétence",
    body: "Les matchs donnent de l'XP. À chaque niveau joueur gagné, vous recevez 1 point de compétence à placer sur une des 12 statistiques de votre style de jeu.",
    action: "Voir les compétences",
    path: "/skills",
    icon: Target
  },
  {
    title: "Lancer un duel",
    body: "Le duel coûte 1 point d'énergie et propose 3 adversaires proches de votre classement, avec au moins un profil IA pour progresser plus régulièrement.",
    action: "Choisir un adversaire",
    path: "/duel",
    icon: Swords
  },
  {
    title: "Récupérer la récompense de saison",
    body: "Chaque saison dure 30 jours pour tous les joueurs. Une récompense journalière peut être récupérée dans la timeline, sans utiliser de slot de sac.",
    action: "Voir la saison",
    path: "/season",
    icon: Gift
  },
  {
    title: "Construire le parcours FFT",
    body: "Les matchs officiels de saison et de championnat par équipe alimentent la simulation FFT. L'objectif amateur reste de valider -15 pour ouvrir le circuit pro.",
    action: "Voir mon joueur",
    path: "/player",
    icon: Shield
  },
  {
    title: "Rejoindre ou développer un club",
    body: "Le club donne accès au championnat par équipe, aux cotisations et aux infrastructures comme le complexe, le centre de soins et le centre d'entraînement.",
    action: "Voir mon club",
    path: "/club",
    icon: Users
  }
];

function buildTutorialSteps(player: Player, notifications: GameNotification[]): TutorialStep[] {
  const unread = notifications.filter((notification) => !notification.readAt);
  const prioritySteps: TutorialStep[] = [];

  if (unread.some((notification) => notificationTarget(notification) === "/season")) {
    prioritySteps.push({
      title: "Récompense disponible",
      body: "Une nouveauté vous attend dans Saison en cours. Si c'est la récompense du jour, récupérez-la maintenant : elle s'ouvre immédiatement et ne prend aucun slot de sac.",
      action: "Aller à la saison",
      path: "/season",
      icon: Gift
    });
  }

  if (unread.some((notification) => notificationTarget(notification) === "/collection")) {
    prioritySteps.push({
      title: "Bonus de collection prêt",
      body: "Un palier de carte ou une nouveauté de collection est disponible. Pensez à débloquer les bonus utiles et à équiper vos meilleurs objets cosmétiques.",
      action: "Gérer la collection",
      path: "/collection",
      icon: PackageOpen
    });
  }

  if (unread.some((notification) => notificationTarget(notification) === "/club")) {
    prioritySteps.push({
      title: "Activité de club",
      body: "Votre club a une nouveauté : demande, cotisation, présidence, championnat ou infrastructure. Consultez la page club pour ne pas manquer l'action importante.",
      action: "Voir le club",
      path: "/club",
      icon: Users
    });
  }

  if (unread.some((notification) => notificationTarget(notification) === "/matches")) {
    prioritySteps.push({
      title: "Match à consulter",
      body: "Un duel ou un match officiel vient d'être joué. Regardez le replay pour comprendre quelles statistiques ont décidé les points.",
      action: "Voir les matchs",
      path: "/matches",
      icon: History
    });
  }

  if (player.actionEnergy > 0) {
    prioritySteps.push({
      title: "Utiliser l'énergie disponible",
      body: `Vous avez ${player.actionEnergy}/${player.actionEnergyMax} point(s) d'énergie. Dépensez-les en duel ou en compétition pour obtenir des sacs et construire votre classement.`,
      action: "Lancer un duel",
      path: "/duel",
      icon: Zap
    });
  }

  if (player.skillPoints > 0) {
    prioritySteps.push({
      title: "Point de compétence disponible",
      body: `Vous avez ${player.skillPoints} point(s) de compétence. Placez-les dans votre arbre pour renforcer votre archétype et rendre votre progression plus lisible.`,
      action: "Dépenser les points",
      path: "/skills",
      icon: Target
    });
  }

  return [...prioritySteps, ...baseTutorialSteps].filter(
    (step, index, steps) => steps.findIndex((item) => item.title === step.title) === index
  );
}

function TutorialModal({ onClose }: { onClose: () => void }) {
  const player = useGameStore((state) => state.player)!;
  const notifications = useGameStore((state) => state.notifications);
  const tutorialSteps = useMemo(
    () => buildTutorialSteps(player, notifications),
    [notifications, player]
  );
  const [step, setStep] = useState(0);
  const navigate = useNavigate();
  const current = tutorialSteps[step] ?? tutorialSteps[0];
  const CurrentIcon = current?.icon ?? CheckCircle2;
  const last = step >= tutorialSteps.length - 1;

  useEffect(() => {
    setStep((value) => Math.min(value, Math.max(0, tutorialSteps.length - 1)));
  }, [tutorialSteps.length]);

  function close(done = false) {
    localStorage.removeItem("mypro-tutorial-active");
    if (done) localStorage.setItem("mypro-tutorial-done", "1");
    onClose();
  }

  function goToStepPath() {
    if (!current) return;
    navigate(current.path);
    close(step >= 1);
  }

  return (
    <div className="game-modal-overlay">
      <section className="game-modal-panel panel max-w-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.24em] text-emerald-300">
              Tutoriel
            </p>
            <h2 className="mt-1 text-2xl font-black">Coach de carrière</h2>
          </div>
          <button
            className="rounded-md bg-white/10 p-2 text-slate-200 hover:bg-white/15"
            onClick={() => close(false)}
            aria-label="Fermer le tutoriel"
          >
            <X size={18} />
          </button>
        </div>
        <div className="mt-5 flex gap-2">
          {tutorialSteps.map((item, index) => (
            <button
              key={item.title}
              className={`h-2 flex-1 rounded-full ${index <= step ? "bg-emerald-300" : "bg-white/10"}`}
              onClick={() => setStep(index)}
              aria-label={`Étape ${index + 1}`}
            />
          ))}
        </div>
        <div className="mt-6 rounded-md border border-white/10 bg-white/[0.04] p-5">
          <div className="mb-4 grid h-12 w-12 place-items-center rounded-full bg-emerald-300 text-slate-950">
            <CurrentIcon size={24} />
          </div>
          <p className="text-sm text-slate-400">
            Étape {step + 1}/{tutorialSteps.length}
          </p>
          <h3 className="mt-1 text-xl font-black">{current?.title}</h3>
          <p className="mt-3 text-sm leading-6 text-slate-300">{current?.body}</p>
        </div>
        <div className="mt-5 flex flex-wrap justify-between gap-3">
          <Button
            className="bg-white/10 text-white hover:bg-white/15"
            disabled={step === 0}
            onClick={() => setStep((value) => Math.max(0, value - 1))}
          >
            Retour
          </Button>
          <div className="flex flex-wrap gap-3">
            <Button className="bg-white/10 text-white hover:bg-white/15" onClick={goToStepPath}>
              {current?.action}
            </Button>
            <Button
              onClick={() =>
                last
                  ? close(true)
                  : setStep((value) => Math.min(tutorialSteps.length - 1, value + 1))
              }
            >
              {last ? "Terminer" : "Suivant"} <ChevronRight size={16} />
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}

function LobbyBagsCard({
  chests,
  busyChest,
  onCollection,
  onOpen,
  onSpeedUp
}: {
  chests: ChestState | null;
  busyChest: string | null;
  onCollection: () => void;
  onOpen: (chest: TennisBagChest) => void;
  onSpeedUp: (chest: TennisBagChest) => void;
}) {
  const timerNow = useNow(1000);
  const slots =
    chests?.slots ?? Array.from({ length: 4 }, (_, slotIndex) => ({ slotIndex, chest: null }));
  const readyBags = slots.filter(
    (slot) => slot.chest && chestRemainingAt(slot.chest, timerNow) <= 0
  ).length;

  return (
    <div aria-label={`Sacs, ${readyBags} prêt(s)`} className="lobby-bags-card" role="region">
      <div className="lobby-bags-heading">
        <span className="lobby-card-kicker">Sacs</span>
        <button
          aria-label="Voir la collection"
          className="lobby-bags-link"
          onClick={onCollection}
          type="button"
        >
          <PackageOpen size={20} />
        </button>
      </div>
      <div className="lobby-bag-row">
        {slots.map(({ slotIndex, chest }) => {
          const remaining = chest ? chestRemainingAt(chest, timerNow) : 0;
          const canOpen = Boolean(chest && remaining <= 0);
          const speedUpCost = chest ? chestSpeedUpCostAt(chest, timerNow) : 0;
          if (!chest) {
            return (
              <article
                aria-label={`Emplacement ${slotIndex + 1} vide`}
                className="lobby-mini-bag is-empty"
                key={slotIndex}
              >
                <span className="lobby-empty-bag-icon">
                  <Lock size={15} />
                </span>
                <span className="lobby-bag-action is-empty">Slot vide</span>
              </article>
            );
          }

          const isBusy = busyChest === chest.id;
          const actionLabel = canOpen
            ? `Ouvrir le coffre ${chest.rarity}`
            : `Terminer le coffre ${chest.rarity} pour ${speedUpCost} gemme(s)`;

          return (
            <button
              aria-label={`${actionLabel}. ${canOpen ? "Prêt" : formatLobbyRemaining(remaining)}`}
              className={`lobby-mini-bag ${rarityClass(chest.rarity)} ${
                canOpen ? "is-ready" : "has-timer"
              }`}
              disabled={busyChest !== null}
              key={slotIndex}
              onClick={() => (canOpen ? onOpen(chest) : onSpeedUp(chest))}
              title={actionLabel}
              type="button"
            >
              <div className="lobby-bag-visual">
                <TennisBagVisual rarity={chest.rarity} opening={isBusy} />
                {!canOpen ? (
                  <span className="lobby-bag-timer" aria-live="polite">
                    <Clock3 size={10} />
                    {formatLobbyRemaining(remaining)}
                  </span>
                ) : null}
              </div>
              <span className={`lobby-bag-action ${canOpen ? "is-open" : "is-gem"}`}>
                {isBusy ? (
                  "..."
                ) : canOpen ? (
                  "Ouvrir"
                ) : (
                  <>
                    <FastForward size={10} /> Finir <Gem size={10} /> {speedUpCost}
                  </>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Dashboard() {
  const player = useGameStore((state) => state.player)!;
  const refreshPlayer = useGameStore((state) => state.refresh);
  const patchPlayer = useGameStore((state) => state.patchPlayer);
  const navigate = useNavigate();
  const [chests, setChests] = useState<ChestState | null>(null);
  const [season, setSeason] = useState<SeasonData | null>(null);
  const [rewardOpening, setRewardOpening] = useState<{
    rewards: ChestRewards;
    rarity: ChestRarity;
  } | null>(null);
  const [busyChest, setBusyChest] = useState<string | null>(null);
  const [hubMessage, setHubMessage] = useState("");
  const topSixStats = useMemo(
    () =>
      profileStatKeys
        .map((key) => ({ key, label: statLabels[key], value: stat(player, key) }))
        .sort((first, second) => second.value - first.value)
        .slice(0, 6),
    [player]
  );
  const topStats = topSixStats.slice(0, 3);
  const seasonCompetition =
    season?.competitions.find((competition) => competition.type === "daily") ??
    season?.competitions[0] ??
    null;
  const emptyBags = chests?.slots.filter((slot) => !slot.chest).length ?? 4;

  useEffect(() => {
    let cancelled = false;
    void loadDashboard().catch(() => undefined);
    return () => {
      cancelled = true;
    };

    async function loadDashboard() {
      const [chestResult, seasonResult] = await Promise.allSettled([
        api<ChestState>("/chests"),
        api<SeasonData>("/season")
      ]);
      if (cancelled) return;
      if (chestResult.status === "fulfilled") setChests(chestResult.value);
      if (seasonResult.status === "fulfilled") setSeason(seasonResult.value);
    }
  }, []);

  async function reloadDashboard() {
    const [chestState, seasonState] = await Promise.all([
      api<ChestState>("/chests"),
      api<SeasonData>("/season")
    ]);
    setChests(chestState);
    setSeason(seasonState);
  }

  function currentChestRemaining(chest: TennisBagChest) {
    return chestRemainingAt(chest);
  }

  function currentChestSpeedUpCost(chest: TennisBagChest) {
    return chestSpeedUpCostAt(chest);
  }

  async function openHubChest(chest: TennisBagChest) {
    if (currentChestRemaining(chest) > 0 || busyChest) return;
    setBusyChest(chest.id);
    setHubMessage("");
    try {
      const result = await api<{ chest: TennisBagChest; rewards: ChestRewards }>(
        `/chests/${chest.id}/open`,
        { method: "POST" }
      );
      setChests((current) =>
        current
          ? {
              ...current,
              slots: current.slots.map((slot) =>
                slot.chest?.id === chest.id ? { ...slot, chest: null } : slot
              ),
              gems: current.gems + result.rewards.gems
            }
          : current
      );
      patchPlayer((current) => ({
        budget: current.budget + result.rewards.money,
        gems: current.gems + result.rewards.gems
      }));
      setRewardOpening({ rewards: result.rewards, rarity: chest.rarity });
      void Promise.all([reloadDashboard(), refreshPlayer()]).catch(() => undefined);
    } catch (error) {
      setHubMessage(error instanceof Error ? error.message : "Ouverture du sac impossible.");
    } finally {
      setBusyChest(null);
    }
  }

  async function speedUpHubChest(chest: TennisBagChest) {
    if (currentChestRemaining(chest) <= 0 || busyChest) return;
    const speedUpCost = currentChestSpeedUpCost(chest);
    if (player.gems < speedUpCost) {
      setHubMessage(
        `Il faut ${speedUpCost} gemme(s) pour terminer ce coffre. Vous en avez ${player.gems}.`
      );
      return;
    }
    setBusyChest(chest.id);
    setHubMessage("");
    try {
      const updatedChest = await api<TennisBagChest>(`/chests/${chest.id}/speedup`, {
        method: "POST"
      });
      setChests((current) =>
        current
          ? {
              ...current,
              gems: Math.max(0, current.gems - speedUpCost),
              slots: current.slots.map((slot) =>
                slot.chest?.id === chest.id ? { ...slot, chest: updatedChest } : slot
              )
            }
          : current
      );
      patchPlayer((current) => ({ gems: Math.max(0, current.gems - speedUpCost) }));
      void refreshPlayer();
    } catch (error) {
      setHubMessage(error instanceof Error ? error.message : "Accélération impossible.");
    } finally {
      setBusyChest(null);
    }
  }

  return (
    <div className="dashboard-lobby lobby-cinematic">
      <section className="lobby-stage">
        <div className="lobby-topbar">
          <button className="lobby-brand" onClick={() => navigate("/dashboard")} type="button">
            <span>MYPRO</span>
            <strong>TENNIS</strong>
          </button>
          <LobbySeasonTrack
            seasonLabel={`Saison ${season?.season.key.replace("saison-", "") ?? "…"}`}
            day={season?.season.day}
            rewardReady={Boolean(season)}
            onClick={() => navigate("/season")}
            onPrefetch={() => prefetchRouteData("/season")}
          />
          <div className="lobby-top-actions">
            <div className="lobby-resource-row">
              <button
                className="lobby-resource-pill lobby-energy"
                onClick={() => navigate("/duel")}
                onFocus={() => prefetchRouteData("/duel")}
                onPointerEnter={() => prefetchRouteData("/duel")}
                type="button"
              >
                <Zap size={18} />
                <span>
                  <small>Énergie</small>
                  <strong>
                    {player.actionEnergy}/{player.actionEnergyMax}
                  </strong>
                </span>
              </button>
              <button
                className="lobby-resource-pill lobby-gems"
                onClick={() => navigate("/collection")}
                onFocus={() => prefetchRouteData("/collection")}
                onPointerEnter={() => prefetchRouteData("/collection")}
                type="button"
              >
                <Gem size={18} />
                <span>
                  <small>Gemmes</small>
                  <strong>{player.gems}</strong>
                </span>
              </button>
              <button
                className="lobby-resource-pill lobby-money"
                onClick={() => navigate("/player")}
                type="button"
              >
                <Coins aria-hidden="true" size={18} />
                <span>
                  <small>Crédits</small>
                  <strong>{formatCredits(player.budget)}</strong>
                </span>
              </button>
            </div>
            <div className="lobby-system-buttons">
              <NotificationCenter compact />
              <button
                className="header-icon-button"
                onClick={() => navigate("/community")}
                type="button"
                aria-label="Aide et communauté"
              >
                <HelpCircle size={18} />
              </button>
              <button
                className="header-icon-button"
                onClick={() => navigate("/settings")}
                type="button"
                aria-label="Réglages"
              >
                <Settings size={18} />
              </button>
            </div>
          </div>
        </div>

        <button
          className="lobby-profile-button"
          onClick={() => navigate("/player")}
          onFocus={() => prefetchRouteData("/player")}
          onPointerEnter={() => prefetchRouteData("/player")}
          type="button"
        >
          <ProfilePicture avatar={player.avatar} size="sm" />
          <span>
            <strong>{player.name}</strong>
            <small>
              {player.fftRanking} classement · Niv. {player.playerLevel}
            </small>
            <i>
              <b style={{ width: `${Math.min(100, Math.max(6, player.playerLevel * 8))}%` }} />
            </i>
          </span>
          <span className="lobby-level-badge">
            <small>Niv.</small>
            <strong>{player.playerLevel}</strong>
          </span>
        </button>

        <div className="lobby-grid">
          <aside className="lobby-side lobby-side-left">
            <LobbyActionButton
              icon={PackageOpen}
              label="Collection"
              detail="Joueurs & équipements"
              badge={emptyBags ? `${emptyBags} slot(s)` : undefined}
              onClick={() => navigate("/collection")}
              onPrefetch={() => prefetchRouteData("/collection")}
            />
            <LobbyActionButton
              icon={Repeat2}
              label="Marché"
              detail="Occasion & offres"
              onClick={() => navigate("/collection")}
              onPrefetch={() => prefetchRouteData("/collection")}
            />
            <LobbyActionButton
              icon={Target}
              label="Compétences"
              detail={`${player.skillPoints} point(s) à placer`}
              badge={player.skillPoints ? "!" : undefined}
              onClick={() => navigate("/skills")}
              onPrefetch={() => prefetchRouteData("/skills")}
            />
            <LobbyActionButton
              icon={Trophy}
              label="Palmarès"
              detail="Titres & records"
              onClick={() => navigate("/player")}
              onPrefetch={() => prefetchRouteData("/player")}
            />
          </aside>

          <main className="lobby-center">
            <LobbyPlayerHero
              name={player.name}
              ranking={player.fftRanking}
              portraitSrc={avatarPictureSource(player.avatar)}
              heroSrc={avatarHeroSource(player.avatar)}
              stats={topStats.map((item) => ({
                key: item.key,
                value: item.value,
                icon: <StatIcon statKey={item.key} size="sm" />
              }))}
            />

            <div className="lobby-main-mode">
              <div className="lobby-mode-info">
                <p>Duel · saison</p>
                <div className="lobby-mode-metrics">
                  <span>
                    <Users size={20} />
                    <small>Bassin d’adversaires</small>
                    <strong>{player.fftRanking} - 300</strong>
                  </span>
                  <span>
                    <Zap size={20} />
                    <small>Coût du match</small>
                    <strong>1 énergie</strong>
                  </span>
                </div>
              </div>
              <Button
                className="lobby-play-button"
                onClick={() => navigate("/duel")}
                onFocus={() => prefetchRouteData("/duel")}
                onPointerEnter={() => prefetchRouteData("/duel")}
              >
                Jouer duel
              </Button>
            </div>
          </main>

          <aside className="lobby-side lobby-side-right">
            <LobbyActionButton
              icon={Users}
              label="Mon club"
              detail="Membres & gestion"
              onClick={() => navigate("/club")}
              onPrefetch={() => prefetchRouteData("/club")}
            />
            <LobbyActionButton
              icon={BarChart3}
              label="Classement"
              detail={`Global · rang ${player.worldRank}`}
              onClick={() => navigate("/rankings")}
              onPrefetch={() => prefetchRouteData("/rankings")}
            />
            <LobbyActionButton
              icon={MessageCircle}
              label="Communauté"
              detail="Actualités & défis"
              onClick={() => navigate("/community")}
            />
            <LobbyActionButton
              icon={Wifi}
              label="Joueurs en ligne"
              detail="Présence MMO"
              onClick={() => navigate("/online")}
            />
          </aside>
        </div>

        <div className="lobby-bottom">
          <button
            className="lobby-season-card"
            onClick={() => navigate("/season")}
            onFocus={() => prefetchRouteData("/season")}
            onPointerEnter={() => prefetchRouteData("/season")}
            type="button"
          >
            <span className="lobby-season-trophy" aria-hidden="true">
              <Trophy size={52} />
            </span>
            <span className="lobby-season-copy">
              <span className="lobby-card-kicker">Saison en cours</span>
              <strong>Championnat amateur</strong>
              <small>
                Jour {season?.season.day ?? "…"} · fin le{" "}
                {season ? new Date(season.season.endsAt).toLocaleDateString("fr-FR") : "…"}
              </small>
              <small>
                {seasonCompetition?.entry
                  ? "Compétition inscrite"
                  : seasonCompetition?.playableNow
                    ? "Inscription disponible"
                    : "Prochaine fenêtre à venir"}
              </small>
            </span>
            <ChevronRight className="lobby-season-chevron" size={28} />
          </button>

          <button
            className="lobby-stats-card"
            onClick={() => navigate("/player?tab=stats")}
            type="button"
          >
            <div className="lobby-stats-head">
              <span>
                <span className="lobby-card-kicker">Note globale</span>
                <strong>{player.overall}</strong>
              </span>
              <ChevronRight size={18} />
            </div>
            <div className="lobby-stat-bars">
              {topSixStats.map((item) => (
                <div className="lobby-stat-row" key={item.key}>
                  <span>{item.label}</span>
                  <i>
                    <b style={{ width: `${Math.max(4, Math.min(100, item.value))}%` }} />
                  </i>
                  <strong>{Math.round(item.value)}</strong>
                </div>
              ))}
            </div>
            <small>Voir toutes les stats</small>
          </button>

          <LobbyBagsCard
            busyChest={busyChest}
            chests={chests}
            onCollection={() => navigate("/collection")}
            onOpen={(chest) => void openHubChest(chest)}
            onSpeedUp={(chest) => void speedUpHubChest(chest)}
          />
        </div>
        {hubMessage ? <div className="lobby-toast">{hubMessage}</div> : null}
      </section>
      {rewardOpening ? (
        <RewardModal
          rewards={rewardOpening.rewards}
          rarity={rewardOpening.rarity}
          onClose={() => setRewardOpening(null)}
        />
      ) : null}
    </div>
  );
}

function GameMiniMetric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="game-mini-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="metric">
      <div className="text-xs text-slate-400">{label}</div>
      <div className="mt-1 text-xl font-black">{value}</div>
    </div>
  );
}

function PlayerPage() {
  const player = useGameStore((state) => state.player)!;
  const refresh = useGameStore((state) => state.refresh);
  const [searchParams, setSearchParams] = useSearchParams();
  const [career, setCareer] = useState<CareerProfile | null>(null);
  const [avatarEditorOpen, setAvatarEditorOpen] = useState(false);
  const [profileEditorOpen, setProfileEditorOpen] = useState(false);
  const requestedTab = searchParams.get("tab");
  const initialTab: "overview" | "stats" | "palmares" =
    requestedTab === "stats" || requestedTab === "palmares" ? requestedTab : "overview";
  const [tab, setTab] = useState<"overview" | "stats" | "palmares">(initialTab);
  const topStats = profileStatKeys
    .map((key) => ({ key, value: stat(player, key) }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 3);
  useEffect(() => void api<CareerProfile>("/players/me/career").then(setCareer), []);
  useEffect(() => {
    const nextTab = searchParams.get("tab");
    if ((nextTab === "stats" || nextTab === "palmares") && nextTab !== tab) {
      setTab(nextTab);
    }
    if (!nextTab && tab !== "overview") setTab("overview");
  }, [searchParams, tab]);

  function selectPlayerTab(nextTab: "overview" | "stats" | "palmares") {
    setTab(nextTab);
    setSearchParams(nextTab === "overview" ? {} : { tab: nextTab }, { replace: true });
  }

  return (
    <div className="grid gap-4">
      <section className="panel p-4 sm:p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            <ProfilePicture avatar={player.avatar} size="md" />
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-black">{player.name}</h1>
              <p className="text-sm text-slate-300">
                {nationalityLabel(player.nationality)} · {player.fftRanking} · Niveau{" "}
                {player.overall}
              </p>
            </div>
          </div>
          <div className="grid gap-2">
            <button
              className="rounded-md border border-emerald-300/35 bg-emerald-300/10 px-3 py-2 text-sm font-bold text-emerald-100 transition hover:bg-emerald-300/18"
              onClick={() => setProfileEditorOpen(true)}
              type="button"
            >
              Profil
            </button>
            <button
              className="rounded-md border border-white/10 bg-white/[0.06] px-3 py-2 text-sm font-bold text-slate-100 transition hover:bg-white/[0.1]"
              onClick={() => setAvatarEditorOpen(true)}
              type="button"
            >
              Photo
            </button>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <GameMiniMetric label="Victoires" value={player.wins} />
          <GameMiniMetric label="Défaites" value={player.losses} />
          <GameMiniMetric label="Titres" value={career?.palmares.titles ?? "..."} />
          <GameMiniMetric
            label="Simulation"
            value={career?.rankingSimulation.simulatedRanking ?? "..."}
          />
        </div>
        <div className="segmented-tabs mt-4">
          {[
            ["overview", "Parcours", player.fftRanking],
            ["stats", "Stats", `${player.overall}`],
            ["palmares", "Palmarès", `${career?.palmares.titles ?? 0} titre(s)`]
          ].map(([value, label, meta]) => (
            <button
              key={value}
              className={tab === value ? "is-active" : ""}
              onClick={() => selectPlayerTab(value as typeof tab)}
              type="button"
            >
              <span>{label}</span>
              <small>{meta}</small>
            </button>
          ))}
        </div>
      </section>
      {tab === "stats" ? (
        <section className="panel p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm text-emerald-300">Profil joueur</p>
              <h2 className="font-bold">Statistiques</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {topStats.map((item) => (
                <span key={item.key} className="stat-bonus-pill">
                  <StatIcon statKey={item.key} size="sm" />
                  <span>{statLabels[item.key]}</span>
                  <strong>{Math.round(item.value)}</strong>
                </span>
              ))}
            </div>
          </div>
          <div className="mt-4">
            <StatBars player={player} />
          </div>
        </section>
      ) : null}
      {tab === "overview" ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <CareerPathCard player={player} />
          <RankingSimulationCard career={career} player={player} />
        </div>
      ) : null}
      {tab === "palmares" ? <PlayerPalmaresCard career={career} /> : null}
      {avatarEditorOpen ? (
        <AvatarEditorModal
          player={player}
          onClose={() => setAvatarEditorOpen(false)}
          onSaved={async () => {
            await refresh();
            setAvatarEditorOpen(false);
          }}
        />
      ) : null}
      {profileEditorOpen ? (
        <ProfileEditorModal
          player={player}
          onClose={() => setProfileEditorOpen(false)}
          onSaved={async () => {
            await refresh();
            setProfileEditorOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}

function ProfileEditorModal({
  player,
  onClose,
  onSaved
}: {
  player: Player;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [form, setForm] = useState<{
    firstName: string;
    lastName: string;
    nationality: string;
    gender: string;
    dominantHand: string;
    backhand: string;
  }>({
    firstName: player.firstName,
    lastName: player.lastName,
    nationality: normalizeCountryCode(player.nationality) ?? "FR",
    gender: player.gender,
    dominantHand: player.dominantHand,
    backhand: player.backhand
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await api<Player>("/players/me/profile", {
        method: "PATCH",
        body: JSON.stringify(form)
      });
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Profil impossible à enregistrer.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="game-modal-overlay">
      <form className="game-modal-panel panel max-w-2xl" onSubmit={save}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.24em] text-emerald-300">
              Identité joueur
            </p>
            <h2 className="mt-1 text-2xl font-black">Modifier le profil</h2>
            <p className="mt-1 text-sm text-slate-300">
              Ces informations sont visibles dans les duels, le classement et votre profil public.
            </p>
          </div>
          <button
            className="rounded-md bg-white/10 p-2 text-slate-200 hover:bg-white/15"
            onClick={onClose}
            aria-label="Fermer"
            type="button"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <label className="grid gap-2 text-sm font-semibold text-slate-200">
            <span>Prénom</span>
            <Field
              value={form.firstName}
              onChange={(event) => setForm({ ...form, firstName: event.target.value })}
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-slate-200">
            <span>Nom</span>
            <Field
              value={form.lastName}
              onChange={(event) => setForm({ ...form, lastName: event.target.value })}
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-slate-200 md:col-span-2">
            <span>Nationalité</span>
            <select
              className="rounded-md border border-white/10 bg-slate-950 px-3 py-2"
              value={form.nationality}
              onChange={(event) => setForm({ ...form, nationality: event.target.value })}
            >
              {countries.map((country: Country) => (
                <option key={country.code} value={country.code}>
                  {country.label}
                </option>
              ))}
            </select>
          </label>
          {[
            ["gender", "Sexe", ["Femme", "Homme"]],
            ["dominantHand", "Main dominante", ["Droite", "Gauche"]],
            ["backhand", "Revers", ["Une main", "Deux mains"]]
          ].map(([key, label, values]) => (
            <label key={key as string} className="grid gap-2 text-sm font-semibold text-slate-200">
              <span>{label as string}</span>
              <select
                className="rounded-md border border-white/10 bg-slate-950 px-3 py-2"
                value={form[key as keyof typeof form]}
                onChange={(event) => setForm({ ...form, [key as string]: event.target.value })}
              >
                {(values as string[]).map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>
          ))}
        </div>

        {error ? (
          <p className="mt-4 rounded-md border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
            {error}
          </p>
        ) : null}

        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <Button
            className="bg-white/10 text-white hover:bg-white/15"
            onClick={onClose}
            type="button"
          >
            Annuler
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Enregistrement..." : "Enregistrer"}
          </Button>
        </div>
      </form>
    </div>
  );
}

function AvatarEditorModal({
  player,
  onClose,
  onSaved
}: {
  player: Player;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const current = parseAvatar(player.avatar);
  const [picture, setPicture] = useState<AvatarPicture>(
    current?.picture ?? { kind: "preset", id: "pp-01" }
  );
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const initials = current?.initials ?? initialsFromName(player.firstName, player.lastName);

  function usePresetPicture(id: string) {
    setPicture({ kind: "preset", id });
    setError("");
  }

  function importPicture(file?: File) {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Format refuse. Utilisez une image JPG, PNG ou WebP.");
      return;
    }
    if (file.size > maxProfilePictureBytes) {
      setError("Image trop lourde. Limite maximale : 120 Ko.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result ?? "");
      setPicture({ kind: "upload", dataUrl });
      setError("");
    };
    reader.onerror = () => setError("Impossible de lire cette image.");
    reader.readAsDataURL(file);
  }

  async function save() {
    setSaving(true);
    setError("");
    try {
      await api<Player>("/players/me/avatar", {
        method: "PATCH",
        body: JSON.stringify({ avatarPicture: picture })
      });
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Photo impossible a enregistrer.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="game-modal-overlay">
      <section className="game-modal-panel panel max-w-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.24em] text-emerald-300">
              Photo de profil
            </p>
            <h2 className="mt-1 text-2xl font-black">Modifier l'image du joueur</h2>
          </div>
          <button
            className="rounded-md bg-white/10 p-2 text-slate-200 hover:bg-white/15"
            onClick={onClose}
            aria-label="Fermer"
            type="button"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-6 grid gap-5 md:grid-cols-[170px_1fr]">
          <div className="rounded-md border border-white/10 bg-white/[0.04] p-4 text-center">
            <div className="mx-auto w-fit">
              <ProfilePicture picture={picture} initials={initials} size="lg" />
            </div>
            <p className="mt-3 text-sm text-slate-300">Apercu public</p>
          </div>

          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
              <Image size={16} />
              Personal Pictures
            </div>
            <div className="mt-3 grid grid-cols-5 gap-2">
              {personalPictures.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => usePresetPicture(item.id)}
                  className={`rounded-md border p-1 transition ${
                    picture.kind === "preset" && picture.id === item.id
                      ? "border-emerald-300 bg-emerald-300/10"
                      : "border-white/10 bg-white/[0.03] hover:bg-white/[0.08]"
                  }`}
                  aria-label={`Choisir ${item.label}`}
                >
                  <ProfilePicture
                    picture={{ kind: "preset", id: item.id }}
                    initials={initials}
                    size="sm"
                  />
                </button>
              ))}
            </div>

            <label className="mt-5 flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-white/20 bg-white/[0.04] px-4 py-4 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.08]">
              <Upload size={16} />
              Importer une photo
              <input
                className="hidden"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) => importPicture(event.target.files?.[0])}
              />
            </label>
            <p className="mt-2 text-xs text-slate-400">
              Formats acceptes : JPG, PNG, WebP. Taille maximale : 120 Ko.
            </p>
            {error ? (
              <p className="mt-3 rounded-md border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
                {error}
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <Button className="bg-white/10 text-white hover:bg-white/15" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Enregistrement..." : "Enregistrer"}
          </Button>
        </div>
      </section>
    </div>
  );
}

function competitionLabel(type: string) {
  if (type === "daily") return "Tournoi journalier";
  if (type === "weekly") return "Tournoi hebdomadaire";
  if (type === "individual") return "Championnat individuel";
  return type;
}

function PlayerPalmaresCard({ career }: { career: CareerProfile | null }) {
  const palmares = career?.palmares;
  return (
    <section className="panel p-5 lg:col-span-2">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-emerald-300">Palmarès</p>
          <h2 className="text-2xl font-black">Bilan officiel</h2>
        </div>
        <Trophy className="text-emerald-300" size={24} />
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Metric label="Titres" value={palmares?.titles ?? "..."} />
        <Metric label="Nationaux" value={palmares?.nationalTitles ?? "..."} />
        <Metric label="Finales" value={palmares?.finals ?? "..."} />
        <Metric label="Victoires" value={palmares?.wins ?? "..."} />
        <Metric label="Défaites" value={palmares?.losses ?? "..."} />
      </div>
      <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        <div className="rounded-md border border-white/10 bg-white/[0.04] p-4">
          <h3 className="font-black">Compétitions</h3>
          <div className="mt-3 grid gap-2">
            {(palmares?.competitions ?? []).length ? (
              palmares!.competitions.map((item) => (
                <div
                  key={item.type}
                  className="grid grid-cols-[1fr_70px_70px] gap-2 rounded-md bg-black/20 px-3 py-2 text-sm"
                >
                  <span>{competitionLabel(item.type)}</span>
                  <span className="text-slate-300">{item.played} jouée(s)</span>
                  <strong className="text-emerald-300">{item.titles} titre(s)</strong>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-400">Aucune compétition terminée pour le moment.</p>
            )}
          </div>
        </div>
        <div className="rounded-md border border-white/10 bg-white/[0.04] p-4">
          <h3 className="font-black">Derniers titres</h3>
          <div className="mt-3 grid gap-2">
            {(palmares?.recentTitles ?? []).length ? (
              palmares!.recentTitles.map((title) => (
                <div
                  key={title.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-black/20 px-3 py-2 text-sm"
                >
                  <span className="font-semibold">{title.label}</span>
                  <span className="text-slate-300">
                    {competitionLabel(title.type)} ·{" "}
                    {new Date(title.date).toLocaleDateString("fr-FR")}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-400">
                Le premier titre viendra d’un tournoi gagné ou du championnat individuel.
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function RankingSimulationCard({
  career,
  player
}: {
  career: CareerProfile | null;
  player: Player;
}) {
  const simulation = career?.rankingSimulation;
  const target = simulation?.nextMinimum ?? proValidationThreshold;
  const progress = simulation
    ? Math.max(0, Math.min(100, (simulation.points / Math.max(1, target)) * 100))
    : 0;
  return (
    <section className="panel p-5 lg:col-span-2">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-emerald-300">Simulation classement</p>
          <h2 className="text-2xl font-black">Projection FFT de la saison</h2>
        </div>
        <div className="rounded-md bg-cyan-300 px-4 py-2 text-xl font-black text-slate-950">
          {simulation?.simulatedRanking ?? player.fftRanking}
        </div>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Metric label="Classement actuel" value={simulation?.currentRanking ?? player.fftRanking} />
        <Metric label="Classement simulé" value={simulation?.simulatedRanking ?? "..."} />
        <Metric label="Points retenus" value={simulation?.points ?? "..."} />
        <Metric
          label="Victoires retenues"
          value={simulation ? `${simulation.takenWins}/${simulation.winsToKeep}` : "..."}
        />
        <Metric
          label="Bilan officiel"
          value={simulation ? `${simulation.wins}V / ${simulation.losses}D` : "..."}
        />
      </div>
      <div className="mt-5 rounded-md border border-cyan-300/15 bg-cyan-300/10 p-4">
        <div className="mb-2 flex flex-wrap justify-between gap-2 text-sm text-slate-200">
          <span>{simulation?.points ?? 0} point(s)</span>
          <span>
            {simulation?.nextRanking
              ? `Objectif ${simulation.nextRanking} : ${simulation.pointsToNext} point(s) à gagner`
              : "Dernier palier amateur"}
          </span>
        </div>
        <div className="h-3 rounded-full bg-white/10">
          <div className="h-full rounded-full bg-cyan-300" style={{ width: `${progress}%` }} />
        </div>
      </div>
      <div className="mt-5 grid gap-4 lg:grid-cols-[1.1fr_1fr]">
        <div className="rounded-md border border-white/10 bg-white/[0.04] p-4">
          <h3 className="font-black">Victoires prises en compte</h3>
          <div className="mt-3 grid gap-2">
            {(simulation?.victories ?? []).length ? (
              simulation!.victories.slice(0, 10).map((victory) => (
                <div
                  key={victory.id}
                  className={`grid gap-2 rounded-md px-3 py-2 text-sm md:grid-cols-[1fr_80px_90px] ${victory.retained ? "bg-emerald-300/12" : "bg-black/20 text-slate-400"}`}
                >
                  <span>
                    {competitionLabel(victory.competitionType)} · adversaire{" "}
                    {victory.opponentRanking}
                  </span>
                  <strong className={victory.retained ? "text-emerald-300" : ""}>
                    {victory.points} pts
                  </strong>
                  <span>{victory.retained ? "Retenue" : "Non retenue"}</span>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-400">Aucune victoire officielle enregistrée.</p>
            )}
          </div>
        </div>
        <div className="rounded-md border border-white/10 bg-white/[0.04] p-4">
          <h3 className="font-black">Derniers résultats</h3>
          <div className="mt-3 grid gap-2">
            {(simulation?.results ?? []).length ? (
              simulation!.results.map((result) => (
                <div
                  key={result.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-black/20 px-3 py-2 text-sm"
                >
                  <span>
                    {result.won ? "Victoire" : "Défaite"} vs {result.opponentRanking}
                  </span>
                  <span
                    className={
                      result.won ? "font-bold text-emerald-300" : "font-bold text-rose-300"
                    }
                  >
                    {competitionLabel(result.competitionType)}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-400">
                Les matchs officiels joués cette saison apparaîtront ici.
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function SeasonEntryDetails({
  competition,
  player,
  onClose
}: {
  competition: SeasonCompetition;
  player: Player;
  onClose: () => void;
}) {
  const [detailTab, setDetailTab] = useState<"summary" | "board">("summary");
  if (!competition.entry) return null;
  const title =
    competition.type === "individual" ? "Parcours du championnat" : "Tableau du tournoi";
  const entry = competition.entry;
  const nextRanking =
    entry.bracket.mode === "pyramide"
      ? entry.bracket.path?.[entry.currentRound]?.ranking
      : entry.bracket.opponents?.[entry.currentRound]?.ranking;
  const playedMatches = entry.matches.length;
  const wonMatches = entry.matches.filter((match) => match.won).length;
  const latestMatch = entry.matches.at(-1);
  return (
    <div className="game-modal-overlay">
      <div className="game-modal-panel panel max-w-6xl">
        <div className="game-modal-header">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-emerald-300">
              {competition.title}
            </p>
            <h2 className="text-2xl font-black">{title}</h2>
            <p className="mt-2 text-sm text-slate-300">
              Inscription payée : {formatCredits(entry.entryFee)} · Dotation :{" "}
              {formatCredits(entry.cashPrize)}
            </p>
          </div>
          <Button onClick={onClose} className="justify-center">
            <X size={16} /> Fermer
          </Button>
        </div>
        <div className="segmented-tabs mt-4">
          {[
            ["summary", "Résumé", entry.status.replaceAll("_", " ")],
            ["board", competition.type === "individual" ? "Parcours" : "Tableau", "Détail"]
          ].map(([value, label, meta]) => (
            <button
              className={detailTab === value ? "is-active" : ""}
              key={value}
              onClick={() => setDetailTab(value as "summary" | "board")}
              type="button"
            >
              <span>{label}</span>
              <small>{meta}</small>
            </button>
          ))}
        </div>
        {detailTab === "summary" ? (
          <section className="mt-4 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="rounded-md border border-white/10 bg-white/[0.04] p-4">
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-emerald-300">
                Situation
              </p>
              <h3 className="mt-1 text-2xl font-black">
                {entry.championTitle ?? entry.status.replaceAll("_", " ")}
              </h3>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <GameMiniMetric
                  label="Format"
                  value={competition.type === "individual" ? "Pyramide FFT" : "Tableau 16"}
                />
                <GameMiniMetric label="Matchs joués" value={`${playedMatches}`} />
                <GameMiniMetric label="Victoires" value={`${wonMatches}`} />
                <GameMiniMetric label="Prochain rang" value={nextRanking ?? "Terminé"} />
              </div>
            </div>
            <div className="rounded-md border border-cyan-300/20 bg-cyan-300/10 p-4">
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-cyan-200">
                Dernier événement
              </p>
              {latestMatch ? (
                <>
                  <h3 className="mt-1 text-xl font-black">
                    {latestMatch.won ? "Victoire" : "Défaite"} · {latestMatch.scoreText ?? "Score"}
                  </h3>
                  <p className="mt-2 text-sm text-slate-300">
                    {latestMatch.opponentName ?? "Adversaire"} ·{" "}
                    {latestMatch.opponentRanking ?? latestMatch.ranking}
                  </p>
                  <Link
                    className="mt-4 inline-flex items-center gap-2 rounded-md bg-emerald-300 px-3 py-2 text-sm font-black text-slate-950"
                    to={`/match/${latestMatch.matchId}`}
                  >
                    <Eye size={16} /> Voir le replay
                  </Link>
                </>
              ) : (
                <>
                  <h3 className="mt-1 text-xl font-black">Premier match à venir</h3>
                  <p className="mt-2 text-sm text-slate-300">
                    Le prochain adversaire sera généré selon la hiérarchie du classement.
                  </p>
                </>
              )}
            </div>
            <div className="lg:col-span-2">
              <Button className="w-full justify-center" onClick={() => setDetailTab("board")}>
                {competition.type === "individual" ? "Ouvrir le parcours" : "Ouvrir le tableau"}
              </Button>
            </div>
          </section>
        ) : null}
        {detailTab === "board" ? (
          competition.type === "individual" ? (
            <ChampionshipJourney entry={entry} />
          ) : (
            <TournamentBracket entry={entry} playerRanking={player.fftRanking} />
          )
        ) : null}
      </div>
    </div>
  );
}

function TournamentBracket({
  entry,
  playerRanking
}: {
  entry: SeasonEntry;
  playerRanking: string;
}) {
  const opponents = [...(entry.bracket.opponents ?? [])].sort(
    (a, b) => (a.seed ?? 99) - (b.seed ?? 99)
  );
  const slots = [
    { label: "Vous", ranking: playerRanking, self: true },
    ...opponents.map((opponent) => ({
      label: `T${opponent.seed ?? "?"}`,
      ranking: opponent.ranking,
      self: false
    }))
  ];
  const fallbackFirstRound = Array.from({ length: 8 }, (_, index) =>
    slots.slice(index * 2, index * 2 + 2)
  );
  const bracketRounds: TournamentBracketRound[] = entry.bracket.rounds ?? [
    {
      name: "Huitièmes",
      matches: fallbackFirstRound.map((pair) => ({
        left: pair[0]
          ? { label: pair[0].label, ranking: pair[0].ranking, isPlayer: pair[0].self }
          : null,
        right: pair[1]
          ? { label: pair[1].label, ranking: pair[1].ranking, isPlayer: pair[1].self }
          : null,
        winner: null
      }))
    },
    {
      name: "Quarts",
      matches: Array.from({ length: 4 }, () => ({ left: null, right: null, winner: null }))
    },
    {
      name: "Demi-finales",
      matches: Array.from({ length: 2 }, () => ({ left: null, right: null, winner: null }))
    },
    { name: "Finale", matches: [{ left: null, right: null, winner: null }] }
  ];
  const completed = entry.bracket.completedTournament;
  return (
    <div className="mt-5 rounded-md border border-white/10 bg-slate-950/35 p-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-black">Tableau du tournoi</h3>
        <span className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-300">
          {completed ? "Tournoi terminé" : "16 joueurs"}
        </span>
      </div>
      {completed ? (
        <div className="mt-3 rounded-md border border-emerald-300/25 bg-emerald-300/10 p-4">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-300">
            Vainqueur final
          </p>
          <div className="mt-1 text-2xl font-black">{completed.winnerName}</div>
          <div className="text-sm text-slate-300">Classement {completed.winnerRanking}</div>
        </div>
      ) : null}
      <div className="bracket-scroll mt-3 overflow-x-auto pb-1">
        <div className="bracket-grid grid min-w-[980px] grid-cols-[1.4fr_1fr_1fr_1fr_1fr] gap-3">
          <div>
            <BracketColumnTitle label="Branches" />
            <div className="grid gap-2">
              {bracketRounds[0]?.matches.map((match, index) => {
                const pair = [match.left, match.right];
                return (
                  <div
                    key={index}
                    className="bracket-card rounded-md border border-white/10 bg-white/[0.04] p-2"
                  >
                    <div className="mb-1 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">
                      Branche {index + 1}
                    </div>
                    {pair.map((slot) => (
                      <div
                        key={`${slot?.label ?? "empty"}-${slot?.ranking ?? index}`}
                        className={`flex items-center justify-between rounded px-2 py-1 text-sm ${
                          slot?.isPlayer
                            ? "bg-emerald-300 text-slate-950"
                            : match.winner?.label === slot?.label
                              ? "bg-emerald-300/15 font-bold text-emerald-200"
                              : "bg-black/25 text-slate-200"
                        }`}
                      >
                        <span className="font-bold">{slot?.label}</span>
                        <span>{slot?.ranking}</span>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
          {bracketRounds.map((round, index) => {
            return (
              <div key={round.name}>
                <BracketColumnTitle label={round.name} />
                <div className="grid gap-2">
                  {round.matches.map((match, matchIndex) => {
                    const active =
                      entry.currentRound === index &&
                      Boolean(match.left?.isPlayer || match.right?.isPlayer) &&
                      !match.winner &&
                      !["ELIMINE", "VAINQUEUR"].includes(entry.status);
                    return (
                      <div
                        key={`${round.name}-${matchIndex}`}
                        className={`bracket-card rounded-md border p-3 text-sm ${
                          active
                            ? "border-cyan-300 bg-cyan-300/10"
                            : match.winner
                              ? "border-emerald-300/25 bg-emerald-300/10"
                              : "border-white/10 bg-white/[0.04]"
                        }`}
                      >
                        {[match.left, match.right].map((side, sideIndex) => (
                          <div
                            key={`${sideIndex}-${side?.label ?? "empty"}`}
                            className={`flex items-center justify-between rounded px-2 py-1 ${
                              side
                                ? match.winner?.label === side.label
                                  ? "font-black text-emerald-300"
                                  : side.isPlayer
                                    ? "bg-emerald-300 text-slate-950"
                                    : "text-slate-300"
                                : "text-slate-600"
                            }`}
                          >
                            <span>{side?.label ?? "À déterminer"}</span>
                            <span>{side?.ranking ?? "-"}</span>
                          </div>
                        ))}
                        <div className="mt-2 text-xs text-slate-300">
                          {match.winner
                            ? `Vainqueur : ${match.winner.label} · ${match.scoreText ?? "Score simulé"}`
                            : active
                              ? "Prochain match"
                              : "En attente des gagnants"}
                        </div>
                        {match.replayMatchId ? (
                          <Link
                            className="mt-2 inline-block text-xs font-bold text-emerald-300"
                            to={`/match/${match.replayMatchId}`}
                          >
                            Voir le replay
                          </Link>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {completed ? (
        <div className="mt-5 rounded-md bg-black/20 p-3">
          <h4 className="font-black">Résultats complets du tableau</h4>
          <div className="mt-3 grid gap-4 lg:grid-cols-4">
            {completed.rounds.map((round) => (
              <div key={round.name}>
                <BracketColumnTitle label={round.name} />
                <div className="grid gap-2">
                  {round.matches.map((match, index) => (
                    <div
                      key={`${round.name}-${index}`}
                      className={`bracket-card rounded-md border p-3 text-sm ${match.playedByPlayer ? "border-cyan-300 bg-cyan-300/10" : "border-white/10 bg-white/[0.04]"}`}
                    >
                      <div className="grid gap-1">
                        <div
                          className={
                            match.winnerLabel === match.leftLabel
                              ? "font-black text-emerald-300"
                              : "text-slate-300"
                          }
                        >
                          {match.leftLabel}{" "}
                          <span className="text-xs text-slate-400">({match.leftRanking})</span>
                        </div>
                        <div
                          className={
                            match.winnerLabel === match.rightLabel
                              ? "font-black text-emerald-300"
                              : "text-slate-300"
                          }
                        >
                          {match.rightLabel}{" "}
                          <span className="text-xs text-slate-400">({match.rightRanking})</span>
                        </div>
                      </div>
                      <div className="mt-2 border-t border-white/10 pt-2 text-xs text-slate-300">
                        Vainqueur :{" "}
                        <strong className="text-emerald-300">{match.winnerLabel}</strong> ·{" "}
                        {match.scoreText}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ChampionshipJourney({ entry }: { entry: SeasonEntry }) {
  const path = entry.bracket.path ?? [];
  return (
    <div className="mt-5 rounded-md border border-white/10 bg-slate-950/35 p-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-black">Parcours du championnat</h3>
        <span className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-300">
          Saison en cours
        </span>
      </div>
      <div className="mt-3 grid gap-2">
        {path.map((step, index) => {
          const match = entry.matches[index];
          const isNext =
            index === entry.currentRound &&
            !["ELIMINE", "CHAMPION_NATIONAL"].includes(entry.status);
          return (
            <div
              key={`${step.ranking}-${index}`}
              className={`grid gap-2 rounded-md border p-3 text-sm md:grid-cols-[92px_1fr_110px] ${isNext ? "border-cyan-300 bg-cyan-300/10" : "border-white/10 bg-white/[0.04]"}`}
            >
              <strong className="text-lg">{step.ranking}</strong>
              <div>
                <div className="font-bold">{step.label ?? `Tour ${index + 1}`}</div>
                {match ? (
                  <div className="text-slate-300">
                    {match.opponentName ?? "Adversaire"} · {match.scoreText ?? "score enregistré"}
                  </div>
                ) : (
                  <div className="text-slate-400">
                    {isNext ? "Prochain adversaire à jouer" : "À venir si le parcours continue"}
                  </div>
                )}
              </div>
              <div
                className={
                  match?.won
                    ? "text-emerald-300"
                    : match
                      ? "text-rose-300"
                      : isNext
                        ? "text-cyan-200"
                        : "text-slate-400"
                }
              >
                {match ? (match.won ? "Victoire" : "Défaite") : isNext ? "Prochain" : "En attente"}
                {match ? (
                  <Link
                    className="block text-xs font-bold text-emerald-300"
                    to={`/match/${match.matchId}`}
                  >
                    Replay
                  </Link>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
      {entry.matches.length ? (
        <div className="mt-4 rounded-md bg-black/20 p-3">
          <h4 className="text-sm font-black">Historique temps réel</h4>
          <div className="mt-2 grid gap-2">
            {entry.matches.map((match, index) => (
              <div
                key={match.matchId}
                className="flex flex-wrap items-center justify-between gap-2 rounded bg-white/[0.04] px-3 py-2 text-sm"
              >
                <span>
                  Tour {index + 1} · {match.opponentName ?? "Adversaire"} (
                  {match.opponentRanking ?? match.ranking})
                </span>
                <span
                  className={match.won ? "font-bold text-emerald-300" : "font-bold text-rose-300"}
                >
                  {match.won ? "Gagné" : "Perdu"} · {match.scoreText ?? "score"}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function BracketColumnTitle({ label }: { label: string }) {
  return (
    <div className="mb-2 text-xs font-black uppercase tracking-[0.14em] text-slate-400">
      {label}
    </div>
  );
}

function DailyRewardIcon({ reward }: { reward: SeasonDailyReward }) {
  if (reward.type === "money") return <Coins aria-label="Crédits" size={20} />;
  if (reward.type === "gems") return <Gem size={19} />;
  return <PackageOpen size={19} />;
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
        <Button
          className={`min-h-12 px-5 ${claimable ? "season-reward-claim" : ""}`}
          disabled={!claimable || busy}
          onClick={onClaim}
        >
          <Gift size={18} /> {claimable ? "Récupérer" : "Déjà récupérée"}
        </Button>
      </div>
      <div className="season-reward-timeline mt-5">
        {rewards.map((reward) => (
          <div
            key={reward.day}
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

function SeasonPage() {
  const [data, setData] = useState<SeasonData | null>(null);
  const [message, setMessage] = useState("");
  const [seasonTab, setSeasonTab] = useState<SeasonCompetition["type"]>("daily");
  const [selectedCompetition, setSelectedCompetition] = useState<SeasonCompetition | null>(null);
  const [dailyRewardOpening, setDailyRewardOpening] = useState<{
    rewards: ChestRewards;
    rarity: ChestRarity;
  } | null>(null);
  const [claimingReward, setClaimingReward] = useState(false);
  const refresh = useGameStore((state) => state.refresh);
  const navigate = useNavigate();
  const pageVisible = usePageVisible();
  async function load() {
    setData(await api<SeasonData>("/season"));
  }
  useEffect(() => {
    void load();
    if (!pageVisible) return;
    const timer = window.setInterval(() => void load(), 60_000);
    return () => window.clearInterval(timer);
  }, [pageVisible]);
  async function register(type: SeasonCompetition["type"]) {
    setMessage("");
    try {
      await api(`/season/${type}/register`, { method: "POST" });
      setMessage("Inscription validée. L'énergie a été débitée côté serveur.");
      await Promise.all([load(), refresh()]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Inscription impossible.");
    }
  }
  async function play(entryId: string) {
    setMessage("");
    try {
      const result = await api<{ match: MatchListItem }>(`/season/entries/${entryId}/play`, {
        method: "POST"
      });
      navigate(`/match/${result.match.id}`);
      void refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Match impossible.");
    }
  }
  async function claimDailyReward() {
    setMessage("");
    setClaimingReward(true);
    try {
      const result = await api<{ dailyReward: SeasonDailyReward; rewards: ChestRewards }>(
        "/season/rewards/daily/claim",
        { method: "POST" }
      );
      setDailyRewardOpening({
        rewards: result.rewards,
        rarity:
          result.dailyReward.type === "chest" ? (result.dailyReward.rarity ?? "Bronze") : "Bronze"
      });
      await Promise.all([load(), refresh()]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Récompense impossible.");
    } finally {
      setClaimingReward(false);
    }
  }
  if (!data) return <section className="panel p-5">Chargement de la saison...</section>;
  const activeCompetition =
    data.competitions.find((competition) => competition.type === seasonTab) ?? data.competitions[0];
  return (
    <div className="grid gap-4">
      <section className="panel p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-emerald-300">
              Saison en cours
            </p>
            <h1 className="text-3xl font-black">
              Jour {data.season.day} · Semaine {data.season.week}
            </h1>
            <p className="mt-1 text-sm text-slate-300">
              Saison de 30 jours réels · fin le{" "}
              {new Date(data.season.endsAt).toLocaleDateString("fr-FR")} ·{" "}
              <Countdown endAt={data.season.endsAt} doneLabel="Nouvelle saison disponible" />
            </p>
          </div>
          <div className="min-w-[220px]">
            <div className="mb-2 flex justify-between text-sm text-slate-300">
              <span>Progression</span>
              <strong>{data.season.progress}%</strong>
            </div>
            <div className="h-3 rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-emerald-300"
                style={{ width: `${data.season.progress}%` }}
              />
            </div>
          </div>
        </div>
      </section>
      <SeasonDailyRewardsTimeline
        rewards={data.dailyRewards}
        busy={claimingReward}
        onClaim={() => void claimDailyReward()}
      />
      {message ? <div className="panel p-4 text-sm text-emerald-100">{message}</div> : null}
      <div className="segmented-tabs">
        {data.competitions.map((competition) => (
          <button
            className={seasonTab === competition.type ? "is-active" : ""}
            key={competition.type}
            onClick={() => setSeasonTab(competition.type)}
            type="button"
          >
            <span>
              {competition.type === "daily"
                ? "Journalier"
                : competition.type === "weekly"
                  ? "Hebdomadaire"
                  : "Championnat"}
            </span>
            <small>{competition.entry ? "Inscrit" : `${competition.energyCost} énergie`}</small>
          </button>
        ))}
      </div>
      <section className="grid gap-4">
        {activeCompetition
          ? [activeCompetition].map((competition) => {
              const entry = competition.entry;
              const nextRanking =
                entry?.bracket.mode === "pyramide"
                  ? entry.bracket.path?.[entry.currentRound]?.ranking
                  : entry?.bracket.opponents?.[entry.currentRound]?.ranking;
              const statusLabel = entry
                ? (entry.championTitle ?? entry.status.replaceAll("_", " "))
                : "Non inscrit";
              const nextAt = competition.nextPlayableAt
                ? new Date(competition.nextPlayableAt)
                : null;
              const periodEnd = new Date(competition.currentPeriodEndsAt);
              const entryFee = entry?.entryFee ?? competition.entryFee;
              const cashPrize = entry?.cashPrize ?? competition.cashPrize;
              const availabilityLabel = entry
                ? competition.type === "individual"
                  ? "Prochain championnat"
                  : "Prochaine inscription"
                : "Disponibilité";
              return (
                <article key={competition.type} className="season-card panel p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-xl font-black">{competition.title}</h2>
                      <p className="text-sm text-emerald-300">
                        {competition.frequency} · {competition.energyCost} énergie
                      </p>
                    </div>
                    <div className="rounded-md bg-white/[0.08] px-3 py-2 text-center">
                      <div className="text-[10px] uppercase tracking-[0.16em] text-slate-400">
                        Prix
                      </div>
                      <div className="text-lg font-black">{formatCredits(entryFee)}</div>
                    </div>
                  </div>
                  <p className="mt-3 line-clamp-2 text-sm text-slate-300">{competition.subtitle}</p>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <GameMiniMetric
                      label="Format"
                      value={competition.type === "individual" ? "Pyramide" : "Tableau 16"}
                    />
                    <GameMiniMetric label="Statut" value={statusLabel} />
                    <GameMiniMetric label="Zone haute" value={competition.rankingRange.best} />
                    <GameMiniMetric label="Dotation" value={formatCredits(cashPrize)} />
                  </div>
                  <div className="mt-4 rounded-md border border-cyan-300/15 bg-cyan-300/10 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-200">
                          {availabilityLabel}
                        </p>
                        <p className="mt-1 text-sm text-slate-200">
                          {entry && nextAt ? (
                            <>
                              <Countdown
                                endAt={competition.nextPlayableAt}
                                doneLabel="Jouable maintenant"
                              />{" "}
                              · {nextAt.toLocaleDateString("fr-FR")} à{" "}
                              {nextAt.toLocaleTimeString("fr-FR", {
                                hour: "2-digit",
                                minute: "2-digit"
                              })}
                            </>
                          ) : (
                            <>
                              Jouable maintenant · période active jusqu'à{" "}
                              {periodEnd.toLocaleTimeString("fr-FR", {
                                hour: "2-digit",
                                minute: "2-digit"
                              })}
                            </>
                          )}
                        </p>
                      </div>
                      <CalendarDays size={18} className="mt-1 text-cyan-200" />
                    </div>
                  </div>
                  <div className="mt-4 rounded-md bg-white/5 p-3 text-sm text-slate-300">
                    {nextRanking
                      ? `Prochain adversaire estimé : ${nextRanking}. La difficulté suit son classement FFT et ses statistiques.`
                      : "Inscription disponible selon la période."}
                  </div>
                  {!entry ? (
                    <Button className="mt-4 w-full" onClick={() => register(competition.type)}>
                      S'inscrire
                    </Button>
                  ) : (
                    <Button
                      className="mt-4 w-full"
                      disabled={["ELIMINE", "VAINQUEUR", "CHAMPION_NATIONAL"].includes(
                        entry.status
                      )}
                      onClick={() => play(entry.id)}
                    >
                      Jouer le prochain match
                    </Button>
                  )}
                  {entry ? (
                    <Button
                      className="mt-3 w-full border border-cyan-300 bg-cyan-300 text-slate-950 shadow-[0_0_18px_rgba(103,232,249,0.28)] hover:bg-cyan-200"
                      onClick={() => setSelectedCompetition(competition)}
                    >
                      <Eye size={16} />{" "}
                      {competition.type === "individual" ? "Voir le parcours" : "Voir le tableau"}
                    </Button>
                  ) : null}
                </article>
              );
            })
          : null}
      </section>
      {selectedCompetition ? (
        <SeasonEntryDetails
          competition={selectedCompetition}
          player={data.player}
          onClose={() => setSelectedCompetition(null)}
        />
      ) : null}
      {dailyRewardOpening ? (
        <RewardModal
          rewards={dailyRewardOpening.rewards}
          rarity={dailyRewardOpening.rarity}
          eyebrow="Récompense quotidienne"
          onClose={() => setDailyRewardOpening(null)}
        />
      ) : null}
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function TournamentsPage() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [message, setMessage] = useState("");
  useEffect(() => void api<Tournament[]>("/tournaments").then(setTournaments), []);
  async function register(tournamentId: string) {
    setMessage("");
    try {
      await api(`/tournaments/${tournamentId}/register`, { method: "POST" });
      setMessage("Inscription validée. Rappel : un seul tournoi par jour réel.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Inscription impossible.");
    }
  }
  return (
    <div className="grid gap-4">
      {message ? <div className="panel p-4 text-sm text-emerald-100">{message}</div> : null}
      <section className="grid gap-4 lg:grid-cols-3">
        {tournaments.map((tournament) => (
          <article key={tournament.id} className="panel p-5">
            <h2 className="text-xl font-black">{tournament.name}</h2>
            <p className="text-emerald-300">
              {tournament.kind} · {tournament.location} · {tournament.surface}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Metric label="Catégorie" value={tournament.category} />
              <Metric label="Points" value={tournament.points} />
              <Metric label="Dotation" value={formatCredits(tournament.prize)} />
              <Metric label="Niveau" value={tournament.recommendedLevel} />
            </div>
            <div className="mt-4 rounded-md bg-white/5 p-3 text-sm text-slate-300">
              Matchs planifiés entre 8h et 21h. Prochain créneau :{" "}
              {tournament.schedule[0]
                ? `${new Date(tournament.schedule[0].startsAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })} · ${tournament.schedule[0].court}`
                : "à confirmer"}
            </div>
            <Button className="mt-4 w-full" onClick={() => register(tournament.id)}>
              S'inscrire
            </Button>
          </article>
        ))}
      </section>
    </div>
  );
}
function RankingsPage() {
  const [players, setPlayers] = useState<RankedPlayer[]>([]);
  useEffect(() => void api<RankedPlayer[]>("/rankings").then(setPlayers), []);
  const podium = players.slice(0, 3);
  return (
    <div className="grid gap-4">
      <section className="panel p-4 sm:p-5">
        <p className="text-sm font-bold uppercase tracking-[0.22em] text-emerald-300">Classement</p>
        <h1 className="mt-1 text-2xl font-black">Top mondial MyPro</h1>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {podium.map((player) => (
            <Link className="ranking-podium-card" key={player.id} to={`/profile/${player.id}`}>
              <div className="ranking-rank">#{player.rank}</div>
              <ProfilePicture avatar={player.avatar} size="sm" />
              <div className="min-w-0">
                <h2>{player.name}</h2>
                <p>
                  {nationalityLabel(player.nationality)} · Niveau {player.overall}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>
      <section className="ranking-list">
        {players.map((player) => (
          <Link className="ranking-row-card" key={player.id} to={`/profile/${player.id}`}>
            <div className="ranking-row-rank">{player.rank}</div>
            <ProfilePicture avatar={player.avatar} size="sm" />
            <div className="min-w-0 flex-1">
              <h2>{player.name}</h2>
              <p>{nationalityLabel(player.nationality)}</p>
            </div>
            <GameMiniMetric label="Niveau" value={player.overall} />
            <GameMiniMetric label="Points" value={player.rankingPoints} />
            <GameMiniMetric label="Bilan" value={`${player.wins}V/${player.losses}D`} />
          </Link>
        ))}
      </section>
    </div>
  );
}

function MatchStartPage() {
  const [pool, setPool] = useState<DuelPool | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [matchMode, setMatchMode] = useState<"coach" | "auto" | "quick">("coach");
  const [pendingOpponent, setPendingOpponent] = useState<Player | null>(null);
  const [duelTab, setDuelTab] = useState<"pool" | "friends">("pool");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Player[]>([]);
  const [searching, setSearching] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const navigate = useNavigate();
  const refresh = useGameStore((state) => state.refresh);
  async function loadPool() {
    const [nextPool, activeSession] = await Promise.all([
      api<DuelPool>("/matches/duel-pool"),
      api<{ id: string } | null>("/matches/interactive/active")
    ]);
    setPool(nextPool);
    setActiveSessionId(activeSession?.id ?? null);
  }
  useEffect(() => void loadPool(), []);
  async function start(opponentId: string, selectedMode: "coach" | "auto" | "quick") {
    setMessage("");
    if (
      selectedMode === "coach" &&
      localStorage.getItem("mypro-coach-deck-tutorial-done") !== "1"
    ) {
      setPendingOpponent(null);
      navigate("/coach-deck/tutorial");
      return;
    }
    setLoadingId(opponentId);
    try {
      const endpoint = selectedMode === "coach" ? "/matches/interactive" : "/matches/quick";
      let coachDeckId: string | undefined;
      if (selectedMode === "coach") {
        const coachDeck = await api<{ activeDeckId: string | null }>("/coach-decks");
        if (!coachDeck.activeDeckId) {
          throw new Error("Aucun Coach Deck actif. Ouvrez votre collection puis réessayez.");
        }
        coachDeckId = coachDeck.activeDeckId;
      }
      const match = await api<{ id: string }>(endpoint, {
        method: "POST",
        body: JSON.stringify({ opponentId, format: "Deux sets gagnants", coachDeckId })
      });
      if (selectedMode === "coach") {
        navigate(`/match-live/${match.id}`);
      } else {
        navigate(`/match/${match.id}${selectedMode === "quick" ? "?result=1" : ""}`);
      }
      void refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Duel impossible.");
      setLoadingId(null);
      await loadPool();
    }
  }
  async function searchOpponents(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = searchQuery.trim();
    if (query.length < 2) {
      setSearchResults([]);
      setMessage("Saisissez au moins 2 caractères pour chercher un joueur.");
      return;
    }
    setMessage("");
    setSearching(true);
    try {
      const data = await api<DuelSearch>(`/matches/duel-search?q=${encodeURIComponent(query)}`);
      setSearchResults(data.results);
      if (data.results.length === 0) {
        setMessage(
          `Aucun joueur réel trouvé dans votre zone de classement : ${data.allowedRankings.join(
            " / "
          )}.`
        );
      }
    } catch (error) {
      setSearchResults([]);
      setMessage(error instanceof Error ? error.message : "Recherche impossible.");
    } finally {
      setSearching(false);
    }
  }
  function opponentCard(opponent: Player, sourceLabel: string) {
    const opponentTopStats = profileStatKeys
      .map((key) => ({ key, value: stat(opponent, key) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 3);
    return (
      <article key={`${sourceLabel}-${opponent.id}`} className="duel-card panel p-4">
        <div className="flex items-center gap-4">
          <ProfilePicture avatar={opponent.avatar} />
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
              {sourceLabel}
            </div>
            <h2 className="truncate text-xl font-black">
              {opponent.firstName} {opponent.lastName}
            </h2>
            <p className="text-sm text-emerald-300">
              {nationalityLabel(opponent.nationality)} · {opponent.fftRanking}
            </p>
          </div>
          <div className="rounded-md bg-white/[0.08] px-3 py-2 text-center">
            <div className="text-[10px] uppercase tracking-[0.16em] text-slate-400">Niv.</div>
            <div className="text-xl font-black">{opponent.overall}</div>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <GameMiniMetric label="Classement" value={opponent.fftRanking} />
          <GameMiniMetric label="V" value={opponent.wins} />
          <GameMiniMetric label="D" value={opponent.losses} />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {opponentTopStats.map((item) => (
            <span key={item.key} className="stat-bonus-pill">
              <StatIcon statKey={item.key} size="sm" />
              <span>{statLabels[item.key]}</span>
              <strong>{Math.round(item.value)}</strong>
            </span>
          ))}
        </div>
        <Button
          disabled={loadingId !== null || activeSessionId !== null}
          onClick={() => {
            setMatchMode("coach");
            setPendingOpponent(opponent);
          }}
          className="mt-5 w-full"
        >
          <Play size={17} />
          {loadingId === opponent.id ? "Duel en cours..." : "Affronter"}
        </Button>
      </article>
    );
  }
  return (
    <div className="grid gap-4">
      <section className="panel p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-emerald-300">Duel</p>
            <h1 className="text-2xl font-black">Choisissez votre adversaire</h1>
            <p className="mt-2 text-sm text-slate-300">
              Trois profils réels ou IA sont proposés dans votre zone de classement :{" "}
              {pool?.allowedRankings.join(" / ") ?? "..."}. Après chaque duel, un nouveau pool de
              trois profils sera généré.
            </p>
            <p className="mt-2 text-sm text-slate-400">
              Un joueur réel ne peut pas être affronté plus de 2 fois par jour en duel.
            </p>
          </div>
          <Button className="bg-white/10 text-slate-100 hover:bg-white/15" onClick={loadPool}>
            Rafraîchir
          </Button>
        </div>
        <div className="segmented-tabs mt-4">
          {[
            ["pool", "Pool automatique", "3 choix"],
            ["friends", "Match entre amis", "Recherche"]
          ].map(([value, label, meta]) => (
            <button
              className={duelTab === value ? "is-active" : ""}
              key={value}
              onClick={() => setDuelTab(value as "pool" | "friends")}
              type="button"
            >
              <span>{label}</span>
              <small>{meta}</small>
            </button>
          ))}
        </div>
      </section>
      {activeSessionId ? (
        <section className="panel flex flex-wrap items-center justify-between gap-4 border-emerald-300/35 p-4">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.16em] text-emerald-300">
              Match en cours
            </p>
            <p className="mt-1 text-sm text-slate-300">
              Votre progression est sauvegardée. Terminez ce match avant de choisir un nouvel
              adversaire.
            </p>
          </div>
          <Button onClick={() => navigate(`/match-live/${activeSessionId}`)}>
            <Play size={17} /> Reprendre le match
          </Button>
        </section>
      ) : null}
      {message ? <div className="panel p-4 text-sm text-amber-100">{message}</div> : null}
      {duelTab === "friends" ? (
        <>
          <section className="panel p-4 sm:p-5">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-emerald-300">
                Match entre amis
              </p>
              <h2 className="text-2xl font-black">Chercher un joueur réel</h2>
              <p className="mt-2 text-sm text-slate-300">
                Recherchez un ami par prénom ou nom. Seuls les joueurs dans votre zone de classement
                peuvent être défiés.
              </p>
            </div>
            <form className="mt-4 flex flex-col gap-3 sm:flex-row" onSubmit={searchOpponents}>
              <Field
                className="flex-1"
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Prénom, nom ou classement"
                value={searchQuery}
              />
              <Button disabled={searching} type="submit">
                <Search size={17} /> {searching ? "Recherche..." : "Rechercher"}
              </Button>
            </form>
          </section>
          {searchResults.length > 0 ? (
            <section className="grid gap-4 lg:grid-cols-3">
              {searchResults.map((opponent) => opponentCard(opponent, "Joueur réel"))}
            </section>
          ) : null}
        </>
      ) : (
        <>
          <div className="flex items-center justify-between gap-3">
            <p className="mb-3 text-sm font-bold uppercase tracking-[0.18em] text-slate-400">
              Pool automatique
            </p>
            <span className="mb-3 rounded-md bg-white/10 px-2 py-1 text-xs font-bold text-slate-300">
              Un joueur réel disparaît après 2 duels/jour
            </span>
          </div>
          <section className="grid gap-4 lg:grid-cols-3">
            {(pool?.opponents ?? []).map((opponent) =>
              opponentCard(opponent, opponent.isAi ? "Profil IA" : "Joueur réel")
            )}
          </section>
          {!pool ? (
            <section className="panel p-5 text-sm text-slate-300">
              Chargement des adversaires...
            </section>
          ) : null}
        </>
      )}
      {pendingOpponent ? (
        <div className="duel-launch-overlay" onClick={() => setPendingOpponent(null)}>
          <section className="duel-launch-panel" onClick={(event) => event.stopPropagation()}>
            <header>
              <div className="duel-launch-opponent">
                <ProfilePicture avatar={pendingOpponent.avatar} size="sm" />
                <span>
                  <small>Adversaire sélectionné</small>
                  <strong>
                    {pendingOpponent.firstName} {pendingOpponent.lastName}
                  </strong>
                  <em>
                    {pendingOpponent.fftRanking} · Niveau {pendingOpponent.overall}
                  </em>
                </span>
              </div>
              <button aria-label="Fermer" onClick={() => setPendingOpponent(null)} type="button">
                <X size={18} />
              </button>
            </header>
            <div className="duel-launch-title">
              <p>Choisissez votre expérience</p>
              <h2>Comment voulez-vous jouer ce match ?</h2>
            </div>
            <div className="duel-launch-modes">
              {[
                {
                  id: "coach",
                  label: "Coach Deck",
                  duration: "5 à 8 min",
                  meta: "Lisez l’intention adverse, jouez vos cartes et gérez votre Focus aux moments clés.",
                  badge: "Recommandé",
                  Icon: Target
                },
                {
                  id: "auto",
                  label: "Automatique",
                  duration: "1 à 2 min",
                  meta: "Le match est calculé et vous regardez le replay point par point.",
                  badge: "Spectateur",
                  Icon: Play
                },
                {
                  id: "quick",
                  label: "Résultat rapide",
                  duration: "Immédiat",
                  meta: "Le calcul est instantané et vous arrivez directement au score final.",
                  badge: "Express",
                  Icon: FastForward
                }
              ].map(({ id, label, duration, meta, badge, Icon }) => (
                <button
                  className={matchMode === id ? "is-active" : ""}
                  key={id}
                  onClick={() => setMatchMode(id as "coach" | "auto" | "quick")}
                  type="button"
                >
                  <span className="duel-launch-mode-icon">
                    <Icon size={23} />
                  </span>
                  <span className="duel-launch-mode-copy">
                    <small>{badge}</small>
                    <strong>{label}</strong>
                    <em>{duration}</em>
                    <span>{meta}</span>
                  </span>
                  <span className="duel-launch-radio" />
                </button>
              ))}
            </div>
            {matchMode === "coach" ? (
              <section className="duel-coach-tutorial-notice">
                <HelpCircle size={19} />
                <span>
                  <strong>
                    {localStorage.getItem("mypro-coach-deck-tutorial-done") === "1"
                      ? "Tutoriel Coach Deck terminé"
                      : "Tutoriel requis avant votre premier match Coach Deck"}
                  </strong>
                  <small>
                    Trois décisions guidées pour lire une intention, relier les statistiques et
                    gérer le Focus.
                  </small>
                </span>
                <button onClick={() => navigate("/coach-deck/tutorial")} type="button">
                  {localStorage.getItem("mypro-coach-deck-tutorial-done") === "1"
                    ? "Rejouer"
                    : "Commencer"}
                </button>
              </section>
            ) : null}
            <footer>
              <button
                className="duel-launch-cancel"
                onClick={() => setPendingOpponent(null)}
                type="button"
              >
                Annuler
              </button>
              <Button
                className="duel-launch-confirm"
                disabled={loadingId !== null}
                onClick={() => void start(pendingOpponent.id, matchMode)}
              >
                <Play size={18} />
                {loadingId ? "Préparation..." : "Lancer ce match"}
              </Button>
            </footer>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function MatchReplayPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const instantResult = searchParams.get("result") === "1";
  const player = useGameStore((state) => state.player);
  const [match, setMatch] = useState<MatchReplay | null>(null);
  const [replayTab, setReplayTab] = useState<"live" | "calc" | "feed">("live");
  const [index, setIndex] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [playing, setPlaying] = useState(true);
  const [resultDismissed, setResultDismissed] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(
    () => localStorage.getItem("mypro-match-sound") === "1"
  );
  const pageVisible = usePageVisible();
  useEffect(() => {
    setIndex(0);
    setReplayTab("live");
    setPlaying(!instantResult);
    setResultDismissed(false);
    void api<MatchReplay>(`/matches/${id}`).then((payload) => {
      setMatch(payload);
      if (instantResult) setIndex(Math.max(0, payload.replay.events.length - 1));
    });
  }, [id, instantResult]);
  const events = match?.replay?.events ?? [];
  const event = events[Math.min(index, events.length - 1)];
  useEffect(() => {
    if (!soundEnabled || !event || instantResult) return;
    playMatchSound(event.winnerId === player?.id ? "positive" : "negative");
  }, [event, instantResult, player?.id, soundEnabled]);
  useEffect(() => {
    if (!playing || !events.length || !pageVisible) return;
    const timer = window.setInterval(
      () => setIndex((current) => Math.min(events.length - 1, current + 1)),
      1000 / speed
    );
    return () => window.clearInterval(timer);
  }, [playing, speed, events.length, pageVisible]);
  const finalReached = events.length > 0 && index >= events.length - 1;
  useEffect(() => {
    if (finalReached) setPlaying(false);
  }, [finalReached]);
  if (!match || !event) return <div className="panel p-5">Chargement du replay...</div>;

  const a = match.playerA;
  const b = match.playerB;
  const progress = events.length > 1 ? Math.round((index / (events.length - 1)) * 100) : 100;
  const userWon = player ? match.winnerId === player.id : match.winnerId === a.id;
  const pointWinner = event.winnerId === a.id ? a : b;
  const statKey = event.statKey ?? "service";
  const statLabel = pointStatLabel(event);
  const rawValues =
    event.rawStatValues ?? ([stat(a, statKey), stat(b, statKey)] as [number, number]);
  const statValues = event.statValues ?? rawValues;
  const energyBonus: [number, number] = [
    Math.max(0, statValues[0] - rawValues[0]),
    Math.max(0, statValues[1] - rawValues[1])
  ];
  const pointComment = cleanPointComment(event, a, b);
  const speedOptions = [1, 2, 4];

  return (
    <div className="grid gap-5">
      <section className="panel p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-emerald-300">
              Replay du match
            </p>
            <h1 className="text-2xl font-black">
              {a.firstName} {a.lastName} vs {b.firstName} {b.lastName}
            </h1>
            <p className="mt-1 text-sm text-slate-300">
              {match.surface} · {match.type} · Score final {match.scoreText}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              aria-label={soundEnabled ? "Couper le son" : "Activer le son"}
              className="bg-white/10 text-slate-100 hover:bg-white/15"
              onClick={() => {
                const enabled = !soundEnabled;
                setSoundEnabled(enabled);
                localStorage.setItem("mypro-match-sound", enabled ? "1" : "0");
                if (enabled) playMatchSound("confirm");
              }}
            >
              {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
              {soundEnabled ? "Son" : "Muet"}
            </Button>
            <Button onClick={() => setPlaying(!playing)}>
              {playing ? <Pause size={16} /> : <Play size={16} />} {playing ? "Pause" : "Lecture"}
            </Button>
            {speedOptions.map((option) => (
              <Button
                key={option}
                onClick={() => setSpeed(option)}
                className={
                  speed === option
                    ? "bg-cyan-300 text-slate-950 hover:bg-cyan-200"
                    : "bg-white/10 text-slate-100 hover:bg-white/15"
                }
              >
                <FastForward size={16} /> x{option}
              </Button>
            ))}
            <Button
              onClick={() => setIndex(events.length - 1)}
              className="bg-white/10 text-slate-100 hover:bg-white/15"
            >
              <SkipForward size={16} /> Résultat
            </Button>
          </div>
        </div>
        <div className="mt-5 h-2 rounded-full bg-white/10">
          <div className="h-full rounded-full bg-emerald-300" style={{ width: `${progress}%` }} />
        </div>
        <div className="segmented-tabs mt-4">
          {[
            ["live", "Match", `Point ${index + 1}`],
            ["calc", "Calcul", statLabel],
            ["feed", "Fil", `${Math.min(index + 1, events.length)} pts`]
          ].map(([value, label, meta]) => (
            <button
              className={replayTab === value ? "is-active" : ""}
              key={value}
              onClick={() => setReplayTab(value as "live" | "calc" | "feed")}
              type="button"
            >
              <span>{label}</span>
              <small>{meta}</small>
            </button>
          ))}
        </div>
      </section>

      {replayTab === "live" ? (
        <section className="grid gap-5 xl:grid-cols-[1fr_340px_1fr]">
          <SimpleMatchPlayerCard player={a} side="left" active={event.winnerId === a.id} compact />
          <div className="match-center-panel panel grid content-between gap-4 p-4 text-center">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                Point {index + 1}/{events.length}
              </p>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <Metric label="Sets" value={`${event.score.sets[0]} - ${event.score.sets[1]}`} />
                <Metric label="Jeux" value={`${event.score.games[0]} - ${event.score.games[1]}`} />
                <Metric
                  label="Points"
                  value={`${event.score.points[0]} - ${event.score.points[1]}`}
                />
              </div>
            </div>
            <div className="rounded-md border border-cyan-300/20 bg-cyan-300/10 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-200">
                Statistique du point
              </p>
              <div className="mt-3 flex flex-col items-center gap-2">
                <StatIcon statKey={statKey} size="lg" />
                <h2 className="text-3xl font-black">{statLabel}</h2>
              </div>
              <p className="mt-3 text-sm text-slate-300">{pointComment}</p>
            </div>
            <div>
              <p className="text-sm text-slate-300">Point remporté par</p>
              <div className="mt-2 rounded-md bg-emerald-300 px-4 py-3 text-xl font-black text-slate-950">
                {pointWinner.firstName} {pointWinner.lastName}
              </div>
            </div>
          </div>
          <SimpleMatchPlayerCard player={b} side="right" active={event.winnerId === b.id} compact />
        </section>
      ) : null}

      {replayTab === "calc" ? (
        <section className="panel p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm text-emerald-300">Calcul du point</p>
              <h2 className="text-xl font-black">Duel statistique en miroir</h2>
            </div>
            <span className="rounded-md bg-white/10 px-3 py-1 text-sm text-slate-300">
              Énergie incluse dans le total
            </span>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-[1fr_120px_1fr]">
            <PointValueCard
              player={a}
              raw={rawValues[0]}
              bonus={energyBonus[0]}
              total={statValues[0]}
              won={event.winnerId === a.id}
            />
            <div className="grid place-items-center rounded-md border border-white/10 bg-white/[0.04] text-center">
              <div>
                <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                  VS
                </div>
                <div className="mx-auto mt-2 w-fit">
                  <StatIcon statKey={statKey} />
                </div>
                <div className="mt-2 text-2xl font-black">{statLabel}</div>
              </div>
            </div>
            <PointValueCard
              player={b}
              raw={rawValues[1]}
              bonus={energyBonus[1]}
              total={statValues[1]}
              won={event.winnerId === b.id}
            />
          </div>
        </section>
      ) : null}

      {replayTab === "feed" ? (
        <section className="panel p-5">
          <h2 className="font-black">Fil des points</h2>
          <div className="mt-4 grid max-h-[360px] gap-2 overflow-auto">
            {events
              .slice(Math.max(0, index - 12), index + 1)
              .reverse()
              .map((item) => {
                const winner = item.winnerId === a.id ? a : b;
                return (
                  <div
                    key={item.index}
                    className={`grid gap-2 rounded-md border p-3 text-sm md:grid-cols-[90px_150px_1fr] ${item.index === event.index ? "border-cyan-300 bg-cyan-300/10" : "border-white/10 bg-white/[0.04]"}`}
                  >
                    <strong>Point {item.index + 1}</strong>
                    <span className="text-emerald-300">
                      {winner.firstName} {winner.lastName}
                    </span>
                    <span className="text-slate-300">
                      {pointStatLabel(item)} · {cleanPointComment(item, a, b)}
                    </span>
                  </div>
                );
              })}
          </div>
        </section>
      ) : null}
      {finalReached && !resultDismissed ? (
        <MatchResultModal
          won={userWon}
          scoreText={match.scoreText}
          winner={match.winnerId === a.id ? a : b}
          onStay={() => setResultDismissed(true)}
          onDashboard={() => navigate("/dashboard")}
        />
      ) : null}
    </div>
  );
}

function MatchResultModal({
  won,
  scoreText,
  winner,
  onStay,
  onDashboard
}: {
  won: boolean;
  scoreText: string;
  winner: Player;
  onStay: () => void;
  onDashboard: () => void;
}) {
  return createPortal(
    <div className="game-modal-overlay">
      <section className="game-modal-panel panel max-w-md text-center">
        <p
          className={`text-sm font-bold uppercase tracking-[0.24em] ${won ? "text-emerald-300" : "text-rose-300"}`}
        >
          Fin du match
        </p>
        <h2 className="mt-2 text-4xl font-black">{won ? "Victoire" : "Défaite"}</h2>
        <p className="mt-3 text-sm text-slate-300">
          Score final : <strong className="text-white">{scoreText}</strong>
        </p>
        <p className="mt-2 text-sm text-slate-300">
          Vainqueur :{" "}
          <strong className="text-emerald-300">
            {winner.firstName} {winner.lastName}
          </strong>
        </p>
        <div className="mt-6 grid gap-3">
          <Button className="w-full justify-center" onClick={onDashboard}>
            Retour au tableau de bord
          </Button>
          <Button
            className="w-full justify-center bg-white/10 text-white hover:bg-white/15"
            onClick={onStay}
          >
            Rester sur le replay
          </Button>
        </div>
      </section>
    </div>,
    document.body
  );
}

function pointStatLabel(event: ReplayEvent) {
  if (event.statKey && statLabels[event.statKey]) return statLabels[event.statKey];
  return repairMatchText(event.statLabel ?? "Statistique");
}

function pointValues(event: ReplayEvent, a: Player, b: Player): [number, number] {
  const key = event.statKey ?? "service";
  return event.statValues ?? [stat(a, key), stat(b, key)];
}

function cleanPointComment(event: ReplayEvent, a: Player, b: Player) {
  const winner = event.winnerId === a.id ? a : b;
  const values = pointValues(event, a, b);
  return `${pointStatLabel(event)} : ${Math.round(values[0])} contre ${Math.round(values[1])}. ${winner.firstName} ${winner.lastName} gagne le point.`;
}

function repairMatchText(value: string) {
  const bad = (...codes: number[]) => String.fromCharCode(...codes);
  const replacements: Array<[string, string]> = [
    [bad(82, 195, 169, 99, 117, 112, 195, 169, 114, 97, 116, 105, 111, 110), "Récupération"],
    [bad(69, 120, 112, 108, 111, 115, 105, 118, 105, 116, 195, 169), "Explosivité"],
    [bad(86, 111, 108, 195, 169, 101), "Volée"],
    [bad(99, 114, 111, 105, 115, 195, 169), "croisé"],
    [bad(100, 195, 169, 99, 114, 111, 105, 115, 195, 169), "décroisé"],
    [bad(109, 97, 115, 113, 117, 195, 169, 101), "masquée"]
  ];
  return replacements.reduce((text, [source, target]) => text.replaceAll(source, target), value);
}

function SimpleMatchPlayerCard({
  player,
  side,
  active,
  compact = false
}: {
  player: Player;
  side: "left" | "right";
  active: boolean;
  compact?: boolean;
}) {
  const matchStats = compact
    ? profileStatKeys
        .map((key) => ({ key, value: stat(player, key) }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 4)
        .map((item) => item.key)
    : ["service", "return", "forehand", "backhand", "stamina", "speed", "strength", "recovery"];
  return (
    <article className={`match-player-card panel p-4 ${active ? "ring-2 ring-emerald-300" : ""}`}>
      <div
        className={`flex items-center gap-4 ${side === "right" ? "flex-row-reverse text-right" : ""}`}
      >
        <ProfilePicture avatar={player.avatar} />
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-300">
            {active ? "Point gagné" : "Joueur"}
          </p>
          <h2 className="truncate text-2xl font-black">
            {player.firstName} {player.lastName}
          </h2>
          <p className="text-sm text-slate-300">
            {nationalityLabel(player.nationality)} · {player.fftRanking} · Niveau {player.overall}
          </p>
        </div>
      </div>
      <div className="mt-5 grid gap-2">
        {matchStats.map((key) => (
          <div key={key}>
            <div className="mb-1 flex items-center justify-between gap-2 text-xs text-slate-300">
              <span className="flex items-center gap-2">
                <StatIcon statKey={key} size="sm" />
                {statLabels[key]}
              </span>
              <strong>{Math.round(stat(player, key))}</strong>
            </div>
            <div className="h-2 rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-emerald-300"
                style={{ width: `${stat(player, key)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}

function PointValueCard({
  player,
  raw,
  bonus,
  total,
  won
}: {
  player: Player;
  raw: number;
  bonus: number;
  total: number;
  won: boolean;
}) {
  return (
    <div
      className={`rounded-md border p-4 ${won ? "border-emerald-300 bg-emerald-300/10" : "border-white/10 bg-white/[0.04]"}`}
    >
      <div className="flex items-center justify-between gap-3">
        <strong>
          {player.firstName} {player.lastName}
        </strong>
        <span
          className={
            won
              ? "rounded-md bg-emerald-300 px-2 py-1 text-xs font-black text-slate-950"
              : "text-xs text-slate-400"
          }
        >
          {won ? "Point" : "Perdu"}
        </span>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <Metric label="Stat" value={Math.round(raw)} />
        <Metric label="Énergie" value={`+${Math.round(bonus)}`} />
        <Metric label="Total" value={Math.round(total)} />
      </div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function LegacyMatchReplayPage() {
  const { id } = useParams();
  const [match, setMatch] = useState<MatchReplay | null>(null);
  const [index, setIndex] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [playing, setPlaying] = useState(true);
  useEffect(() => void api<MatchReplay>(`/matches/${id}`).then(setMatch), [id]);
  const events = match?.replay?.events ?? [];
  const event = events[Math.min(index, events.length - 1)];
  useEffect(() => {
    if (!playing || !events.length) return;
    const timer = window.setInterval(
      () => setIndex((current) => Math.min(events.length - 1, current + 1)),
      1000 / speed
    );
    return () => window.clearInterval(timer);
  }, [playing, speed, events.length]);
  if (!match || !event) return <div className="panel p-5">Chargement du replay...</div>;
  const a = match.playerA;
  const b = match.playerB;
  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
      <section className="panel p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black">
              {a.firstName} {a.lastName} vs {b.firstName} {b.lastName}
            </h1>
            <p className="text-emerald-300">
              {match.surface} · {match.scoreText}
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setPlaying(!playing)}>
              {playing ? <Pause size={16} /> : <Play size={16} />}
            </Button>
            <Button onClick={() => setSpeed(2)}>
              <FastForward size={16} /> x2
            </Button>
            <Button onClick={() => setSpeed(4)}>
              <FastForward size={16} /> x4
            </Button>
            <Button onClick={() => setIndex(events.length - 1)}>
              <SkipForward size={16} />
            </Button>
          </div>
        </div>
        <div className="court relative aspect-[1.55] rounded-lg">
          <PlayerDot
            label={avatarInitials(a.avatar)}
            x={event.position.playerAX}
            y={event.position.playerAY}
          />
          <PlayerDot
            label={avatarInitials(b.avatar)}
            x={event.position.playerBX}
            y={event.position.playerBY}
            dark
          />
          <div
            className="absolute h-4 w-4 rounded-full bg-yellow-200 transition-all duration-500"
            style={{
              left: `${event.position.ballX * 100}%`,
              top: `${event.position.ballY * 100}%`
            }}
          />
        </div>
        <p className="mt-4 rounded-md bg-white/5 p-4 text-lg font-semibold">{event.comment}</p>
      </section>
      <aside className="grid gap-5">
        <section className="panel p-5">
          <h2 className="font-bold">Score</h2>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <Metric label="Sets" value={`${event.score.sets[0]} - ${event.score.sets[1]}`} />
            <Metric label="Jeux" value={`${event.score.games[0]} - ${event.score.games[1]}`} />
            <Metric label="Points" value={`${event.score.points[0]} - ${event.score.points[1]}`} />
          </div>
          <div className="mt-4 text-sm text-slate-300">
            Point {index + 1}/{events.length} · Momentum {match.replay.momentum[index] ?? 0}
          </div>
        </section>
        <section className="panel max-h-[460px] overflow-auto p-5">
          <h2 className="font-bold">Fil des actions</h2>
          <div className="mt-3 grid gap-2">
            {events
              .slice(Math.max(0, index - 10), index + 1)
              .reverse()
              .map((item) => (
                <div key={item.index} className="rounded-md bg-white/5 p-3 text-sm">
                  {item.comment}
                </div>
              ))}
          </div>
        </section>
      </aside>
    </div>
  );
}

function PlayerDot({
  label,
  x,
  y,
  dark = false
}: {
  label: string;
  x: number;
  y: number;
  dark?: boolean;
}) {
  return (
    <div
      className={`absolute grid h-12 w-12 place-items-center rounded-full text-sm font-black transition-all duration-500 ${dark ? "bg-slate-950 text-emerald-300" : "bg-white text-slate-950"}`}
      style={{ left: `${x * 100}%`, top: `${y * 100}%` }}
    >
      {label}
    </div>
  );
}

function MatchesPage() {
  const [matches, setMatches] = useState<MatchListItem[]>([]);
  useEffect(() => void api<MatchListItem[]>("/matches").then(setMatches), []);
  return (
    <section className="panel p-4 sm:p-5">
      <p className="text-sm font-bold uppercase tracking-[0.22em] text-emerald-300">Matchs</p>
      <h1 className="mt-1 text-2xl font-black">Historique</h1>
      <div className="mt-4 grid gap-3">
        {matches.map((match) => (
          <Link key={match.id} to={`/match/${match.id}`} className="match-history-card">
            <div className="flex min-w-0 items-center gap-3">
              <ProfilePicture avatar={match.playerA.avatar} size="sm" />
              <div className="min-w-0">
                <strong>
                  {match.playerA.firstName} {match.playerA.lastName}
                </strong>
                <p>{match.playerA.fftRanking}</p>
              </div>
            </div>
            <div className="match-score-pill">{match.scoreText}</div>
            <div className="flex min-w-0 items-center gap-3 md:flex-row-reverse md:text-right">
              <ProfilePicture avatar={match.playerB.avatar} size="sm" />
              <div className="min-w-0">
                <strong>
                  {match.playerB.firstName} {match.playerB.lastName}
                </strong>
                <p>{match.type}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

function OnlinePage() {
  const [online, setOnline] = useState<PresenceUser[]>([]);
  useEffect(() => {
    let cancelled = false;
    let socket: ReturnType<(typeof import("socket.io-client"))["io"]> | null = null;
    void import("socket.io-client").then(({ io }) => {
      if (cancelled) return;
      socket = io(socketUrl);
      const token = localStorage.getItem("mypro-token");
      if (token) socket.emit("presence:join", token);
      socket.on("presence:list", setOnline);
    });
    return () => {
      cancelled = true;
      socket?.disconnect();
    };
  }, []);
  return (
    <section className="panel p-4 sm:p-5">
      <p className="text-sm font-bold uppercase tracking-[0.22em] text-emerald-300">Présence</p>
      <h1 className="mt-1 text-2xl font-black">Joueurs en ligne</h1>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {online.length ? (
          online.map((user) => (
            <div key={user.userId} className="online-player-card">
              <span className="online-dot" />
              <div>
                <strong>{user.displayName}</strong>
                <p>Connecté maintenant</p>
              </div>
            </div>
          ))
        ) : (
          <p className="text-slate-300">Aucun autre joueur visible pour le moment.</p>
        )}
      </div>
    </section>
  );
}

function ProfilePage() {
  const { id } = useParams();
  const [player, setPlayer] = useState<Player | null>(null);
  useEffect(() => void api<Player>(`/players/${id}`).then(setPlayer), [id]);
  if (!player) return <div className="panel p-5">Profil en chargement...</div>;
  const topStats = profileStatKeys
    .map((key) => ({ key, value: stat(player, key) }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 4);
  return (
    <div className="grid gap-4">
      <section className="panel p-4 sm:p-5">
        <div className="flex items-center gap-4">
          <ProfilePicture avatar={player.avatar} size="md" />
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-black">{player.name}</h1>
            <p className="text-sm text-emerald-300">
              {nationalityLabel(player.nationality)} · Rang {player.worldRank} · Niveau{" "}
              {player.overall}
            </p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
          <GameMiniMetric label="Classement" value={player.fftRanking} />
          <GameMiniMetric label="Niveau" value={player.overall} />
          <GameMiniMetric label="Victoires" value={player.wins} />
          <GameMiniMetric label="Défaites" value={player.losses} />
        </div>
      </section>
      <section className="panel p-4 sm:p-5">
        <div className="flex flex-wrap gap-2">
          {topStats.map((item) => (
            <span key={item.key} className="stat-bonus-pill">
              <StatIcon statKey={item.key} size="sm" />
              <span>{statLabels[item.key]}</span>
              <strong>{Math.round(item.value)}</strong>
            </span>
          ))}
        </div>
        <div className="mt-4">
          <StatBars player={player} />
        </div>
      </section>
    </div>
  );
}

function CommunityPage() {
  const [communityTab, setCommunityTab] = useState<"discord" | "onboarding" | "structure">(
    "discord"
  );
  const communitySections = [
    {
      title: "Discussion générale",
      body: "Retrouvez les autres joueurs, échangez sur vos saisons et organisez vos rivalités.",
      icon: MessageCircle
    },
    {
      title: "Mises à jour",
      body: "Suivez les nouvelles versions, équilibrages, corrections et prochaines fonctionnalités.",
      icon: Sparkles
    },
    {
      title: "Rapports de bug",
      body: "Signalez clairement un problème avec le contexte, la page concernée et ce qui s'est produit.",
      icon: Crosshair
    },
    {
      title: "Suggestions",
      body: "Proposez des idées de gameplay, d'économie, de clubs, de compétitions ou d'interface.",
      icon: Target
    }
  ];
  const newcomerSteps = [
    {
      title: "Lire les règles",
      body: "Le joueur valide les règles du serveur avant d'accéder aux salons principaux.",
      icon: CheckCircle2
    },
    {
      title: "Choisir son profil",
      body: "Rôle Joueur, Président de club, Testeur ou Créateur de contenu selon son envie.",
      icon: UserPlus
    },
    {
      title: "Se présenter",
      body: "Pseudo, classement en jeu, club actuel et objectif de saison pour lancer les échanges.",
      icon: Shield
    },
    {
      title: "Trouver le bon salon",
      body: "Clubs, duels, bugs, suggestions et annonces sont séparés pour garder le serveur lisible.",
      icon: ChevronRight
    }
  ];
  return (
    <div className="grid gap-5">
      <section className="panel overflow-hidden p-0">
        <div className="relative min-h-60 p-6 md:p-8">
          <div className="absolute inset-0 bg-[url('/visuals/club/complex-level-5.jpg')] bg-cover bg-center opacity-35" />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/80 to-slate-950/35" />
          <div className="relative z-10 max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-md border border-emerald-300/25 bg-emerald-300/10 px-3 py-2 text-xs font-black uppercase tracking-[0.22em] text-emerald-200">
              <MessageCircle size={15} />
              Communauté MYPRO
            </div>
            <h1 className="mt-5 text-4xl font-black leading-tight text-white md:text-5xl">
              Le club-house des joueurs.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-200">
              Rejoignez le Discord communautaire pour discuter, retrouver les mises à jour, signaler
              un bug, proposer une idée et suivre l'évolution de MYPRO - TENNIS.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              {discordInviteUrl ? (
                <a
                  className="inline-flex items-center justify-center gap-2 rounded-md bg-emerald-400 px-4 py-2 text-sm font-black text-slate-950 transition hover:bg-emerald-300"
                  href={discordInviteUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  <MessageCircle size={17} />
                  Rejoindre le Discord
                </a>
              ) : (
                <Button disabled>
                  <MessageCircle size={17} />
                  Discord bientôt ouvert
                </Button>
              )}
              <Link
                className="inline-flex items-center justify-center gap-2 rounded-md bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/15"
                to="/club"
              >
                <Users size={17} />
                Retour aux clubs
              </Link>
            </div>
          </div>
        </div>
      </section>

      <div className="segmented-tabs">
        {[
          ["discord", "Salons", "Échanger"],
          ["onboarding", "Accueil", "Débuter"],
          ["structure", "Structure", "Organisation"]
        ].map(([value, label, meta]) => (
          <button
            className={communityTab === value ? "is-active" : ""}
            key={value}
            onClick={() => setCommunityTab(value as "discord" | "onboarding" | "structure")}
            type="button"
          >
            <span>{label}</span>
            <small>{meta}</small>
          </button>
        ))}
      </div>

      {communityTab === "discord" ? (
        <section className="grid gap-4 md:grid-cols-2">
          {communitySections.map(({ title, body, icon: Icon }) => (
            <article className="panel p-5" key={title}>
              <div className="flex items-start gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-md border border-emerald-300/25 bg-emerald-300/10 text-emerald-200">
                  <Icon size={21} />
                </span>
                <div>
                  <h2 className="text-lg font-black">{title}</h2>
                  <p className="mt-1 text-sm leading-6 text-slate-300">{body}</p>
                </div>
              </div>
            </article>
          ))}
        </section>
      ) : null}

      {communityTab === "onboarding" ? (
        <section className="panel p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.22em] text-emerald-300">
                Nouveaux arrivants
              </p>
              <h2 className="mt-1 text-xl font-black">Parcours d'accueil Discord</h2>
            </div>
            <span className="rounded-md border border-emerald-300/25 bg-emerald-300/10 px-3 py-2 text-xs font-black uppercase tracking-[0.18em] text-emerald-100">
              Onboarding
            </span>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-4">
            {newcomerSteps.map(({ title, body, icon: Icon }, index) => (
              <article
                className="rounded-md border border-white/10 bg-white/[0.04] p-4"
                key={title}
              >
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-md bg-emerald-300 text-slate-950">
                    <Icon size={19} />
                  </span>
                  <span className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                    Étape {index + 1}
                  </span>
                </div>
                <h3 className="mt-4 font-black">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-300">{body}</p>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {communityTab === "structure" ? (
        <section className="panel p-5">
          <h2 className="text-xl font-black">Structure prévue du serveur</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <Metric label="Accueil" value="#annonces · #règles · #présentations" />
            <Metric label="Support" value="#bugs · #suggestions · #aide" />
            <Metric label="Jeu" value="#clubs · #duels · #championnats" />
          </div>
          <p className="mt-4 text-sm leading-6 text-slate-300">
            Le Discord sera le point de rencontre officiel pour suivre la progression du jeu et
            faire remonter les retours de la communauté.
          </p>
        </section>
      ) : null}
    </div>
  );
}

function SettingsPage() {
  const user = useGameStore((state) => state.user);
  const refresh = useGameStore((state) => state.refresh);
  const logout = useGameStore((state) => state.logout);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [message, setMessage] = useState(
    searchParams.get("googleLinked") === "1" ? "Compte Google lié avec succès." : ""
  );
  const [busy, setBusy] = useState(false);
  async function linkGoogle() {
    setMessage("");
    setBusy(true);
    try {
      const result = await api<{ url: string }>("/auth/google/link/start", { method: "POST" });
      window.location.href = result.url;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Liaison Google impossible.");
      setBusy(false);
    }
  }
  useEffect(() => {
    if (searchParams.get("googleLinked") === "1") void refresh();
  }, [refresh, searchParams]);
  function disconnect() {
    logout();
    navigate("/", { replace: true });
  }
  return (
    <section className="grid gap-4">
      <div className="game-hub panel p-5">
        <p className="text-sm font-bold uppercase tracking-[0.22em] text-emerald-300">Réglages</p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black">Compte et session</h1>
            <p className="mt-2 max-w-xl text-sm text-slate-300">
              Gérez la connexion, la liaison Google et les paramètres installables du jeu.
            </p>
          </div>
          <Button onClick={disconnect} className="bg-red-300 text-slate-950 hover:bg-red-200">
            <LogOut size={17} />
            Déconnexion
          </Button>
        </div>
      </div>
      {message ? (
        <div className="rounded-md border border-emerald-300/30 bg-emerald-300/10 p-3 text-sm text-emerald-100">
          {message}
        </div>
      ) : null}
      <div className="grid gap-3 md:grid-cols-4">
        <GameMiniMetric label="Compte" value={user?.email ?? "Invité"} />
        <GameMiniMetric label="Google" value={user?.googleLinked ? "Lié" : "Non lié"} />
        <GameMiniMetric label="Application" value="PWA installable" />
        <GameMiniMetric label="Multijoueur" value="Socket.IO actif" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {!user?.googleLinked ? (
          <div className="panel p-5">
            <div className="flex items-start gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-md border border-emerald-300/25 bg-emerald-300/10 text-emerald-200">
                <LogIn size={21} />
              </span>
              <div>
                <h2 className="text-xl font-black">Connexion Google</h2>
                <p className="mt-1 text-sm leading-6 text-slate-300">
                  Liez votre compte existant pour pouvoir vous connecter ensuite avec Google.
                </p>
              </div>
            </div>
            <div className="mt-3 max-w-xs">
              <GoogleButton disabled={busy} onClick={linkGoogle}>
                Lier mon compte Google
              </GoogleButton>
            </div>
          </div>
        ) : (
          <div className="panel p-5">
            <div className="flex items-start gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-md border border-emerald-300/25 bg-emerald-300/10 text-emerald-200">
                <CheckCircle2 size={21} />
              </span>
              <div>
                <h2 className="text-xl font-black">Compte Google lié</h2>
                <p className="mt-1 text-sm leading-6 text-slate-300">
                  Votre compte peut se reconnecter avec Google depuis n'importe quel navigateur.
                </p>
              </div>
            </div>
          </div>
        )}
        <div className="panel p-5">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-md border border-cyan-300/25 bg-cyan-300/10 text-cyan-100">
              <Upload size={21} />
            </span>
            <div>
              <h2 className="text-xl font-black">Application installable</h2>
              <p className="mt-1 text-sm leading-6 text-slate-300">
                Installez MYPRO - TENNIS depuis le navigateur pour retrouver une expérience proche
                d'une application mobile.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function OrientationGuard() {
  return (
    <div className="orientation-guard" role="status" aria-live="polite">
      <div className="orientation-guard-card">
        <div className="orientation-phone">
          <div />
        </div>
        <p className="text-sm font-bold uppercase tracking-[0.24em] text-emerald-300">
          Mode paysage requis
        </p>
        <h1>Tournez votre appareil</h1>
        <p>
          MYPRO - TENNIS est optimisé comme un jeu mobile horizontal pour garder les statistiques,
          les duels et les tableaux lisibles.
        </p>
      </div>
    </div>
  );
}

function useFitMobileModals() {
  useEffect(() => {
    let frame = 0;
    let observing = false;
    const compactMedia = window.matchMedia("(max-width: 900px), (max-height: 560px)");

    const fit = () => {
      frame = 0;
      const compactViewport = compactMedia.matches;
      const panels = document.querySelectorAll<HTMLElement>(
        ".game-modal-panel, .header-menu-panel"
      );
      const viewportWidth = window.visualViewport?.width ?? window.innerWidth;
      const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
      panels.forEach((panel) => {
        panel.style.setProperty("--modal-fit-scale", "1");
        panel.classList.toggle("fit-mobile-modal", compactViewport);
        if (!compactViewport) return;

        const safePadding = panel.classList.contains("header-menu-panel") ? 10 : 14;
        const maxWidth = Math.max(1, viewportWidth - safePadding * 2);
        const maxHeight = Math.max(1, viewportHeight - safePadding * 2);
        const rect = panel.getBoundingClientRect();
        const scale = Math.min(
          1,
          maxWidth / Math.max(rect.width, 1),
          maxHeight / Math.max(rect.height, 1)
        );
        panel.style.setProperty(
          "--modal-fit-scale",
          String(Math.max(0.35, Math.floor(scale * 100) / 100))
        );
      });
    };

    const schedule = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(fit);
    };

    const modalSelector = ".game-modal-panel, .header-menu-panel";
    const containsModal = (node: Node) =>
      node instanceof Element &&
      (node.matches(modalSelector) || Boolean(node.querySelector(modalSelector)));
    const observer = new MutationObserver((mutations) => {
      const shouldFit = mutations.some((mutation) => {
        if (mutation.target instanceof Element && mutation.target.closest(modalSelector))
          return true;
        return [...mutation.addedNodes, ...mutation.removedNodes].some(containsModal);
      });
      if (shouldFit) schedule();
    });
    const updateObservation = () => {
      if (compactMedia.matches && !observing) {
        observer.observe(document.body, { childList: true, subtree: true });
        observing = true;
      } else if (!compactMedia.matches && observing) {
        observer.disconnect();
        observing = false;
      }
      schedule();
    };
    window.addEventListener("resize", schedule);
    window.addEventListener("orientationchange", schedule);
    window.visualViewport?.addEventListener("resize", schedule);
    compactMedia.addEventListener("change", updateObservation);
    updateObservation();

    return () => {
      if (frame) cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", schedule);
      window.removeEventListener("orientationchange", schedule);
      window.visualViewport?.removeEventListener("resize", schedule);
      compactMedia.removeEventListener("change", updateObservation);
    };
  }, []);
}

function LoadingScreen() {
  const [slowServer, setSlowServer] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setSlowServer(true), 4500);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <main className="loading-screen" aria-busy="true" aria-live="polite">
      <img
        alt=""
        aria-hidden="true"
        className="loading-screen-image"
        decoding="async"
        fetchPriority="high"
        src="/visuals/mypro-loading-keyart.webp"
      />
      <div className="loading-screen-scrim" />
      <section className="loading-screen-card">
        <div className="loading-brand">
          <span>MYPRO</span>
          <strong>TENNIS</strong>
        </div>
        <div className="loading-progress" aria-hidden="true">
          <span />
        </div>
        <h1>Préparation du court</h1>
        <p>
          {slowServer
            ? "Le serveur persistant se réveille. Votre carrière arrive dans quelques instants."
            : "Connexion à votre carrière, vos sacs et la saison en cours."}
        </p>
        <div className="loading-dots" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      </section>
    </main>
  );
}

export function App() {
  const booted = useGameStore((state) => state.booted);
  const userId = useGameStore((state) => state.user?.id ?? null);
  const refresh = useGameStore((state) => state.refresh);
  useFitMobileModals();
  useEffect(() => void refresh(), [refresh]);
  useEffect(() => {
    if (!userId) return;
    const warmIfVisible = () => {
      if (!document.hidden) void warmApi().catch(() => undefined);
    };
    const timer = window.setInterval(warmIfVisible, 10 * 60_000);
    window.addEventListener("focus", warmIfVisible);
    document.addEventListener("visibilitychange", warmIfVisible);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", warmIfVisible);
      document.removeEventListener("visibilitychange", warmIfVisible);
    };
  }, [userId]);
  if (!booted)
    return (
      <>
        <OrientationGuard />
        <LoadingScreen />
      </>
    );
  return (
    <>
      <OrientationGuard />
      <Shell>
        <Suspense fallback={<LoadingScreen />}>
          <Routes>
          <Route path="/" element={<HomeRoute />} />
          <Route path="/login" element={<AuthPage mode="login" />} />
          <Route path="/signup" element={<AuthPage mode="signup" />} />
          <Route path="/oauth/google" element={<GoogleOAuthCallback />} />
          <Route
            path="/create-player"
            element={
              <NeedAuth>
                <CreatePlayer />
              </NeedAuth>
            }
          />
          <Route
            path="/dashboard"
            element={
              <NeedAuth>
                <NeedPlayer>
                  <Dashboard />
                </NeedPlayer>
              </NeedAuth>
            }
          />
          <Route
            path="/player"
            element={
              <NeedAuth>
                <NeedPlayer>
                  <PlayerPage />
                </NeedPlayer>
              </NeedAuth>
            }
          />
          <Route
            path="/skills"
            element={
              <NeedAuth>
                <NeedPlayer>
                  <SkillsCinematicPage
                    getStatLabel={(key) => statLabels[key] ?? key}
                    getStatVisual={statVisual}
                    resolveHeroSource={avatarHeroSource}
                    statKeys={profileStatKeys}
                  />
                </NeedPlayer>
              </NeedAuth>
            }
          />
          <Route
            path="/collection"
            element={
              <NeedAuth>
                <NeedPlayer>
                  <CollectionCinematicPage />
                </NeedPlayer>
              </NeedAuth>
            }
          />
          <Route
            path="/collection/coach-deck"
            element={
              <NeedAuth>
                <NeedPlayer>
                  <CoachDeckBuilderPage />
                </NeedPlayer>
              </NeedAuth>
            }
          />
          <Route
            path="/coach-deck/tutorial"
            element={
              <CoachDeckTutorialPage
                resolveHeroSource={avatarHeroSource}
                resolvePictureSource={avatarPictureSource}
              />
            }
          />
          <Route
            path="/club"
            element={
              <NeedAuth>
                <NeedPlayer>
                  <ClubPage />
                </NeedPlayer>
              </NeedAuth>
            }
          />
          <Route
            path="/season"
            element={
              <NeedAuth>
                <NeedPlayer>
                  <SeasonPage />
                </NeedPlayer>
              </NeedAuth>
            }
          />
          <Route
            path="/tournaments"
            element={
              <NeedAuth>
                <NeedPlayer>
                  <SeasonPage />
                </NeedPlayer>
              </NeedAuth>
            }
          />
          <Route
            path="/duel"
            element={
              <NeedAuth>
                <NeedPlayer>
                  <DuelPage
                    resolveHeroSource={avatarHeroSource}
                    resolvePictureSource={avatarPictureSource}
                  />
                </NeedPlayer>
              </NeedAuth>
            }
          />
          <Route path="/match" element={<Navigate to="/duel" replace />} />
          <Route
            path="/match-live/:id"
            element={
              <NeedAuth>
                <NeedPlayer>
                  <InteractiveMatchPage
                    resolveHeroSource={avatarHeroSource}
                    resolvePictureSource={avatarPictureSource}
                  />
                </NeedPlayer>
              </NeedAuth>
            }
          />
          <Route
            path="/match/:id"
            element={
              <NeedAuth>
                <NeedPlayer>
                  <AutomaticMatchPage
                    resolveHeroSource={avatarHeroSource}
                    resolvePictureSource={avatarPictureSource}
                  />
                </NeedPlayer>
              </NeedAuth>
            }
          />
          <Route
            path="/matches"
            element={
              <NeedAuth>
                <NeedPlayer>
                  <MatchesPage />
                </NeedPlayer>
              </NeedAuth>
            }
          />
          <Route path="/rankings" element={<RankingsPage />} />
          <Route
            path="/online"
            element={
              <NeedAuth>
                <OnlinePage />
              </NeedAuth>
            }
          />
          <Route path="/community" element={<CommunityPage />} />
          <Route path="/profile/:id" element={<ProfilePage />} />
          <Route
            path="/settings"
            element={
              <NeedAuth>
                <SettingsPage />
              </NeedAuth>
            }
          />
          </Routes>
        </Suspense>
      </Shell>
    </>
  );
}
