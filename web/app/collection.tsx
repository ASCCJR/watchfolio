"use client";

import { useState } from "react";
import { Bookmark, Film, Search } from "lucide-react";
import type { ShelfEntry, ShelfStatus } from "../db/shelf-types";
import type { Title, TitleKind } from "../lib/titles";
export { genreNames } from "../lib/genres";
import { RequestError } from "./use-resource";
import { usePersonalPoster } from "./artwork/posters";

export const kinds = { all: "Todos os tipos", movie: "Filmes", series: "Séries", anime: "Animes" };
export const kindNames: Record<TitleKind, string> = { movie: "Filme", series: "Série", anime: "Anime" };
export const statuses: Record<ShelfStatus, string> = {
  planned: "Quero assistir", watching: "Acompanhando", paused: "Em pausa", completed: "Concluído", dropped: "Abandonado",
};
export const countLabel = (n: number, one: string, many: string) => n + " " + (n === 1 ? one : many);

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
  const custom = usePersonalPoster(title.key);
  return <div className="poster"><PosterImage key={JSON.stringify([custom, title.image])} custom={custom} original={title.image} /></div>;
}

function PosterImage({ custom, original }: { custom: string | null; original: string | null }) {
  const [failed, setFailed] = useState<string[]>([]);
  const src = [custom, original].find(url => url && !failed.includes(url));
  return src
    ? <img src={src} loading="lazy" alt="" onError={() => setFailed(current => [...current, src])} />
    : <Film size={32} aria-hidden="true" />;
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
