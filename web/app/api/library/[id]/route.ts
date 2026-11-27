import { saveShow } from "@/db/library";
import { getShow } from "@/lib/catalog";
import { libraryJson, parseCatalogId, withLibraryUser } from "../response";

type Context = { params: Promise<{ id: string }> };

export function PUT(_request: Request, { params }: Context) {
  return withLibraryUser(async (ownerId) => {
    const showId = parseCatalogId((await params).id);
    if (showId === null) return libraryJson({ error: "Série inválida." }, 400);

    const { show } = await getShow(showId);
    await saveShow(ownerId, show);
    return libraryJson({ ok: true });
  });
}
