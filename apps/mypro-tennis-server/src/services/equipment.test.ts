import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@mypro/database";
import { cosmeticMarketRefundForItems, cosmeticUpgradeInvestment } from "./equipment";

describe("marche de l'occasion des cosmetiques", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("calcule la valeur investie dans les ameliorations d'un objet", () => {
    expect(cosmeticUpgradeInvestment("Bronze", 3)).toBe(6000);
    expect(cosmeticUpgradeInvestment("Argent", 2)).toBe(6000);
    expect(cosmeticUpgradeInvestment("Mythique", 1)).toBe(5000);
  });

  it("restitue 30 pour cent de la valeur investie", () => {
    expect(
      cosmeticMarketRefundForItems([
        { rarity: "Bronze", upgradeLevel: 3 },
        { rarity: "Argent", upgradeLevel: 2 }
      ])
    ).toBe(3600);
  });
});
