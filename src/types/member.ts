export interface Member {
  id: string;

  memberCode: string;

  fullName: string;

  phone: string;

  email: string;

  currentStage:
  | "onboarding"
  | "research"
  | "sourcing"
  | "approval"
  | "growth";

  currentMilestone: string;

  assignedManager: string;

  assignedResearchExecutive: string;

  assignedBrandExecutive: string;

  assignedApprovalExecutive: string;

  assignedGrowthExecutive: string;

  lastContactDate: string;

  nextFollowupDate: string;

  status: "healthy" | "warning" | "delayed";
}