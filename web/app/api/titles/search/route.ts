import { catalogErrorResponse } from "@/lib/catalog";
import { searchTitles } from "@/lib/titles";

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    return Response.json(await searchTitles(params.get("q") ?? "", params.get("type") ?? "all"));
  } catch (error) {
    return catalogErrorResponse(error);
  }
}
