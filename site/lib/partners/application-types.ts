export const PARTNER_APPLICATION_STATUSES = [
  "pending",
  "in_review",
  "approving",
  "approved",
  "rejected",
] as const;

export type PartnerApplicationStatus = (typeof PARTNER_APPLICATION_STATUSES)[number];

export type PartnerApplicationRecord = {
  applicationId: string;
  normalizedEmail: string;
  displayName: string;
  status: PartnerApplicationStatus;
  partnerId: string | null;
  approvalAttemptId: string | null;
  createdAt: string;
  updatedAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
  rejectionReason: string | null;
};

export class PartnerApplicationError extends Error {
  code: string;
  status: number;

  constructor(message: string, code: string, status = 400) {
    super(message);
    this.name = "PartnerApplicationError";
    this.code = code;
    this.status = status;
  }
}

export class PartnerApplicationStoreUnavailableError extends Error {
  constructor(message = "Partner application persistence is unavailable.") {
    super(message);
    this.name = "PartnerApplicationStoreUnavailableError";
  }
}
