import { members } from "@/lib/mock-data/members";
import { Member } from "@/types/member";

export function getMembers(): Member[] {
  return members;
}

export function getMemberById(id: string): Member | undefined {
  return members.find((member) => member.id === id);
}