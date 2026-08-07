import { prisma } from "@/lib/db";
import {
  getMembershipStatus,
  getContactAttentionStatus,
} from "@/lib/membershipUtils";
import AttentionTableClient from "./AttentionTableClient";

export default async function AttentionTable() {
  const members = await prisma.member.findMany({
    take: 60,
    orderBy: { updatedAt: "desc" },
    include: {
      callLogs: {
        orderBy: { date: "desc" },
        take: 1,
      },
    },
  });

  // Filter members that need attention: Expiring soon (<30 days), Expired, On Hold, Inactive (>7d), or flagged
  const attentionMembers = members
    .map((m) => {
      const statusInfo = getMembershipStatus(
        m.enrollingDate,
        m.endDate,
        m.activeStatus
      );
      const contactStatus = getContactAttentionStatus(
        m.callLogs[0]?.date || null,
        m.nextConnectDate
      );
      return {
        ...m,
        lastConnectDate: m.callLogs[0]?.date || null,
        lastContactMedium: m.callLogs[0]?.medium || null,
        lastContactStaff: m.callLogs[0]?.staffName || null,
        statusInfo,
        contactStatus,
      };
    })
    .filter(
      (m) =>
        m.statusInfo.isExpiringSoon ||
        m.statusInfo.isExpired ||
        m.statusInfo.status === "On Hold" ||
        m.contactStatus.urgency === "urgent" ||
        m.contactStatus.urgency === "due_soon" ||
        m.healthStatus === "warning" ||
        m.healthStatus === "critical"
    )
    .slice(0, 10);

  return <AttentionTableClient initialMembers={attentionMembers} />;
}
