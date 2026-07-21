import { describe, expect, it } from "vitest";
import {
  formatSeasonCredits,
  formatSeasonEndRemaining,
  formatSeasonRemaining,
  seasonCompetitionLabel,
  seasonChampionshipPath,
  seasonDisplayNumber,
  seasonTacticalInsights,
  seasonTournamentBranch,
  seasonTournamentRoundCount,
  seasonTournamentRoundLabel
} from "./seasonUtils";

describe("season utilities", () => {
  it("formats the game currency as credits", () => {
    expect(formatSeasonCredits(12500)).toBe("12 500 CR");
  });

  it("formats a countdown without producing a negative value", () => {
    expect(formatSeasonRemaining(-1)).toBe("0m 00s");
    expect(formatSeasonRemaining(3_661_000)).toBe("1h 01m 01s");
  });

  it("formats the season ending countdown in days and hours", () => {
    expect(formatSeasonEndRemaining(17 * 86_400_000 + 8 * 3_600_000)).toBe("17j 08h");
    expect(formatSeasonEndRemaining(-1)).toBe("0j 00h");
  });

  it("maps every competition type to its player-facing label", () => {
    expect(seasonCompetitionLabel("daily")).toBe("Journalier");
    expect(seasonCompetitionLabel("weekly")).toBe("Hebdomadaire");
    expect(seasonCompetitionLabel("individual")).toBe("Championnat");
  });

  it("extracts the display number from the server season key", () => {
    expect(seasonDisplayNumber("saison-12")).toBe("12");
    expect(seasonDisplayNumber()).toBe("1");
  });

  it("builds the real rounds of a 16-player draw", () => {
    expect(seasonTournamentRoundCount(16)).toBe(4);
    expect(seasonTournamentRoundLabel(16, 0)).toBe("1/8 de finale");
    expect(seasonTournamentRoundLabel(16, 1)).toBe("1/4 de finale");
    expect(seasonTournamentRoundLabel(16, 2)).toBe("1/2 finale");
    expect(seasonTournamentRoundLabel(16, 3)).toBe("Finale");
  });

  it("derives the tactical advantage and the opponent danger from real stats", () => {
    const insights = seasonTacticalInsights(
      { service: 61, return: 50, forehand: 70 },
      { service: 58, return: 64, forehand: 61 }
    );
    expect(insights.advantage.label).toBe("Coup droit");
    expect(insights.advantage.delta).toBe(9);
    expect(insights.danger.label).toBe("Retour");
    expect(insights.danger.opponentValue).toBe(64);
  });

  it("extracts the player's real branch from the tournament tree", () => {
    const entry = {
      currentRound: 1,
      bracket: {
        rounds: [
          {
            name: "Huitièmes",
            matches: [{
              left: { label: "Vous", ranking: "30/4", isPlayer: true },
              right: { label: "T1", ranking: "30/3" },
              winner: { label: "Vous", ranking: "30/4", isPlayer: true },
              scoreText: "6-3 6-2",
              replayMatchId: "match-1"
            }]
          },
          {
            name: "Quarts",
            matches: [{
              left: { label: "Vous", ranking: "30/4", isPlayer: true },
              right: { label: "T4", ranking: "30/2" },
              winner: null
            }]
          }
        ]
      }
    } as never;
    const branch = seasonTournamentBranch(entry);
    expect(branch[0]).toMatchObject({ state: "won", opponentRanking: "30/3" });
    expect(branch[1]).toMatchObject({ state: "current", opponentRanking: "30/2" });
  });

  it("marks the current FFT objective and preserves completed replays", () => {
    const entry = {
      status: "EN_COURS",
      currentRound: 1,
      nextOpponent: { firstName: "Mila", lastName: "Delaune", fftRanking: "30/2" },
      bracket: {
        path: [
          { ranking: "30/3", label: "Départemental" },
          { ranking: "30/2", label: "Régional" }
        ]
      },
      matches: [{
        matchId: "match-1",
        ranking: "30/3",
        won: true,
        opponentName: "Lina Serrano",
        opponentRanking: "30/3",
        scoreText: "6-4 6-4"
      }]
    } as never;
    const path = seasonChampionshipPath(entry);
    expect(path[0]).toMatchObject({ state: "won", replayMatchId: "match-1" });
    expect(path[1]).toMatchObject({ state: "current", opponentLabel: "Mila Delaune" });
  });
});
