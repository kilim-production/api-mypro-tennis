import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@mypro/database";
import { claimTodaySeasonReward } from "./seasonRewards";
import { seasonWindow } from "./seasons";
import {
  purchaseShopProduct,
  rollShopBagRarity,
  seasonPassXpMultiplier,
  shopBagPacks,
  shopCatalogForPlayer
} from "./shop";
import { fulfillVerifiedStripeSession, reconcileStripeRefundedCharge } from "./stripeShop";

const suffix = randomUUID();
const email = `shop-${suffix}@example.test`;

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email } });
});

describe("boutique MYPRO", () => {
  it("publie un catalogue cohérent et des probabilités complètes", async () => {
    const expectedBagCounts = new Map([
      ["bag-discovery", 3],
      ["bag-competition", 4],
      ["bag-elite", 5]
    ]);
    for (const pack of shopBagPacks) {
      expect(pack.odds.reduce((total, chance) => total + chance.probability, 0)).toBe(100);
      expect(pack.bagCount).toBe(expectedBagCounts.get(pack.id));
      expect(rollShopBagRarity(pack.id, "test-seed")).toBeTruthy();
    }
  });

  it("sécurise les conversions, sacs et bonus du Pack de saison", async () => {
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: "test",
        displayName: "Boutique test",
        player: {
          create: {
            firstName: "Alex",
            lastName: "Shop",
            nationality: "FR",
            gender: "Homme",
            dominantHand: "Droite",
            backhand: "Deux mains",
            archetype: "Joueur complet",
            avatar: "avatar-01",
            stats: "{}",
            gems: 500,
            budget: 100,
            overall: 50
          }
        }
      },
      include: { player: true }
    });
    const player = user.player!;

    const catalog = await shopCatalogForPlayer(player.id);
    expect(catalog.wallet).toEqual({ gems: 500, gemDebt: 0, credits: 100 });
    expect(catalog.seasonPass).toBeNull();
    expect(await seasonPassXpMultiplier(player.id, prisma)).toBe(1);

    const conversionKey = `conversion-${suffix}`;
    const conversion = await purchaseShopProduct(player.id, {
      productId: "credits-2500",
      idempotencyKey: conversionKey
    });
    expect(conversion.wallet).toEqual({ gems: 475, gemDebt: 0, credits: 2600 });

    const repeatedConversion = await purchaseShopProduct(player.id, {
      productId: "credits-2500",
      idempotencyKey: conversionKey
    });
    expect(repeatedConversion.wallet).toEqual(conversion.wallet);
    expect(await prisma.shopPurchase.count({ where: { playerId: player.id } })).toBe(1);

    const unlocksAt = new Date(Date.now() + 60 * 60_000);
    await prisma.tennisBagChest.createMany({
      data: [0, 1, 2, 3].map((slotIndex) => ({
        playerId: player.id,
        rarity: "Argent",
        slotIndex,
        source: "Slots déjà occupés avant l'achat Boutique",
        status: "LOCKED",
        unlocksAt
      }))
    });

    const bagKey = `bag-${suffix}`;
    const bag = await purchaseShopProduct(player.id, {
      productId: "bag-elite",
      idempotencyKey: bagKey
    });
    const bagOpenings = (
      bag.purchase.rewards as {
        bagOpenings?: Array<{ rarity: string; rewards: { cards: unknown[]; money: number } }>;
      }
    ).bagOpenings;
    expect(bag.purchase.quantity).toBe(5);
    expect(bagOpenings).toHaveLength(5);
    expect(bagOpenings?.every((opening) => opening.rewards.cards.length > 0)).toBe(true);
    expect(bagOpenings?.every((opening) => opening.rewards.money > 0)).toBe(true);
    expect(await prisma.tennisBagChest.count({ where: { playerId: player.id } })).toBe(4);

    const repeatedBag = await purchaseShopProduct(player.id, {
      productId: "bag-elite",
      idempotencyKey: bagKey
    });
    expect(repeatedBag.wallet).toEqual(bag.wallet);
    expect(repeatedBag.purchase.id).toBe(bag.purchase.id);

    const pass = await purchaseShopProduct(player.id, {
      productId: "season-pass",
      idempotencyKey: `pass-${suffix}`
    });
    expect(pass.seasonPass?.active).toBe(true);
    expect(pass.purchase.rewards).toHaveProperty("instantChest");
    expect(await seasonPassXpMultiplier(player.id, prisma)).toBe(1.25);

    const beforeDailyReward = await prisma.player.findUniqueOrThrow({ where: { id: player.id } });
    const rewardWindow = seasonWindow(
      new Date("2026-07-01T10:00:00.000Z"),
      new Date("2026-06-30T22:00:00.000Z")
    );
    const dailyReward = await claimTodaySeasonReward(user.id, player.id, rewardWindow);
    const afterDailyReward = await prisma.player.findUniqueOrThrow({ where: { id: player.id } });
    expect(dailyReward.rewardMultiplier).toBe(2);
    expect(afterDailyReward.budget - beforeDailyReward.budget).toBe(500);

    await expect(
      purchaseShopProduct(player.id, {
        productId: "season-pass",
        idempotencyKey: `second-pass-${suffix}`
      })
    ).rejects.toThrow("déjà actif");

    const stripePurchase = await prisma.shopPurchase.create({
      data: {
        playerId: player.id,
        productId: "gems-100",
        productType: "GEM_PACK",
        currency: "EUR",
        amount: 299,
        status: "PENDING",
        idempotencyKey: `stripe-${suffix}`,
        paymentProvider: "STRIPE",
        externalReference: `cs_test_${suffix}`
      }
    });
    const paidSession = {
      id: stripePurchase.externalReference,
      amount_total: 299,
      currency: "eur",
      payment_status: "paid",
      client_reference_id: stripePurchase.id,
      metadata: {
        purchaseId: stripePurchase.id,
        playerId: player.id,
        productId: "gems-100"
      },
      payment_intent: {
        id: `pi_test_${suffix}`,
        latest_charge: {
          receipt_url: "https://pay.stripe.com/receipts/test"
        }
      }
    } as unknown as Parameters<typeof fulfillVerifiedStripeSession>[0];
    const gemsBeforeStripe = (await prisma.player.findUniqueOrThrow({ where: { id: player.id } }))
      .gems;
    const firstFulfillment = await fulfillVerifiedStripeSession(paidSession);
    const repeatedFulfillment = await fulfillVerifiedStripeSession(paidSession);
    expect(firstFulfillment.purchase.status).toBe("COMPLETED");
    expect(repeatedFulfillment.wallet.gems).toBe(gemsBeforeStripe + 100);
    expect(
      await prisma.shopPurchase.count({ where: { id: stripePurchase.id, status: "COMPLETED" } })
    ).toBe(1);
    expect(firstFulfillment.purchase.receiptUrl).toContain("pay.stripe.com");

    await prisma.player.update({ where: { id: player.id }, data: { gems: 20 } });
    const refundedCharge = {
      id: `ch_test_${suffix}`,
      payment_intent: `pi_test_${suffix}`,
      amount_refunded: 299,
      receipt_url: "https://pay.stripe.com/receipts/test-refunded"
    } as unknown as Parameters<typeof reconcileStripeRefundedCharge>[0];
    const refund = await reconcileStripeRefundedCharge(refundedCharge);
    const repeatedRefund = await reconcileStripeRefundedCharge(refundedCharge);
    expect(refund.purchase.status).toBe("REFUNDED");
    expect(refund.wallet).toMatchObject({ gems: 0, gemDebt: 80 });
    expect(repeatedRefund.wallet).toMatchObject({ gems: 0, gemDebt: 80 });

    const latePaymentReplay = await fulfillVerifiedStripeSession(paidSession);
    expect(latePaymentReplay.wallet).toMatchObject({ gems: 0, gemDebt: 80 });

    const partialPurchase = await prisma.shopPurchase.create({
      data: {
        playerId: player.id,
        productId: "gems-225",
        productType: "GEM_PACK",
        currency: "EUR",
        amount: 599,
        status: "PENDING",
        idempotencyKey: `stripe-partial-${suffix}`,
        paymentProvider: "STRIPE",
        externalReference: `cs_partial_${suffix}`
      }
    });
    await fulfillVerifiedStripeSession({
      id: partialPurchase.externalReference,
      amount_total: 599,
      currency: "eur",
      payment_status: "paid",
      client_reference_id: partialPurchase.id,
      metadata: {
        purchaseId: partialPurchase.id,
        playerId: player.id,
        productId: "gems-225"
      },
      payment_intent: {
        id: `pi_partial_${suffix}`,
        latest_charge: { receipt_url: "https://pay.stripe.com/receipts/partial" }
      }
    } as unknown as Parameters<typeof fulfillVerifiedStripeSession>[0]);

    const partialCharge = {
      id: `ch_partial_${suffix}`,
      payment_intent: `pi_partial_${suffix}`,
      amount_refunded: 300,
      receipt_url: "https://pay.stripe.com/receipts/partial-refund"
    } as unknown as Parameters<typeof reconcileStripeRefundedCharge>[0];
    const partialRefund = await reconcileStripeRefundedCharge(partialCharge);
    const repeatedPartialRefund = await reconcileStripeRefundedCharge(partialCharge);
    expect(partialRefund.purchase.status).toBe("PARTIALLY_REFUNDED");
    expect(partialRefund.purchase.reversedGems).toBe(112);
    expect(partialRefund.wallet).toMatchObject({ gems: 33, gemDebt: 0 });
    expect(repeatedPartialRefund.wallet).toMatchObject({ gems: 33, gemDebt: 0 });

    const concurrentPurchase = await prisma.shopPurchase.create({
      data: {
        playerId: player.id,
        productId: "gems-100",
        productType: "GEM_PACK",
        currency: "EUR",
        amount: 299,
        status: "PENDING",
        idempotencyKey: `stripe-concurrent-${suffix}`,
        paymentProvider: "STRIPE",
        externalReference: `cs_concurrent_${suffix}`
      }
    });
    await fulfillVerifiedStripeSession({
      id: concurrentPurchase.externalReference,
      amount_total: 299,
      currency: "eur",
      payment_status: "paid",
      client_reference_id: concurrentPurchase.id,
      metadata: {
        purchaseId: concurrentPurchase.id,
        playerId: player.id,
        productId: "gems-100"
      },
      payment_intent: {
        id: `pi_concurrent_${suffix}`,
        latest_charge: { receipt_url: "https://pay.stripe.com/receipts/concurrent" }
      }
    } as unknown as Parameters<typeof fulfillVerifiedStripeSession>[0]);
    await prisma.player.update({
      where: { id: player.id },
      data: { gems: 108, gemDebt: 0 }
    });
    const notificationsBefore = await prisma.notification.count({
      where: { userId: user.id, type: "SHOP", title: "Achat remboursé" }
    });
    const concurrentCharge = {
      id: `ch_concurrent_${suffix}`,
      payment_intent: `pi_concurrent_${suffix}`,
      amount_refunded: 299,
      receipt_url: "https://pay.stripe.com/receipts/concurrent-refund"
    } as unknown as Parameters<typeof reconcileStripeRefundedCharge>[0];
    await Promise.all([
      reconcileStripeRefundedCharge(concurrentCharge),
      reconcileStripeRefundedCharge(concurrentCharge),
      reconcileStripeRefundedCharge(concurrentCharge)
    ]);
    const walletAfterConcurrentRefund = await prisma.player.findUniqueOrThrow({
      where: { id: player.id },
      select: { gems: true, gemDebt: true }
    });
    const notificationsAfter = await prisma.notification.count({
      where: { userId: user.id, type: "SHOP", title: "Achat remboursé" }
    });
    expect(walletAfterConcurrentRefund).toEqual({ gems: 8, gemDebt: 0 });
    expect(notificationsAfter - notificationsBefore).toBe(1);
  });
});
