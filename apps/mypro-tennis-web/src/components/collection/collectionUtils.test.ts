import { describe, expect, it } from "vitest";
import {
  cardProgressPercent,
  cosmeticIconPath,
  cosmeticMarketRecipes,
  formatCredits,
  sortCosmeticsByRarity
} from "./collectionUtils";
import type { PlayerCosmeticItem } from "./types";

function item(
  id: string,
  rarity: PlayerCosmeticItem["rarity"],
  equippedSlot: number | null
): PlayerCosmeticItem {
  return {
    id,
    cosmeticId: id,
    name: id,
    rarity,
    bonuses: { service: 1 },
    upgradeLevel: 0,
    nextUpgradeCost: 100,
    canUpgrade: true,
    equippedSlot,
    ownedAt: "2026-07-16T00:00:00.000Z"
  };
}

describe("collection utilities", () => {
  it("sorts objects by rarity, then keeps equipped objects first", () => {
    const sorted = sortCosmeticsByRarity([
      item("bronze", "Bronze", null),
      item("or-libre", "Or", null),
      item("or-equipe", "Or", 0),
      item("mythique", "Mythique", null)
    ]);

    expect(sorted.map((entry) => entry.id)).toEqual([
      "mythique",
      "or-equipe",
      "or-libre",
      "bronze"
    ]);
  });

  it("keeps every live market recipe and the credits currency", () => {
    expect(
      cosmeticMarketRecipes.map(({ required, rarity, resultRarity, money }) => ({
        required,
        rarity,
        resultRarity,
        money
      }))
    ).toEqual([
      { required: 3, rarity: "Bronze", resultRarity: "Argent", money: 0 },
      { required: 6, rarity: "Argent", resultRarity: "Or", money: 0 },
      { required: 9, rarity: "Or", resultRarity: "Légendaire", money: 0 },
      { required: 12, rarity: "Légendaire", resultRarity: "Mythique", money: 0 },
      { required: 1, rarity: "Mythique", resultRarity: null, money: 10_000 }
    ]);
    expect(formatCredits(6_830)).toBe("6 830 CR");
  });

  it("uses the existing visual library for the current cosmetic families", () => {
    expect(cosmeticIconPath("Poignets Élite")).toContain("wristbands-emerald");
    expect(cosmeticIconPath("Surgrip noir premium")).toContain("premium-overgrip");
    expect(cosmeticIconPath("Maillot junior")).toContain("junior-shirt");
    expect(cosmeticIconPath("Sac Tour")).toContain("signature-bag");
  });

  it("clamps card progress for safe progress bars", () => {
    expect(cardProgressPercent({ copiesIntoLevel: 3, copiesNeeded: 6 })).toBe(50);
    expect(cardProgressPercent({ copiesIntoLevel: 9, copiesNeeded: 6 })).toBe(100);
    expect(cardProgressPercent({ copiesIntoLevel: -1, copiesNeeded: 0 })).toBe(0);
  });
});
