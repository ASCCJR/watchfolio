import { createList, readLists } from "@/db/lists";
import { libraryJson, withLibraryUser } from "../library/response";

export const dynamic = "force-dynamic";

export function GET() {
  return withLibraryUser(async ownerId => libraryJson({ lists: await readLists(ownerId) }));
}

export function POST(request: Request) {
  return withLibraryUser(async ownerId => {
    const data = await request.json().catch(() => null) as { id?: unknown; name?: unknown } | null;
    const name = typeof data?.name === "string" ? data.name.trim() : "";
    if (typeof data?.id !== "string" || !/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(data.id) || !name || name.length > 100) {
      return libraryJson({ error: "Informe um nome de até 100 caracteres para a lista." }, 400);
    }
    await createList(ownerId, data.id, name);
    return libraryJson({ id: data.id });
  });
}
