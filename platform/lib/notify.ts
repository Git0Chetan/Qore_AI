// Notification interface. Email goes through Resend when RESEND_API_KEY is set,
// otherwise it logs to the console. WhatsApp/push are stubbed for Phase 2 but
// callers already go through this single entry point.

export type NotifyChannel = 'email' | 'whatsapp' | 'push';

export type NotifyInput = {
  to: string; // email address or phone, depending on channel
  subject: string;
  body: string;
  channels?: NotifyChannel[];
};

async function sendEmail(to: string, subject: string, body: string): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.NOTIFY_FROM_EMAIL || 'recruiting@example.com';

  if (!key) {
    console.log(`[notify:email:console] to=${to} subject="${subject}"\n${body}`);
    return;
  }

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({ from, to, subject, html: `<p>${body.replace(/\n/g, '<br/>')}</p>` }),
    });
  } catch (err) {
    console.error('[notify:email] failed', err);
  }
}

export async function notify({ to, subject, body, channels = ['email'] }: NotifyInput): Promise<void> {
  for (const channel of channels) {
    if (channel === 'email') {
      await sendEmail(to, subject, body);
    } else {
      // Phase 2: WhatsApp (e.g. Twilio) and Web Push.
      console.log(`[notify:${channel}:stub] to=${to} subject="${subject}"`);
    }
  }
}

// Canonical messages for lifecycle events.
export const NOTIFY_TEMPLATES = {
  application_submitted: (job: string) => ({
    subject: `Application received — ${job}`,
    body: `Thanks for applying to ${job}. Your resume is being screened by our AI. We'll update you shortly.`,
  }),
  ats_passed: (job: string) => ({
    subject: `You're through screening — ${job}`,
    body: `Good news! Your profile cleared the resume screening for ${job}. Your assessment is now available.`,
  }),
  ats_failed: (job: string) => ({
    subject: `Update on your application — ${job}`,
    body: `Thank you for applying to ${job}. After screening, your profile did not meet the criteria for this role.`,
  }),
  assessment_passed: (job: string) => ({
    subject: `Assessment passed — ${job}`,
    body: `Congratulations! You have successfully passed the assessment round for ${job}. Our team will review your profile and contact you regarding the next steps.`,
  }),
  assessment_failed: (job: string) => ({
    subject: `Assessment update — ${job}`,
    body: `Thank you for completing the assessment for ${job}. Unfortunately you did not clear this round.`,
  }),
  interview_scheduled: (job: string, when: string, mode: string, location: string) => ({
    subject: `Interview scheduled — ${job}`,
    body: `Your interview for ${job} is scheduled for ${when} (${mode}).${location ? `\nDetails: ${location}` : ''}\nGood luck!`,
  }),
  offer_released: (job: string) => ({
    subject: `Offer released — ${job}`,
    body: `Congratulations! We're excited to extend an offer for ${job}. Please log in to your portal to review the details.`,
  }),
};
