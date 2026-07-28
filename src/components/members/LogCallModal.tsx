"use client";

import { useState, useEffect } from "react";
import { logCall } from "@/app/actions/logCall";
import { getUsersByDepartment } from "@/app/actions/getUsers";
import { toast } from "sonner"; // Assuming sonner is installed, as seen in package.json

interface LogCallModalProps {
  memberId: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function LogCallModal({ memberId, isOpen, onClose }: LogCallModalProps) {
  const [type, setType] = useState("outbound");
  const [outcome, setOutcome] = useState("connected");
  const [notes, setNotes] = useState("");
  const [transferQuery, setTransferQuery] = useState(false);
  const [toDepartment, setToDepartment] = useState("");
  const [assignedToUser, setAssignedToUser] = useState("");
  const [reason, setReason] = useState("");
  const [departmentUsers, setDepartmentUsers] = useState<{id: string, name: string}[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (toDepartment) {
      getUsersByDepartment(toDepartment).then(setDepartmentUsers).catch(console.error);
    } else {
      setDepartmentUsers([]);
    }
    setAssignedToUser("");
  }, [toDepartment]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      await logCall({
        memberId,
        type,
        outcome,
        notes,
        transferQuery,
        toDepartment: transferQuery ? toDepartment : undefined,
        assignedToUser: transferQuery && assignedToUser ? assignedToUser : undefined,
        reason: transferQuery ? reason : undefined,
      });
      toast.success("Call logged successfully!");
      onClose();
      // Reset form
      setType("outbound");
      setOutcome("connected");
      setNotes("");
      setTransferQuery(false);
      setToDepartment("");
      setReason("");
    } catch (error) {
      console.error(error);
      toast.error("Failed to log call");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg overflow-hidden">
        <div className="px-6 py-4 border-b flex justify-between items-center">
          <h2 className="text-xl font-semibold">Log Call</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">&times;</button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Call Type</label>
              <select 
                value={type} 
                onChange={e => setType(e.target.value)}
                className="w-full p-2 border rounded-md"
              >
                <option value="outbound">Outbound</option>
                <option value="inbound">Inbound</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Outcome</label>
              <select 
                value={outcome} 
                onChange={e => setOutcome(e.target.value)}
                className="w-full p-2 border rounded-md"
              >
                <option value="connected">Connected</option>
                <option value="no_answer">No Answer</option>
                <option value="voicemail">Left Voicemail</option>
                <option value="busy">Busy/Rejected</option>
              </select>
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Notes</label>
            <textarea
              required
              rows={3}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full p-2 border rounded-md"
              placeholder="Summary of the call..."
            />
          </div>
          
          <div className="border-t pt-4">
            <label className="flex items-center space-x-2">
              <input 
                type="checkbox" 
                checked={transferQuery} 
                onChange={e => setTransferQuery(e.target.checked)}
                className="rounded border-slate-300"
              />
              <span className="font-medium">Transfer Query / Assign to Department</span>
            </label>
          </div>
          
          {transferQuery && (
            <div className="space-y-4 bg-slate-50 p-4 rounded-md border">
              <div>
                <label className="block text-sm font-medium mb-1">Target Department</label>
                <select 
                  required
                  value={toDepartment} 
                  onChange={e => setToDepartment(e.target.value)}
                  className="w-full p-2 border rounded-md"
                >
                  <option value="">Select a department...</option>
                  <option value="manager">Manager / Escalation</option>
                  <option value="ecom">E-commerce</option>
                  <option value="brand">Brand</option>
                  <option value="follow_up">Follow Up</option>
                </select>
              </div>
              
              {toDepartment && departmentUsers.length > 0 && (
                <div>
                  <label className="block text-sm font-medium mb-1">Assign to specific employee (Optional)</label>
                  <select 
                    value={assignedToUser} 
                    onChange={e => setAssignedToUser(e.target.value)}
                    className="w-full p-2 border rounded-md"
                  >
                    <option value="">Any available</option>
                    {departmentUsers.map(u => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                </div>
              )}
              
              <div>
                <label className="block text-sm font-medium mb-1">Transfer Reason / Context</label>
                <textarea
                  required
                  rows={2}
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  className="w-full p-2 border rounded-md"
                  placeholder="Why is this being transferred?"
                />
              </div>
            </div>
          )}
          
          <div className="pt-4 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-50"
            >
              {isLoading ? "Saving..." : "Log Call"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
