import { handleWatiLeadWebhook } from "@/app/api/webhooks/leads/wati/route";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ secret: string }> },
) {
  const { secret } = await context.params;
  return handleWatiLeadWebhook(request, decodeURIComponent(secret));
}
