import { readActivity } from "@/db/activity";
import { libraryJson, withLibraryUser } from "../library/response";
import { historyPageSize } from "@/lib/activity-types";
import { parseCalendarDay } from "../shelf/input";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  return withLibraryUser(async owner => {
    const params = new URL(request.url).searchParams;
    const year = params.get("year");
    const page = params.get("page") ?? "0";
    const day = params.has("day") ? parseCalendarDay(params.get("day")) : null;
    if (year !== null && !/^\d{4}$/.test(year)) return libraryJson({ error: "Escolha um ano com quatro dígitos." }, 400);
    if (!/^\d+$/.test(page) || !Number.isSafeInteger(Number(page) * historyPageSize)) {
      return libraryJson({ error: "Página de histórico inválida." }, 400);
    }
    if (year && day && !day.startsWith(year + "-")) return libraryJson({ error: "Escolha uma data no ano selecionado." }, 400);
    return libraryJson(await readActivity(owner, year, Number(page), day));
  });
}
