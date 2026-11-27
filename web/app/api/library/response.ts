import { getChatGPTUser } from "@/app/chatgpt-auth";
import { CatalogError } from "@/lib/catalog";

export function parseCatalogId(value: string) {
  const id = Number(value);
  return /^[1-9]\d*$/.test(value) && Number.isSafeInteger(id) ? id : null;
}

export function libraryJson(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "private, no-store" } });
}

export async function withLibraryUser(action: (ownerId: string) => Promise<Response>) {
  try {
    const user = await getChatGPTUser();
    if (!user) return libraryJson({ error: "Entre para acessar a sua biblioteca." }, 401);
    return await action(user.userId);
  } catch (error) {
    if (error instanceof CatalogError) return libraryJson({ error: error.message }, error.status);
    return libraryJson({ error: "A biblioteca está indisponível. Tente novamente." }, 503);
  }
}
