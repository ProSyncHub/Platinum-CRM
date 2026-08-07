export const FOLLOW_UP_PRIORITIES = {
  low: {
    label: "Low",
    badgeClass: "border-slate-200 bg-slate-50 text-slate-700",
  },
  medium: {
    label: "Medium",
    badgeClass: "border-blue-200 bg-blue-50 text-blue-700",
  },
  high: {
    label: "High",
    badgeClass: "border-amber-200 bg-amber-50 text-amber-800",
  },
  urgent: {
    label: "Urgent",
    badgeClass: "border-red-200 bg-red-50 text-red-700",
  },
} as const;

export const FOLLOW_UP_STATUSES = {
  pending: {
    label: "Pending",
    badgeClass: "border-amber-200 bg-amber-50 text-amber-800",
  },
  in_progress: {
    label: "In Progress",
    badgeClass: "border-indigo-200 bg-indigo-50 text-indigo-700",
  },
  completed: {
    label: "Completed",
    badgeClass: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  cancelled: {
    label: "Cancelled",
    badgeClass: "border-slate-200 bg-slate-100 text-slate-600",
  },
} as const;

export type FollowUpPriority = keyof typeof FOLLOW_UP_PRIORITIES;
export type FollowUpStatus = keyof typeof FOLLOW_UP_STATUSES;

export interface AssignableStaffView {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string;
}

export interface FollowUpTaskView {
  id: string;
  memberId: string;
  title: string;
  instructions?: string | null;
  priority: string;
  status: string;
  dueAt: string;
  assignedToUser: string;
  assignedToName: string;
  assignedToEmail: string;
  assignedToDepartment: string;
  createdByUser: string;
  createdByName: string;
  createdByEmail: string;
  createdByDepartment: string;
  completedAt?: string | null;
  completedByUser?: string | null;
  completedByName?: string | null;
  completionNotes?: string | null;
  createdAt: string;
  updatedAt: string;
  member: {
    id: string;
    fullName: string;
    memberCode: string;
    phone?: string | null;
    programType?: string | null;
    department?: string | null;
  };
}

export function getFollowUpPriorityMeta(priority?: string | null) {
  return (
    FOLLOW_UP_PRIORITIES[priority as FollowUpPriority] ||
    FOLLOW_UP_PRIORITIES.medium
  );
}

export function getFollowUpStatusMeta(status?: string | null) {
  return (
    FOLLOW_UP_STATUSES[status as FollowUpStatus] || FOLLOW_UP_STATUSES.pending
  );
}
