"use client";

import { useState } from "react";
import { Check, ChevronDown, Plus } from "lucide-react";
import type { Episode, ShowDetail } from "../lib/catalog";
import { nextEpisode } from "../lib/progress";
import { Poster, type LibraryData } from "./collection";

const episodeCode = (episode: Episode) => "T" + episode.season + " · E" + String(episode.number).padStart(2, "0");

function formatDate(airdate: string | null): string {
  if (!airdate) return "Data a confirmar";
  const [year, month, day] = airdate.split("-");
  return year && month && day ? [day, month, year].join("/") : airdate;
}

type DetailProps = {
  detail: ShowDetail;
  library: LibraryData | null;
  disabled: boolean;
  update: (episode?: Episode, watched?: boolean) => void;
};

export function SeriesDetail({ detail, library, disabled, update }: DetailProps) {
  const { show, episodes } = detail;
  const watched = library?.watched[String(show.id)] ?? [];
  const watchedSet = new Set(watched);
  const next = nextEpisode(episodes, watched);
  const future = episodes.find(item => !item.available && !watchedSet.has(item.id));
  const saved = library?.shows.some(item => item.id === show.id);
  const seasons = Array.from(new Set(episodes.map(item => item.season))).sort((a, b) => a - b);
  const [pickedSeason, setPickedSeason] = useState<number | null>(null);
  const season = pickedSeason ?? next?.season ?? seasons[0];
  const seasonEpisodes = episodes.filter(item => item.season === season);
  const watchedCount = episodes.filter(item => watchedSet.has(item.id)).length;
  return <>
    <header className="detail-header"><Poster show={show} /><div>
      <h1>{show.name}</h1>
      <p className="metadata">{[show.year, ...show.genres].filter(Boolean).join(" · ") || "Série"}</p>
      <a className="source" href={show.sourceUrl} target="_blank" rel="noreferrer">Ficha no TVmaze</a>
      {library && <div className="detail-action">{saved ? <span className="in-library"><Check size={17} aria-hidden="true" />Na biblioteca</span>
      : <button disabled={disabled} className="button dark" type="button" onClick={() => update()}><Plus size={18} aria-hidden="true" />Adicionar à biblioteca</button>}</div>}
    </div></header>
    {library && <section className="next-block" aria-labelledby="next-heading">
      <div><h2 id="next-heading">{next ? "Próximo episódio" : episodes.length && watchedCount > 0 ? "Você está em dia" : "Aguardando episódios"}</h2>
      <p>{next ? <><span className="episode-code">{episodeCode(next)}</span> {next.name}</> : future ? <>{future.name} · {formatDate(future.airdate)}</> : "Nenhum episódio disponível para marcar."}</p></div>
      {next && <button className="button gold" type="button" disabled={disabled} onClick={() => update(next, false)}><Check size={18} aria-hidden="true" />Marcar como visto</button>}
    </section>}
    <section className="episode-section" aria-labelledby="episodes-heading">
      <div className="section-heading"><h2 id="episodes-heading">Episódios</h2>{library && episodes.length > 0 && <span>{watchedCount} de {episodes.length} vistos</span>}</div>
      {seasons.length > 0 ? <>
        <div className="season-select"><label className="sr-only" htmlFor="temporada">Temporada</label>
          <select id="temporada" value={season} onChange={event => setPickedSeason(Number(event.target.value))}>
            {seasons.map(value => <option key={value} value={value}>Temporada {value}</option>)}
          </select><ChevronDown size={16} aria-hidden="true" /></div>
        <ul className="episode-list">{seasonEpisodes.map(item => {
          const seen = watchedSet.has(item.id);
          return <li key={item.id}>
            <span className="episode-code">{episodeCode(item)}</span>
            <div><h3>{item.name}</h3>{!item.available && <small>{item.airdate ? "Previsto em " + formatDate(item.airdate) : "Data a confirmar"}</small>}</div>
            <button className={"episode-toggle" + (seen ? " seen" : "")} type="button" aria-pressed={seen}
              aria-label={(seen ? "Desmarcar " : "Marcar como visto ") + episodeCode(item) + " " + item.name}
              disabled={disabled || (!item.available && !seen)} onClick={() => update(item, seen)}>
              {seen ? <Check size={17} aria-hidden="true" /> : <Plus size={17} aria-hidden="true" />}<span>{seen ? "Visto" : "Marcar"}</span></button>
          </li>;
        })}</ul>
      </> : <p className="muted">O catálogo ainda não tem episódios regulares para esta série.</p>}
    </section>
  </>;
}
