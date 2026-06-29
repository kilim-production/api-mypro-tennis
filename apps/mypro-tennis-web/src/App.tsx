import { useEffect, useMemo, useState } from "react";
import type React from "react";
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
import { io } from "socket.io-client";
import {
  Activity,
  BarChart3,
  Bell,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Crosshair,
  Dumbbell,
  Eye,
  FastForward,
  Flame,
  Gauge,
  Gem,
  Hand,
  HeartPulse,
  History,
  Image,
  LogOut,
  LogIn,
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
  Wifi,
  Wind,
  X,
  Zap
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { countries, countryLabel, normalizeCountryCode, type Country } from "@mypro/shared";
import { API_URL, api, saveToken } from "./api";
import { useGameStore, type GameNotification, type Player } from "./store";

const socketUrl = import.meta.env.VITE_SOCKET_URL ?? "http://localhost:4000";
const discordInviteUrl = import.meta.env.VITE_DISCORD_INVITE_URL ?? "";

const nav = [
  ["Tableau de bord", "/dashboard", Activity],
  ["Mon joueur", "/player", Shield],
  ["Collection", "/collection", PackageOpen],
  ["Mon club", "/club", Users],
  ["Saison en cours", "/season", Trophy],
  ["Duel", "/duel", Swords],
  ["Historique", "/matches", History],
  ["Classement", "/rankings", BarChart3],
  ["Joueurs en ligne", "/online", Wifi],
  ["Communauté", "/community", MessageCircle],
  ["Réglages", "/settings", Settings]
] as const;

function notificationTarget(notification: GameNotification) {
  const type = notification.type.toUpperCase();
  const text = `${notification.title} ${notification.body}`.toLowerCase();
  if (type === "COLLECTION" || text.includes("collection") || text.includes("carte"))
    return "/collection";
  if (type === "CLUB" || text.includes("club")) return "/club";
  if (type === "DEFI" || type === "DÉFI" || text.includes("défi") || text.includes("match"))
    return "/matches";
  if (type === "SAISON" || text.includes("tournoi") || text.includes("championnat"))
    return "/season";
  if (type === "TUTORIEL" || text.includes("bienvenue")) return "/dashboard";
  return "/dashboard";
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

const dashboardRadarLabels: Record<(typeof profileStatKeys)[number], string> = {
  service: "Service",
  return: "Retour",
  forehand: "C. droit",
  backhand: "Revers",
  volley: "Volée",
  smash: "Smash",
  dropShot: "Amortie",
  stamina: "Endurance",
  speed: "Vitesse",
  explosiveness: "Explos.",
  strength: "Force",
  recovery: "Récup."
};

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
        className={`profile-picture ${sizeClass}`}
        src={selectedPicture.dataUrl}
        alt={`Photo de profil ${label}`}
      />
    );
  }
  const preset =
    personalPictures.find((item) => item.id === selectedPicture?.id) ?? personalPictures[0];
  return (
    <img
      className={`profile-picture profile-picture-preset ${sizeClass}`}
      src={preset.image}
      alt={`Photo de profil ${label}`}
    />
  );
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
type MatchListItem = {
  id: string;
  winnerId: string;
  scoreText: string;
  type: string;
  surface: string;
  durationMinutes?: number;
  playerA: Player;
  playerB: Player;
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
type MatchReplay = MatchListItem & { replay: { events: ReplayEvent[]; momentum: number[] } };
type PresenceUser = { userId: string; displayName: string; connectedAt: string };
type ClubPlayerSummary = {
  id: string;
  name: string;
  nationality: string;
  fftRanking: string;
  overall: number;
  worldRank: number;
  avatar: string;
};
type ClubBuildingLevel = {
  level: number;
  name: string;
  cost: number;
  maxSlots: number;
};
type ClubBuilding = {
  id: string;
  name: string;
  currentLevel: ClubBuildingLevel;
  nextLevel: ClubBuildingLevel | null;
  maxLevel: number;
  levels: ClubBuildingLevel[];
};
type ClubListItem = {
  id: string;
  name: string;
  tag: string;
  description: string;
  minimumRanking: string;
  duesAmount?: number;
  budget: number;
  complexLevel: number;
  buildings?: {
    complex: ClubBuilding;
  };
  competitiveLevel: string;
  maxSlots: number;
  memberCount: number;
  openSlots: number;
  president: ClubPlayerSummary;
  createdAt: string;
  myRequestStatus: string | null;
};
type ClubDetails = Omit<ClubListItem, "myRequestStatus"> & {
  isPresident: boolean;
  members: Array<{
    id: string;
    role: string;
    joinedAt: string;
    player: ClubPlayerSummary;
  }>;
  pendingRequests: Array<{
    id: string;
    message: string;
    createdAt: string;
    player: ClubPlayerSummary;
  }>;
};
type MyClubData = {
  club: ClubDetails | null;
  pendingRequest: {
    id: string;
    message: string;
    createdAt: string;
    club: Omit<ClubListItem, "myRequestStatus">;
  } | null;
};
type ClubLeaveResponse = MyClubData & {
  refunded: number;
  message: string;
};
type TeamChampionshipEntry = {
  id: string;
  rank?: number;
  name: string;
  tag: string;
  isPlayerClub: boolean;
  points: number;
  played: number;
  wins: number;
  losses: number;
  matchesFor: number;
  matchesAgainst: number;
  setsFor: number;
  setsAgainst: number;
  gamesFor: number;
  gamesAgainst: number;
};
type TeamChampionshipSingle = {
  label: string;
  court: number;
  homePlayer: { name: string; fftRanking: string; winPct: number; strength: number };
  awayPlayer: { name: string; fftRanking: string; winPct: number; strength: number };
  homeValue: number;
  awayValue: number;
  homeSets: number;
  awaySets: number;
  homeGames: number;
  awayGames: number;
  scoreText: string;
  winner: "home" | "away";
};
type TeamChampionshipMeeting = {
  id: string;
  round: number;
  startsAt: string;
  status: string;
  scoreHome: number | null;
  scoreAway: number | null;
  home: TeamChampionshipEntry | null;
  away: TeamChampionshipEntry | null;
  details?: { singles?: TeamChampionshipSingle[] };
};
type TeamChampionshipData = {
  divisions: string[];
  club: Omit<ClubListItem, "myRequestStatus"> | null;
  team: {
    id: string;
    name: string;
    division: string;
    members: Array<{
      id: string;
      slotIndex: number;
      duesPaid?: boolean;
      player: ClubPlayerSummary;
    }>;
  } | null;
  championship: {
    id: string;
    division: string;
    startsAt: string;
    endsAt: string;
    status: string;
    standings: TeamChampionshipEntry[];
    nextMeeting: TeamChampionshipMeeting | null;
    meetings: TeamChampionshipMeeting[];
  } | null;
  dues?: {
    amount: number;
    championshipId: string | null;
    windowOpensAt: string | null;
    windowClosesAt: string | null;
    isWindowOpen: boolean;
    currentPlayerPaid: boolean;
    currentPlayerCanPay: boolean;
    paidCount: number;
    eligibleCount: number;
    paidPlayerIds: string[];
  };
  canCreateTeam: boolean;
  canStartChampionship: boolean;
};

function clubDuesAmount(club: Pick<ClubListItem, "duesAmount"> | null | undefined) {
  return typeof club?.duesAmount === "number" ? club.duesAmount : 0;
}

const fallbackComplexLevels: ClubBuildingLevel[] = [
  { level: 1, name: "Club municipal", cost: 0, maxSlots: 5 },
  { level: 2, name: "Club intercommunal", cost: 10_000, maxSlots: 10 },
  { level: 3, name: "Club départemental", cost: 50_000, maxSlots: 20 },
  { level: 4, name: "Club régional", cost: 300_000, maxSlots: 35 },
  { level: 5, name: "Club de référence nationale", cost: 2_000_000, maxSlots: 50 }
];

function complexBuildingForClub(club: ClubDetails): ClubBuilding {
  if (club.buildings?.complex) return club.buildings.complex;
  const level = Math.min(Math.max(club.complexLevel || 1, 1), fallbackComplexLevels.length);
  const currentLevel = fallbackComplexLevels.find((definition) => definition.level === level)!;
  return {
    id: "complex",
    name: "Le complexe",
    currentLevel,
    nextLevel:
      fallbackComplexLevels.find((definition) => definition.level === currentLevel.level + 1) ??
      null,
    maxLevel: fallbackComplexLevels.length,
    levels: fallbackComplexLevels
  };
}

function complexLevelImage(level: number) {
  return `/visuals/club/complex-level-${level}.jpg`;
}

function fallbackDuesState(
  club: ClubDetails,
  data?: Pick<TeamChampionshipData, "dues" | "club" | "championship"> | null
) {
  const amount = data?.dues?.amount ?? clubDuesAmount(data?.club ?? club);
  return (
    data?.dues ?? {
      amount,
      championshipId: data?.championship?.id ?? null,
      windowOpensAt: null,
      windowClosesAt: null,
      isWindowOpen: false,
      currentPlayerPaid: amount === 0,
      currentPlayerCanPay: false,
      paidCount: amount === 0 ? club.memberCount : 0,
      eligibleCount: amount === 0 ? club.memberCount : 0,
      paidPlayerIds: []
    }
  );
}
type ChestRarity = "Bronze" | "Argent" | "Or" | "Légendaire" | "Mythique";
const rarityWeight: Record<ChestRarity, number> = {
  Mythique: 5,
  Légendaire: 4,
  Or: 3,
  Argent: 2,
  Bronze: 1
};

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

function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);
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

function fftIndex(ranking: string) {
  const index = fftPath.indexOf(ranking);
  return index < 0 ? 0 : index;
}

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

function ActionEnergyCard({ player }: { player: Player }) {
  const now = useNow();
  const next = player.actionEnergyNextAt
    ? new Date(player.actionEnergyNextAt).toLocaleTimeString("fr-FR", {
        hour: "2-digit",
        minute: "2-digit"
      })
    : null;
  const remaining = player.actionEnergyNextAt
    ? new Date(player.actionEnergyNextAt).getTime() - now
    : 0;
  const ratio = Math.round((player.actionEnergy / player.actionEnergyMax) * 100);
  return (
    <article className="panel p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-emerald-300">Énergie carrière</p>
          <h2 className="text-2xl font-black">
            {player.actionEnergy}/{player.actionEnergyMax}
          </h2>
        </div>
        <Activity size={24} />
      </div>
      <p className="mt-3 text-sm text-slate-300">
        Chaque action de carrière coûte 1 point. La réserve se recharge de 1 point toutes les 30
        minutes.
      </p>
      <div className="mt-4 h-2 rounded-full bg-white/[0.08]">
        <div className="h-full rounded-full bg-sky-300" style={{ width: `${ratio}%` }} />
      </div>
      <p className="mt-3 text-sm text-slate-300">
        {next ? `Prochain point vers ${next} · ${formatRemaining(remaining)}` : "Réserve complète"}
      </p>
    </article>
  );
}

function rarityClass(rarity: ChestRarity) {
  return `rarity-${rarity
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")}`;
}

function sortCosmeticsByRarity(items: PlayerCosmeticItem[]) {
  return [...items].sort((a, b) => {
    const rarityDelta = (rarityWeight[b.rarity] ?? 0) - (rarityWeight[a.rarity] ?? 0);
    if (rarityDelta !== 0) return rarityDelta;
    if (a.equippedSlot !== null && b.equippedSlot === null) return -1;
    if (a.equippedSlot === null && b.equippedSlot !== null) return 1;
    return a.name.localeCompare(b.name, "fr");
  });
}

function TennisBagVisual({ rarity, opening = false }: { rarity: ChestRarity; opening?: boolean }) {
  return (
    <div className={`tennis-bag ${rarityClass(rarity)} ${opening ? "tennis-bag-opening" : ""}`}>
      <div className="tennis-bag-handle" />
      <div className="tennis-bag-flap" />
      <div className="tennis-bag-mark">MYPRO</div>
    </div>
  );
}

function RewardModal({ rewards, onClose }: { rewards: ChestRewards; onClose: () => void }) {
  const unlockedCards = rewards.cards.filter((card) => card.bonus > 0);
  return createPortal(
    <div className="fixed inset-0 z-[9999] grid place-items-center overflow-y-auto bg-slate-950/82 p-4 backdrop-blur">
      <div className="panel relative max-h-[calc(100vh-2rem)] w-full max-w-2xl overflow-auto p-6 text-center shadow-2xl shadow-black/60">
        <button
          className="absolute right-4 top-4 rounded-md bg-white/10 p-2 text-slate-200 hover:bg-white/15"
          onClick={onClose}
          aria-label="Fermer les récompenses"
          type="button"
        >
          <X size={18} />
        </button>
        <div className="mx-auto w-40">
          <TennisBagVisual rarity="Mythique" opening />
        </div>
        <p className="mt-3 text-sm font-bold uppercase tracking-[0.28em] text-emerald-300">
          Sac ouvert
        </p>
        <h2 className="mt-1 text-3xl font-black">Récompenses obtenues</h2>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <Metric label="Argent" value={`${rewards.money} €`} />
          <Metric label="Gemmes" value={rewards.gems} />
          <Metric
            label="Paliers prêts"
            value={`+${unlockedCards.reduce((sum, card) => sum + card.bonus, 0)}`}
          />
        </div>
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
                <div className="text-xs uppercase tracking-[0.18em] text-sky-200">
                  Cosmétique {item.rarity}
                </div>
                <div className="mt-1 font-black">{item.name}</div>
                <div className="mt-3">
                  <StatBonusPills bonuses={item.bonuses} />
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

function TennisBagSlots() {
  const [data, setData] = useState<ChestState | null>(null);
  const [opening, setOpening] = useState<ChestRewards | null>(null);
  const [busy, setBusy] = useState("");
  const refresh = useGameStore((state) => state.refresh);
  const now = useNow();

  async function load() {
    setData(await api<ChestState>("/chests"));
  }

  useEffect(() => void load(), []);

  async function openBag(chestId: string) {
    setBusy(chestId);
    try {
      const result = await api<{ rewards: ChestRewards }>(`/chests/${chestId}/open`, {
        method: "POST"
      });
      setOpening(result.rewards);
      await load();
      await refresh();
    } finally {
      setBusy("");
    }
  }

  async function speedUp(chestId: string) {
    setBusy(chestId);
    try {
      await api(`/chests/${chestId}/speedup`, { method: "POST" });
      await load();
      await refresh();
    } finally {
      setBusy("");
    }
  }

  return (
    <article className="panel p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-emerald-300">Sacs de tennis</p>
          <h2 className="text-xl font-black">Coffres d'entraînement</h2>
        </div>
        <div className="inline-flex items-center gap-2 rounded-md bg-white/[0.08] px-3 py-1 text-sm text-slate-200">
          <Gem size={15} /> {data?.gems ?? 0} gemmes
        </div>
      </div>
      <p className="mt-2 text-sm text-slate-300">
        Gagnez un match pour obtenir un sac. Les 4 emplacements doivent être libérés régulièrement.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {(
          data?.slots ?? Array.from({ length: 4 }, (_, slotIndex) => ({ slotIndex, chest: null }))
        ).map(({ slotIndex, chest }) => {
          const remaining = chest ? new Date(chest.unlocksAt).getTime() - now : 0;
          const ready = !!chest && remaining <= 0;
          const speedCost = Math.max(1, Math.ceil(Math.max(0, remaining) / (10 * 60_000)));
          return (
            <div key={slotIndex} className={`bag-slot ${chest ? rarityClass(chest.rarity) : ""}`}>
              {chest ? (
                <>
                  <TennisBagVisual rarity={chest.rarity} />
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <span className="font-black">{chest.rarity}</span>
                    <span className="text-xs text-slate-400">Slot {slotIndex + 1}</span>
                  </div>
                  <div className="mt-2 text-sm text-slate-300">
                    {ready ? (
                      "Prêt à ouvrir"
                    ) : (
                      <Countdown endAt={chest.unlocksAt} doneLabel="Prêt" />
                    )}
                  </div>
                  <div className="mt-3 grid grid-cols-4 gap-2 rounded-md border border-white/10 bg-slate-950/45 p-2">
                    <StatIcon statKey="service" size="sm" />
                    <span className="grid h-8 w-8 place-items-center rounded-md border border-white/10 bg-slate-950/75 text-xs font-black text-emerald-200">
                      €
                    </span>
                    <span className="grid h-8 w-8 place-items-center rounded-md border border-white/10 bg-slate-950/75 text-emerald-200">
                      <Image size={16} />
                    </span>
                    <span className="grid h-8 w-8 place-items-center rounded-md border border-white/10 bg-slate-950/75 text-cyan-200">
                      <Gem size={16} />
                    </span>
                  </div>
                  <div className="mt-3 grid gap-2">
                    <Button
                      disabled={!ready || busy === chest.id}
                      onClick={() => openBag(chest.id)}
                    >
                      <PackageOpen size={16} /> Ouvrir
                    </Button>
                    {!ready ? (
                      <Button
                        className="bg-white/10 text-white hover:bg-white/15"
                        disabled={busy === chest.id}
                        onClick={() => speedUp(chest.id)}
                      >
                        <Sparkles size={16} /> {speedCost} gemme(s)
                      </Button>
                    ) : null}
                  </div>
                </>
              ) : (
                <div className="grid h-full min-h-[210px] place-items-center rounded-md border border-dashed border-white/15 text-center text-sm text-slate-400">
                  Slot vide
                </div>
              )}
            </div>
          );
        })}
      </div>
      {opening ? <RewardModal rewards={opening} onClose={() => setOpening(null)} /> : null}
    </article>
  );
}

function Button(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-2 rounded-md bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:opacity-50 ${props.className ?? ""}`}
    />
  );
}

function Field(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 outline-none focus:border-emerald-300"
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
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const unread = notifications.filter((notification) => !notification.readAt);

  async function openNotification(notification: GameNotification) {
    if (!notification.readAt) {
      await api(`/notifications/${notification.id}/read`, { method: "PATCH" });
      await refresh();
    }
    setOpen(false);
    navigate(notificationTarget(notification));
  }

  async function readAll() {
    await api("/notifications/read-all", { method: "POST" });
    await refresh();
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
  const { user, player, notifications, logout } = useGameStore();
  const location = useLocation();
  const showSidebar = user && !["/", "/login", "/signup", "/oauth/google"].includes(location.pathname);
  const navBadges = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const notification of notifications) {
      if (notification.readAt) continue;
      const target = notificationTarget(notification);
      counts[target] = (counts[target] ?? 0) + 1;
    }
    return counts;
  }, [notifications]);
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-midnight/92 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
          <Link to="/" className="leading-none">
            <div className="text-xl font-black tracking-[0.18em] text-white">MYPRO</div>
            <div className="text-xs font-bold tracking-[0.34em] text-emerald-300">TENNIS</div>
          </Link>
          <div className="flex items-center gap-2 md:hidden">
            {user ? (
              <>
                <NotificationCenter compact />
                <Button
                  onClick={logout}
                  className="bg-white/10 px-3 py-2 text-xs text-white hover:bg-white/15"
                >
                  <LogOut size={15} />
                  Sortir
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
          <div className="hidden items-center gap-3 text-sm text-slate-300 md:flex">
            {user ? <NotificationCenter /> : null}
            {player ? (
              <span className="rounded-md bg-white/[0.08] px-3 py-1">
                Énergie {player.actionEnergy}/{player.actionEnergyMax}
              </span>
            ) : null}
            {player ? (
              <span className="rounded-md bg-white/[0.08] px-3 py-1">{player.gems} gemmes</span>
            ) : null}
            {user ? (
              <Button onClick={logout} className="bg-white/10 text-white hover:bg-white/15">
                <LogOut size={16} />
                Déconnexion
              </Button>
            ) : (
              <Link
                to="/login"
                className="rounded-md bg-emerald-400 px-4 py-2 font-semibold text-slate-950"
              >
                Connexion
              </Link>
            )}
          </div>
        </div>
      </header>
      <div
        className={`mx-auto grid max-w-7xl gap-5 px-4 py-5 ${
          showSidebar ? "lg:grid-cols-[250px_1fr]" : ""
        }`}
      >
        {showSidebar ? (
          <aside className="panel h-fit p-2">
            <nav className="grid gap-1">
              {nav.map(([label, path, Icon]) => (
                <NavLink
                  key={path}
                  to={path}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-md px-3 py-2 text-sm transition ${isActive ? "bg-emerald-400 text-slate-950" : "text-slate-300 hover:bg-white/[0.08] hover:text-white"}`
                  }
                >
                  <Icon size={17} />
                  <span className="min-w-0 flex-1">{label}</span>
                  {navBadges[path] ? (
                    <span className="grid h-5 min-w-5 place-items-center rounded-full bg-emerald-300 px-1 text-[11px] font-black text-slate-950">
                      {navBadges[path]}
                    </span>
                  ) : null}
                </NavLink>
              ))}
            </nav>
          </aside>
        ) : null}
        <main>{children}</main>
      </div>
      <footer className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-3 px-4 pb-5 text-center text-[11px] font-black uppercase tracking-[0.28em] text-slate-500">
        <span>KILIM GAMES PRODUCTION</span>
        <span className="text-slate-700">·</span>
        <Link className="transition hover:text-emerald-300" to="/community">
          Communauté
        </Link>
      </footer>
    </div>
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
      <section className="panel p-5">
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
  const store = useGameStore();
  function startGoogle() {
    window.location.href = `${API_URL}/auth/google/start?mode=${mode}`;
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    try {
      if (mode === "login") await store.login(email, password);
      else await store.signup(displayName, email, password);
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
      <h1 className="text-2xl font-black">Création du joueur</h1>
      <form onSubmit={submit} className="mt-5 grid gap-4 md:grid-cols-2">
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
                <p className="text-sm font-semibold text-slate-200">Choisir une Personal Picture</p>
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
                <p className="rounded-md bg-red-500/15 p-3 text-sm text-red-100">{pictureError}</p>
              ) : null}
            </div>
          </div>
        </section>
        <Button type="submit" className="md:col-span-2">
          <Shield size={17} /> Lancer la carrière
        </Button>
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

const tutorialSteps = [
  {
    title: "Récupérer les sacs de départ",
    body: "Votre carrière commence avec 2 sacs Bronze, 1 sac Argent et 1 sac Or. Les Bronze sont ouvrables immédiatement, les autres suivent leur timer.",
    action: "Voir les sacs",
    path: "/dashboard"
  },
  {
    title: "Comprendre la collection",
    body: "Les sacs donnent des cartes de statistiques. Les doublons remplissent des paliers exponentiels, puis chaque bonus +1 doit être débloqué avec de l'argent.",
    action: "Ouvrir la collection",
    path: "/collection"
  },
  {
    title: "Lancer un duel",
    body: "Le duel coûte 1 point d'énergie et propose 3 adversaires proches de votre classement. C'est le moyen rapide de tester votre fiche joueur.",
    action: "Choisir un adversaire",
    path: "/duel"
  },
  {
    title: "Jouer la saison",
    body: "La saison dure 30 jours réels. Les compétitions officielles servent à construire votre parcours FFT de NC jusqu'à -15.",
    action: "Voir la saison",
    path: "/season"
  },
  {
    title: "Suivre le classement",
    body: "Dans Mon joueur, la simulation FFT reprend vos résultats officiels. Le but amateur est de valider -15 avant d'entrer dans le circuit pro.",
    action: "Voir mon joueur",
    path: "/player"
  }
];

function TutorialModal({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0);
  const navigate = useNavigate();
  const current = tutorialSteps[step] ?? tutorialSteps[0];
  const last = step >= tutorialSteps.length - 1;

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
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/78 px-4 backdrop-blur">
      <section className="panel w-full max-w-xl p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.24em] text-emerald-300">
              Tutoriel
            </p>
            <h2 className="mt-1 text-2xl font-black">Premiers pas dans MyPro</h2>
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
            <CheckCircle2 size={24} />
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

function Dashboard() {
  const player = useGameStore((state) => state.player)!;
  const [tutorialOpen, setTutorialOpen] = useState(
    () =>
      localStorage.getItem("mypro-tutorial-active") === "1" &&
      localStorage.getItem("mypro-tutorial-done") !== "1"
  );
  const chart = useMemo(
    () =>
      profileStatKeys.map((key) => ({
        name: dashboardRadarLabels[key],
        fullName: statLabels[key],
        value: Math.round(stat(player, key))
      })),
    [player]
  );
  function openTutorial() {
    localStorage.setItem("mypro-tutorial-active", "1");
    setTutorialOpen(true);
  }
  return (
    <div className="grid gap-5">
      <section className="panel grid gap-5 p-5 lg:grid-cols-[1fr_430px]">
        <div>
          <p className="text-sm text-emerald-300">Carrière active</p>
          <h1 className="text-3xl font-black">{player.name}</h1>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button className="bg-white/10 text-white hover:bg-white/15" onClick={openTutorial}>
              <CheckCircle2 size={16} /> Parcours tutoriel
            </Button>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <Metric label="Niveau" value={player.overall} />
            <Metric label="Rang mondial" value={player.worldRank} />
            <Metric label="Budget" value={`${player.budget} €`} />
            <Metric label="Cash prize carrière" value={`${player.careerCashPrizeWon} €`} />
            <Metric label="Points" value={player.rankingPoints} />
          </div>
        </div>
        <div className="min-h-[320px]">
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-emerald-300">
              Radar des 12 stats
            </p>
            <p className="text-xs text-slate-400">Échelle 0-100</p>
          </div>
          <ResponsiveContainer width="100%" height={290}>
            <RadarChart data={chart} outerRadius="67%">
              <PolarGrid stroke="#ffffff22" />
              <PolarAngleAxis dataKey="name" tick={{ fill: "#d6e4ef", fontSize: 11 }} />
              <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} axisLine={false} />
              <Tooltip
                contentStyle={{
                  background: "#0f172a",
                  border: "1px solid #1f4f5a",
                  borderRadius: 8,
                  color: "#f8fafc"
                }}
                formatter={(value) => [`${value}/100`, "Valeur"]}
                labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName ?? ""}
              />
              <Radar
                dataKey="value"
                stroke="#5eead4"
                strokeWidth={2}
                fill="#34d399"
                fillOpacity={0.34}
                dot={{ r: 3, fill: "#ecfeff", stroke: "#0f766e", strokeWidth: 1 }}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </section>
      <TennisBagSlots />
      <CareerPathCard player={player} />
      <section className="grid gap-5 lg:grid-cols-2">
        <ActionEnergyCard player={player} />
        <article className="panel p-5">
          <h2 className="font-bold">Prochain objectif</h2>
          <p className="mt-2 text-sm text-slate-300">
            Lancez un duel pour tester votre progression contre un adversaire au classement juste
            inférieur.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              className="rounded-md bg-emerald-400 px-4 py-2 font-semibold text-slate-950"
              to="/duel"
            >
              Lancer un duel
            </Link>
          </div>
        </article>
      </section>
      {tutorialOpen ? <TutorialModal onClose={() => setTutorialOpen(false)} /> : null}
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
  const [career, setCareer] = useState<CareerProfile | null>(null);
  const [avatarEditorOpen, setAvatarEditorOpen] = useState(false);
  const [profileEditorOpen, setProfileEditorOpen] = useState(false);
  const topStats = profileStatKeys
    .map((key) => ({ key, value: stat(player, key) }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 3);
  useEffect(() => void api<CareerProfile>("/players/me/career").then(setCareer), []);
  return (
    <div className="grid gap-5 lg:grid-cols-[330px_1fr]">
      <section className="panel p-5">
        <div className="flex items-start justify-between gap-4">
          <ProfilePicture avatar={player.avatar} size="lg" />
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
        <h1 className="mt-4 text-2xl font-black">{player.name}</h1>
        <p className="text-slate-300">
          {nationalityLabel(player.nationality)} · {player.fftRanking} · Niveau {player.overall}
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <Metric label="Victoires" value={player.wins} />
          <Metric label="Défaites" value={player.losses} />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <Metric label="Titres" value={career?.palmares.titles ?? "..."} />
          <Metric label="Simulation" value={career?.rankingSimulation.simulatedRanking ?? "..."} />
        </div>
      </section>
      <section className="panel p-5">
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
      <CareerPathCard player={player} />
      <PlayerPalmaresCard career={career} />
      <RankingSimulationCard career={career} player={player} />
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
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/78 px-4 backdrop-blur">
      <form className="panel max-h-[92vh] w-full max-w-2xl overflow-auto p-6" onSubmit={save}>
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
          <Button className="bg-white/10 text-white hover:bg-white/15" onClick={onClose} type="button">
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
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/78 px-4 backdrop-blur">
      <section className="panel max-h-[92vh] w-full max-w-2xl overflow-auto p-6">
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

function CollectionPage() {
  const [data, setData] = useState<ChestState | null>(null);
  const refreshPlayer = useGameStore((state) => state.refresh);
  const [busyCosmetic, setBusyCosmetic] = useState<string | null>(null);
  const [busyCard, setBusyCard] = useState<string | null>(null);
  const [slotPicker, setSlotPicker] = useState<number | null>(null);
  const [collectionMessage, setCollectionMessage] = useState("");

  async function loadCollection() {
    setData(await api<ChestState>("/chests"));
  }

  useEffect(() => void loadCollection(), []);

  async function equip(item: PlayerCosmeticItem, slotIndex: number) {
    setBusyCosmetic(item.id);
    try {
      await api(`/cosmetics/${item.id}/equip`, {
        method: "POST",
        body: JSON.stringify({ slotIndex })
      });
      await loadCollection();
      await refreshPlayer();
      setSlotPicker(null);
    } finally {
      setBusyCosmetic(null);
    }
  }

  async function unequip(item: PlayerCosmeticItem) {
    setBusyCosmetic(item.id);
    try {
      await api(`/cosmetics/${item.id}/unequip`, { method: "POST" });
      await loadCollection();
      await refreshPlayer();
    } finally {
      setBusyCosmetic(null);
    }
  }

  async function unlockCard(statKey: string) {
    setBusyCard(statKey);
    setCollectionMessage("");
    try {
      setData(await api<ChestState>(`/cards/${statKey}/unlock`, { method: "POST" }));
      await refreshPlayer();
      setCollectionMessage("Bonus de carte débloqué.");
    } catch (error) {
      setCollectionMessage(error instanceof Error ? error.message : "Déblocage impossible.");
    } finally {
      setBusyCard(null);
    }
  }

  const equipped = Array.from({ length: 4 }, (_, slotIndex) => ({
    slotIndex,
    item: data?.cosmetics.find((cosmetic) => cosmetic.equippedSlot === slotIndex) ?? null
  }));
  const sortedCosmetics = sortCosmeticsByRarity(data?.cosmetics ?? []);
  const totalEquipmentBonus = (data?.cosmetics ?? [])
    .filter((item) => item.equippedSlot !== null)
    .reduce(
      (sum, item) => sum + Object.values(item.bonuses).reduce((inner, value) => inner + value, 0),
      0
    );

  return (
    <div className="grid gap-5">
      <section className="panel p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm text-emerald-300">Inventaire joueur</p>
            <h1 className="text-2xl font-black">Collection</h1>
          </div>
          <div className="inline-flex items-center gap-2 rounded-md bg-white/[0.08] px-3 py-1 text-sm text-slate-200">
            <Gem size={15} /> {data?.gems ?? 0} gemmes
          </div>
        </div>
      </section>
      {collectionMessage ? (
        <div className="panel p-4 text-sm text-emerald-100">{collectionMessage}</div>
      ) : null}
      <section className="panel p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm text-emerald-300">Équipement</p>
            <h2 className="font-bold">4 objets cosmétiques actifs maximum</h2>
          </div>
          <div className="rounded-md bg-emerald-300 px-3 py-1 text-sm font-black text-slate-950">
            +{totalEquipmentBonus} stats actives
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {equipped.map(({ slotIndex, item }) => (
            <div key={slotIndex} className="metric min-h-36">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs uppercase tracking-[0.18em] text-slate-400">
                    Slot {slotIndex + 1}
                  </div>
                  <div className="mt-1 font-black">{item?.name ?? "Emplacement vide"}</div>
                </div>
                {item ? (
                  <span
                    className={`rounded-md px-2 py-1 text-xs font-black ${rarityClass(item.rarity)}`}
                  >
                    {item.rarity}
                  </span>
                ) : null}
              </div>
              <div className="mt-3 text-sm text-slate-300">
                {item ? (
                  <StatBonusPills bonuses={item.bonuses} />
                ) : (
                  "Équipez un objet depuis l'inventaire."
                )}
              </div>
              {item ? (
                <button
                  className="mt-4 rounded-md bg-white/10 px-3 py-2 text-sm font-bold text-white transition hover:bg-white/15 disabled:opacity-50"
                  onClick={() => unequip(item)}
                  disabled={busyCosmetic === item.id}
                  type="button"
                >
                  Retirer
                </button>
              ) : (
                <button
                  className="mt-4 rounded-md border border-emerald-300/40 bg-emerald-300/10 px-3 py-2 text-sm font-bold text-emerald-100 transition hover:bg-emerald-300/18"
                  onClick={() => setSlotPicker(slotIndex)}
                  type="button"
                >
                  Choisir un objet
                </button>
              )}
            </div>
          ))}
        </div>
      </section>
      <section className="panel p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-emerald-300">Cartes de statistiques</p>
            <h2 className="font-bold">Progression permanente</h2>
          </div>
          <Sparkles size={20} />
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {(data?.cards ?? []).map((card) => {
            const progress = Math.max(
              0,
              Math.min(100, (card.copiesIntoLevel / Math.max(1, card.copiesNeeded)) * 100)
            );
            const readyLabel = card.unlockable
              ? `Palier ${card.level + 1} prêt`
              : `${card.remaining} doublon(s) avant le prochain palier`;
            return (
              <div key={card.statKey} className="metric">
                <div className="flex justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <StatIcon statKey={card.statKey} />
                    <div className="min-w-0">
                      <div className="truncate font-bold">{card.label}</div>
                      <div className="text-xs text-slate-400">
                        {card.copies} doublon(s) collecté(s)
                      </div>
                    </div>
                  </div>
                  <div className="rounded-md bg-white/[0.08] px-2 py-1 text-sm font-black text-emerald-300">
                    +{card.level}
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300">
                  <span>Bonus débloqué +{card.level}</span>
                  <span>Palier atteint +{card.earnedLevel}</span>
                </div>
                <div className="mt-3 h-2 rounded-full bg-white/[0.08]">
                  <div
                    className="h-full rounded-full bg-emerald-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="mt-2 text-xs text-slate-400">{readyLabel}</div>
                {card.unlockable ? (
                  <Button
                    className="mt-3 w-full justify-center"
                    onClick={() => unlockCard(card.statKey)}
                    disabled={busyCard === card.statKey}
                  >
                    {busyCard === card.statKey
                      ? "Déblocage..."
                      : `Débloquer +1 · ${card.unlockCost} €`}
                  </Button>
                ) : null}
              </div>
            );
          })}
        </div>
      </section>
      <section className="panel p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-emerald-300">Avatar</p>
            <h2 className="font-bold">Inventaire cosmétique</h2>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-300">
            <span className="rounded-md bg-white/[0.08] px-3 py-1">Tri : rareté</span>
            <PackageOpen size={20} />
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {sortedCosmetics.length ? (
            sortedCosmetics.map((item) => (
              <div key={item.id} className={`metric ${rarityClass(item.rarity)}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs uppercase tracking-[0.18em] text-slate-400">
                      {item.rarity}
                    </div>
                    <div className="mt-1 font-black">{item.name}</div>
                  </div>
                  {item.equippedSlot !== null ? (
                    <span className="rounded-md bg-emerald-300 px-2 py-1 text-xs font-black text-slate-950">
                      Slot {item.equippedSlot + 1}
                    </span>
                  ) : null}
                </div>
                <div className="mt-3">
                  <StatBonusPills bonuses={item.bonuses} />
                </div>
                <div className="mt-4 grid grid-cols-4 gap-2">
                  {[0, 1, 2, 3].map((slotIndex) => (
                    <button
                      key={slotIndex}
                      className="rounded-md border border-white/10 bg-white/[0.05] px-2 py-2 text-xs font-black text-white transition hover:bg-white/[0.1] disabled:opacity-40"
                      onClick={() => equip(item, slotIndex)}
                      disabled={busyCosmetic === item.id || item.equippedSlot === slotIndex}
                      type="button"
                    >
                      {slotIndex + 1}
                    </button>
                  ))}
                </div>
                {item.equippedSlot !== null ? (
                  <button
                    className="mt-3 rounded-md bg-white/10 px-3 py-2 text-sm font-bold text-white transition hover:bg-white/15 disabled:opacity-50"
                    onClick={() => unequip(item)}
                    disabled={busyCosmetic === item.id}
                    type="button"
                  >
                    Retirer l'objet
                  </button>
                ) : null}
              </div>
            ))
          ) : (
            <div className="rounded-md border border-dashed border-white/15 p-4 text-sm text-slate-400">
              Aucun cosmétique débloqué pour le moment.
            </div>
          )}
        </div>
      </section>
      {slotPicker !== null ? (
        <CosmeticSlotPicker
          slotIndex={slotPicker}
          cosmetics={sortedCosmetics}
          busyCosmetic={busyCosmetic}
          onClose={() => setSlotPicker(null)}
          onEquip={equip}
        />
      ) : null}
    </div>
  );
}

function CosmeticSlotPicker({
  slotIndex,
  cosmetics,
  busyCosmetic,
  onClose,
  onEquip
}: {
  slotIndex: number;
  cosmetics: PlayerCosmeticItem[];
  busyCosmetic: string | null;
  onClose: () => void;
  onEquip: (item: PlayerCosmeticItem, slotIndex: number) => Promise<void>;
}) {
  return createPortal(
    <div className="fixed inset-0 z-[9999] grid place-items-center overflow-y-auto bg-slate-950/82 p-4 backdrop-blur">
      <section className="panel relative max-h-[calc(100vh-2rem)] w-full max-w-3xl overflow-auto p-6 shadow-2xl shadow-black/60">
        <button
          className="absolute right-4 top-4 rounded-md bg-white/10 p-2 text-slate-200 hover:bg-white/15"
          onClick={onClose}
          aria-label="Fermer l'inventaire"
          type="button"
        >
          <X size={18} />
        </button>
        <div className="pr-10">
          <p className="text-sm font-bold uppercase tracking-[0.24em] text-emerald-300">
            Équipement
          </p>
          <h2 className="mt-1 text-2xl font-black">
            Choisir un objet pour le slot {slotIndex + 1}
          </h2>
          <p className="mt-2 text-sm text-slate-300">
            Inventaire trié par rareté, du plus précieux au plus commun.
          </p>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {cosmetics.length ? (
            cosmetics.map((item) => (
              <button
                key={item.id}
                className={`metric text-left transition hover:bg-white/[0.08] disabled:opacity-50 ${rarityClass(item.rarity)}`}
                onClick={() => onEquip(item, slotIndex)}
                disabled={busyCosmetic === item.id || item.equippedSlot === slotIndex}
                type="button"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs uppercase tracking-[0.18em] text-slate-400">
                      {item.rarity}
                    </div>
                    <div className="mt-1 font-black">{item.name}</div>
                  </div>
                  {item.equippedSlot !== null ? (
                    <span className="rounded-md bg-emerald-300 px-2 py-1 text-xs font-black text-slate-950">
                      Slot {item.equippedSlot + 1}
                    </span>
                  ) : null}
                </div>
                <div className="mt-3">
                  <StatBonusPills bonuses={item.bonuses} />
                </div>
                <div className="mt-3 text-xs font-bold text-slate-300">
                  {item.equippedSlot === slotIndex
                    ? "Déjà équipé ici"
                    : item.equippedSlot !== null
                      ? `Déplacer vers le slot ${slotIndex + 1}`
                      : `Équiper dans le slot ${slotIndex + 1}`}
                </div>
              </button>
            ))
          ) : (
            <div className="rounded-md border border-dashed border-white/15 p-4 text-sm text-slate-400">
              Aucun cosmétique débloqué pour le moment.
            </div>
          )}
        </div>
      </section>
    </div>,
    document.body
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
  if (!competition.entry) return null;
  const title =
    competition.type === "individual" ? "Parcours du championnat" : "Tableau du tournoi";
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/78 px-4 backdrop-blur">
      <div className="panel max-h-[92vh] w-full max-w-6xl overflow-auto p-5">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/10 pb-4">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-emerald-300">
              {competition.title}
            </p>
            <h2 className="text-2xl font-black">{title}</h2>
            <p className="mt-2 text-sm text-slate-300">
              Inscription payée : {competition.entry.entryFee.toLocaleString("fr-FR")} € · Cash
              prize : {competition.entry.cashPrize.toLocaleString("fr-FR")} €
            </p>
          </div>
          <Button onClick={onClose} className="justify-center">
            <X size={16} /> Fermer
          </Button>
        </div>
        {competition.type === "individual" ? (
          <ChampionshipJourney entry={competition.entry} />
        ) : (
          <TournamentBracket entry={competition.entry} playerRanking={player.fftRanking} />
        )}
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
      <div className="mt-3 overflow-x-auto pb-1">
        <div className="grid min-w-[980px] grid-cols-[1.4fr_1fr_1fr_1fr_1fr] gap-3">
          <div>
            <BracketColumnTitle label="Branches" />
            <div className="grid gap-2">
              {bracketRounds[0]?.matches.map((match, index) => {
                const pair = [match.left, match.right];
                return (
                  <div
                    key={index}
                    className="rounded-md border border-white/10 bg-white/[0.04] p-2"
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
                        className={`rounded-md border p-3 text-sm ${
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
                      className={`rounded-md border p-3 text-sm ${match.playedByPlayer ? "border-cyan-300 bg-cyan-300/10" : "border-white/10 bg-white/[0.04]"}`}
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

function SeasonPage() {
  const [data, setData] = useState<SeasonData | null>(null);
  const [message, setMessage] = useState("");
  const [selectedCompetition, setSelectedCompetition] = useState<SeasonCompetition | null>(null);
  const refresh = useGameStore((state) => state.refresh);
  const navigate = useNavigate();
  async function load() {
    setData(await api<SeasonData>("/season"));
  }
  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 60_000);
    return () => window.clearInterval(timer);
  }, []);
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
      await Promise.all([load(), refresh()]);
      navigate(`/match/${result.match.id}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Match impossible.");
    }
  }
  if (!data) return <section className="panel p-5">Chargement de la saison...</section>;
  return (
    <div className="grid gap-5">
      <section className="panel p-5">
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
      {message ? <div className="panel p-4 text-sm text-emerald-100">{message}</div> : null}
      <section className="grid gap-4 lg:grid-cols-3">
        {data.competitions.map((competition) => {
          const entry = competition.entry;
          const nextRanking =
            entry?.bracket.mode === "pyramide"
              ? entry.bracket.path?.[entry.currentRound]?.ranking
              : entry?.bracket.opponents?.[entry.currentRound]?.ranking;
          const statusLabel = entry
            ? (entry.championTitle ?? entry.status.replaceAll("_", " "))
            : "Non inscrit";
          const nextAt = competition.nextPlayableAt ? new Date(competition.nextPlayableAt) : null;
          const periodEnd = new Date(competition.currentPeriodEndsAt);
          const entryFee = entry?.entryFee ?? competition.entryFee;
          const cashPrize = entry?.cashPrize ?? competition.cashPrize;
          const availabilityLabel = entry
            ? competition.type === "individual"
              ? "Prochain championnat"
              : "Prochaine inscription"
            : "Disponibilité";
          return (
            <article key={competition.type} className="panel p-5">
              <h2 className="text-xl font-black">{competition.title}</h2>
              <p className="text-emerald-300">
                {competition.frequency} · {competition.energyCost} énergie
              </p>
              <p className="mt-3 min-h-[48px] text-sm text-slate-300">{competition.subtitle}</p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <Metric
                  label="Format"
                  value={competition.type === "individual" ? "Pyramide FFT" : "Tableau 16"}
                />
                <Metric label="Statut" value={statusLabel} />
                <Metric label="Meilleur" value={competition.rankingRange.best} />
                <Metric label="Moins bon" value={competition.rankingRange.worst} />
                <Metric label="Inscription" value={`${entryFee.toLocaleString("fr-FR")} €`} />
                <Metric label="Cash prize" value={`${cashPrize.toLocaleString("fr-FR")} €`} />
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
                  disabled={["ELIMINE", "VAINQUEUR", "CHAMPION_NATIONAL"].includes(entry.status)}
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
        })}
      </section>
      {selectedCompetition ? (
        <SeasonEntryDetails
          competition={selectedCompetition}
          player={data.player}
          onClose={() => setSelectedCompetition(null)}
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
              <Metric label="Dotation" value={`${tournament.prize} ?`} />
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
  return (
    <section className="panel overflow-hidden">
      <div className="p-5">
        <h1 className="text-2xl font-black">Classement mondial fictif</h1>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-white/5 text-slate-300">
            <tr>
              <th className="p-3">Rang</th>
              <th>Joueur</th>
              <th>Nat.</th>
              <th>Niveau</th>
              <th>Points</th>
              <th>Bilan</th>
            </tr>
          </thead>
          <tbody>
            {players.map((player) => (
              <tr key={player.id} className="border-t border-white/[0.08]">
                <td className="p-3 font-bold">{player.rank}</td>
                <td>
                  <Link to={`/profile/${player.id}`} className="text-emerald-300">
                    {player.name}
                  </Link>
                </td>
                <td>{nationalityLabel(player.nationality)}</td>
                <td>{player.overall}</td>
                <td>{player.rankingPoints}</td>
                <td>
                  {player.wins}V · {player.losses}D
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ClubPlayerRow({ player, badge }: { player: ClubPlayerSummary; badge?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-white/10 bg-white/[0.04] p-3">
      <div className="flex min-w-0 items-center gap-3">
        <ProfilePicture avatar={player.avatar} size="sm" />
        <div className="min-w-0">
          <Link
            to={`/profile/${player.id}`}
            className="font-bold text-white hover:text-emerald-300"
          >
            {player.name}
          </Link>
          <p className="text-sm text-slate-300">
            {nationalityLabel(player.nationality)} · {player.fftRanking} · Niveau{" "}
            {player.overall}
          </p>
        </div>
      </div>
      {badge ? <div className="shrink-0">{badge}</div> : null}
    </div>
  );
}

function TeamChampionshipPanel({ club }: { club: ClubDetails }) {
  const refresh = useGameStore((state) => state.refresh);
  const [data, setData] = useState<TeamChampionshipData | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function loadTeamChampionship() {
    try {
      setData(await api<TeamChampionshipData>("/clubs/team-championship"));
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Championnat par équipe momentanément indisponible."
      );
      setData({
        divisions: [],
        club: null,
        team: null,
        championship: null,
        dues: fallbackDuesState(club),
        canCreateTeam: false,
        canStartChampionship: false
      });
    }
  }

  useEffect(() => void loadTeamChampionship(), []);

  async function createTeam() {
    setMessage("");
    setBusy(true);
    try {
      await api("/clubs/team", { method: "POST" });
      await loadTeamChampionship();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Création de l'équipe impossible.");
    } finally {
      setBusy(false);
    }
  }

  async function startChampionship() {
    setMessage("");
    setBusy(true);
    try {
      await api("/clubs/team/championship", { method: "POST" });
      await loadTeamChampionship();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Inscription impossible.");
    } finally {
      setBusy(false);
    }
  }

  async function payDues() {
    setMessage("");
    setBusy(true);
    try {
      await api("/clubs/dues/pay", { method: "POST" });
      await refresh();
      await loadTeamChampionship();
      setMessage("Cotisation payée. Le budget du club a été crédité.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Paiement impossible.");
    } finally {
      setBusy(false);
    }
  }

  if (!data)
    return <section className="panel p-5">Championnat par équipe en chargement...</section>;

  const championship = data.championship;
  const nextMeeting = championship?.nextMeeting;
  const playerStanding = championship?.standings.find((entry) => entry.isPlayerClub);
  const lowestDivision = data.divisions[0] ?? "";
  const highestDivision = data.divisions[data.divisions.length - 1] ?? "";
  const promotionEnabled = Boolean(championship && championship.division !== highestDivision);
  const relegationEnabled = Boolean(championship && championship.division !== lowestDivision);
  const relegationRank = championship?.standings.length ?? 0;
  const dues = fallbackDuesState(club, data);
  const duesWindowLabel =
    dues.windowOpensAt && dues.windowClosesAt
      ? `${new Date(dues.windowOpensAt).toLocaleString("fr-FR")} → ${new Date(
          dues.windowClosesAt
        ).toLocaleString("fr-FR")}`
      : "À partir de 7 jours avant le prochain championnat";

  return (
    <section className="panel p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-emerald-300">
            Championnat par équipe
          </p>
          <h2 className="mt-1 text-2xl font-black">
            {data.team ? data.team.name : "Aucune équipe créée"}
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-slate-300">
            Une équipe compte 5 joueurs. Le championnat réunit 13 équipes, avec une rencontre par
            jour à 18h30 et une éventuelle journée exempt. Chaque rencontre se joue en 5 simples, du
            Simple 1 au Simple 5, selon la hiérarchie FFT des titulaires.
          </p>
        </div>
        {!data.team ? (
          <Button disabled={!data.canCreateTeam || busy} onClick={() => void createTeam()}>
            Créer l'équipe
          </Button>
        ) : data.canStartChampionship ? (
          <Button disabled={busy} onClick={() => void startChampionship()}>
            Lancer le prochain championnat
          </Button>
        ) : null}
      </div>

      {message ? (
        <div className="mt-4 rounded-md border border-amber-300/30 bg-amber-300/10 p-3 text-sm text-amber-100">
          {message}
        </div>
      ) : null}

      <article className="mt-4 rounded-md border border-white/10 bg-white/[0.04] p-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="font-black">Cotisation championnat</h3>
            <p className="mt-1 text-sm text-slate-300">
              Elle donne accès aux futures infrastructures du club, aux améliorations du club et à
              l'éligibilité pour la titularisation en championnat par équipe.
            </p>
            <p className="mt-2 text-xs text-slate-400">Fenêtre : {duesWindowLabel}</p>
          </div>
          <div className="grid gap-2 text-right">
            <strong className="text-2xl">{dues.amount.toLocaleString("fr-FR")} €</strong>
            <span className="text-sm text-slate-300">
              {dues.amount === 0
                ? "Aucune cotisation"
                : dues.currentPlayerPaid
                  ? "Cotisation payée"
                  : dues.isWindowOpen
                    ? "Paiement ouvert"
                    : "Paiement fermé"}
            </span>
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Metric label="Joueurs à jour" value={`${dues.eligibleCount}/${club.memberCount}`} />
          <Metric
            label="Budget club"
            value={`${(data.club?.budget ?? club.budget).toLocaleString("fr-FR")} €`}
          />
          <Metric
            label="Statut"
            value={
              dues.amount === 0 ? "Accès libre" : dues.currentPlayerPaid ? "À jour" : "Non payé"
            }
          />
        </div>
        {dues.currentPlayerCanPay ? (
          <Button className="mt-4" disabled={busy} onClick={() => void payDues()}>
            Payer ma cotisation · {dues.amount.toLocaleString("fr-FR")} €
          </Button>
        ) : null}
      </article>

      {!data.team ? (
        <div className="mt-4 rounded-md border border-white/10 bg-white/[0.04] p-4 text-sm text-slate-300">
          {club.memberCount >= 5
            ? club.isPresident
              ? "Le club a assez de joueurs pour créer sa première équipe."
              : "Le club a assez de joueurs. Le président doit créer l'équipe."
            : `Il faut encore ${5 - club.memberCount} joueur(s) pour créer la première équipe.`}
        </div>
      ) : (
        <div className="mt-5 grid gap-5">
          <div className="grid gap-3 sm:grid-cols-4">
            <Metric label="Division" value={data.team.division} />
            <Metric
              label="Titulaires"
              value={
                dues.amount > 0 && championship
                  ? `${Math.min(dues.eligibleCount, 5)}/5 à jour`
                  : `${data.team.members.length}/5`
              }
            />
            <Metric label="Classement" value={playerStanding ? `${playerStanding.rank}e` : "-"} />
            <Metric label="Points" value={playerStanding?.points ?? 0} />
          </div>

          <div className="grid gap-3 md:grid-cols-5">
            {data.team.members.map((member) => (
              <ClubPlayerRow
                key={member.id}
                player={member.player}
                badge={
                  <span className="rounded-md bg-emerald-300/10 px-2 py-1 text-xs font-bold text-emerald-100">
                    N°{member.slotIndex}
                    {dues.amount > 0 && championship
                      ? (member.duesPaid ?? dues.amount === 0)
                        ? " · À jour"
                        : " · Non payé"
                      : ""}
                  </span>
                }
              />
            ))}
          </div>

          {championship ? (
            <div className="grid gap-5 xl:grid-cols-[420px_1fr]">
              <article className="rounded-md border border-white/10 bg-white/[0.04] p-4">
                <h3 className="font-black">Classement de la division</h3>
                <p className="mt-1 text-sm text-slate-300">
                  Du {new Date(championship.startsAt).toLocaleString("fr-FR")} au{" "}
                  {new Date(championship.endsAt).toLocaleString("fr-FR")}
                </p>
                <p className="mt-2 text-xs text-slate-400">
                  Classement : victoires, différence de sets, différence de jeux, tirage ·{" "}
                  {promotionEnabled ? "1er promu" : "Pas de montée en Elite 1"} ·{" "}
                  {relegationEnabled ? "13e relégué" : "Pas de relégation en Départementale 4"}
                </p>
                {nextMeeting ? (
                  <p className="mt-2 rounded-md bg-emerald-300/10 p-2 text-sm text-emerald-100">
                    Prochaine journée : J{nextMeeting.round} ·{" "}
                    {new Date(nextMeeting.startsAt).toLocaleString("fr-FR")}
                  </p>
                ) : null}
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="text-slate-400">
                      <tr>
                        <th className="py-2">#</th>
                        <th>Club</th>
                        <th>Pts</th>
                        <th>V</th>
                        <th>Sets</th>
                        <th>Jeux</th>
                        <th>Sort</th>
                      </tr>
                    </thead>
                    <tbody>
                      {championship.standings.map((entry) => {
                        const movement =
                          entry.rank === 1 && promotionEnabled
                            ? "Montée"
                            : entry.rank === relegationRank && relegationEnabled
                              ? "Descente"
                              : "";
                        return (
                          <tr
                            key={entry.id}
                            className={`border-t border-white/10 ${
                              entry.isPlayerClub ? "text-emerald-200" : "text-slate-200"
                            }`}
                          >
                            <td className="py-2 font-bold">{entry.rank}</td>
                            <td>
                              [{entry.tag}] {entry.name}
                            </td>
                            <td className="font-bold">{entry.points}</td>
                            <td>{entry.wins}</td>
                            <td>{entry.setsFor - entry.setsAgainst}</td>
                            <td>{entry.gamesFor - entry.gamesAgainst}</td>
                            <td>
                              {movement ? (
                                <span
                                  className={`rounded-md px-2 py-1 text-xs font-bold ${
                                    movement === "Montée"
                                      ? "bg-emerald-300/10 text-emerald-100"
                                      : "bg-rose-300/10 text-rose-100"
                                  }`}
                                >
                                  {movement}
                                </span>
                              ) : (
                                "-"
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </article>

              <article className="rounded-md border border-white/10 bg-white/[0.04] p-4">
                <h3 className="font-black">Calendrier des rencontres</h3>
                <div className="mt-4 grid max-h-[520px] gap-2 overflow-y-auto pr-1">
                  {championship.meetings.map((meeting) => {
                    const home = meeting.home
                      ? `[${meeting.home.tag}] ${meeting.home.name}`
                      : "Exempt";
                    const away = meeting.away
                      ? `[${meeting.away.tag}] ${meeting.away.name}`
                      : "Exempt";
                    const involvesPlayerClub = Boolean(
                      meeting.home?.isPlayerClub || meeting.away?.isPlayerClub
                    );
                    return (
                      <div
                        key={meeting.id}
                        className={`rounded-md border p-3 text-sm ${
                          involvesPlayerClub
                            ? "border-emerald-300/40 bg-emerald-300/10"
                            : "border-white/10 bg-slate-950/30"
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <strong>J{meeting.round}</strong>
                          <span className="text-slate-400">
                            {new Date(meeting.startsAt).toLocaleString("fr-FR")}
                          </span>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                          <span>{home}</span>
                          <strong>
                            {meeting.status === "COMPLETED"
                              ? `${meeting.scoreHome} - ${meeting.scoreAway}`
                              : meeting.status === "EXEMPT"
                                ? "Exempt"
                                : "18h30"}
                          </strong>
                          <span>{away}</span>
                        </div>
                        {meeting.details?.singles?.length ? (
                          <div className="mt-3 grid gap-1 border-t border-white/10 pt-3">
                            {meeting.details.singles.map((single) => (
                              <div
                                key={single.label}
                                className="grid gap-2 rounded-md bg-slate-950/35 px-2 py-2 text-xs text-slate-300 md:grid-cols-[72px_1fr_44px_1fr]"
                              >
                                <strong className="text-slate-100">{single.label}</strong>
                                <span
                                  className={
                                    single.winner === "home" ? "font-bold text-emerald-200" : ""
                                  }
                                >
                                  {single.homePlayer.name} · {single.homePlayer.fftRanking}
                                </span>
                                <span className="text-center font-black text-white">
                                  {single.winner === "home" ? "1-0" : "0-1"}
                                </span>
                                <span
                                  className={
                                    single.winner === "away" ? "font-bold text-emerald-200" : ""
                                  }
                                >
                                  {single.awayPlayer.name} · {single.awayPlayer.fftRanking}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </article>
            </div>
          ) : (
            <div className="rounded-md border border-white/10 bg-white/[0.04] p-4 text-sm text-slate-300">
              Aucun championnat planifié. Le président peut inscrire l'équipe au prochain cycle.
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function ClubPage() {
  const player = useGameStore((state) => state.player)!;
  const refresh = useGameStore((state) => state.refresh);
  const [data, setData] = useState<MyClubData | null>(null);
  const [clubs, setClubs] = useState<ClubListItem[]>([]);
  const [form, setForm] = useState({
    name: "",
    tag: "",
    description: "",
    minimumRanking: "NC",
    duesAmount: 0
  });
  const [settingsForm, setSettingsForm] = useState({
    description: "",
    minimumRanking: "NC",
    duesAmount: 0
  });
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [successorPlayerId, setSuccessorPlayerId] = useState("");
  const clubCreationCost = 5000;
  const canCreateClub = player.budget >= clubCreationCost;

  async function loadClubData() {
    const [myClub, clubList] = await Promise.all([
      api<MyClubData>("/clubs/me"),
      api<ClubListItem[]>("/clubs")
    ]);
    setData(myClub);
    setClubs(clubList);
  }

  useEffect(() => void loadClubData(), []);

  useEffect(() => {
    if (data?.club) {
      setSettingsForm({
        description: data.club.description,
        minimumRanking: data.club.minimumRanking,
        duesAmount: clubDuesAmount(data.club)
      });
    }
  }, [data?.club?.id, data?.club?.description, data?.club?.minimumRanking, data?.club?.duesAmount]);

  async function createClub(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setBusy("create");
    try {
      const club = await api<ClubDetails>("/clubs", {
        method: "POST",
        body: JSON.stringify(form)
      });
      setData({ club, pendingRequest: null });
      setForm({ name: "", tag: "", description: "", minimumRanking: "NC", duesAmount: 0 });
      await refresh();
      await loadClubData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Création impossible.");
    } finally {
      setBusy(null);
    }
  }

  async function updateClubSettings(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setBusy("settings");
    try {
      const club = await api<ClubDetails>("/clubs/me/settings", {
        method: "PATCH",
        body: JSON.stringify(settingsForm)
      });
      setData((current) => ({ club, pendingRequest: current?.pendingRequest ?? null }));
      setSettingsOpen(false);
      await loadClubData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Modification impossible.");
    } finally {
      setBusy(null);
    }
  }

  async function upgradeComplex() {
    setMessage("");
    setBusy("complex-upgrade");
    try {
      const club = await api<ClubDetails>("/clubs/me/buildings/complex/upgrade", {
        method: "POST"
      });
      setData((current) => ({ club, pendingRequest: current?.pendingRequest ?? null }));
      await loadClubData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Amélioration impossible.");
    } finally {
      setBusy(null);
    }
  }

  async function leaveClub(nextPresidentId?: string) {
    setMessage("");
    setBusy("leave");
    try {
      const result = await api<ClubLeaveResponse>("/clubs/me/leave", {
        method: "POST",
        body: JSON.stringify(nextPresidentId ? { successorPlayerId: nextPresidentId } : {})
      });
      setLeaveOpen(false);
      setSuccessorPlayerId("");
      setData({ club: result.club, pendingRequest: result.pendingRequest });
      setMessage(result.message);
      await refresh();
      await loadClubData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Départ du club impossible.");
    } finally {
      setBusy(null);
    }
  }

  async function joinClub(clubId: string) {
    setMessage("");
    setBusy(`join-${clubId}`);
    try {
      await api(`/clubs/${clubId}/join`, {
        method: "POST",
        body: JSON.stringify({ message: "" })
      });
      await loadClubData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Demande impossible.");
    } finally {
      setBusy(null);
    }
  }

  async function decideRequest(requestId: string, decision: "accept" | "reject") {
    setMessage("");
    setBusy(`${decision}-${requestId}`);
    try {
      const club = await api<ClubDetails>(`/clubs/requests/${requestId}/${decision}`, {
        method: "POST"
      });
      setData((current) => ({ club, pendingRequest: current?.pendingRequest ?? null }));
      await loadClubData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Action impossible.");
    } finally {
      setBusy(null);
    }
  }

  if (!data) return <section className="panel p-5">Club en chargement...</section>;

  if (data.club) {
    const club = data.club;
    const complexBuilding = complexBuildingForClub(club);
    const complexNextLevel = complexBuilding.nextLevel;
    const canUpgradeComplex = Boolean(
      club.isPresident && complexNextLevel && club.budget >= complexNextLevel.cost
    );
    const successorOptions = club.members.filter((member) => member.player.id !== player.id);
    const selectedSuccessorId = successorPlayerId || successorOptions[0]?.player.id || "";
    return (
      <div className="grid gap-5">
        <section className="panel p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.22em] text-emerald-300">
                Mon club
              </p>
              <h1 className="mt-1 text-3xl font-black">
                [{club.tag}] {club.name}
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-300">
                {club.description || "Club joueur de l'univers MyPro Tennis."}
              </p>
            </div>
            <div className="flex items-start gap-2">
              <button
                aria-label="Quitter le club"
                className="inline-flex h-12 w-12 items-center justify-center rounded-md border border-red-300/20 bg-red-300/10 text-red-100 transition hover:border-red-300/50 hover:bg-red-300/15"
                onClick={() => setLeaveOpen(true)}
                title="Quitter le club"
                type="button"
              >
                <LogOut size={20} />
              </button>
              {club.isPresident ? (
                <button
                  aria-label="Ouvrir les paramètres du club"
                  className="inline-flex h-12 w-12 items-center justify-center rounded-md border border-white/10 bg-white/[0.06] text-slate-100 transition hover:border-emerald-300/50 hover:bg-emerald-300/10 hover:text-emerald-200"
                  onClick={() => setSettingsOpen(true)}
                  title="Paramètres du club"
                  type="button"
                >
                  <Settings size={20} />
                </button>
              ) : null}
              <div className="rounded-md border border-emerald-300/30 bg-emerald-300/10 px-4 py-3 text-right">
                <div className="text-xs uppercase tracking-[0.18em] text-emerald-200">Places</div>
                <div className="text-2xl font-black">
                  {club.memberCount}/{club.maxSlots}
                </div>
              </div>
            </div>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-7">
            <Metric label="Président" value={club.president.name} />
            <Metric label="Membres" value={club.memberCount} />
            <Metric label="Places libres" value={club.openSlots} />
            <Metric label="Classement requis" value={club.minimumRanking} />
            <Metric label="Cotisation" value={`${clubDuesAmount(club).toLocaleString("fr-FR")} €`} />
            <Metric label="Niveau compétitif" value={club.competitiveLevel} />
            <Metric label="Budget du club" value={`${club.budget.toLocaleString("fr-FR")} €`} />
          </div>
        </section>

        {message ? (
          <div className="rounded-md border border-amber-300/30 bg-amber-300/10 p-3 text-sm text-amber-100">
            {message}
          </div>
        ) : null}

        <section className="panel p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.22em] text-emerald-300">
                Infrastructures
              </p>
              <h2 className="mt-1 text-2xl font-black">Développement du club</h2>
            </div>
            <div className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-slate-300">
              Budget disponible :{" "}
              <span className="font-black text-white">{club.budget.toLocaleString("fr-FR")} €</span>
            </div>
          </div>

          <div className="mt-5 grid gap-4">
            <article className="overflow-hidden rounded-md border border-emerald-300/25 bg-slate-950/70 shadow-xl shadow-emerald-950/20">
              <div className="relative min-h-64">
                <img
                  alt={`Illustration ${complexBuilding.currentLevel.name}`}
                  className="absolute inset-0 h-full w-full object-cover"
                  src={complexLevelImage(complexBuilding.currentLevel.level)}
                />
                <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/65 to-slate-950/10" />
                <div className="relative z-10 flex min-h-64 flex-col justify-end p-5">
                  <div className="flex flex-wrap items-end justify-between gap-4">
                    <div>
                      <div className="mb-3 inline-flex items-center gap-2 rounded-md border border-emerald-300/30 bg-emerald-300/15 px-3 py-2 text-sm font-black text-emerald-100">
                        <Building2 size={18} />
                        Niveau actuel
                      </div>
                      <h3 className="text-3xl font-black">{complexBuilding.name}</h3>
                      <p className="mt-1 max-w-xl text-sm text-slate-200">
                        Niveau {complexBuilding.currentLevel.level}/{complexBuilding.maxLevel} -{" "}
                        {complexBuilding.currentLevel.name}
                      </p>
                    </div>
                    <div className="rounded-md border border-emerald-300/35 bg-slate-950/70 px-4 py-3 text-right backdrop-blur">
                      <div className="text-xs uppercase tracking-[0.18em] text-emerald-200">
                        Capacité
                      </div>
                      <div className="text-2xl font-black">
                        {complexBuilding.currentLevel.maxSlots} joueurs
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 p-4 md:grid-cols-5">
                {complexBuilding.levels.map((level) => {
                  const isCurrent = level.level === complexBuilding.currentLevel.level;
                  const isUnlocked = level.level < complexBuilding.currentLevel.level;
                  const isLocked = level.level > complexBuilding.currentLevel.level;
                  return (
                    <div
                      className={`overflow-hidden rounded-md border bg-white/[0.04] ${
                        isCurrent
                          ? "border-emerald-300 shadow-lg shadow-emerald-950/30"
                          : isUnlocked
                            ? "border-white/15"
                            : "border-white/10"
                      }`}
                      key={level.level}
                    >
                      <div className="relative aspect-[16/10] overflow-hidden">
                        <img
                          alt={`Complexe niveau ${level.level} - ${level.name}`}
                          className={`h-full w-full object-cover transition ${
                            isLocked ? "grayscale opacity-35" : isCurrent ? "" : "opacity-75"
                          }`}
                          src={complexLevelImage(level.level)}
                        />
                        <div
                          className={`absolute inset-0 ${
                            isCurrent
                              ? "bg-gradient-to-t from-emerald-950/55 to-transparent"
                              : isLocked
                                ? "bg-slate-950/55"
                                : "bg-slate-950/20"
                          }`}
                        />
                        <span
                          className={`absolute left-2 top-2 rounded-md px-2 py-1 text-xs font-black ${
                            isCurrent
                              ? "bg-emerald-300 text-slate-950"
                              : isLocked
                                ? "bg-slate-950/75 text-slate-300"
                                : "bg-white/15 text-slate-100"
                          }`}
                        >
                          Niv. {level.level}
                        </span>
                      </div>
                      <div className="p-3">
                        <p className="text-sm font-black leading-tight">{level.name}</p>
                        <p className="mt-1 text-xs text-slate-300">{level.maxSlots} joueurs</p>
                        <p className="mt-2 text-xs font-bold text-slate-200">
                          {level.cost === 0 ? "Débloqué" : `${level.cost.toLocaleString("fr-FR")} €`}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mx-4 rounded-md border border-white/10 bg-white/[0.04] p-3 text-sm text-slate-300">
                {complexNextLevel ? (
                  <>
                    Prochaine amélioration :{" "}
                    <span className="font-bold text-white">{complexNextLevel.name}</span>,{" "}
                    {complexNextLevel.maxSlots} slots joueur.
                  </>
                ) : (
                  "Le Complexe est au niveau maximum."
                )}
              </div>

              <div className="p-4">
                {club.isPresident && complexNextLevel ? (
                  <Button
                    className="w-full"
                    disabled={busy === "complex-upgrade" || !canUpgradeComplex}
                    onClick={() => void upgradeComplex()}
                  >
                    Améliorer pour {complexNextLevel.cost.toLocaleString("fr-FR")} €
                  </Button>
                ) : (
                  <Button className="w-full bg-white/10 text-slate-100 hover:bg-white/15" disabled>
                    {complexNextLevel ? "Président requis" : "Niveau maximum"}
                  </Button>
                )}
                {club.isPresident && complexNextLevel && !canUpgradeComplex ? (
                  <p className="mt-2 text-xs text-amber-200">
                    Budget du club insuffisant pour cette amélioration.
                  </p>
                ) : null}
              </div>
            </article>
          </div>
        </section>

        <TeamChampionshipPanel club={club} />

        {club.isPresident && settingsOpen
          ? createPortal(
              <div className="fixed inset-0 z-[9999] grid place-items-center overflow-y-auto bg-slate-950/80 p-4 backdrop-blur-sm">
                <form
                  className="panel w-full max-w-2xl p-6 shadow-2xl shadow-black/60"
                  onSubmit={updateClubSettings}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-bold uppercase tracking-[0.22em] text-emerald-300">
                        Paramètres
                      </p>
                      <h2 className="mt-1 text-2xl font-black">Paramètres du club</h2>
                      <p className="mt-1 text-sm text-slate-300">
                        Ces informations sont visibles par les joueurs qui cherchent un club.
                      </p>
                    </div>
                    <button
                      aria-label="Fermer les paramètres du club"
                      className="rounded-md bg-white/10 p-2 text-slate-200 hover:bg-white/15"
                      onClick={() => setSettingsOpen(false)}
                      type="button"
                    >
                      <X size={18} />
                    </button>
                  </div>
                  <div className="mt-5 grid gap-4">
                    <label className="grid gap-1 text-sm">
                      <span className="text-slate-300">Description du club</span>
                      <textarea
                        className="min-h-28 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 outline-none focus:border-emerald-300"
                        maxLength={280}
                        onChange={(event) =>
                          setSettingsForm((current) => ({
                            ...current,
                            description: event.target.value
                          }))
                        }
                        placeholder="Ambition, rythme de jeu, profil recherché..."
                        value={settingsForm.description}
                      />
                    </label>
                    <label className="grid gap-1 text-sm">
                      <span className="text-slate-300">Classement minimum pour rejoindre</span>
                      <select
                        className="rounded-md border border-white/10 bg-slate-950 px-3 py-2"
                        onChange={(event) =>
                          setSettingsForm((current) => ({
                            ...current,
                            minimumRanking: event.target.value
                          }))
                        }
                        value={settingsForm.minimumRanking}
                      >
                        {fftPath.map((ranking) => (
                          <option key={ranking} value={ranking}>
                            {ranking}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="grid gap-1 text-sm">
                      <span className="text-slate-300">Cotisation par joueur</span>
                      <Field
                        min={0}
                        max={50000}
                        onChange={(event) =>
                          setSettingsForm((current) => ({
                            ...current,
                            duesAmount: Math.max(0, Number(event.target.value) || 0)
                          }))
                        }
                        type="number"
                        value={settingsForm.duesAmount}
                      />
                    </label>
                  </div>
                  <div className="mt-6 flex flex-wrap justify-end gap-2">
                    <Button
                      className="bg-white/10 text-slate-100 hover:bg-white/15"
                      onClick={() => setSettingsOpen(false)}
                      type="button"
                    >
                      Annuler
                    </Button>
                    <Button disabled={busy === "settings"} type="submit">
                      Enregistrer
                    </Button>
                  </div>
                </form>
              </div>,
              document.body
            )
          : null}

        {leaveOpen
          ? createPortal(
              <div className="fixed inset-0 z-[9999] grid place-items-center overflow-y-auto bg-slate-950/80 p-4 backdrop-blur-sm">
                <div className="panel w-full max-w-xl p-6 shadow-2xl shadow-black/60">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-bold uppercase tracking-[0.22em] text-red-200">
                        Club
                      </p>
                      <h2 className="mt-1 text-2xl font-black">Quitter le club</h2>
                      <p className="mt-1 text-sm text-slate-300">
                        Cette action retire votre joueur de l'effectif du club.
                      </p>
                    </div>
                    <button
                      aria-label="Fermer"
                      className="rounded-md bg-white/10 p-2 text-slate-200 hover:bg-white/15"
                      onClick={() => setLeaveOpen(false)}
                      type="button"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  {club.isPresident && successorOptions.length > 0 ? (
                    <div className="mt-5 grid gap-3">
                      <div className="rounded-md border border-amber-300/30 bg-amber-300/10 p-3 text-sm text-amber-100">
                        Vous êtes président. Pour quitter le club, vous devez désigner un nouveau
                        président parmi les membres.
                      </div>
                      <label className="grid gap-1 text-sm">
                        <span className="text-slate-300">Nouveau président</span>
                        <select
                          className="rounded-md border border-white/10 bg-slate-950 px-3 py-2"
                          onChange={(event) => setSuccessorPlayerId(event.target.value)}
                          value={selectedSuccessorId}
                        >
                          {successorOptions.map((member) => (
                            <option key={member.player.id} value={member.player.id}>
                              {member.player.name} - {member.player.fftRanking}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  ) : club.isPresident ? (
                    <div className="mt-5 rounded-md border border-emerald-300/30 bg-emerald-300/10 p-3 text-sm text-emerald-100">
                      Vous êtes le seul joueur du club. Quitter le club revend automatiquement la
                      structure, supprime le club et vous récupérez 4 000 €.
                    </div>
                  ) : (
                    <div className="mt-5 rounded-md border border-white/10 bg-white/[0.04] p-3 text-sm text-slate-300">
                      Vous pourrez rejoindre ou créer un autre club après votre départ.
                    </div>
                  )}

                  <div className="mt-6 flex flex-wrap justify-end gap-2">
                    <Button
                      className="bg-white/10 text-slate-100 hover:bg-white/15"
                      onClick={() => setLeaveOpen(false)}
                      type="button"
                    >
                      Annuler
                    </Button>
                    <Button
                      className="bg-red-300 text-slate-950 hover:bg-red-200"
                      disabled={
                        busy === "leave" ||
                        (club.isPresident && successorOptions.length > 0 && !selectedSuccessorId)
                      }
                      onClick={() => void leaveClub(selectedSuccessorId || undefined)}
                      type="button"
                    >
                      {club.isPresident && successorOptions.length === 0
                        ? "Revendre et quitter"
                        : "Quitter le club"}
                    </Button>
                  </div>
                </div>
              </div>,
              document.body
            )
          : null}

        <section className="grid gap-5 lg:grid-cols-[1fr_360px]">
          <article className="panel p-5">
            <h2 className="text-xl font-black">Effectif du club</h2>
            <div className="mt-4 grid gap-3">
              {club.members.map((member) => (
                <ClubPlayerRow
                  key={member.id}
                  player={member.player}
                  badge={
                    <span className="rounded-md bg-white/10 px-2 py-1 text-xs font-bold text-slate-200">
                      {member.role === "PRESIDENT" ? "Président" : "Membre"}
                    </span>
                  }
                />
              ))}
            </div>
          </article>

          <article className="panel p-5">
            <h2 className="text-xl font-black">Demandes</h2>
            {club.isPresident ? (
              <div className="mt-4 grid gap-3">
                {club.pendingRequests.length ? (
                  club.pendingRequests.map((request) => (
                    <div
                      key={request.id}
                      className="rounded-md border border-white/10 bg-white/[0.04] p-3"
                    >
                      <ClubPlayerRow player={request.player} />
                      {request.message ? (
                        <p className="mt-3 text-sm text-slate-300">{request.message}</p>
                      ) : null}
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <Button
                          disabled={busy === `accept-${request.id}`}
                          onClick={() => void decideRequest(request.id, "accept")}
                        >
                          Accepter
                        </Button>
                        <Button
                          className="bg-white/10 text-slate-100 hover:bg-white/15"
                          disabled={busy === `reject-${request.id}`}
                          onClick={() => void decideRequest(request.id, "reject")}
                        >
                          Refuser
                        </Button>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-300">Aucune demande en attente.</p>
                )}
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-300">
                Seul le président peut accepter les nouvelles demandes d'adhésion.
              </p>
            )}
          </article>
        </section>
      </div>
    );
  }

  return (
    <div className="grid gap-5">
      <section className="panel p-6">
        <p className="text-sm font-bold uppercase tracking-[0.22em] text-emerald-300">Mon club</p>
        <h1 className="mt-1 text-3xl font-black">Créer ou rejoindre un club</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-300">
          Un nouveau club commence avec 5 places. Le créateur devient président et valide les
          demandes d'adhésion. La création coûte {clubCreationCost.toLocaleString("fr-FR")} €.
        </p>
        {data.pendingRequest ? (
          <div className="mt-4 rounded-md border border-emerald-300/30 bg-emerald-300/10 p-3 text-sm text-emerald-100">
            Demande en attente auprès de [{data.pendingRequest.club.tag}]{" "}
            {data.pendingRequest.club.name}.
          </div>
        ) : null}
        {message ? (
          <div className="mt-4 rounded-md border border-amber-300/30 bg-amber-300/10 p-3 text-sm text-amber-100">
            {message}
          </div>
        ) : null}
      </section>

      <section className="grid gap-5 lg:grid-cols-[380px_1fr]">
        <form className="panel grid gap-4 p-5" onSubmit={createClub}>
          <div>
            <h2 className="text-xl font-black">Créer un club</h2>
            <p className="mt-1 text-sm text-slate-300">
              Coût : {clubCreationCost.toLocaleString("fr-FR")} € · Budget :{" "}
              {player.budget.toLocaleString("fr-FR")} €
            </p>
          </div>
          <label className="grid gap-1 text-sm">
            <span className="text-slate-300">Nom du club</span>
            <Field
              maxLength={32}
              minLength={3}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              placeholder="Ex : Central Horizon"
              required
              value={form.name}
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-slate-300">Sigle</span>
            <Field
              maxLength={5}
              minLength={2}
              onChange={(event) => setForm((current) => ({ ...current, tag: event.target.value }))}
              placeholder="CHT"
              required
              value={form.tag}
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-slate-300">Description</span>
            <Field
              maxLength={280}
              onChange={(event) =>
                setForm((current) => ({ ...current, description: event.target.value }))
              }
              placeholder="Objectif, niveau recherché, ambiance..."
              value={form.description}
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-slate-300">Classement minimum pour rejoindre</span>
            <select
              className="rounded-md border border-white/10 bg-slate-950 px-3 py-2"
              onChange={(event) =>
                setForm((current) => ({ ...current, minimumRanking: event.target.value }))
              }
              value={form.minimumRanking}
            >
              {fftPath.map((ranking) => (
                <option key={ranking} value={ranking}>
                  {ranking}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-slate-300">Cotisation par joueur</span>
            <Field
              min={0}
              max={50000}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  duesAmount: Math.max(0, Number(event.target.value) || 0)
                }))
              }
              type="number"
              value={form.duesAmount}
            />
          </label>
          {!canCreateClub ? (
            <p className="rounded-md border border-amber-300/30 bg-amber-300/10 p-3 text-sm text-amber-100">
              Budget insuffisant pour fonder un club.
            </p>
          ) : null}
          <Button disabled={busy === "create" || Boolean(data.pendingRequest) || !canCreateClub}>
            Créer le club · {clubCreationCost.toLocaleString("fr-FR")} €
          </Button>
        </form>

        <article className="panel p-5">
          <h2 className="text-xl font-black">Clubs disponibles</h2>
          <div className="mt-4 grid gap-3">
            {clubs.length ? (
              clubs.map((club) => {
                const rankingAllowed = fftIndex(player.fftRanking) >= fftIndex(club.minimumRanking);
                const disabled =
                  club.openSlots <= 0 ||
                  club.myRequestStatus === "PENDING" ||
                  Boolean(data.pendingRequest) ||
                  !rankingAllowed ||
                  busy === `join-${club.id}`;
                return (
                  <div
                    key={club.id}
                    className="rounded-md border border-white/10 bg-white/[0.04] p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-black">
                          [{club.tag}] {club.name}
                        </h3>
                        <p className="mt-1 text-sm text-slate-300">
                          Président : {club.president.name} · {club.memberCount}/{club.maxSlots}{" "}
                          membres
                        </p>
                        <p className="mt-1 text-sm text-emerald-200">
                          Niveau compétitif : {club.competitiveLevel}
                        </p>
                        <p className="mt-1 text-sm text-cyan-100">
                          Classement requis : {club.minimumRanking} minimum
                        </p>
                        <p className="mt-1 text-sm text-slate-300">
                          Cotisation : {clubDuesAmount(club).toLocaleString("fr-FR")} €
                        </p>
                        {club.description ? (
                          <p className="mt-2 text-sm text-slate-400">{club.description}</p>
                        ) : null}
                      </div>
                      <Button disabled={disabled} onClick={() => void joinClub(club.id)}>
                        {club.openSlots <= 0
                          ? "Complet"
                          : club.myRequestStatus === "PENDING"
                            ? "Demande envoyée"
                            : !rankingAllowed
                              ? `Requis ${club.minimumRanking}`
                              : "Demander à rejoindre"}
                      </Button>
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-slate-300">
                Aucun club créé pour le moment. Vous pouvez fonder le premier.
              </p>
            )}
          </div>
        </article>
      </section>
    </div>
  );
}

function MatchStartPage() {
  const [pool, setPool] = useState<DuelPool | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Player[]>([]);
  const [searching, setSearching] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const navigate = useNavigate();
  const refresh = useGameStore((state) => state.refresh);
  async function loadPool() {
    setPool(await api<DuelPool>("/matches/duel-pool"));
  }
  useEffect(() => void loadPool(), []);
  async function start(opponentId: string) {
    setMessage("");
    setLoadingId(opponentId);
    try {
      const match = await api<MatchListItem>("/matches/quick", {
        method: "POST",
        body: JSON.stringify({ opponentId, format: "Deux sets gagnants" })
      });
      await refresh();
      navigate(`/match/${match.id}`);
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
    return (
      <article key={`${sourceLabel}-${opponent.id}`} className="panel p-5">
        <div className="flex items-center gap-4">
          <ProfilePicture avatar={opponent.avatar} />
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
              {sourceLabel}
            </div>
            <h2 className="text-xl font-black">
              {opponent.firstName} {opponent.lastName}
            </h2>
            <p className="text-sm text-emerald-300">
              {nationalityLabel(opponent.nationality)} · {opponent.fftRanking}
            </p>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <Metric label="Niveau" value={opponent.overall} />
          <Metric label="Classement" value={opponent.fftRanking} />
          <Metric label="Victoires" value={opponent.wins} />
          <Metric label="Défaites" value={opponent.losses} />
        </div>
        <div className="mt-5 grid gap-2">
          {["service", "return", "forehand", "backhand"].map((key) => (
            <div key={key}>
              <div className="mb-1 flex items-center justify-between gap-2 text-xs text-slate-300">
                <span className="flex items-center gap-2">
                  <StatIcon statKey={key} size="sm" />
                  {statLabels[key]}
                </span>
                <strong>{Math.round(stat(opponent, key))}</strong>
              </div>
              <div className="h-2 rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-emerald-300"
                  style={{ width: `${stat(opponent, key)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
        <Button
          disabled={loadingId !== null}
          onClick={() => start(opponent.id)}
          className="mt-5 w-full"
        >
          <Play size={17} /> {loadingId === opponent.id ? "Duel en cours..." : "Affronter"}
        </Button>
      </article>
    );
  }
  return (
    <div className="grid gap-5">
      <section className="panel p-6">
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
      </section>
      {message ? <div className="panel p-4 text-sm text-amber-100">{message}</div> : null}
      <section className="panel p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
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
      <div>
        <p className="mb-3 text-sm font-bold uppercase tracking-[0.18em] text-slate-400">
          Pool automatique
        </p>
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
    </div>
  );
}

function MatchReplayPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const player = useGameStore((state) => state.player);
  const [match, setMatch] = useState<MatchReplay | null>(null);
  const [index, setIndex] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [playing, setPlaying] = useState(true);
  const [resultDismissed, setResultDismissed] = useState(false);
  useEffect(() => {
    setIndex(0);
    setPlaying(true);
    setResultDismissed(false);
    void api<MatchReplay>(`/matches/${id}`).then(setMatch);
  }, [id]);
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
      </section>

      <section className="grid gap-5 xl:grid-cols-[1fr_340px_1fr]">
        <SimpleMatchPlayerCard player={a} side="left" active={event.winnerId === a.id} />
        <div className="panel grid content-between gap-5 p-5 text-center">
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
        <SimpleMatchPlayerCard player={b} side="right" active={event.winnerId === b.id} />
      </section>

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
              <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">VS</div>
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
    <div className="fixed inset-0 z-[9999] grid place-items-center bg-slate-950/82 p-4 backdrop-blur">
      <section className="panel w-full max-w-md p-6 text-center shadow-2xl shadow-black/60">
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
  return value
    .replaceAll("RÃ©cupÃ©ration", "Récupération")
    .replaceAll("ExplosivitÃ©", "Explosivité")
    .replaceAll("VolÃ©e", "Volée")
    .replaceAll("croisÃ©", "croisé")
    .replaceAll("dÃ©croisÃ©", "décroisé")
    .replaceAll("masquÃ©e", "masquée");
}

function SimpleMatchPlayerCard({
  player,
  side,
  active
}: {
  player: Player;
  side: "left" | "right";
  active: boolean;
}) {
  const matchStats = [
    "service",
    "return",
    "forehand",
    "backhand",
    "stamina",
    "speed",
    "strength",
    "recovery"
  ];
  return (
    <article className={`panel p-5 ${active ? "ring-2 ring-emerald-300" : ""}`}>
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
            {nationalityLabel(player.nationality)} · {player.fftRanking} · Niveau{" "}
            {player.overall}
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
    <section className="panel p-5">
      <h1 className="text-2xl font-black">Historique des matchs</h1>
      <div className="mt-4 grid gap-3">
        {matches.map((match) => (
          <Link
            key={match.id}
            to={`/match/${match.id}`}
            className="grid gap-2 rounded-md border border-white/10 bg-white/5 p-4 md:grid-cols-[1fr_130px_120px]"
          >
            <span>
              {match.playerA.firstName} {match.playerA.lastName} vs {match.playerB.firstName}{" "}
              {match.playerB.lastName}
            </span>
            <span className="text-emerald-300">{match.scoreText}</span>
            <span>{match.type}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function OnlinePage() {
  const [online, setOnline] = useState<PresenceUser[]>([]);
  useEffect(() => {
    const socket = io(socketUrl);
    const token = localStorage.getItem("mypro-token");
    if (token) socket.emit("presence:join", token);
    socket.on("presence:list", setOnline);
    return () => {
      socket.disconnect();
    };
  }, []);
  return (
    <section className="panel p-5">
      <h1 className="text-2xl font-black">Joueurs en ligne</h1>
      <div className="mt-4 grid gap-3">
        {online.length ? (
          online.map((user) => (
            <div key={user.userId} className="rounded-md bg-white/5 p-3">
              {user.displayName} · connecté
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
  return (
    <section className="panel p-5">
      <h1 className="text-2xl font-black">{player.name}</h1>
      <p className="text-emerald-300">
        {nationalityLabel(player.nationality)} · Rang {player.worldRank} · Niveau{" "}
        {player.overall}
      </p>
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <StatBars player={player} />
        <ResponsiveContainer height={260}>
          <BarChart
            data={Object.entries(player.stats)
              .slice(0, 8)
              .map(([name, value]) => ({ name: statLabels[name], value }))}
          >
            <CartesianGrid stroke="#ffffff16" />
            <XAxis dataKey="name" hide />
            <YAxis />
            <Tooltip />
            <Bar dataKey="value" fill="#20c47a" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

function CommunityPage() {
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
        <div className="relative min-h-72 p-6 md:p-8">
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
              Rejoignez le Discord communautaire pour discuter, retrouver les mises à jour,
              signaler un bug, proposer une idée et suivre l'évolution de MYPRO - TENNIS.
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
            <article className="rounded-md border border-white/10 bg-white/[0.04] p-4" key={title}>
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

      <section className="panel p-5">
        <h2 className="text-xl font-black">Structure prévue du serveur</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <Metric label="Accueil" value="#annonces · #règles · #présentations" />
          <Metric label="Support" value="#bugs · #suggestions · #aide" />
          <Metric label="Jeu" value="#clubs · #duels · #championnats" />
        </div>
        <p className="mt-4 text-sm leading-6 text-slate-300">
          Le Discord sera le point de rencontre officiel pour suivre la progression du jeu et faire
          remonter les retours de la communauté.
        </p>
      </section>
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
    <section className="panel p-5">
      <h1 className="text-2xl font-black">Réglages</h1>
      {message ? (
        <div className="mt-4 rounded-md border border-emerald-300/30 bg-emerald-300/10 p-3 text-sm text-emerald-100">
          {message}
        </div>
      ) : null}
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <Metric label="Compte" value={user?.email ?? "Invité"} />
        <Metric label="Google" value={user?.googleLinked ? "Lié" : "Non lié"} />
        <Metric label="PWA" value="Installable" />
        <Metric label="Multijoueur" value="Socket.IO actif" />
        <div className="metric md:col-span-2">
          <div className="text-xs text-slate-400">Session</div>
          <p className="mt-2 text-sm text-slate-300">
            Fermez la session de ce navigateur. Votre compte, votre joueur et votre progression
            restent sauvegardés.
          </p>
          <Button onClick={disconnect} className="mt-3 bg-white/10 text-white hover:bg-white/15">
            <LogOut size={17} />
            Déconnexion
          </Button>
        </div>
        {!user?.googleLinked ? (
          <div className="metric md:col-span-2">
            <div className="text-xs text-slate-400">Connexion Google</div>
            <p className="mt-2 text-sm text-slate-300">
              Liez votre compte existant pour pouvoir vous connecter ensuite avec Google.
            </p>
            <div className="mt-3 max-w-xs">
              <GoogleButton disabled={busy} onClick={linkGoogle}>
                Lier mon compte Google
              </GoogleButton>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

export function App() {
  const { booted, refresh } = useGameStore();
  useEffect(() => void refresh(), [refresh]);
  if (!booted)
    return (
      <div className="grid min-h-screen place-items-center text-lg font-bold">
        Chargement de MYPRO - TENNIS...
      </div>
    );
  return (
    <Shell>
      <Routes>
        <Route path="/" element={<Landing />} />
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
          path="/collection"
          element={
            <NeedAuth>
              <NeedPlayer>
                <CollectionPage />
              </NeedPlayer>
            </NeedAuth>
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
                <MatchStartPage />
              </NeedPlayer>
            </NeedAuth>
          }
        />
        <Route path="/match" element={<Navigate to="/duel" replace />} />
        <Route
          path="/match/:id"
          element={
            <NeedAuth>
              <NeedPlayer>
                <MatchReplayPage />
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
    </Shell>
  );
}
