import { getAllMembers } from "@/app/actions/memberActions";
import { getFollowUpWorkspace } from "@/app/actions/followupActions";
import FollowupsQueueClient from "@/components/followups/FollowupsQueueClient";
import { isMemberFollowUpEligible } from "@/lib/followupEligibility";

export const dynamic = "force-dynamic";

export default async function FollowupsPage() {
  const [{ members }, workspace] = await Promise.all([
    getAllMembers(),
    getFollowUpWorkspace(),
  ]);

  if (!workspace.success || !workspace.currentUser) {
    return (
      <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-sm font-semibold text-red-700">
        {workspace.error || "Unable to load follow-up assignments."}
      </div>
    );
  }

  const eligibleMembers = members.filter((member) =>
    isMemberFollowUpEligible(member, workspace.generatedAt),
  );
  const eligibleMemberIds = new Set(eligibleMembers.map((member) => member.id));
  const eligibleTasks = workspace.tasks.filter((task) =>
    eligibleMemberIds.has(task.memberId),
  );

  return (
    <div className="space-y-6 pb-12">
      {/* Interactive Follow-ups Queue */}
      <FollowupsQueueClient
        initialMembers={eligibleMembers}
        allMembers={members}
        initialTasks={eligibleTasks}
        assignableStaff={workspace.assignableStaff}
        currentUser={workspace.currentUser}
        generatedAt={workspace.generatedAt}
      />
    </div>
  );
}
