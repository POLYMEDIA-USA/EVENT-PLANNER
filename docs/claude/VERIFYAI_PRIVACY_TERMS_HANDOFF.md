# Handoff: Move Privacy + Terms pages to verifyai.net

**For:** Claude session working in the VerifyAi website project (Next.js, Cloud Run, project `verifyai-website`).

## Context

FunnelFlow (CorpMarketer / project `corpmarketer-app`) is submitting a Vonage 10DLC campaign registration for SMS (team RSVPs and event check-in confirmations). The 10DLC form at step 3 requires public **Privacy Policy** and **Terms & Conditions** URLs, and carriers prefer these to live on the registered brand website — which is **verifyai.net**, not the FunnelFlow app domain.

Two full HTML pages already exist and are live at the FunnelFlow app URL as a stopgap:
- https://corpmarketer-678407058536.us-central1.run.app/privacy.html
- https://corpmarketer-678407058536.us-central1.run.app/terms.html

They also exist as source in the FunnelFlow repo at `C:\Users\davee\EVENT PLANNER\public\privacy.html` and `public/terms.html`.

## What to do

Port both pages into the VerifyAi website project so the canonical URLs become:
- https://verifyai.net/privacy
- https://verifyai.net/terms

## Steps

1. Copy source from `C:\Users\davee\EVENT PLANNER\public\privacy.html` and `public/terms.html`.
2. Add them to the VerifyAi website project. If it's Next.js App Router, the best placement is `src/app/privacy/page.js` and `src/app/terms/page.js` converted to JSX — or, simpler, drop them as `public/privacy.html` and `public/terms.html` so they serve at `/privacy.html` and `/terms.html`. Verify if Vonage accepts `.html` URLs; if not, use routed pages.
3. Restyle the header gradient and any branding to match the VerifyAi site's look if it differs from FunnelFlow's indigo theme — content stays the same. Keep all 10DLC-required language verbatim: opt-in language, STOP/HELP keywords, "Message and data rates may apply," "Message frequency varies," the "phone numbers never shared with third parties for marketing purposes" sentence, carrier list, retention period, contact email.
4. Verify the cross-links between the two pages work (Privacy links to Terms, Terms links to Privacy).
5. Deploy verifyai.net per that project's DEPLOY.md.
6. Hit both URLs from an incognito window — confirm 200 OK, no auth gate.
7. Once live, tell Dave the final URLs so he can paste them into the Vonage campaign form (Step 3: Message flow → Privacy Policy Link / Terms & Conditions Link).

## Legal entity details (must appear on both pages, already in the source)

- Parametrik Holdings LLC dba VerifyAi
- 1836 NE 26th Ave, Fort Lauderdale, FL 33305
- EIN 82-3942862
- Contact: dave@parametrik.net
- Effective / Last updated: 23 April 2026

## Do NOT change

- The 10DLC disclosures in Privacy §4 and Terms §3.
- STOP/HELP instructions.
- The "phone numbers never shared with third parties for marketing purposes" line.
- The retention period (24 months) unless Dave confirms a different number.

## After you're done

Report the two final public URLs back to Dave. He'll paste them into the Vonage form. If verifyai.net hasn't deployed yet or DNS isn't live, the FunnelFlow stopgap URLs above are fallback.
