"use client";

import { useState } from "react";
import { Bookmark, Film, Search } from "lucide-react";
import type { Show } from "../lib/catalog";
import { RequestError } from "./use-resource";

export type LibraryData = { shows: Show[]; watched: Record<string, number[]> };
export const queryPath = (query: string) => "/?q=" + encodeURIComponent(query);
export const countLabel = (count: number, one: string, many: string) => count + " " + (count === 1 ? one : many);

export function Brand() {
  return <a className="brand" href="/" aria-label="Watchfolio, início"><span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>Watchfolio</a>;
}

export function Feedback({ error, retry }: { error: RequestError; retry: () => void }) {
  if (error.status === 401) {
    const next = typeof window === "undefined" ? "/" : window.location.pathname + window.location.search;
    return <div className="notice"><Bookmark aria-hidden="true" /><div><p>Entre para acessar sua biblioteca.</p><a href={"/signin-with-chatgpt?return_to=" + encodeURIComponent(next)} target="_top">Entrar com ChatGPT</a></div></div>;
  }
  return <div className="notice" role="alert"><p>{error.message}</p><button type="button" className="text-action" onClick={retry}>Tentar novamente</button></div>;
}

export function SearchForm({ query }: { query: string }) {
  return <form className="search-form" action="/" method="get" role="search">
    <Search aria-hidden="true" size={20} />
    <label className="sr-only" htmlFor="busca">Nome da série</label>
    <input id="busca" name="q" type="search" placeholder="Busque uma série pelo nome" defaultValue={query} required maxLength={100} />
    <button type="submit">Buscar</button>
  </form>;
}

export function Suggestions() {
  return <div className="suggestions"><span>Experimente</span>{["Dark", "The Bear", "One Piece"].map(name => <a key={name} href={queryPath(name)}>{name}</a>)}</div>;
}

export function Poster({ show }: { show: Show }) {
  const [broken, setBroken] = useState(false);
  return <div className="poster">{show.image && !broken
    ? <img src={show.image} loading="lazy" alt="" onError={() => setBroken(true)} />
    : <Film size={32} aria-hidden="true" />}</div>;
}

export function ShowGrid({ shows, query, library }: { shows: Show[]; query?: string; library: LibraryData | null }) {
  return <ul className="show-grid">{shows.map(show => {
    const tracked = library?.watched[String(show.id)];
    const isSaved = library?.shows.some(item => item.id === show.id);
    const destination = "/?serie=" + show.id + (query ? "&q=" + encodeURIComponent(query) : "");
    return <li key={show.id}><a className="show-card" href={destination}>
      <Poster show={show} />
      <div className="card-info"><h3>{show.name}</h3><p>{[show.year, show.genres[0]].filter(Boolean).join(" · ") || "Série"}</p>
      {isSaved && <span className="saved-line"><Bookmark size={14} aria-hidden="true" />{tracked?.length ? countLabel(tracked.length, "episódio visto", "episódios vistos") : "Na biblioteca"}</span>}</div>
    </a></li>;
  })}</ul>;
}
