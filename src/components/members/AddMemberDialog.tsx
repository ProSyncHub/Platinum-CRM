"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { stages } from "@/lib/constants/stages";
import { users } from "@/lib/mock-data/users";

export default function AddMemberDialog() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="inline-flex items-center justify-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">
        Add Member
      </DialogTrigger>

      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            Add New Platinum Member
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-2">
          <Input placeholder="Full Name" />
          <Input placeholder="Phone Number" />

          <Input placeholder="Email Address" />

          <Select>
            <SelectTrigger>
              <SelectValue placeholder="Current Stage" />
            </SelectTrigger>

            <SelectContent>
              {stages.map((stage) => (
                <SelectItem
                    key={stage.value}
                    value={stage.value}
                >
                    {stage.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select>
            <SelectTrigger>
              <SelectValue placeholder="Manager" />
            </SelectTrigger>

            <SelectContent>
              {users.map((user) => (
                <SelectItem
                  key={user.id}
                  value={user.id}
                >
                  {user.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select>
            <SelectTrigger>
              <SelectValue placeholder="Research Executive" />
            </SelectTrigger>

            <SelectContent>
              {users.map((user) => (
                <SelectItem
                  key={user.id}
                  value={user.id}
                >
                  {user.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select>
            <SelectTrigger>
              <SelectValue placeholder="Brand Executive" />
            </SelectTrigger>

            <SelectContent>
              {users.map((user) => (
                <SelectItem
                  key={user.id}
                  value={user.id}
                >
                  {user.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select>
            <SelectTrigger>
              <SelectValue placeholder="Approval Executive" />
            </SelectTrigger>

            <SelectContent>
              {users.map((user) => (
                <SelectItem
                  key={user.id}
                  value={user.id}
                >
                  {user.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button className="mt-4 w-full">
          Save Member
        </Button>
      </DialogContent>
    </Dialog>
  );
}