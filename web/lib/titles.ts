import { browseShows, CatalogError, getShow, searchShows, type Episode, type Show } from "./catalog";
import { getMovie, moviePage } from "./wikidata";

export type { Episode } from "./catalog";
export type TitleKind = "movie" | "series" | "anime";
export type Title = {
  key: string;
  kind: TitleKind;
  name: string;
  image: string | null;
  year: string | null;
  genres: string[];
  sourceUrl: string;
  productionStatus: string | null;
};
export type TitleDetail = { title: Title; episodes: Episode[]; description?: string | null; durationSeconds?: number };
export type TitleSearch = { titles: Title[]; warnings?: string[] };

const tvStatuses: Record<string, string> = {
  Running: "Em exibição",
  Ended: "Encerrada",
  "To Be Determined": "A confirmar",
  "In Development": "Em desenvolvimento",
};

function tvTitle(show: Show): Title {
  const { id, productionStatus, ...metadata } = show;
  return {
    ...metadata, key: `tvmaze-${id}`,
    kind: show.genres.some(genre => genre.toLowerCase() === "anime") ? "anime" : "series",
    productionStatus: productionStatus ? tvStatuses[productionStatus] ?? productionStatus : null,
  };
}

export async function getTitle(key: string): Promise<TitleDetail> {
  if (/^wikidata-Q[1-9]\d{0,14}$/.test(key)) return getMovie(key.slice("wikidata-".length));
  if (!/^tvmaze-[1-9]\d{0,14}$/.test(key)) throw new CatalogError(400, "Identificador de título inválido.");
  const { show, episodes } = await getShow(Number(key.slice("tvmaze-".length)), true);
  return { title: tvTitle(show), episodes };
}

async function listTitles(term: string, type: string, page: number): Promise<TitleSearch & { hasMore: boolean }> {
  if (!["all", "movie", "series", "anime"].includes(type)) throw new CatalogError(400, "Tipo de título inválido.");
  const words = term.match(/[\p{L}\p{M}\p{N}]+/gu)?.join(" ") ?? "";
  const films = () => term && !words
    ? Promise.resolve({ titles: [] as Title[], hasMore: false })
    : moviePage(words, type === "anime", page);
  if (type === "movie") return films();
  const tvPage = term
    ? searchShows(term).then(shows => ({ shows, hasMore: false }))
    : browseShows(page, type === "anime");
  const television = tvPage.then(({ shows, hasMore }) => ({
    titles: shows.map(tvTitle).filter(title => type === "all" || title.kind === type), hasMore,
  }));
  if (type === "series") return television;
  const [tv, movies] = await Promise.allSettled([television, films()]);
  if (tv.status === "rejected" && movies.status === "rejected") throw new CatalogError(503, "Os catálogos estão indisponíveis. Tente novamente.");
  const titles: Title[] = [];
  const warnings: string[] = [];
  if (tv.status === "fulfilled") titles.push(...tv.value.titles);
  else warnings.push("Não foi possível consultar as séries e os animes no TVmaze.");
  if (movies.status === "fulfilled") titles.push(...movies.value.titles);
  else warnings.push("Não foi possível consultar os filmes no Wikidata.");
  // Keep the ranking of each source, but put exact title matches before fuzzy matches.
  const exact = (title: Title) => Number(title.name.localeCompare(term, "pt-BR", { sensitivity: "base" }) === 0);
  if (term) titles.sort((a, b) => exact(b) - exact(a));
  const hasMore = (tv.status === "fulfilled" && tv.value.hasMore) || (movies.status === "fulfilled" && movies.value.hasMore);
  return { titles, hasMore, ...(warnings.length ? { warnings } : {}) };
}

export async function searchTitles(query: string, type: string): Promise<TitleSearch> {
  const term = query.trim();
  if (!term || term.length > 100) throw new CatalogError(400, "Informe um título de até 100 caracteres.");
  const { titles, warnings } = await listTitles(term, type, 0);
  return warnings ? { titles, warnings } : { titles };
}

export async function browseTitles(type: string, page: number): Promise<TitleSearch & { hasMore: boolean }> {
  if (!Number.isSafeInteger(page) || page < 0 || !Number.isSafeInteger(page * 250)) {
    throw new CatalogError(400, "Página inválida.");
  }
  return listTitles("", type, page);
}
