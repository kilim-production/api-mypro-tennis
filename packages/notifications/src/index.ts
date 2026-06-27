export type NotificationPayload = {
  userId: string;
  title: string;
  body: string;
  type: "match" | "entrainement" | "defi" | "systeme";
};

export function notificationText(payload: NotificationPayload) {
  return `${payload.title} - ${payload.body}`;
}
