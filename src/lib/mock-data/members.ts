import { Member } from "@/types/member";

export const members: Member[] = [
  {
    id: "1",

    memberCode: "PM001",

    fullName: "John Smith",

    phone: "9876543210",

    email: "john@example.com",

    currentStage: "research",

    currentMilestone: "Niche Shortlisted",

    assignedManager: "Abbie",

    assignedResearchExecutive: "Rahul",

    assignedBrandExecutive: "Priya",

    assignedApprovalExecutive: "Aman",

    assignedGrowthExecutive: "Neha",

    lastContactDate: "2026-07-01",

    nextFollowupDate: "2026-07-08",

    status: "warning",
  },

  {
    id: "2",

    memberCode: "PM002",

    fullName: "Sarah Khan",

    phone: "9876543211",

    email: "sarah@example.com",

    currentStage: "approval",

    currentMilestone: "Margin Calculation",

    assignedManager: "Abbie",

    assignedResearchExecutive: "Rahul",

    assignedBrandExecutive: "Priya",

    assignedApprovalExecutive: "Aman",

    assignedGrowthExecutive: "Neha",

    lastContactDate: "2026-07-02",

    nextFollowupDate: "2026-07-09",

    status: "healthy",
  },
];