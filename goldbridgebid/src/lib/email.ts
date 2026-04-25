import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const FROM_ADDRESS =
  process.env.RESEND_FROM_EMAIL || "ProjectXBidX <notifications@projectxbidx.com>";

const BASE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://projectxbidx.com";

function wrapHtml(body: string) {
  return `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background-color:#FFFBEB;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#FFFBEB;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e0db;">
        <tr>
          <td style="background:linear-gradient(135deg,#78350F,#15803D,#1e293b);padding:24px 32px;text-align:center;">
            <h1 style="margin:0;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;">projectxbidx</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            ${body}
          </td>
        </tr>
        <tr>
          <td style="padding:24px 32px;border-top:1px solid #e5e0db;text-align:center;">
            <p style="margin:0;font-size:12px;color:#78716C;">
              &copy; ${new Date().getFullYear()} projectxbidx &middot;
              <a href="${BASE_URL}/terms" style="color:#78716C;">Terms</a> &middot;
              <a href="${BASE_URL}/privacy" style="color:#78716C;">Privacy</a>
            </p>
            <p style="margin:8px 0 0;font-size:12px;color:#78716C;">
              Serving Crescent City, CA — growing nationwide.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function ctaButton(text: string, href: string) {
  return `
    <table cellpadding="0" cellspacing="0" style="margin:24px 0;">
      <tr><td style="background-color:#D97706;border-radius:8px;padding:12px 28px;">
        <a href="${href}" style="color:#0f172a;text-decoration:none;font-weight:600;font-size:14px;display:inline-block;">${text}</a>
      </td></tr>
    </table>`;
}

async function sendEmail(to: string, subject: string, htmlBody: string) {
  if (!resend) {
    console.warn("Email not sent — RESEND_API_KEY not configured:", { to, subject });
    return;
  }

  try {
    await resend.emails.send({
      from: FROM_ADDRESS,
      to,
      subject,
      html: wrapHtml(htmlBody),
    });
  } catch (error) {
    console.error("Failed to send email:", { to, subject, error });
  }
}

// ── Specific email senders ───────────────────────────────────────────

export async function sendNewBidEmail(
  customerEmail: string,
  projectTitle: string,
  projectId: string
) {
  await sendEmail(
    customerEmail,
    `New bid received on "${projectTitle}"`,
    `
    <h2 style="margin:0 0 12px;font-size:20px;color:#1C1917;">New Bid Received 🎯</h2>
    <p style="margin:0 0 8px;color:#44403C;font-size:15px;line-height:1.6;">
      A contractor has submitted a sealed bid on your project <strong>"${projectTitle}"</strong>.
    </p>
    <p style="margin:0 0 4px;color:#44403C;font-size:15px;line-height:1.6;">
      Log in to review the bid, check the contractor's qualification badge, and compare with other bids.
    </p>
    ${ctaButton("View Bids", `${BASE_URL}/customer/projects/${projectId}`)}
    `
  );
}

export async function sendNewMessageEmail(
  recipientEmail: string,
  senderName: string,
  projectTitle: string
) {
  await sendEmail(
    recipientEmail,
    `New message from ${senderName}`,
    `
    <h2 style="margin:0 0 12px;font-size:20px;color:#1C1917;">New Message 💬</h2>
    <p style="margin:0 0 8px;color:#44403C;font-size:15px;line-height:1.6;">
      <strong>${senderName}</strong> sent you a message about <strong>"${projectTitle}"</strong>.
    </p>
    <p style="margin:0 0 4px;color:#44403C;font-size:15px;line-height:1.6;">
      Log in to read and reply.
    </p>
    ${ctaButton("Open Messages", `${BASE_URL}/login`)}
    `
  );
}

export async function sendProjectEditedEmail(
  bidderEmail: string,
  projectTitle: string,
  changedFields: string,
  projectId: string
) {
  await sendEmail(
    bidderEmail,
    `Project updated: "${projectTitle}"`,
    `
    <h2 style="margin:0 0 12px;font-size:20px;color:#1C1917;">Project Updated ✏️</h2>
    <p style="margin:0 0 8px;color:#44403C;font-size:15px;line-height:1.6;">
      A project you bid on — <strong>"${projectTitle}"</strong> — has been updated by the customer.
    </p>
    <p style="margin:0 0 4px;color:#44403C;font-size:15px;line-height:1.6;">
      <strong>Changed:</strong> ${changedFields}
    </p>
    <p style="margin:0 0 4px;color:#44403C;font-size:15px;line-height:1.6;">
      Please review the changes to make sure your bid still applies.
    </p>
    ${ctaButton("Review Changes", `${BASE_URL}/bidder/projects/${projectId}`)}
    `
  );
}

export async function sendProjectAwardedEmail(
  bidderEmail: string,
  projectTitle: string,
  isWinner: boolean
) {
  const subject = isWinner
    ? `Congratulations! Your bid was awarded on "${projectTitle}"`
    : `Project awarded: "${projectTitle}"`;

  const body = isWinner
    ? `
    <h2 style="margin:0 0 12px;font-size:20px;color:#1C1917;">Your Bid Was Selected! 🏆</h2>
    <p style="margin:0 0 8px;color:#44403C;font-size:15px;line-height:1.6;">
      Congratulations! The customer selected your bid for <strong>"${projectTitle}"</strong>.
    </p>
    <p style="margin:0 0 4px;color:#44403C;font-size:15px;line-height:1.6;">
      Log in to view the project details and start coordinating with the customer.
    </p>
    ${ctaButton("View Your Bids", `${BASE_URL}/bidder/bids`)}
    `
    : `
    <h2 style="margin:0 0 12px;font-size:20px;color:#1C1917;">Project Awarded</h2>
    <p style="margin:0 0 8px;color:#44403C;font-size:15px;line-height:1.6;">
      The project <strong>"${projectTitle}"</strong> has been awarded to another contractor.
    </p>
    <p style="margin:0 0 4px;color:#44403C;font-size:15px;line-height:1.6;">
      Thank you for bidding. Keep an eye out for new projects that match your trade!
    </p>
    ${ctaButton("Browse Projects", `${BASE_URL}/bidder/projects`)}
    `;

  await sendEmail(bidderEmail, subject, body);
}

export async function sendProjectClosedEmail(
  bidderEmail: string,
  projectTitle: string
) {
  await sendEmail(
    bidderEmail,
    `Project closed: "${projectTitle}"`,
    `
    <h2 style="margin:0 0 12px;font-size:20px;color:#1C1917;">Project Closed</h2>
    <p style="margin:0 0 8px;color:#44403C;font-size:15px;line-height:1.6;">
      The project <strong>"${projectTitle}"</strong> you bid on has been closed and is no longer accepting bids.
    </p>
    ${ctaButton("View Your Bids", `${BASE_URL}/bidder/bids`)}
    `
  );
}

export async function sendProjectDeletedEmail(
  bidderEmail: string,
  projectTitle: string
) {
  await sendEmail(
    bidderEmail,
    `Project deleted: "${projectTitle}"`,
    `
    <h2 style="margin:0 0 12px;font-size:20px;color:#1C1917;">Project Deleted</h2>
    <p style="margin:0 0 8px;color:#44403C;font-size:15px;line-height:1.6;">
      The project <strong>"${projectTitle}"</strong> you bid on has been deleted by the customer.
    </p>
    ${ctaButton("Browse New Projects", `${BASE_URL}/bidder/projects`)}
    `
  );
}

// Sent to the reviewee whenever a new community or verified review lands
// on their profile. Keeps the loop tight so people see (and respond to) the
// social proof being built up about them.
export async function sendNewReviewEmail(
  recipientEmail: string,
  reviewerName: string,
  ratingOverall: number,
  reviewType: "verified_platform" | "public_reference",
  recipientUserId: string
) {
  const reviewLabel =
    reviewType === "verified_platform"
      ? "verified project review"
      : "community review";

  await sendEmail(
    recipientEmail,
    `New ${ratingOverall}-star ${reviewLabel} on your profile`,
    `
    <h2 style="margin:0 0 12px;font-size:20px;color:#1C1917;">You just received a review ⭐</h2>
    <p style="margin:0 0 8px;color:#44403C;font-size:15px;line-height:1.6;">
      <strong>${reviewerName}</strong> left a ${ratingOverall}-star ${reviewLabel} on your projectxbidx profile.
    </p>
    <p style="margin:0 0 4px;color:#44403C;font-size:15px;line-height:1.6;">
      Reviews build trust with future customers and bidders. Open your profile to read it — and post a quick response if you'd like.
    </p>
    ${ctaButton("View Your Profile", `${BASE_URL}/profile/${recipientUserId}`)}
    `
  );
}

export async function sendPaidEstimateDisputeEmail(
  bidderEmail: string,
  projectTitle: string
) {
  await sendEmail(
    bidderEmail,
    `Paid estimate dispute opened on "${projectTitle}"`,
    `
    <h2 style="margin:0 0 12px;font-size:20px;color:#1C1917;">Paid Estimate Dispute ⚠️</h2>
    <p style="margin:0 0 8px;color:#44403C;font-size:15px;line-height:1.6;">
      The customer opened a dispute on your paid estimate for <strong>"${projectTitle}"</strong>.
    </p>
    <p style="margin:0 0 4px;color:#44403C;font-size:15px;line-height:1.6;">
      Our team will review the dispute. No action is needed from you at this time.
    </p>
    ${ctaButton("View Your Bids", `${BASE_URL}/bidder/bids`)}
    `
  );
}
