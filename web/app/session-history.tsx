"use client";

import { useState } from "react";
import type { WatchSession } from "../db/shelf-types";
import type { Episode } from "../lib/titles";
import { countLabel } from "./collection";
import { episodeCode, formatDate } from "./series-detail";

type Props = {
  sessions: WatchSession[];
  episodes: Episode[];
  titleName: string;
  filter: number | null;
  clearFilter: () => void;
  disabled: boolean;
  today: string;
  correct: (id: string, date: string) => Promise<boolean>;
  remove: (id: string) => Promise<boolean>;
  undo: (id: string) => Promise<boolean>;
};

export function SessionHistory({ sessions, episodes, titleName, filter, clearFilter, disabled, today, correct, remove, undo }: Props) {
  const [limit, setLimit] = useState(12);
  const [editing, setEditing] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const known = new Map(episodes.map(episode => [episode.id, episode]));
  const operations = new Map<string, number>();
  for (const session of sessions) {
    if (session.operationId) operations.set(session.operationId, (operations.get(session.operationId) ?? 0) + 1);
  }
  const history = sessions.filter(item => filter === null || item.episodeId === filter)
    .sort((a, b) => b.watchedOn.localeCompare(a.watchedOn) || a.id.localeCompare(b.id));
  const renderedOps = new Set<string>();
  return <section id="historico" className="history-section" aria-labelledby="history-heading">
    <div className="section-heading"><h2 id="history-heading" tabIndex={-1}>Histórico de sessões</h2>
      <span>{countLabel(history.length, "sessão", "sessões")}</span></div>
    {filter !== null && <button className="text-action" onClick={clearFilter}>Mostrar todas as sessões</button>}
    {!history.length && <p className="muted">As sessões aparecem aqui quando você marca um título ou episódio como visto.</p>}
    <ul className="history-list">{history.slice(0, limit).map(session => {
      const episode = session.episodeId === null ? undefined : known.get(session.episodeId);
      const name = session.episodeId === null ? titleName : episode ? episodeCode(episode) + " · " + episode.name : "Episódio " + session.episodeId;
      const op = session.operationId;
      const groupSize = op ? operations.get(op) ?? 0 : 0;
      const groupStart = op && groupSize > 1 && !renderedOps.has(op);
      if (op) renderedOps.add(op);
      const confirmSession = confirm === session.id;
      const confirmGroup = groupStart && confirm === "group:" + op;
      return <li key={session.id}>
        <div className="history-row"><div><time dateTime={session.watchedOn}>{formatDate(session.watchedOn)}</time><h3>{name}</h3></div>
          <div className="row-links">
            <button type="button" className="text-action" disabled={disabled} onClick={() => { setEditing(session.id); setConfirm(null); }}>Editar data</button>
            <button type="button" className="text-action" disabled={disabled} onClick={() => { setConfirm(session.id); setEditing(null); }}>Remover sessão</button>
            {groupStart && <button type="button" className="text-action" disabled={disabled} onClick={() => { setConfirm("group:" + op); setEditing(null); }}>Desfazer lote ({groupSize})</button>}
          </div></div>
        {editing === session.id && <form className="inline-controls" onSubmit={async event => {
          event.preventDefault();
          const date = new FormData(event.currentTarget).get("date");
          if (typeof date === "string" && await correct(session.id, date)) setEditing(null);
        }}>
          <label>Data da sessão <input name="date" type="date" required max={today} defaultValue={session.watchedOn} /></label>
          <button type="submit" className="button dark" disabled={disabled}>Salvar data</button>
          <button type="button" className="text-action" onClick={() => setEditing(null)}>Cancelar</button>
        </form>}
        {(confirmSession || confirmGroup) && <div className="inline-controls">
          <span>{confirmGroup ? "Remover as " + groupSize + " sessões deste lote?" : "Remover esta sessão do histórico?"}</span>
          <button type="button" className="button dark" disabled={disabled} onClick={async () => {
            const ok = confirmGroup && op ? await undo(op) : await remove(session.id);
            if (ok) setConfirm(null);
          }}>Confirmar</button><button type="button" className="text-action" onClick={() => setConfirm(null)}>Cancelar</button>
        </div>}
      </li>;
    })}</ul>
    {history.length > limit && <button type="button" className="button plain" onClick={() => setLimit(limit + 24)}>Ver mais sessões</button>}
  </section>;
}
