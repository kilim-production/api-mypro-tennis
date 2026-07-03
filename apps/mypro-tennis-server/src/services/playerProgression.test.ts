import { describe, expect, it } from "vitest";
import { archetypeMatchBonuses, archetypePerksForPlayer } from "./playerProgression";

describe("paliers de competences d'archetype", () => {
  it("debloque les bonus passifs selon le niveau joueur", () => {
    expect(archetypePerksForPlayer({ archetype: "Gros service", playerLevel: 9 })[0]?.unlocked).toBe(
      false
    );
    expect(archetypePerksForPlayer({ archetype: "Gros service", playerLevel: 10 })[0]?.unlocked).toBe(
      true
    );
    expect(archetypePerksForPlayer({ archetype: "Gros service", playerLevel: 25 }).filter((perk) => perk.unlocked)).toHaveLength(2);
  });

  it("additionne les bonus actifs pour le match", () => {
    const bonuses = archetypeMatchBonuses({ archetype: "Relanceur", playerLevel: 100 });
    expect(bonuses.return).toBeGreaterThanOrEqual(7);
    expect(bonuses.speed).toBeGreaterThanOrEqual(2);
    expect(Object.values(bonuses).reduce((sum, value) => sum + (value ?? 0), 0)).toBeGreaterThan(8);
  });
});
