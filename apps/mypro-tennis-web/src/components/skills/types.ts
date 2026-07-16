export type SkillState = {
  level: number;
  xp: number;
  skillPoints: number;
  spentSkillPoints: number;
  maxLevel: number;
  statCapPerSkill: number;
  allocations: Record<string, number>;
  milestoneLevels: number[];
  archetype: string;
  activeMatchBonuses: Record<string, number>;
  perks: Array<{
    level: number;
    title: string;
    description: string;
    bonuses: Record<string, number>;
    unlocked: boolean;
    active: boolean;
  }>;
  progress: {
    level: number;
    xp: number;
    currentFloor: number;
    nextFloor: number;
    xpIntoLevel: number;
    xpNeeded: number;
    remaining: number;
    maxLevel: number;
  };
};
