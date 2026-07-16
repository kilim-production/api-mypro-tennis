export type SkillUpgradeBlockReason =
  | "loading"
  | "busy"
  | "no-points"
  | "stat-max"
  | "skill-cap"
  | null;

export function skillProgressPercent(xpIntoLevel: number, xpNeeded: number) {
  if (xpNeeded <= 0) return 100;
  return Math.max(0, Math.min(100, (xpIntoLevel / xpNeeded) * 100));
}

export function skillUpgradeState(params: {
  dataReady: boolean;
  busy: boolean;
  skillPoints: number;
  value: number;
  allocation: number;
  cap: number;
}) {
  let reason: SkillUpgradeBlockReason = null;
  if (!params.dataReady) reason = "loading";
  else if (params.busy) reason = "busy";
  else if (params.value >= 100) reason = "stat-max";
  else if (params.allocation >= params.cap) reason = "skill-cap";
  else if (params.skillPoints <= 0) reason = "no-points";

  const labels: Record<Exclude<SkillUpgradeBlockReason, null>, string> = {
    loading: "CHARGEMENT...",
    busy: "AMÉLIORATION...",
    "no-points": "AUCUN POINT DISPONIBLE",
    "stat-max": "STATISTIQUE AU MAXIMUM",
    "skill-cap": `LIMITE ${params.cap}/${params.cap} ATTEINTE`
  };

  return {
    disabled: reason !== null,
    reason,
    label: reason ? labels[reason] : "AMÉLIORER · 1 POINT"
  };
}

export type CareerMilestoneState = "unlocked" | "next" | "locked";

export function careerMilestoneStates(level: number, milestones: readonly number[]) {
  const nextMilestone = milestones.find((milestone) => level < milestone) ?? null;
  return {
    nextMilestone,
    allUnlocked: nextMilestone === null,
    milestones: milestones.map((milestone) => ({
      milestone,
      state: (level >= milestone
        ? "unlocked"
        : milestone === nextMilestone
          ? "next"
          : "locked") as CareerMilestoneState
    }))
  };
}
