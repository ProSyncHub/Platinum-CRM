import { prisma } from "@/lib/db";
import { authorizeMobile } from "@/lib/mobileCalls";

export async function GET(request: Request) {
  if (!authorizeMobile(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const employees = await prisma.user.findMany({
    where: { active: true },
    orderBy: [{ name: "asc" }],
    select: { id: true, name: true, email: true, department: true, role: true },
  });
  return Response.json({ employees });
}
