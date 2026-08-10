import {
  LayoutDashboard,
  Users,
  Search,
  ShieldCheck,
  Phone,
  CalendarCheck,
  BarChart3,
  Handshake,
  Inbox,
} from "lucide-react";

export const navigation = [
  {
    title: "Member Workspace",
    href: "/workspace",
    icon: Search,
  },
  {
    title: "Overview",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "Members",
    href: "/members",
    icon: Users,
  },
  {
    title: "Leads",
    href: "/leads",
    icon: Inbox,
  },
  {
    title: "Calls",
    href: "/calls",
    icon: Phone,
  },
  {
    title: "Followups",
    href: "/followups",
    icon: CalendarCheck,
  },
  {
    title: "Partner Services",
    href: "/services",
    icon: Handshake,
  },
  {
    title: "Reports",
    href: "/reports",
    icon: BarChart3,
  },
  {
    title: "Approvals",
    href: "/approvals",
    icon: ShieldCheck,
    adminOnly: true,
  },
  {
    title: "Team",
    href: "/team",
    icon: Users,
  },
];
