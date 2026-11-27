"use client";

import { useState } from "react";
import { ChevronLeft, Library } from "lucide-react";
import type { ShelfEntry, ShelfStatus } from "../db/shelf-types";
import type { Title, TitleDetail, TitleKind } from "../lib/titles";
import { countLabel, Feedback, genreNames, kinds, queryPath, SearchForm, statuses, Suggestions, TitleGrid } from "./collection";
import { SiteFrame } from "./frame";
import { TitleView } from "./title-view";
import { useResource } from "./use-resource";

type Props = { query: string; titleKey: string | null; catalog: boolean; type: TitleKind | "all" };
type FilterOption = { value: string; label: string };

function Filter({ label, value, options, change }: {
  label: string; value: string; options: FilterOption[]; change: (value: string) => void;
}) {
  return <label className="filter-field"><span>{label}</span><select value={value} onChange={e => change(e.target.value)}>
    {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
  </select></label>;
}

const named = (names: Record<string, string>) => Object.entries(names).map(([value, label]) => ({ value, label }));
const values = (all: string, names: string[]) => [
  { value: "", label: all }, ...Array.from(new Set(names)).sort((a, b) => a.localeCompare(b, "pt-BR")).map(label => ({ value: label, label })),
];
const genresOf = (title: Title) => title.genres.length ? genreNames(title) : ["Sem gênero informado"];
const productionOf = (title: Title) => title.productionStatus || "Situação a confirmar";

export function Watchfolio({ titleKey, query, catalog, type: initialType }: Props) {
  const [type, setType] = useState(initialType);
  const [page, setPage] = useState(0);
  const [genre, setGenre] = useState("");
  const [production, setProduction] = useState("");
  const [status, setStatus] = useState("");
  const library = useResource<{ entries: ShelfEntry[] }>("/api/shelf", true);
  const browsing = catalog && !query;
  const catalogUrl = !catalog || titleKey ? null : browsing
    ? "/api/titles/browse?" + new URLSearchParams({ type, page: String(page) })
    : "/api/titles/search?" + new URLSearchParams({ q: query, type });
  const results = useResource<{ titles: Title[]; warnings?: string[]; hasMore?: boolean }>(catalogUrl);
  const detail = useResource<TitleDetail>(titleKey ? "/api/titles/" + encodeURIComponent(titleKey) : null, true);
  const entries = library.data?.entries ?? [];
  const inShelf = entries.filter(entry => entry.status !== null);
  const candidates = catalog ? results.data?.titles ?? [] : entries.filter(entry => {
    if (status === "removed") return entry.status === null;
    return entry.status !== null && (!status || entry.status === status);
  }).map(entry => entry.title);
  const typed = candidates.filter(title => type === "all" || title.kind === type ||
    (type === "anime" && title.kind === "movie" && genreNames(title).includes("Anime")));
  const visible = typed.filter(title => (!genre || genresOf(title).includes(genre)) && (!production || productionOf(title) === production));
  const loaded = catalog ? Boolean(results.data) : Boolean(library.data);
  const withFilters = type !== "all" || Boolean(genre || production || status);
  const currentEntry = entries.find(entry => entry.title.key === titleKey);
  const failure = catalog ? results.error : library.error;
  function resetFilters() {
    setType("all");
    setPage(0);
    setGenre("");
    setProduction("");
    setStatus("");
  }

  if (titleKey) return <SiteFrame section={null}>
    <a className="back-link" href={query ? queryPath(query, type) : "/"}><ChevronLeft size={16} aria-hidden="true" />{query ? "Voltar à busca" : "Voltar à biblioteca"}</a>
    {detail.error && <Feedback error={detail.error} retry={detail.refresh} />}
    {!detail.data && !detail.error && <p role="status" className="loading">Carregando ficha…</p>}
    {library.error && <Feedback error={library.error} retry={library.refresh} />}
    {detail.data && <TitleView key={titleKey} detail={detail.data} entry={currentEntry}
      accessible={Boolean(library.data) && !library.error} reload={library.refresh} />}
  </SiteFrame>;

  return <SiteFrame section={catalog ? "catalog" : "library"}>
    <section className="hero" aria-labelledby="main-title"><div className="hero-copy">
      <h1 id="main-title">{catalog ? "Catálogo" : "Minha biblioteca"}</h1>
      <p>{catalog ? "Encontre filmes, séries e animes para acompanhar." : "Organize seus títulos e retome de onde parou."}</p>
      <SearchForm query={query} type={type} />
    </div></section>
    <section className="collection" aria-labelledby="section-title">
      <div className="section-heading"><h2 id="section-title">{catalog ? query ? "Resultados da busca" : "Explorar títulos" : status === "removed" ? "Fora da biblioteca" : "Meus títulos"}</h2>
        {loaded && <span aria-live="polite">{countLabel(visible.length, "título", "títulos")}</span>}</div>
      {(catalog || entries.length > 0) && <div className="filters">
        <Filter label="Tipo" value={type} options={named(kinds)} change={value => {
          setType(value as TitleKind | "all"); setPage(0); setGenre(""); setProduction("");
        }} />
        {!catalog && <Filter label="Na minha biblioteca" value={status} options={[
          { value: "", label: "Todos os estados" }, ...named(statuses), { value: "removed", label: "Fora da biblioteca" },
        ]} change={value => { setStatus(value as ShelfStatus | "removed" | ""); setGenre(""); setProduction(""); }} />}
        <Filter label="Gênero" value={genre} options={values("Todos os gêneros", [...typed.flatMap(genresOf), ...(genre ? [genre] : [])])} change={setGenre} />
        <Filter label="Situação da produção" value={production} options={values("Todas as situações", [...typed.map(productionOf), ...(production ? [production] : [])])} change={setProduction} />
        {withFilters && <button type="button" className="text-action" onClick={resetFilters}>Limpar filtros</button>}
      </div>}
      {catalog && query && <p className="result-query">Busca por “{query}”</p>}
      {browsing && <p className="result-query">Gênero e situação filtram os títulos desta página.</p>}
      {failure && <Feedback error={failure} retry={catalog ? results.refresh : library.refresh} />}
      {catalog && results.data?.warnings?.map(warning => <div className="notice" key={warning}><p>{warning}</p><button className="text-action" onClick={results.refresh}>Tentar novamente</button></div>)}
      {visible.length > 0 && <TitleGrid titles={visible} entries={entries} query={query} type={type} />}
      {loaded && !visible.length && <>
        {!catalog && !inShelf.length && !withFilters ? <div className="empty-panel">
          <div className="empty-icon"><Library size={35} strokeWidth={1.5} aria-hidden="true" /></div><div><h3>Sua biblioteca está vazia</h3>
            <p>Busque seu primeiro filme, série ou anime para adicioná-lo.</p><Suggestions /></div>
        </div> : <p className="muted">{status === "removed" && type === "all" && !genre && !production ? "Nenhum título retirado com sessões guardadas." : "Nenhum título encontrado. Experimente outros filtros ou outro nome."}</p>}
      </>}
      {!loaded && !failure && <p role="status" className="loading">{catalog ? "Consultando catálogo…" : "Carregando biblioteca…"}</p>}
      {browsing && (loaded || page > 0) && <div className="browse-pages" aria-label="Paginação do catálogo">
        <button className="button plain" disabled={page === 0} onClick={() => setPage(Math.max(0, page - 1))}>Anterior</button>
        <span aria-live="polite">Página {page + 1}</span>
        <button className="button plain" disabled={!loaded || !results.data?.hasMore} onClick={() => setPage(page + 1)}>Próxima</button>
      </div>}
    </section>
  </SiteFrame>;

}
