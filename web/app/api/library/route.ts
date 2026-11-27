import { readLibrary } from "@/db/library";
import { libraryJson, withLibraryUser } from "./response";

export const dynamic = "force-dynamic";

export function GET() {
  return withLibraryUser(async (ownerId) => libraryJson(await readLibrary(ownerId)));
}
