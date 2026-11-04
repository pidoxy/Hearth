/**
 * Inbound email parsing. Accepts Postmark's inbound webhook JSON shape:
 * https://postmarkapp.com/developer/webhooks/inbound-webhook
 * Other providers (Mailgun, SendGrid, Cloudflare Email Workers) can post the same shape.
 */
export interface InboundEmail {
  to: string[];
  from: string;
  subject: string;
  date: Date;
  text: string;
  attachments: { name: string; mime: string; data: Buffer }[];
}

interface PostmarkPayload {
  From?: string;
  FromFull?: { Email?: string };
  To?: string;
  ToFull?: { Email?: string }[];
  OriginalRecipient?: string;
  Subject?: string;
  Date?: string;
  TextBody?: string;
  HtmlBody?: string;
  StrippedTextReply?: string;
  Attachments?: { Name?: string; ContentType?: string; Content?: string; ContentLength?: number }[];
}

export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|tr|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n\n")
    .trim();
}

export function extractAddress(s: string): string {
  const m = s.match(/<([^>]+)>/);
  return (m ? m[1] : s).trim().toLowerCase();
}

export function parsePostmark(body: PostmarkPayload): InboundEmail {
  const to = [
    ...(body.ToFull?.map((t) => t.Email ?? "") ?? []),
    ...(body.To ? body.To.split(",") : []),
    body.OriginalRecipient ?? "",
  ]
    .map(extractAddress)
    .filter(Boolean);
  const from = extractAddress(body.FromFull?.Email ?? body.From ?? "");
  const text = body.TextBody?.trim() || (body.HtmlBody ? htmlToText(body.HtmlBody) : "");
  const parsedDate = body.Date ? new Date(body.Date) : new Date();
  return {
    to: [...new Set(to)],
    from,
    subject: (body.Subject ?? "").trim() || "(no subject)",
    date: isNaN(parsedDate.getTime()) ? new Date() : parsedDate,
    text,
    attachments: (body.Attachments ?? [])
      .filter((a) => a.Content && a.ContentType)
      .map((a) => ({
        name: a.Name ?? "attachment",
        mime: a.ContentType!.split(";")[0].trim().toLowerCase(),
        data: Buffer.from(a.Content!, "base64"),
      })),
  };
}

/** The local part of the first recipient on our inbound domain. */
export function inboundCodeFrom(to: string[], domain: string | undefined): string | null {
  for (const addr of to) {
    const [local, host] = addr.split("@");
    if (!local || !host) continue;
    if (!domain || host === domain.toLowerCase()) return local.split("+")[0];
  }
  return null;
}
