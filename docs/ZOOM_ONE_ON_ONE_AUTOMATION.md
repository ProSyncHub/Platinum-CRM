# ProSync CRM — Zoom 1-on-1 Automation

## 1. Purpose

Platinum members receive up to six 1-on-1 sessions with Amar Sir. This integration turns those sessions into a controlled CRM workflow instead of relying on manual Zoom scheduling, handwritten attendance, and separately typed call notes.

After an authorised employee schedules a session from the CRM, the system will:

1. Create a unique Zoom meeting under Amar Sir's licensed Zoom account.
2. Store the appointment against the correct member and session number.
3. Preserve the member's pre-meeting questions and the team's preparation notes.
4. Track meeting start, end, joins, leaves, cancellations and recording completion.
5. Calculate the actual time Amar Sir and the member were present together.
6. Obtain the Zoom transcript and recording metadata.
7. Use Claude once to turn the verified transcript and pre-call context into a concise structured brief.
8. Automatically create the CRM communication record and update the member journey.
9. Create assigned follow-ups from agreed next actions when a responsible employee and due date are available.
10. Count the session toward the member's six-session entitlement only after completion is verified.

The automation documents Zoom 1-on-1 calls. It does not automatically dial ordinary phone calls. Phone, WhatsApp, email and in-person interactions continue to be logged using the CRM communication tools unless their respective providers are integrated separately.

## 2. Business outcome

The completed system gives ProSync one source of truth for every Platinum 1-on-1:

- who scheduled it;
- which of the six sessions it represents;
- when it was scheduled and when it actually happened;
- the member's requested discussion topics;
- who attended;
- how many minutes Amar Sir and the member were together;
- what was discussed;
- decisions, advice and commitments;
- the next action, responsible person and due date;
- whether the session is complete, cancelled, rescheduled, a no-show or awaiting review;
- the original transcript and the derived AI summary.

Staff should not need to re-enter information that Zoom has already supplied. Human input is required for scheduling, pre-call preparation, exceptions, corrections and approving sensitive or uncertain AI outputs.

## 3. Implementation status

The local CRM working tree now contains:

- dedicated 1-on-1 session, attendance-segment and Zoom webhook-event models;
- Server-to-Server OAuth token handling and Zoom meeting creation, rescheduling and cancellation;
- `/api/webhooks/zoom` with challenge-response validation, signature verification and delivery deduplication;
- past-participant reconciliation and host/member overlap-minute calculation;
- cloud-recording metadata and transcript ingestion;
- one-time structured Claude meeting analysis;
- automatic CRM Zoom communication logs and eligible assigned follow-ups;
- the six-slot scheduler on both the Member Workspace and advanced member profile;
- preservation of legacy recorded session counts while new sessions use verified records;
- removal of the old behaviour that consumed an entitlement merely because a manual communication was labelled Zoom or Meet.

This functionality is not live merely because it exists locally. It becomes operational only after the code is deployed, the Prisma schema is pushed to the production MongoDB database, the process is restarted with the Zoom environment variables, and the Zoom Event Subscription URL passes validation. A real end-to-end meeting must still be completed before the production integration is considered verified.

## 4. User experience

### 4.1 Member journey page

Eligible Platinum members receive a `1-on-1 Sessions` section showing six slots:

| Slot | Possible display |
| --- | --- |
| Session 1 | Available, scheduled, processing, completed, no-show or cancelled |
| Session 2 | Available, scheduled, processing, completed, no-show or cancelled |
| Session 3 | Available, scheduled, processing, completed, no-show or cancelled |
| Session 4 | Available, scheduled, processing, completed, no-show or cancelled |
| Session 5 | Available, scheduled, processing, completed, no-show or cancelled |
| Session 6 | Available, scheduled, processing, completed, no-show or cancelled |

Each completed slot opens a detailed record containing attendance, preparation notes, transcript status, AI summary, decisions and follow-ups.

The six-session total must be derived from verified completed session records. The integer counter must no longer be incremented merely because somebody manually selected `Zoom` while logging a communication.

### 4.2 Scheduling form

An authorised coordinator selects `Schedule 1-on-1` and completes:

- session number;
- date and start time;
- planned duration;
- Zoom host, normally Amar Sir;
- assigned coordinator;
- member email and phone confirmation;
- topics the member wants to discuss;
- questions submitted by the member;
- internal preparation notes;
- business status, blockers or documents Amar Sir should review;
- reminder method and reminder timing.

The CRM validates that:

- the member belongs to an eligible program;
- the session number is between 1 and 6;
- a completed session does not already occupy that slot;
- the host is a licensed Zoom user;
- the date is in the future;
- the member has a usable email or a documented manual-invite exception;
- another active booking does not already use the same Zoom meeting or CRM session record.

After confirmation, the server creates the Zoom meeting and stores the returned Zoom meeting ID, meeting UUID, join URL, host identity and scheduling metadata. The Zoom host `start_url` is sensitive, short-lived data and must never be exposed to ordinary employees or stored as a permanent public link.

### 4.3 Rescheduling and cancellation

An authorised coordinator can reschedule or cancel from the CRM. The CRM updates Zoom first and then records an audit event locally.

- Rescheduling does not consume a session.
- Cancellation does not consume a session.
- A no-show does not consume a session unless an administrator explicitly overrides the policy and records a reason.
- A replacement appointment remains tied to the intended session slot while preserving the original appointment history.

### 4.4 Before the meeting

The member journey shows a preparation card with:

- meeting date and time;
- current session number, such as `Session 2 of 6`;
- member questions;
- previous 1-on-1 commitments;
- unresolved member follow-ups;
- latest departmental notes relevant to the conversation;
- the assigned coordinator;
- a copyable member join link.

Sending invitations and reminders through WATI or email requires the corresponding provider integration. The Zoom integration creates and tracks the meeting; it should expose a notification job that WATI/email can consume rather than silently assuming Zoom will message every external member.

## 5. Automatic meeting lifecycle

### 5.1 Webhook events

Zoom sends near-real-time events to:

```text
POST https://crm.prosyncedu.com/api/webhooks/zoom
```

The CRM subscribes to:

- meeting started;
- meeting ended;
- participant joined;
- participant left;
- recording completed.

Every webhook is signature-verified, deduplicated and stored or processed idempotently. A repeated delivery must not create a second communication log, second AI summary or second completed session.

### 5.2 Attendance calculation

Zoom may return multiple attendance rows when somebody disconnects and rejoins. The CRM must merge all participant segments and calculate:

- first join time;
- final leave time;
- total connected time;
- number of reconnects;
- Amar Sir's total connected time;
- member's total connected time;
- actual overlap when both Amar Sir and the member were present;
- scheduled versus actual duration;
- late join and early leave;
- host no-show;
- member no-show.

The headline CRM duration is the overlapping time between Amar Sir and the matched member, not simply the meeting's wall-clock duration.

Participant email is not always available when an external user joins Zoom without signing in. Matching should use, in priority order:

1. Zoom registrant identity or unique member invite;
2. verified email;
3. CRM member code included in the meeting/registration context;
4. normalized phone or exact member name where available;
5. manual administrator review when identity is uncertain.

The system must never attach a transcript or attendance record to a member based only on a weak fuzzy-name match.

### 5.3 Recording and transcript processing

When `recording completed` arrives, the CRM retrieves recording metadata and the VTT/audio transcript. Processing may take time after a meeting ends, so unavailable files are retried with backoff rather than treated as permanently missing.

Recommended initial retry schedule:

```text
5 minutes → 15 minutes → 30 minutes → 1 hour → 3 hours → manual-review queue
```

The CRM stores the original factual data separately from derived AI content. An AI summary must never replace or rewrite the transcript, attendance data, employee notes or member-submitted questions.

## 6. Automatic CRM documentation

When attendance and transcript processing succeed, the CRM automatically creates a communication entry similar to:

```text
Medium: Zoom 1-on-1
Direction: Outbound / scheduled
Outcome: 1-on-1 completed
Contacted by: Amar Sir
Coordinated by: Assigned coordinator
Date: Actual meeting start
Duration: Verified overlap minutes
Department: Management
Source: Zoom automation
Zoom meeting reference: Internal ID/UUID
Notes: Approved structured summary
```

This automatic entry appears in:

- the member communication timeline;
- the complete member journey;
- call/communication reports;
- the assigned coordinator's operational view;
- management reporting;
- the AI member brief's source history.

The automation also updates:

- `lastConnectDate` with the actual meeting date when it is the latest verified communication;
- `lastContactMedium` to `zoom`;
- `lastContactStaff` to Amar Sir or the verified host;
- the completed 1-on-1 count derived from session records;
- the next planned 1-on-1 date, when supplied;
- related follow-up tasks created from explicit commitments.

The generated call log is linked to its 1-on-1 session. Editing or deleting one side must not leave the other side inconsistent. Automated records should display an `Automated from Zoom` badge and retain their audit history.

## 7. Claude analysis

### 7.1 Inputs

Claude receives only the context needed for this meeting:

- member identity and program context;
- session number;
- pre-meeting questions;
- internal preparation notes that are permitted for AI processing;
- previous session commitments when relevant;
- verified Zoom transcript;
- Zoom chat text when available and permitted;
- human notes added after the call.

### 7.2 Structured output

Claude returns a schema-validated result containing:

- executive summary;
- topics discussed;
- important advice or decisions;
- member commitments;
- ProSync/Amar Sir commitments;
- blockers and risks;
- action items;
- responsible person for each action;
- due date, only when stated or deliberately assigned;
- recommended focus for the next session;
- unresolved questions;
- confidence/review flags.

Claude must not invent a commitment, owner, amount, date or business result. If the transcript does not provide the information, the field remains empty or is marked `Not stated`.

### 7.3 Cost control

Claude is called once after a new verified transcript is available. Page views reuse the stored result. It is called again only when:

- the transcript changes;
- authorised notes used in the summary change;
- an administrator explicitly requests regeneration;
- a previous attempt failed.

A source hash prevents duplicate analysis and makes the generated summary reproducible and auditable.

### 7.4 Human review

Low-confidence, missing-transcript, unmatched-participant and potentially sensitive results enter `Review required`. An authorised employee can correct the final CRM summary without modifying the source transcript.

## 8. Follow-up automation

An action item becomes a CRM follow-up only when it has enough operational detail:

- a clear task;
- a responsible CRM employee or department;
- a due date, either stated in the meeting or assigned during review.

Examples:

- `Samyak to review the Amazon listing by 20 August` creates a task assigned to Samyak.
- `E-commerce team to verify account suspension documents` creates a department follow-up requiring assignment.
- `Member will send documents soon` remains a documented commitment until a due date or responsible internal owner is added.

Automatically created tasks appear in the normal overview and follow-up queues and link back to the originating 1-on-1 session.

## 9. Recommended data model

### 9.1 `OneOnOneSession`

The dedicated record should include at least:

- CRM ID and member relationship;
- session number and entitlement limit;
- lifecycle status;
- scheduled start, timezone and planned duration;
- actual start and end;
- verified overlap duration;
- host, coordinator and member identities;
- member questions and preparation notes;
- Zoom meeting ID and UUID;
- member join URL;
- recording/transcript processing status;
- transcript location or protected content;
- AI summary and structured analysis;
- linked call-log ID;
- reschedule/cancellation/no-show reason;
- created, updated and completed audit identities/timestamps.

### 9.2 `OneOnOneAttendanceSegment`

Stores normalized Zoom join/leave segments per participant so reconnects can be merged without losing raw evidence.

### 9.3 `ZoomWebhookEvent`

Stores an event identifier/hash, event type, meeting reference, processing state and timestamps for idempotency, retry and audit.

Large video files should normally remain in Zoom during the retention period. The CRM needs the transcript, metadata and protected recording reference; it should not duplicate every MP4 into the main MongoDB database.

## 10. Session states

```text
draft
  → scheduled
  → started
  → attendance_processing
  → transcript_processing
  → review_required (only when necessary)
  → completed
```

Alternative terminal or exception states:

```text
cancelled
rescheduled
member_no_show
host_no_show
recording_unavailable
processing_failed
```

Only `completed` contributes to the six-session count.

## 11. Permissions

### Administrator / super administrator

- configure Zoom integration status;
- view all sessions and transcripts;
- schedule, reschedule and cancel;
- resolve identity/review exceptions;
- correct summaries and attendance with an audit reason;
- regenerate AI analysis;
- override a no-show policy with an audit reason.

### Manager / authorised 1-on-1 coordinator

- schedule for eligible members;
- add preparation notes;
- reschedule or cancel within policy;
- view meeting results for members they are authorised to view;
- review and assign follow-ups.

### Employee

- see the member's permitted journey and completed 1-on-1 summary;
- log a separate communication;
- update only the departments and tasks allowed by CRM permissions;
- not access Zoom credentials, host start links or integration configuration.

### Member

- receive a join link and reminders;
- submit pre-meeting questions through an approved channel;
- no CRM administrative access.

## 12. Security and privacy

- Store Zoom and Claude credentials only in the server `.env`.
- Never expose credentials through `NEXT_PUBLIC_` variables.
- Never send Zoom credentials to Pabbly or the browser.
- Validate Zoom webhook signatures and URL-validation challenges.
- Reject stale or invalid webhook timestamps.
- Process every webhook idempotently.
- Authorize every scheduling, transcript and review operation on the server.
- Treat transcripts as sensitive member records.
- Show recording/AI-processing consent in invitations and at meeting entry where required.
- Restrict transcript and recording visibility by CRM role.
- Log administrative corrections with before/after values and the actor.
- Do not persist the Zoom host `start_url` as a reusable public credential.
- Use configurable retention for recordings and transcripts.
- Back up factual CRM records independently of replaceable AI analysis.

## 13. Environment configuration

Required after Zoom app activation:

```env
ZOOM_ACCOUNT_ID=server_to_server_account_id
ZOOM_CLIENT_ID=server_to_server_client_id
ZOOM_CLIENT_SECRET=server_to_server_client_secret
ZOOM_HOST_USER_ID=licensed_host_zoom_email_or_user_id
ZOOM_DEFAULT_TIMEZONE=Asia/Calcutta
ZOOM_AUTO_RECORDING=cloud
```

Required after the webhook receiver has been deployed and Event Subscriptions are enabled:

```env
ZOOM_WEBHOOK_SECRET_TOKEN=zoom_event_subscription_secret_token
```

Claude configuration already follows the CRM AI convention:

```env
CRM_AI_PROVIDER=anthropic
CRM_AI_MODEL=claude-sonnet-5
ANTHROPIC_API_KEY=server_side_anthropic_key
```

No real secret belongs in this document, Git history, Pabbly, a screenshot or a support message.

## 14. Zoom app permissions

The account-level Server-to-Server OAuth app uses the minimum required administrative granular scopes:

```text
meeting:write:meeting:admin
meeting:read:meeting:admin
meeting:update:meeting:admin
meeting:delete:meeting:admin
meeting:read:past_meeting:admin
meeting:read:list_past_participants:admin
cloud_recording:read:list_recording_files:admin
cloud_recording:read:meeting_transcript:admin
```

Event Subscriptions remain disabled until the CRM webhook route is deployed and can pass Zoom endpoint validation.

## 15. Operational dashboards and reporting

### Coordinator overview

- sessions scheduled today and this week;
- preparation incomplete;
- member confirmation pending;
- reschedule/cancellation requests;
- transcript or identity review required;
- follow-ups due from previous 1-on-1s.

### Management overview

- Platinum members with sessions used and remaining;
- completed sessions by month;
- scheduled versus completed rate;
- member and host no-shows;
- average verified overlap duration;
- transcript processing success/failure;
- unresolved actions from completed sessions;
- coordinator workload;
- members with no 1-on-1 scheduled despite eligibility.

### Member journey

- six-slot entitlement status;
- latest 1-on-1 summary;
- chronological session history;
- preparation notes and member questions;
- attendance and verified duration;
- linked actions and follow-ups;
- protected transcript/recording access for authorised roles.

Reports must derive totals from `OneOnOneSession` records rather than the legacy integer field.

## 16. Error handling

| Failure | Expected behaviour |
| --- | --- |
| Zoom credentials invalid | Block scheduling, show admin configuration error, do not create a partial session |
| Zoom meeting creation fails | Preserve form as draft and allow retry |
| Duplicate webhook | Acknowledge it without creating duplicate CRM records |
| Participant cannot be matched | Mark `Review required`; do not attach to a guessed member |
| Attendance not ready | Retry after a delay |
| Transcript processing delayed | Keep session in processing and retry |
| Recording absent | Preserve attendance and request manual notes/review |
| Claude unavailable | Preserve transcript and attendance; retry AI without blocking factual documentation |
| AI output fails validation | Store no final summary and send to review |
| CRM update fails after Zoom creation | Record/reconcile the Zoom meeting instead of creating another meeting blindly |

## 17. Deployment order

1. Add the dedicated Prisma models and indexes.
2. Migrate/backfill existing verified 1-on-1 history without blindly trusting every legacy Zoom call log.
3. Build the server-only Zoom OAuth client.
4. Build scheduling, rescheduling and cancellation actions.
5. Build the member and coordinator UI.
6. Deploy the Zoom webhook endpoint with URL validation and signature verification.
7. Enable Event Subscriptions in Zoom and add the webhook secret to the VPS.
8. Build attendance reconciliation and retry processing.
9. Build transcript retrieval and Claude structured analysis.
10. Link automatic communication logs, session counts and follow-up tasks.
11. Add dashboards, review queues and operational alerts.
12. Run an end-to-end test before enabling the system for all members.

## 18. End-to-end acceptance test

A production-like test is successful only when all of the following occur:

1. A coordinator schedules `Session 1 of 6` for a test Platinum member.
2. A Zoom meeting is created under Amar Sir and the member join link is stored.
3. The appointment appears in the member journey.
4. Amar Sir and the member join, disconnect/rejoin once, and end the call.
5. Zoom events are signature-verified and processed only once.
6. The CRM shows the correct overlap minutes despite the reconnect.
7. Recording completion triggers transcript retrieval.
8. Claude produces a schema-valid summary using the transcript and pre-call questions.
9. The CRM automatically creates exactly one Zoom communication log.
10. The member shows exactly one completed session and five remaining.
11. Agreed assigned actions appear in the correct follow-up queues.
12. A repeated webhook or page refresh creates no duplicate record or AI charge.
13. An unauthorised employee cannot access credentials, host links or restricted transcript data.

## 19. Definition of done

The feature is complete when an authorised employee can schedule a Platinum 1-on-1 from the CRM and, after the real Zoom meeting ends, the member journey is automatically populated with verified attendance, overlap minutes, transcript status, a reviewable Claude summary, a linked communication log and any assigned follow-ups—without manually retyping the call—and only a verified completed session reduces the member's six-session balance.

## 20. Reference documentation

- [Zoom Server-to-Server OAuth](https://developers.zoom.us/docs/internal-apps/s2s-oauth/)
- [Zoom Meetings APIs](https://developers.zoom.us/docs/api/meetings/)
- [Zoom meeting webhook events](https://developers.zoom.us/docs/api/meetings/events/)
- [Zoom cloud recording](https://developers.zoom.us/docs/build/cloud-recording/)
