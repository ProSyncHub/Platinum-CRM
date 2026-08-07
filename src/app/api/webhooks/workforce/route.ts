import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature =
      req.headers.get("x-workforce-signature") ||
      req.headers.get("x-signature") ||
      "";
    const webhookSecret = process.env.WORKFORCE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      return NextResponse.json(
        { success: false, message: "Workforce webhook is not configured" },
        { status: 503 },
      );
    }
    if (!signature) {
      return NextResponse.json(
        { success: false, message: "Missing webhook signature" },
        { status: 401 },
      );
    }

    const expectedSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(rawBody)
      .digest("hex");
    const receivedSignature = signature.replace(/^sha256=/i, "");
    const expectedBuffer = Buffer.from(expectedSignature, "hex");
    const receivedBuffer = Buffer.from(receivedSignature, "hex");
    if (
      expectedBuffer.length !== receivedBuffer.length ||
      !crypto.timingSafeEqual(expectedBuffer, receivedBuffer)
    ) {
      return NextResponse.json(
        { success: false, message: "Invalid webhook signature" },
        { status: 401 },
      );
    }

    const payload = JSON.parse(rawBody);
    const { event, action, employee, data } = payload;
    const empData = employee || data || payload;

    if (!empData?.email) {
      return NextResponse.json(
        { success: false, message: "No employee email found in payload" },
        { status: 400 },
      );
    }

    const email = empData.email.toLowerCase().trim();
    const eventType = (event || action || "update").toLowerCase();

    if (eventType.includes("delete") || eventType.includes("remove")) {
      await prisma.user.updateMany({
        where: { email },
        data: { active: false },
      });
      return NextResponse.json({
        success: true,
        message: `Deactivated employee ${email}`,
      });
    }

    const initialPasswordHash = await bcrypt.hash(
      crypto.randomBytes(32).toString("base64url"),
      10,
    );
    const name = empData.name || empData.fullName || email.split("@")[0];

    let department = "operations";
    if (typeof empData.department === "string") {
      department = empData.department.toLowerCase();
    } else if (empData.department && typeof empData.department === "object") {
      department = (
        empData.department.slug ||
        empData.department.name ||
        "operations"
      ).toLowerCase();
    }

    let role = (empData.role || "employee").toLowerCase();
    if (!["admin", "manager", "employee"].includes(role)) {
      role =
        role.includes("manager") || role.includes("lead")
          ? "manager"
          : "employee";
    }

    await prisma.user.upsert({
      where: { email },
      update: {
        name,
        role,
        department,
        active: empData.active !== false,
      },
      create: {
        name,
        email,
        // New synced accounts require an administrator password reset before login.
        password: initialPasswordHash,
        role,
        department,
        active: empData.active !== false,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Employee ${email} synchronized successfully`,
    });
  } catch (error: unknown) {
    console.error("Error processing Workforce webhook:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unexpected webhook error",
      },
      { status: 500 },
    );
  }
}
