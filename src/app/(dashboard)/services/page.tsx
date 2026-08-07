import { getServiceOverview } from "@/app/actions/serviceActions";
import ServicesOverviewClient from "@/components/services/ServicesOverviewClient";

export default async function ServicesPage() {
  const result = await getServiceOverview();

  if (!result.success) {
    return (
      <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-sm font-medium text-rose-800">
        {result.error || "Unable to load partner services."}
      </div>
    );
  }

  return (
    <ServicesOverviewClient
      partners={result.partners}
      referrals={result.referrals}
    />
  );
}
