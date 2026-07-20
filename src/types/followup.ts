export interface Followup {
  id: string;

  memberId: string;

  title: string;

  dueDate: string;

  status: "pending" | "completed";
}