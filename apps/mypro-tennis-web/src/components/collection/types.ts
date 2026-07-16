export type CollectionTab = "equipment" | "cards" | "cosmetics" | "market";

export type ChestRarity = "Bronze" | "Argent" | "Or" | "Légendaire" | "Mythique";

export type PlayerCosmeticItem = {
  id: string;
  cosmeticId: string;
  name: string;
  rarity: ChestRarity;
  bonuses: Record<string, number>;
  upgradeLevel: number;
  nextUpgradeCost: number | null;
  canUpgrade: boolean;
  equippedSlot: number | null;
  ownedAt: string;
};

export type CollectionStatCard = {
  statKey: string;
  label: string;
  copies: number;
  level: number;
  earnedLevel: number;
  copiesIntoLevel: number;
  copiesNeeded: number;
  remaining: number;
  unlockable: boolean;
  unlockCost: number;
};

export type CollectionState = {
  slots: Array<{ slotIndex: number; chest: unknown | null }>;
  cards: CollectionStatCard[];
  cosmetics: PlayerCosmeticItem[];
  gems: number;
};

export type CosmeticMarketResult = {
  recipe: string;
  consumed: number;
  rarity: ChestRarity;
  resultRarity: ChestRarity | null;
  money: number;
  refund: number;
  totalMoney: number;
  cosmetic: PlayerCosmeticItem | null;
};

export type CosmeticMarketRecipe = {
  rarity: ChestRarity;
  required: number;
  resultRarity: ChestRarity | null;
  money: number;
  label: string;
};
