import { saveShow, unwatchEpisode } from "@/db/library";
import { getShow } from "@/lib/catalog";
import { libraryJson, parseCatalogId, withLibraryUser } from "../../../response";

type Context = { params: Promise<{ id: string; episodeId: string }> };

function withEpisode(
  context: Context,
  action: (ownerId: string, showId: number, episodeId: number) => Promise<Response>,
) {
  return withLibraryUser(async (ownerId) => {
    const params = await context.params;
    const showId = parseCatalogId(params.id);
    const episodeId = parseCatalogId(params.episodeId);
    if (showId === null || episodeId === null) {
      return libraryJson({ error: "Série ou episódio inválido." }, 400);
    }
    return action(ownerId, showId, episodeId);
  });
}

export function PUT(_request: Request, context: Context) {
  return withEpisode(context, async (ownerId, showId, episodeId) => {
    const { show, episodes } = await getShow(showId);
    const episode = episodes.find((item) => item.id === episodeId);
    if (!episode) return libraryJson({ error: "Episódio não encontrado nesta série." }, 404);
    if (!episode.available) {
      return libraryJson({ error: "O catálogo ainda não confirmou a exibição deste episódio." }, 409);
    }

    await saveShow(ownerId, show, episode);
    return libraryJson({ ok: true });
  });
}

export function DELETE(_request: Request, context: Context) {
  return withEpisode(context, async (ownerId, showId, episodeId) => {
    await unwatchEpisode(ownerId, showId, episodeId);
    return libraryJson({ ok: true });
  });
}
