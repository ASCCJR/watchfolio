import { catalogErrorResponse, getShow } from "@/lib/catalog";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const showId = /^[1-9]\d*$/.test(id) ? Number(id) : NaN;
    const detail = await getShow(showId);
    return Response.json(detail);
  } catch (error) {
    return catalogErrorResponse(error);
  }
}
