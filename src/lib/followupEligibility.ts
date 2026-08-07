export type FollowUpPreference = "auto" | "always" | "never";

export interface FollowUpEligibilityInput {
  activeStatus?: string | null;
  endDate?: string | Date | null;
  followUpPreference?: string | null;
}

export function normalizeFollowUpPreference(
  preference?: string | null,
): FollowUpPreference {
  if (preference === "always" || preference === "never") return preference;
  return "auto";
}

export function isMemberFollowUpEligible(
  member: FollowUpEligibilityInput,
  referenceDate: string | Date = new Date(),
) {
  const preference = normalizeFollowUpPreference(member.followUpPreference);
  if (preference === "always") return true;
  if (preference === "never") return false;

  const now = new Date(referenceDate);
  const endDate = member.endDate ? new Date(member.endDate) : null;
  const normalizedStatus = (member.activeStatus || "").trim().toLowerCase();
  const isExplicitlyActive = normalizedStatus === "active";

  if (endDate && !Number.isNaN(endDate.getTime()) && endDate < now) {
    const twoMonthsAgo = new Date(now);
    twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
    return endDate >= twoMonthsAgo;
  }

  return isExplicitlyActive;
}
