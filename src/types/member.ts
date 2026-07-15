export interface Member {
  id: string;
  fullName: string;

  currentStage: string;

  currentMilestone: string;

  assignedExecutive: string;

  lastContactDate: string;

  nextFollowupDate: string;

  status: "healthy" | "warning" | "delayed";
}