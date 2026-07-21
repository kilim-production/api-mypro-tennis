ALTER TABLE "Player" ADD COLUMN "gemDebt" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "ShopPurchase" ADD COLUMN "providerPaymentId" TEXT;
ALTER TABLE "ShopPurchase" ADD COLUMN "receiptUrl" TEXT;
ALTER TABLE "ShopPurchase" ADD COLUMN "refundedAmount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ShopPurchase" ADD COLUMN "reversedGems" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ShopPurchase" ADD COLUMN "refundedAt" DATETIME;

CREATE UNIQUE INDEX "ShopPurchase_providerPaymentId_key" ON "ShopPurchase"("providerPaymentId");
