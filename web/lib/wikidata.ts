import { CatalogError } from "./catalog";
import type { Title, TitleDetail } from "./titles";

type Localized = Record<string, { value: string }>;
type Claim = { rank: string; mainsnak: { datavalue?: { value: unknown } } };
type Entity = {
  id: string;
  labels?: Localized;
  descriptions?: Localized;
  claims?: Record<string, Claim[]>;
};
type FilePage = {
  title: string;
  imageinfo?: { thumburl?: string; extmetadata?: { LicenseShortName?: { value?: string } } }[];
};
type ApiResult = {
  error?: { code: string };
  continue?: { sroffset?: number };
  query?: {
    search?: { title: string }[];
    pages?: Record<string, FilePage>;
    normalized?: { from: string; to: string }[];
    redirects?: { from: string; to: string }[];
  };
  entities?: Record<string, Entity>;
};

const wikidata = "https://www.wikidata.org/w/api.php";
const commons = "https://commons.wikimedia.org/w/api.php";
const languages = ["pt-br", "pt", "mul", "en"];
// P31 (instance of): film, feature, short, animated, anime, animated feature, documentary, silent, TV, project.
const filmClasses = ["Q11424", "Q24869", "Q24862", "Q202866", "Q20650540", "Q29168811", "Q93204", "Q226730", "Q506240", "Q18011172"];
const ua = "Watchfolio/0.2 (https://github.com/ASCCJR/watchfolio)";

async function queryApi(endpoint: string, parameters: Record<string, string>): Promise<ApiResult> {
  const url = new URL(endpoint);
  url.search = new URLSearchParams({ ...parameters, format: "json", maxlag: "5" }).toString();
  const signal = AbortSignal.timeout(9000);
  try {
    const response = await fetch(url, { headers: { Accept: "application/json", "User-Agent": ua, "Api-User-Agent": ua }, signal });
    if (response.status === 429) throw new CatalogError(429, "O catálogo Wikimedia está ocupado. Tente novamente em instantes.");
    if (!response.ok) throw new CatalogError(502, "O catálogo Wikimedia está indisponível.");
    const result: ApiResult = await response.json();
    if (!result || result.error) throw new CatalogError(502, "O catálogo Wikimedia não conseguiu concluir a consulta.");
    return result;
  } catch (error) {
    if (error instanceof CatalogError) throw error;
    throw new CatalogError(signal.aborted ? 504 : 502, "Não foi possível consultar o catálogo Wikimedia. Tente novamente.");
  }
}

function localized(labels?: Localized): string | undefined {
  return languages.map(language => labels?.[language]?.value).find(Boolean);
}

function values(entity: Entity, property: string): unknown[] {
  return (entity.claims?.[property] ?? [])
    .filter(claim => claim.rank !== "deprecated")
    .map(claim => claim.mainsnak.datavalue?.value);
}

function itemIds(entity: Entity, property: string): string[] {
  return values(entity, property).flatMap(value =>
    value && typeof value === "object" && "id" in value && typeof value.id === "string" ? [value.id] : []);
}

function movieName(entity: Entity): string | undefined {
  const translated = localized(entity.labels);
  if (translated) return translated;
  for (const original of values(entity, "P1476")) {
    if (original && typeof original === "object" && "text" in original && typeof original.text === "string") return original.text;
  }
  return undefined;
}

function firstRelease(entity: Entity): { year: string | null; status: string | null } {
  const today = new Date().toISOString().slice(0, 10);
  const dates: { year: string; start: string; end: string }[] = [];
  for (const value of values(entity, "P577")) {
    if (!value || typeof value !== "object" || !("time" in value) || typeof value.time !== "string" ||
      !("precision" in value) || typeof value.precision !== "number" || value.precision < 9) continue;
    const match = /^\+(\d{4})-(\d{2})-(\d{2})T/.exec(value.time);
    if (!match) continue;
    const [, year, month, day] = match;
    const prefix = value.precision >= 10 && month !== "00" ? `${year}-${month}` : year;
    if (prefix.length === 7 && value.precision >= 11 && day !== "00") {
      dates.push({ year, start: `${prefix}-${day}`, end: `${prefix}-${day}` });
    } else {
      dates.push({ year, start: prefix.length === 7 ? `${prefix}-01` : `${year}-01-01`,
        end: prefix.length === 7 ? `${prefix}-31` : `${year}-12-31` });
    }
  }
  if (!dates.length) return { year: null, status: null };
  const year = dates.map(date => date.year).sort()[0];
  if (dates.some(date => date.end <= today)) return { year, status: "Lançado" };
  return { year, status: dates.every(date => date.start > today) ? "Lançamento previsto" : null };
}

function fileName(entity: Entity): string | undefined {
  // P3383 is a poster, P18 is a representative image. Commons files have their own licenses.
  return [...values(entity, "P3383"), ...values(entity, "P18")].find((name): name is string => typeof name === "string");
}

async function publicDomainImages(files: string[]): Promise<Map<string, string>> {
  const images = new Map<string, string>();
  if (!files.length) return images;
  const result = await queryApi(commons, { action: "query", prop: "imageinfo", titles: files.map(name => `File:${name}`).join("|"),
    redirects: "1", iiprop: "url|extmetadata", iiurlwidth: "330", iiextmetadatafilter: "LicenseShortName" });
  const names = new Map((result.query?.normalized ?? []).map(pair => [pair.from, pair.to]));
  const redirects = new Map((result.query?.redirects ?? []).map(pair => [pair.from, pair.to]));
  const pages = new Map(Object.values(result.query?.pages ?? {}).map(page => [page.title, page]));
  for (const file of files) {
    const normalized = names.get(`File:${file}`) ?? `File:${file}`;
    const info = pages.get(redirects.get(normalized) ?? normalized)?.imageinfo?.[0];
    if (info?.thumburl && /^https:\/\/(?:thumb|upload)\.wikimedia\.org\//.test(info.thumburl) &&
        /^(public domain|cc0(?: 1\.0)?)$/i.test(info.extmetadata?.LicenseShortName?.value ?? "")) {
      images.set(file, info.thumburl);
    }
  }
  return images;
}

async function loadMovies(ids: string[]): Promise<TitleDetail[]> {
  if (!ids.length) return [];
  const result = await queryApi(wikidata, { action: "wbgetentities", ids: ids.join("|"),
    props: "labels|descriptions|claims", languages: languages.join("|") });
  if (!result.entities) throw new CatalogError(502, "O Wikidata retornou uma resposta incompleta.");
  const movies = ids.map(id => result.entities?.[id])
    .filter((entity): entity is Entity => !!entity && !!movieName(entity) && itemIds(entity, "P31").some(id => filmClasses.includes(id)));
  const genreIds = [...new Set(movies.flatMap(movie => itemIds(movie, "P136").slice(0, 6)))];
  const files = [...new Set(movies.map(fileName).filter((file): file is string => !!file))];
  // Artwork and genre labels are optional metadata. Movies remain usable if a lookup fails.
  const [labels, images] = await Promise.all([
    genreIds.length ? queryApi(wikidata, { action: "wbgetentities", ids: genreIds.join("|"),
      props: "labels", languages: languages.join("|") }).then(data => data.entities).catch(() => undefined) : undefined,
    publicDomainImages(files).catch(() => new Map<string, string>()),
  ]);
  return movies.map(entity => {
    const release = firstRelease(entity);
    const genres = itemIds(entity, "P136").slice(0, 6).flatMap(id => localized(labels?.[id]?.labels) ?? []);
    if (itemIds(entity, "P31").includes("Q20650540") && !genres.some(genre => genre.toLowerCase() === "anime")) {
      genres.unshift("Anime");
    }
    const title: Title = {
      key: `wikidata-${entity.id}`, kind: "movie", name: movieName(entity)!,
      image: images.get(fileName(entity) ?? "") ?? null, year: release.year, productionStatus: release.status,
      genres,
      sourceUrl: `https://www.wikidata.org/wiki/${entity.id}`,
    };
    return { title, episodes: [], description: localized(entity.descriptions) ?? null };
  });
}

export async function moviePage(words: string, animeOnly: boolean, page = 0): Promise<{ titles: Title[]; hasMore: boolean }> {
  const filter = (animeOnly ? ["Q20650540"] : filmClasses).map(id => `P31=${id}`).join("|");
  const params: Record<string, string> = { action: "query", list: "search", srnamespace: "0", uselang: "pt-br", srlimit: "6", srprop: "",
    srsearch: `${words} haswbstatement:${filter}`.trim() };
  if (!words) {
    // Wikimedia's CirrusSearch allows a 10,000-result window per query.
    const offset = page * 6;
    if (offset >= 10000) return { titles: [], hasMore: false };
    params.sroffset = String(offset);
    params.srlimit = String(Math.min(6, 10000 - offset));
    params.srsort = "create_timestamp_asc";
  }
  const result = await queryApi(wikidata, params);
  if (!Array.isArray(result.query?.search)) throw new CatalogError(502, "O Wikidata retornou uma busca incompleta.");
  const ids = result.query.search.map(hit => hit.title).filter(id => /^Q[1-9]\d*$/.test(id));
  const nextOffset = result.continue?.sroffset;
  return { titles: (await loadMovies(ids)).map(detail => detail.title), hasMore: nextOffset !== undefined && nextOffset < 10000 };
}

export async function getMovie(id: string): Promise<TitleDetail> {
  const [movie] = await loadMovies([id]);
  if (!movie) throw new CatalogError(404, "Filme não encontrado no Wikidata.");
  return movie;
}
