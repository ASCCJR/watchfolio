import { removeFromShelf, setStatus } from "@/db/shelf";
import { getTitle } from "@/lib/titles";
import { libraryJson, withLibraryUser } from "../../library/response";
import { parseStatus, parseTitleKey, readObject } from "../input";

type Context = { params: Promise<{ key: string }> };

export function PUT(request: Request, { params }: Context) {
  return withLibraryUser(async owner => {
    const key = parseTitleKey((await params).key);
    const status = parseStatus((await readObject(request)).status);
    const { title } = await getTitle(key);
    await setStatus(owner, title, status);
    return libraryJson({ ok: true });
  });
}

export function DELETE(_request: Request, { params }: Context) {
  return withLibraryUser(async owner => {
    await removeFromShelf(owner, parseTitleKey((await params).key));
    return libraryJson({ ok: true });
  });
}
