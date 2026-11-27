import { isRecorded, recordWatches, undoWatches } from "@/db/shelf";
import { ShelfError } from "@/db/shelf-types";
import { getTitle } from "@/lib/titles";
import { libraryJson, withLibraryUser } from "../../../../library/response";
import { parseOperation, parseTitleKey, parseWatch, readObject } from "../../../input";

type Context = { params: Promise<{ key: string; operationId: string }> };

export function PUT(request: Request, { params }: Context) {
  return withLibraryUser(async owner => {
    const { key, operationId } = await params;
    parseTitleKey(key);
    parseOperation(operationId);
    const input = parseWatch(await readObject(request));
    if (await isRecorded(owner, key, operationId, input)) return libraryJson({ ok: true });
    const { title, episodes } = await getTitle(key);
    if (title.kind === "movie") {
      if (input.episodeIds.length !== 1 || input.episodeIds[0] !== null) {
        throw new ShelfError(400, "Para marcar um filme, selecione o título inteiro.");
      }
    } else {
      const byId = new Map(episodes.map(episode => [episode.id, episode]));
      for (const id of input.episodeIds) {
        const episode = id === null ? null : byId.get(id);
        if (!episode) throw new ShelfError(404, "Um dos episódios não pertence a este título.");
        if (!episode.available) throw new ShelfError(409, "Um dos episódios ainda não foi exibido.");
      }
    }
    await recordWatches(owner, title, operationId, input);
    return libraryJson({ ok: true });
  });
}

export function DELETE(_request: Request, { params }: Context) {
  return withLibraryUser(async owner => {
    const { key, operationId } = await params;
    await undoWatches(owner, parseTitleKey(key), parseOperation(operationId));
    return libraryJson({ ok: true });
  });
}
