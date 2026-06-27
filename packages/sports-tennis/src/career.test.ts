import { describe, expect, it } from "vitest";
import {
  amateurMatchPoints,
  calculateFftRanking,
  fftNegativeValidationPoints,
  fftVictoryPoints,
  getCareerStage,
  getFftRankingForPoints,
  isProfessionalUnlocked,
  nextFftRanking
} from "./index";

describe("parcours FFT amateur", () => {
  it("démarre non classé et suit toute la pyramide FFT jusqu'à -15", () => {
    expect(getFftRankingForPoints(0)).toBe("NC");
    expect(nextFftRanking("NC")).toBe("40/2");
    expect(nextFftRanking("15/1")).toBe("15");
    expect(getFftRankingForPoints(3500)).toBe("-15");
  });

  it("ne débloque pas le circuit professionnel sans validation de -15", () => {
    expect(getCareerStage("-15", false)).toBe("Pré-pro");
    expect(isProfessionalUnlocked("-15", false)).toBe(false);
    expect(isProfessionalUnlocked("-15", true)).toBe(true);
    expect(fftNegativeValidationPoints).toBe(3500);
  });

  it("accorde des points seulement en match officiel", () => {
    expect(amateurMatchPoints({ won: true, opponentOverall: 55, playerOverall: 50, official: false })).toBe(0);
    expect(amateurMatchPoints({ won: true, opponentOverall: 55, playerOverall: 50, official: true })).toBeGreaterThan(80);
  });

  it("applique le barème FFT des victoires selon l'écart d'échelon", () => {
    expect(fftVictoryPoints("15/1", "5/6")).toBe(120);
    expect(fftVictoryPoints("15/1", "15")).toBe(90);
    expect(fftVictoryPoints("15/1", "15/1")).toBe(60);
    expect(fftVictoryPoints("15/1", "15/2")).toBe(30);
    expect(fftVictoryPoints("15/1", "15/5")).toBe(0);
  });

  it("calcule le classement FFT depuis les meilleures victoires du palmarès", () => {
    const results = Array.from({ length: 8 }, (_, index) => ({
      won: true,
      opponentRanking: index === 0 ? ("5/6" as const) : ("15" as const),
      playedAt: new Date("2026-06-25T10:00:00Z")
    }));
    const calculation = calculateFftRanking({
      currentRanking: "15/1",
      gender: "Femme",
      results,
      now: new Date("2026-06-25T12:00:00Z")
    });
    expect(calculation.ranking).toBe("15");
    expect(calculation.points).toBeGreaterThanOrEqual(390);
  });
});
