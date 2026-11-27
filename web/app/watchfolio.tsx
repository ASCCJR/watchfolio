"use client";

import { useRef, useState } from "react";
import { ChevronLeft, Library, Search } from "lucide-react";
import type { Episode, Show, ShowDetail } from "../lib/catalog";
import { Brand, countLabel, Feedback, type LibraryData, queryPath, SearchForm, ShowGrid, Suggestions } from "./collection";
import { SeriesDetail } from "./series-detail";
import { request, RequestError, useResource } from "./use-resource";

type Props = { query: string; showId: string | null; catalog: boolean };

export function Watchfolio({ showId, query, catalog }: Props) {
  const library = useResource<LibraryData>("/api/library", true);
  const results = useResource<{ shows: Show[] }>(!showId && query ? "/api/catalog/search?q=" + encodeURIComponent(query) : null);
  const detail = useResource<ShowDetail>(showId ? "/api/catalog/" + showId : null, true);
  const [working, setWorking] = useState(false);
  const saving = useRef(false);
  const [failure, setFailure] = useState<RequestError | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const lastAction = useRef<{episode?: Episode; watched?: boolean}>({});
  const isCatalog = !showId && catalog;
  const isLibrary = !showId && !catalog;

  async function update(episode?: Episode, watched?: boolean) {
    if (saving.current || !showId || !library.data || library.error) return;
    saving.current = true;
    setWorking(true);
    setFailure(null);
    setAnnouncement("");
    lastAction.current = { episode, watched };
    const base = "/api/library/" + showId;
    try {
      await request(episode ? base + "/episodes/" + episode.id : base, { method: watched ? "DELETE" : "PUT" });
      await library.refresh();
      setAnnouncement(episode ? (watched ? "Marcação removida." : "Episódio marcado como visto.") : "Série adicionada à biblioteca.");
    } catch (reason) {
      setFailure(reason instanceof RequestError ? reason : new RequestError("Falha ao salvar a alteração.", 0));
    } finally {
      saving.current = false;
      setWorking(false);
    }
  }

  return <div className="site">
    <a className="skip-link" href="#conteudo">Pular para o conteúdo</a>
    <header className="masthead"><div className="masthead-inner"><Brand /><nav aria-label="Principal">
      <a href="/" aria-current={isLibrary ? "page" : undefined}><Library size={17} aria-hidden="true" />Biblioteca</a>
      <a href="/?buscar=1" aria-current={isCatalog ? "page" : undefined}><Search size={17} aria-hidden="true" />Catálogo</a>
    </nav></div></header>
    <main id="conteudo" className="container">
    {showId ? <>
      <a className="back-link" href={query ? queryPath(query) : "/"}><ChevronLeft size={16} aria-hidden="true" />{query ? "Voltar à busca" : "Voltar à biblioteca"}</a>
      {detail.error && <Feedback error={detail.error} retry={detail.refresh} />}
      {!detail.data && !detail.error && <p role="status" className="loading">Carregando série…</p>}
      {library.error && <Feedback error={library.error} retry={library.refresh} />}
      {failure && <Feedback error={failure} retry={() => update(lastAction.current.episode, lastAction.current.watched)} />}
      <div className="sr-only" role="status" aria-live="polite">{working ? "Salvando…" : announcement}</div>
      {detail.data && <SeriesDetail key={detail.data.show.id} detail={detail.data} library={library.data} disabled={working || !library.data || Boolean(library.error)} update={update} />}
    </> : <>
      <section className="hero" aria-labelledby="main-title"><div className="hero-copy">
        <h1 id="main-title">{isCatalog ? "Catálogo de séries" : "Minha biblioteca"}</h1>
        <p>{isCatalog ? "Encontre uma série para acompanhar." : "Guarde suas séries e retome do episódio em que parou."}</p>
        <SearchForm query={query} /></div></section>
      <section className="collection" aria-labelledby="section-title">
        <div className="section-heading"><h2 id="section-title">{isLibrary ? "Séries acompanhadas" : query ? "Resultados da busca" : "Buscar por título"}</h2>
          {isLibrary && library.data && <span>{countLabel(library.data.shows.length, "série", "séries")}</span>}
          {isCatalog && results.data && <span>{countLabel(results.data.shows.length, "resultado", "resultados")}</span>}</div>
        {isLibrary ? <>
          {library.error && <Feedback error={library.error} retry={library.refresh} />}
          {library.data ? library.data.shows.length ? <ShowGrid shows={library.data.shows} library={library.data} />
            : <div className="empty-panel"><div className="empty-icon"><Library size={35} strokeWidth={1.5} aria-hidden="true" /></div><div><h3>Sua biblioteca está vazia</h3>
              <p>Busque o título de uma série e adicione-a à biblioteca.</p><Suggestions /></div></div>
            : !library.error && <p role="status" className="loading">Carregando biblioteca…</p>}
        </> : query ? <>
          <p className="result-query">Busca por “{query}”</p>
          {results.error && <Feedback error={results.error} retry={results.refresh} />}
          {results.data ? results.data.shows.length ? <ShowGrid shows={results.data.shows} query={query} library={library.data} />
            : <p className="muted">Nenhuma série encontrada. Experimente outro nome ou o título original.</p>
            : !results.error && <p role="status" className="loading">Consultando catálogo…</p>}
        </> : <div className="catalog-prompt"><Search size={25} aria-hidden="true" /><div><p>Procure pelo nome da série ou pelo título original.</p><Suggestions /></div></div>}
      </section>
    </>}
    </main>
    <footer className="footer"><div className="footer-inner"><Brand /><p>Dados de séries por <a href="https://www.tvmaze.com/">TVmaze</a> · <a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a></p></div></footer>
  </div>;
}
