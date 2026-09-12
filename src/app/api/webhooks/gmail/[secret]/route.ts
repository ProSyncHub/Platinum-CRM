import { handleGmailWebhook } from "../route";

export async function POST(
  request: Request,
  context: { params: Promise<{ secret: string }> },
) {
  const { secret } = await context.params;
  return handleGmailWebhook(request, secret);
}
