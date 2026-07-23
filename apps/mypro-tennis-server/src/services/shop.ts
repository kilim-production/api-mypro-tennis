import { Prisma, type ShopPurchase } from "@prisma/client";
import { prisma } from "@mypro/database";
import type { ShopPurchaseInput } from "@mypro/shared";
import {
  openInstantChestReward,
  openInstantChestRewardBundle,
  type ChestRarity,
  type ChestRewards
} from "./chests";
import { decodeJson, encodeJson } from "./json";

const DAY_MS = 24 * 60 * 60 * 1_000;
export const SHOP_SEASON_PASS_DAYS = 30;
export const SHOP_SEASON_PASS_XP_MULTIPLIER = 1.25;

type ShopClient = Pick<Prisma.TransactionClient, "player" | "shopPurchase" | "playerSeasonPass">;

type ShopBagOdds = Array<{ rarity: ChestRarity; probability: number }>;

type GemProduct = {
  id: string;
  type: "GEM_PACK";
  label: string;
  gems: number;
  priceCents: number;
  bonusPercent: number;
};

type BagProduct = {
  id: "bag-discovery" | "bag-competition" | "bag-elite";
  type: "BAG_PACK";
  label: string;
  gemPrice: number;
  bagCount: number;
  odds: ShopBagOdds;
};

type CreditProduct = {
  id: "credits-2500" | "credits-5000" | "credits-10000";
  type: "CREDITS";
  label: string;
  gemPrice: number;
  credits: number;
};

type SeasonPassProduct = {
  id: "season-pass";
  type: "SEASON_PASS";
  label: string;
  gemPrice: number;
  referencePriceCents: number;
  durationDays: number;
  benefits: {
    matchXpMultiplier: number;
    dailyRewardMultiplier: number;
    instantChestRarity: ChestRarity;
  };
};

type InGameProduct = BagProduct | CreditProduct | SeasonPassProduct;

export class ShopError extends Error {
  constructor(
    message: string,
    public readonly statusCode = 409
  ) {
    super(message);
    this.name = "ShopError";
  }
}

export const shopGemPacks: GemProduct[] = [
  {
    id: "gems-100",
    type: "GEM_PACK",
    label: "100 gemmes",
    gems: 100,
    priceCents: 299,
    bonusPercent: 0
  },
  {
    id: "gems-225",
    type: "GEM_PACK",
    label: "225 gemmes",
    gems: 225,
    priceCents: 599,
    bonusPercent: 12
  },
  {
    id: "gems-500",
    type: "GEM_PACK",
    label: "500 gemmes",
    gems: 500,
    priceCents: 1199,
    bonusPercent: 25
  },
  {
    id: "gems-1100",
    type: "GEM_PACK",
    label: "1 100 gemmes",
    gems: 1100,
    priceCents: 2399,
    bonusPercent: 37
  }
];

export const shopBagPacks: BagProduct[] = [
  {
    id: "bag-discovery",
    type: "BAG_PACK",
    label: "Pack Découverte",
    gemPrice: 50,
    bagCount: 3,
    odds: [
      { rarity: "Bronze", probability: 60 },
      { rarity: "Argent", probability: 30 },
      { rarity: "Or", probability: 9 },
      { rarity: "Légendaire", probability: 1 }
    ]
  },
  {
    id: "bag-competition",
    type: "BAG_PACK",
    label: "Pack Compétition",
    gemPrice: 100,
    bagCount: 4,
    odds: [
      { rarity: "Bronze", probability: 30 },
      { rarity: "Argent", probability: 40 },
      { rarity: "Or", probability: 24 },
      { rarity: "Légendaire", probability: 5 },
      { rarity: "Mythique", probability: 1 }
    ]
  },
  {
    id: "bag-elite",
    type: "BAG_PACK",
    label: "Pack Élite",
    gemPrice: 250,
    bagCount: 5,
    odds: [
      { rarity: "Argent", probability: 30 },
      { rarity: "Or", probability: 45 },
      { rarity: "Légendaire", probability: 20 },
      { rarity: "Mythique", probability: 5 }
    ]
  }
];

export const shopCreditPacks: CreditProduct[] = [
  { id: "credits-2500", type: "CREDITS", label: "2 500 crédits", gemPrice: 25, credits: 2500 },
  { id: "credits-5000", type: "CREDITS", label: "5 000 crédits", gemPrice: 50, credits: 5000 },
  { id: "credits-10000", type: "CREDITS", label: "10 000 crédits", gemPrice: 100, credits: 10000 }
];

export const shopSeasonPass: SeasonPassProduct = {
  id: "season-pass",
  type: "SEASON_PASS",
  label: "Pack de saison",
  gemPrice: 100,
  referencePriceCents: 299,
  durationDays: SHOP_SEASON_PASS_DAYS,
  benefits: {
    matchXpMultiplier: SHOP_SEASON_PASS_XP_MULTIPLIER,
    dailyRewardMultiplier: 2,
    instantChestRarity: "Mythique"
  }
};

const inGameProducts = new Map<string, InGameProduct>(
  [...shopBagPacks, ...shopCreditPacks, shopSeasonPass].map((product) => [product.id, product])
);

function seededFraction(seed: string) {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967296;
}

export function rollShopBagRarity(productId: BagProduct["id"], seed: string) {
  const product = shopBagPacks.find((item) => item.id === productId);
  if (!product) throw new ShopError("Pack de sacs inconnu.", 404);
  let roll = seededFraction(`${productId}:${seed}`) * 100;
  for (const chance of product.odds) {
    roll -= chance.probability;
    if (roll < 0) return chance.rarity;
  }
  return product.odds.at(-1)?.rarity ?? "Bronze";
}

function serializePass(pass: { id: string; startsAt: Date; expiresAt: Date } | null) {
  if (!pass) return null;
  const remainingMs = Math.max(0, pass.expiresAt.getTime() - Date.now());
  return {
    id: pass.id,
    startsAt: pass.startsAt,
    expiresAt: pass.expiresAt,
    remainingMs,
    active: remainingMs > 0,
    benefits: shopSeasonPass.benefits
  };
}

export async function activeSeasonPassForPlayer(
  playerId: string,
  client: ShopClient = prisma,
  at = new Date()
) {
  return client.playerSeasonPass.findFirst({
    where: { playerId, expiresAt: { gt: at } },
    orderBy: { expiresAt: "desc" }
  });
}

export async function seasonPassXpMultiplier(
  playerId: string,
  client: ShopClient,
  at = new Date()
) {
  return (await activeSeasonPassForPlayer(playerId, client, at))
    ? SHOP_SEASON_PASS_XP_MULTIPLIER
    : 1;
}

export async function shopCatalogForPlayer(playerId: string) {
  const [player, pass] = await Promise.all([
    prisma.player.findUnique({
      where: { id: playerId },
      select: { gems: true, gemDebt: true, budget: true }
    }),
    activeSeasonPassForPlayer(playerId)
  ]);
  if (!player) throw new ShopError("Joueur introuvable.", 404);
  return {
    currency: { code: "EUR", locale: "fr-FR" },
    gemPacks: shopGemPacks,
    bagPacks: shopBagPacks,
    creditPacks: shopCreditPacks,
    seasonPassProduct: shopSeasonPass,
    seasonPass: serializePass(pass),
    wallet: { gems: player.gems, gemDebt: player.gemDebt, credits: player.budget }
  };
}

function publicPurchase(purchase: ShopPurchase) {
  return {
    id: purchase.id,
    productId: purchase.productId,
    productType: purchase.productType,
    currency: purchase.currency,
    amount: purchase.amount,
    quantity: purchase.quantity,
    status: purchase.status,
    rewards: decodeJson<Record<string, unknown>>(purchase.rewards),
    createdAt: purchase.createdAt
  };
}

async function purchaseResponse(client: ShopClient, playerId: string, purchase: ShopPurchase) {
  const [player, pass] = await Promise.all([
    client.player.findUnique({
      where: { id: playerId },
      select: { gems: true, gemDebt: true, budget: true }
    }),
    activeSeasonPassForPlayer(playerId, client)
  ]);
  if (!player) throw new ShopError("Joueur introuvable.", 404);
  return {
    purchase: publicPurchase(purchase),
    wallet: { gems: player.gems, gemDebt: player.gemDebt, credits: player.budget },
    seasonPass: serializePass(pass)
  };
}

type ShopRewardPayload = {
  gemsSpent: number;
  credits?: number;
  bagOpenings?: Array<{
    rarity: ChestRarity;
    rewards: ChestRewards;
  }>;
  seasonPass?: {
    id: string;
    startsAt: Date;
    expiresAt: Date;
  };
  instantChest?: ChestRewards;
};

export async function purchaseShopProduct(playerId: string, input: ShopPurchaseInput) {
  const product = inGameProducts.get(input.productId);
  if (!product) throw new ShopError("Produit indisponible.", 404);

  try {
    return await prisma.$transaction(
      async (tx) => {
        const existing = await tx.shopPurchase.findUnique({
          where: { playerId_idempotencyKey: { playerId, idempotencyKey: input.idempotencyKey } }
        });
        if (existing) return purchaseResponse(tx, playerId, existing);

        if (product.type === "SEASON_PASS" && (await activeSeasonPassForPlayer(playerId, tx))) {
          throw new ShopError("Votre Pack de saison est déjà actif.");
        }

        const purchase = await tx.shopPurchase.create({
          data: {
            playerId,
            productId: product.id,
            productType: product.type,
            currency: "GEMS",
            amount: product.gemPrice,
            status: "PROCESSING",
            idempotencyKey: input.idempotencyKey,
            paymentProvider: "IN_GAME",
            quantity: product.type === "BAG_PACK" ? product.bagCount : 1
          }
        });

        const debit = await tx.player.updateMany({
          where: { id: playerId, gems: { gte: product.gemPrice } },
          data: { gems: { decrement: product.gemPrice } }
        });
        if (debit.count !== 1) {
          throw new ShopError(`Gemmes insuffisantes. Il faut ${product.gemPrice} gemmes.`);
        }

        const rewards: ShopRewardPayload = { gemsSpent: product.gemPrice };

        if (product.type === "CREDITS") {
          await tx.player.update({
            where: { id: playerId },
            data: { budget: { increment: product.credits } }
          });
          rewards.credits = product.credits;
        }

        if (product.type === "BAG_PACK") {
          rewards.bagOpenings = await openInstantChestRewardBundle(
            tx,
            playerId,
            Array.from({ length: product.bagCount }, (_, index) => ({
              rarity: rollShopBagRarity(product.id, `${purchase.id}:${index}`),
              source: `shop-${purchase.id}-${index}`
            }))
          );
        }

        if (product.type === "SEASON_PASS") {
          const startsAt = new Date();
          const expiresAt = new Date(startsAt.getTime() + product.durationDays * DAY_MS);
          const pass = await tx.playerSeasonPass.create({
            data: { playerId, purchaseId: purchase.id, startsAt, expiresAt }
          });
          rewards.seasonPass = {
            id: pass.id,
            startsAt: pass.startsAt,
            expiresAt: pass.expiresAt
          };
          rewards.instantChest = await openInstantChestReward(
            tx,
            playerId,
            product.benefits.instantChestRarity,
            `shop-season-pass-${purchase.id}`
          );
          const owner = await tx.player.findUnique({
            where: { id: playerId },
            select: { userId: true }
          });
          if (owner?.userId) {
            await tx.notification.create({
              data: {
                userId: owner.userId,
                title: "Pack de saison activé",
                body: `Vos bonus sont actifs jusqu'au ${expiresAt.toLocaleDateString("fr-FR")}.`,
                type: "SHOP"
              }
            });
          }
        }

        const completed = await tx.shopPurchase.update({
          where: { id: purchase.id },
          data: { status: "COMPLETED", rewards: encodeJson(rewards) }
        });
        return purchaseResponse(tx, playerId, completed);
      },
      {
        maxWait: 10_000,
        timeout: 30_000
      }
    );
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const existing = await prisma.shopPurchase.findUnique({
        where: { playerId_idempotencyKey: { playerId, idempotencyKey: input.idempotencyKey } }
      });
      if (existing) return purchaseResponse(prisma, playerId, existing);
    }
    if (
      (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2028") ||
      (error instanceof Error &&
        /Transaction API error|Transaction not found|old closed transaction/i.test(error.message))
    ) {
      throw new ShopError(
        "L'ouverture du pack a pris trop de temps. Aucune gemme n'a été débitée. Réessayez.",
        503
      );
    }
    throw error;
  }
}
