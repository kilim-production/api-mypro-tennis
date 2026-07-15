import { useState } from "react";
import {
  Activity,
  ArrowLeft,
  Check,
  Eye,
  HeartPulse,
  Layers3,
  ShieldCheck,
  Sparkles,
  Target,
  Trophy,
  Zap
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useGameStore } from "../../store";

type TutorialCardFamily = "BOOST" | "COUNTER" | "STATE" | "DECK";

type TutorialCard = {
  id: string;
  family: TutorialCardFamily;
  name: string;
  description: string;
  focusCost: number;
  stats: string[];
  chanceAfter: number;
};

export type CoachDeckTutorialStep = {
  id: string;
  eyebrow: string;
  title: string;
  objective: string;
  intention: string;
  intentionDetail: string;
  targetStats: string[];
  playerStatKey: string;
  playerStatLabel: string;
  opponentStatLabel: string;
  opponentStatValue: number;
  chanceBefore: number;
  correctChoiceId: string;
  focusBefore: number;
  focusAfter: number;
  success: string;
  wrong: string;
  score: { sets: [number, number]; games: [number, number]; points: [string, string] };
  cards: TutorialCard[];
};

export const COACH_DECK_TUTORIAL_STEPS: readonly CoachDeckTutorialStep[] = [
  {
    id: "read-intent",
    eyebrow: "Décision 1 · Lire le plan adverse",
    title: "Répondez à la zone attaquée",
    objective:
      "L’adversaire cible votre revers. Trouvez la carte qui protège précisément cette statistique.",
    intention: "Cibler votre revers",
    intentionDetail: "L’adversaire veut enfermer les prochains échanges sur votre revers.",
    targetStats: ["Revers", "Vitesse"],
    playerStatKey: "backhand",
    playerStatLabel: "Revers",
    opponentStatLabel: "Coup droit adverse",
    opponentStatValue: 62,
    chanceBefore: 43,
    correctChoiceId: "protect-backhand",
    focusBefore: 5,
    focusAfter: 3,
    success:
      "Contre direct réussi : votre revers est renforcé pendant la séquence et la pression adverse est réduite.",
    wrong:
      "Cette carte peut être utile, mais elle ne répond pas à la zone attaquée. Cherchez la carte Contre liée au revers.",
    score: { sets: [0, 0], games: [1, 1], points: ["30", "40"] },
    cards: [
      {
        id: "power-forehand",
        family: "BOOST",
        name: "Coup droit puissant",
        description: "Renforce votre coup droit, mais ne protège pas la cible adverse.",
        focusCost: 2,
        stats: ["Coup droit", "Force"],
        chanceAfter: 45
      },
      {
        id: "protect-backhand",
        family: "COUNTER",
        name: "Protéger le revers",
        description: "Réponse directe lorsque l’adversaire insiste sur votre revers.",
        focusCost: 2,
        stats: ["Revers", "Vitesse"],
        chanceAfter: 50
      },
      {
        id: "stay-calm",
        family: "STATE",
        name: "Rester calme",
        description: "Stabilise la confiance sans corriger la cible tactique.",
        focusCost: 1,
        stats: ["Confiance"],
        chanceAfter: 44
      },
      {
        id: "read-the-game",
        family: "DECK",
        name: "Lire le jeu",
        description: "Prépare la prochaine main sans répondre à la cible actuelle.",
        focusCost: 1,
        stats: ["Pioche", "Lecture"],
        chanceAfter: 43
      }
    ]
  },
  {
    id: "protect-energy",
    eyebrow: "Décision 2 · Gérer le physique",
    title: "Préparez les prochains jeux",
    objective:
      "Votre énergie est basse et l’adversaire veut allonger les échanges. Choisissez une réponse physique.",
    intention: "Allonger les échanges",
    intentionDetail: "L’adversaire teste votre endurance et votre récupération.",
    targetStats: ["Endurance", "Récupération"],
    playerStatKey: "recovery",
    playerStatLabel: "Récupération",
    opponentStatLabel: "Endurance adverse",
    opponentStatValue: 66,
    chanceBefore: 46,
    correctChoiceId: "second-wind",
    focusBefore: 3,
    focusAfter: 2,
    success:
      "Bon timing : l’énergie remonte avant les longs échanges. La carte ne garantit pas le point, mais évite l’effondrement physique.",
    wrong:
      "La priorité est votre énergie. Cherchez la carte État qui rend du souffle avant la séquence longue.",
    score: { sets: [0, 0], games: [4, 4], points: ["15", "15"] },
    cards: [
      {
        id: "power-serve",
        family: "BOOST",
        name: "Service canon",
        description: "Cherche un point court, mais ne restaure pas votre énergie.",
        focusCost: 2,
        stats: ["Service", "Force"],
        chanceAfter: 49
      },
      {
        id: "second-wind",
        family: "STATE",
        name: "Second souffle",
        description: "Récupère de l’énergie et soutient les échanges à venir.",
        focusCost: 1,
        stats: ["Endurance", "Récupération"],
        chanceAfter: 50
      },
      {
        id: "read-the-game",
        family: "DECK",
        name: "Lire le jeu",
        description: "Prépare la prochaine main, sans régler l’urgence physique.",
        focusCost: 1,
        stats: ["Lecture"],
        chanceAfter: 46
      },
      {
        id: "break-the-rhythm",
        family: "COUNTER",
        name: "Casser le rythme",
        description: "Réduit la construction adverse sans restaurer votre énergie.",
        focusCost: 2,
        stats: ["Amortie", "Récupération"],
        chanceAfter: 49
      }
    ]
  },
  {
    id: "save-focus",
    eyebrow: "Décision 3 · Choisir son moment",
    title: "Le meilleur choix peut être d’attendre",
    objective:
      "L’intention est peu dangereuse et il reste seulement 2 Focus. Gardez vos cartes pour un point décisif.",
    intention: "Variation prudente",
    intentionDetail: "L’adversaire varie sans prendre beaucoup de risque. Intensité faible.",
    targetStats: ["Amortie", "Vitesse"],
    playerStatKey: "speed",
    playerStatLabel: "Vitesse",
    opponentStatLabel: "Amortie adverse",
    opponentStatValue: 51,
    chanceBefore: 54,
    correctChoiceId: "PASS",
    focusBefore: 2,
    focusAfter: 2,
    success:
      "Bonne gestion : aucun Focus dépensé. Votre main sera renouvelée et vos réponses fortes restent disponibles pour la prochaine alerte.",
    wrong:
      "Votre joueur possède déjà l’avantage sur cette séquence. Économisez le Focus avec « Laisser jouer ».",
    score: { sets: [1, 0], games: [2, 1], points: ["40", "15"] },
    cards: [
      {
        id: "aggressive-return",
        family: "BOOST",
        name: "Retour agressif",
        description: "Puissant, mais inutile lorsque vous êtes déjà en bonne position.",
        focusCost: 2,
        stats: ["Retour", "Vitesse"],
        chanceAfter: 58
      },
      {
        id: "break-the-rhythm",
        family: "COUNTER",
        name: "Casser le rythme",
        description: "Un contre possible, mais trop coûteux face à une menace faible.",
        focusCost: 2,
        stats: ["Amortie", "Récupération"],
        chanceAfter: 60
      },
      {
        id: "prepare-next-point",
        family: "DECK",
        name: "Préparer le point",
        description: "Améliore la prochaine main au prix de votre dernier Focus utile.",
        focusCost: 1,
        stats: ["Pioche"],
        chanceAfter: 54
      },
      {
        id: "stay-calm",
        family: "STATE",
        name: "Rester calme",
        description: "Stabilise la confiance, mais dépense une ressource encore utile.",
        focusCost: 1,
        stats: ["Confiance"],
        chanceAfter: 55
      }
    ]
  }
] as const;

export function evaluateCoachDeckTutorialChoice(stepIndex: number, choiceId: string | null) {
  const step = COACH_DECK_TUTORIAL_STEPS[stepIndex];
  if (!step || choiceId === null)
    return { correct: false, message: "Choisissez une action avant de confirmer." };
  return choiceId === step.correctChoiceId
    ? { correct: true, message: step.success }
    : { correct: false, message: step.wrong };
}

const familyLabels: Record<TutorialCardFamily, string> = {
  BOOST: "Boost",
  COUNTER: "Contre",
  STATE: "État",
  DECK: "Deck"
};

function CardIcon({ family, diagram = false }: { family: TutorialCardFamily; diagram?: boolean }) {
  if (family === "BOOST") return <Zap className={diagram ? "coach-deck-diagram-symbol" : ""} />;
  if (family === "COUNTER")
    return <ShieldCheck className={diagram ? "coach-deck-diagram-symbol" : ""} />;
  if (family === "STATE")
    return <HeartPulse className={diagram ? "coach-deck-diagram-symbol" : ""} />;
  return <Eye className={diagram ? "coach-deck-diagram-symbol" : ""} />;
}

const statKeys = [
  "service",
  "return",
  "forehand",
  "backhand",
  "volley",
  "smash",
  "dropShot",
  "stamina",
  "speed",
  "explosiveness",
  "strength",
  "recovery"
] as const;

const statLabels: Record<(typeof statKeys)[number], string> = {
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

const fallbackStats: Record<(typeof statKeys)[number], number> = {
  service: 58,
  return: 56,
  forehand: 61,
  backhand: 55,
  volley: 51,
  smash: 54,
  dropShot: 49,
  stamina: 57,
  speed: 60,
  explosiveness: 58,
  strength: 59,
  recovery: 55
};

const opponentStats: Record<(typeof statKeys)[number], number> = {
  service: 62,
  return: 58,
  forehand: 63,
  backhand: 52,
  volley: 57,
  smash: 56,
  dropShot: 51,
  stamina: 66,
  speed: 59,
  explosiveness: 61,
  strength: 64,
  recovery: 60
};

type CoachDeckTutorialPageProps = {
  resolveHeroSource: (avatar: string) => string | undefined;
  resolvePictureSource: (avatar: string) => string;
};

export function CoachDeckTutorialPage({
  resolveHeroSource,
  resolvePictureSource
}: CoachDeckTutorialPageProps) {
  const navigate = useNavigate();
  const player = useGameStore((state) => state.player);
  const [stepIndex, setStepIndex] = useState(0);
  const [selectedChoiceId, setSelectedChoiceId] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [completed, setCompleted] = useState(false);
  const step = COACH_DECK_TUTORIAL_STEPS[stepIndex]!;
  const selectedCard = step.cards.find((card) => card.id === selectedChoiceId) ?? null;
  const isPass = selectedChoiceId === "PASS";
  const displayedChance = isPass
    ? step.chanceBefore
    : (selectedCard?.chanceAfter ?? step.chanceBefore);
  const currentFocus = confirmed ? step.focusAfter : step.focusBefore;
  const energy =
    stepIndex === 0 ? 72 : stepIndex === 1 ? (confirmed ? 61 : 48) : confirmed ? 64 : 61;
  const confidence = stepIndex === 0 ? 62 : stepIndex === 1 ? 55 : 68;
  const momentum = stepIndex === 0 ? 0 : stepIndex === 1 ? -18 : 16;
  const playerName = player
    ? `${player.firstName} ${player.lastName}`.trim() || player.name
    : "Votre joueur";
  const playerHero = player
    ? (resolveHeroSource(player.avatar) ?? resolvePictureSource(player.avatar))
    : "/visuals/players/pp-01-hero.webp";
  const playerPicture = player
    ? resolvePictureSource(player.avatar)
    : "/profile-pictures/pp-01.jpg";
  const playerRanking = player?.fftRanking ?? "30/4";
  const playerStat = (key: (typeof statKeys)[number]) =>
    Math.round(player?.stats[key] ?? fallbackStats[key]);
  const targetedStats = new Set(step.targetStats);

  function choose(choiceId: string) {
    if (confirmed) return;
    setSelectedChoiceId(choiceId);
    setFeedback("");
  }

  function confirmChoice() {
    if (confirmed) {
      if (stepIndex >= COACH_DECK_TUTORIAL_STEPS.length - 1) {
        localStorage.setItem("mypro-coach-deck-tutorial-done", "1");
        setCompleted(true);
        return;
      }
      setStepIndex((current) => current + 1);
      setSelectedChoiceId(null);
      setConfirmed(false);
      setFeedback("");
      return;
    }
    const result = evaluateCoachDeckTutorialChoice(stepIndex, selectedChoiceId);
    setFeedback(result.message);
    if (result.correct) setConfirmed(true);
  }

  return (
    <main className="interactive-match-screen is-coach-deck coach-deck-guided-tutorial">
      <div className="interactive-arena-layer" aria-hidden="true" />
      <header className="interactive-match-header">
        <div className="interactive-match-brand" aria-label="MYPRO TENNIS">
          <strong>MYPRO</strong>
          <span>TENNIS</span>
        </div>
        <section className="interactive-scoreboard" aria-label="Score du match tutoriel">
          <div className="interactive-score-player is-left">
            <img alt="" src={playerPicture} />
            <span>
              <strong>{playerName}</strong>
              <small>{playerRanking}</small>
            </span>
          </div>
          <div className="interactive-score-center">
            <div className="interactive-set-score">
              <strong>{step.score.sets[0]}</strong>
              <span>SETS</span>
              <strong>{step.score.sets[1]}</strong>
            </div>
            <div className="interactive-game-score">
              <strong>{step.score.games[0]}</strong>
              <span>JEUX</span>
              <strong>{step.score.games[1]}</strong>
            </div>
            <div className="interactive-point-score">
              <strong>{step.score.points[0]}</strong>
              <span>POINTS</span>
              <strong>{step.score.points[1]}</strong>
            </div>
            <em>Décision tutoriel {stepIndex + 1}/3</em>
          </div>
          <div className="interactive-score-player is-right">
            <span>
              <strong>Camille Durand</strong>
              <small>30/2</small>
            </span>
            <img alt="" src="/profile-pictures/pp-06.jpg" />
          </div>
        </section>
      </header>

      <section className="interactive-match-stage">
        <div className="interactive-player-hero interactive-player-left" aria-hidden="true">
          <div className="interactive-player-aura" />
          <img alt="" draggable={false} src={playerHero} />
        </div>
        <div className="interactive-player-hero interactive-player-right" aria-hidden="true">
          <div className="interactive-player-aura" />
          <img alt="" draggable={false} src="/visuals/players/pp-06-hero.webp" />
        </div>

        <aside className="coach-deck-player-dashboard">
          <section className="coach-deck-player-vitals">
            <div>
              <span>
                <Zap /> Énergie
              </span>
              <strong>{energy}/100</strong>
              <i>
                <b style={{ width: `${energy}%` }} />
              </i>
            </div>
            <div>
              <span>
                <ShieldCheck /> Confiance
              </span>
              <strong>{confidence}</strong>
              <i>
                <b style={{ width: `${confidence}%` }} />
              </i>
            </div>
            <div className="is-momentum">
              <span>
                <Activity /> Momentum
              </span>
              <strong>
                {momentum < -7
                  ? "Sous pression"
                  : momentum > 7
                    ? "Dynamique positive"
                    : "Match équilibré"}
              </strong>
              <i>
                {Array.from({ length: 5 }, (_, index) => (
                  <b
                    className={
                      index < Math.max(1, Math.min(5, Math.round((momentum + 50) / 20)))
                        ? "is-filled"
                        : ""
                    }
                    key={index}
                  />
                ))}
              </i>
            </div>
          </section>
          <section className="coach-deck-stat-comparison">
            <h2>Comparaison 12 stats</h2>
            {statKeys.map((key) => {
              const ownValue = playerStat(key);
              const rivalValue = opponentStats[key];
              return (
                <div className={targetedStats.has(statLabels[key]) ? "is-targeted" : ""} key={key}>
                  <b>{ownValue}</b>
                  <span>{statLabels[key]}</span>
                  <i>
                    <em style={{ width: `${ownValue}%` }} />
                    <em style={{ width: `${rivalValue}%` }} />
                  </i>
                  <b>{rivalValue}</b>
                </div>
              );
            })}
          </section>
        </aside>

        <aside className="coach-deck-opponent-scouting">
          <h2>Scouting adversaire</h2>
          <section className="coach-deck-opponent-level">
            <small>Niveau</small>
            <div>
              <b>30/2</b>
              <strong>Niv. 8</strong>
            </div>
          </section>
          <section className="coach-deck-scout-block is-strength">
            <small>Point fort</small>
            <strong>Endurance</strong>
            <span>66</span>
            <Zap />
          </section>
          <section className="coach-deck-scout-block is-weakness">
            <small>Point faible</small>
            <strong>Amortie</strong>
            <span>51</span>
            <Target />
          </section>
          <section className="coach-deck-opponent-style">
            <small>Style de jeu</small>
            <strong>Joueuse de fond</strong>
            <div aria-hidden="true">
              <i />
              <i />
              <i />
              <span />
              <span />
            </div>
          </section>
        </aside>

        <div className="interactive-court-perspective" aria-hidden="true">
          <span className="interactive-court-center-line" />
          <span className="interactive-court-service-line" />
          <span className="interactive-court-ball" />
        </div>

        <section className="coach-deck-intent-banner">
          <Target className="coach-deck-intent-icon" />
          <span>INTENTION ADVERSE</span>
          <strong>{step.intention}</strong>
          <small>{step.intentionDetail}</small>
          <em>Intensité {stepIndex === 2 ? "1/3" : stepIndex === 1 ? "3/3" : "2/3"}</em>
        </section>
      </section>

      <section className="coach-deck-match-dock">
        <header className="coach-deck-dock-header">
          <span>
            <strong>VOTRE MAIN</strong>
            <small>Choisissez une carte ou laissez jouer</small>
          </span>
          <div className="coach-deck-focus" aria-label={`${currentFocus} Focus disponible`}>
            <em>FOCUS</em>
            {Array.from({ length: 5 }, (_, index) => (
              <i className={index < currentFocus ? "is-filled" : ""} key={index} />
            ))}
            <b>{currentFocus}/5</b>
          </div>
        </header>

        <div
          className="coach-deck-hand"
          style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}
        >
          {step.cards.map((card) => {
            const selected = selectedChoiceId === card.id;
            const showAnswer = Boolean(feedback) && !confirmed && card.id === step.correctChoiceId;
            return (
              <button
                aria-pressed={selected}
                className={`coach-deck-match-card is-${card.family.toLowerCase()} ${selected ? "is-selected" : ""} ${showAnswer ? "is-tutorial-answer" : ""}`}
                disabled={confirmed}
                key={card.id}
                onClick={() => choose(card.id)}
                type="button"
              >
                <span className="coach-deck-card-family">
                  <CardIcon family={card.family} /> {familyLabels[card.family]}
                </span>
                {selected ? (
                  <span className="coach-deck-card-selected">
                    <Check /> Votre choix
                  </span>
                ) : null}
                <strong>{card.name}</strong>
                <small>{card.description}</small>
                <span className="coach-deck-card-diagram" aria-hidden="true">
                  <CardIcon diagram family={card.family} />
                  <i />
                  <i />
                  <i />
                  <em />
                  <em />
                </span>
                <span className="coach-deck-card-effects">
                  <em>{card.stats.join(" + ")}</em>
                  <em>
                    {card.chanceAfter - step.chanceBefore >= 0 ? "+" : ""}
                    {card.chanceAfter - step.chanceBefore} pt(s)
                  </em>
                </span>
                <span className="coach-deck-card-footer">
                  <em>Prochaine séquence</em>
                  <b>
                    <Sparkles /> {card.focusCost}
                  </b>
                </span>
              </button>
            );
          })}
        </div>

        {selectedCard || isPass ? (
          <div className="coach-deck-selected-effect">
            <strong>{isPass ? "FOCUS CONSERVÉ" : selectedCard?.name}</strong>
            <small>
              {step.chanceBefore} → {displayedChance} % ·{" "}
              {isPass ? "0 Focus" : `${selectedCard?.focusCost} Focus`}
            </small>
          </div>
        ) : null}

        <aside
          className={`coach-deck-selection-preview ${selectedCard || isPass ? "has-selection" : ""}`}
        >
          <div>
            <small>DÉCISION ACTUELLE</small>
            <strong>{selectedCard?.name ?? (isPass ? "Laisser jouer" : "Aucun choix")}</strong>
            <span>La décision est appliquée après confirmation.</span>
          </div>
          <div className="coach-deck-chance-preview">
            <span>
              <small>Avant</small>
              <b>{step.chanceBefore}%</b>
            </span>
            <em>→</em>
            <span className="is-after">
              <small>Avec le choix</small>
              <b>{displayedChance}%</b>
            </span>
          </div>
          <div className="coach-deck-decision-actions">
            <button
              className={`is-confirm ${confirmed ? "is-tutorial-continue" : ""}`}
              disabled={selectedChoiceId === null}
              onClick={confirmChoice}
              type="button"
            >
              <span>{confirmed ? (stepIndex === 2 ? "TERMINER" : "CONTINUER") : "CONFIRMER"}</span>
              <small>
                {selectedCard?.name ?? (isPass ? "Focus conservé" : "Choisissez une action")}
              </small>
            </button>
            <button
              className={`${isPass ? "is-selected" : ""} ${feedback && !confirmed && step.correctChoiceId === "PASS" ? "is-tutorial-answer" : ""}`}
              disabled={confirmed}
              onClick={() => choose("PASS")}
              type="button"
            >
              Laisser jouer
            </button>
          </div>
        </aside>
      </section>

      <aside className="coach-deck-tutorial-match-guide">
        <button aria-label="Quitter le tutoriel" onClick={() => navigate(-1)} type="button">
          <ArrowLeft />
        </button>
        <section>
          <span>TUTORIEL · {stepIndex + 1}/3</span>
          <strong>{step.title}</strong>
          <small>{step.objective}</small>
        </section>
        <div>
          {COACH_DECK_TUTORIAL_STEPS.map((item, index) => (
            <i className={index <= stepIndex ? "is-active" : ""} key={item.id} />
          ))}
        </div>
        {feedback ? (
          <article
            aria-live="polite"
            className={`coach-deck-tutorial-feedback ${confirmed ? "is-success" : "is-guidance"}`}
          >
            <span>
              {confirmed ? <Check /> : <Eye />}
              {confirmed ? "BONNE DÉCISION" : "CONSEIL DU COACH"}
            </span>
            <strong>{confirmed ? "Action validée" : "Observez la situation"}</strong>
            <p>{feedback}</p>
            <small>
              {confirmed
                ? "Utilisez CONTINUER pour passer au prochain moment du match."
                : "La réponse adaptée est maintenant encadrée en jaune."}
            </small>
          </article>
        ) : null}
      </aside>

      {completed ? (
        <div className="interactive-dialog-overlay interactive-result-overlay coach-deck-tutorial-result">
          <section className="interactive-dialog-panel interactive-result-panel">
            <Trophy />
            <p>Match tutoriel terminé</p>
            <h2>VICTOIRE</h2>
            <strong>6-4 6-3</strong>
            <span>Vous avez coaché les trois moments clés du match.</span>
            <div className="coach-deck-tutorial-result-checklist">
              <span>
                <Check /> Lire l’intention
              </span>
              <span>
                <Check /> Relier les statistiques
              </span>
              <span>
                <Check /> Comparer avant/après
              </span>
              <span>
                <Check /> Conserver le Focus
              </span>
            </div>
            <div>
              <button onClick={() => navigate("/collection/coach-deck")} type="button">
                <Layers3 /> Voir mon deck
              </button>
              <button className="is-primary" onClick={() => navigate("/duel")} type="button">
                <Zap /> Jouer un vrai match
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
