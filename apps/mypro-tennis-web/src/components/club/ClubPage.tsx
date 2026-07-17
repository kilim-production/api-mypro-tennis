import { useEffect, useRef, useState } from "react";
import type React from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  Coins,
  CreditCard,
  Crown,
  Dumbbell,
  Eye,
  HeartPulse,
  HelpCircle,
  Inbox,
  LogOut,
  Search,
  Settings,
  Shield,
  Sparkles,
  Trophy,
  UserCheck,
  UserX,
  Users,
  X
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { countryLabel } from "@mypro/shared";
import { api } from "../../api";
import { useGameStore } from "../../store";
import {
  buildingEffectLabel,
  buildingLevelImage,
  buildingUpgradePath,
  championshipPreviewStandings,
  clubBuildingForClub,
  clubBuildingUpgradeEligibility,
  clubCanAcceptRequest,
  clubChampionshipVisualState,
  clubDepartureMode,
  clubDuesVisualState,
  clubJoinAvailability,
  clubDuesAmount,
  clubTeamReadiness,
  fallbackDuesState,
  fftIndex,
  fftPath,
  formatCredits
} from "./clubUtils";
import type {
  ClubBuilding,
  ClubDetails,
  ClubLeaveResponse,
  ClubListItem,
  ClubTab,
  MyClubData,
  TeamChampionshipData,
  TeamChampionshipEntry,
  TeamChampionshipMeeting,
  TeamChampionshipSingle
} from "./types";
import "./club.css";

type AvatarPicture = { kind: "preset"; id: string } | { kind: "upload"; dataUrl: string };
type PictureAvatarPayload = {
  type: "picture-v1";
  initials: string;
  picture: AvatarPicture;
};
type StoredAvatarPayload = {
  type?: string;
  initials?: string;
  picture?: AvatarPicture;
};
type ClubCreationForm = {
  name: string;
  tag: string;
  description: string;
  minimumRanking: string;
  duesAmount: number;
};
type ClubJoinResponse = {
  request: {
    id: string;
    message: string;
    createdAt: string;
  };
};

const personalPictures = [
  { id: "pp-01", image: "/profile-pictures/pp-01.jpg" },
  { id: "pp-02", image: "/profile-pictures/pp-02.jpg" },
  { id: "pp-03", image: "/profile-pictures/pp-03.jpg" },
  { id: "pp-04", image: "/profile-pictures/pp-04.jpg" },
  { id: "pp-05", image: "/profile-pictures/pp-05.jpg" },
  { id: "pp-06", image: "/profile-pictures/pp-06.jpg" },
  { id: "pp-07", image: "/profile-pictures/pp-07.jpg" },
  { id: "pp-08", image: "/profile-pictures/pp-08.jpg" },
  { id: "pp-09", image: "/profile-pictures/pp-09.jpg" },
  { id: "pp-10", image: "/profile-pictures/pp-10.jpg" }
] as const;

function presetPictureForSeed(seed: string) {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return personalPictures[(hash >>> 0) % personalPictures.length] ?? personalPictures[0];
}

function parseAvatar(avatar: string): PictureAvatarPayload | null {
  try {
    const parsed = JSON.parse(avatar) as StoredAvatarPayload;
    if (parsed.type === "picture-v1" && parsed.initials && parsed.picture)
      return parsed as PictureAvatarPayload;
    if (parsed.type === "body-v1" && parsed.initials)
      return {
        type: "picture-v1",
        initials: parsed.initials,
        picture: { kind: "preset", id: "pp-01" }
      };
  } catch {
    return null;
  }
  return null;
}

function legacyAvatarPayload(avatar: string): PictureAvatarPayload {
  return {
    type: "picture-v1",
    initials: avatar || "MP",
    picture: { kind: "preset", id: presetPictureForSeed(avatar || "MP").id }
  };
}

function ProfilePicture({ avatar, size = "md" }: { avatar: string; size?: "sm" | "md" | "lg" }) {
  const payload = parseAvatar(avatar) ?? legacyAvatarPayload(avatar);
  const sizeClass =
    size === "lg"
      ? "h-28 w-28 text-3xl"
      : size === "sm"
        ? "h-14 w-14 text-lg"
        : "h-20 w-20 text-2xl";
  if (payload.picture.kind === "upload") {
    return (
      <img
        alt={`Photo de profil ${payload.initials}`}
        className={`profile-picture ${sizeClass}`}
        decoding="async"
        draggable={false}
        loading="lazy"
        src={payload.picture.dataUrl}
      />
    );
  }
  const pictureId = payload.picture.id;
  const preset =
    personalPictures.find((item) => item.id === pictureId) ?? personalPictures[0];
  return (
    <img
      alt={`Photo de profil ${payload.initials}`}
      className={`profile-picture profile-picture-preset ${sizeClass}`}
      decoding="async"
      draggable={false}
      loading="lazy"
      src={preset.image}
    />
  );
}

function Button(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`game-button inline-flex items-center justify-center gap-2 rounded-md bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950 transition-transform hover:bg-emerald-300 active:translate-y-px disabled:opacity-60 ${props.className ?? ""}`}
    />
  );
}

function Field(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="game-field w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 outline-none focus:border-emerald-300"
    />
  );
}

function nationalityLabel(value: string) {
  return countryLabel(value);
}

function closeTopClubModal() {
  const closeButtons = document.querySelectorAll<HTMLButtonElement>("[data-club-modal-close]");
  const closeButton = closeButtons.item(closeButtons.length - 1);
  if (!closeButton) return false;
  closeButton.click();
  return true;
}

function useClubModalHistory(open: boolean, onClose: () => void) {
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const previousActiveElement = document.activeElement as HTMLElement | null;
    const token = `club-modal-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const currentState =
      window.history.state && typeof window.history.state === "object" ? window.history.state : {};
    window.history.pushState({ ...currentState, clubModalToken: token }, "", window.location.href);
    let ownsHistoryEntry = true;

    const handlePopState = (event: PopStateEvent) => {
      if (!ownsHistoryEntry || event.state?.clubModalToken === token) return;
      ownsHistoryEntry = false;
      closeRef.current();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      closeRef.current();
    };
    const focusFrame = window.requestAnimationFrame(() => {
      const modals = document.querySelectorAll<HTMLElement>("[data-club-modal]");
      const activeModal = modals.item(modals.length - 1);
      activeModal
        ?.querySelector<HTMLElement>("[data-club-modal-close], button, input, select, textarea")
        ?.focus();
    });
    window.addEventListener("popstate", handlePopState);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("popstate", handlePopState);
      window.removeEventListener("keydown", handleKeyDown);
      window.cancelAnimationFrame(focusFrame);
      previousActiveElement?.focus();
      if (ownsHistoryEntry && window.history.state?.clubModalToken === token) {
        ownsHistoryEntry = false;
        window.history.back();
      }
    };
  }, [open]);
}

function ClubHeader({
  credits,
  clubBudget,
  onBack,
  onHelp,
  onSettings
}: {
  credits: number;
  clubBudget: number | null;
  onBack: () => void;
  onHelp: () => void;
  onSettings: () => void;
}) {
  return (
    <header className="club-header">
      <button aria-label="Retour au hub" className="club-icon-button club-back" onClick={onBack} type="button">
        <ArrowLeft aria-hidden="true" size={24} />
        <span className="sr-only">Retour au hub</span>
      </button>
      <div className="club-brand" aria-label="MyPro Tennis">
        <strong>MYPRO</strong>
        <span>TENNIS</span>
      </div>
      <h1>MON CLUB</h1>
      <div className="club-header-actions">
        <div className="club-resource club-resource-credits" aria-label="Crédits du joueur">
          <Coins aria-hidden="true" size={19} />
          <span>
            <small>Crédits</small>
            <strong>{credits.toLocaleString("fr-FR")}</strong>
          </span>
          <b aria-hidden="true">+</b>
        </div>
        <div className="club-resource club-resource-budget" aria-label="Budget du club">
          <Building2 aria-hidden="true" size={19} />
          <span>
            <small>Budget du club</small>
            <strong>{clubBudget === null ? "—" : `${clubBudget.toLocaleString("fr-FR")} CR`}</strong>
          </span>
          <b aria-hidden="true">+</b>
        </div>
        <button aria-label="Ouvrir l’aide" className="club-icon-button club-header-help" onClick={onHelp} type="button">
          <HelpCircle aria-hidden="true" size={19} />
          <span className="sr-only">Aide</span>
        </button>
        <button aria-label="Ouvrir les réglages" className="club-icon-button" onClick={onSettings} type="button">
          <Settings aria-hidden="true" size={19} />
          <span className="sr-only">Réglages</span>
        </button>
        <button aria-label="Fermer la page Club" className="club-icon-button club-close" onClick={onBack} type="button">
          <X aria-hidden="true" size={22} />
          <span className="sr-only">Fermer</span>
        </button>
      </div>
    </header>
  );
}

const clubNavigationItems: Array<{
  value: ClubTab;
  label: string;
  Icon: LucideIcon;
}> = [
  { value: "team", label: "Championnat", Icon: Trophy },
  { value: "infra", label: "Infrastructures", Icon: Building2 },
  { value: "members", label: "Effectif", Icon: Users },
  { value: "requests", label: "Demandes", Icon: Inbox }
];

function ClubNavigation({
  active,
  club,
  onChange
}: {
  active: ClubTab;
  club: ClubDetails;
  onChange: (tab: ClubTab) => void;
}) {
  const meta: Record<ClubTab, string> = {
    team: club.competitiveLevel,
    infra: "3 bâtiments",
    members: `${club.memberCount}/${club.maxSlots}`,
    requests: club.pendingRequests.length
      ? `${club.pendingRequests.length} en attente`
      : "Aucune demande"
  };

  return (
    <nav className="club-navigation" aria-label="Sections du club" role="tablist">
      {clubNavigationItems.map(({ value, label, Icon }) => (
        <button
          aria-controls={`club-panel-${value}`}
          aria-selected={active === value}
          className={active === value ? "is-active" : ""}
          id={`club-tab-${value}`}
          key={value}
          onClick={() => onChange(value)}
          role="tab"
          type="button"
        >
          <Icon aria-hidden="true" size={25} />
          <span>
            <strong>{label}</strong>
            <small>{meta[value]}</small>
          </span>
          {value === "requests" && club.pendingRequests.length > 0 ? (
            <b className="club-navigation-badge">{club.pendingRequests.length}</b>
          ) : null}
        </button>
      ))}
    </nav>
  );
}

function ClubNavigationSkeleton() {
  return (
    <div aria-hidden="true" className="club-navigation club-navigation-skeleton">
      {clubNavigationItems.map(({ value }) => (
        <span className="club-skeleton-block" key={value} />
      ))}
    </div>
  );
}

function ClubPageSkeleton() {
  return (
    <div aria-hidden="true" className="club-main-layout club-page-skeleton">
      <aside className="club-identity-panel">
        <span className="club-skeleton-line is-title" />
        <div className="club-skeleton-identity">
          <span className="club-skeleton-avatar" />
          <span>
            <i className="club-skeleton-line is-medium" />
            <i className="club-skeleton-line is-short" />
          </span>
        </div>
        <span className="club-skeleton-line" />
        <span className="club-skeleton-block is-facts" />
        <span className="club-skeleton-block is-action" />
      </aside>
      <div className="club-championship-layout">
        <section className="club-championship-panel club-skeleton-panel">
          <span className="club-skeleton-line is-title" />
          <span className="club-skeleton-block is-tabs" />
          <span className="club-skeleton-block is-content" />
        </section>
        <aside className="club-championship-side-rail">
          <span className="club-skeleton-block is-side" />
          <span className="club-skeleton-block is-side is-compact" />
        </aside>
      </div>
    </div>
  );
}

function ClubChampionshipSkeleton() {
  return (
    <div aria-hidden="true" className="club-championship-layout club-team-skeleton">
      <section className="club-championship-panel club-skeleton-panel">
        <span className="club-skeleton-line is-title" />
        <span className="club-skeleton-block is-tabs" />
        <span className="club-skeleton-block is-content" />
      </section>
      <aside className="club-championship-side-rail">
        <span className="club-skeleton-block is-side" />
        <span className="club-skeleton-block is-side is-compact" />
      </aside>
    </div>
  );
}

function ClubIdentityPanel({
  club,
  onLeave,
  onOpenSettings
}: {
  club: ClubDetails;
  onLeave: () => void;
  onOpenSettings: () => void;
}) {
  const capacityPercent = Math.min(
    100,
    Math.max(0, Math.round((club.memberCount / Math.max(1, club.maxSlots)) * 100))
  );
  const crestLabel = club.tag.slice(0, 3).toUpperCase() || "MP";

  return (
    <aside className="club-identity-panel" aria-label={`Fiche du club ${club.name}`}>
      <header className="club-identity-heading">
        <span>Mon club</span>
        <h2>{club.name}</h2>
      </header>

      <div className="club-identity-hero">
        <div className="club-crest" aria-hidden="true">
          <Shield size={108} strokeWidth={1.15} />
          <strong>{crestLabel}</strong>
          <i />
        </div>
        <div className="club-identity-title">
          <strong>[{club.tag}]</strong>
          <span>
            {club.competitiveLevel} · Niv. {club.complexLevel}
          </span>
        </div>
      </div>

      <p className="club-identity-description">
        {club.description || "Club joueur de l’univers MyPro Tennis."}
      </p>

      <div className="club-capacity">
        <div>
          <span>Membres</span>
          <strong>
            {club.memberCount} / {club.maxSlots}
          </strong>
        </div>
        <div className="club-capacity-track" aria-hidden="true">
          <i style={{ width: `${capacityPercent}%` }} />
        </div>
        <small>{club.openSlots} place(s) libre(s)</small>
      </div>

      <div className="club-identity-facts">
        <div>
          <Crown aria-hidden="true" size={17} />
          <span>Président</span>
          <strong>{club.president.name}</strong>
        </div>
        <div>
          <Trophy aria-hidden="true" size={17} />
          <span>Classement requis</span>
          <strong>{club.minimumRanking}</strong>
        </div>
        <div>
          <CreditCard aria-hidden="true" size={17} />
          <span>Cotisation</span>
          <strong>{formatCredits(clubDuesAmount(club))}</strong>
        </div>
      </div>

      <div className="club-treasury">
        <span>Trésorerie du club</span>
        <strong>{formatCredits(club.budget)}</strong>
        <small>Disponible pour les infrastructures et le championnat</small>
      </div>

      <div className="club-identity-actions">
        {club.isPresident ? (
          <button onClick={onOpenSettings} type="button">
            <Settings aria-hidden="true" size={18} />
            <span>Paramètres du club</span>
          </button>
        ) : null}
        <button className="club-leave-button" onClick={onLeave} type="button">
          <LogOut aria-hidden="true" size={18} />
          <span>Quitter</span>
        </button>
      </div>
    </aside>
  );
}

function buildingTheme(buildingId: string) {
  if (buildingId === "careCenter") {
    return {
      icon: HeartPulse,
      label: "Récupération",
      tone: "care"
    };
  }
  if (buildingId === "trainingCenter") {
    return {
      icon: Dumbbell,
      label: "Progression",
      tone: "training"
    };
  }
  return {
    icon: Building2,
    label: "Capacité",
    tone: "complex"
  };
}

function ClubBuildingCard({
  club,
  building,
  busy,
  onUpgrade
}: {
  club: ClubDetails;
  building: ClubBuilding;
  busy: string | null;
  onUpgrade: (building: ClubBuilding) => void;
}) {
  const theme = buildingTheme(building.id);
  const Icon = theme.icon;
  const upgradeEligibility = clubBuildingUpgradeEligibility(club, building);
  const nextLevel = upgradeEligibility.nextLevel;
  const canUpgrade = upgradeEligibility.canUpgrade;
  const upgradeBusy = busy === `${building.id}-upgrade`;
  const heroImage = buildingLevelImage(building.id, building.currentLevel.level);
  const previewImage = heroImage || buildingLevelImage(building.id, 1);
  const [levelsOpen, setLevelsOpen] = useState(false);
  useClubModalHistory(levelsOpen, () => setLevelsOpen(false));
  const progress =
    building.maxLevel > 0
      ? Math.round((building.currentLevel.level / building.maxLevel) * 100)
      : 100;
  const budgetShortfall = upgradeEligibility.shortfall;

  return (
    <>
    <article className={`club-building-card is-${theme.tone}`}>
      <div className="club-building-hero">
        {previewImage ? (
          <img
            alt={`Illustration ${building.currentLevel.name}`}
            className={heroImage ? "" : "is-locked-preview"}
            decoding="async"
            loading="lazy"
            src={previewImage}
          />
        ) : (
          <div className="club-building-hero-fallback"><Icon aria-hidden="true" size={56} /></div>
        )}
        <div className="club-building-hero-shade" />
        <div className="club-building-hero-content">
          <div className="club-building-type">
            <Icon aria-hidden="true" size={16} />
            {theme.label}
          </div>
          <div className="club-building-level">Niv. {building.currentLevel.level}</div>
          <div className="club-building-title">
            <h3>{building.name}</h3>
            <p>{building.currentLevel.name}</p>
          </div>
        </div>
      </div>

      <div className="club-building-body">
        <div className="club-building-bonus">
          <span>Bonus actuel</span>
          <strong>{buildingEffectLabel(building)}</strong>
        </div>

        <div className="club-building-progress">
          <div>
            <span>Progression</span>
            <strong>
              {building.currentLevel.level}/{building.maxLevel}
            </strong>
          </div>
          <div className="club-building-progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
            <i style={{ width: `${progress}%` }} />
          </div>
          <div className="club-building-levels">
            {building.levels.map((level) => {
              const isCurrent = level.level === building.currentLevel.level;
              const isUnlocked = level.level < building.currentLevel.level;
              return (
                <span
                  className={`is-${
                    isCurrent
                      ? "current"
                      : isUnlocked
                        ? "unlocked"
                        : "locked"
                  }`}
                  key={level.level}
                >
                  {level.level}
                </span>
              );
            })}
          </div>
        </div>

        <div className={`club-building-next ${nextLevel && canUpgrade ? "is-ready" : ""}`}>
          <span>{nextLevel ? "Prochaine amélioration" : "Développement terminé"}</span>
          {nextLevel ? (
            <>
              <strong>{nextLevel.name}</strong>
              <small>{buildingEffectLabel(building, nextLevel)}</small>
              <b>{formatCredits(nextLevel.cost)}</b>
            </>
          ) : (
            <strong>Niveau maximum atteint</strong>
          )}
        </div>

        <div className="club-building-actions">
          <button className="club-building-details" onClick={() => setLevelsOpen(true)} type="button">
            <Eye aria-hidden="true" size={16} />
            Niveaux
          </button>
          <button
            className="club-building-upgrade"
            disabled={upgradeBusy || !canUpgrade}
            onClick={() => onUpgrade(building)}
            type="button"
          >
            <Sparkles aria-hidden="true" size={16} />
            {upgradeBusy
              ? "Amélioration…"
              : !nextLevel
                ? "Niveau maximum"
                : !club.isPresident
                  ? "Président requis"
                  : `Améliorer · ${formatCredits(nextLevel.cost)}`}
          </button>
        </div>
        {club.isPresident && nextLevel && !canUpgrade ? (
          <p className="club-building-warning">
            Il manque {formatCredits(budgetShortfall)} dans la trésorerie.
          </p>
        ) : null}
      </div>
    </article>
    {levelsOpen
      ? createPortal(
          <div
            className="game-modal-overlay club-building-modal-overlay"
            data-club-modal
            onClick={(event) => {
              if (event.currentTarget === event.target) setLevelsOpen(false);
            }}
          >
            <section aria-labelledby={`building-levels-${building.id}`} aria-modal="true" className="club-building-modal" role="dialog">
              <header>
                <div>
                  <span>Parcours d’amélioration</span>
                  <h2 id={`building-levels-${building.id}`}>{building.name}</h2>
                </div>
                <button aria-label="Fermer les niveaux" data-club-modal-close onClick={() => setLevelsOpen(false)} type="button">
                  <X aria-hidden="true" size={20} />
                </button>
              </header>
              <div className="club-building-modal-levels">
                {building.levels.map((level) => {
                  const isCurrent = level.level === building.currentLevel.level;
                  const isUnlocked = level.level < building.currentLevel.level;
                  const levelImage = buildingLevelImage(building.id, level.level);
                  return (
                    <article className={isCurrent ? "is-current" : isUnlocked ? "is-unlocked" : "is-locked"} key={level.level}>
                      <div className="club-building-modal-image">
                        {levelImage ? (
                          <img alt={`Niveau ${level.level} - ${level.name}`} decoding="async" loading="lazy" src={levelImage} />
                        ) : (
                          <Icon aria-hidden="true" size={34} />
                        )}
                        <b>Niv. {level.level}</b>
                      </div>
                      <div>
                        <strong>{level.name}</strong>
                        <span>{buildingEffectLabel(building, level)}</span>
                      </div>
                      <small>{level.cost === 0 ? "Base" : formatCredits(level.cost)}</small>
                    </article>
                  );
                })}
              </div>
              <button className="club-building-modal-close" data-club-modal-close onClick={() => setLevelsOpen(false)} type="button">
                Fermer
              </button>
            </section>
          </div>,
          document.body
        )
      : null}
    </>
  );
}

function ClubInfrastructurePanel({
  club,
  buildings,
  busy,
  onUpgrade
}: {
  club: ClubDetails;
  buildings: ClubBuilding[];
  busy: string | null;
  onUpgrade: (building: ClubBuilding) => void;
}) {
  const builtCount = buildings.filter((building) => building.currentLevel.level > 0).length;
  const totalLevel = buildings.reduce((total, building) => total + building.currentLevel.level, 0);
  const totalMaximum = buildings.reduce((total, building) => total + building.maxLevel, 0);
  const affordableUpgrades = buildings.filter(
    (building) => building.nextLevel && building.nextLevel.cost <= club.budget
  ).length;

  return (
    <section className="club-infrastructure-panel">
      <header className="club-infrastructure-heading">
        <div>
          <span>Centre de développement</span>
          <h2>Infrastructures du club</h2>
          <p>Développez le club pour accueillir, soigner et faire progresser vos joueurs.</p>
        </div>
        <div className="club-infrastructure-budget">
          <Coins aria-hidden="true" size={20} />
          <span>
            <small>Trésorerie disponible</small>
            <strong>{formatCredits(club.budget)}</strong>
          </span>
        </div>
      </header>

      <div className="club-infrastructure-summary">
        <div><span>Bâtiments actifs</span><strong>{builtCount}/3</strong></div>
        <div><span>Développement</span><strong>{totalLevel}/{totalMaximum}</strong></div>
        <div>
          <span>Améliorations accessibles</span>
          <strong>{club.isPresident ? affordableUpgrades : "Président"}</strong>
        </div>
      </div>

      <div className="club-infrastructure-grid">
        {buildings.map((building) => (
          <ClubBuildingCard
            building={building}
            busy={busy}
            club={club}
            key={building.id}
            onUpgrade={onUpgrade}
          />
        ))}
      </div>

      <footer className="club-infrastructure-footer">
        <Sparkles aria-hidden="true" size={20} />
        <strong>
          {club.isPresident
            ? affordableUpgrades > 0
              ? `${affordableUpgrades} amélioration(s) finançable(s) immédiatement`
              : "Développez la trésorerie pour débloquer la prochaine amélioration"
            : "Le président du club gère les investissements"}
        </strong>
      </footer>
    </section>
  );
}

type ClubMember = ClubDetails["members"][number];
type ClubJoinRequest = ClubDetails["pendingRequests"][number];

function ClubMemberCard({
  member,
  index,
  dues,
  championshipLoading,
  championshipActive
}: {
  member: ClubMember;
  index: number;
  dues: ReturnType<typeof fallbackDuesState>;
  championshipLoading: boolean;
  championshipActive: boolean;
}) {
  const isPresident = member.role === "PRESIDENT";
  const duesRelevant = championshipActive && dues.amount > 0;
  const isEligible = !duesRelevant || dues.paidPlayerIds.includes(member.player.id);
  const eligibilityLabel = championshipLoading
    ? "Vérification"
    : !championshipActive
      ? "Hors saison"
      : dues.amount === 0
        ? "Accès libre"
        : isEligible
          ? "À jour"
          : "Non payé";

  return (
    <Link
      className={`club-member-card ${isPresident ? "is-president" : ""}`}
      to={`/profile/${member.player.id}`}
    >
      <b className="club-member-index">{String(index + 1).padStart(2, "0")}</b>
      <ProfilePicture avatar={member.player.avatar} size="sm" />
      <span className="club-member-identity">
        <strong>{member.player.name}</strong>
        <small>{nationalityLabel(member.player.nationality)}</small>
      </span>
      <span className="club-member-stats">
        <b>{member.player.fftRanking}</b>
        <small>Classement</small>
      </span>
      <span className="club-member-stats">
        <b>{member.player.overall}</b>
        <small>Niveau</small>
      </span>
      <span className={`club-member-role ${isPresident ? "is-president" : ""}`}>
        {isPresident ? <Crown aria-hidden="true" size={13} /> : <Users aria-hidden="true" size={13} />}
        {isPresident ? "Président" : "Membre"}
      </span>
      <span
        className={`club-member-eligibility ${
          championshipLoading ? "is-loading" : isEligible ? "is-ready" : "is-unpaid"
        }`}
      >
        {eligibilityLabel}
      </span>
    </Link>
  );
}

function ClubRosterPanel({
  championshipData,
  club
}: {
  championshipData: TeamChampionshipData | null;
  club: ClubDetails;
}) {
  const dues = fallbackDuesState(club, championshipData);
  const championshipActive = Boolean(championshipData?.championship);
  const president = club.members.find((member) => member.role === "PRESIDENT");

  return (
    <section aria-busy={!championshipData} className="club-roster-panel">
      <header className="club-roster-heading">
        <div>
          <span>Vestiaire du club</span>
          <h2>Effectif</h2>
          <p>Consultez les membres, leur hiérarchie et leur disponibilité pour le championnat.</p>
        </div>
        <div className="club-roster-capacity">
          <Users aria-hidden="true" size={20} />
          <span>
            <small>Membres</small>
            <strong>{club.memberCount}/{club.maxSlots}</strong>
          </span>
          <i>{club.openSlots} libre(s)</i>
        </div>
      </header>

      <div className="club-roster-summary">
        <div><span>Président</span><strong>{president?.player.name ?? club.president.name}</strong></div>
        <div><span>Niveau moyen</span><strong>{Math.round(club.members.reduce((total, member) => total + member.player.overall, 0) / Math.max(1, club.members.length))}</strong></div>
        <div>
          <span>Éligibles championnat</span>
          <strong>
            {!championshipData
              ? "Chargement…"
              : championshipActive
                ? `${dues.eligibleCount}/${club.memberCount}`
                : "Hors saison"}
          </strong>
        </div>
      </div>

      <div className="club-roster-grid">
        {club.members.map((member, index) => (
          <ClubMemberCard
            championshipActive={championshipActive}
            championshipLoading={!championshipData}
            dues={dues}
            index={index}
            key={member.id}
            member={member}
          />
        ))}
      </div>
    </section>
  );
}

function ClubRequestCard({
  request,
  busy,
  clubFull,
  onDecision
}: {
  request: ClubJoinRequest;
  busy: boolean;
  clubFull: boolean;
  onDecision: (requestId: string, decision: "accept" | "reject") => void;
}) {
  return (
    <article className="club-request-card">
      <header>
        <Link to={`/profile/${request.player.id}`}>
          <ProfilePicture avatar={request.player.avatar} size="sm" />
          <span>
            <strong>{request.player.name}</strong>
            <small>{nationalityLabel(request.player.nationality)} · Candidature</small>
          </span>
        </Link>
        <time dateTime={request.createdAt}>
          {new Date(request.createdAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
        </time>
      </header>

      <div className="club-request-stats">
        <div><span>Classement</span><strong>{request.player.fftRanking}</strong></div>
        <div><span>Niveau</span><strong>{request.player.overall}</strong></div>
        <div><span>Rang mondial</span><strong>#{request.player.worldRank}</strong></div>
      </div>

      <blockquote className={request.message ? "" : "is-empty"}>
        {request.message || "Aucun message joint à cette candidature."}
      </blockquote>

      <div className="club-request-actions">
        <button
          className="club-request-accept"
          disabled={busy || clubFull}
          onClick={() => onDecision(request.id, "accept")}
          title={clubFull ? "Le club ne possède plus de place disponible." : undefined}
          type="button"
        >
          <UserCheck aria-hidden="true" size={17} />
          {clubFull ? "Club complet" : "Accepter"}
        </button>
        <button
          className="club-request-reject"
          disabled={busy}
          onClick={() => onDecision(request.id, "reject")}
          type="button"
        >
          <UserX aria-hidden="true" size={17} />
          Refuser
        </button>
      </div>
    </article>
  );
}

function ClubRequestsPanel({
  club,
  busy,
  onDecision
}: {
  club: ClubDetails;
  busy: string | null;
  onDecision: (requestId: string, decision: "accept" | "reject") => void;
}) {
  const decisionBusy = Boolean(busy?.startsWith("accept-") || busy?.startsWith("reject-"));
  const clubFull = !clubCanAcceptRequest(club);

  return (
    <section className="club-requests-panel">
      <header className="club-requests-heading">
        <div>
          <span>Recrutement</span>
          <h2>Demandes d’adhésion</h2>
          <p>Étudiez les candidatures avant d’ouvrir les portes du vestiaire.</p>
        </div>
        <div className={club.pendingRequests.length ? "has-requests" : ""}>
          <Inbox aria-hidden="true" size={20} />
          <span><small>En attente</small><strong>{club.pendingRequests.length}</strong></span>
        </div>
      </header>

      {!club.isPresident ? (
        <div className="club-requests-restricted">
          <Shield aria-hidden="true" size={35} />
          <strong>Espace réservé au président</strong>
          <span>Vous pouvez consulter l’effectif, mais seul le président décide des nouvelles adhésions.</span>
        </div>
      ) : club.pendingRequests.length === 0 ? (
        <div className="club-requests-empty">
          <UserCheck aria-hidden="true" size={38} />
          <strong>Aucune demande en attente</strong>
          <span>Le badge de recrutement se mettra à jour dès qu’un joueur postulera.</span>
        </div>
      ) : (
        <>
          {clubFull ? (
            <div className="club-requests-full">
              Le club est complet : libérez une place ou améliorez le complexe avant d’accepter un candidat.
            </div>
          ) : null}
          <div className="club-requests-grid">
            {club.pendingRequests.map((request) => (
              <ClubRequestCard
                busy={decisionBusy}
                clubFull={clubFull}
                key={request.id}
                onDecision={onDecision}
                request={request}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function ClubJoinCard({
  club,
  playerRanking,
  hasPendingRequest,
  busy,
  onJoin
}: {
  club: ClubListItem;
  playerRanking: string;
  hasPendingRequest: boolean;
  busy: boolean;
  onJoin: (clubId: string) => void;
}) {
  const availability = clubJoinAvailability({
    club,
    playerRanking,
    hasPendingRequest,
    busy
  });
  const capacity = Math.min(100, Math.round((club.memberCount / Math.max(1, club.maxSlots)) * 100));
  const rankingAllowed = fftIndex(playerRanking) >= fftIndex(club.minimumRanking);

  return (
    <article className={`club-search-card is-${availability.state}`}>
      <header>
        <ChampionshipCrest tag={club.tag} tone="rival" />
        <span>
          <small>[{club.tag}]</small>
          <strong>{club.name}</strong>
          <i>{club.competitiveLevel}</i>
        </span>
        <b>Niv. {club.complexLevel}</b>
      </header>

      <p>{club.description || "Club ouvert aux joueurs souhaitant progresser ensemble."}</p>

      <div className="club-search-card-facts">
        <div><Crown aria-hidden="true" size={14} /><span>Président</span><strong>{club.president.name}</strong></div>
        <div><Trophy aria-hidden="true" size={14} /><span>Classement</span><strong className={rankingAllowed ? "is-valid" : "is-invalid"}>{club.minimumRanking}</strong></div>
        <div><CreditCard aria-hidden="true" size={14} /><span>Cotisation</span><strong>{formatCredits(clubDuesAmount(club))}</strong></div>
      </div>

      <div className="club-search-capacity">
        <div><span>Effectif</span><strong>{club.memberCount}/{club.maxSlots} · {club.openSlots} libre(s)</strong></div>
        <div><i style={{ width: `${capacity}%` }} /></div>
      </div>

      <div className={`club-search-availability is-${availability.state}`}>
        <span>{availability.reason}</span>
        <button
          disabled={availability.disabled}
          onClick={() => onJoin(club.id)}
          title={availability.reason}
          type="button"
        >
          {availability.label}
        </button>
      </div>
    </article>
  );
}

function ClubSearchPanel({
  clubs,
  loading,
  playerRanking,
  pendingRequest,
  busy,
  onJoin,
  onCreateFirst
}: {
  clubs: ClubListItem[];
  loading: boolean;
  playerRanking: string;
  pendingRequest: MyClubData["pendingRequest"];
  busy: string | null;
  onJoin: (clubId: string) => void;
  onCreateFirst: () => void;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "available" | "eligible">("all");
  const normalizedQuery = query.trim().toLocaleLowerCase("fr-FR");
  const filteredClubs = clubs.filter((club) => {
    const matchesQuery =
      !normalizedQuery ||
      `${club.name} ${club.tag} ${club.description} ${club.president.name}`
        .toLocaleLowerCase("fr-FR")
        .includes(normalizedQuery);
    const matchesFilter =
      filter === "all" ||
      (filter === "available" && club.openSlots > 0) ||
      (filter === "eligible" &&
        club.openSlots > 0 &&
        fftIndex(playerRanking) >= fftIndex(club.minimumRanking));
    return matchesQuery && matchesFilter;
  });

  return (
    <section className="club-search-panel">
      <header>
        <div>
          <span>Marché des clubs</span>
          <h2>Clubs disponibles</h2>
        </div>
        <strong>{loading ? "…" : `${filteredClubs.length}/${clubs.length}`}</strong>
      </header>

      <div className="club-search-toolbar">
        <label>
          <Search aria-hidden="true" size={17} />
          <input
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Rechercher un club, un sigle ou un président…"
            type="search"
            value={query}
          />
        </label>
        <div aria-label="Filtres des clubs" role="group">
          {([
            ["all", "Tous"],
            ["available", "Avec places"],
            ["eligible", "Pour mon classement"]
          ] as const).map(([value, label]) => (
            <button
              aria-pressed={filter === value}
              className={filter === value ? "is-active" : ""}
              key={value}
              onClick={() => setFilter(value)}
              type="button"
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div aria-label="Chargement des clubs" aria-live="polite" className="club-search-grid club-search-skeleton" role="status">
          {Array.from({ length: 4 }, (_, index) => (
            <article aria-hidden="true" className="club-search-card" key={index}>
              <span className="club-skeleton-line is-title" />
              <span className="club-skeleton-line" />
              <span className="club-skeleton-block is-facts" />
              <span className="club-skeleton-block is-action" />
            </article>
          ))}
        </div>
      ) : filteredClubs.length > 0 ? (
        <div className="club-search-grid">
          {filteredClubs.map((club) => (
            <ClubJoinCard
              busy={busy === `join-${club.id}`}
              club={club}
              hasPendingRequest={Boolean(pendingRequest)}
              key={club.id}
              onJoin={onJoin}
              playerRanking={playerRanking}
            />
          ))}
        </div>
      ) : (
        <div className="club-search-empty">
          <Shield aria-hidden="true" size={38} />
          <strong>{clubs.length ? "Aucun club ne correspond aux filtres" : "Fondez le premier club"}</strong>
          <span>{clubs.length ? "Modifiez la recherche ou affichez tous les clubs." : "Créez une structure et devenez son premier président."}</span>
          {!clubs.length ? <button onClick={onCreateFirst} type="button">Créer mon club</button> : null}
        </div>
      )}
    </section>
  );
}

function ClubCreationPanel({
  form,
  setForm,
  playerBudget,
  creationCost,
  pendingRequest,
  busy,
  onSubmit
}: {
  form: ClubCreationForm;
  setForm: React.Dispatch<React.SetStateAction<ClubCreationForm>>;
  playerBudget: number;
  creationCost: number;
  pendingRequest: MyClubData["pendingRequest"];
  busy: boolean;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  const canAfford = playerBudget >= creationCost;
  const balanceAfterCreation = playerBudget - creationCost;
  const blockedReason = pendingRequest
    ? "Vous devez attendre la réponse à votre demande d’adhésion avant de créer un club."
    : !canAfford
      ? `Il vous manque ${formatCredits(Math.max(0, creationCost - playerBudget))}.`
      : null;

  return (
    <section className="club-create-panel">
      <aside className="club-create-preview">
        <span>Aperçu du fondateur</span>
        <div className="club-create-crest">
          <Shield aria-hidden="true" size={108} strokeWidth={1.15} />
          <strong>{form.tag.trim().slice(0, 3).toUpperCase() || "MP"}</strong>
        </div>
        <h2>{form.name.trim() || "Votre nouveau club"}</h2>
        <b>[{form.tag.trim().toUpperCase() || "SIGLE"}]</b>
        <p>{form.description.trim() || "Définissez l’ambition, l’ambiance et le profil recherché."}</p>
        <div>
          <span>5 places initiales</span>
          <span>Vous devenez président</span>
          <span>Classement requis : {form.minimumRanking}</span>
          <span>Cotisation : {formatCredits(form.duesAmount)}</span>
        </div>
      </aside>

      <form className="club-create-form" onSubmit={onSubmit}>
        <header>
          <div><span>Fondation</span><h2>Créer un club</h2></div>
          <div><small>Coût de création</small><strong>{formatCredits(creationCost)}</strong></div>
        </header>

        <div className="club-create-balance">
          <span>Crédits disponibles <strong>{formatCredits(playerBudget)}</strong></span>
          <i aria-hidden="true">→</i>
          <span>Solde après création <strong className={canAfford ? "" : "is-negative"}>{formatCredits(balanceAfterCreation)}</strong></span>
        </div>

        <div className="club-create-fields">
          <label><span>Nom du club</span><input maxLength={32} minLength={3} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="Ex : Central Horizon" required value={form.name} /></label>
          <label><span>Sigle</span><input maxLength={5} minLength={2} onChange={(event) => setForm((current) => ({ ...current, tag: event.target.value }))} placeholder="CHT" required value={form.tag} /></label>
          <label className="is-wide"><span>Description</span><textarea maxLength={280} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder="Objectif, niveau recherché, ambiance…" value={form.description} /></label>
          <label><span>Classement minimum</span><select onChange={(event) => setForm((current) => ({ ...current, minimumRanking: event.target.value }))} value={form.minimumRanking}>{fftPath.map((ranking) => <option key={ranking} value={ranking}>{ranking}</option>)}</select></label>
          <label><span>Cotisation par joueur</span><input max={50000} min={0} onChange={(event) => setForm((current) => ({ ...current, duesAmount: Math.max(0, Number(event.target.value) || 0) }))} type="number" value={form.duesAmount} /></label>
        </div>

        {blockedReason ? <div className="club-create-blocked">{blockedReason}</div> : null}
        <button className="club-create-submit" disabled={busy || Boolean(blockedReason)} type="submit">
          {busy ? "Création…" : blockedReason ? "Création indisponible" : `Créer le club · ${formatCredits(creationCost)}`}
        </button>
      </form>
    </section>
  );
}

type TeamMember = NonNullable<TeamChampionshipData["team"]>["members"][number];

function ChampionshipCrest({ tag, tone = "player" }: { tag: string; tone?: "player" | "rival" }) {
  return (
    <span className={`club-championship-crest is-${tone}`} aria-hidden="true">
      <Shield size={66} strokeWidth={1.35} />
      <strong>{tag.slice(0, 3).toUpperCase()}</strong>
    </span>
  );
}

function ChampionshipLineupCard({
  member,
  slot,
  duesAmount,
  championshipActive
}: {
  member: TeamMember | undefined;
  slot: number;
  duesAmount: number;
  championshipActive: boolean;
}) {
  if (!member) {
    return (
      <div className="club-lineup-card is-empty">
        <b>{slot}</b>
        <Users aria-hidden="true" size={27} />
        <strong>Place libre</strong>
        <span>Joueur requis</span>
      </div>
    );
  }

  const isEligible = duesAmount === 0 || !championshipActive || member.duesPaid === true;
  return (
    <Link className="club-lineup-card" to={`/profile/${member.player.id}`}>
      <b>{slot}</b>
      <ProfilePicture avatar={member.player.avatar} size="sm" />
      <strong>{member.player.name}</strong>
      <span>{member.player.fftRanking}</span>
      <small className={isEligible ? "is-ready" : "is-unpaid"}>
        {isEligible ? "À jour" : "Non payé"}
      </small>
    </Link>
  );
}

function ChampionshipSideRail({
  division,
  standings,
  dues,
  memberCount,
  busy,
  onOpenStandings,
  onOpenCalendar,
  onPay
}: {
  division: string;
  standings: TeamChampionshipEntry[];
  dues: ReturnType<typeof fallbackDuesState>;
  memberCount: number;
  busy: boolean;
  onOpenStandings: () => void;
  onOpenCalendar: () => void;
  onPay: () => void;
}) {
  const preview = championshipPreviewStandings(standings);
  const duesStatus = clubDuesVisualState(dues);
  const eligibleProgress = memberCount > 0
    ? Math.min(100, Math.round((dues.eligibleCount / memberCount) * 100))
    : 0;

  return (
    <aside className="club-championship-side-rail">
      <article className="club-ranking-preview">
        <header>
          <span>Classement</span>
          <strong>{division || "Division à définir"}</strong>
        </header>
        {preview.top.length > 0 ? (
          <div className="club-ranking-table" role="table" aria-label="Aperçu du classement">
            <div className="club-ranking-table-head" role="row">
              <span role="columnheader">#</span>
              <span role="columnheader">Club</span>
              <span role="columnheader">Pts</span>
            </div>
            {preview.top.map((entry) => (
              <div
                className={entry.isPlayerClub ? "is-player" : ""}
                key={entry.id}
                role="row"
              >
                <b role="cell">{entry.rank ?? "—"}</b>
                <span role="cell">
                  <ChampionshipCrest tag={entry.tag} tone={entry.isPlayerClub ? "player" : "rival"} />
                  <strong>
                    <i>[{entry.tag}]</i> {entry.name}
                  </strong>
                </span>
                <b role="cell">{entry.points}</b>
              </div>
            ))}
            {preview.playerOutsideTop ? (
              <>
                <div className="club-ranking-separator" aria-hidden="true">•••</div>
                <div className="is-player" role="row">
                  <b role="cell">{preview.playerOutsideTop.rank ?? "—"}</b>
                  <span role="cell">
                    <ChampionshipCrest tag={preview.playerOutsideTop.tag} tone="player" />
                    <strong>
                      <i>[{preview.playerOutsideTop.tag}]</i> {preview.playerOutsideTop.name}
                    </strong>
                  </span>
                  <b role="cell">{preview.playerOutsideTop.points}</b>
                </div>
              </>
            ) : null}
          </div>
        ) : (
          <div className="club-ranking-empty">Le classement apparaîtra au lancement de la saison.</div>
        )}
        <button onClick={onOpenStandings} type="button" disabled={standings.length === 0}>
          Voir le classement
        </button>
      </article>

      <article className={`club-dues-card is-${duesStatus.state}`}>
        <header>Cotisation championnat</header>
        <div className="club-dues-card-main">
          <strong>{formatCredits(dues.amount)}</strong>
          <span className="club-dues-status">
            <i aria-hidden="true">{duesStatus.state === "closed" ? "×" : "✓"}</i>
            <b>{duesStatus.label}</b>
          </span>
        </div>
        <div className="club-dues-eligibility">
          <span>{dues.eligibleCount}/{memberCount} joueurs à jour</span>
          <div aria-label={`${eligibleProgress}% de joueurs à jour`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={eligibleProgress}>
            <i style={{ width: `${eligibleProgress}%` }} />
          </div>
        </div>
        {duesStatus.state === "due" && dues.currentPlayerCanPay ? (
          <button className="club-dues-pay" disabled={busy} onClick={onPay} type="button">
            {busy ? "Paiement…" : `Payer ${formatCredits(dues.amount)}`}
          </button>
        ) : null}
        <button className="club-dues-calendar" onClick={onOpenCalendar} type="button">
          <CalendarDays aria-hidden="true" size={16} />
          Voir le calendrier
        </button>
      </article>
    </aside>
  );
}

function TeamMeetingModal({
  meeting,
  onClose,
  onOpenSummary
}: {
  meeting: TeamChampionshipMeeting;
  onClose: () => void;
  onOpenSummary: (single: TeamChampionshipSingle, homeClub: string, awayClub: string) => void;
}) {
  useClubModalHistory(true, onClose);
  const home = meeting.home ? `[${meeting.home.tag}] ${meeting.home.name}` : "Exempt";
  const away = meeting.away ? `[${meeting.away.tag}] ${meeting.away.name}` : "Exempt";
  const singles = meeting.details?.singles ?? [];

  return createPortal(
    <div className="game-modal-overlay club-action-modal-overlay" data-club-modal>
      <section aria-labelledby="club-meeting-modal-title" aria-modal="true" className="club-action-modal club-meeting-modal" role="dialog">
        <header>
          <div>
            <span>Championnat · Journée {meeting.round}</span>
            <h2 id="club-meeting-modal-title">Détail de la rencontre</h2>
            <p>{new Date(meeting.startsAt).toLocaleString("fr-FR")}</p>
          </div>
          <button aria-label="Fermer le détail de la rencontre" data-club-modal-close onClick={onClose} type="button"><X aria-hidden="true" size={20} /></button>
        </header>

        <div className="club-meeting-scoreboard">
          <div><ChampionshipCrest tag={meeting.home?.tag ?? "—"} tone={meeting.home?.isPlayerClub ? "player" : "rival"} /><strong>{home}</strong></div>
          <span><b>{meeting.status === "COMPLETED" ? `${meeting.scoreHome} - ${meeting.scoreAway}` : "VS"}</b><small>{meeting.status === "COMPLETED" ? "Terminé" : meeting.status === "EXEMPT" ? "Exempt" : "À venir"}</small></span>
          <div><ChampionshipCrest tag={meeting.away?.tag ?? "—"} tone={meeting.away?.isPlayerClub ? "player" : "rival"} /><strong>{away}</strong></div>
        </div>

        <div className="club-meeting-singles">
          {singles.length ? singles.map((single) => (
            <article key={single.label}>
              <b>{single.label}</b>
              <span className={single.winner === "home" ? "is-winner" : ""}>{single.homePlayer.name}<small>{single.homePlayer.fftRanking}</small></span>
              <strong>{single.scoreText}</strong>
              <span className={single.winner === "away" ? "is-winner" : ""}>{single.awayPlayer.name}<small>{single.awayPlayer.fftRanking}</small></span>
              {meeting.status === "COMPLETED" ? (
                single.replayMatchId ? <Link to={`/match/${single.replayMatchId}`}>Voir le replay</Link> : <button onClick={() => onOpenSummary(single, home, away)} type="button">Voir le résumé</button>
              ) : <small>Match à venir</small>}
            </article>
          )) : <div className="club-meeting-no-singles">La composition détaillée sera disponible après la rencontre.</div>}
        </div>

        <button className="club-action-primary" data-club-modal-close onClick={onClose} type="button">Fermer</button>
      </section>
    </div>,
    document.body
  );
}

function TeamChampionshipPanel({
  club,
  onDataChange,
  onClubBudgetChanged,
  onClubUpdated
}: {
  club: ClubDetails;
  onDataChange: (data: TeamChampionshipData) => void;
  onClubBudgetChanged: (amount: number) => void;
  onClubUpdated: () => Promise<void>;
}) {
  const currentPlayer = useGameStore((state) => state.player)!;
  const refresh = useGameStore((state) => state.refresh);
  const patchPlayer = useGameStore((state) => state.patchPlayer);
  const paymentLock = useRef(false);
  const teamActionLock = useRef(false);
  const [data, setData] = useState<TeamChampionshipData | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [teamView, setTeamView] = useState<"team" | "standings" | "schedule">("team");
  const [selectedRound, setSelectedRound] = useState<number | null>(null);
  const [teamMeetingDetails, setTeamMeetingDetails] = useState<TeamChampionshipMeeting | null>(null);
  const [teamReplay, setTeamReplay] = useState<{
    single: TeamChampionshipSingle;
    homeClub: string;
    awayClub: string;
    round: number;
  } | null>(null);
  useClubModalHistory(Boolean(teamReplay), () => setTeamReplay(null));

  async function loadTeamChampionship() {
    try {
      const nextData = await api<TeamChampionshipData>("/clubs/team-championship");
      setData(nextData);
      onDataChange(nextData);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Championnat par équipe momentanément indisponible."
      );
      const fallbackData: TeamChampionshipData = {
        divisions: [],
        club: null,
        team: null,
        championship: null,
        dues: fallbackDuesState(club),
        canCreateTeam: false,
        canStartChampionship: false
      };
      setData(fallbackData);
      onDataChange(fallbackData);
    }
  }

  useEffect(() => void loadTeamChampionship(), []);

  async function createTeam() {
    if (teamActionLock.current) return;
    teamActionLock.current = true;
    setMessage("");
    setBusy(true);
    try {
      await api("/clubs/team", { method: "POST" });
      await loadTeamChampionship();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Création de l'équipe impossible.");
    } finally {
      teamActionLock.current = false;
      setBusy(false);
    }
  }

  async function startChampionship() {
    if (teamActionLock.current) return;
    teamActionLock.current = true;
    setMessage("");
    setBusy(true);
    try {
      await api("/clubs/team/championship", { method: "POST" });
      await loadTeamChampionship();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Inscription impossible.");
    } finally {
      teamActionLock.current = false;
      setBusy(false);
    }
  }

  async function payDues() {
    if (paymentLock.current) return;
    paymentLock.current = true;
    setMessage("");
    setBusy(true);
    try {
      await api("/clubs/dues/pay", { method: "POST" });
      const currentDues = fallbackDuesState(club, data);
      const amount = currentDues.amount;
      if (data) {
        const nextData: TeamChampionshipData = {
          ...data,
          club: data.club ? { ...data.club, budget: data.club.budget + amount } : data.club,
          dues: {
            ...currentDues,
            currentPlayerPaid: true,
            currentPlayerCanPay: false,
            paidCount: Math.min(club.memberCount, currentDues.paidCount + 1),
            eligibleCount: Math.min(club.memberCount, currentDues.eligibleCount + 1),
            paidPlayerIds: currentDues.paidPlayerIds.includes(currentPlayer.id)
              ? currentDues.paidPlayerIds
              : [...currentDues.paidPlayerIds, currentPlayer.id]
          }
        };
        setData(nextData);
        onDataChange(nextData);
      }
      patchPlayer((player) => ({ budget: Math.max(0, player.budget - amount) }));
      onClubBudgetChanged(amount);
      setMessage("Cotisation payée. Le budget du club a été crédité.");
      void Promise.all([refresh(), loadTeamChampionship(), onClubUpdated()]).catch((error) =>
        setMessage(error instanceof Error ? error.message : "Actualisation momentanément indisponible.")
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Paiement impossible.");
    } finally {
      paymentLock.current = false;
      setBusy(false);
    }
  }

  if (!data) return <ClubChampionshipSkeleton />;

  const championship = data.championship;
  const championshipStatus = clubChampionshipVisualState(championship);
  const teamReadiness = clubTeamReadiness(data);
  const nextMeeting = championship?.nextMeeting;
  const rounds = championship
    ? [...new Set(championship.meetings.map((meeting) => meeting.round))].sort((a, b) => a - b)
    : [];
  const upcomingRound =
    nextMeeting?.round ??
    championship?.meetings.find((meeting) => meeting.status === "SCHEDULED")?.round ??
    rounds[rounds.length - 1] ??
    1;
  const displayedRound = selectedRound ?? upcomingRound;
  const displayedRoundMeetings =
    championship?.meetings.filter((meeting) => meeting.round === displayedRound) ?? [];
  const lowestDivision = data.divisions[0] ?? "";
  const highestDivision = data.divisions[data.divisions.length - 1] ?? "";
  const promotionEnabled = Boolean(championship && championship.division !== highestDivision);
  const relegationEnabled = Boolean(championship && championship.division !== lowestDivision);
  const relegationRank = championship?.standings.length ?? 0;
  const dues = fallbackDuesState(club, data);
  const sortedTeamMembers = [...(data.team?.members ?? [])].sort(
    (left, right) => left.slotIndex - right.slotIndex
  );
  const lineupSlots = Array.from({ length: 5 }, (_, index) =>
    sortedTeamMembers.find((member) => member.slotIndex === index + 1)
  );
  const nextHomeClub = nextMeeting?.home;
  const nextAwayClub = nextMeeting?.away;
  const nextMeetingDate = nextMeeting
    ? new Date(nextMeeting.startsAt).toLocaleString("fr-FR", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit"
      })
    : null;

  return (
    <div className="club-championship-layout">
    <section className="club-championship-panel">
      <header className="club-championship-heading">
        <div>
          <span>Championnat par équipe</span>
          <h2>{data.team ? data.team.name : "Aucune équipe créée"}</h2>
        </div>
        <div className="club-championship-heading-actions">
          <strong className={`is-${championshipStatus.state}`}>
            {championshipStatus.label}
            {data.team && teamReadiness.state !== "complete"
              ? ` · ${teamReadiness.missingSlots} titulaire(s) manquant(s)`
              : ""}
          </strong>
          {!data.team ? (
            <button disabled={!data.canCreateTeam || busy} onClick={() => void createTeam()} type="button">
              Créer l’équipe
            </button>
          ) : data.canStartChampionship ? (
            <button disabled={busy} onClick={() => void startChampionship()} type="button">
              Lancer le championnat
            </button>
          ) : null}
        </div>
      </header>

      <nav className="club-championship-tabs" aria-label="Vues du championnat" role="tablist">
        <button
          aria-controls="club-championship-panel-team"
          aria-selected={teamView === "team"}
          className={teamView === "team" ? "is-active" : ""}
          id="club-championship-tab-team"
          onClick={() => setTeamView("team")}
          role="tab"
          type="button"
        >
          Équipe
        </button>
        <button
          aria-controls="club-championship-panel-standings"
          aria-selected={teamView === "standings"}
          className={teamView === "standings" ? "is-active" : ""}
          id="club-championship-tab-standings"
          onClick={() => setTeamView("standings")}
          role="tab"
          type="button"
        >
          Classement
        </button>
        <button
          aria-controls="club-championship-panel-schedule"
          aria-selected={teamView === "schedule"}
          className={teamView === "schedule" ? "is-active" : ""}
          id="club-championship-tab-schedule"
          onClick={() => setTeamView("schedule")}
          role="tab"
          type="button"
        >
          Calendrier
        </button>
      </nav>

      {message ? <div aria-live="polite" className="club-championship-message" role="status">{message}</div> : null}

      {teamView === "team" ? (
        <div aria-labelledby="club-championship-tab-team" className="club-championship-team-view" id="club-championship-panel-team" role="tabpanel">
          {!data.team ? (
            <div className="club-championship-empty">
              <Users aria-hidden="true" size={38} />
              <strong>Formez votre première équipe</strong>
              <span>
                {club.memberCount >= 5
                  ? club.isPresident
                    ? "Le club possède assez de membres pour créer ses cinq titulaires."
                    : "Le président doit créer l’équipe du club."
                  : `Il manque ${5 - club.memberCount} joueur(s) pour créer l’équipe.`}
              </span>
              {club.isPresident ? (
                <button disabled={!data.canCreateTeam || busy} onClick={() => void createTeam()} type="button">
                  Créer l’équipe
                </button>
              ) : null}
            </div>
          ) : (
            <>
              <article className="club-next-meeting">
                <div className="club-next-meeting-kicker">
                  <strong>
                    {nextMeeting ? `Prochaine rencontre · Journée ${nextMeeting.round}` : "Prochaine rencontre"}
                  </strong>
                  <span>{nextMeetingDate ?? "Calendrier à venir"}</span>
                </div>
                {nextMeeting ? (
                  <>
                    <div className="club-versus">
                      <div className="club-versus-side">
                        <ChampionshipCrest
                          tag={nextHomeClub?.tag ?? "—"}
                          tone={nextHomeClub?.isPlayerClub ? "player" : "rival"}
                        />
                        <span>
                          <b>{nextHomeClub ? `[${nextHomeClub.tag}]` : "EXEMPT"}</b>
                          <strong>{nextHomeClub?.name ?? "Exempt"}</strong>
                        </span>
                      </div>
                      <div className="club-versus-score">
                        <strong>
                          {nextMeeting.status === "COMPLETED"
                            ? `${nextMeeting.scoreHome} - ${nextMeeting.scoreAway}`
                            : "VS"}
                        </strong>
                        <span>{data.team.division}</span>
                      </div>
                      <div className="club-versus-side is-away">
                        <span>
                          <b>{nextAwayClub ? `[${nextAwayClub.tag}]` : "EXEMPT"}</b>
                          <strong>{nextAwayClub?.name ?? "Exempt"}</strong>
                        </span>
                        <ChampionshipCrest
                          tag={nextAwayClub?.tag ?? "—"}
                          tone={nextAwayClub?.isPlayerClub ? "player" : "rival"}
                        />
                      </div>
                    </div>
                    <button
                      className="club-view-meeting-button"
                      onClick={() => {
                        setSelectedRound(nextMeeting.round);
                        setTeamView("schedule");
                      }}
                      type="button"
                    >
                      Voir la rencontre
                    </button>
                  </>
                ) : (
                  <div className="club-next-meeting-empty">
                    <CalendarDays aria-hidden="true" size={28} />
                    <span>
                      {championship
                        ? "Toutes les rencontres de cette saison sont terminées."
                        : "Le président peut inscrire l’équipe au prochain championnat."}
                    </span>
                  </div>
                )}
              </article>

              <section className="club-lineup">
                <header>
                  <strong>Composition</strong>
                  <span>{sortedTeamMembers.length}/5 titulaires</span>
                </header>
                <div className="club-lineup-grid">
                  {lineupSlots.map((member, index) => (
                    <ChampionshipLineupCard
                      championshipActive={Boolean(championship)}
                      duesAmount={dues.amount}
                      key={member?.id ?? `empty-${index}`}
                      member={member}
                      slot={index + 1}
                    />
                  ))}
                </div>
              </section>

            </>
          )}
        </div>
      ) : null}

{teamView !== "team" && championship ? (
            <div className="grid gap-5">
              <article
                aria-labelledby="club-championship-tab-standings"
                className={`rounded-md border border-white/10 bg-white/[0.04] p-4 ${
                  teamView === "standings" ? "" : "hidden"
                }`}
                id="club-championship-panel-standings"
                role="tabpanel"
              >
                <h3 className="font-black">Classement de la division</h3>
                <p className="mt-1 text-sm text-slate-300">
                  Du {new Date(championship.startsAt).toLocaleString("fr-FR")} au{" "}
                  {new Date(championship.endsAt).toLocaleString("fr-FR")}
                </p>
                <p className="mt-2 text-xs text-slate-400">
                  Classement : points de simples gagnés, différence de sets, différence de jeux,
                  tirage · {promotionEnabled ? "1er promu" : "Pas de montée en Elite 1"} ·{" "}
                  {relegationEnabled ? "13e relégué" : "Pas de relégation en Départementale 4"}
                </p>
                {nextMeeting ? (
                  <p className="mt-2 rounded-md bg-emerald-300/10 p-2 text-sm text-emerald-100">
                    Prochaine journée : J{nextMeeting.round} ·{" "}
                    {new Date(nextMeeting.startsAt).toLocaleString("fr-FR")}
                  </p>
                ) : null}
                <div className="club-standings-scroll mt-4 overflow-x-auto">
                  <table className="club-standings-table w-full text-left text-sm">
                    <thead className="text-slate-400">
                      <tr>
                        <th className="py-2">#</th>
                        <th>Club</th>
                        <th>Pts simples</th>
                        <th>V</th>
                        <th>Sets</th>
                        <th>Jeux</th>
                        <th>Prime</th>
                        <th>Sort</th>
                      </tr>
                    </thead>
                    <tbody>
                      {championship.standings.map((entry) => {
                        const movement =
                          entry.rank === 1 && promotionEnabled
                            ? "Montée"
                            : entry.rank === relegationRank && relegationEnabled
                              ? "Descente"
                              : "";
                        const displayedCashPrize =
                          (entry.cashPrize ?? 0) > 0
                            ? (entry.cashPrize ?? 0)
                            : (entry.projectedCashPrize ?? 0);
                        return (
                          <tr
                            key={entry.id}
                            className={`border-t border-white/10 ${
                              entry.isPlayerClub ? "text-emerald-200" : "text-slate-200"
                            }`}
                          >
                            <td className="py-2 font-bold">{entry.rank}</td>
                            <td>
                              [{entry.tag}] {entry.name}
                            </td>
                            <td className="font-bold">{entry.points}</td>
                            <td>{entry.wins}</td>
                            <td>{entry.setsFor - entry.setsAgainst}</td>
                            <td>{entry.gamesFor - entry.gamesAgainst}</td>
                            <td className="font-black text-amber-100">
                              {formatCredits(displayedCashPrize)}
                            </td>
                            <td>
                              {movement ? (
                                <span
                                  className={`rounded-md px-2 py-1 text-xs font-bold ${
                                    movement === "Montée"
                                      ? "bg-emerald-300/10 text-emerald-100"
                                      : "bg-rose-300/10 text-rose-100"
                                  }`}
                                >
                                  {movement}
                                </span>
                              ) : (
                                "-"
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </article>

              <article
                aria-labelledby="club-championship-tab-schedule"
                className={`w-full max-w-full overflow-hidden rounded-md border border-white/10 bg-white/[0.04] p-4 ${
                  teamView === "schedule" ? "" : "hidden"
                }`}
                id="club-championship-panel-schedule"
                role="tabpanel"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="font-black">Calendrier des rencontres</h3>
                    <p className="mt-1 text-xs text-slate-400">
                      Choisissez une journée pour voir les simples et les scores par set.
                    </p>
                  </div>
                  <div className="rounded-md border border-emerald-300/30 bg-emerald-300/10 px-3 py-2 text-xs font-bold text-emerald-100">
                    Prochaine : J{upcomingRound}
                  </div>
                </div>
                <div
                  className="mt-4 grid max-w-full gap-1.5"
                  style={{ gridTemplateColumns: `repeat(${rounds.length}, minmax(0, 1fr))` }}
                >
                  {rounds.map((round) => {
                    const isSelected = round === displayedRound;
                    const isUpcoming = round === upcomingRound;
                    return (
                      <button
                        className={`min-w-0 rounded-md border px-1 py-2 text-xs font-black sm:text-sm ${
                          isSelected
                            ? "border-emerald-300 bg-emerald-300 text-slate-950"
                            : isUpcoming
                              ? "animate-pulse border-cyan-300/60 bg-cyan-300/15 text-cyan-100"
                              : "border-white/10 bg-slate-950/45 text-slate-300 hover:border-emerald-300/40"
                        }`}
                        key={round}
                        onClick={() => setSelectedRound(round)}
                        type="button"
                      >
                        J{round}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-3 grid gap-2">
                  {displayedRoundMeetings.map((meeting) => {
                    const home = meeting.home
                      ? `[${meeting.home.tag}] ${meeting.home.name}`
                      : "Exempt";
                    const away = meeting.away
                      ? `[${meeting.away.tag}] ${meeting.away.name}`
                      : "Exempt";
                    const involvesPlayerClub = Boolean(
                      meeting.home?.isPlayerClub || meeting.away?.isPlayerClub
                    );
                    return (
                      <div
                        key={meeting.id}
                        className={`max-w-full overflow-hidden rounded-md border p-3 text-sm ${
                          involvesPlayerClub
                            ? "border-emerald-300/40 bg-emerald-300/10"
                            : "border-white/10 bg-slate-950/30"
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <strong>J{meeting.round}</strong>
                          <div className="flex items-center gap-2">
                            <span className="text-slate-400">
                              {new Date(meeting.startsAt).toLocaleString("fr-FR")}
                            </span>
                            <button
                              className="club-meeting-details-button"
                              onClick={() => setTeamMeetingDetails(meeting)}
                              type="button"
                            >
                              Détails
                            </button>
                          </div>
                        </div>
                        <div className="mt-2 grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-center">
                          <span className="min-w-0 truncate text-left">{home}</span>
                          <strong className="rounded-md bg-white/[0.08] px-3 py-2 text-base">
                            {meeting.status === "COMPLETED"
                              ? `${meeting.scoreHome} - ${meeting.scoreAway}`
                              : meeting.status === "EXEMPT"
                                ? "Exempt"
                                : "18h30"}
                          </strong>
                          <span className="min-w-0 truncate text-left sm:text-right">{away}</span>
                        </div>
                        {meeting.details?.singles?.length ? (
                          <div className="mt-3 grid min-w-0 gap-2 border-t border-white/10 pt-3">
                            {meeting.details.singles.map((single) => (
                              <div
                                key={single.label}
                                className="grid min-w-0 gap-2 rounded-md bg-slate-950/35 px-2 py-2 text-xs text-slate-300 md:grid-cols-[72px_minmax(0,1fr)_96px_minmax(0,1fr)_auto]"
                              >
                                <div className="flex items-center justify-between gap-2 md:block">
                                  <strong className="text-slate-100">{single.label}</strong>
                                  <span className="rounded-md bg-white/[0.08] px-2 py-1 text-center font-black text-white md:hidden">
                                    {single.scoreText}
                                  </span>
                                </div>
                                <span
                                  className={`min-w-0 truncate ${
                                    single.winner === "home" ? "font-bold text-emerald-200" : ""
                                  }`}
                                >
                                  {single.homePlayer.name} · {single.homePlayer.fftRanking}
                                </span>
                                <span className="hidden text-center font-black text-white md:block">
                                  {single.scoreText}
                                </span>
                                <span
                                  className={`min-w-0 truncate ${
                                    single.winner === "away" ? "font-bold text-emerald-200" : ""
                                  }`}
                                >
                                  {single.awayPlayer.name} · {single.awayPlayer.fftRanking}
                                </span>
                                {meeting.status === "COMPLETED" ? (
                                  single.replayMatchId ? (
                                    <Link
                                      className="w-full rounded-md border border-emerald-300/30 bg-emerald-300/10 px-2 py-1 text-center text-xs font-black text-emerald-100 hover:bg-emerald-300 hover:text-slate-950 md:w-auto"
                                      to={`/match/${single.replayMatchId}`}
                                    >
                                      Replay
                                    </Link>
                                  ) : (
                                    <button
                                      className="w-full rounded-md border border-emerald-300/30 bg-emerald-300/10 px-2 py-1 text-xs font-black text-emerald-100 hover:bg-emerald-300 hover:text-slate-950 md:w-auto"
                                      onClick={() =>
                                        setTeamReplay({
                                          single,
                                          homeClub: home,
                                          awayClub: away,
                                          round: meeting.round
                                        })
                                      }
                                      type="button"
                                    >
                                      Résumé
                                    </button>
                                  )
                                ) : null}
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </article>
            </div>
          ) : teamView !== "team" ? (
            <div className="rounded-md border border-white/10 bg-white/[0.04] p-4 text-sm text-slate-300">
              Aucun championnat planifié. Le président peut inscrire l'équipe au prochain cycle.
            </div>
          ) : null}
      {teamMeetingDetails ? (
        <TeamMeetingModal
          meeting={teamMeetingDetails}
          onClose={() => setTeamMeetingDetails(null)}
          onOpenSummary={(single, homeClub, awayClub) => {
            setTeamReplay({ single, homeClub, awayClub, round: teamMeetingDetails.round });
          }}
        />
      ) : null}
      {teamReplay
        ? createPortal(
            <div className="game-modal-overlay club-action-modal-overlay" data-club-modal>
              <div
                aria-labelledby="club-replay-modal-title"
                aria-modal="true"
                className="game-modal-panel panel max-w-3xl club-action-modal club-replay-modal"
                role="dialog"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-bold uppercase tracking-[0.2em] text-emerald-300">
                      Replay championnat · J{teamReplay.round}
                    </p>
                    <h2 className="mt-1 text-2xl font-black" id="club-replay-modal-title">{teamReplay.single.label}</h2>
                    <p className="mt-1 text-sm text-slate-300">
                      {teamReplay.homeClub} contre {teamReplay.awayClub}
                    </p>
                  </div>
                  <button
                    aria-label="Fermer le résumé du match"
                    className="rounded-md border border-white/10 bg-white/[0.06] p-2 text-slate-200"
                    data-club-modal-close
                    onClick={() => setTeamReplay(null)}
                    type="button"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-[1fr_auto_1fr]">
                  <div
                    className={`rounded-md border p-4 ${
                      teamReplay.single.winner === "home"
                        ? "border-emerald-300 bg-emerald-300/10"
                        : "border-white/10 bg-white/[0.04]"
                    }`}
                  >
                    <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Domicile</p>
                    <h3 className="mt-2 text-xl font-black">{teamReplay.single.homePlayer.name}</h3>
                    <p className="text-sm text-slate-300">
                      {teamReplay.single.homePlayer.fftRanking} · Valeur{" "}
                      {teamReplay.single.homeValue}
                    </p>
                  </div>
                  <div className="flex items-center justify-center rounded-md border border-white/10 bg-slate-950/60 px-5 py-4 text-center">
                    <div>
                      <p className="text-xs uppercase tracking-[0.16em] text-emerald-300">Score</p>
                      <p className="mt-1 text-2xl font-black">{teamReplay.single.scoreText}</p>
                      <p className="mt-1 text-xs text-slate-400">
                        Sets {teamReplay.single.homeSets}-{teamReplay.single.awaySets}
                      </p>
                    </div>
                  </div>
                  <div
                    className={`rounded-md border p-4 ${
                      teamReplay.single.winner === "away"
                        ? "border-emerald-300 bg-emerald-300/10"
                        : "border-white/10 bg-white/[0.04]"
                    }`}
                  >
                    <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Extérieur</p>
                    <h3 className="mt-2 text-xl font-black">{teamReplay.single.awayPlayer.name}</h3>
                    <p className="text-sm text-slate-300">
                      {teamReplay.single.awayPlayer.fftRanking} · Valeur{" "}
                      {teamReplay.single.awayValue}
                    </p>
                  </div>
                </div>

                <div className="mt-4 rounded-md border border-white/10 bg-white/[0.04] p-4 text-sm text-slate-300">
                  Ce replay reprend la logique du championnat par équipe : hiérarchie des
                  titulaires, valeur du joueur, tirage déterministe et score en deux sets gagnants.
                </div>
                <Button className="mt-4 w-full" data-club-modal-close onClick={() => setTeamReplay(null)}>
                  Fermer le replay
                </Button>
              </div>
            </div>,
            document.body
          )
        : null}
    </section>
    <ChampionshipSideRail
      busy={busy}
      division={championship?.division ?? data.team?.division ?? ""}
      dues={dues}
      memberCount={club.memberCount}
      onOpenCalendar={() => {
        setSelectedRound(upcomingRound);
        setTeamView("schedule");
      }}
      onOpenStandings={() => setTeamView("standings")}
      onPay={() => void payDues()}
      standings={championship?.standings ?? []}
    />
    </div>
  );
}

export function ClubPage() {
  const navigate = useNavigate();
  const player = useGameStore((state) => state.player)!;
  const refresh = useGameStore((state) => state.refresh);
  const patchPlayer = useGameStore((state) => state.patchPlayer);
  const [data, setData] = useState<MyClubData | null>(null);
  const [clubs, setClubs] = useState<ClubListItem[]>([]);
  const [clubsLoaded, setClubsLoaded] = useState(false);
  const [clubsLoading, setClubsLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [teamChampionshipData, setTeamChampionshipData] =
    useState<TeamChampionshipData | null>(null);
  const [form, setForm] = useState<ClubCreationForm>({
    name: "",
    tag: "",
    description: "",
    minimumRanking: "NC",
    duesAmount: 0
  });
  const [settingsForm, setSettingsForm] = useState({
    description: "",
    minimumRanking: "NC",
    duesAmount: 0
  });
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [leaveConfirmed, setLeaveConfirmed] = useState(false);
  const [successorPlayerId, setSuccessorPlayerId] = useState("");
  const [clubTab, setClubTab] = useState<ClubTab>(() => {
    if (typeof window === "undefined") return "team";
    const storedTab = window.sessionStorage.getItem("mypro-club-tab");
    return storedTab === "infra" || storedTab === "members" || storedTab === "requests"
      ? storedTab
      : "team";
  });
  const [clubDiscoveryTab, setClubDiscoveryTab] = useState<"create" | "join">("join");
  const requestDecisionLocks = useRef(new Set<string>());
  const joinRequestLock = useRef(false);
  const clubActionLocks = useRef(new Set<string>());
  const clubDirectoryLock = useRef(false);
  const clubCreationCost = 5000;
  useClubModalHistory(settingsOpen, () => setSettingsOpen(false));
  useClubModalHistory(leaveOpen, () => {
    setLeaveConfirmed(false);
    setLeaveOpen(false);
  });

  function renderClubScreen(
    content: React.ReactNode,
    options: { loading?: boolean; reserveNavigation?: boolean } = {}
  ) {
    const club = data?.club ?? null;
    const loading = options.loading ?? false;
    const showNavigation = Boolean(club || loading || options.reserveNavigation);
    return (
      <div className="club-cinematic">
        <section
          aria-busy={loading}
          className={`club-stage ${showNavigation ? "has-club-navigation" : ""}`}
        >
          <ClubHeader
            credits={player.budget}
            clubBudget={data?.club?.budget ?? null}
            onBack={() => {
              if (closeTopClubModal()) return;
              navigate("/dashboard");
            }}
            onHelp={() => {
              localStorage.setItem("mypro-tutorial-active", "1");
              navigate("/dashboard");
            }}
            onSettings={() => navigate("/settings")}
          />
          {club ? (
            <ClubNavigation active={clubTab} club={club} onChange={setClubTab} />
          ) : showNavigation ? (
            <ClubNavigationSkeleton />
          ) : null}
          <main className="club-content-scroll" id="club-main-content">{content}</main>
        </section>
      </div>
    );
  }

  async function loadClubData() {
    setLoadError("");
    try {
      const myClub = await api<MyClubData>("/clubs/me");
      setData(myClub);
      if (!myClub.club && clubDiscoveryTab === "join") void loadClubDirectory();
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Chargement du club impossible.");
    }
  }

  async function loadClubDirectory(force = false) {
    if (clubDirectoryLock.current || (clubsLoaded && !force)) return;
    clubDirectoryLock.current = true;
    setClubsLoading(true);
    try {
      setClubs(await api<ClubListItem[]>("/clubs"));
      setClubsLoaded(true);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Liste des clubs indisponible.");
    } finally {
      clubDirectoryLock.current = false;
      setClubsLoading(false);
    }
  }

  function beginClubAction(key: string) {
    if (clubActionLocks.current.has(key)) return false;
    clubActionLocks.current.add(key);
    setBusy(key);
    return true;
  }

  function endClubAction(key: string) {
    clubActionLocks.current.delete(key);
    setBusy((current) => (current === key ? null : current));
  }

  useEffect(() => void loadClubData(), []);

  useEffect(() => {
    if (data && !data.club && clubDiscoveryTab === "join") void loadClubDirectory();
  }, [clubDiscoveryTab, data?.club]);

  useEffect(() => {
    setTeamChampionshipData(null);
  }, [data?.club?.id]);

  useEffect(() => {
    window.sessionStorage.setItem("mypro-club-tab", clubTab);
  }, [clubTab]);

  useEffect(() => {
    if (data?.club) {
      setSettingsForm({
        description: data.club.description,
        minimumRanking: data.club.minimumRanking,
        duesAmount: clubDuesAmount(data.club)
      });
    }
  }, [data?.club?.id, data?.club?.description, data?.club?.minimumRanking, data?.club?.duesAmount]);

  async function createClub(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const actionKey = "create";
    if (!beginClubAction(actionKey)) return;
    setMessage("");
    try {
      const club = await api<ClubDetails>("/clubs", {
        method: "POST",
        body: JSON.stringify(form)
      });
      setData({ club, pendingRequest: null });
      setForm({ name: "", tag: "", description: "", minimumRanking: "NC", duesAmount: 0 });
      setTeamChampionshipData(null);
      patchPlayer((current) => ({ budget: Math.max(0, current.budget - clubCreationCost) }));
      void refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Création impossible.");
    } finally {
      endClubAction(actionKey);
    }
  }

  async function updateClubSettings(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const actionKey = "settings";
    if (!beginClubAction(actionKey)) return;
    setMessage("");
    try {
      const club = await api<ClubDetails>("/clubs/me/settings", {
        method: "PATCH",
        body: JSON.stringify(settingsForm)
      });
      setData((current) => ({ club, pendingRequest: current?.pendingRequest ?? null }));
      setSettingsOpen(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Modification impossible.");
    } finally {
      endClubAction(actionKey);
    }
  }

  async function upgradeBuilding(building: ClubBuilding) {
    const actionKey = `${building.id}-upgrade`;
    if (!beginClubAction(actionKey)) return;
    setMessage("");
    try {
      const club = await api<ClubDetails>(buildingUpgradePath(building.id), {
        method: "POST"
      });
      setData((current) => ({ club, pendingRequest: current?.pendingRequest ?? null }));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Amélioration impossible.");
    } finally {
      endClubAction(actionKey);
    }
  }

  async function leaveClub(nextPresidentId?: string) {
    if (!leaveConfirmed) return;
    const actionKey = "leave";
    if (!beginClubAction(actionKey)) return;
    setMessage("");
    try {
      const result = await api<ClubLeaveResponse>("/clubs/me/leave", {
        method: "POST",
        body: JSON.stringify(nextPresidentId ? { successorPlayerId: nextPresidentId } : {})
      });
      setLeaveOpen(false);
      setLeaveConfirmed(false);
      setSuccessorPlayerId("");
      setData({ club: result.club, pendingRequest: result.pendingRequest });
      setTeamChampionshipData(null);
      setMessage(result.message);
      if (result.refunded > 0) {
        patchPlayer((current) => ({ budget: current.budget + result.refunded }));
      }
      void refresh();
      if (!result.club) {
        setClubsLoaded(false);
        void loadClubDirectory(true);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Départ du club impossible.");
    } finally {
      endClubAction(actionKey);
    }
  }

  async function joinClub(clubId: string) {
    if (joinRequestLock.current || data?.pendingRequest) return;
    const actionKey = `join-${clubId}`;
    if (!beginClubAction(actionKey)) return;
    joinRequestLock.current = true;
    setMessage("");
    try {
      const result = await api<ClubJoinResponse>(`/clubs/${clubId}/join`, {
        method: "POST",
        body: JSON.stringify({ message: "" })
      });
      const selectedClub = clubs.find((club) => club.id === clubId);
      if (selectedClub) {
        setData({
          club: null,
          pendingRequest: {
            id: result.request.id,
            message: result.request.message,
            createdAt: result.request.createdAt,
            club: selectedClub
          }
        });
        setClubs((current) =>
          current.map((item) =>
            item.id === clubId ? { ...item, myRequestStatus: "PENDING" } : item
          )
        );
      } else {
        await loadClubData();
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Demande impossible.");
    } finally {
      joinRequestLock.current = false;
      endClubAction(actionKey);
    }
  }

  async function decideRequest(requestId: string, decision: "accept" | "reject") {
    if (requestDecisionLocks.current.has(requestId)) return;
    if (decision === "accept" && data?.club && !clubCanAcceptRequest(data.club)) {
      setMessage("Le club est complet. Améliorez le complexe ou libérez une place avant d’accepter.");
      return;
    }
    const actionKey = `${decision}-${requestId}`;
    if (!beginClubAction(actionKey)) return;
    requestDecisionLocks.current.add(requestId);
    setMessage("");
    try {
      const club = await api<ClubDetails>(`/clubs/requests/${requestId}/${decision}`, {
        method: "POST"
      });
      setData((current) => ({ club, pendingRequest: current?.pendingRequest ?? null }));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Action impossible.");
    } finally {
      requestDecisionLocks.current.delete(requestId);
      endClubAction(actionKey);
    }
  }

  if (!data) {
    if (loadError) {
      return renderClubScreen(
        <section className="club-load-error panel" role="alert">
          <Building2 aria-hidden="true" size={38} />
          <strong>Le club n’a pas pu être chargé</strong>
          <span>{loadError}</span>
          <button onClick={() => void loadClubData()} type="button">Réessayer</button>
        </section>,
        { reserveNavigation: true }
      );
    }
    return renderClubScreen(
      <>
        <span className="sr-only" aria-live="polite">Chargement du club</span>
        <ClubPageSkeleton />
      </>,
      { loading: true }
    );
  }

  if (data.club) {
    const club = data.club;
    const infrastructureBuildings = (["complex", "careCenter", "trainingCenter"] as const).map(
      (buildingId) => clubBuildingForClub(club, buildingId)
    );
    const departureMode = clubDepartureMode(club, player.id);
    const successorOptions = club.members.filter((member) => member.player.id !== player.id);
    const selectedSuccessorId = successorPlayerId || successorOptions[0]?.player.id || "";
    return renderClubScreen(
      <div className="club-main-layout">
        <ClubIdentityPanel
          club={club}
          onLeave={() => {
            setLeaveConfirmed(false);
            setLeaveOpen(true);
          }}
          onOpenSettings={() => setSettingsOpen(true)}
        />
        <div className="club-view-stack">

        {message ? (
          <div aria-live="polite" className="rounded-md border border-amber-300/30 bg-amber-300/10 p-3 text-sm text-amber-100" role="status">
            {message}
          </div>
        ) : null}

        {clubTab === "infra" ? (
          <section aria-labelledby="club-tab-infra" id="club-panel-infra" role="tabpanel">
            <ClubInfrastructurePanel
              buildings={infrastructureBuildings}
              busy={busy}
              club={club}
              onUpgrade={(selectedBuilding) => void upgradeBuilding(selectedBuilding)}
            />
          </section>
        ) : null}

        <section
          aria-labelledby="club-tab-team"
          hidden={clubTab !== "team"}
          id="club-panel-team"
          role="tabpanel"
        >
          <TeamChampionshipPanel
            club={club}
            key={club.id}
            onClubBudgetChanged={(amount) =>
              setData((current) =>
                current?.club
                  ? { ...current, club: { ...current.club, budget: current.club.budget + amount } }
                  : current
              )
            }
            onClubUpdated={loadClubData}
            onDataChange={setTeamChampionshipData}
          />
        </section>

        {club.isPresident && settingsOpen
          ? createPortal(
              <div className="game-modal-overlay club-action-modal-overlay" data-club-modal>
                <form
                  aria-labelledby="club-settings-modal-title"
                  aria-modal="true"
                  className="game-modal-panel panel max-w-2xl club-action-modal club-settings-modal"
                  onSubmit={updateClubSettings}
                  role="dialog"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-bold uppercase tracking-[0.22em] text-emerald-300">
                        Paramètres
                      </p>
                      <h2 className="mt-1 text-2xl font-black" id="club-settings-modal-title">Paramètres du club</h2>
                      <p className="mt-1 text-sm text-slate-300">
                        Ces informations sont visibles par les joueurs qui cherchent un club.
                      </p>
                    </div>
                    <button
                      aria-label="Fermer les paramètres du club"
                      className="rounded-md bg-white/10 p-2 text-slate-200 hover:bg-white/15"
                      data-club-modal-close
                      onClick={() => setSettingsOpen(false)}
                      type="button"
                    >
                      <X size={18} />
                    </button>
                  </div>
                  <div className="mt-5 grid gap-4">
                    <label className="grid gap-1 text-sm">
                      <span className="text-slate-300">Description du club</span>
                      <textarea
                        className="min-h-28 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 outline-none focus:border-emerald-300"
                        maxLength={280}
                        onChange={(event) =>
                          setSettingsForm((current) => ({
                            ...current,
                            description: event.target.value
                          }))
                        }
                        placeholder="Ambition, rythme de jeu, profil recherché..."
                        value={settingsForm.description}
                      />
                    </label>
                    <label className="grid gap-1 text-sm">
                      <span className="text-slate-300">Classement minimum pour rejoindre</span>
                      <select
                        className="rounded-md border border-white/10 bg-slate-950 px-3 py-2"
                        onChange={(event) =>
                          setSettingsForm((current) => ({
                            ...current,
                            minimumRanking: event.target.value
                          }))
                        }
                        value={settingsForm.minimumRanking}
                      >
                        {fftPath.map((ranking) => (
                          <option key={ranking} value={ranking}>
                            {ranking}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="grid gap-1 text-sm">
                      <span className="text-slate-300">Cotisation par joueur</span>
                      <Field
                        min={0}
                        max={50000}
                        onChange={(event) =>
                          setSettingsForm((current) => ({
                            ...current,
                            duesAmount: Math.max(0, Number(event.target.value) || 0)
                          }))
                        }
                        type="number"
                        value={settingsForm.duesAmount}
                      />
                    </label>
                  </div>
                  <div className="mt-6 flex flex-wrap justify-end gap-2">
                    <Button
                      className="bg-white/10 text-slate-100 hover:bg-white/15"
                      data-club-modal-close
                      onClick={() => setSettingsOpen(false)}
                      type="button"
                    >
                      Annuler
                    </Button>
                    <Button disabled={busy === "settings"} type="submit">
                      Enregistrer
                    </Button>
                  </div>
                </form>
              </div>,
              document.body
            )
          : null}

        {leaveOpen
          ? createPortal(
              <div className="game-modal-overlay club-action-modal-overlay" data-club-modal>
                <div
                  aria-labelledby="club-leave-modal-title"
                  aria-modal="true"
                  className="game-modal-panel panel max-w-xl club-action-modal club-leave-modal"
                  role="dialog"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-bold uppercase tracking-[0.22em] text-red-200">
                        Club
                      </p>
                      <h2 className="mt-1 text-2xl font-black" id="club-leave-modal-title">Quitter le club</h2>
                      <p className="mt-1 text-sm text-slate-300">
                        Cette action retire votre joueur de l'effectif du club.
                      </p>
                    </div>
                    <button
                      aria-label="Fermer"
                      className="rounded-md bg-white/10 p-2 text-slate-200 hover:bg-white/15"
                      data-club-modal-close
                      onClick={() => {
                        setLeaveConfirmed(false);
                        setLeaveOpen(false);
                      }}
                      type="button"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  {departureMode === "transfer" ? (
                    <div className="mt-5 grid gap-3">
                      <div className="rounded-md border border-amber-300/30 bg-amber-300/10 p-3 text-sm text-amber-100">
                        Vous êtes président. Pour quitter le club, vous devez désigner un nouveau
                        président parmi les membres.
                      </div>
                      <label className="grid gap-1 text-sm">
                        <span className="text-slate-300">Nouveau président</span>
                        <select
                          className="rounded-md border border-white/10 bg-slate-950 px-3 py-2"
                          onChange={(event) => setSuccessorPlayerId(event.target.value)}
                          value={selectedSuccessorId}
                        >
                          {successorOptions.map((member) => (
                            <option key={member.player.id} value={member.player.id}>
                              {member.player.name} - {member.player.fftRanking}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  ) : departureMode === "resale" ? (
                    <div className="mt-5 rounded-md border border-emerald-300/30 bg-emerald-300/10 p-3 text-sm text-emerald-100">
                      Vous êtes le seul joueur du club. Quitter le club revend automatiquement la
                      structure, supprime le club et vous récupérez 4 000 CR.
                    </div>
                  ) : (
                    <div className="mt-5 rounded-md border border-white/10 bg-white/[0.04] p-3 text-sm text-slate-300">
                      Vous pourrez rejoindre ou créer un autre club après votre départ.
                    </div>
                  )}

                  <label className="club-leave-confirmation">
                    <input
                      checked={leaveConfirmed}
                      onChange={(event) => setLeaveConfirmed(event.target.checked)}
                      type="checkbox"
                    />
                    <span>
                      Je confirme vouloir {departureMode === "resale" ? "revendre et supprimer ce club" : "quitter ce club"}.
                    </span>
                  </label>

                  <div className="mt-6 flex flex-wrap justify-end gap-2">
                    <Button
                      className="bg-white/10 text-slate-100 hover:bg-white/15"
                      data-club-modal-close
                      onClick={() => {
                        setLeaveConfirmed(false);
                        setLeaveOpen(false);
                      }}
                      type="button"
                    >
                      Annuler
                    </Button>
                    <Button
                      className="bg-red-300 text-slate-950 hover:bg-red-200"
                      disabled={
                        busy === "leave" ||
                        !leaveConfirmed ||
                        (departureMode === "transfer" && !selectedSuccessorId)
                      }
                      onClick={() =>
                        void leaveClub(departureMode === "transfer" ? selectedSuccessorId : undefined)
                      }
                      type="button"
                    >
                      {departureMode === "resale"
                        ? "Revendre et quitter"
                        : "Quitter le club"}
                    </Button>
                  </div>
                </div>
              </div>,
              document.body
            )
          : null}

        {clubTab === "members" ? (
          <section aria-labelledby="club-tab-members" id="club-panel-members" role="tabpanel">
            <ClubRosterPanel championshipData={teamChampionshipData} club={club} />
          </section>
        ) : null}

        {clubTab === "requests" ? (
          <section aria-labelledby="club-tab-requests" id="club-panel-requests" role="tabpanel">
            <ClubRequestsPanel
              busy={busy}
              club={club}
              onDecision={(requestId, decision) => void decideRequest(requestId, decision)}
            />
          </section>
        ) : null}
        </div>
      </div>
    );
  }

  return renderClubScreen(
    <div className="club-discovery-page">
      <section className="club-discovery-hero">
        <header>
          <div className="club-discovery-emblem"><Shield aria-hidden="true" size={58} /><Users aria-hidden="true" size={24} /></div>
          <div>
            <span>Rejoignez la compétition collective</span>
            <h1>Créer ou rejoindre un club</h1>
            <p>Choisissez une structure adaptée à votre classement ou fondez votre propre projet.</p>
          </div>
          <div className="club-discovery-player-status">
            <Trophy aria-hidden="true" size={18} />
            <span><small>Votre classement</small><strong>{player.fftRanking}</strong></span>
            <Coins aria-hidden="true" size={18} />
            <span><small>Vos crédits</small><strong>{formatCredits(player.budget)}</strong></span>
          </div>
        </header>
        {data.pendingRequest ? (
          <div className="club-discovery-pending">
            <Inbox aria-hidden="true" size={18} />
            <span>
              <strong>Demande d’adhésion en attente</strong>
              [{data.pendingRequest.club.tag}] {data.pendingRequest.club.name} examine votre candidature. Vous ne pouvez pas envoyer une autre demande entre-temps.
            </span>
          </div>
        ) : null}
        {message ? (
          <div aria-live="polite" className="club-discovery-message" role="status">{message}</div>
        ) : null}
        <nav className="club-discovery-tabs" aria-label="Créer ou rejoindre un club" role="tablist">
          {[
            ["join", "Rejoindre", `${clubs.length} clubs`],
            ["create", "Créer", formatCredits(clubCreationCost)]
          ].map(([value, label, meta]) => (
            <button
              aria-controls={`club-discovery-panel-${value}`}
              aria-selected={clubDiscoveryTab === value}
              className={clubDiscoveryTab === value ? "is-active" : ""}
              id={`club-discovery-tab-${value}`}
              key={value}
              onClick={() => setClubDiscoveryTab(value as "create" | "join")}
              role="tab"
              type="button"
            >
              <span>{label}</span>
              <small>{meta}</small>
            </button>
          ))}
        </nav>
      </section>

      <section className="club-discovery-content">
        {clubDiscoveryTab === "create" ? (
          <div aria-labelledby="club-discovery-tab-create" id="club-discovery-panel-create" role="tabpanel">
            <ClubCreationPanel
              busy={busy === "create"}
              creationCost={clubCreationCost}
              form={form}
              onSubmit={createClub}
              pendingRequest={data.pendingRequest}
              playerBudget={player.budget}
              setForm={setForm}
            />
          </div>
        ) : null}

        {clubDiscoveryTab === "join" ? (
          <div aria-labelledby="club-discovery-tab-join" id="club-discovery-panel-join" role="tabpanel">
            <ClubSearchPanel
              busy={busy}
              clubs={clubs}
              loading={clubsLoading || !clubsLoaded}
              onCreateFirst={() => setClubDiscoveryTab("create")}
              onJoin={(clubId) => void joinClub(clubId)}
              pendingRequest={data.pendingRequest}
              playerRanking={player.fftRanking}
            />
          </div>
        ) : null}
      </section>
    </div>
  );
}
