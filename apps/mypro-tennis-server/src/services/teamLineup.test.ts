import { describe, expect, it } from "vitest";
import { orderPlayersForSingles } from "./teamLineup";

const player = (id: string, fftRanking: string, overall: number, budget: number) => ({
  id,
  fftRanking,
  overall,
  budget
});

describe("orderPlayersForSingles", () => {
  it("classe les titulaires du plus fort au moins fort selon FFT, niveau puis argent", () => {
    const ordered = orderPlayersForSingles(
      [
        player("a", "30/2", 80, 200_000),
        player("b", "15/1", 20, 0),
        player("c", "30/2", 82, 10_000),
        player("d", "30/2", 82, 25_000),
        player("e", "NC", 99, 999_999)
      ],
      "club-test"
    );

    expect(ordered.map((item) => item.id)).toEqual(["b", "d", "c", "a", "e"]);
  });
});
