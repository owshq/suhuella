import {
  createOnboardingInvite,
  createPartner,
  hasOpenPartnerInviteForEmail,
  PartnerError,
} from "./service.ts";
import {
  getPartnerApplicationStore,
  PartnerApplicationError,
} from "./application-store.ts";
import type { PartnerAdminCreateOrigin, PartnerActor } from "./types.ts";
import { getPartnerStore } from "./store.ts";

function createAttemptId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `ptr_appr_${crypto.randomUUID()}`;
  }
  return `ptr_appr_${Date.now().toString(36)}`;
}

async function findPartnerIdByOwnerEmail(email: string): Promise<string | null> {
  const normalized = email.trim().toLowerCase();
  const doc = await (await getPartnerStore()).read();
  const partner = doc.partners.find(
    (item) =>
      item.ownerEmail === normalized &&
      item.status !== "revoked",
  );
  return partner?.partnerId ?? null;
}

export type ApprovePartnerApplicationResult = {
  applicationId: string;
  partnerId: string;
  invitePath: string | null;
  inviteExpiresAt: string | null;
  idempotent: boolean;
};

/**
 * Ops-only approval. Atomic claim on application row; reuses createPartner onboarding invite.
 * Does not mint stripe entitlements. Manual invite delivery via Operations notice.
 */
export async function approvePartnerApplication(
  actor: PartnerActor,
  input: {
    applicationId: string;
    slug: string;
    displayName?: string;
    origin: PartnerAdminCreateOrigin;
    reason: string;
    approvalAttemptId?: string;
  },
): Promise<ApprovePartnerApplicationResult> {
  if (actor.kind !== "platform") {
    throw new PartnerApplicationError("Only platform operators can approve applications.", "forbidden", 403);
  }
  const store = await getPartnerApplicationStore();
  const application = await store.findById(input.applicationId);
  if (!application) {
    throw new PartnerApplicationError("Application not found.", "not_found", 404);
  }

  if (application.status === "approved" && application.partnerId) {
    return {
      applicationId: application.applicationId,
      partnerId: application.partnerId,
      invitePath: null,
      inviteExpiresAt: null,
      idempotent: true,
    };
  }

  const attemptId = input.approvalAttemptId ?? createAttemptId();
  const claimed = await store.claimForApproval({
    applicationId: application.applicationId,
    reviewedBy: actor.email,
    approvalAttemptId: attemptId,
  });
  if (!claimed) {
    throw new PartnerApplicationError(
      "Application is not available for approval.",
      "conflict",
      409,
    );
  }

  const displayName = (input.displayName ?? application.displayName).trim();
  let partnerId: string | null = null;
  let invitePath: string | null = null;
  let inviteExpiresAt: string | null = null;

  try {
    partnerId = await findPartnerIdByOwnerEmail(application.normalizedEmail);
    if (partnerId) {
      if (await hasOpenPartnerInviteForEmail(application.normalizedEmail)) {
        invitePath = null;
      } else {
        const invite = await createOnboardingInvite(actor, {
          partnerId,
          email: application.normalizedEmail,
          role: "partner_admin",
          reason: input.reason,
        });
        invitePath = invite.path;
        inviteExpiresAt = invite.expiresAt;
      }
    } else {
      const created = await createPartner(actor, {
        slug: input.slug,
        displayName,
        ownerEmail: application.normalizedEmail,
        origin: input.origin,
        reason: input.reason,
      });
      partnerId = created.summary.partner.partnerId;
      invitePath = created.onboarding.path;
      inviteExpiresAt = created.onboarding.expiresAt;
    }

    await store.completeApproval({
      applicationId: application.applicationId,
      partnerId,
      approvalAttemptId: attemptId,
      reviewedBy: actor.email,
    });

    return {
      applicationId: application.applicationId,
      partnerId,
      invitePath,
      inviteExpiresAt,
      idempotent: false,
    };
  } catch (error) {
    await store.releaseApprovalClaim({
      applicationId: application.applicationId,
      approvalAttemptId: attemptId,
      reviewedBy: actor.email,
      releaseTo: "in_review",
    });
    if (error instanceof PartnerApplicationError || error instanceof PartnerError) throw error;
    throw new PartnerApplicationError("Approval failed.", "server_error", 500);
  }
}
