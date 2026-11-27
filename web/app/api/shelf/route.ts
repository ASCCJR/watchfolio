import { readShelf } from "@/db/shelf";
import { libraryJson, withLibraryUser } from "../library/response";

export const dynamic = "force-dynamic";

export function GET() {
  return withLibraryUser(async owner => libraryJson(await readShelf(owner)));
}
