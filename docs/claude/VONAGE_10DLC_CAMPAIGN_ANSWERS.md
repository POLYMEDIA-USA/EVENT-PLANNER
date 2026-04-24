# Vonage 10DLC Campaign — answers for every step

Brand already verified: **VerifyAi** / Parametrik Holdings LLC / Brand ID BAMLKAT.

---

## Step 1 — Use case

Pick **Mixed** (or the closest equivalent). Rationale: the campaign covers multiple message types — team RSVP invitations, event confirmations with QR check-in codes, and event updates. If Mixed isn't offered, pick **Account Notification**.

---

## Step 2 — Campaign details

**Campaign name:** `VerifyAi Team Attendance and Event RSVP`

**Campaign description:**
```
Internal team attendance notifications for VerifyAi / Parametrik Holdings LLC. FunnelFlow sends event-related SMS to our staff and contractors: invitations to confirm whether they will be working a specific corporate event, check-in confirmation messages with a QR code used at the event door, and schedule or location updates. Recipients are employees and contractors whose phone numbers are entered into the FunnelFlow user directory by company admins during account setup.
```

---

## Step 3 — Message flow (Call to action)

**Message frequency:** Recurring

**Brand name:** `VerifyAi`

**Consent collection:** tick **Online (website, mobile app)** only. Skip Other, Live operator, Point of Sale, Text-to-join.

**URL:** `https://verifyai.net`

**How will you obtain consent from the subscriber?** (paste exactly):
```
Phone numbers are collected when organization administrators add users (employees and contractors) to the FunnelFlow internal staff-management platform at the time of account creation. During onboarding, users are informed that the phone number on file may be used to receive event-related SMS — invitations to work upcoming events, check-in QR confirmations, and schedule updates. Users have the opportunity to decline at onboarding and can opt out at any time by replying STOP or asking their admin to remove the number from their record. No leads, customers, or non-staff recipients are sent SMS without their own explicit opt-in.
```

**Privacy Policy Link:** `https://verifyai.net/privacy`

**Terms & Conditions Link:** `https://verifyai.net/terms`

**Checkboxes:**
- ☑ I acknowledge that my Privacy Policy and Terms & Conditions adhere to the 10DLC requirements
- ☑ Add Carrier Disclaimer

---

## Step 4 — Content attributes

### Opt-in Mechanism

**Opt-in Keyword:** leave blank

**Opt-in Message:**
```
VerifyAi: You're subscribed to event attendance notifications. Msg frequency varies (typically 1-4 per event). Msg & data rates may apply. Reply STOP to opt out, HELP for help.
```

### Opt-out Mechanism

**Opt-out Keyword:** leave default `STOP`

**Opt-out Message:**
```
VerifyAi: You've been unsubscribed from event attendance notifications and will not receive any further messages. Reply START to resubscribe.
```

### Help Mechanism

**Help Keyword:** leave default `HELP`

**Help Message:**
```
VerifyAi: For help with event attendance notifications, email dave@parametrik.net or visit https://verifyai.net. Reply STOP to opt out.
```

Skip the "Opt-Out Assist" button at the top.

---

## Step 5 — Sample messages

**Sample one:**
```
VerifyAi: Will you be working HSPA 2026 on 04-27? Please RSVP: https://verifyai.net/r/X7H3K9 Msg & data rates may apply. Reply STOP to opt out, HELP for help.
```

**Sample two:**
```
VerifyAi: Reminder - HSPA 2026 tomorrow, 04-27 at 5pm, Hilton 401 W Pratt St, Baltimore MD. See you there! Reply STOP to opt out.
```

**Checkboxes:**
- ☑ Embedded links
- ☐ Embedded phone number
- ☐ Age gated
- ☐ Direct lending

---

## Step 6 — Review & Submit

Skim everything, submit. Expect 1–3 business days for carrier approval. Once `Campaigns Count` on the brand page flips from `0` to `1+` with status "Approved" (or "Active"), SMS delivery to real numbers will start working.

---

## Billing note (the reason for the do-over)

Keep at least a few dollars in the Vonage account balance at submission time. Running out during the flow kicks you back to billing and loses the in-progress campaign. $10 balance is plenty to cover the submission fee plus normal SMS use for testing.
