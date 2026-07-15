import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Check,
  CircleHelp,
  CopyPlus,
  HeartPulse,
  Layers3,
  Lock,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  Zap
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api";
import { useGameStore } from "../../store";

type CoachCardFamily = "BOOST" | "COUNTER" | "STATE" | "DECK";

type CoachCardPayload = {
  id: string;
  family: CoachCardFamily;
  tier: "STARTER" | "ADVANCED" | "SIGNATURE";
  name: string;
  shortName: string;
  description: string;
  focusCost: number;
  unlockLevel: number;
  copyLimit: number;
  duration: { unit: "POINTS" | "GAMES" | "IMMEDIATE" | "NEXT_WINDOW"; amount: number };
  primaryStats: string[];
  secondaryStats: string[];
  unlocked: boolean;
  masteryXp: number;
  masteryLevel: number;
  mastery: {
    xp: number;
    level: number;
    levelFloorXp: number;
    nextLevelXp: number | null;
    progress: number;
    maxLevel: number;
  };
  selectedVariant: "IMPACT" | "FLOW" | null;
  effectiveFocusCost: number;
  variants: Array<{
    id: "IMPACT" | "FLOW";
    name: string;
    description: string;
    unlockMasteryLevel: number;
    unlocked: boolean;
    selected: boolean;
  }>;
};

type CoachDeckPayload = {
  id: string;
  name: string;
  isActive: boolean;
  version: number;
  cardIds: string[];
  updatedAt: string;
};

type CoachDeckState = {
  rules: { deckSize: number; handSize: number; focusPerSet: number; maxDecks: number };
  activeDeckId: string | null;
  catalog: CoachCardPayload[];
  decks: CoachDeckPayload[];
};

const familyLabels: Record<CoachCardFamily, string> = {
  BOOST: "Boost",
  COUNTER: "Contre",
  STATE: "État",
  DECK: "Deck"
};

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

function FamilyIcon({ family }: { family: CoachCardFamily }) {
  if (family === "BOOST") return <Zap aria-hidden="true" />;
  if (family === "COUNTER") return <ShieldCheck aria-hidden="true" />;
  if (family === "STATE") return <HeartPulse aria-hidden="true" />;
  return <Layers3 aria-hidden="true" />;
}

function durationLabel(card: CoachCardPayload) {
  if (card.duration.unit === "IMMEDIATE") return "Immédiat";
  if (card.duration.unit === "NEXT_WINDOW") return "Prochaine décision";
  return `${card.duration.amount} ${card.duration.unit === "GAMES" ? "jeu(x)" : "point(s)"}`;
}

export function CoachDeckBuilderPage() {
  const navigate = useNavigate();
  const player = useGameStore((state) => state.player);
  const [state, setState] = useState<CoachDeckState | null>(null);
  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(null);
  const [workingCardIds, setWorkingCardIds] = useState<string[]>([]);
  const [deckName, setDeckName] = useState("");
  const [family, setFamily] = useState<CoachCardFamily | "ALL">("ALL");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [loadRevision, setLoadRevision] = useState(0);

  function selectDeck(payload: CoachDeckState, deckId: string | null) {
    const deck =
      payload.decks.find((item) => item.id === deckId) ??
      payload.decks.find((item) => item.isActive) ??
      payload.decks[0];
    setSelectedDeckId(deck?.id ?? null);
    setWorkingCardIds(deck?.cardIds ?? []);
    setDeckName(deck?.name ?? "Nouveau deck");
  }

  useEffect(() => {
    let active = true;
    void api<CoachDeckState>("/coach-decks")
      .then((payload) => {
        if (!active) return;
        setState(payload);
        selectDeck(payload, payload.activeDeckId);
      })
      .catch((error) => {
        if (active) setMessage(error instanceof Error ? error.message : "Chargement impossible.");
      });
    return () => {
      active = false;
    };
  }, [loadRevision]);

  const cardMap = useMemo(
    () => new Map((state?.catalog ?? []).map((card) => [card.id, card])),
    [state?.catalog]
  );
  const selectedDeck = state?.decks.find((deck) => deck.id === selectedDeckId) ?? null;
  const filteredCards = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (state?.catalog ?? []).filter(
      (card) =>
        (family === "ALL" || card.family === family) &&
        (!query ||
          `${card.name} ${card.description} ${card.primaryStats.map((key) => statLabels[key]).join(" ")}`
            .toLowerCase()
            .includes(query))
    );
  }, [family, search, state?.catalog]);
  const familyCounts = useMemo(() => {
    const counts: Record<CoachCardFamily, number> = { BOOST: 0, COUNTER: 0, STATE: 0, DECK: 0 };
    for (const cardId of workingCardIds) {
      const card = cardMap.get(cardId);
      if (card) counts[card.family] += 1;
    }
    return counts;
  }, [cardMap, workingCardIds]);
  const totalFocus = workingCardIds.reduce(
    (total, cardId) => total + (cardMap.get(cardId)?.effectiveFocusCost ?? 0),
    0
  );
  const deckComplete = workingCardIds.length === (state?.rules.deckSize ?? 12);

  function chooseDeck(deck: CoachDeckPayload) {
    setSelectedDeckId(deck.id);
    setWorkingCardIds(deck.cardIds);
    setDeckName(deck.name);
    setMessage("");
  }

  function addCard(card: CoachCardPayload) {
    if (!card.unlocked) {
      setMessage(`${card.name} sera disponible au niveau ${card.unlockLevel}.`);
      return;
    }
    if (workingCardIds.length >= (state?.rules.deckSize ?? 12)) {
      setMessage("Retirez une carte avant d’en ajouter une nouvelle.");
      return;
    }
    const copies = workingCardIds.filter((cardId) => cardId === card.id).length;
    if (copies >= card.copyLimit) {
      setMessage(`${card.name} est limitée à ${card.copyLimit} exemplaire(s).`);
      return;
    }
    setWorkingCardIds((current) => [...current, card.id]);
    setMessage(`✓ ${card.name} ajoutée au deck.`);
  }

  function removeCard(position: number) {
    setWorkingCardIds((current) => current.filter((_, index) => index !== position));
    setMessage("Carte retirée. Complétez le deck avant de sauvegarder.");
  }

  async function saveDeck(activate = false) {
    if (!state || !selectedDeckId || !deckComplete) return;
    setBusy(true);
    setMessage("");
    try {
      const payload = await api<CoachDeckState>(`/coach-decks/${selectedDeckId}`, {
        method: "PUT",
        body: JSON.stringify({ name: deckName, cardIds: workingCardIds, activate })
      });
      setState(payload);
      selectDeck(payload, selectedDeckId);
      setMessage(activate ? "✓ Deck sauvegardé et activé." : "✓ Deck sauvegardé.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Sauvegarde impossible.");
    } finally {
      setBusy(false);
    }
  }

  async function createNewDeck() {
    if (!state || !deckComplete) return;
    setBusy(true);
    setMessage("");
    try {
      const nextName = `Deck ${state.decks.length + 1}`;
      const payload = await api<CoachDeckState>("/coach-decks", {
        method: "POST",
        body: JSON.stringify({ name: nextName, cardIds: workingCardIds, activate: false })
      });
      setState(payload);
      const created = payload.decks.find((deck) => deck.name === nextName);
      selectDeck(payload, created?.id ?? null);
      setMessage("✓ Nouveau deck créé à partir de cette composition.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Création impossible.");
    } finally {
      setBusy(false);
    }
  }

  async function activateDeck() {
    if (!state || !selectedDeckId) return;
    setBusy(true);
    setMessage("");
    try {
      const payload = await api<CoachDeckState>(`/coach-decks/${selectedDeckId}/activate`, {
        method: "POST"
      });
      setState(payload);
      selectDeck(payload, selectedDeckId);
      setMessage("✓ Ce deck sera utilisé pour le prochain match Coach.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Activation impossible.");
    } finally {
      setBusy(false);
    }
  }

  async function selectVariant(card: CoachCardPayload, variantId: "IMPACT" | "FLOW" | null) {
    if (busy || !card.unlocked || card.selectedVariant === variantId) return;
    setBusy(true);
    setMessage("");
    try {
      const payload = await api<CoachDeckState>(`/coach-cards/${card.id}/variant`, {
        method: "PUT",
        body: JSON.stringify({ variantId })
      });
      setState(payload);
      const label =
        variantId === null
          ? "Version standard"
          : payload.catalog
              .find((item) => item.id === card.id)
              ?.variants.find((variant) => variant.id === variantId)?.name;
      setMessage(`✓ ${label ?? "Variante"} sélectionnée pour ${card.name}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Sélection impossible.");
    } finally {
      setBusy(false);
    }
  }

  if (!state) {
    return (
      <main className="coach-deck-builder coach-deck-loading" aria-busy={!message}>
        {message ? <RefreshCw /> : <Layers3 />}
        <strong>{message ? "COACH DECK INDISPONIBLE" : "Préparation de votre Coach Deck…"}</strong>
        {message ? (
          <>
            <p>{message}</p>
            <small>Votre deck de départ de 12 cartes sera créé automatiquement.</small>
            <div className="coach-deck-loading-actions">
              <button
                onClick={() => {
                  setMessage("");
                  setLoadRevision((current) => current + 1);
                }}
                type="button"
              >
                <RefreshCw /> Réessayer
              </button>
              <button onClick={() => navigate("/collection")} type="button">
                <ArrowLeft /> Retour à la collection
              </button>
            </div>
          </>
        ) : (
          <small>Vérification de vos cartes et création du deck de départ.</small>
        )}
      </main>
    );
  }

  return (
    <main className="coach-deck-builder">
      <header className="coach-deck-builder-header">
        <button
          type="button"
          onClick={() => navigate("/collection")}
          aria-label="Retour à la collection"
        >
          <ArrowLeft />
        </button>
        <div>
          <span>MODE COACH</span>
          <h1>CONSTRUCTEUR DE DECK</h1>
          <p>12 cartes · main de 4 · {state.rules.focusPerSet} Focus par set</p>
        </div>
        <div className="coach-deck-header-tools">
          <button onClick={() => navigate("/coach-deck/tutorial")} type="button">
            <CircleHelp />
            <span>TUTORIEL</span>
          </button>
          <div className="coach-deck-header-state">
            <Sparkles />
            <span>Niveau</span>
            <strong>{player?.playerLevel ?? 0}</strong>
          </div>
        </div>
      </header>

      {message ? (
        <div className={`coach-deck-message ${message.startsWith("✓") ? "is-success" : ""}`}>
          {message}
        </div>
      ) : null}

      <section className="coach-deck-builder-layout">
        <aside className="coach-deck-composition">
          <div className="coach-deck-panel-heading">
            <div>
              <span>VOTRE COMPOSITION</span>
              <strong>
                {workingCardIds.length}/{state.rules.deckSize} CARTES
              </strong>
            </div>
            <small>{totalFocus} Focus cumulé</small>
          </div>

          <div className="coach-deck-tabs" aria-label="Decks enregistrés">
            {state.decks.map((deck) => (
              <button
                type="button"
                className={deck.id === selectedDeckId ? "is-selected" : ""}
                key={deck.id}
                onClick={() => chooseDeck(deck)}
              >
                {deck.name}
                {deck.isActive ? <Check aria-label="Actif" /> : null}
              </button>
            ))}
          </div>

          <label className="coach-deck-name-field">
            <span>Nom du deck</span>
            <input
              value={deckName}
              maxLength={30}
              onChange={(event) => setDeckName(event.target.value)}
            />
          </label>

          <div className="coach-deck-slots">
            {Array.from({ length: state.rules.deckSize }, (_, position) => {
              const cardId = workingCardIds[position];
              const card = cardId ? cardMap.get(cardId) : null;
              return (
                <button
                  type="button"
                  className={`coach-deck-slot ${card ? `family-${card.family.toLowerCase()}` : "is-empty"}`}
                  key={position}
                  onClick={() => (card ? removeCard(position) : undefined)}
                  aria-label={card ? `Retirer ${card.name}` : `Emplacement vide ${position + 1}`}
                >
                  {card ? (
                    <>
                      <FamilyIcon family={card.family} />
                      <span>{card.shortName}</span>
                      <small>{card.effectiveFocusCost} F</small>
                      <Trash2 className="coach-deck-remove" />
                    </>
                  ) : (
                    <>
                      <span>+</span>
                      <small>VIDE</small>
                    </>
                  )}
                </button>
              );
            })}
          </div>

          <div className="coach-deck-family-summary">
            {(Object.keys(familyCounts) as CoachCardFamily[]).map((key) => (
              <span className={`family-${key.toLowerCase()}`} key={key}>
                {familyLabels[key]} <strong>{familyCounts[key]}</strong>
              </span>
            ))}
          </div>

          <div className="coach-deck-builder-actions">
            <button
              type="button"
              disabled={!deckComplete || busy || deckName.trim().length < 2}
              onClick={() => void saveDeck(false)}
            >
              <Save /> SAUVEGARDER
            </button>
            {selectedDeck?.isActive ? (
              <span className="coach-deck-active-badge">
                <Check /> DECK ACTIF
              </span>
            ) : (
              <button
                className="is-primary"
                type="button"
                disabled={!deckComplete || busy}
                onClick={() => void activateDeck()}
              >
                <Check /> ACTIVER
              </button>
            )}
            <button
              type="button"
              disabled={!deckComplete || busy || state.decks.length >= state.rules.maxDecks}
              onClick={() => void createNewDeck()}
              title={`Créer un deck (${state.decks.length}/${state.rules.maxDecks})`}
            >
              <CopyPlus /> COPIER
            </button>
          </div>
        </aside>

        <section className="coach-deck-catalog">
          <div className="coach-deck-catalog-toolbar">
            <div className="coach-deck-filter-tabs">
              {(["ALL", "BOOST", "COUNTER", "STATE", "DECK"] as const).map((value) => (
                <button
                  type="button"
                  className={family === value ? "is-selected" : ""}
                  onClick={() => setFamily(value)}
                  key={value}
                >
                  {value === "ALL" ? "Toutes" : familyLabels[value]}
                </button>
              ))}
            </div>
            <label>
              <Search />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Carte ou statistique"
              />
            </label>
          </div>

          <div className="coach-deck-card-grid">
            {filteredCards.map((card) => {
              const copies = workingCardIds.filter((cardId) => cardId === card.id).length;
              const blocked = !card.unlocked || copies >= card.copyLimit || deckComplete;
              return (
                <article
                  className={`coach-builder-card family-${card.family.toLowerCase()} ${!card.unlocked ? "is-locked" : ""}`}
                  key={card.id}
                >
                  <header>
                    <span>
                      <FamilyIcon family={card.family} /> {familyLabels[card.family]}
                    </span>
                    <strong>{card.effectiveFocusCost} FOCUS</strong>
                  </header>
                  <div className="coach-builder-card-visual">
                    {card.unlocked ? <FamilyIcon family={card.family} /> : <Lock />}
                    <span>{card.tier}</span>
                  </div>
                  <h2>{card.name}</h2>
                  <p>{card.description}</p>
                  <div className="coach-builder-card-stats">
                    {card.primaryStats.map((key) => (
                      <span key={key}>
                        {statLabels[key] ?? key}
                        <strong>{Math.round(player?.stats[key] ?? 0)}</strong>
                      </span>
                    ))}
                  </div>
                  {card.unlocked ? (
                    <div className="coach-card-mastery">
                      <div>
                        <span>MAÎTRISE {card.mastery.level}</span>
                        <strong>
                          {card.mastery.nextLevelXp === null
                            ? "MAX"
                            : `${card.mastery.xp}/${card.mastery.nextLevelXp} XP`}
                        </strong>
                      </div>
                      <i>
                        <span style={{ width: `${Math.round(card.mastery.progress * 100)}%` }} />
                      </i>
                    </div>
                  ) : null}
                  {card.unlocked ? (
                    <div className="coach-card-variants" aria-label={`Variantes de ${card.name}`}>
                      <button
                        className={card.selectedVariant === null ? "is-selected" : ""}
                        disabled={busy}
                        onClick={() => void selectVariant(card, null)}
                        type="button"
                        title="Effet et coût d’origine"
                      >
                        Standard
                      </button>
                      {card.variants.map((variant) => (
                        <button
                          className={variant.selected ? "is-selected" : ""}
                          disabled={busy || !variant.unlocked}
                          key={variant.id}
                          onClick={() => void selectVariant(card, variant.id)}
                          type="button"
                          title={variant.description}
                        >
                          {variant.unlocked
                            ? variant.name
                            : `Maîtrise ${variant.unlockMasteryLevel}`}
                        </button>
                      ))}
                    </div>
                  ) : null}
                  <footer>
                    <span>{durationLabel(card)}</span>
                    <button
                      type="button"
                      disabled={blocked}
                      onClick={() => addCard(card)}
                      aria-label={`Ajouter ${card.name}`}
                    >
                      {!card.unlocked
                        ? `NIV. ${card.unlockLevel}`
                        : copies >= card.copyLimit
                          ? `${copies}/${card.copyLimit}`
                          : deckComplete
                            ? "DECK COMPLET"
                            : "+ AJOUTER"}
                    </button>
                  </footer>
                </article>
              );
            })}
          </div>
        </section>
      </section>
    </main>
  );
}
