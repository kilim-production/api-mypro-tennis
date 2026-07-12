import type { LucideIcon } from "lucide-react";

type LobbyActionButtonProps = {
  icon: LucideIcon;
  label: string;
  detail: string;
  badge?: string | undefined;
  onClick: () => void;
};

export function LobbyActionButton({
  icon: Icon,
  label,
  detail,
  badge,
  onClick
}: LobbyActionButtonProps) {
  return (
    <button className="lobby-action-button" onClick={onClick} type="button">
      <span className="lobby-action-icon" aria-hidden="true">
        <Icon size={22} />
      </span>
      <span className="lobby-action-copy">
        <strong>{label}</strong>
        <small>{detail}</small>
      </span>
      {badge ? <span className="lobby-action-badge">{badge}</span> : null}
    </button>
  );
}
