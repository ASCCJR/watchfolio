import { catalogErrorResponse, searchShows } from "@/lib/catalog";

export async function GET(request: Request) {
  try {
    const query = new URL(request.url).searchParams.get("q") ?? "";
    const shows = await searchShows(query);
    return Response.json({ shows });
  } catch (error) {
    return catalogErrorResponse(error);
  }
}
