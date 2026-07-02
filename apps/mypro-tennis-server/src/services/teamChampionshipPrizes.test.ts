import { describe, expect, it } from "vitest";
import { teamChampionshipCashPrize, teamChampionshipPrizeTable } from "./teamChampionshipPrizes";

describe("teamChampionshipCashPrize", () => {
  it("retourne les primes exactes du barème par division et position", () => {
    expect(teamChampionshipCashPrize("Départementale 4", 1)).toBe(1200);
    expect(teamChampionshipCashPrize("Régionale 3", 13)).toBe(300);
    expect(teamChampionshipCashPrize("Nationale 1", 2)).toBe(7200);
    expect(teamChampionshipCashPrize("Elite 1", 1)).toBe(24000);
  });

  it("ne crée pas de Régionale 4 dans la hiérarchie de primes", () => {
    expect(teamChampionshipPrizeTable["Régionale 4"]).toBeUndefined();
    expect(teamChampionshipCashPrize("Régionale 4", 1)).toBe(0);
  });
});
