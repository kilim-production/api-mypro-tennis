import { useCallback, useEffect, useMemo, useState } from "react";
import type React from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import {
  ArrowLeft,
  Bot,
  Check,
  CheckCircle2,
  Coins,
  Crosshair,
  Dumbbell,
  FastForward,
  Flame,
  Gauge,
  Gem,
  Hand,
  HeartPulse,
  HelpCircle,
  Layers3,
  LoaderCircle,
  MoveDown,
  MoveUpRight,
  Play,
  RefreshCw,
  Repeat2,
  Search,
  Settings,
  Sparkles,
  Swords,
  Target,
  UserRoundSearch,
  Users,
  Wifi,
  Wind,
  X,
  Zap
} from "lucide-react";
import { api } from "../../api";
import { useGameStore, type Player } from "../../store";
import {
  duelComparisonKeys,
  duelDifficulty,
  duelEnergyPercent,
  duelPlayerStyle,
  duelStat,
  duelStatKeys,
  duelStatLabels,
  duelTacticalRead,
  duelTopStats,
  formatDuelCredits,
  type DuelStatKey
} from "./duelUtils";
import "./duel.css";

type DuelPool = {
  overallRange: { min: number; max: number; delta: number };
  opponents: Player[];
};

type DuelSearch = {
  overallRange: { min: number; max: number; delta: number };
  results: Player[];
};

type CoachDeckState = {
  rules: { deckSize: number };
  activeDeckId: string | null;
  decks: Array<{ id: string; name: string; isActive: boolean; cardIds: string[] }>;
};

type DuelPageProps = {
  resolveHeroSource: (avatar: string) => string | undefined;
  resolvePictureSource: (avatar: string) => string;
};

type MatchMode = "coach" | "auto" | "quick";
type DuelTab = "pool" | "friends";

const statIcons: Record<DuelStatKey, LucideIcon> = {
  service: Target,
  return: Repeat2,
  forehand: Crosshair,
  backhand: MoveUpRight,
  volley: Hand,
  smash: Flame,
  dropShot: MoveDown,
  stamina: Gauge,
  speed: Wind,
  explosiveness: Zap,
  strength: Dumbbell,
  recovery: HeartPulse
};

const modeOptions: Array<{
  id: MatchMode;
  label: string;
  duration: string;
  description: string;
  badge?: string;
  Icon: LucideIcon;
}> = [
  {
    id: "coach",
    label: "Coach Deck",
    duration: "5 à 8 min",
    description: "Jouez vos cartes et gérez le Focus",
    badge: "Recommandé",
    Icon: Target
  },
  {
    id: "auto",
    label: "Automatique",
    duration: "1 à 2 min",
    description: "Regardez le match point par point",
    Icon: Play
  },
  {
    id: "quick",
    label: "Résultat rapide",
    duration: "Immédiat",
    description: "Accédez directement au score final",
    Icon: FastForward
  }
];

function PlayerPortrait({
  player,
  resolvePictureSource,
  className = ""
}: {
  player: Player;
  resolvePictureSource: DuelPageProps["resolvePictureSource"];
  className?: string;
}) {
  return (
    <img
      alt={`${player.firstName} ${player.lastName}`}
      className={className}
      draggable={false}
      loading="eager"
      src={resolvePictureSource(player.avatar)}
    />
  );
}

function StatChip({ statKey, value }: { statKey: DuelStatKey; value: number }) {
  const Icon = statIcons[statKey];
  return (
    <span className="duel-stat-chip">
      <Icon aria-hidden="true" />
      <small>{duelStatLabels[statKey]}</small>
      <strong>{value}</strong>
    </span>
  );
}

function OpponentCard({
  opponent,
  selected,
  resolvePictureSource,
  onSelect
}: {
  opponent: Player;
  selected: boolean;
  resolvePictureSource: DuelPageProps["resolvePictureSource"];
  onSelect: () => void;
}) {
  const topStats = duelTopStats(opponent, 2);
  return (
    <button
      aria-pressed={selected}
      className={`duel-opponent-card${selected ? " is-selected" : ""}`}
      onClick={onSelect}
      type="button"
    >
      <span className="duel-opponent-kind">
        {opponent.isAi ? <Bot aria-hidden="true" /> : <Wifi aria-hidden="true" />}
        {opponent.isAi ? "Profil IA" : "Joueur réel"}
      </span>
      {selected ? (
        <span className="duel-opponent-check">
          <Check aria-hidden="true" />
        </span>
      ) : null}
      <PlayerPortrait
        className="duel-opponent-picture"
        player={opponent}
        resolvePictureSource={resolvePictureSource}
      />
      <span className="duel-opponent-identity">
        <strong>
          {opponent.firstName} {opponent.lastName}
        </strong>
        <span>
          <b>{opponent.fftRanking}</b>
          <em>
            {opponent.wins} V · {opponent.losses} D
          </em>
          <i>{opponent.overall}</i>
        </span>
        <small>{duelPlayerStyle(opponent)}</small>
      </span>
      <span className="duel-opponent-strengths">
        <small>Points forts</small>
        <span>
          {topStats.map((item) => (
            <StatChip key={item.key} statKey={item.key} value={item.value} />
          ))}
        </span>
      </span>
      <span className="duel-opponent-select">{selected ? "Sélectionné" : "Choisir"}</span>
    </button>
  );
}

function DuelSkeletonCards() {
  return (
    <div className="duel-opponent-grid" aria-label="Chargement des adversaires">
      {[0, 1, 2].map((item) => (
        <span className="duel-opponent-skeleton" key={item}>
          <LoaderCircle aria-hidden="true" />
        </span>
      ))}
    </div>
  );
}

export function DuelPage({ resolveHeroSource, resolvePictureSource }: DuelPageProps) {
  const player = useGameStore((state) => state.player);
  const refreshPlayer = useGameStore((state) => state.refresh);
  const navigate = useNavigate();
  const [pool, setPool] = useState<DuelPool | null>(null);
  const [deckState, setDeckState] = useState<CoachDeckState | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [selectedOpponentId, setSelectedOpponentId] = useState<string | null>(null);
  const [duelTab, setDuelTab] = useState<DuelTab>("pool");
  const [matchMode, setMatchMode] = useState<MatchMode>("coach");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Player[]>([]);
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(true);
  const [launching, setLaunching] = useState(false);
  const [message, setMessage] = useState("");
  const [showAllStats, setShowAllStats] = useState(false);

  const applyPool = useCallback((nextPool: DuelPool) => {
    setPool(nextPool);
    setSelectedOpponentId((current) =>
      current && nextPool.opponents.some((opponent) => opponent.id === current)
        ? current
        : (nextPool.opponents[0]?.id ?? null)
    );
  }, []);

  const loadDuel = useCallback(async () => {
    setLoading(true);
    setMessage("");
    const [poolResult, sessionResult, deckResult] = await Promise.allSettled([
      api<DuelPool>("/matches/duel-pool"),
      api<{ id: string } | null>("/matches/interactive/active"),
      api<CoachDeckState>("/coach-decks")
    ]);

    if (poolResult.status === "fulfilled") applyPool(poolResult.value);
    else setMessage("Impossible de charger les adversaires. Réessayez dans un instant.");
    if (sessionResult.status === "fulfilled") setActiveSessionId(sessionResult.value?.id ?? null);
    if (deckResult.status === "fulfilled") setDeckState(deckResult.value);
    setLoading(false);
  }, [applyPool]);

  useEffect(() => {
    void loadDuel();
  }, [loadDuel]);

  const visibleOpponents = duelTab === "friends" ? searchResults : (pool?.opponents ?? []);
  const selectedOpponent = useMemo(
    () =>
      visibleOpponents.find((opponent) => opponent.id === selectedOpponentId) ??
      visibleOpponents[0] ??
      null,
    [selectedOpponentId, visibleOpponents]
  );
  const activeDeck = useMemo(
    () => deckState?.decks.find((deck) => deck.id === deckState.activeDeckId) ?? null,
    [deckState]
  );
  const deckSize = deckState?.rules.deckSize ?? 12;
  const deckCardCount = activeDeck?.cardIds.length ?? 0;
  const deckReady = Boolean(activeDeck && deckCardCount === deckSize);

  const tacticalRead = useMemo(
    () => (player && selectedOpponent ? duelTacticalRead(player, selectedOpponent) : null),
    [player, selectedOpponent]
  );
  const difficulty = useMemo(
    () => (player && selectedOpponent ? duelDifficulty(player, selectedOpponent) : null),
    [player, selectedOpponent]
  );

  async function refreshPool() {
    setLoading(true);
    setMessage("");
    try {
      applyPool(await api<DuelPool>("/matches/duel-pool"));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Rafraîchissement impossible.");
    } finally {
      setLoading(false);
    }
  }

  async function searchOpponents(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = searchQuery.trim();
    if (query.length < 2) {
      setMessage("Saisissez au moins 2 caractères pour rechercher un joueur.");
      return;
    }
    setSearching(true);
    setMessage("");
    try {
      const result = await api<DuelSearch>(`/matches/duel-search?q=${encodeURIComponent(query)}`);
      setSearchResults(result.results.slice(0, 3));
      setSelectedOpponentId(result.results[0]?.id ?? null);
      if (result.results.length === 0) setMessage("Aucun joueur disponible dans votre zone.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Recherche impossible.");
    } finally {
      setSearching(false);
    }
  }

  function changeTab(nextTab: DuelTab) {
    setDuelTab(nextTab);
    setMessage("");
    if (nextTab === "pool") setSelectedOpponentId(pool?.opponents[0]?.id ?? null);
    else setSelectedOpponentId(searchResults[0]?.id ?? null);
  }

  async function startMatch() {
    if (!player || !selectedOpponent || launching) return;
    if (player.actionEnergy < 1) {
      setMessage("Votre joueur n’a pas assez d’énergie pour lancer ce duel.");
      return;
    }
    if (matchMode === "coach" && !deckReady) {
      setMessage("Votre Coach Deck doit contenir 12 cartes avant de lancer ce mode.");
      return;
    }
    if (matchMode === "coach" && localStorage.getItem("mypro-coach-deck-tutorial-done") !== "1") {
      navigate("/coach-deck/tutorial");
      return;
    }

    setLaunching(true);
    setMessage("");
    try {
      const endpoint = matchMode === "coach" ? "/matches/interactive" : "/matches/quick";
      const match = await api<{ id: string }>(endpoint, {
        method: "POST",
        body: JSON.stringify({
          opponentId: selectedOpponent.id,
          format: "Deux sets gagnants",
          coachDeckId: matchMode === "coach" ? activeDeck?.id : undefined
        })
      });
      void refreshPlayer();
      if (matchMode === "coach") navigate(`/match-live/${match.id}`);
      else navigate(`/match/${match.id}${matchMode === "quick" ? "?result=1" : ""}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Le duel n’a pas pu être lancé.");
      setLaunching(false);
      void loadDuel();
    }
  }

  if (!player) return null;

  const heroSource = resolveHeroSource(player.avatar);
  const playerTopStats = duelTopStats(player, 3);
  const overallRange = pool ? `${pool.overallRange.min} à ${pool.overallRange.max}` : "...";

  return (
    <div className="duel-cinematic">
      <div className="duel-stage">
        <header className="duel-header">
          <Link aria-label="Retour au hub" className="duel-icon-button duel-back" to="/dashboard">
            <ArrowLeft />
          </Link>
          <Link className="duel-brand" to="/dashboard">
            <strong>MYPRO</strong>
            <span>TENNIS</span>
          </Link>
          <h1>Duel</h1>
          <div className="duel-header-actions">
            <span className="duel-resource duel-resource-energy">
              <Zap />
              <span>
                <small>Énergie</small>
                <strong>
                  {player.actionEnergy}/{player.actionEnergyMax}
                </strong>
              </span>
            </span>
            <span className="duel-resource duel-resource-gems">
              <Gem />
              <span>
                <small>Gemmes</small>
                <strong>{player.gems}</strong>
              </span>
            </span>
            <span className="duel-resource duel-resource-credits">
              <Coins />
              <span>
                <small>Crédits</small>
                <strong>{formatDuelCredits(player.budget)}</strong>
              </span>
            </span>
            <Link
              className={`duel-deck-resource${deckReady ? " is-ready" : ""}`}
              to="/collection/coach-deck"
            >
              <Layers3 />
              <span>
                <small>Coach Deck</small>
                <strong>
                  {deckCardCount}/{deckSize} {deckReady ? "prêt" : "à compléter"}
                </strong>
              </span>
            </Link>
            <button
              aria-label="Aide Coach Deck"
              className="duel-icon-button duel-optional-action"
              onClick={() => navigate("/coach-deck/tutorial")}
              type="button"
            >
              <HelpCircle />
            </button>
            <Link aria-label="Réglages" className="duel-icon-button" to="/settings">
              <Settings />
            </Link>
            <Link aria-label="Fermer" className="duel-icon-button" to="/dashboard">
              <X />
            </Link>
          </div>
        </header>

        <nav className="duel-tabs" aria-label="Choix des adversaires">
          <button
            className={duelTab === "pool" ? "is-active" : ""}
            onClick={() => changeTab("pool")}
            type="button"
          >
            <Swords />
            <span>
              <strong>Adversaires</strong>
              <small>{pool?.opponents.length ?? 3} choix</small>
            </span>
          </button>
          <button
            className={duelTab === "friends" ? "is-active" : ""}
            onClick={() => changeTab("friends")}
            type="button"
          >
            <Users />
            <span>
              <strong>Match entre amis</strong>
              <small>Recherche</small>
            </span>
          </button>
          <button
            className="duel-refresh"
            disabled={loading}
            onClick={() => void refreshPool()}
            type="button"
          >
            <RefreshCw className={loading ? "is-spinning" : ""} />
            <span>Actualiser</span>
          </button>
        </nav>

        <main className="duel-main">
          <section className="duel-panel duel-player-panel">
            <h2>Votre joueur</h2>
            <div className="duel-player-visual">
              {heroSource ? (
                <img
                  alt={`${player.firstName} ${player.lastName}`}
                  className="duel-player-hero"
                  draggable={false}
                  src={heroSource}
                />
              ) : (
                <PlayerPortrait
                  className="duel-player-hero duel-player-hero-picture"
                  player={player}
                  resolvePictureSource={resolvePictureSource}
                />
              )}
            </div>
            <div className="duel-player-summary">
              <h3>
                {player.firstName} {player.lastName}
              </h3>
              <div className="duel-player-badges">
                <span>{player.fftRanking}</span>
                <span>Niv. {player.playerLevel}</span>
                <strong>
                  {player.overall}
                  <small>Note</small>
                </strong>
              </div>
              <div className="duel-record">
                <span>{player.wins} victoires</span>
                <span>{player.losses} défaites</span>
              </div>
              <div className="duel-form">
                <span>
                  <Zap /> <strong>Forme</strong> {duelEnergyPercent(player)} %
                </span>
                <i>
                  <b style={{ width: `${duelEnergyPercent(player)}%` }} />
                </i>
              </div>
              <div className="duel-player-strengths">
                <small>Points forts</small>
                <div>
                  {playerTopStats.map((item) => (
                    <StatChip key={item.key} statKey={item.key} value={item.value} />
                  ))}
                </div>
              </div>
            </div>
            <Link
              className={`duel-deck-status${deckReady ? " is-ready" : ""}`}
              to="/collection/coach-deck"
            >
              <Layers3 />
              <span>
                <strong>{deckReady ? "Coach Deck actif" : "Coach Deck incomplet"}</strong>
                <small>
                  {deckCardCount} cartes ·{" "}
                  {deckReady ? "prêt" : `${deckSize - deckCardCount} à ajouter`}
                </small>
              </span>
            </Link>
          </section>

          <section className="duel-panel duel-opponents-panel">
            <header>
              <div>
                <h2>{duelTab === "pool" ? "Choisissez votre adversaire" : "Match entre amis"}</h2>
                <p>
                  Votre zone de note globale : <strong>{overallRange}</strong>
                </p>
              </div>
              {duelTab === "friends" ? (
                <form className="duel-friend-search" onSubmit={searchOpponents}>
                  <Search />
                  <input
                    aria-label="Rechercher un joueur"
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Prénom ou nom"
                    value={searchQuery}
                  />
                  <button disabled={searching} type="submit">
                    {searching ? <LoaderCircle className="is-spinning" /> : "Chercher"}
                  </button>
                </form>
              ) : null}
            </header>
            {loading && duelTab === "pool" ? <DuelSkeletonCards /> : null}
            {!loading && visibleOpponents.length > 0 ? (
              <div className="duel-opponent-grid">
                {visibleOpponents.slice(0, 3).map((opponent) => (
                  <OpponentCard
                    key={opponent.id}
                    onSelect={() => setSelectedOpponentId(opponent.id)}
                    opponent={opponent}
                    resolvePictureSource={resolvePictureSource}
                    selected={selectedOpponent?.id === opponent.id}
                  />
                ))}
              </div>
            ) : null}
            {!loading && duelTab === "friends" && visibleOpponents.length === 0 ? (
              <div className="duel-friend-empty">
                <UserRoundSearch />
                <strong>Recherchez un joueur réel</strong>
                <small>
                  Entrez au moins deux caractères pour afficher jusqu’à trois adversaires.
                </small>
              </div>
            ) : null}
            <div className="duel-pool-note">
              <HelpCircle /> Un adversaire reste dans ce pool jusqu’à ce que vous l’affrontiez. Un
              joueur réel peut être affronté <strong>2 fois</strong> par jour.
            </div>
          </section>

          <section className="duel-panel duel-analysis-panel">
            <h2>Analyse du duel</h2>
            {selectedOpponent && tacticalRead && difficulty ? (
              <>
                <div className="duel-versus">
                  <span>
                    <PlayerPortrait player={player} resolvePictureSource={resolvePictureSource} />
                    <small>Alex</small>
                    <strong>{player.overall}</strong>
                  </span>
                  <b>VS</b>
                  <span>
                    <PlayerPortrait
                      player={selectedOpponent}
                      resolvePictureSource={resolvePictureSource}
                    />
                    <small>{selectedOpponent.firstName}</small>
                    <strong>{selectedOpponent.overall}</strong>
                  </span>
                </div>
                <div className={`duel-difficulty is-${difficulty.tone}`}>
                  <Swords /> {difficulty.label}
                </div>
                <div className="duel-comparison-list">
                  {tacticalRead.comparisons.map((comparison) => (
                    <div className="duel-comparison" key={comparison.key}>
                      <strong>{comparison.playerValue}</strong>
                      <i className="duel-bar duel-bar-player">
                        <b style={{ width: `${comparison.playerValue}%` }} />
                      </i>
                      <span>{duelStatLabels[comparison.key]}</span>
                      <i className="duel-bar duel-bar-opponent">
                        <b style={{ width: `${comparison.opponentValue}%` }} />
                      </i>
                      <strong>{comparison.opponentValue}</strong>
                    </div>
                  ))}
                </div>
                <div className="duel-tactical-cards">
                  <span>
                    <small>Votre avantage</small>
                    <strong>
                      {duelStatLabels[tacticalRead.advantage.key]} +
                      {Math.max(0, tacticalRead.advantage.difference)}
                    </strong>
                  </span>
                  <span>
                    <small>À surveiller</small>
                    <strong>
                      {duelStatLabels[tacticalRead.danger.key]} {tacticalRead.danger.opponentValue}
                    </strong>
                  </span>
                </div>
                <button
                  className="duel-all-stats"
                  onClick={() => setShowAllStats(true)}
                  type="button"
                >
                  Voir les 12 statistiques
                </button>
              </>
            ) : (
              <div className="duel-analysis-empty">
                <Sparkles />
                <span>Sélectionnez un adversaire pour afficher l’analyse.</span>
              </div>
            )}
          </section>
        </main>

        <section className="duel-start-panel">
          <div className="duel-mode-group">
            <small>Mode de match</small>
            <div>
              {modeOptions.map(({ id, label, duration, description, badge, Icon }) => (
                <button
                  aria-pressed={matchMode === id}
                  className={matchMode === id ? "is-active" : ""}
                  key={id}
                  onClick={() => setMatchMode(id)}
                  type="button"
                >
                  <Icon />
                  <span>
                    {badge ? <em>{badge}</em> : null}
                    <strong>{label}</strong>
                    <small>{duration}</small>
                    <i>{description}</i>
                  </span>
                  {matchMode === id ? <CheckCircle2 className="duel-mode-check" /> : null}
                </button>
              ))}
            </div>
          </div>
          <div className="duel-match-summary">
            <span>
              Format · <strong>2 sets gagnants</strong>
            </span>
            <span>
              <Zap /> Coût · <strong>1 énergie</strong>
            </span>
          </div>
          <div className="duel-launch-action">
            <button
              disabled={launching || !selectedOpponent || Boolean(activeSessionId)}
              onClick={() => void startMatch()}
              type="button"
            >
              {launching ? <LoaderCircle className="is-spinning" /> : <Play />}
              {launching ? "Préparation..." : "Lancer le duel"}
            </button>
            <small className={deckReady && player.actionEnergy >= 1 ? "is-ready" : ""}>
              {deckReady && player.actionEnergy >= 1 ? <CheckCircle2 /> : <HelpCircle />}
              {deckReady && player.actionEnergy >= 1
                ? "Joueur et deck prêts"
                : "Vérifiez l’énergie et le deck"}
            </small>
          </div>
        </section>

        {activeSessionId ? (
          <div className="duel-resume-banner">
            <span>
              <Play />
              <strong>Un match Coach Deck est déjà en cours.</strong>
            </span>
            <button onClick={() => navigate(`/match-live/${activeSessionId}`)} type="button">
              Reprendre le match
            </button>
          </div>
        ) : null}

        {message ? (
          <div className="duel-message" role="alert">
            <HelpCircle />
            <span>{message}</span>
            <button aria-label="Fermer le message" onClick={() => setMessage("")} type="button">
              <X />
            </button>
          </div>
        ) : null}
      </div>

      {showAllStats && selectedOpponent
        ? createPortal(
            <div className="duel-stats-overlay" onClick={() => setShowAllStats(false)}>
              <section className="duel-stats-modal" onClick={(event) => event.stopPropagation()}>
                <header>
                  <div>
                    <small>Analyse complète</small>
                    <h2>Comparaison des 12 statistiques</h2>
                  </div>
                  <button aria-label="Fermer" onClick={() => setShowAllStats(false)} type="button">
                    <X />
                  </button>
                </header>
                <div>
                  {duelStatKeys.map((key) => {
                    const Icon = statIcons[key];
                    return (
                      <article key={key}>
                        <Icon />
                        <span>{duelStatLabels[key]}</span>
                        <strong>{duelStat(player, key)}</strong>
                        <i>VS</i>
                        <strong>{duelStat(selectedOpponent, key)}</strong>
                      </article>
                    );
                  })}
                </div>
              </section>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
