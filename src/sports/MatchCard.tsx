import { Star, ChevronRight } from "lucide-react";
import { live, matchDate, matchTime, statusLabel } from "./analysis";
import type { Match } from "./types";
export default function MatchCard({
  match: m,
  starred,
  showDate = false,
  onStar,
  onOpen,
}: {
  match: Match;
  starred: boolean;
  showDate?: boolean;
  onStar: () => void;
  onOpen: () => void;
}) {
  return (
    <article className="sports-match">
      <button
        className={"sports-star icon-button" + (starred ? " selected" : "")}
        aria-label={
          (starred ? "Remover dos" : "Adicionar aos") +
          " favoritos: " +
          m.home.name +
          " × " +
          m.away.name
        }
        aria-pressed={starred}
        onClick={onStar}
      >
        <Star size={18} fill={starred ? "currentColor" : "none"} />
      </button>
      <button className="sports-match-open" onClick={onOpen}>
        <span className="sports-match-time">
          <strong>{matchTime(m.kickoff)}</strong>
          {showDate && <small className="muted">{matchDate(m.kickoff)}</small>}
          <small className={live(m) ? "positive" : "muted"}>
            {statusLabel(m)}
          </small>
        </span>
        <span className="sports-match-teams">
          <span>
            {m.home.name}
            <b>{m.homeGoals ?? "—"}</b>
          </span>
          <span>
            {m.away.name}
            <b>{m.awayGoals ?? "—"}</b>
          </span>
        </span>
        <span className="sports-open-label">
          Analisar <ChevronRight size={16} />
        </span>
      </button>
    </article>
  );
}
