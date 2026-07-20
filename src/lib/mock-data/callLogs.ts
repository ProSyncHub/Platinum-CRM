import { CallLog } from "@/types/call-log";

export const callLogs: CallLog[] = [
  {
    id: "1",
    memberId: "1",
    date: "2026-07-01",
    type: "Welcome Call",
    outcome: "Welcome Completed",
    notes: "Member onboarded successfully",
  },

  {
    id: "2",
    memberId: "1",
    date: "2026-07-03",
    type: "Followup",
    outcome: "Path Selected",
    notes: "Selected Private Label path",
  },

  {
    id: "3",
    memberId: "1",
    date: "2026-07-06",
    type: "Research Review",
    outcome: "Research Started",
    notes: "Research phase initiated",
  },

  {
    id: "4",
    memberId: "1",
    date: "2026-07-08",
    type: "Research Review",
    outcome: "Niche Shortlisted",
    notes: "Home decor niche shortlisted",
  },
];