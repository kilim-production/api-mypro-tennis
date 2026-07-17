export type ClubPlayerSummary = {
  id: string;
  name: string;
  nationality: string;
  fftRanking: string;
  overall: number;
  worldRank: number;
  avatar: string;
};

export type ClubBuildingLevel = {
  level: number;
  name: string;
  cost: number;
  maxSlots?: number;
  recoveryReductionPercent?: number;
  rareChestBonusPercent?: number;
};

export type ClubBuilding = {
  id: string;
  name: string;
  currentLevel: ClubBuildingLevel;
  nextLevel: ClubBuildingLevel | null;
  maxLevel: number;
  levels: ClubBuildingLevel[];
};

export type ClubListItem = {
  id: string;
  name: string;
  tag: string;
  description: string;
  minimumRanking: string;
  duesAmount?: number;
  budget: number;
  complexLevel: number;
  careCenterLevel: number;
  trainingCenterLevel: number;
  buildings?: {
    complex: ClubBuilding;
    careCenter: ClubBuilding;
    trainingCenter: ClubBuilding;
  };
  competitiveLevel: string;
  maxSlots: number;
  memberCount: number;
  openSlots: number;
  president: ClubPlayerSummary;
  createdAt: string;
  myRequestStatus: string | null;
};

export type ClubDetails = Omit<ClubListItem, "myRequestStatus"> & {
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

export type MyClubData = {
  club: ClubDetails | null;
  pendingRequest: {
    id: string;
    message: string;
    createdAt: string;
    club: Omit<ClubListItem, "myRequestStatus">;
  } | null;
};

export type ClubLeaveResponse = MyClubData & {
  refunded: number;
  message: string;
};

export type ClubTab = "team" | "infra" | "members" | "requests";

export type TeamChampionshipEntry = {
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
  finalPosition?: number | null;
  cashPrize?: number;
  cashPrizeAwardedAt?: string | null;
  projectedCashPrize?: number;
};

export type TeamChampionshipSingle = {
  label: string;
  court: number;
  replayMatchId?: string;
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

export type TeamChampionshipMeeting = {
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

export type TeamChampionshipData = {
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
