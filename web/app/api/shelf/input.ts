import { ShelfError, shelfStatuses, type ShelfStatus, type WatchInput } from "@/db/shelf-types";

export function parseTitleKey(value: string) {
  if (!/^[a-z][a-z0-9]*-[A-Za-z0-9]+$/.test(value) || value.length > 100) {
    throw new ShelfError(400, "Identificador de título inválido.");
  }
  return value;
}

export async function readObject(request: Request): Promise<Record<string, unknown>> {
  let body: unknown;
  try { body = await request.json(); } catch { throw new ShelfError(400, "Envie um objeto JSON válido."); }
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new ShelfError(400, "Envie um objeto JSON válido.");
  return body as Record<string, unknown>;
}

export function parseStatus(value: unknown) {
  if (!shelfStatuses.includes(value as ShelfStatus)) throw new ShelfError(400, "Estado de biblioteca inválido.");
  return value as ShelfStatus;
}

export function parseCalendarDay(value: unknown): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new ShelfError(400, "Informe uma data no formato AAAA-MM-DD.");
  }
  const timestamp = Date.parse(value + "T00:00:00Z");
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== value) {
    throw new ShelfError(400, "A data informada é inválida.");
  }
  return value;
}

export function parseDate(value: unknown): string {
  const day = parseCalendarDay(value);
  // The visitor's calendar day can already be tomorrow in UTC+14.
  if (day > new Date(Date.now() + 14 * 3600_000).toISOString().slice(0, 10)) {
    throw new ShelfError(400, "A data da sessão ainda está no futuro.");
  }
  return day;
}

export function parseOperation(value: string) {
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(value)) throw new ShelfError(400, "Identificador de ação inválido.");
  return value;
}

export function parseWatch(body: Record<string, unknown>): WatchInput {
  const ids = body.episodeIds;
  if (!Array.isArray(ids) || !ids.length || ids.length > 10000 ||
      !ids.every(id => id === null || (typeof id === "number" && Number.isSafeInteger(id) && id > 0))) {
    throw new ShelfError(400, "Selecione os episódios ou o filme a marcar.");
  }
  if (body.rewatch !== undefined && typeof body.rewatch !== "boolean") {
    throw new ShelfError(400, "Indique se esta é uma reassistida.");
  }
  const episodeIds = [...new Set<number | null>(ids)].sort((a, b) => Number(a) - Number(b));
  return { episodeIds, watchedOn: parseDate(body.watchedOn), rewatch: body.rewatch === true };
}
