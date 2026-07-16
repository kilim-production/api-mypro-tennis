import { useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowLeft,
  ArrowRight,
  BicepsFlexed,
  Check,
  Gauge,
  HelpCircle,
  Info,
  LoaderCircle,
  Lock,
  Plus,
  RefreshCw,
  Settings,
  Shield,
  Star,
  Target,
  Trophy,
  X
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api";
import { useGameStore, type Player } from "../../store";
import type { SkillState } from "./types";
import {
  careerMilestoneStates,
  skillProgressPercent,
  skillUpgradeState
} from "./skillsUtils";
import "./skills.css";

type StatVisual = {
  Icon: LucideIcon;
  color: string;
  glow: string;
  short: string;
};

type SkillsPageProps = {
  statKeys: readonly string[];
  getStatLabel: (key: string) => string;
  getStatVisual: (key: string) => StatVisual;
  resolveHeroSource: (avatar: string) => string | undefined;
};

function SkillsStatIcon({ visual, label }: { visual: StatVisual; label: string }) {
  const Icon = visual.Icon;
  return (
    <span
      className="skills-stat-icon"
      style={{ color: visual.color, boxShadow: `0 0 24px ${visual.glow}` }}
      title={label}
    >
      <Icon size={20} />
    </span>
  );
}

function StatsPanel({
  player,
  data,
  statKeys,
  selectedStat,
  busyStat,
  skillPoints,
  getStatLabel,
  getStatVisual,
  onSelect,
  onConfirm
}: {
  player: Player;
  data: SkillState | null;
  statKeys: readonly string[];
  selectedStat: string | null;
  busyStat: string | null;
  skillPoints: number;
  getStatLabel: (key: string) => string;
  getStatVisual: (key: string) => StatVisual;
  onSelect: (key: string) => void;
  onConfirm: () => void;
}) {
  const cap = data?.statCapPerSkill ?? 20;
  const selectedValue = selectedStat ? Math.round(stat(player, selectedStat)) : 0;
  const selectedAllocation = selectedStat ? (data?.allocations[selectedStat] ?? 0) : 0;
  const upgradeState = skillUpgradeState({
    dataReady: Boolean(data && selectedStat),
    busy: busyStat !== null,
    skillPoints,
    value: selectedValue,
    allocation: selectedAllocation,
    cap
  });

  return (
    <section className="skills-stats-panel" id="skills-statistics" aria-labelledby="skills-stats-title">
      <div className="skills-panel-title">
        <h2 id="skills-stats-title">12 STATISTIQUES</h2>
        <span>{skillPoints} PT DISPONIBLE{skillPoints > 1 ? "S" : ""}</span>
      </div>

      <div className="skills-stats-grid">
        {statKeys.map((key) => {
          const value = Math.round(stat(player, key));
          const allocated = data?.allocations[key] ?? 0;
          const visual = getStatVisual(key);
          const selected = selectedStat === key;
          const cappedBySkill = allocated >= cap;
          const cappedByStat = value >= 100;
          return (
            <button
              key={key}
              aria-label={`${getStatLabel(key)}, ${value}, ${allocated} points investis sur ${cap}`}
              aria-pressed={selected}
              className={`skills-stat-card ${selected ? "is-selected" : ""} ${
                cappedBySkill || cappedByStat ? "is-capped" : ""
              }`}
              onClick={() => onSelect(key)}
              type="button"
            >
              <div className="skills-stat-card-top">
                <SkillsStatIcon label={getStatLabel(key)} visual={visual} />
                <span className="skills-stat-identity">
                  <small>{getStatLabel(key)}</small>
                  <strong>{value}</strong>
                </span>
                <span className="skills-stat-plus" aria-hidden="true">
                  <b>+1</b>
                  <small>1 PT</small>
                </span>
              </div>
              <div className="skills-stat-investment">
                <small>INVESTI {allocated}/{cap}</small>
                <span>
                  <i style={{ width: `${Math.min(100, (allocated / Math.max(1, cap)) * 100)}%` }} />
                </span>
              </div>
            </button>
          );
        })}
      </div>

      <div className="skills-upgrade-bar">
        <div className="skills-selected-preview">
          {selectedStat ? (
            <>
              <SkillsStatIcon
                label={getStatLabel(selectedStat)}
                visual={getStatVisual(selectedStat)}
              />
              <span>
                <small>{getStatLabel(selectedStat)}</small>
                <strong>
                  {selectedValue} <ArrowRight aria-hidden="true" /> {Math.min(100, selectedValue + 1)}
                </strong>
              </span>
            </>
          ) : (
            <span>
              <small>SÉLECTION</small>
              <strong>CHOISISSEZ UNE STATISTIQUE</strong>
            </span>
          )}
        </div>
        <button disabled={upgradeState.disabled} onClick={onConfirm} type="button">
          {upgradeState.label}
        </button>
      </div>
    </section>
  );
}

const careerIcons: LucideIcon[] = [Target, Gauge, BicepsFlexed, Shield, Trophy];

function CareerPanel({
  player,
  data,
  level,
  getStatLabel
}: {
  player: Player;
  data: SkillState | null;
  level: number;
  getStatLabel: (key: string) => string;
}) {
  const milestones = data?.milestoneLevels ?? [10, 25, 50, 75, 100];
  const perks = data?.perks ?? [];
  const careerProgress = careerMilestoneStates(level, milestones);
  const nextMilestone = careerProgress.nextMilestone;
  const highlightedPerk =
    (nextMilestone === null
      ? perks[perks.length - 1]
      : perks.find((perk) => perk.level === nextMilestone)) ?? null;
  const highlightedIndex = Math.max(
    0,
    milestones.findIndex((milestone) => milestone === (highlightedPerk?.level ?? nextMilestone))
  );
  const HighlightedIcon = careerIcons[highlightedIndex] ?? Trophy;
  const activeBonusTotal = Object.values(data?.activeMatchBonuses ?? {}).reduce(
    (sum, value) => sum + value,
    0
  );
  const archetype = data?.archetype ?? player.archetype;
  const allUnlocked = careerProgress.allUnlocked;

  return (
    <section className="skills-career-panel" aria-labelledby="skills-career-title">
      <h2 id="skills-career-title">PALIERS DE CARRIÈRE</h2>

      <div className="skills-career-summary">
        <Target aria-hidden="true" />
        <span>
          <strong>
            ARCHÉTYPE <i>· {archetype}</i>
          </strong>
          <b>{activeBonusTotal} BONUS ACTIFS</b>
          <small>BONUS AUTOMATIQUES EN MATCH</small>
        </span>
      </div>

      <div className="skills-milestone-list">
        {careerProgress.milestones.map(({ milestone, state }, index) => {
          const perk = perks.find((item) => item.level === milestone);
          const unlocked = state === "unlocked";
          const isNext = state === "next";
          const Icon = careerIcons[index] ?? Trophy;
          return (
            <div
              key={milestone}
              className={`skills-milestone-row ${unlocked ? "is-unlocked" : ""} ${
                isNext ? "is-next" : ""
              }`}
            >
              <div className="skills-milestone-level">
                <span className="skills-milestone-node" aria-hidden="true" />
                <strong>NIV. {milestone}</strong>
                {unlocked ? (
                  <span className="skills-milestone-state" title="Débloqué">
                    <Check aria-hidden="true" />
                  </span>
                ) : !isNext ? (
                  <span className="skills-milestone-state" title="Verrouillé">
                    <Lock aria-hidden="true" />
                  </span>
                ) : null}
              </div>
              <div className="skills-milestone-perk">
                <Icon aria-hidden="true" />
                <span>{perk?.title ?? "AVANTAGE À DÉCOUVRIR"}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className={`skills-next-perk ${allUnlocked ? "is-complete" : ""}`}>
        <div className="skills-next-perk-icon">
          {allUnlocked ? <Trophy aria-hidden="true" /> : <HighlightedIcon aria-hidden="true" />}
        </div>
        <span>
          <strong>
            {allUnlocked ? "TOUS LES PALIERS DÉBLOQUÉS" : highlightedPerk?.title ?? "PROCHAIN AVANTAGE"}
          </strong>
          {highlightedPerk ? (
            <b>
              {Object.entries(highlightedPerk.bonuses)
                .map(([key, value]) => `+${value} ${getStatLabel(key).toUpperCase()}`)
                .join("  ·  ")}
            </b>
          ) : (
            <b>PROGRESSION DE CARRIÈRE MAXIMALE</b>
          )}
          <small>
            {allUnlocked
              ? "TOUS LES BONUS SONT ACTIFS"
              : `DÉBLOCAGE AU NIVEAU ${highlightedPerk?.level ?? nextMilestone ?? 100}`}
          </small>
        </span>
      </div>

      <div className="skills-career-info">
        <Info aria-hidden="true" />
        <span>Les bonus de carrière sont passifs et ne consomment aucun point de compétence.</span>
      </div>
    </section>
  );
}

function PlayerProgressPanel({
  player,
  data,
  progressPercent,
  level,
  skillPoints,
  heroSource
}: {
  player: Player;
  data: SkillState | null;
  progressPercent: number;
  level: number;
  skillPoints: number;
  heroSource: string;
}) {
  const progress = data?.progress;
  const activeBonusTotal = Object.values(data?.activeMatchBonuses ?? {}).reduce(
    (sum, value) => sum + value,
    0
  );
  const archetype = data?.archetype ?? player.archetype;
  const atMaxLevel = level >= (data?.maxLevel ?? 100);

  return (
    <section className="skills-player-panel" aria-labelledby="skills-player-title">
      <h2 id="skills-player-title">PROGRESSION DU JOUEUR</h2>
      <div className="skills-player-spotlight" />
      <img
        alt={player.name}
        className="skills-player-hero"
        decoding="async"
        draggable={false}
        fetchPriority="high"
        src={heroSource}
      />

      <div className="skills-rank-badge" aria-label={`Niveau ${level}`}>
        <div>
          <span>NIV.</span>
          <strong>{level}</strong>
        </div>
      </div>

      <div className="skills-player-data">
        <div className="skills-xp-block">
          <strong>
            {(progress?.xpIntoLevel ?? 0).toLocaleString("fr-FR")} /{" "}
            {(progress?.xpNeeded ?? 0).toLocaleString("fr-FR")} XP
          </strong>
          <div className="skills-xp-track" aria-hidden="true">
            <span style={{ width: `${progressPercent}%` }} />
          </div>
          <small>
            {atMaxLevel
              ? "NIVEAU MAXIMUM ATTEINT"
              : `${(progress?.remaining ?? 0).toLocaleString("fr-FR")} XP AVANT LE NIVEAU ${level + 1}`}
          </small>
        </div>

        <div className="skills-point-counters">
          <div className="is-available">
            <strong>{skillPoints}</strong>
            <span>POINTS<br />DISPONIBLES</span>
          </div>
          <div>
            <strong>{data?.spentSkillPoints ?? player.spentSkillPoints}</strong>
            <span>POINTS<br />DÉPENSÉS</span>
          </div>
        </div>

        <div className="skills-archetype-plate">
          <Target aria-hidden="true" />
          <span>
            <small>ARCHÉTYPE</small>
            <strong>{archetype}</strong>
          </span>
        </div>

        <div className="skills-active-bonus">
          <Star aria-hidden="true" />
          <strong>{activeBonusTotal} BONUS ACTIFS</strong>
        </div>
      </div>
    </section>
  );
}

function SkillsHeader({ level, skillPoints }: { level: number; skillPoints: number }) {
  const navigate = useNavigate();

  function openSkills() {
    document.getElementById("skills-statistics")?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      block: "start"
    });
  }

  return (
    <header className="skills-header">
      <button
        aria-label="Retour au hub"
        className="skills-icon-button skills-back"
        onClick={() => navigate("/dashboard")}
        type="button"
      >
        <ArrowLeft aria-hidden="true" />
      </button>

      <div className="skills-brand" aria-label="MyPro Tennis">
        <strong>MYPRO</strong>
        <span>TENNIS</span>
      </div>
      <h1>COMPÉTENCES</h1>

      <div className="skills-header-actions">
        <div className="skills-level-resource" aria-label={`Niveau ${level}`}>
          <span className="skills-level-hex">
            <Shield aria-hidden="true" />
            <b>{level}</b>
          </span>
          <span>
            <small>NIV.</small>
            <strong>{level}</strong>
          </span>
        </div>

        <div className="skills-points-resource" aria-label={`${skillPoints} points disponibles`}>
          <strong>{skillPoints}</strong>
          <span>POINTS</span>
          <button aria-label="Voir les statistiques à améliorer" onClick={openSkills} type="button">
            <Plus aria-hidden="true" />
          </button>
        </div>

        <button
          aria-label="Ouvrir l'aide"
          className="skills-icon-button"
          onClick={() => {
            localStorage.setItem("mypro-tutorial-active", "1");
            navigate("/dashboard");
          }}
          type="button"
        >
          <HelpCircle aria-hidden="true" />
        </button>
        <button
          aria-label="Ouvrir les réglages"
          className="skills-icon-button"
          onClick={() => navigate("/settings")}
          type="button"
        >
          <Settings aria-hidden="true" />
        </button>
        <button
          aria-label="Fermer la page Compétences"
          className="skills-icon-button"
          onClick={() => navigate("/dashboard")}
          type="button"
        >
          <X aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}

const stat = (player: Player, key: string) => player.stats[key] ?? 0;

export function SkillsPage({
  statKeys,
  getStatLabel,
  getStatVisual,
  resolveHeroSource
}: SkillsPageProps) {
  const player = useGameStore((state) => state.player)!;
  const refreshPlayer = useGameStore((state) => state.refresh);
  const [data, setData] = useState<SkillState | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [busyStat, setBusyStat] = useState<string | null>(null);
  const [selectedStat, setSelectedStat] = useState<string | null>(statKeys[0] ?? null);
  const [message, setMessage] = useState<{
    text: string;
    tone: "success" | "error";
  } | null>(null);

  async function loadSkills() {
    setLoading(true);
    setLoadError("");
    try {
      setData(await api<SkillState>("/skills"));
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : "Impossible de charger les compétences."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => void loadSkills(), []);

  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(null), message.tone === "error" ? 5200 : 3200);
    return () => window.clearTimeout(timer);
  }, [message]);

  async function spendPoint(statKey: string) {
    setBusyStat(statKey);
    setMessage(null);
    try {
      setData(
        await api<SkillState>("/skills/spend", {
          method: "POST",
          body: JSON.stringify({ statKey })
        })
      );
      await refreshPlayer();
      setMessage({ text: `${getStatLabel(statKey)} gagne +1.`, tone: "success" });
    } catch (error) {
      setMessage({
        text: error instanceof Error ? error.message : "Amélioration impossible.",
        tone: "error"
      });
    } finally {
      setBusyStat(null);
    }
  }

  const progress = data?.progress;
  const progressPercent = progress
    ? skillProgressPercent(progress.xpIntoLevel, progress.xpNeeded)
    : 0;
  const skillPoints = data?.skillPoints ?? player.skillPoints;
  const level = data?.level ?? player.playerLevel;
  const heroSource =
    resolveHeroSource(player.avatar) ?? "/visuals/players/pp-02-hero.webp";

  return (
    <div className="skills-cinematic">
      <section className="skills-stage">
        <SkillsHeader level={level} skillPoints={skillPoints} />
        <div className="skills-workspace">
          <PlayerProgressPanel
            data={data}
            heroSource={heroSource}
            level={level}
            player={player}
            progressPercent={progressPercent}
            skillPoints={skillPoints}
          />
          <StatsPanel
            busyStat={busyStat}
            data={data}
            getStatLabel={getStatLabel}
            getStatVisual={getStatVisual}
            onConfirm={() => selectedStat && void spendPoint(selectedStat)}
            onSelect={setSelectedStat}
            player={player}
            selectedStat={selectedStat}
            skillPoints={skillPoints}
            statKeys={statKeys}
          />
          <CareerPanel data={data} getStatLabel={getStatLabel} level={level} player={player} />
        </div>
        {message ? (
          <div
            aria-live="polite"
            className={`skills-feedback-toast is-${message.tone}`}
            role={message.tone === "error" ? "alert" : "status"}
          >
            {message.text}
          </div>
        ) : null}
        {loading ? (
          <div className="skills-load-banner" aria-live="polite" role="status">
            <LoaderCircle aria-hidden="true" />
            <span>CHARGEMENT DES COMPÉTENCES...</span>
          </div>
        ) : loadError ? (
          <div className="skills-load-banner is-error" role="alert">
            <span>{loadError}</span>
            <button onClick={() => void loadSkills()} type="button">
              <RefreshCw aria-hidden="true" /> RÉESSAYER
            </button>
          </div>
        ) : null}
      </section>
    </div>
  );
}
