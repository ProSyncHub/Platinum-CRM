import MembersTable from "@/components/members/MembersTable";
import AddMemberDialog from "@/components/members/AddMemberDialog";

export default function MembersPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">
            Members
          </h1>

          <p className="text-slate-500">
            Manage all platinum members.
          </p>
        </div>

        <AddMemberDialog />
      </div>

      <MembersTable />
    </div>
  );
}