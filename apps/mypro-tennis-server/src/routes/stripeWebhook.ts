import type { Request, Response } from "express";
import { ShopError } from "../services/shop";
import { processStripeWebhook } from "../services/stripeShop";

export async function stripeShopWebhook(request: Request, response: Response) {
  if (!Buffer.isBuffer(request.body)) {
    return response.status(400).json({ message: "Corps Stripe invalide." });
  }
  try {
    const result = await processStripeWebhook(
      request.body,
      request.header("stripe-signature") ?? undefined
    );
    return response.json(result);
  } catch (error) {
    if (error instanceof ShopError) {
      return response.status(error.statusCode).json({ message: error.message });
    }
    return response.status(500).json({ message: "Traitement du paiement impossible." });
  }
}
