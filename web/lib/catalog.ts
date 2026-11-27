export type Show = {
  id: number;
  name: string;
  image: string | null;
  year: string | null;
  genres: string[];
  sourceUrl: string;
};

export type Episode = {
  id: number;
  season: number;
  number: number;
  name: string;
  airdate: string | null;
  available: boolean;
};

export type ShowDetail = { show: Show; episodes: Episode[] };

export class CatalogError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function catalogErrorResponse(error: unknown): Response {
  if (error instanceof CatalogError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  return Response.json({ error: "Falha ao consultar o catálogo." }, { status: 500 });
}

const invalidCatalog = () => new CatalogError(502, "O TVmaze retornou dados incompletos. Tente novamente.");

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function positiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function dateOnly(value: unknown): string | null {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

async function fetchCatalog(path: string): Promise<unknown> {
  const signal = AbortSignal.timeout(12000);
  try {
    const response = await fetch(`https://api.tvmaze.com${path}`, {
      headers: { Accept: "application/json", "User-Agent": "Watchfolio/0.1" },
      signal,
    });
    if (response.status === 404) throw new CatalogError(404, "Série não encontrada no TVmaze.");
    if (response.status === 429) throw new CatalogError(429, "O TVmaze recebeu muitas consultas. Tente novamente em instantes.");
    if (!response.ok) throw new CatalogError(502, "O TVmaze está indisponível. Tente novamente.");
    return await response.json();
  } catch (error) {
    if (error instanceof CatalogError) throw error;
    if (signal.aborted) throw new CatalogError(504, "O TVmaze demorou para responder. Tente novamente.");
    throw new CatalogError(502, "Não foi possível ler o catálogo do TVmaze. Tente novamente.");
  }
}

function toShow(raw: unknown): Show {
  if (!isRecord(raw) || !positiveInteger(raw.id) || typeof raw.name !== "string") {
    throw invalidCatalog();
  }
  const image = isRecord(raw.image) ? raw.image.medium ?? raw.image.original : null;
  return {
    id: raw.id,
    name: raw.name,
    image: typeof image === "string" && image.startsWith("https://static.tvmaze.com/") ? image : null,
    year: dateOnly(raw.premiered)?.slice(0, 4) ?? null,
    genres: Array.isArray(raw.genres) ? raw.genres.filter((genre): genre is string => typeof genre === "string") : [],
    sourceUrl: typeof raw.url === "string" && raw.url.startsWith("https://www.tvmaze.com/shows/")
      ? raw.url
      : `https://www.tvmaze.com/shows/${raw.id}`,
  };
}

export async function searchShows(query: string): Promise<Show[]> {
  const term = query.trim();
  if (!term || term.length > 100) {
    throw new CatalogError(400, "Informe um título de até 100 caracteres.");
  }
  const matches = await fetchCatalog(`/search/shows?${new URLSearchParams({ q: term })}`);
  if (!Array.isArray(matches)) throw invalidCatalog();
  return matches.slice(0, 10).map(match => toShow(isRecord(match) ? match.show : null));
}

export async function getShow(id: number): Promise<ShowDetail> {
  if (!positiveInteger(id)) throw new CatalogError(400, "Identificador de série inválido.");
  const raw = await fetchCatalog(`/shows/${id}?embed=episodes`);
  if (!isRecord(raw) || raw.id !== id || !isRecord(raw._embedded) || !Array.isArray(raw._embedded.episodes)) {
    throw invalidCatalog();
  }
  const now = Date.now();
  // A date without an airtime has elapsed everywhere once it is yesterday in UTC−12.
  const dateInLatestZone = new Date(now - 12 * 3600_000).toISOString().slice(0, 10);
  const episodes: Episode[] = [];
  for (const item of raw._embedded.episodes) {
    if (!isRecord(item)) throw invalidCatalog();
    if (item.type !== "regular" || !positiveInteger(item.season) || !positiveInteger(item.number)) continue;
    if (!positiveInteger(item.id) || typeof item.name !== "string") throw invalidCatalog();
    const airdate = dateOnly(item.airdate);
    const timestamp = typeof item.airstamp === "string" && item.airtime
      ? Date.parse(item.airstamp)
      : NaN;
    episodes.push({
      id: item.id,
      season: item.season,
      number: item.number,
      name: item.name,
      airdate,
      available: Number.isFinite(timestamp) ? timestamp <= now : airdate !== null && airdate < dateInLatestZone,
    });
  }
  episodes.sort((a, b) => a.season - b.season || a.number - b.number || a.id - b.id);
  return { show: toShow(raw), episodes };
}
