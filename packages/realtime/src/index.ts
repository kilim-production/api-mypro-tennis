export type PresenceUser = {
  userId: string;
  playerId?: string;
  displayName: string;
  connectedAt: string;
};

export class PresenceRegistry {
  private users = new Map<string, PresenceUser>();

  upsert(socketId: string, user: PresenceUser) {
    this.users.set(socketId, user);
  }

  remove(socketId: string) {
    this.users.delete(socketId);
  }

  list() {
    return Array.from(this.users.values());
  }
}
