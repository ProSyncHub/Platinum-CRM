"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import LogCallModal from "./LogCallModal";

export default function LogCallButton({ memberId }: { memberId: string }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setIsOpen(true)}>
        Log Call & Transfer
      </Button>
      
      <LogCallModal
        memberId={memberId}
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
      />
    </>
  );
}
