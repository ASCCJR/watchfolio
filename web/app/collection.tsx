"use client";

import { useState } from "react";
import { Bookmark, Film, Search } from "lucide-react";
import type { ShelfEntry, ShelfStatus } from "../db/shelf-types";
import type { Title, TitleKind } from "../lib/titles";
import { RequestError } from "./use-resource";

export const kinds = { all: "Todos os tipos", movie: "Filmes", series: "Séries", anime: "Animes" };
export const kindNames: Record<TitleKind, string> = { movie: "Filme", series: "Série", anime: "Anime" };
export const statuses: Record<ShelfStatus, string> = {
  planned: "Quero assistir", watching: "Acompanhando", paused: "Em pausa", completed: "Concluído", dropped: "Abandonado",
};
export const countLabel = (n: number, one: string, many: string) => n + " " + (n === 1 ? one : many);

const commonGenres: Record<string, string> = {
  action: "Ação", adventure: "Aventura", anime: "Anime", children: "Infantil", comedy: "Comédia",
  crime: "Crime", diy: "Faça você mesmo", drama: "Drama", espionage: "Espionagem", family: "Família",
  fantasy: "Fantasia", food: "Culinária", history: "História", horror: "Terror", legal: "Jurídico",
  medical: "Medicina", music: "Música", mystery: "Mistério", nature: "Natureza", romance: "Romance",
  "science-fiction": "Ficção científica", sports: "Esportes", supernatural: "Sobrenatural", thriller: "Suspense",
  travel: "Viagem", war: "Guerra", western: "Faroeste",
};

export function genreNames(title: Title) {
  return Array.from(new Set(title.genres.map(genre => commonGenres[genre.toLowerCase()] ?? genre)));
}

export function queryPath(query: string, type: TitleKind | "all" = "all") {
  const params = new URLSearchParams(query ? { q: query } : { buscar: "1" });
  if (type !== "all") params.set("type", type);
  return "/?" + params.toString();
}

export function Feedback({ error, retry }: { error: RequestError; retry: () => void }) {
  if (error.status === 401) {
    const next = typeof window === "undefined" ? "/" : window.location.pathname + window.location.search;
    return <div className="notice"><Bookmark aria-hidden="true" /><div>
      <p>Entre para acessar sua biblioteca.</p>
      <a href={"/signin-with-chatgpt?return_to=" + encodeURIComponent(next)} target="_top">Entrar com ChatGPT</a>
    </div></div>;
  }
  return <div className="notice" role="alert"><p>{error.message}</p><button type="button" className="text-action" onClick={retry}>Tentar novamente</button></div>;
}

export function SearchForm({ query, type }: { query: string; type: TitleKind | "all" }) {
  return <form className="search-form" action="/" method="get" role="search">
    <Search aria-hidden="true" size={20} />
    <label className="sr-only" htmlFor="busca">Nome do título</label>
    <input id="busca" name="q" type="search" placeholder="Nome do título" defaultValue={query} required maxLength={100} />
    {type !== "all" && <input name="type" type="hidden" value={type} />}
    <button type="submit">Buscar</button>
  </form>;
}

export function Suggestions() {
  return <div className="suggestions"><span>Experimente</span>{["Cidade de Deus", "Dark", "One Piece"].map(name => <a key={name} href={queryPath(name)}>{name}</a>)}</div>;
}

export function Poster({ title }: { title: Title }) {
  const [broken, setBroken] = useState(false);
  return <div className="poster">{title.image && !broken
    ? <img src={title.image} loading="lazy" alt="" onError={() => setBroken(true)} />
    : <Film size={32} aria-hidden="true" />}</div>;
}

export function TitleGrid({ titles, entries, query, type }: {
  titles: Title[]; entries: ShelfEntry[]; query: string; type: TitleKind | "all";
}) {
  const saved = new Map(entries.map(entry => [entry.title.key, entry]));
  return <ul className="show-grid">{titles.map(title => {
    const entry = saved.get(title.key);
    const params = new URLSearchParams({ titulo: title.key });
    if (query) params.set("q", query);
    if (type !== "all") params.set("type", type);
    return <li key={title.key}><a className="show-card" href={"/?" + params.toString()}>
      <Poster title={title} />
      <div className="card-info"><h3>{title.name}</h3><p>{[kindNames[title.kind], title.year].filter(Boolean).join(" · ")}</p>
        {entry?.status && <span className="saved-line"><Bookmark size={14} aria-hidden="true" />{statuses[entry.status]}</span>}
        {entry && !entry.status && <span className="saved-line">{countLabel(entry.sessions.length, "sessão no histórico", "sessões no histórico")}</span>}
      </div>
    </a></li>;
  })}</ul>;
}
