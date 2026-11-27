import { listPosters } from "@/db/artwork";
import { libraryJson, withLibraryUser } from "../library/response";

export const dynamic = "force-dynamic";
export function GET() {
  return withLibraryUser(async owner => libraryJson({ posters: await listPosters(owner) }));
}
