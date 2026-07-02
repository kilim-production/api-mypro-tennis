import { describe, expect, it } from "vitest";
import { seasonWindow } from "./seasons";
import { seasonDailyRewards } from "./seasonRewards";

describe("saisons globales", () => {
  it("calcule la meme saison pour tous les joueurs au meme moment", () => {
    const epoch = new Date("2026-06-30T22:00:00.000Z");
    const now = new Date("2026-07-15T10:00:00.000Z");

    const firstPlayerSeason = seasonWindow(now, epoch);
    const secondPlayerSeason = seasonWindow(now, epoch);

    expect(firstPlayerSeason.key).toBe("saison-1");
    expect(secondPlayerSeason.key).toBe(firstPlayerSeason.key);
    expect(secondPlayerSeason.startsAt).toEqual(firstPlayerSeason.startsAt);
    expect(secondPlayerSeason.endsAt).toEqual(firstPlayerSeason.endsAt);
  });

  it("bascule tous les joueurs vers la saison suivante apres 30 jours", () => {
    const epoch = new Date("2026-06-30T22:00:00.000Z");
    const seasonTwo = seasonWindow(new Date("2026-07-31T00:00:00.000Z"), epoch);

    expect(seasonTwo.key).toBe("saison-2");
    expect(seasonTwo.day).toBe(1);
  });

  it("garantit un calendrier de 30 recompenses avec un coffre mythique au jour 30", () => {
    expect(seasonDailyRewards).toHaveLength(30);
    expect(seasonDailyRewards.at(-1)).toEqual({ day: 30, type: "chest", rarity: "Mythique" });
  });
});
