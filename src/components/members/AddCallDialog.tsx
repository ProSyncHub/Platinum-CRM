"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import { Input } from "@/components/ui/input";

import { Textarea } from "@/components/ui/textarea";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function AddCallDialog() {
  const [open, setOpen] = useState(false);

  const handleSave = () => {
    console.log("Call Saved");

    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        className="
            inline-flex items-center justify-center
            rounded-md bg-slate-900 px-4 py-2
            text-sm font-medium text-white
            hover:bg-slate-800
        "
        >
        Add Call
      </DialogTrigger>

      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            Log Member Call
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium">
              Call Type
            </label>

            <Select>
              <SelectTrigger>
                <SelectValue placeholder="Select call type" />
              </SelectTrigger>

              <SelectContent>
                <SelectItem value="welcome">
                  Welcome Call
                </SelectItem>

                <SelectItem value="followup">
                  Followup
                </SelectItem>

                <SelectItem value="research">
                  Research Review
                </SelectItem>

                <SelectItem value="approval">
                  Approval Discussion
                </SelectItem>

                <SelectItem value="launch">
                  Launch Discussion
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">
              Outcome
            </label>

            <Input placeholder="Call outcome" />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">
              Stage Change
            </label>

            <Select>
              <SelectTrigger>
                <SelectValue placeholder="Select stage" />
              </SelectTrigger>

              <SelectContent>
                <SelectItem value="onboarding">
                  Onboarding
                </SelectItem>

                <SelectItem value="research">
                  Research
                </SelectItem>

                <SelectItem value="sourcing">
                  Sourcing
                </SelectItem>

                <SelectItem value="approval">
                  Approval
                </SelectItem>

                <SelectItem value="growth">
                  Growth
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">
              Next Followup Date
            </label>

            <Input type="date" />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">
              Notes
            </label>

            <Textarea
              placeholder="Enter call notes..."
              rows={5}
            />
          </div>

          <Button
            className="w-full"
            onClick={handleSave}
          >
            Save Call
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}