"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import LogCallModal from "./LogCallModal";

export default function LogCallButton({
  memberId,
  memberName = "Member",
}: {
  memberId: string;
  memberName?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setIsOpen(true)}>
        Log Call & Connect
      </Button>

      <LogCallModal
        memberId={memberId}
        memberName={memberName}
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onSuccess={() => window.location.reload()}
      />
    </>
  );
}
