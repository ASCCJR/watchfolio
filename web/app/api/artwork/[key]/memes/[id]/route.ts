import { readMeme, removeMeme, saveMeme } from "@/db/artwork";
import { libraryJson, withLibraryUser } from "@/app/api/library/response";
import { artworkBody, artworkKey, memeId, parseRecipe, revision } from "../../../input";

type Context = { params: Promise<{ key: string; id: string }> };
export const dynamic = "force-dynamic";

export function GET(_request: Request, { params }: Context) {
  return withLibraryUser(async owner => {
    const { key, id } = await params;
    return libraryJson(await readMeme(owner, artworkKey(key), memeId(id)));
  });
}

export function PUT(request: Request, { params }: Context) {
  return withLibraryUser(async owner => {
    const { key, id } = await params, body = await artworkBody(request);
    const next = await saveMeme(owner, artworkKey(key), memeId(id), revision(body.revision), parseRecipe(body.recipe));
    return libraryJson({ revision: next });
  });
}

export function DELETE(request: Request, { params }: Context) {
  return withLibraryUser(async owner => {
    const { key, id } = await params, expected = revision(new URL(request.url).searchParams.get("revision"));
    if (!expected) return libraryJson({ error: "Informe a versão do meme." }, 400);
    await removeMeme(owner, artworkKey(key), memeId(id), expected);
    return libraryJson({ ok: true });
  });
}
