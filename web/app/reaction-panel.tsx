"use client";

import { useState, type FormEvent } from "react";
import { ChevronDown } from "lucide-react";
import { emotions, type Cast, type Reaction } from "../lib/reaction-types";
import type { Episode, TitleDetail } from "../lib/titles";
import { Feedback } from "./collection";
import { episodeCode } from "./series-detail";
import { request, RequestError, useResource } from "./use-resource";
import "./reactions.css";

const ratings = Array.from({ length: 10 }, (_, index) => (index + 1) / 2);

function ReactionForm({ url, saved, cast, castError, reloadCast, updated, message }: {
  url: string; saved: Reaction; cast: Cast | null; castError: RequestError | null;
  reloadCast: () => void; updated: () => Promise<void>; message: (value: string) => void;
}) {
  const [rating, setRating] = useState(saved.rating?.toString() ?? "");
  const [emotion, setEmotion] = useState(saved.emotion ?? "");
  const [characterId, setCharacterId] = useState(saved.character?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const characters = [...(cast?.characters ?? [])];
  if (saved.character && !characters.some(item => item.id === saved.character!.id)) characters.push(saved.character);
  characters.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  const dirty = rating !== (saved.rating?.toString() ?? "") || emotion !== (saved.emotion ?? "") ||
    characterId !== (saved.character?.id ?? "");

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || !dirty) return;
    setBusy(true);
    setError("");
    message("");
    try {
      await request<Reaction>(url, { method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revision: saved.revision, rating: rating ? Number(rating) : null,
          emotion: emotion || null, characterId: characterId || null, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }) });
      await updated();
      message("Reação salva.");
    } catch (reason) {
      const detail = reason instanceof RequestError ? reason.message : "Não foi possível salvar a reação.";
      if (reason instanceof RequestError && reason.status === 409) {
        await updated();
        message(detail);
      } else setError(detail);
    } finally {
      setBusy(false);
    }
  }

  return <form className="reaction-form" onSubmit={submit}>
    <div className="reaction-fields">
      <label className="filter-field"><span>Minha nota</span>
        <select value={rating} disabled={busy} onChange={event => setRating(event.target.value)}>
          <option value="">Sem nota</option>
          {ratings.map(value => <option key={value} value={value}>{value.toLocaleString("pt-BR")} {value === 1 || value === .5 ? "estrela" : "estrelas"}</option>)}
        </select></label>
      <label className="filter-field"><span>Emoção</span>
        <select value={emotion} disabled={busy} onChange={event => setEmotion(event.target.value)}>
          <option value="">Sem emoção</option>
          {emotions.map(item => <option key={item}>{item}</option>)}
        </select></label>
      <label className="filter-field"><span>Personagem favorito</span>
        <select value={characterId} disabled={busy || !characters.length} onChange={event => setCharacterId(event.target.value)}>
          <option value="">Sem personagem favorito</option>
          {characters.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select></label>
    </div>
    {castError ? <Feedback error={castError} retry={reloadCast} />
      : !cast ? <p className="muted">Consultando o elenco…</p>
      : cast.warning ? <p className="muted">{cast.warning} <button type="button" className="text-action" onClick={reloadCast}>Tentar novamente</button></p>
      : !cast.characters.length ? <p className="muted">O catálogo ainda não informa personagens para este título.</p>
      : <p className="muted">{url.endsWith("/movie") ? "Personagens identificados no Wikidata." : "Elenco principal da série e convidados do episódio no TVmaze."}</p>}
    <button type="submit" className="button dark" disabled={!dirty || busy}>{busy ? "Salvando…" : "Salvar reação"}</button>
    {error && <p role="alert">{error}</p>}
  </form>;
}

function Editor({ url }: { url: string }) {
  const reaction = useResource<Reaction>(url, true);
  const cast = useResource<Cast>(url + "?cast=1");
  const [status, setStatus] = useState("");
  return <>
    {reaction.error && <Feedback error={reaction.error} retry={reaction.refresh} />}
    {reaction.data ? <ReactionForm key={reaction.data.revision} url={url} saved={reaction.data}
      cast={cast.data} castError={cast.error} reloadCast={cast.refresh} updated={reaction.refresh} message={setStatus} />
      : !reaction.error && <p className="muted">Carregando sua reação…</p>}
    <div role="status" className="action-status">{status}</div>
  </>;
}

const group = (episode: Episode) => episode.special ? "specials" : String(episode.season);

export function ReactionPanel({ detail, initialEpisodeId }: { detail: TitleDetail; initialEpisodeId?: number | null }) {
  const [open, setOpen] = useState(false);
  const episodes = detail.episodes.filter(item => item.available);
  const initial = episodes.find(item => item.id === initialEpisodeId) ?? episodes[0];
  const [season, setSeason] = useState(initial ? group(initial) : "");
  const [selected, setSelected] = useState<number | undefined>(initial?.id);
  const inSeason = episodes.filter(item => group(item) === season);
  const target = detail.title.kind === "movie" ? "movie" : selected;
  const seasons = [...new Set(episodes.filter(item => !item.special).map(group))];
  if (episodes.some(item => item.special)) seasons.push("specials");
  const url = target ? "/api/reactions/" + encodeURIComponent(detail.title.key) + "/" + target : null;
  function chooseSeason(value: string) {
    setSeason(value);
    setSelected(episodes.find(item => group(item) === value)?.id);
  }
  return <section className="reaction-panel" aria-labelledby="reaction-heading">
    <h2 id="reaction-heading"><button type="button" className="reaction-disclosure" onClick={() => setOpen(!open)}
      aria-expanded={open} aria-controls="reaction-content">Minha reação <ChevronDown size={20} aria-hidden="true" /></button></h2>
    <div id="reaction-content" hidden={!open}>{open && <>
      {detail.title.kind !== "movie" && seasons.length > 0 && <div className="reaction-fields reaction-target">
        <label className="filter-field"><span>Temporada da reação</span><select value={season} onChange={event => chooseSeason(event.target.value)}>
          {seasons.map(value => <option value={value} key={value}>{value === "specials" ? "Especiais" : "Temporada " + value}</option>)}
        </select></label>
        <label className="filter-field"><span>Episódio da reação</span><select value={selected}
          onChange={event => setSelected(Number(event.target.value))}>
          {inSeason.map(item => <option key={item.id} value={item.id}>{episodeCode(item)} · {item.name}</option>)}
        </select></label>
      </div>}
      {url ? <Editor key={url} url={url} /> : <p className="muted">A reação fica disponível quando há episódios já exibidos.</p>}
    </>}</div>
  </section>;
}
