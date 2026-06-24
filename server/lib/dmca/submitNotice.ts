import { env, hasResend } from "../env.js"
import type { DmcaNoticePackage, DmcaSubmitResult } from "./types.js"

async function submitViaEmail(notice: DmcaNoticePackage): Promise<DmcaSubmitResult> {
  const recipient = notice.channel.recipientEmail
  if (!recipient) {
    return {
      success: false,
      method: "email",
      message: "No recipient email configured for this channel.",
    }
  }

  if (!hasResend()) {
    console.log(`[DMCA dry-run] Would email ${recipient}:\nSubject: ${notice.subject}\n`)
    return {
      success: true,
      method: "email",
      externalCaseId: `DRY-${Date.now().toString(36).toUpperCase()}`,
      message: `Dry-run: notice prepared for ${recipient}. Set RESEND_API_KEY to send live email.`,
      responsePayload: {
        dryRun: true,
        recipient,
        subject: notice.subject,
      },
    }
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env.dmcaFromEmail,
      to: [recipient],
      reply_to: env.dmcaReplyToEmail || undefined,
      subject: notice.subject,
      text: notice.body,
    }),
    signal: AbortSignal.timeout(30_000),
  })

  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>

  if (!response.ok) {
    return {
      success: false,
      method: "email",
      message: `Email submission failed (${response.status})`,
      responsePayload: payload,
    }
  }

  return {
    success: true,
    method: "email",
    externalCaseId: typeof payload.id === "string" ? payload.id : `EML-${Date.now().toString(36).toUpperCase()}`,
    message: `DMCA notice emailed to ${recipient}.`,
    responsePayload: payload,
  }
}

function submitViaPortal(notice: DmcaNoticePackage): DmcaSubmitResult {
  return {
    success: true,
    method: "portal",
    externalCaseId: `PRT-${Date.now().toString(36).toUpperCase()}`,
    message: notice.channel.portalUrl
      ? `Notice packaged for ${notice.channel.label}. Open the portal and paste the notice body.`
      : `Notice packaged for ${notice.channel.label}.`,
    responsePayload: {
      portalUrl: notice.channel.portalUrl,
      instructions:
        "Copy the notice body from the DMCA package and submit through the platform's infringement portal.",
    },
  }
}

function submitManual(notice: DmcaNoticePackage): DmcaSubmitResult {
  return {
    success: true,
    method: "manual",
    externalCaseId: `MAN-${Date.now().toString(36).toUpperCase()}`,
    message: `Notice prepared for manual filing (${notice.channel.label}).`,
    responsePayload: {
      instructions: notice.channel.notes ?? "File manually using the exported notice.",
    },
  }
}

export async function submitDmcaNotice(notice: DmcaNoticePackage): Promise<DmcaSubmitResult> {
  if (notice.channel.method === "email") return submitViaEmail(notice)
  if (notice.channel.method === "portal") return submitViaPortal(notice)
  return submitManual(notice)
}
