import { changeSessionDate, deleteSession } from "@/db/shelf";
import { libraryJson, withLibraryUser } from "../../../../library/response";
import { parseDate, parseTitleKey, readObject } from "../../../input";

type Context = { params: Promise<{ key: string; id: string }> };

export function PATCH(request: Request, { params }: Context) {
  return withLibraryUser(async owner => {
    const { key, id } = await params;
    const date = parseDate((await readObject(request)).watchedOn);
    await changeSessionDate(owner, parseTitleKey(key), id, date);
    return libraryJson({ ok: true });
  });
}

export function DELETE(_request: Request, { params }: Context) {
  return withLibraryUser(async owner => {
    const { key, id } = await params;
    await deleteSession(owner, parseTitleKey(key), id);
    return libraryJson({ ok: true });
  });
}
