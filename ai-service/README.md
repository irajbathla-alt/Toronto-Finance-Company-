# Toronto Finance Company AI Service

This folder contains the first server-side AI layer for Toronto Finance Company.

## Phase 1 agents

- **TFC AI Manager** — coordinates specialist agents and returns a next action.
- **TFC Intake Agent** — normalizes applications and flags missing or conflicting information.
- **TFC Underwriting Agent** — reviews supplied financial/banking facts and produces a conservative risk assessment.
- **TFC Lender Match Agent** — ranks only lenders whose criteria are explicitly supplied to the system.

## Safety boundary

The AI service is advisory. It must not:

- represent a recommendation as a lender approval;
- invent lender rules, client facts, rates, fees or financing terms;
- submit an application externally without human approval;
- charge a client, execute an agreement or make a final credit decision.

## Why this is separate from GitHub Pages

The public Toronto Finance Company frontend is static. OpenAI API keys and other service credentials must never be placed in browser JavaScript or committed to this public repository. The AI service must run in a server environment with secrets provided through environment variables.

## Local setup

```bash
cd ai-service
npm install
cp .env.example .env
```

Set `OPENAI_API_KEY`, `OPENAI_MODEL` and a long random `TFC_AI_SHARED_SECRET`, then run:

```bash
npm start
```

Health check:

```text
GET /health
```

Deal review:

```text
POST /v1/deals/review
x-tfc-ai-secret: <shared secret>
Content-Type: application/json
```

Minimum payload:

```json
{
  "applicationId": "TFC-000001",
  "client": {},
  "business": {},
  "request": {},
  "banking": {},
  "credit": {},
  "documents": [],
  "lenderCriteria": []
}
```

## Next integration step

The existing Google Apps Script CRM should construct a deal payload from the Applications sheet and call this service server-to-server. AI results should then be stored back into dedicated CRM fields with timestamps and human-review status. Do not call this service directly from the public browser with the shared secret.
