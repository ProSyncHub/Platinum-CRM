"use client";

import { useState } from "react";
import { CalendarClock, UserRoundPlus, X } from "lucide-react";
import { toast } from "sonner";
import {
  createFollowUpTask,
  updateFollowUpTask,
} from "@/app/actions/followupActions";
import {
  FOLLOW_UP_PRIORITIES,
  type AssignableStaffView,
  type FollowUpPriority,
  type FollowUpTaskView,
} from "@/lib/followups";

interface FollowUpMemberOption {
  id: string;
  fullName: string;
  memberCode: string;
  programType?: string | null;
}

interface AssignFollowUpModalProps {
  members: FollowUpMemberOption[];
  staff: AssignableStaffView[];
  currentUserId: string;
  initialMemberId?: string;
  task?: FollowUpTaskView | null;
  onClose: () => void;
  onSuccess: () => void;
}

function defaultDueDateTime() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(10, 0, 0, 0);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function toIndiaDateTimeLocal(value: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "Asia/Kolkata",
  }).formatToParts(new Date(value));
  const getPart = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value || "";
  return `${getPart("year")}-${getPart("month")}-${getPart("day")}T${getPart("hour")}:${getPart("minute")}`;
}

export default function AssignFollowUpModal({
  members,
  staff,
  currentUserId,
  initialMemberId,
  task,
  onClose,
  onSuccess,
}: AssignFollowUpModalProps) {
  const [memberId, setMemberId] = useState(task?.memberId || initialMemberId || members[0]?.id || "");
  const [assignedToUser, setAssignedToUser] = useState(
    task?.assignedToUser || (staff.some((person) => person.id === currentUserId)
      ? currentUserId
      : staff[0]?.id || ""),
  );
  const [dueAt, setDueAt] = useState(() => task ? toIndiaDateTimeLocal(task.dueAt) : defaultDueDateTime());
  const [priority, setPriority] = useState<FollowUpPriority>((task?.priority as FollowUpPriority) || "medium");
  const [title, setTitle] = useState(task?.title || "");
  const [instructions, setInstructions] = useState(task?.instructions || "");
  const [loading, setLoading] = useState(false);

  const selectedMember = members.find((member) => member.id === memberId);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!memberId || !assignedToUser || !dueAt) {
      toast.error("Choose a member, assignee, and due date.");
      return;
    }

    setLoading(true);
    try {
      const taskInput = {
        assignedToUser,
        dueAt: new Date(dueAt).toISOString(),
        priority,
        title,
        instructions,
      };
      const result = task
        ? await updateFollowUpTask({ taskId: task.id, ...taskInput })
        : await createFollowUpTask({ memberId, ...taskInput });

      if (!result.success) {
        toast.error(result.error || "Unable to assign follow-up");
        return;
      }

      toast.success(task ? "Follow-up assignment updated" : "Follow-up assigned successfully");
      onSuccess();
      onClose();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Unable to assign follow-up");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-xs">
      <div className="my-8 w-full max-w-2xl rounded-3xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-6">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-3 text-indigo-700">
              <UserRoundPlus className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">{task ? "Edit Follow-Up Assignment" : "Assign Follow-Up"}</h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Set a clear owner, due time, priority, and instructions.
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Close follow-up assignment form"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="follow-up-member" className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-700">
                Member
              </label>
              <select
                id="follow-up-member"
                required
                disabled={Boolean(task)}
                value={memberId}
                onChange={(event) => setMemberId(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm focus:border-indigo-500 focus:bg-white focus:outline-none"
              >
                {members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.fullName} · {member.memberCode}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="follow-up-assignee" className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-700">
                Assign to
              </label>
              <select
                id="follow-up-assignee"
                required
                value={assignedToUser}
                onChange={(event) => setAssignedToUser(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm focus:border-indigo-500 focus:bg-white focus:outline-none"
              >
                {staff.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.name} · {person.department} · {person.role}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="follow-up-due" className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-700">
                Due date and time
              </label>
              <div className="relative">
                <CalendarClock className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                <input
                  id="follow-up-due"
                  required
                  type="datetime-local"
                  value={dueAt}
                  onChange={(event) => setDueAt(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm focus:border-indigo-500 focus:bg-white focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label htmlFor="follow-up-priority" className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-700">
                Priority
              </label>
              <select
                id="follow-up-priority"
                value={priority}
                onChange={(event) => setPriority(event.target.value as FollowUpPriority)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm focus:border-indigo-500 focus:bg-white focus:outline-none"
              >
                {Object.entries(FOLLOW_UP_PRIORITIES).map(([value, meta]) => (
                  <option key={value} value={value}>{meta.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="follow-up-title" className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-700">
              Task title
            </label>
            <input
              id="follow-up-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={160}
              placeholder={selectedMember ? `Follow up with ${selectedMember.fullName}` : "Member follow-up"}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm focus:border-indigo-500 focus:bg-white focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="follow-up-instructions" className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-700">
              Instructions / expected outcome
            </label>
            <textarea
              id="follow-up-instructions"
              rows={4}
              value={instructions}
              onChange={(event) => setInstructions(event.target.value)}
              maxLength={2000}
              placeholder="What should be discussed, checked, or collected during this follow-up?"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm leading-6 focus:border-indigo-500 focus:bg-white focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
            <button type="button" onClick={onClose} className="rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-200">
              Cancel
            </button>
            <button type="submit" disabled={loading || staff.length === 0 || members.length === 0} className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-50">
              {loading ? "Saving..." : task ? "Save Assignment" : "Assign Follow-Up"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
