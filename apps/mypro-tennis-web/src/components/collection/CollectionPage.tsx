import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  Coins,
  Crosshair,
  Dumbbell,
  Gauge,
  Gem,
  Hand,
  HeartPulse,
  HelpCircle,
  Info,
  Layers3,
  MoveDown,
  MoveUpRight,
  PackageOpen,
  RefreshCw,
  Repeat2,
  Settings,
  Shield,
  SlidersHorizontal,
  Sparkles,
  Target,
  Trash2,
  Wind,
  X,
  Zap
} from "lucide-react";
import { api } from "../../api";
import { useGameStore } from "../../store";
import {
  bonusTotal,
  cardProgressPercent,
  cosmeticIconPath,
  cosmeticMarketRecipes,
  formatCredits,
  playerHeroSource,
  rarityClass,
  sortCosmeticsByRarity
} from "./collectionUtils";
import type {
  ChestRarity,
  CollectionState,
  CollectionStatCard,
  CollectionTab,
  CosmeticMarketRecipe,
  CosmeticMarketResult,
  PlayerCosmeticItem
} from "./types";
import "./collection.css";

const statLabels: Record<string, string> = {
  service: "Service",
  return: "Retour",
  forehand: "Coup droit",
  backhand: "Revers",
  volley: "Volée",
  smash: "Smash",
  dropShot: "Amortie",
  stamina: "Endurance",
  speed: "Vitesse",
  explosiveness: "Explosivité",
  strength: "Force",
  recovery: "Récupération"
};

const statIcons: Record<string, LucideIcon> = {
  service: Target,
  return: Repeat2,
  forehand: Crosshair,
  backhand: MoveUpRight,
  volley: Hand,
  smash: Zap,
  dropShot: MoveDown,
  stamina: HeartPulse,
  speed: Wind,
  explosiveness: Zap,
  strength: Dumbbell,
  recovery: Gauge
};

const tabs: Array<{
  value: CollectionTab;
  label: string;
  Icon: LucideIcon;
}> = [
  { value: "equipment", label: "Équipement", Icon: Target },
  { value: "cards", label: "Cartes", Icon: Layers3 },
  { value: "cosmetics", label: "Objets", Icon: PackageOpen },
  { value: "market", label: "Marché", Icon: Repeat2 }
];

type MessageState = { text: string; tone: "success" | "error" } | null;

function StatGlyph({ statKey, size = 18 }: { statKey: string; size?: number }) {
  const Icon = statIcons[statKey] ?? Target;
  return <Icon aria-hidden="true" size={size} />;
}

function BonusPills({ bonuses, limit }: { bonuses: Record<string, number>; limit?: number }) {
  const entries = Object.entries(bonuses)
    .filter(([, value]) => value > 0)
    .slice(0, limit);
  if (!entries.length) return <span className="collection-muted">Bonus à révéler</span>;
  return (
    <div className="collection-bonus-pills">
      {entries.map(([key, value]) => (
        <span key={key}>
          <StatGlyph statKey={key} size={14} />
          <b>+{value}</b> {statLabels[key] ?? key}
        </span>
      ))}
    </div>
  );
}

function ItemVisual({ item }: { item: Pick<PlayerCosmeticItem, "name" | "rarity"> }) {
  return (
    <div className={`collection-item-visual ${rarityClass(item.rarity)}`}>
      <img
        alt={item.name}
        decoding="async"
        draggable={false}
        loading="lazy"
        src={cosmeticIconPath(item.name)}
      />
    </div>
  );
}

function CollectionHeader({
  gems,
  credits,
  onBack,
  onCoachDeck,
  onHelp,
  onSettings
}: {
  gems: number;
  credits: number;
  onBack: () => void;
  onCoachDeck: () => void;
  onHelp: () => void;
  onSettings: () => void;
}) {
  return (
    <header className="collection-header">
      <button className="collection-icon-button collection-back" onClick={onBack} type="button">
        <ArrowLeft size={24} />
        <span className="sr-only">Retour</span>
      </button>
      <div className="collection-brand" aria-label="MyPro Tennis">
        <strong>MYPRO</strong>
        <span>TENNIS</span>
      </div>
      <h1>COLLECTION</h1>
      <div className="collection-header-actions">
        <div className="collection-resource collection-resource-gems">
          <Gem size={19} />
          <span>
            <small>Gemmes</small>
            <strong>{gems.toLocaleString("fr-FR")}</strong>
          </span>
          <b>+</b>
        </div>
        <div className="collection-resource collection-resource-credits">
          <Coins size={19} />
          <span>
            <small>Crédits</small>
            <strong>{credits.toLocaleString("fr-FR")}</strong>
          </span>
          <b>+</b>
        </div>
        <button className="collection-coach-button" onClick={onCoachDeck} type="button">
          <Sparkles size={18} />
          <span>Coach Deck</span>
        </button>
        <button
          className="collection-icon-button collection-header-help"
          onClick={onHelp}
          type="button"
        >
          <HelpCircle size={19} />
          <span className="sr-only">Aide</span>
        </button>
        <button className="collection-icon-button" onClick={onSettings} type="button">
          <Settings size={19} />
          <span className="sr-only">Réglages</span>
        </button>
        <button className="collection-icon-button collection-close" onClick={onBack} type="button">
          <X size={22} />
          <span className="sr-only">Fermer</span>
        </button>
      </div>
    </header>
  );
}

function CollectionTabs({
  active,
  onChange,
  equipmentBonus,
  unlockableCards,
  objectCount,
  marketReady
}: {
  active: CollectionTab;
  onChange: (tab: CollectionTab) => void;
  equipmentBonus: number;
  unlockableCards: number;
  objectCount: number;
  marketReady: number;
}) {
  const meta: Record<CollectionTab, string> = {
    equipment: equipmentBonus ? `+${equipmentBonus} stats` : "4 slots",
    cards: "12 stats",
    cosmetics: `${objectCount} objet${objectCount > 1 ? "s" : ""}`,
    market: marketReady ? `${marketReady} prêt${marketReady > 1 ? "s" : ""}` : "occasion"
  };
  const badges: Partial<Record<CollectionTab, number>> = {
    cards: unlockableCards,
    market: marketReady
  };
  return (
    <nav className="collection-tabs" aria-label="Sections de la collection">
      {tabs.map(({ value, label, Icon }) => (
        <button
          key={value}
          className={active === value ? "is-active" : ""}
          aria-current={active === value ? "page" : undefined}
          onClick={() => onChange(value)}
          type="button"
        >
          <Icon size={25} />
          <span>
            <strong>{label}</strong>
            <small>{meta[value]}</small>
          </span>
          {badges[value] ? (
            <b className={`collection-tab-badge badge-${value}`}>{badges[value]}</b>
          ) : null}
        </button>
      ))}
    </nav>
  );
}

function EquipmentPanel({
  cosmetics,
  selectedItemId,
  onSelectItem,
  onChooseSlot,
  onUnequip,
  busyItem
}: {
  cosmetics: PlayerCosmeticItem[];
  selectedItemId: string | null;
  onSelectItem: (id: string) => void;
  onChooseSlot: (slot: number) => void;
  onUnequip: (item: PlayerCosmeticItem) => void;
  busyItem: string | null;
}) {
  const player = useGameStore((state) => state.player);
  const equipped = Array.from({ length: 4 }, (_, slotIndex) => ({
    slotIndex,
    item: cosmetics.find((item) => item.equippedSlot === slotIndex) ?? null
  }));
  const activeBonuses = equipped.reduce<Record<string, number>>((totals, slot) => {
    for (const [key, value] of Object.entries(slot.item?.bonuses ?? {})) {
      totals[key] = (totals[key] ?? 0) + value;
    }
    return totals;
  }, {});
  const total = Object.values(activeBonuses).reduce((sum, value) => sum + value, 0);
  const selectedEquipped = cosmetics.find(
    (item) => item.id === selectedItemId && item.equippedSlot !== null
  );
  const firstEmptySlot = equipped.find((slot) => !slot.item)?.slotIndex ?? 0;

  return (
    <section className="collection-panel collection-equipment-panel">
      <div className="collection-panel-heading">
        <h2>MON ÉQUIPEMENT</h2>
        <span className="collection-active-bonus">
          <small>Bonus actifs</small>
          <strong>+{total}</strong>
        </span>
      </div>
      <div className="collection-player-loadout">
        <div className="collection-player-glow" />
        {player ? (
          <img
            className="collection-player-hero"
            alt={player.name}
            decoding="async"
            draggable={false}
            src={playerHeroSource(player.avatar)}
          />
        ) : null}
        {equipped.map(({ slotIndex, item }) => (
          <button
            key={slotIndex}
            className={`collection-equipment-slot slot-${slotIndex + 1} ${
              item?.id === selectedItemId ? "is-selected" : ""
            } ${item ? rarityClass(item.rarity) : "is-empty"}`}
            onClick={() => (item ? onSelectItem(item.id) : onChooseSlot(slotIndex))}
            type="button"
          >
            <b>{slotIndex + 1}</b>
            {item ? (
              <>
                <img alt="" decoding="async" draggable={false} src={cosmeticIconPath(item.name)} />
                <span>NIV. {item.upgradeLevel}/3</span>
              </>
            ) : (
              <>
                <PackageOpen size={24} />
                <span>VIDE</span>
              </>
            )}
          </button>
        ))}
      </div>
      <BonusPills bonuses={activeBonuses} limit={3} />
      <div className="collection-equipment-actions">
        <button
          className="collection-danger-button"
          disabled={!selectedEquipped || busyItem === selectedEquipped.id}
          onClick={() => selectedEquipped && onUnequip(selectedEquipped)}
          type="button"
        >
          <Trash2 size={17} /> Retirer
        </button>
        <button
          className="collection-outline-button"
          onClick={() => onChooseSlot(firstEmptySlot)}
          type="button"
        >
          <PackageOpen size={17} /> Choisir un objet
        </button>
      </div>
    </section>
  );
}

function InventoryCard({
  item,
  selected,
  busyItem,
  busyUpgrade,
  onSelect,
  onEquip,
  onUpgrade
}: {
  item: PlayerCosmeticItem;
  selected: boolean;
  busyItem: string | null;
  busyUpgrade: string | null;
  onSelect: () => void;
  onEquip: (slot: number) => void;
  onUpgrade: () => void;
}) {
  return (
    <article
      className={`collection-inventory-card ${rarityClass(item.rarity)} ${selected ? "is-selected" : ""}`}
      onClick={onSelect}
    >
      <div className="collection-card-topline">
        <span>{item.rarity}</span>
        {selected ? (
          <Check size={16} />
        ) : item.equippedSlot !== null ? (
          <b>Slot {item.equippedSlot + 1}</b>
        ) : null}
      </div>
      <ItemVisual item={item} />
      <h3>{item.name}</h3>
      <BonusPills bonuses={item.bonuses} limit={1} />
      <div className="collection-upgrade-line">
        <span>NIV. {item.upgradeLevel}/3</span>
        <i>
          <b style={{ width: `${(item.upgradeLevel / 3) * 100}%` }} />
        </i>
      </div>
      {selected ? (
        <div className="collection-selected-actions">
          <div className="collection-slot-buttons" aria-label={`Choisir un slot pour ${item.name}`}>
            {[0, 1, 2, 3].map((slot) => (
              <button
                key={slot}
                className={item.equippedSlot === slot ? "is-active" : ""}
                disabled={busyItem === item.id || item.equippedSlot === slot}
                onClick={(event) => {
                  event.stopPropagation();
                  onEquip(slot);
                }}
                type="button"
              >
                {slot + 1}
              </button>
            ))}
          </div>
          {item.canUpgrade && item.nextUpgradeCost ? (
            <button
              className="collection-card-action is-upgrade"
              disabled={busyUpgrade === item.id}
              onClick={(event) => {
                event.stopPropagation();
                onUpgrade();
              }}
              type="button"
            >
              {busyUpgrade === item.id
                ? "Amélioration..."
                : `Améliorer ${formatCredits(item.nextUpgradeCost)}`}
            </button>
          ) : null}
        </div>
      ) : item.canUpgrade && item.nextUpgradeCost ? (
        <button
          className="collection-card-action is-upgrade"
          disabled={busyUpgrade === item.id}
          onClick={(event) => {
            event.stopPropagation();
            onUpgrade();
          }}
          type="button"
        >
          {busyUpgrade === item.id
            ? "Amélioration..."
            : `Améliorer ${formatCredits(item.nextUpgradeCost)}`}
        </button>
      ) : (
        <button className="collection-card-action" onClick={onSelect} type="button">
          {item.equippedSlot !== null ? "Équipé" : "Équiper"}
        </button>
      )}
    </article>
  );
}

function InventoryPanel({
  cosmetics,
  selectedItemId,
  busyItem,
  busyUpgrade,
  onSelect,
  onEquip,
  onUpgrade
}: {
  cosmetics: PlayerCosmeticItem[];
  selectedItemId: string | null;
  busyItem: string | null;
  busyUpgrade: string | null;
  onSelect: (id: string) => void;
  onEquip: (item: PlayerCosmeticItem, slot: number) => void;
  onUpgrade: (item: PlayerCosmeticItem) => void;
}) {
  const placeholderCount = Math.max(0, 6 - cosmetics.length);
  return (
    <section className="collection-panel collection-inventory-panel">
      <div className="collection-panel-heading">
        <h2>INVENTAIRE</h2>
        <div className="collection-sort">
          <span>Tri : rareté</span>
          <SlidersHorizontal size={16} />
        </div>
      </div>
      <div className="collection-inventory-grid">
        {cosmetics.map((item) => (
          <InventoryCard
            key={item.id}
            item={item}
            selected={item.id === selectedItemId}
            busyItem={busyItem}
            busyUpgrade={busyUpgrade}
            onSelect={() => onSelect(item.id)}
            onEquip={(slot) => onEquip(item, slot)}
            onUpgrade={() => onUpgrade(item)}
          />
        ))}
        {Array.from({ length: placeholderCount }, (_, index) => (
          <div className="collection-inventory-placeholder" key={`placeholder-${index}`}>
            <PackageOpen size={28} />
            <strong>OBJET À DÉCOUVRIR</strong>
            <span>Ouvrez un sac</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function StatCardTile({
  card,
  busy,
  onUnlock
}: {
  card: CollectionStatCard;
  busy: boolean;
  onUnlock: () => void;
}) {
  const progress = cardProgressPercent(card);
  return (
    <article className={`collection-stat-card ${card.unlockable ? "is-ready" : ""}`}>
      <div className="collection-stat-card-heading">
        <h3>{card.label}</h3>
        {card.unlockable ? <span>Palier prêt</span> : null}
      </div>
      <div className="collection-stat-value">
        <StatGlyph statKey={card.statKey} size={25} />
        <strong>+{card.level}</strong>
      </div>
      <div className="collection-card-levels">
        <span>
          Bonus permanent <b>+{card.level}</b>
        </span>
        <span>
          Palier obtenu <b>+{card.earnedLevel}</b>
        </span>
      </div>
      <div className="collection-card-progress-copy">
        <span>
          Progression {card.copiesIntoLevel}/{card.copiesNeeded}
        </span>
        <small>
          {card.copies} doublon{card.copies > 1 ? "s" : ""} collecté
          {card.copies > 1 ? "s" : ""}
        </small>
      </div>
      <div className="collection-progress">
        <b style={{ width: `${progress}%` }} />
      </div>
      {card.unlockable ? (
        <button disabled={busy} onClick={onUnlock} type="button">
          {busy ? "Déblocage..." : `Débloquer +1 · ${formatCredits(card.unlockCost)}`}
        </button>
      ) : (
        <small className="collection-card-remaining">
          {card.remaining} avant le prochain palier
        </small>
      )}
    </article>
  );
}

function StatsPanel({
  cards,
  expanded,
  busyCard,
  onUnlock,
  onExpand
}: {
  cards: CollectionStatCard[];
  expanded: boolean;
  busyCard: string | null;
  onUnlock: (card: CollectionStatCard) => void;
  onExpand: () => void;
}) {
  const visibleCards = expanded
    ? cards
    : [...cards].sort((a, b) => Number(b.unlockable) - Number(a.unlockable)).slice(0, 3);
  return (
    <section className={`collection-panel collection-stats-panel ${expanded ? "is-expanded" : ""}`}>
      <div className="collection-panel-heading">
        <div>
          <h2>CARTES DE STATS</h2>
          <small>Progression permanente</small>
        </div>
        <Sparkles size={18} />
      </div>
      <div className="collection-stat-grid">
        {visibleCards.map((card) => (
          <StatCardTile
            key={card.statKey}
            card={card}
            busy={busyCard === card.statKey}
            onUnlock={() => onUnlock(card)}
          />
        ))}
      </div>
      {!expanded ? (
        <button className="collection-panel-link" onClick={onExpand} type="button">
          Voir les 12 cartes <ChevronRight size={17} />
        </button>
      ) : null}
    </section>
  );
}

function MarketRecipeCard({
  recipe,
  owned,
  busy,
  compact,
  onExchange
}: {
  recipe: CosmeticMarketRecipe;
  owned: number;
  busy: boolean;
  compact: boolean;
  onExchange: () => void;
}) {
  const canExchange = owned >= recipe.required;
  const progress = Math.min(100, (owned / Math.max(1, recipe.required)) * 100);
  const visibleTokens = compact ? Math.min(recipe.required, 3) : 1;
  return (
    <article
      className={`collection-market-recipe ${rarityClass(recipe.rarity)} ${compact ? "is-compact" : ""}`}
    >
      <div className="collection-market-showcase">
        <div className="collection-market-side is-source">
          <strong>{recipe.label}</strong>
          <div className="collection-market-token-row" aria-hidden="true">
            {Array.from({ length: visibleTokens }, (_, index) => (
              <RarityToken key={`${recipe.rarity}-${index}`} rarity={recipe.rarity} />
            ))}
            {recipe.required > visibleTokens ? (
              <b className="collection-market-token-count">×{recipe.required}</b>
            ) : null}
          </div>
        </div>
        <ArrowRight className="collection-market-arrow" size={30} aria-hidden="true" />
        <div className="collection-market-side is-result">
          <strong>
            {recipe.resultRarity ? `1 ${recipe.resultRarity}` : formatCredits(recipe.money)}
          </strong>
          {recipe.resultRarity ? (
            <RarityToken rarity={recipe.resultRarity} />
          ) : (
            <span className="collection-credit-token" aria-hidden="true">
              <Coins size={22} />
              <b>CR</b>
            </span>
          )}
        </div>
      </div>
      <div className={`collection-market-progress-line ${canExchange ? "is-ready" : ""}`}>
        <b>{owned}/{recipe.required}</b>
        <div className="collection-progress">
          <b style={{ width: `${progress}%` }} />
        </div>
        <span
          className="collection-market-ready"
          aria-label={canExchange ? "Recette prête" : "Recette incomplète"}
        >
          <Check size={18} />
        </span>
      </div>
      <button disabled={!canExchange || busy} onClick={onExchange} type="button">
        {busy ? "Échange..." : canExchange ? "Échanger" : "Objets insuffisants"}
      </button>
    </article>
  );
}

function RarityToken({ rarity, small = false }: { rarity: ChestRarity; small?: boolean }) {
  return (
    <span
      className={`collection-rarity-token ${rarityClass(rarity)} ${small ? "is-small" : ""}`}
      title={rarity}
    >
      <RefreshCw size={small ? 15 : 22} />
    </span>
  );
}

function MarketPanel({
  counts,
  expanded,
  busyMarket,
  onExchange,
  onExpand
}: {
  counts: Record<ChestRarity, number>;
  expanded: boolean;
  busyMarket: ChestRarity | null;
  onExchange: (rarity: ChestRarity) => void;
  onExpand: () => void;
}) {
  const primaryRecipe =
    cosmeticMarketRecipes.find((recipe) => counts[recipe.rarity] >= recipe.required) ??
    cosmeticMarketRecipes[0];
  if (!primaryRecipe) return null;
  return (
    <section
      className={`collection-panel collection-market-panel ${expanded ? "is-expanded" : ""}`}
    >
      <div className="collection-panel-heading">
        <div>
          <h2>MARCHÉ DE L'OCCASION</h2>
          <small>Recyclez vos objets pour monter en rareté</small>
        </div>
        <Info size={18} />
      </div>
      {expanded ? (
        <p className="collection-market-policy">
          <Shield size={14} /> Les objets non équipés sont utilisés en priorité lors de l'échange.
        </p>
      ) : null}
      {expanded ? (
        <div className="collection-market-grid">
          {cosmeticMarketRecipes.map((recipe) => (
            <MarketRecipeCard
              key={recipe.rarity}
              recipe={recipe}
              owned={counts[recipe.rarity]}
              busy={busyMarket === recipe.rarity}
              compact={false}
              onExchange={() => onExchange(recipe.rarity)}
            />
          ))}
        </div>
      ) : (
        <>
          <MarketRecipeCard
            recipe={primaryRecipe}
            owned={counts[primaryRecipe.rarity]}
            busy={busyMarket === primaryRecipe.rarity}
            compact
            onExchange={() => onExchange(primaryRecipe.rarity)}
          />
          <p className="collection-refund-note">
            <Shield size={14} /> 30 % des améliorations remboursées
          </p>
          <div className="collection-recipe-strip">
            {cosmeticMarketRecipes
              .filter((recipe) => recipe.rarity !== primaryRecipe.rarity)
              .map((recipe) => (
                <button
                  key={recipe.rarity}
                  className={rarityClass(recipe.rarity)}
                  onClick={onExpand}
                  type="button"
                >
                  <strong>{recipe.label}</strong>
                  <span className="collection-mini-recipe">
                    <RarityToken rarity={recipe.rarity} small />
                    <ArrowRight size={14} />
                    {recipe.resultRarity ? (
                      <RarityToken rarity={recipe.resultRarity} small />
                    ) : (
                      <span className="collection-mini-credits"><Coins size={14} /></span>
                    )}
                  </span>
                  <b>{recipe.resultRarity ? `1 ${recipe.resultRarity}` : "= 10 000 CR"}</b>
                </button>
              ))}
          </div>
        </>
      )}
      {expanded ? (
        <p className="collection-refund-note">
          <Shield size={14} /> 30 % des améliorations remboursées
        </p>
      ) : null}
    </section>
  );
}

function SlotPicker({
  slot,
  cosmetics,
  busyItem,
  onClose,
  onEquip
}: {
  slot: number;
  cosmetics: PlayerCosmeticItem[];
  busyItem: string | null;
  onClose: () => void;
  onEquip: (item: PlayerCosmeticItem, slot: number) => void;
}) {
  return createPortal(
    <div className="collection-modal-overlay" onClick={onClose}>
      <section
        aria-labelledby="collection-slot-picker-title"
        aria-modal="true"
        className="collection-slot-picker"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className="collection-panel-heading">
          <div>
            <small>Équipement</small>
            <h2 id="collection-slot-picker-title">CHOISIR UN OBJET · SLOT {slot + 1}</h2>
          </div>
          <button className="collection-icon-button" onClick={onClose} type="button">
            <X size={18} />
          </button>
        </div>
        <div className="collection-picker-grid">
          {cosmetics.length ? (
            cosmetics.map((item) => (
              <button
                key={item.id}
                className={`${rarityClass(item.rarity)} ${item.equippedSlot === slot ? "is-active" : ""}`}
                disabled={busyItem === item.id || item.equippedSlot === slot}
                onClick={() => onEquip(item, slot)}
                type="button"
              >
                <ItemVisual item={item} />
                <span>
                  <small>{item.rarity}</small>
                  <strong>{item.name}</strong>
                  <BonusPills bonuses={item.bonuses} limit={1} />
                </span>
                {item.equippedSlot !== null ? (
                  <b>Slot {item.equippedSlot + 1}</b>
                ) : (
                  <ChevronRight size={18} />
                )}
              </button>
            ))
          ) : (
            <div className="collection-picker-empty">
              <PackageOpen size={34} />
              <strong>AUCUN OBJET DISPONIBLE</strong>
              <span>Ouvrez des sacs depuis le hub pour compléter votre collection.</span>
              <button onClick={onClose} type="button">
                Fermer
              </button>
            </div>
          )}
        </div>
      </section>
    </div>,
    document.body
  );
}

export function CollectionPage() {
  const navigate = useNavigate();
  const player = useGameStore((state) => state.player);
  const refreshPlayer = useGameStore((state) => state.refresh);
  const [data, setData] = useState<CollectionState | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [tab, setTab] = useState<CollectionTab>("equipment");
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [slotPicker, setSlotPicker] = useState<number | null>(null);
  const [busyItem, setBusyItem] = useState<string | null>(null);
  const [busyUpgrade, setBusyUpgrade] = useState<string | null>(null);
  const [busyCard, setBusyCard] = useState<string | null>(null);
  const [busyMarket, setBusyMarket] = useState<ChestRarity | null>(null);
  const [message, setMessage] = useState<MessageState>(null);

  async function loadCollection() {
    setLoadError("");
    try {
      const nextData = await api<CollectionState>("/chests");
      setData(nextData);
      setSelectedItemId((current) => current ?? nextData.cosmetics[0]?.id ?? null);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Collection indisponible.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadCollection();
  }, []);

  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(null), 4200);
    return () => window.clearTimeout(timer);
  }, [message]);

  const sortedCosmetics = useMemo(
    () => sortCosmeticsByRarity(data?.cosmetics ?? []),
    [data?.cosmetics]
  );
  const marketCounts = useMemo(
    () =>
      cosmeticMarketRecipes.reduce<Record<ChestRarity, number>>(
        (counts, recipe) => ({
          ...counts,
          [recipe.rarity]: sortedCosmetics.filter((item) => item.rarity === recipe.rarity).length
        }),
        { Bronze: 0, Argent: 0, Or: 0, Légendaire: 0, Mythique: 0 }
      ),
    [sortedCosmetics]
  );
  const marketReady = cosmeticMarketRecipes.filter(
    (recipe) => marketCounts[recipe.rarity] >= recipe.required
  ).length;
  const totalEquipmentBonus = sortedCosmetics
    .filter((item) => item.equippedSlot !== null)
    .reduce((sum, item) => sum + bonusTotal(item.bonuses), 0);
  const unlockableCards = (data?.cards ?? []).filter((card) => card.unlockable).length;

  async function equip(item: PlayerCosmeticItem, slot: number) {
    setBusyItem(item.id);
    try {
      await api(`/cosmetics/${item.id}/equip`, {
        method: "POST",
        body: JSON.stringify({ slotIndex: slot })
      });
      await loadCollection();
      await refreshPlayer();
      setSelectedItemId(item.id);
      setSlotPicker(null);
      setMessage({ text: `${item.name} équipé dans le slot ${slot + 1}.`, tone: "success" });
    } catch (error) {
      setMessage({
        text: error instanceof Error ? error.message : "Équipement impossible.",
        tone: "error"
      });
    } finally {
      setBusyItem(null);
    }
  }

  async function unequip(item: PlayerCosmeticItem) {
    setBusyItem(item.id);
    try {
      await api(`/cosmetics/${item.id}/unequip`, { method: "POST" });
      await loadCollection();
      await refreshPlayer();
      setMessage({ text: `${item.name} retiré de l'équipement.`, tone: "success" });
    } catch (error) {
      setMessage({
        text: error instanceof Error ? error.message : "Retrait impossible.",
        tone: "error"
      });
    } finally {
      setBusyItem(null);
    }
  }

  async function upgrade(item: PlayerCosmeticItem) {
    setBusyUpgrade(item.id);
    try {
      await api(`/cosmetics/${item.id}/upgrade`, { method: "POST" });
      await loadCollection();
      await refreshPlayer();
      setMessage({
        text: `${item.name} amélioré · bonus appliqué au joueur.`,
        tone: "success"
      });
    } catch (error) {
      setMessage({
        text: error instanceof Error ? error.message : "Amélioration impossible.",
        tone: "error"
      });
    } finally {
      setBusyUpgrade(null);
    }
  }

  async function unlockCard(card: CollectionStatCard) {
    setBusyCard(card.statKey);
    try {
      setData(await api<CollectionState>(`/cards/${card.statKey}/unlock`, { method: "POST" }));
      await refreshPlayer();
      setMessage({ text: `${card.label} amélioré de +1.`, tone: "success" });
    } catch (error) {
      setMessage({
        text: error instanceof Error ? error.message : "Déblocage impossible.",
        tone: "error"
      });
    } finally {
      setBusyCard(null);
    }
  }

  async function exchange(rarity: ChestRarity) {
    setBusyMarket(rarity);
    try {
      const result = await api<CosmeticMarketResult>("/cosmetics/market/exchange", {
        method: "POST",
        body: JSON.stringify({ rarity })
      });
      await loadCollection();
      await refreshPlayer();
      const reward = result.resultRarity
        ? `nouvel objet ${result.resultRarity}`
        : formatCredits(result.totalMoney);
      const refund = result.refund > 0 ? ` · remboursement ${formatCredits(result.refund)}` : "";
      setMessage({ text: `Marché validé · ${reward}${refund}.`, tone: "success" });
    } catch (error) {
      setMessage({
        text: error instanceof Error ? error.message : "Échange impossible.",
        tone: "error"
      });
    } finally {
      setBusyMarket(null);
    }
  }

  const showCardsExpanded = tab === "cards";
  const showMarketExpanded = tab === "market";
  const showInventory = !showCardsExpanded && !showMarketExpanded;

  return (
    <div className="collection-cinematic">
      <section className="collection-stage">
        <CollectionHeader
          gems={data?.gems ?? player?.gems ?? 0}
          credits={player?.budget ?? 0}
          onBack={() => navigate("/dashboard")}
          onCoachDeck={() => navigate("/collection/coach-deck")}
          onHelp={() => {
            localStorage.setItem("mypro-tutorial-active", "1");
            navigate("/dashboard");
          }}
          onSettings={() => navigate("/settings")}
        />
        <CollectionTabs
          active={tab}
          onChange={setTab}
          equipmentBonus={totalEquipmentBonus}
          unlockableCards={unlockableCards}
          objectCount={sortedCosmetics.length}
          marketReady={marketReady}
        />

        {loading ? (
          <div className="collection-loading" aria-live="polite">
            <PackageOpen size={42} />
            <strong>Préparation de la collection...</strong>
          </div>
        ) : loadError ? (
          <div className="collection-loading collection-load-error" role="alert">
            <PackageOpen size={42} />
            <strong>Collection indisponible</strong>
            <span>{loadError}</span>
            <button onClick={() => void loadCollection()} type="button">
              Réessayer
            </button>
          </div>
        ) : (
          <main className="collection-workspace">
            <EquipmentPanel
              cosmetics={sortedCosmetics}
              selectedItemId={selectedItemId}
              onSelectItem={setSelectedItemId}
              onChooseSlot={setSlotPicker}
              onUnequip={(item) => void unequip(item)}
              busyItem={busyItem}
            />

            {showInventory ? (
              <InventoryPanel
                cosmetics={sortedCosmetics}
                selectedItemId={selectedItemId}
                busyItem={busyItem}
                busyUpgrade={busyUpgrade}
                onSelect={setSelectedItemId}
                onEquip={(item, slot) => void equip(item, slot)}
                onUpgrade={(item) => void upgrade(item)}
              />
            ) : showCardsExpanded ? (
              <StatsPanel
                cards={data?.cards ?? []}
                expanded
                busyCard={busyCard}
                onUnlock={(card) => void unlockCard(card)}
                onExpand={() => setTab("cards")}
              />
            ) : (
              <MarketPanel
                counts={marketCounts}
                expanded
                busyMarket={busyMarket}
                onExchange={(rarity) => void exchange(rarity)}
                onExpand={() => setTab("market")}
              />
            )}

            <aside className="collection-side-stack">
              {showCardsExpanded ? (
                <MarketPanel
                  counts={marketCounts}
                  expanded={false}
                  busyMarket={busyMarket}
                  onExchange={(rarity) => void exchange(rarity)}
                  onExpand={() => setTab("market")}
                />
              ) : showMarketExpanded ? (
                <StatsPanel
                  cards={data?.cards ?? []}
                  expanded={false}
                  busyCard={busyCard}
                  onUnlock={(card) => void unlockCard(card)}
                  onExpand={() => setTab("cards")}
                />
              ) : (
                <>
                  <StatsPanel
                    cards={data?.cards ?? []}
                    expanded={false}
                    busyCard={busyCard}
                    onUnlock={(card) => void unlockCard(card)}
                    onExpand={() => setTab("cards")}
                  />
                  <MarketPanel
                    counts={marketCounts}
                    expanded={false}
                    busyMarket={busyMarket}
                    onExchange={(rarity) => void exchange(rarity)}
                    onExpand={() => setTab("market")}
                  />
                </>
              )}
            </aside>
          </main>
        )}

        {message ? (
          <div className={`collection-toast is-${message.tone}`} role="status">
            {message.tone === "success" ? <Check size={18} /> : <X size={18} />}
            <strong>{message.text}</strong>
          </div>
        ) : null}
      </section>
      {slotPicker !== null ? (
        <SlotPicker
          slot={slotPicker}
          cosmetics={sortedCosmetics}
          busyItem={busyItem}
          onClose={() => setSlotPicker(null)}
          onEquip={(item, slot) => void equip(item, slot)}
        />
      ) : null}
    </div>
  );
}
