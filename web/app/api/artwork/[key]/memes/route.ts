import { listMemes } from "@/db/artwork";
import { libraryJson, withLibraryUser } from "@/app/api/library/response";
import { artworkKey } from "../../input";

export const dynamic = "force-dynamic";
export function GET(_request: Request, { params }: { params: Promise<{ key: string }> }) {
  return withLibraryUser(async owner => libraryJson({ memes: await listMemes(owner, artworkKey((await params).key)) }));
}
