import { describe, expect, it } from "vitest";
import {
  buildingEffectLabel,
  buildingLevelImage,
  championshipPreviewStandings,
  clubBuildingForClub,
  clubBuildingUpgradeEligibility,
  clubCanAcceptRequest,
  clubChampionshipVisualState,
  clubDepartureMode,
  clubDuesVisualState,
  clubJoinAvailability,
  clubDuesAmount,
  clubTeamReadiness,
  fallbackDuesState,
  fftIndex,
  formatCredits
} from "./clubUtils";
import type { ClubDetails } from "./types";

const club: ClubDetails = {
  id: "club-1",
  name: "MyPro Academy",
  tag: "MPT",
  description: "Club test",
  minimumRanking: "15/4",
  duesAmount: 1500,
  budget: 128500,
  complexLevel: 2,
  careCenterLevel: 1,
  trainingCenterLevel: 0,
  competitiveLevel: "Régionale 2",
  maxSlots: 10,
  memberCount: 6,
  openSlots: 4,
  president: {
    id: "player-1",
    name: "Alex Moreau",
    nationality: "FR",
    fftRanking: "15/2",
    overall: 64,
    worldRank: 12,
    avatar: "AM"
  },
  createdAt: "2026-07-16T00:00:00.000Z",
  isPresident: true,
  members: [],
  pendingRequests: []
};

describe("club utilities", () => {
  it("uses credits consistently", () => {
    expect(formatCredits(128500)).toBe("128 500 CR");
    expect(clubDuesAmount(club)).toBe(1500);
    expect(clubDuesAmount(undefined)).toBe(0);
  });

  it("keeps the FFT ranking order used by join restrictions", () => {
    expect(fftIndex("NC")).toBe(0);
    expect(fftIndex("15/4")).toBeGreaterThan(fftIndex("30"));
    expect(fftIndex("unknown")).toBe(0);
  });

  it("rebuilds missing building payloads with the current rules", () => {
    const complex = clubBuildingForClub(club, "complex");
    const careCenter = clubBuildingForClub(club, "careCenter");
    const trainingCenter = clubBuildingForClub(club, "trainingCenter");

    expect(complex.currentLevel.level).toBe(2);
    expect(buildingEffectLabel(complex)).toBe("10 joueurs");
    expect(careCenter.currentLevel.recoveryReductionPercent).toBe(3);
    expect(trainingCenter.currentLevel.rareChestBonusPercent).toBe(0);
    expect(buildingLevelImage("complex", 2)).toBe("/visuals/club/complex-level-2.jpg");
    expect(buildingLevelImage("trainingCenter", 0)).toBe("");
  });

  it("keeps every infrastructure level and protects upgrades", () => {
    const complex = clubBuildingForClub(club, "complex");
    const careCenter = clubBuildingForClub(club, "careCenter");
    const trainingCenter = clubBuildingForClub(club, "trainingCenter");

    expect(complex.levels.map((level) => level.level)).toEqual([1, 2, 3, 4, 5]);
    expect(careCenter.levels.map((level) => level.level)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(trainingCenter.levels.map((level) => level.level)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(clubBuildingUpgradeEligibility(club, complex)).toMatchObject({
      canManage: true,
      canAfford: true,
      canUpgrade: true,
      shortfall: 0
    });
    expect(
      clubBuildingUpgradeEligibility({ isPresident: false, budget: club.budget }, complex)
    ).toMatchObject({ canManage: false, canUpgrade: false });
    expect(
      clubBuildingUpgradeEligibility({ isPresident: true, budget: 0 }, complex)
    ).toMatchObject({ canAfford: false, canUpgrade: false });

    const maximumComplex = clubBuildingForClub({ ...club, complexLevel: 5 }, "complex");
    expect(clubBuildingUpgradeEligibility(club, maximumComplex)).toMatchObject({
      nextLevel: null,
      canUpgrade: false,
      shortfall: 0
    });
  });

  it("blocks request acceptance when the club is full", () => {
    expect(clubCanAcceptRequest({ openSlots: 1 })).toBe(true);
    expect(clubCanAcceptRequest({ openSlots: 0 })).toBe(false);
  });

  it("explains every blocked club application", () => {
    const candidate = {
      minimumRanking: "30/5",
      myRequestStatus: null,
      openSlots: 2
    };
    expect(
      clubJoinAvailability({ club: candidate, playerRanking: "30", hasPendingRequest: false, busy: false })
    ).toMatchObject({ state: "available", disabled: false });
    expect(
      clubJoinAvailability({ club: { ...candidate, openSlots: 0 }, playerRanking: "30", hasPendingRequest: false, busy: false })
    ).toMatchObject({ state: "full", label: "Club complet" });
    expect(
      clubJoinAvailability({ club: candidate, playerRanking: "NC", hasPendingRequest: false, busy: false })
    ).toMatchObject({ state: "ranking", label: "Requis 30/5" });
    expect(
      clubJoinAvailability({ club: candidate, playerRanking: "30", hasPendingRequest: true, busy: false })
    ).toMatchObject({ state: "pending", label: "Demande déjà active" });
  });

  it("creates the same fallback dues state as the legacy page", () => {
    expect(fallbackDuesState(club)).toMatchObject({
      amount: 1500,
      currentPlayerPaid: false,
      currentPlayerCanPay: false,
      paidCount: 0,
      eligibleCount: 0
    });
  });

  it("exposes the four championship dues states", () => {
    const base = fallbackDuesState(club);

    expect(clubDuesVisualState({ ...base, amount: 0 }).state).toBe("free");
    expect(clubDuesVisualState({ ...base, currentPlayerPaid: true }).state).toBe("paid");
    expect(clubDuesVisualState({ ...base, isWindowOpen: true }).state).toBe("due");
    expect(clubDuesVisualState(base).state).toBe("closed");
  });

  it("uses the same ranked entries for the top five and the player shortcut", () => {
    const standings = Array.from({ length: 7 }, (_, index) => ({
      id: `club-${index + 1}`,
      rank: index + 1,
      name: `Club ${index + 1}`,
      tag: `C${index + 1}`,
      isPlayerClub: index === 6,
      points: 20 - index,
      played: 3,
      wins: 2,
      losses: 1,
      matchesFor: 8,
      matchesAgainst: 4,
      setsFor: 16,
      setsAgainst: 10,
      gamesFor: 100,
      gamesAgainst: 80
    }));

    const preview = championshipPreviewStandings(standings);
    expect(preview.top.map((entry) => entry.rank)).toEqual([1, 2, 3, 4, 5]);
    expect(preview.playerOutsideTop?.rank).toBe(7);
  });

  it("labels absent, planned, active and completed championships without ambiguity", () => {
    const championship = {
      id: "championship-1",
      division: "Régionale 2",
      startsAt: "2026-08-01T10:00:00.000Z",
      endsAt: "2026-10-31T10:00:00.000Z",
      standings: [],
      nextMeeting: null,
      meetings: []
    };

    expect(clubChampionshipVisualState(null)).toEqual({
      state: "absent",
      label: "Préparation"
    });
    expect(clubChampionshipVisualState({ ...championship, status: "SCHEDULED" })).toEqual({
      state: "scheduled",
      label: "Planifié"
    });
    expect(clubChampionshipVisualState({ ...championship, status: "ACTIVE" })).toEqual({
      state: "active",
      label: "Saison en cours"
    });
    expect(clubChampionshipVisualState({ ...championship, status: "COMPLETED" })).toEqual({
      state: "completed",
      label: "Terminé"
    });
  });

  it("distinguishes a missing, incomplete and complete five-player team", () => {
    const teamMember = (slotIndex: number) => ({
      id: `member-${slotIndex}`,
      slotIndex,
      player: { ...club.president, id: `player-${slotIndex}` }
    });

    expect(clubTeamReadiness({ team: null })).toEqual({
      state: "missing",
      filledSlots: 0,
      missingSlots: 5
    });
    expect(
      clubTeamReadiness({
        team: {
          id: "team-1",
          name: "Équipe 1",
          division: "Régionale 2",
          members: [teamMember(1), teamMember(2), teamMember(3)]
        }
      })
    ).toMatchObject({ state: "incomplete", filledSlots: 3, missingSlots: 2 });
    expect(
      clubTeamReadiness({
        team: {
          id: "team-1",
          name: "Équipe 1",
          division: "Régionale 2",
          members: [1, 2, 3, 4, 5].map(teamMember)
        }
      })
    ).toMatchObject({ state: "complete", filledSlots: 5, missingSlots: 0 });
  });

  it("protects the three club departure paths", () => {
    const presidentMembership = {
      id: "membership-president",
      role: "PRESIDENT",
      joinedAt: club.createdAt,
      player: club.president
    };
    const memberMembership = {
      ...presidentMembership,
      id: "membership-member",
      role: "MEMBRE",
      player: { ...club.president, id: "player-2", name: "Camille Durand" }
    };

    expect(clubDepartureMode({ ...club, isPresident: false }, club.president.id)).toBe("member");
    expect(
      clubDepartureMode(
        { ...club, members: [presidentMembership, memberMembership] },
        club.president.id
      )
    ).toBe("transfer");
    expect(
      clubDepartureMode({ ...club, members: [presidentMembership] }, club.president.id)
    ).toBe("resale");
  });
});
