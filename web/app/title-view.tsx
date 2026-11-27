"use client";

import { useRef, useState } from "react";
import { Check, ListPlus, Plus, RotateCcw } from "lucide-react";
import type { ShelfEntry, ShelfStatus } from "../db/shelf-types";
import { nextEpisode } from "../lib/progress";
import type { TitleDetail } from "../lib/titles";
import { Feedback, genreNames, kindNames, Poster, statuses } from "./collection";
import { EpisodeList, episodeCode, formatDate } from "./series-detail";
import { SessionHistory } from "./session-history";
import { request, RequestError } from "./use-resource";

type Mutation = {
  path: string;
  method: "PUT" | "PATCH" | "DELETE";
  body?: Record<string, unknown>;
  message: string;
  bulkId?: string;
};
type Props = { detail: TitleDetail; entry?: ShelfEntry; accessible: boolean; reload: () => Promise<void> };

function localToday() {
  const now = new Date();
  return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0"), String(now.getDate()).padStart(2, "0")].join("-");
}

export function TitleView({ detail, entry, accessible, reload }: Props) {
  const { title, episodes } = detail;
  const movie = title.kind === "movie";
  const sessions = entry?.sessions ?? [];
  const watched = new Map<number, string[]>();
  for (const session of sessions) {
    if (session.episodeId !== null) {
      const ids = watched.get(session.episodeId);
      if (ids) ids.push(session.id);
      else watched.set(session.episodeId, [session.id]);
    }
  }
  const next = nextEpisode(episodes, Array.from(watched.keys()));
  const upcoming = episodes.find(item => !item.special && !item.available && !watched.has(item.id));
  const movieSessions = sessions.filter(session => session.episodeId === null);
  const today = localToday();
  const dateField = useRef<HTMLInputElement>(null);
  const [historyFilter, setHistoryFilter] = useState<number | null>(null);
  const [undoId, setUndoId] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<RequestError | null>(null);
  const [message, setMessage] = useState("");
  const busy = useRef(false);
  const lastAction = useRef<Mutation | null>(null);
  const watchIds = useRef(new Map<string, string>());
  const disabled = working || !accessible;
  const base = "/api/shelf/" + encodeURIComponent(title.key);
  const source = title.key.startsWith("wikidata-") ? "Wikidata" : "TVmaze";

  async function change(action: Mutation) {
    if (busy.current || !accessible) return false;
    busy.current = true;
    setWorking(true);
    setError(null);
    setMessage("");
    lastAction.current = action;
    try {
      await request(base + action.path, {
        method: action.method,
        headers: action.body ? { "Content-Type": "application/json" } : undefined,
        body: action.body ? JSON.stringify(action.body) : undefined,
      });
      // A verified command can be repeated intentionally; ambiguous writes retain their original UUID.
      if (action.path.startsWith("/watches/")) {
        for (const [signature, id] of watchIds.current) {
          if (action.path.endsWith("/" + id)) watchIds.current.delete(signature);
        }
      }
      if (action.bulkId) setUndoId(action.bulkId);
      await reload();
      setMessage(action.message);
      return true;
    } catch (reason) {
      setError(reason instanceof RequestError ? reason : new RequestError("Falha ao salvar a alteração.", 0));
      return false;
    } finally {
      busy.current = false;
      setWorking(false);
    }
  }

  function mark(ids: (number | null)[], rewatch = false, bulk = false) {
    if (!dateField.current?.reportValidity()) return Promise.resolve(false);
    const watchedOn = dateField.current.value;
    const key = JSON.stringify([ids, watchedOn, rewatch]);
    const id = watchIds.current.get(key) ?? crypto.randomUUID();
    watchIds.current.set(key, id);
    return change({ path: "/watches/" + id, method: "PUT", body: { episodeIds: ids, watchedOn, rewatch },
      message: rewatch ? "Reassistida registrada." : bulk ? "Marcação em lote salva." : "Marcação salva.", bulkId: bulk ? id : undefined });
  }

  async function undo(id: string) {
    const ok = await change({ path: "/watches/" + encodeURIComponent(id), method: "DELETE", message: "Marcação desfeita." });
    if (ok && undoId === id) setUndoId(null);
    return ok;
  }

  function remove(id: string) {
    return change({ path: "/sessions/" + encodeURIComponent(id), method: "DELETE", message: "Sessão removida." });
  }
  function saveStatus(status: ShelfStatus) {
    return change({ path: "", method: "PUT", body: { status }, message: "Biblioteca atualizada." });
  }
  const currentStatus = entry?.status;
  let nextLabel = "Aguardando episódios";
  let nextDescription = upcoming ? upcoming.name + " · " + formatDate(upcoming.airdate) : "Nenhum episódio regular disponível para marcar.";
  if (next) { nextLabel = "Próximo episódio"; nextDescription = episodeCode(next) + " · " + next.name; }
  else if (watched.size) nextLabel = "Você está em dia";
  if (movie) {
    nextLabel = movieSessions.length ? "Filme assistido" : "Registrar filme";
    nextDescription = movieSessions.length
      ? "Última sessão em " + formatDate(movieSessions.map(session => session.watchedOn).sort().at(-1) ?? null)
      : "Marque o filme com a data em que assistiu.";
  }
  return <>
    <header className="detail-header"><Poster title={title} /><div>
      <h1>{title.name}</h1>
      <p className="metadata">{[kindNames[title.kind], title.year, ...genreNames(title)].filter(Boolean).join(" · ")}</p>
      {detail.description && <p className="title-description">{detail.description}</p>}
      {title.productionStatus && <p className="muted">{title.productionStatus}</p>}
      <a className="source" href={title.sourceUrl} target="_blank" rel="noreferrer">Ficha no {source}</a>
      {accessible && <div className="detail-action">
        {currentStatus ? <label className="filter-field"><span>Na minha biblioteca</span>
          <select disabled={disabled} value={currentStatus} onChange={event => saveStatus(event.target.value as ShelfStatus)}>
            {Object.entries(statuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select></label>
          : <button type="button" className="button dark" disabled={disabled} onClick={() => saveStatus("planned")}><Plus size={18} aria-hidden="true" />Adicionar à biblioteca</button>}
        {currentStatus && <button type="button" className="text-action" disabled={disabled} title="As sessões ficam no histórico" onClick={() => change({ path: "", method: "DELETE", message: "Título retirado da biblioteca. Histórico preservado." })}>Retirar da biblioteca</button>}
        <a className="list-link" href={"/listas?titulo=" + encodeURIComponent(title.key)}><ListPlus size={17} aria-hidden="true" />Adicionar a uma lista</a>
      </div>}
    </div></header>
    {error && <Feedback error={error} retry={() => { if (lastAction.current) void change(lastAction.current); }} />}
    {accessible && <>
      <section className="next-block" aria-labelledby="next-heading">
        <div><h2 id="next-heading">{nextLabel}</h2><p>{nextDescription}</p></div>
        <div className="watch-tools"><label>Data da sessão<input type="date" defaultValue={today} ref={dateField} max={today} required /></label>
          {(movie || next) && <button className="button gold" type="button" disabled={disabled}
            onClick={() => mark([movie ? null : next!.id], movie && movieSessions.length > 0)}>
            {movie && movieSessions.length ? <RotateCcw size={17} aria-hidden="true" /> : <Check size={17} aria-hidden="true" />}
            {movie && movieSessions.length ? "Registrar reassistida" : "Marcar como visto"}</button>}
        </div>
      </section>
      <div className="action-status" role="status">{working ? "Salvando…" : message}
        {undoId && <button type="button" className="text-action" onClick={() => undo(undoId)} disabled={disabled}>Desfazer último lote</button>}</div>
    </>}
    {!movie && <EpisodeList episodes={episodes} next={next} sessions={watched} disabled={disabled}
      mark={(ids, rewatch = false, bulk = false) => mark(ids, rewatch, bulk)} remove={remove} showHistory={id => {
        setHistoryFilter(id);
        document.getElementById("history-heading")?.focus();
      }} />}
    {accessible && <SessionHistory sessions={sessions} episodes={episodes} titleName={title.name}
      filter={historyFilter} clearFilter={() => setHistoryFilter(null)} disabled={disabled} today={today}
      correct={(id, date) => change({ path: "/sessions/" + encodeURIComponent(id), method: "PATCH", body: { watchedOn: date }, message: "Data corrigida." })}
      remove={remove} undo={undo} />}
  </>;
}
