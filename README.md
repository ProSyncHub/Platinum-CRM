This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Automatic CRM AI briefs

Member journey pages automatically create a cached executive brief and month-by-month status when the verified CRM history changes. Normal page loads reuse the stored analysis, so unchanged history does not create another API charge.

Recommended production configuration:

```env
CRM_AI_PROVIDER=anthropic
CRM_AI_MODEL=claude-sonnet-5
ANTHROPIC_API_KEY=replace-with-a-server-side-key

# Optional cost/context limits
CRM_AI_MAX_MONTHS=24
CRM_AI_MAX_EVENTS=240
```

OpenAI can be selected without changing application code:

```env
CRM_AI_PROVIDER=openai
CRM_AI_MODEL=gpt-5.6-terra
OPENAI_API_KEY=replace-with-a-server-side-key
```

Only configure keys in the server environment. Never expose them through a `NEXT_PUBLIC_` variable or commit them to Git.

## Pabbly registration webhook

Pabbly can create or update CRM members after a verified payment. The endpoint is:

```text
POST https://crm.prosyncedu.com/api/webhooks/pabbly/member-registration
```

Configure a strong server-only secret on the VPS:

```env
PABBLY_WEBHOOK_SECRET=replace-with-a-long-random-secret
```

In Pabbly, send the same value as the `x-pabbly-secret` request header (or as a Bearer token) and map the payment fields to this JSON body:

```json
{
  "event_id": "{{payment_id}}",
  "name": "{{customer_name}}",
  "email": "{{customer_email}}",
  "phone": "{{customer_phone}}",
  "state": "{{customer_state}}",
  "amount": "{{amount}}",
  "amount_unit": "rupees",
  "currency": "INR",
  "payment_for": "{{product_name}}",
  "paid_at": "{{payment_date}}"
}
```

Use a unique, permanent payment or order ID for `event_id`; repeated deliveries with the same ID are safely ignored. If the payment provider supplies its amount in paise, send `"amount_unit": "paise"`.

- INR 195 creates a Webinar registration.
- INR 17,500 creates a PNP member.
- Every other positive INR amount is captured under Others. New contacts are placed in the admin approval queue so the correct program or service can be assigned without losing the payment.

## Lead intake: WATI, integrations, and spreadsheets

The CRM has a dedicated **Leads** workspace. Staff can search/filter the shared queue, update a lead's CRM status, and import CSV/XLSX files. Administrators can create or disable additional lead sources from **Leads → Configure sources**.

### WATI Saturday campaign

Set a separate, strong server-only secret on the VPS:

```env
WATI_WEBHOOK_SECRET=replace-with-a-long-random-secret
```

Configure WATI's incoming/message-received webhook as:

```text
POST https://crm.prosyncedu.com/api/webhooks/leads/wati
x-wati-secret: the-same-value-as-WATI_WEBHOOK_SECRET
```

The webhook only creates a WATI lead when the incoming reply represents one of these choices (minor wording variations are normalized):

- Already paid
- Will pay shortly
- I have a question

Other messages and outgoing messages are acknowledged but ignored. WATI message IDs make repeat deliveries idempotent, so retries do not create duplicate rows.

### Other software and automation tools

An administrator creates a source under **Leads → Configure sources**. The CRM displays the generated webhook secret only once. Configure the external tool with:

```text
POST https://crm.prosyncedu.com/api/webhooks/leads/SOURCE-SLUG
x-prosync-secret: GENERATED_SECRET
Content-Type: application/json
```

The payload is deliberately flexible. Common nested or top-level keys such as `name`, `fullName`, `phone`, `mobile`, `email`, `campaign`, `response`, `notes`, `createdAt`, and `leadId` are detected automatically. A stable external ID is recommended for safe retry deduplication.

### Manual CSV/XLSX import

Choose **Import Excel / CSV** in Leads. The importer searches the first rows for the likely header, automatically maps common column names, and shows the mapping for confirmation before writing anything. Columns can be renamed, reordered, or ignored; a downloadable template is available but is not mandatory.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
