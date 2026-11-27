import { deleteList, readList, updateList } from "@/db/lists";
import { getTitle } from "@/lib/titles";
import { libraryJson, withLibraryUser } from "../../library/response";

type Context = { params: Promise<{ id: string }> };
const stale = () => libraryJson({ error: "A lista mudou em outra sessão. Confira a versão atual e repita a alteração." }, 409);

export function PATCH(request: Request, { params }: Context) {
  return withLibraryUser(async ownerId => {
    const { id } = await params;
    const data = await request.json().catch(() => null) as Record<string, unknown> | null;
    if (!data || !Number.isSafeInteger(data.revision)) return libraryJson({ error: "Versão da lista inválida." }, 400);
    const list = await readList(ownerId, id);
    if (!list) return libraryJson({ error: "Lista não encontrada." }, 404);
    if (data.revision !== list.revision) return stale();
    let { name, titles } = list;
    if (data.action === "rename" && typeof data.name === "string") {
      name = data.name.trim();
      if (!name || name.length > 100) return libraryJson({ error: "Use um nome entre 1 e 100 caracteres." }, 400);
    } else if (typeof data.key === "string") {
      const key = data.key;
      const index = titles.findIndex(title => title.key === key);
      switch (data.action) {
        case "add":
          if (index === -1) titles = [...titles, (await getTitle(key)).title];
          break;
        case "remove":
          titles = titles.filter(title => title.key !== key);
          break;
        case "up":
        case "down": {
          const target = index + (data.action === "up" ? -1 : 1);
          if (index < 0 || target < 0 || target >= titles.length) return libraryJson({ error: "Posição inválida." }, 400);
          [titles[index], titles[target]] = [titles[target], titles[index]];
          break;
        }
        default: return libraryJson({ error: "Alteração de lista inválida." }, 400);
      }
    } else {
      return libraryJson({ error: "Informe o nome ou o título a alterar." }, 400);
    }
    return await updateList(ownerId, id, list.revision, { name, titles }) ? libraryJson({ ok: true }) : stale();
  });
}

export function DELETE(request: Request, { params }: Context) {
  return withLibraryUser(async ownerId => {
    const { id } = await params;
    const revision = Number(new URL(request.url).searchParams.get("revision"));
    if (!Number.isSafeInteger(revision) || revision < 1) return libraryJson({ error: "Versão da lista inválida." }, 400);
    return await deleteList(ownerId, id, revision) ? libraryJson({ ok: true }) : stale();
  });
}
