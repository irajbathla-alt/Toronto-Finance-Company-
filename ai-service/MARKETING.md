# Toronto Finance Company AI Marketing Department

## Priority
Marketing is a first-class TFC AI workflow.

## Team
- Marketing Director — orchestrates the department.
- Market Research Agent — proposes timely, useful angles and identifies claims needing verification.
- Content Agent — writes platform-ready copy.
- Social Agent — adapts content for Instagram and LinkedIn.
- Design Director — produces Canva-ready visual briefs.
- Marketing QA — checks brand, privacy and unsupported claims.

## Workflow
`Objective -> Research -> Content -> Social -> Design Brief -> QA -> APPROVAL_REQUIRED`

Nothing is automatically published in Phase 1.

## API
`POST /v1/marketing/plan`

Example body:
```json
{
  "objective": "Create today's Toronto Finance Company marketing package",
  "channels": ["Instagram", "LinkedIn"],
  "productFocus": "Business Line of Credit",
  "audience": "Canadian small-business owners",
  "approvedFacts": [],
  "recentContent": [],
  "constraints": []
}
```

The caller must send the same `x-tfc-ai-secret` used by the deal-review endpoint.

## Brand guardrails
- Premium and understated.
- Near-black/charcoal with warm bronze/brown, ivory and muted gold/tan direction.
- Confident, knowledgeable, client-first language.
- No guaranteed approvals, rates, funding, savings or outcomes.
- No invented statistics, testimonials or lender criteria.
- No identifiable client information without explicit approved facts.
- Anonymized success stories must use approved facts only.

## Canva
The Design Director creates structured Canva-ready briefs. Canva execution is intentionally kept as an external tool action rather than embedding Canva credentials in this public repository. No Canva Brand Kit is currently available through the connected Canva account, so a TFC Brand Kit should be created/connected before automated on-brand design generation is enabled.

## Next integration
Add a Marketing section to the private/admin workflow with:
- objective/product/channel inputs
- generated content package
- QA status
- approval/reject controls
- content history to reduce repetition
- Canva design action after approval
