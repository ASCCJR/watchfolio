import { catalogErrorResponse } from "@/lib/catalog";
import { getTitle } from "@/lib/titles";

export async function GET(_request: Request, context: { params: Promise<{ key: string }> }) {
  try {
    const { key } = await context.params;
    return Response.json(await getTitle(key));
  } catch (error) {
    return catalogErrorResponse(error);
  }
}
