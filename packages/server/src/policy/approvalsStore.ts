import { randomUUID } from "crypto";

export type ApprovalStatus = "pending" | "approved" | "rejected";

export type Approval = {
  id: string;
  createdAt: number;
  actor: string;
  action: string;
  summary: string;
  payload: any;
  status: ApprovalStatus;
  decidedAt?: number;
  decidedBy?: string;
};

let approvals: Approval[] = [];

export function initApprovalsStore() {
  approvals = [];
}

export function createApproval(action: string, summary: string, payload: any, actor: string): Approval {
  const a: Approval = {
    id: randomUUID(),
    createdAt: Date.now(),
    actor,
    action,
    summary,
    payload,
    status: "pending",
  };
  approvals.unshift(a);
  return a;
}

export function listApprovals(): Approval[] {
  return approvals.slice();
}

export function decideApproval(id: string, status: "approved" | "rejected", decidedBy: string): Approval | null {
  const a = approvals.find(x => x.id === id);
  if (!a) return null;
  a.status = status;
  a.decidedAt = Date.now();
  a.decidedBy = decidedBy;
  return a;
}

export function getApproval(id: string): Approval | null {
  return approvals.find(x => x.id === id) ?? null;
}
