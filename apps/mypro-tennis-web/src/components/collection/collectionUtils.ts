import type {
  ChestRarity,
  CollectionStatCard,
  CosmeticMarketRecipe,
  PlayerCosmeticItem
} from "./types";

export const cosmeticMarketRecipes: CosmeticMarketRecipe[] = [
  { rarity: "Bronze", required: 3, resultRarity: "Argent", money: 0, label: "3 Bronze" },
  { rarity: "Argent", required: 6, resultRarity: "Or", money: 0, label: "6 Argent" },
  { rarity: "Or", required: 9, resultRarity: "Légendaire", money: 0, label: "9 Or" },
  {
    rarity: "Légendaire",
    required: 12,
    resultRarity: "Mythique",
    money: 0,
    label: "12 Légendaires"
  },
  { rarity: "Mythique", required: 1, resultRarity: null, money: 10_000, label: "1 Mythique" }
];

const rarityWeight: Record<ChestRarity, number> = {
  Mythique: 5,
  Légendaire: 4,
  Or: 3,
  Argent: 2,
  Bronze: 1
};

export function formatCredits(value: number) {
  return `${value.toLocaleString("fr-FR")} CR`;
}

export function rarityClass(rarity: ChestRarity) {
  return `rarity-${rarity
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")}`;
}

export function sortCosmeticsByRarity(items: PlayerCosmeticItem[]) {
  return [...items].sort((a, b) => {
    const rarityDelta = (rarityWeight[b.rarity] ?? 0) - (rarityWeight[a.rarity] ?? 0);
    if (rarityDelta !== 0) return rarityDelta;
    if (a.equippedSlot !== null && b.equippedSlot === null) return -1;
    if (a.equippedSlot === null && b.equippedSlot !== null) return 1;
    return a.name.localeCompare(b.name, "fr");
  });
}

export function bonusTotal(bonuses: Record<string, number>) {
  return Object.values(bonuses).reduce((sum, value) => sum + value, 0);
}

export function cardProgressPercent(
  card: Pick<CollectionStatCard, "copiesIntoLevel" | "copiesNeeded">
) {
  return Math.max(0, Math.min(100, (card.copiesIntoLevel / Math.max(1, card.copiesNeeded)) * 100));
}

export function cosmeticIconPath(name: string) {
  const normalized = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (normalized.includes("poignets")) return "/visuals/cosmetics/wristbands-emerald.jpg";
  if (normalized.includes("casquette")) return "/visuals/cosmetics/academy-cap.jpg";
  if (normalized.includes("surgrip")) return "/visuals/cosmetics/premium-overgrip.jpg";
  if (normalized.includes("sac")) return "/visuals/cosmetics/signature-bag.jpg";
  if (normalized.includes("t-shirt") || normalized.includes("maillot")) {
    return "/visuals/cosmetics/junior-shirt.jpg";
  }
  if (normalized.includes("bandeau")) return "/visuals/cosmetics/night-headband.jpg";
  return "/visuals/cosmetics/signature-bag.jpg";
}

const playerHeroIds = [
  "pp-01",
  "pp-02",
  "pp-03",
  "pp-04",
  "pp-05",
  "pp-06",
  "pp-07",
  "pp-08",
  "pp-09",
  "pp-10"
] as const;

function fallbackHeroId(seed: string) {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return playerHeroIds[(hash >>> 0) % playerHeroIds.length] ?? playerHeroIds[0];
}

export function playerHeroSource(avatar: string) {
  try {
    const parsed = JSON.parse(avatar) as {
      picture?: { kind?: string; id?: string };
    };
    const id = parsed.picture?.kind === "preset" ? parsed.picture.id : undefined;
    if (id && playerHeroIds.includes(id as (typeof playerHeroIds)[number])) {
      return `/visuals/players/${id}-hero.webp`;
    }
  } catch {
    // Legacy avatars are mapped deterministically to the same player set as the hub.
  }
  return `/visuals/players/${fallbackHeroId(avatar || "MP")}-hero.webp`;
}
