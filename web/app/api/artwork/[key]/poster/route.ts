import { readPoster, removePoster, savePoster } from "@/db/artwork";
import { libraryJson, withLibraryUser } from "@/app/api/library/response";
import { artworkBody, artworkKey, parsePhoto, revision } from "../../input";

type Context = { params: Promise<{ key: string }> };
export const dynamic = "force-dynamic";

export function GET(_request: Request, { params }: Context) {
  return withLibraryUser(async owner => {
    const image = await readPoster(owner, artworkKey((await params).key));
    return new Response(image, { headers: { "content-type": "image/webp", "cache-control": "private, no-store", "x-content-type-options": "nosniff" } });
  });
}

export function PUT(request: Request, { params }: Context) {
  return withLibraryUser(async owner => {
    const key = artworkKey((await params).key), body = await artworkBody(request);
    const next = await savePoster(owner, key, revision(body.revision), parsePhoto(body.photo));
    return libraryJson({ revision: next });
  });
}

export function DELETE(request: Request, { params }: Context) {
  return withLibraryUser(async owner => {
    const key = artworkKey((await params).key), expected = revision(new URL(request.url).searchParams.get("revision"));
    if (!expected) return libraryJson({ error: "Informe a versão do pôster." }, 400);
    await removePoster(owner, key, expected);
    return libraryJson({ ok: true });
  });
}
