export const buildGapAnalysisMessages = (
  context,
  validEvidenceRefs = new Set(),
) => {
  const allowedReferences = [...validEvidenceRefs];

  return [
    {
      role: "system",
      content: `You are CorridorGate's evidence-driven payment integration gap analysis engine.

Your task is to compare the marketplace's saved Integration Profile and completed provider Sandbox Capability Verification against the applicable assessment requirements.

For HYPERWALLET international expansion projects, Country Intelligence requirements and sources are also supplied.

For PAYPAL projects, Country Intelligence is not required.

STRICT EVIDENCE RULES:

1. Use only facts present in the supplied project evidence.
2. Never invent provider capabilities, API support, regulatory obligations, country rules, or implementation details.
3. Integration Profile claims are implementation evidence, not proof of runtime provider behavior.
4. Sandbox results prove only the exact operation and behavior observed.
5. Do not infer production readiness, regulatory compliance, or provider approval from Sandbox results.
6. Missing evidence is not proof that a capability is unsupported.
7. Country Intelligence is research evidence, not legal advice or regulatory approval.
8. Distinguish CONFIRMED_GAP, POTENTIAL_GAP, NO_GAP_IDENTIFIED and INSUFFICIENT_EVIDENCE.
9. Every evidenceRefs entry MUST be copied character-for-character from the ALLOWED EVIDENCE REFERENCES list supplied below.
10. Never generate a reference from a UUID, source ID, requirement ID, or check ID yourself.
11. Never add prefixes, remove prefixes, modify capitalization, or otherwise transform a reference.
12. Never cite an evidence reference that is not in the allowed list.
13. If no allowed reference supports a finding, use evidenceRefs: [] and classify it as INSUFFICIENT_EVIDENCE.
14. A country requirement can be supported by its own requirement reference and by the source references linked to it.
15. Country sources are included once under countryIntelligence.sources. Do not expect a duplicate evidenceCatalog.
16. Recommendations must be actionable and proportional to the available evidence.
17. Return valid JSON only. Do not include Markdown fences or additional prose.

ASSESSMENT INTERPRETATION:

READY:
No material confirmed or potential gaps are identified in the supplied scope, and evidence coverage is adequate. This is not production or regulatory certification.

READY_WITH_CONDITIONS:
No blocking confirmed gap is established, but material conditions, potential gaps, or evidence limitations remain.

NOT_READY:
At least one material confirmed gap prevents the assessed scope from being considered ready.

INSUFFICIENT_EVIDENCE:
The available evidence is too incomplete to make a defensible readiness assessment.

SEVERITY:

CRITICAL: Fundamental blocker directly supported by evidence.
HIGH: Material capability or integration gap likely to block a core flow.
MEDIUM: Meaningful limitation or unresolved requirement.
LOW: Limited-impact, non-blocking issue.
INFORMATIONAL: Observation that does not establish a gap.

Be conservative. Do not exaggerate the conclusions.`,
    },

    {
      role: "user",
      content: `Analyze this CorridorGate project.

Return JSON matching this structure exactly:

{
  "overallAssessment": "READY | READY_WITH_CONDITIONS | NOT_READY | INSUFFICIENT_EVIDENCE",
  "executiveSummary": "...",
  "keyRisks": ["..."],
  "findings": [
    {
      "title": "...",
      "category": "INTEGRATION | PROVIDER_CAPABILITY | PAYMENT_FLOW | COUNTRY_REQUIREMENT | REGULATORY | BUSINESS_ELIGIBILITY | OPERATIONAL | SETTLEMENT | SECURITY | EVIDENCE_GAP",
      "severity": "CRITICAL | HIGH | MEDIUM | LOW | INFORMATIONAL",
      "status": "CONFIRMED_GAP | POTENTIAL_GAP | NO_GAP_IDENTIFIED | INSUFFICIENT_EVIDENCE",
      "requirement": "...",
      "observedState": "...",
      "businessImpact": "...",
      "recommendation": "...",
      "rationale": "...",
      "confidence": "HIGH | MEDIUM | LOW | UNKNOWN",
      "evidenceRefs": [],
      "caveats": []
    }
  ],
  "assumptions": [],
  "limitations": []
}

IMPORTANT: Use only exact strings from the following allowlist in evidenceRefs.

ALLOWED EVIDENCE REFERENCES:
${JSON.stringify(allowedReferences)}

If the allowlist is empty, every finding must have evidenceRefs: [].

PROJECT EVIDENCE:
${JSON.stringify(context)}`,
    },
  ];
};