import type {
  ClubBuilding,
  ClubBuildingLevel,
  ClubDetails,
  ClubListItem,
  TeamChampionshipData,
  TeamChampionshipEntry
} from "./types";

export const fftPath = [
  "NC",
  "40/2",
  "40/1",
  "40",
  "30/5",
  "30/4",
  "30/3",
  "30/2",
  "30/1",
  "30",
  "15/5",
  "15/4",
  "15/3",
  "15/2",
  "15/1",
  "15",
  "5/6",
  "4/6",
  "3/6",
  "2/6",
  "1/6",
  "0",
  "-2/6",
  "-4/6",
  "-15"
] as const;

export function fftIndex(ranking: string) {
  const index = fftPath.indexOf(ranking as (typeof fftPath)[number]);
  return index < 0 ? 0 : index;
}

export function formatCredits(value: number) {
  return `${value.toLocaleString("fr-FR")} CR`;
}

export function clubDuesAmount(club: Pick<ClubListItem, "duesAmount"> | null | undefined) {
  return typeof club?.duesAmount === "number" ? club.duesAmount : 0;
}

const fallbackComplexLevels: ClubBuildingLevel[] = [
  { level: 1, name: "Club municipal", cost: 0, maxSlots: 5 },
  { level: 2, name: "Club intercommunal", cost: 10_000, maxSlots: 10 },
  { level: 3, name: "Club départemental", cost: 50_000, maxSlots: 20 },
  { level: 4, name: "Club régional", cost: 300_000, maxSlots: 35 },
  { level: 5, name: "Club de référence nationale", cost: 2_000_000, maxSlots: 50 }
];

const fallbackCareCenterLevels: ClubBuildingLevel[] = [
  { level: 0, name: "Aucun centre de soins", cost: 0, recoveryReductionPercent: 0 },
  { level: 1, name: "Infirmerie de club", cost: 8_000, recoveryReductionPercent: 3 },
  { level: 2, name: "Cabinet de kinésithérapie", cost: 25_000, recoveryReductionPercent: 6 },
  { level: 3, name: "Pôle récupération sportive", cost: 90_000, recoveryReductionPercent: 9 },
  { level: 4, name: "Centre médico-performance", cost: 300_000, recoveryReductionPercent: 12 },
  {
    level: 5,
    name: "Institut santé haute performance",
    cost: 1_000_000,
    recoveryReductionPercent: 15
  }
];

const fallbackTrainingCenterLevels: ClubBuildingLevel[] = [
  { level: 0, name: "Aucun centre d'entraînement", cost: 0, rareChestBonusPercent: 0 },
  { level: 1, name: "Court d'entraînement encadré", cost: 12_000, rareChestBonusPercent: 1 },
  { level: 2, name: "Atelier technique vidéo", cost: 45_000, rareChestBonusPercent: 2 },
  { level: 3, name: "Académie de progression", cost: 160_000, rareChestBonusPercent: 4 },
  { level: 4, name: "Centre haute intensité", cost: 550_000, rareChestBonusPercent: 6 },
  { level: 5, name: "Académie élite MyPro", cost: 1_800_000, rareChestBonusPercent: 8 }
];

function complexBuildingForClub(club: ClubDetails): ClubBuilding {
  if (club.buildings?.complex) return club.buildings.complex;
  const level = Math.min(Math.max(club.complexLevel || 1, 1), fallbackComplexLevels.length);
  const currentLevel = fallbackComplexLevels.find((definition) => definition.level === level)!;
  return {
    id: "complex",
    name: "Le complexe",
    currentLevel,
    nextLevel:
      fallbackComplexLevels.find((definition) => definition.level === currentLevel.level + 1) ??
      null,
    maxLevel: fallbackComplexLevels.length,
    levels: fallbackComplexLevels
  };
}

function fallbackSpecializedBuilding(
  id: "careCenter" | "trainingCenter",
  name: string,
  level: number,
  levels: ClubBuildingLevel[]
): ClubBuilding {
  const currentLevel =
    levels.find((definition) => definition.level === Math.max(0, Math.min(5, level))) ?? levels[0]!;
  return {
    id,
    name,
    currentLevel,
    nextLevel: levels.find((definition) => definition.level === currentLevel.level + 1) ?? null,
    maxLevel: levels.length - 1,
    levels
  };
}

export function clubBuildingForClub(
  club: ClubDetails,
  id: "complex" | "careCenter" | "trainingCenter"
) {
  if (id === "complex") return complexBuildingForClub(club);
  if (id === "careCenter") {
    return (
      club.buildings?.careCenter ??
      fallbackSpecializedBuilding(
        "careCenter",
        "Centre de soins",
        club.careCenterLevel ?? 0,
        fallbackCareCenterLevels
      )
    );
  }
  return (
    club.buildings?.trainingCenter ??
    fallbackSpecializedBuilding(
      "trainingCenter",
      "Centre d'entraînement",
      club.trainingCenterLevel ?? 0,
      fallbackTrainingCenterLevels
    )
  );
}

export function buildingLevelImage(buildingId: string, level: number) {
  if (buildingId === "complex") return `/visuals/club/complex-level-${Math.max(1, level)}.jpg`;
  if (buildingId === "careCenter" && level > 0)
    return `/visuals/club/care-center-level-${level}.jpg`;
  if (buildingId === "trainingCenter" && level > 0)
    return `/visuals/club/training-center-level-${level}.jpg`;
  return "";
}

export function buildingEffectLabel(building: ClubBuilding, level = building.currentLevel) {
  if (building.id === "complex") return `${level.maxSlots ?? 0} joueurs`;
  if (building.id === "careCenter") {
    return level.recoveryReductionPercent
      ? `-${level.recoveryReductionPercent}% délai énergie`
      : "Récupération standard";
  }
  return level.rareChestBonusPercent
    ? `+${level.rareChestBonusPercent}% coffres non-Bronze`
    : "Tirage standard";
}

export function buildingUpgradePath(buildingId: string) {
  if (buildingId === "careCenter") return "/clubs/me/buildings/care-center/upgrade";
  if (buildingId === "trainingCenter") return "/clubs/me/buildings/training-center/upgrade";
  return "/clubs/me/buildings/complex/upgrade";
}

export function clubBuildingUpgradeEligibility(
  club: Pick<ClubDetails, "isPresident" | "budget">,
  building: ClubBuilding
) {
  const nextLevel = building.nextLevel;
  const canManage = club.isPresident;
  const canAfford = Boolean(nextLevel && club.budget >= nextLevel.cost);
  return {
    nextLevel,
    canManage,
    canAfford,
    canUpgrade: Boolean(canManage && canAfford),
    shortfall: nextLevel ? Math.max(0, nextLevel.cost - club.budget) : 0
  };
}

export function clubCanAcceptRequest(club: Pick<ClubDetails, "openSlots">) {
  return club.openSlots > 0;
}

export type ClubJoinState = "available" | "busy" | "full" | "pending" | "ranking";

export function clubJoinAvailability({
  club,
  playerRanking,
  hasPendingRequest,
  busy
}: {
  club: Pick<ClubListItem, "minimumRanking" | "myRequestStatus" | "openSlots">;
  playerRanking: string;
  hasPendingRequest: boolean;
  busy: boolean;
}): { state: ClubJoinState; disabled: boolean; label: string; reason: string } {
  if (busy) {
    return { state: "busy", disabled: true, label: "Envoi…", reason: "Demande en cours d’envoi." };
  }
  if (club.myRequestStatus === "PENDING" || hasPendingRequest) {
    return {
      state: "pending",
      disabled: true,
      label: club.myRequestStatus === "PENDING" ? "Demande envoyée" : "Demande déjà active",
      reason: "Une seule demande d’adhésion peut être active à la fois."
    };
  }
  if (club.openSlots <= 0) {
    return {
      state: "full",
      disabled: true,
      label: "Club complet",
      reason: "Aucune place n’est disponible actuellement."
    };
  }
  if (fftIndex(playerRanking) < fftIndex(club.minimumRanking)) {
    return {
      state: "ranking",
      disabled: true,
      label: `Requis ${club.minimumRanking}`,
      reason: `Votre classement doit atteindre ${club.minimumRanking}.`
    };
  }
  return {
    state: "available",
    disabled: false,
    label: "Demander à rejoindre",
    reason: "Votre profil remplit les conditions de ce club."
  };
}

export function fallbackDuesState(
  club: ClubDetails,
  data?: Pick<TeamChampionshipData, "dues" | "club" | "championship"> | null
) {
  const amount = data?.dues?.amount ?? clubDuesAmount(data?.club ?? club);
  return (
    data?.dues ?? {
      amount,
      championshipId: data?.championship?.id ?? null,
      windowOpensAt: null,
      windowClosesAt: null,
      isWindowOpen: false,
      currentPlayerPaid: amount === 0,
      currentPlayerCanPay: false,
      paidCount: amount === 0 ? club.memberCount : 0,
      eligibleCount: amount === 0 ? club.memberCount : 0,
      paidPlayerIds: []
    }
  );
}

export type ClubDuesVisualState = "free" | "paid" | "due" | "closed";

export function clubDuesVisualState(
  dues: ReturnType<typeof fallbackDuesState>
): { state: ClubDuesVisualState; label: string } {
  if (dues.amount <= 0) return { state: "free", label: "Accès libre" };
  if (dues.currentPlayerPaid) return { state: "paid", label: "Payée · À jour" };
  if (dues.isWindowOpen) return { state: "due", label: "À payer" };
  return { state: "closed", label: "Fenêtre fermée" };
}

export function championshipPreviewStandings(
  standings: TeamChampionshipEntry[],
  limit = 5
) {
  const ranked = [...standings].sort(
    (left, right) => (left.rank ?? Number.MAX_SAFE_INTEGER) - (right.rank ?? Number.MAX_SAFE_INTEGER)
  );
  const top = ranked.slice(0, Math.max(0, limit));
  const playerStanding = ranked.find((entry) => entry.isPlayerClub) ?? null;
  const playerOutsideTop =
    playerStanding && !top.some((entry) => entry.id === playerStanding.id)
      ? playerStanding
      : null;

  return { top, playerOutsideTop };
}

export type ClubChampionshipVisualState = "absent" | "scheduled" | "active" | "completed";

export function clubChampionshipVisualState(
  championship: TeamChampionshipData["championship"] | null | undefined
): { state: ClubChampionshipVisualState; label: string } {
  if (!championship) return { state: "absent", label: "Préparation" };
  if (championship.status === "COMPLETED") return { state: "completed", label: "Terminé" };
  if (championship.status === "SCHEDULED") return { state: "scheduled", label: "Planifié" };
  return { state: "active", label: "Saison en cours" };
}

export type ClubTeamReadiness = "missing" | "incomplete" | "complete";

export function clubTeamReadiness(
  data: Pick<TeamChampionshipData, "team">
): { state: ClubTeamReadiness; filledSlots: number; missingSlots: number } {
  const filledSlots = new Set(
    (data.team?.members ?? [])
      .map((member) => member.slotIndex)
      .filter((slotIndex) => slotIndex >= 1 && slotIndex <= 5)
  ).size;
  if (!data.team) return { state: "missing", filledSlots: 0, missingSlots: 5 };
  if (filledSlots < 5) {
    return { state: "incomplete", filledSlots, missingSlots: 5 - filledSlots };
  }
  return { state: "complete", filledSlots, missingSlots: 0 };
}

export type ClubDepartureMode = "member" | "transfer" | "resale";

export function clubDepartureMode(
  club: Pick<ClubDetails, "isPresident" | "members">,
  currentPlayerId: string
): ClubDepartureMode {
  if (!club.isPresident) return "member";
  return club.members.some((member) => member.player.id !== currentPlayerId)
    ? "transfer"
    : "resale";
}
