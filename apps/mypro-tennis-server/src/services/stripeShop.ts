import Stripe from "stripe";
import { Prisma, type ShopPurchase } from "@prisma/client";
import { prisma } from "@mypro/database";
import type { ShopStripeCheckoutInput } from "@mypro/shared";
import { config } from "../config";
import { decodeJson, encodeJson } from "./json";
import { ShopError, shopBagPacks, shopCreditPacks, shopGemPacks, shopSeasonPass } from "./shop";

const STRIPE_PROVIDER = "STRIPE";
const STRIPE_CURRENCY = "EUR";

type StripeGemProduct = (typeof shopGemPacks)[number];

const productLabels = new Map(
  [...shopGemPacks, ...shopBagPacks, ...shopCreditPacks, shopSeasonPass].map((product) => [
    product.id,
    product.label
  ])
);

function configuredStripe() {
  const mode = stripeMode();
  if (mode === "UNCONFIGURED" || !config.stripeWebhookSecret.startsWith("whsec_")) {
    throw new ShopError("Le paiement Stripe n'est pas encore configuré.", 503);
  }
  if (mode === "LIVE" && !config.stripeLivePaymentsEnabled) {
    throw new ShopError("Les paiements Stripe réels sont désactivés par sécurité.", 503);
  }
  return new Stripe(config.stripeSecretKey);
}

function stripeMode() {
  if (!config.stripeSecretKey) return "UNCONFIGURED" as const;
  if (/^(sk|rk)_live_/.test(config.stripeSecretKey)) return "LIVE" as const;
  if (/^(sk|rk)_test_/.test(config.stripeSecretKey)) return "TEST" as const;
  return "UNCONFIGURED" as const;
}

export function stripeShopConfiguration() {
  const mode = stripeMode();
  const webhookConfigured = config.stripeWebhookSecret.startsWith("whsec_");
  return {
    provider: STRIPE_PROVIDER,
    enabled:
      mode !== "UNCONFIGURED" &&
      webhookConfigured &&
      (mode !== "LIVE" || config.stripeLivePaymentsEnabled),
    mode,
    webhookConfigured
  };
}

function gemProduct(productId: string) {
  const product = shopGemPacks.find((item) => item.id === productId);
  if (!product) throw new ShopError("Pack de gemmes indisponible.", 404);
  return product;
}

function checkoutMetadata(purchase: ShopPurchase, product: StripeGemProduct) {
  return {
    purchaseId: purchase.id,
    playerId: purchase.playerId,
    productId: product.id
  };
}

function publicStripePurchase(purchase: ShopPurchase) {
  return {
    id: purchase.id,
    productId: purchase.productId,
    productType: purchase.productType,
    currency: purchase.currency,
    amount: purchase.amount,
    status: purchase.status,
    paymentProvider: purchase.paymentProvider,
    checkoutSessionId: purchase.externalReference,
    providerPaymentId: purchase.providerPaymentId,
    receiptUrl: purchase.receiptUrl,
    refundedAmount: purchase.refundedAmount,
    reversedGems: purchase.reversedGems,
    refundedAt: purchase.refundedAt,
    rewards: decodeJson<Record<string, unknown>>(purchase.rewards),
    createdAt: purchase.createdAt,
    updatedAt: purchase.updatedAt
  };
}

async function localStripePurchaseState(playerId: string, purchase: ShopPurchase) {
  const player = await prisma.player.findUnique({
    where: { id: playerId },
    select: { gems: true, gemDebt: true, budget: true }
  });
  if (!player) throw new ShopError("Joueur introuvable.", 404);
  return {
    purchase: publicStripePurchase(purchase),
    wallet: { gems: player.gems, gemDebt: player.gemDebt, credits: player.budget }
  };
}

async function findOrCreateStripePurchase(playerId: string, input: ShopStripeCheckoutInput) {
  const product = gemProduct(input.productId);
  const existing = await prisma.shopPurchase.findUnique({
    where: { playerId_idempotencyKey: { playerId, idempotencyKey: input.idempotencyKey } }
  });
  if (existing) {
    if (existing.paymentProvider !== STRIPE_PROVIDER || existing.productId !== product.id) {
      throw new ShopError("Cette référence d'achat est déjà utilisée.", 409);
    }
    return { purchase: existing, product };
  }

  try {
    const purchase = await prisma.shopPurchase.create({
      data: {
        playerId,
        productId: product.id,
        productType: product.type,
        currency: STRIPE_CURRENCY,
        amount: product.priceCents,
        status: "CREATING",
        idempotencyKey: input.idempotencyKey,
        paymentProvider: STRIPE_PROVIDER
      }
    });
    return { purchase, product };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const concurrent = await prisma.shopPurchase.findUnique({
        where: { playerId_idempotencyKey: { playerId, idempotencyKey: input.idempotencyKey } }
      });
      if (concurrent?.paymentProvider === STRIPE_PROVIDER && concurrent.productId === product.id) {
        return { purchase: concurrent, product };
      }
    }
    throw error;
  }
}

export async function createStripeShopCheckout(playerId: string, input: ShopStripeCheckoutInput) {
  const stripe = configuredStripe();
  const pendingCheckout = await findOrCreateStripePurchase(playerId, input);
  let purchase = pendingCheckout.purchase;
  const product = pendingCheckout.product;

  if (purchase.status === "COMPLETED") {
    return {
      ...(await localStripePurchaseState(playerId, purchase)),
      checkout: null,
      alreadyCompleted: true
    };
  }

  if (purchase.externalReference) {
    const existingSession = await stripe.checkout.sessions.retrieve(purchase.externalReference);
    return {
      purchase: publicStripePurchase(purchase),
      checkout: {
        id: existingSession.id,
        url: existingSession.url,
        status: existingSession.status,
        expiresAt: existingSession.expires_at
      },
      alreadyCompleted: false
    };
  }

  const owner = await prisma.player.findUnique({
    where: { id: playerId },
    select: { user: { select: { email: true } } }
  });
  if (!owner?.user) throw new ShopError("Compte joueur introuvable.", 404);

  const metadata = checkoutMetadata(purchase, product);
  const session = await stripe.checkout.sessions.create(
    {
      mode: "payment",
      locale: "fr",
      client_reference_id: purchase.id,
      customer_email: owner.user.email,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: STRIPE_CURRENCY.toLowerCase(),
            unit_amount: product.priceCents,
            product_data: {
              name: `MYPRO TENNIS · ${product.label}`,
              description: `${product.gems.toLocaleString("fr-FR")} gemmes créditées après validation du paiement.`
            }
          }
        }
      ],
      metadata,
      payment_intent_data: { metadata },
      success_url: `${config.clientUrl}/shop?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${config.clientUrl}/shop?checkout=cancelled`
    },
    { idempotencyKey: `mypro-shop-${purchase.id}` }
  );

  purchase = await prisma.shopPurchase.update({
    where: { id: purchase.id },
    data: { externalReference: session.id, status: "PENDING" }
  });

  return {
    purchase: publicStripePurchase(purchase),
    checkout: {
      id: session.id,
      url: session.url,
      status: session.status,
      expiresAt: session.expires_at
    },
    alreadyCompleted: false
  };
}

function validatePaidSession(
  purchase: ShopPurchase,
  product: StripeGemProduct,
  session: Stripe.Checkout.Session
) {
  if (session.payment_status === "unpaid") {
    throw new ShopError("Le paiement n'est pas encore confirmé.", 202);
  }
  if (
    purchase.amount !== product.priceCents ||
    purchase.currency !== STRIPE_CURRENCY ||
    session.amount_total !== product.priceCents ||
    session.currency?.toUpperCase() !== STRIPE_CURRENCY
  ) {
    throw new ShopError("Le montant du paiement ne correspond pas au produit.", 409);
  }
  if (
    session.client_reference_id !== purchase.id ||
    session.metadata?.purchaseId !== purchase.id ||
    session.metadata?.playerId !== purchase.playerId ||
    session.metadata?.productId !== purchase.productId
  ) {
    throw new ShopError("La référence du paiement est invalide.", 409);
  }
}

function stripePaymentDetails(session: Stripe.Checkout.Session) {
  const paymentIntent = session.payment_intent;
  const providerPaymentId =
    typeof paymentIntent === "string" ? paymentIntent : (paymentIntent?.id ?? null);
  const latestCharge =
    typeof paymentIntent === "object" && paymentIntent ? paymentIntent.latest_charge : null;
  const receiptUrl =
    typeof latestCharge === "object" && latestCharge ? latestCharge.receipt_url : null;
  return { providerPaymentId, receiptUrl };
}

export async function fulfillVerifiedStripeSession(session: Stripe.Checkout.Session) {
  const purchaseId = session.client_reference_id ?? session.metadata?.purchaseId;
  if (!purchaseId) throw new ShopError("Référence d'achat Stripe absente.", 400);

  const initial = await prisma.shopPurchase.findUnique({ where: { id: purchaseId } });
  if (!initial || initial.paymentProvider !== STRIPE_PROVIDER) {
    throw new ShopError("Achat Stripe introuvable.", 404);
  }
  if (initial.externalReference && initial.externalReference !== session.id) {
    throw new ShopError("Session Stripe non reconnue.", 409);
  }
  const product = gemProduct(initial.productId);
  validatePaidSession(initial, product, session);
  const paymentDetails = stripePaymentDetails(session);

  return prisma.$transaction(async (tx) => {
    const current = await tx.shopPurchase.findUnique({ where: { id: initial.id } });
    if (!current) throw new ShopError("Achat Stripe introuvable.", 404);
    if (current.status === "COMPLETED") {
      if (
        (paymentDetails.providerPaymentId && !current.providerPaymentId) ||
        (paymentDetails.receiptUrl && !current.receiptUrl)
      ) {
        await tx.shopPurchase.update({
          where: { id: current.id },
          data: {
            providerPaymentId: paymentDetails.providerPaymentId,
            receiptUrl: paymentDetails.receiptUrl
          }
        });
      }
    } else {
      const claimed = await tx.shopPurchase.updateMany({
        where: {
          id: current.id,
          status: { in: ["CREATING", "PENDING", "PROCESSING", "FAILED"] }
        },
        data: {
          status: "PROCESSING",
          externalReference: session.id,
          providerPaymentId: paymentDetails.providerPaymentId,
          receiptUrl: paymentDetails.receiptUrl
        }
      });
      if (claimed.count === 1) {
        const player = await tx.player.findUniqueOrThrow({
          where: { id: current.playerId },
          select: { gems: true, gemDebt: true, userId: true }
        });
        const debtSettled = Math.min(player.gemDebt, product.gems);
        const gemsCredited = product.gems - debtSettled;
        await tx.player.update({
          where: { id: current.playerId },
          data: {
            gems: { increment: gemsCredited },
            gemDebt: { decrement: debtSettled }
          }
        });
        if (player.userId) {
          await tx.notification.create({
            data: {
              userId: player.userId,
              title: "Gemmes reçues",
              body:
                debtSettled > 0
                  ? `${gemsCredited.toLocaleString("fr-FR")} gemmes ajoutées et ${debtSettled.toLocaleString("fr-FR")} régularisées après remboursement.`
                  : `${product.gems.toLocaleString("fr-FR")} gemmes ont été ajoutées à votre compte.`,
              type: "SHOP"
            }
          });
        }
        await tx.shopPurchase.update({
          where: { id: current.id },
          data: {
            status: "COMPLETED",
            providerPaymentId: paymentDetails.providerPaymentId,
            receiptUrl: paymentDetails.receiptUrl,
            rewards: encodeJson({
              gems: product.gems,
              gemsCredited,
              debtSettled,
              stripeCheckoutSessionId: session.id
            })
          }
        });
      }
    }

    const [completed, player] = await Promise.all([
      tx.shopPurchase.findUniqueOrThrow({ where: { id: current.id } }),
      tx.player.findUniqueOrThrow({
        where: { id: current.playerId },
        select: { gems: true, gemDebt: true, budget: true }
      })
    ]);
    return {
      purchase: publicStripePurchase(completed),
      wallet: { gems: player.gems, gemDebt: player.gemDebt, credits: player.budget }
    };
  });
}

export async function fulfillStripeCheckoutSession(sessionId: string) {
  const stripe = configuredStripe();
  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ["payment_intent.latest_charge"]
  });
  if (session.payment_status === "unpaid") {
    return { pending: true, sessionId: session.id };
  }
  return fulfillVerifiedStripeSession(session);
}

export async function stripeCheckoutStateForPlayer(playerId: string, sessionId: string) {
  const purchase = await prisma.shopPurchase.findFirst({
    where: { playerId, externalReference: sessionId, paymentProvider: STRIPE_PROVIDER }
  });
  if (!purchase) throw new ShopError("Paiement introuvable.", 404);
  if (["COMPLETED", "PARTIALLY_REFUNDED", "REFUNDED"].includes(purchase.status)) {
    return localStripePurchaseState(playerId, purchase);
  }
  return fulfillStripeCheckoutSession(sessionId);
}

export async function shopPurchaseHistory(playerId: string) {
  const [purchases, player] = await Promise.all([
    prisma.shopPurchase.findMany({
      where: { playerId },
      orderBy: { createdAt: "desc" },
      take: 50
    }),
    prisma.player.findUnique({
      where: { id: playerId },
      select: { gemDebt: true }
    })
  ]);
  if (!player) throw new ShopError("Joueur introuvable.", 404);
  return {
    gemDebt: player.gemDebt,
    purchases: purchases.map((purchase) => ({
      ...publicStripePurchase(purchase),
      label: productLabels.get(purchase.productId) ?? purchase.productId
    }))
  };
}

export async function reconcileStripeRefundedCharge(charge: Stripe.Charge) {
  const providerPaymentId =
    typeof charge.payment_intent === "string"
      ? charge.payment_intent
      : (charge.payment_intent?.id ?? null);
  if (!providerPaymentId) throw new ShopError("Paiement du remboursement introuvable.", 404);
  const initial = await prisma.shopPurchase.findUnique({ where: { providerPaymentId } });
  if (!initial || initial.paymentProvider !== STRIPE_PROVIDER) {
    throw new ShopError("Achat du remboursement introuvable.", 404);
  }
  const product = gemProduct(initial.productId);

  // Stripe peut envoyer charge.refunded, refund.created et refund.updated presque
  // simultanément. La mise à jour conditionnelle ci-dessous réserve le nouveau
  // montant remboursé à une seule transaction avant de toucher au portefeuille.
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const outcome = await prisma.$transaction(async (tx) => {
      const current = await tx.shopPurchase.findUniqueOrThrow({ where: { id: initial.id } });
      const refundedAmount = Math.max(
        current.refundedAmount,
        Math.min(current.amount, charge.amount_refunded)
      );
      const targetReversedGems =
        refundedAmount >= current.amount
          ? product.gems
          : Math.floor((product.gems * refundedAmount) / current.amount);

      if (refundedAmount <= current.refundedAmount && targetReversedGems <= current.reversedGems) {
        const purchase =
          charge.receipt_url && charge.receipt_url !== current.receiptUrl
            ? await tx.shopPurchase.update({
                where: { id: current.id },
                data: { receiptUrl: charge.receipt_url }
              })
            : current;
        const wallet = await tx.player.findUniqueOrThrow({
          where: { id: current.playerId },
          select: { gems: true, gemDebt: true, budget: true }
        });
        return {
          retry: false as const,
          result: {
            purchase: publicStripePurchase(purchase),
            wallet: { gems: wallet.gems, gemDebt: wallet.gemDebt, credits: wallet.budget }
          }
        };
      }

      const status = refundedAmount >= current.amount ? "REFUNDED" : "PARTIALLY_REFUNDED";
      const claimed = await tx.shopPurchase.updateMany({
        where: {
          id: current.id,
          refundedAmount: current.refundedAmount,
          reversedGems: current.reversedGems
        },
        data: {
          status,
          refundedAmount,
          reversedGems: targetReversedGems,
          refundedAt: new Date(),
          receiptUrl: charge.receipt_url ?? current.receiptUrl
        }
      });
      if (claimed.count === 0) return { retry: true as const };

      const gemsToReverse = Math.max(0, targetReversedGems - current.reversedGems);
      const player = await tx.player.findUniqueOrThrow({
        where: { id: current.playerId },
        select: { gems: true, userId: true }
      });
      const removedGems = Math.min(Math.max(0, player.gems), gemsToReverse);
      const gemDebtAdded = gemsToReverse - removedGems;

      if (gemsToReverse > 0) {
        await tx.player.update({
          where: { id: current.playerId },
          data: {
            gems: { decrement: removedGems },
            gemDebt: { increment: gemDebtAdded }
          }
        });
      }
      if (gemsToReverse > 0 && player.userId) {
        await tx.notification.create({
          data: {
            userId: player.userId,
            title: status === "REFUNDED" ? "Achat remboursé" : "Achat partiellement remboursé",
            body:
              gemDebtAdded > 0
                ? `${removedGems} gemmes retirées et ${gemDebtAdded} à régulariser sur vos prochains achats.`
                : `${removedGems} gemmes ont été retirées de votre compte.`,
            type: "SHOP"
          }
        });
      }
      const [purchase, wallet] = await Promise.all([
        tx.shopPurchase.findUniqueOrThrow({ where: { id: current.id } }),
        tx.player.findUniqueOrThrow({
          where: { id: current.playerId },
          select: { gems: true, gemDebt: true, budget: true }
        })
      ]);
      return {
        retry: false as const,
        result: {
          purchase: publicStripePurchase(purchase),
          wallet: { gems: wallet.gems, gemDebt: wallet.gemDebt, credits: wallet.budget }
        }
      };
    });

    if (!outcome.retry) return outcome.result;
  }

  throw new ShopError("Le remboursement est déjà en cours de traitement. Réessayez.", 409);
}

async function reconcileStripeRefund(refund: Stripe.Refund) {
  if (refund.status !== "succeeded") return;
  const chargeId = typeof refund.charge === "string" ? refund.charge : refund.charge?.id;
  if (!chargeId) return;
  const stripe = configuredStripe();
  const charge = await stripe.charges.retrieve(chargeId);
  await reconcileStripeRefundedCharge(charge);
}

async function markStripeCheckoutFailed(session: Stripe.Checkout.Session) {
  await prisma.shopPurchase.updateMany({
    where: {
      externalReference: session.id,
      paymentProvider: STRIPE_PROVIDER,
      status: { not: "COMPLETED" }
    },
    data: { status: "FAILED" }
  });
}

export async function processStripeWebhook(payload: Buffer, signature: string | undefined) {
  if (!signature) throw new ShopError("Signature Stripe absente.", 400);
  const stripe = configuredStripe();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, config.stripeWebhookSecret);
  } catch {
    throw new ShopError("Signature Stripe invalide.", 400);
  }

  if (
    event.type === "checkout.session.completed" ||
    event.type === "checkout.session.async_payment_succeeded"
  ) {
    await fulfillStripeCheckoutSession(event.data.object.id);
  } else if (event.type === "checkout.session.async_payment_failed") {
    await markStripeCheckoutFailed(event.data.object);
  } else if (event.type === "checkout.session.expired") {
    await prisma.shopPurchase.updateMany({
      where: {
        externalReference: event.data.object.id,
        paymentProvider: STRIPE_PROVIDER,
        status: { in: ["CREATING", "PENDING"] }
      },
      data: { status: "EXPIRED" }
    });
  } else if (event.type === "charge.refunded") {
    await reconcileStripeRefundedCharge(event.data.object);
  } else if (event.type === "refund.created" || event.type === "refund.updated") {
    await reconcileStripeRefund(event.data.object);
  }
  return { received: true, eventId: event.id };
}
