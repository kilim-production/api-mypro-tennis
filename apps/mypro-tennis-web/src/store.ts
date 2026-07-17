import { create } from "zustand";
import { ApiError, api, clearToken, saveToken } from "./api";

export type Player = {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  nationality: string;
  gender: string;
  dominantHand: string;
  backhand: string;
  archetype: string;
  avatar: string;
  isAi: boolean;
  stats: Record<string, number>;
  actionEnergy: number;
  actionEnergyMax: number;
  actionEnergyNextAt: string | null;
  actionEnergyUpdatedAt: string;
  actionEnergyRechargeMinutes?: number;
  clubCareCenterLevel?: number;
  energy: number;
  morale: number;
  fatigue: number;
  health: number;
  reputation: number;
  budget: number;
  gems: number;
  careerCashPrizeWon: number;
  playerLevel: number;
  playerXp: number;
  skillPoints: number;
  spentSkillPoints: number;
  overall: number;
  rankingPoints: number;
  worldRank: number;
  fftRanking: string;
  fftRankingValidated: boolean;
  amateurPoints: number;
  careerStage: string;
  proUnlocked: boolean;
  wins: number;
  losses: number;
};

type User = { id: string; email: string; displayName: string; googleLinked: boolean };
export type GameNotification = {
  id: string;
  title: string;
  body: string;
  type: string;
  readAt: string | null;
  createdAt: string;
};

type State = {
  user: User | null;
  player: Player | null;
  notifications: GameNotification[];
  booted: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (displayName: string, email: string, password: string) => Promise<void>;
  refresh: () => Promise<void>;
  patchPlayer: (patch: Partial<Player> | ((player: Player) => Partial<Player>)) => void;
  markNotificationsRead: (notificationIds?: string[]) => void;
  logout: () => void;
};

const sessionCacheKey = "mypro-session-cache";

type SessionCache = {
  user: User | null;
  player: Player | null;
  notifications: GameNotification[];
};

function readSessionCache(): SessionCache {
  try {
    const raw = localStorage.getItem(sessionCacheKey);
    if (!raw) return { user: null, player: null, notifications: [] };
    const parsed = JSON.parse(raw) as Partial<SessionCache>;
    return {
      user: parsed.user ?? null,
      player: parsed.player ?? null,
      notifications: parsed.notifications ?? []
    };
  } catch {
    return { user: null, player: null, notifications: [] };
  }
}

function saveSessionCache(cache: SessionCache) {
  localStorage.setItem(sessionCacheKey, JSON.stringify(cache));
}

function clearSessionCache() {
  localStorage.removeItem(sessionCacheKey);
}

const cachedSession = readSessionCache();
const hasSavedToken = Boolean(localStorage.getItem("mypro-token"));

export const useGameStore = create<State>((set) => ({
  user: cachedSession.user,
  player: cachedSession.player,
  notifications: cachedSession.notifications,
  // Render the cached career immediately, then refresh it in the background.
  booted: !hasSavedToken || Boolean(cachedSession.user),
  async login(email, password) {
    const data = await api<{ token: string; user: User; player: Player | null }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password })
    });
    saveToken(data.token);
    saveSessionCache({ user: data.user, player: data.player, notifications: [] });
    set({ user: data.user, player: data.player, booted: true });
  },
  async signup(displayName, email, password) {
    const data = await api<{ token: string; user: User }>("/auth/signup", {
      method: "POST",
      body: JSON.stringify({ displayName, email, password })
    });
    saveToken(data.token);
    saveSessionCache({ user: data.user, player: null, notifications: [] });
    set({ user: data.user, player: null, booted: true });
  },
  async refresh() {
    if (!localStorage.getItem("mypro-token")) {
      clearSessionCache();
      set({ user: null, player: null, notifications: [], booted: true });
      return;
    }
    try {
      const data = await api<{
        user: User;
        player: Player | null;
        notifications: GameNotification[];
      }>("/auth/me");
      set({
        user: data.user,
        player: data.player,
        notifications: data.notifications,
        booted: true
      });
      saveSessionCache({
        user: data.user,
        player: data.player,
        notifications: data.notifications
      });
    } catch (error) {
      if (error instanceof ApiError && [401, 403].includes(error.status)) {
        clearToken();
        clearSessionCache();
        set({ user: null, player: null, notifications: [], booted: true });
        return;
      }
      const fallback = readSessionCache();
      set({
        user: fallback.user,
        player: fallback.player,
        notifications: fallback.notifications,
        booted: true
      });
    }
  },
  patchPlayer(patch) {
    set((state) => {
      if (!state.player) return state;
      const player = {
        ...state.player,
        ...(typeof patch === "function" ? patch(state.player) : patch)
      };
      saveSessionCache({
        user: state.user,
        player,
        notifications: state.notifications
      });
      return { player };
    });
  },
  markNotificationsRead(notificationIds) {
    set((state) => {
      const selectedIds = notificationIds ? new Set(notificationIds) : null;
      const readAt = new Date().toISOString();
      const notifications = state.notifications.map((notification) =>
        !notification.readAt && (!selectedIds || selectedIds.has(notification.id))
          ? { ...notification, readAt }
          : notification
      );
      saveSessionCache({ user: state.user, player: state.player, notifications });
      return { notifications };
    });
  },
  logout() {
    clearToken();
    clearSessionCache();
    set({ user: null, player: null, notifications: [] });
  }
}));
