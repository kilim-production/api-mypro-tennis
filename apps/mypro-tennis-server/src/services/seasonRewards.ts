import type { Prisma } from "@prisma/client";
import { prisma } from "@mypro/database";
import { encodeJson } from "./json";
import { type ChestRarity, type ChestRewards, grantChestRewards, openInstantChestReward } from "./chests";
import { type seasonWindow } from "./seasons";
import { activeSeasonPassForPlayer } from "./shop";

type SeasonWindow = ReturnType<typeof seasonWindow>;

type SeasonRewardDefinition =
  | { day: number; type: "money"; money: number }
  | { day: number; type: "gems"; gems: number }
  | { day: number; type: "chest"; rarity: ChestRarity };

const emptyRewards = (): ChestRewards => ({
  cards: [],
  money: 0,
  gems: 0,
  cosmetics: [],
  statBonuses: {}
});

function mergeRewards(items: ChestRewards[]) {
  return items.reduce<ChestRewards>((merged, item) => {
    merged.cards.push(...item.cards);
    merged.money += item.money;
    merged.gems += item.gems;
    merged.cosmetics.push(...item.cosmetics);
    for (const [statKey, bonus] of Object.entries(item.statBonuses)) {
      merged.statBonuses[statKey] = (merged.statBonuses[statKey] ?? 0) + bonus;
    }
    return merged;
  }, emptyRewards());
}

export const seasonDailyRewards: SeasonRewardDefinition[] = [
  { day: 1, type: "money", money: 250 },
  { day: 2, type: "gems", gems: 1 },
  { day: 3, type: "chest", rarity: "Bronze" },
  { day: 4, type: "money", money: 350 },
  { day: 5, type: "chest", rarity: "Argent" },
  { day: 6, type: "money", money: 400 },
  { day: 7, type: "gems", gems: 2 },
  { day: 8, type: "chest", rarity: "Bronze" },
  { day: 9, type: "money", money: 500 },
  { day: 10, type: "chest", rarity: "Argent" },
  { day: 11, type: "gems", gems: 2 },
  { day: 12, type: "money", money: 650 },
  { day: 13, type: "chest", rarity: "Bronze" },
  { day: 14, type: "chest", rarity: "Or" },
  { day: 15, type: "money", money: 800 },
  { day: 16, type: "gems", gems: 3 },
  { day: 17, type: "chest", rarity: "Argent" },
  { day: 18, type: "money", money: 950 },
  { day: 19, type: "chest", rarity: "Bronze" },
  { day: 20, type: "chest", rarity: "Or" },
  { day: 21, type: "gems", gems: 4 },
  { day: 22, type: "money", money: 1200 },
  { day: 23, type: "chest", rarity: "Argent" },
  { day: 24, type: "money", money: 1400 },
  { day: 25, type: "chest", rarity: "Or" },
  { day: 26, type: "gems", gems: 5 },
  { day: 27, type: "chest", rarity: "Légendaire" },
  { day: 28, type: "money", money: 1800 },
  { day: 29, type: "gems", gems: 8 },
  { day: 30, type: "chest", rarity: "Mythique" }
];

function rewardLabel(reward: SeasonRewardDefinition) {
  if (reward.type === "money") return `${reward.money.toLocaleString("fr-FR")} CR`;
  if (reward.type === "gems") return `${reward.gems} gemme${reward.gems > 1 ? "s" : ""}`;
  return `Sac ${reward.rarity}`;
}

function rewardValue(reward: SeasonRewardDefinition) {
  if (reward.type === "money") return String(reward.money);
  if (reward.type === "gems") return String(reward.gems);
  return reward.rarity;
}

function serializeReward(
  reward: SeasonRewardDefinition,
  params: { claimed: boolean; currentDay: number; claimedAt?: Date | null }
) {
  const claimable = reward.day === params.currentDay && !params.claimed;
  return {
    ...reward,
    label: rewardLabel(reward),
    rewardValue: rewardValue(reward),
    claimed: params.claimed,
    claimedAt: params.claimedAt ?? null,
    claimable,
    missed: reward.day < params.currentDay && !params.claimed,
    locked: reward.day > params.currentDay,
    current: reward.day === params.currentDay
  };
}

export async function getSeasonDailyRewardState(playerId: string, window: SeasonWindow) {
  const claims = await prisma.seasonDailyRewardClaim.findMany({
    where: { playerId, seasonKey: window.key }
  });
  const claimsByDay = new Map(claims.map((claim) => [claim.day, claim]));
  return seasonDailyRewards.map((reward) => {
    const claim = claimsByDay.get(reward.day);
    return serializeReward(reward, {
      claimed: Boolean(claim),
      currentDay: window.day,
      claimedAt: claim?.claimedAt ?? null
    });
  });
}

export async function ensureDailySeasonRewardNotification(
  userId: string,
  playerId: string,
  window: SeasonWindow
) {
  const reward = seasonDailyRewards.find((item) => item.day === window.day);
  if (!reward) return;
  const claim = await prisma.seasonDailyRewardClaim.findUnique({
    where: { playerId_seasonKey_day: { playerId, seasonKey: window.key, day: window.day } }
  });
  if (claim) return;
  const title = `Récompense du jour ${window.day}`;
  const existing = await prisma.notification.findFirst({
    where: {
      userId,
      type: "SEASON_REWARD",
      title,
      body: { contains: window.key }
    }
  });
  if (existing) return;
  await prisma.notification.create({
    data: {
      userId,
      title,
      body: `${window.key} · ${rewardLabel(reward)} disponible dans Saison en cours.`,
      type: "SEASON_REWARD"
    }
  });
}

async function grantDirectReward(
  tx: Prisma.TransactionClient,
  playerId: string,
  reward: SeasonRewardDefinition
) {
  if (reward.type === "chest") {
    return openInstantChestReward(tx, playerId, reward.rarity, `season-${reward.day}`);
  }

  const rewards = emptyRewards();
  if (reward.type === "money") rewards.money = reward.money;
  if (reward.type === "gems") rewards.gems = reward.gems;
  await grantChestRewards(tx, playerId, rewards);
  return rewards;
}

export async function claimTodaySeasonReward(userId: string, playerId: string, window: SeasonWindow) {
  const reward = seasonDailyRewards.find((item) => item.day === window.day);
  if (!reward) throw new Error("Aucune récompense disponible aujourd'hui.");

  return prisma.$transaction(async (tx) => {
    const existing = await tx.seasonDailyRewardClaim.findUnique({
      where: { playerId_seasonKey_day: { playerId, seasonKey: window.key, day: window.day } }
    });
    if (existing) throw new Error("Récompense déjà récupérée aujourd'hui.");

    const seasonPassActive = Boolean(await activeSeasonPassForPlayer(playerId, tx));
    const rewardMultiplier = seasonPassActive ? 2 : 1;
    const grantedRewards: ChestRewards[] = [];
    for (let index = 0; index < rewardMultiplier; index += 1) {
      grantedRewards.push(await grantDirectReward(tx, playerId, reward));
    }
    const rewards = mergeRewards(grantedRewards);
    const claim = await tx.seasonDailyRewardClaim.create({
      data: {
        playerId,
        seasonKey: window.key,
        day: window.day,
        rewardType: reward.type,
        rewardValue: rewardValue(reward),
        rewards: encodeJson(rewards)
      }
    });
    await tx.notification.updateMany({
      where: {
        userId,
        type: "SEASON_REWARD",
        title: `Récompense du jour ${window.day}`,
        readAt: null
      },
      data: { readAt: new Date() }
    });

    return {
      dailyReward: serializeReward(reward, {
        claimed: true,
        currentDay: window.day,
        claimedAt: claim.claimedAt
      }),
      rewardMultiplier,
      seasonPassActive,
      rewards
    };
  });
}
