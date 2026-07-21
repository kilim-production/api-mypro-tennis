import type { Player } from "../../store";

export type ChestRarity = "Bronze" | "Argent" | "Or" | "Légendaire" | "Mythique";

export type SeasonChestRewards = {
  cards: Array<{
    statKey: string;
    label: string;
    copies: number;
    totalCopies: number;
    levelBefore: number;
    levelAfter: number;
    bonus: number;
    nextRequired: number;
  }>;
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

export type SeasonEntry = {
  id: string;
  competitionType: string;
  status: string;
  currentRound: number;
  energyCost: number;
  entryFee: number;
  cashPrize: number;
  championTitle?: string | null;
  nextOpponent?: Player | null;
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

export type TournamentBracketRound = NonNullable<SeasonEntry["bracket"]["rounds"]>[number];

export type SeasonCompetition = {
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

export type SeasonDailyReward = {
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

export type SeasonData = {
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
