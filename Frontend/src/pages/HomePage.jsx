import { useSelector } from "react-redux";
const problems = [
  {
    number: "01 / Code Level",
    title: "Integration Uncertainty",
    description:
      "Does your existing payment implementation actually construct required recipient schemas, tax withholdings, currency settlement parameters, and idempotency headers for the new geography?",
    observation:
      "Observed gap: Missing 3-digit ACSS institution codes in payout payloads.",
  },
  {
    number: "02 / Provider Runtime",
    title: "Provider Capability Uncertainty",
    description:
      "Provider marketing pages claim global coverage, but can their active sandbox instance successfully process your required token exchanges, payouts, and chargeback hooks under target currency constraints?",
    observation:
      "Observed gap: Undocumented webhook retry latency during bank downtime.",
  },
  {
    number: "03 / Regulatory Clearing",
    title: "Market Requirement Uncertainty",
    description:
      "What specific national clearing windows, central bank reporting rules, and statutory anti-money laundering thresholds apply to your marketplace before payout disbursements trigger bank holds?",
    observation:
      "Observed gap: FINTRAC Large Value Transfer seller reporting at ≥ $10k CAD.",
  },
];

const workflow = [
  {
    number: "01",
    title: "Integration Intelligence",
    description:
      "Analyzes existing source code and AST trees to extract implemented API calls, payload structures, auth tokens, and webhook handlers into an Integration Profile.",
    artifact: "Artifact: Integration Profile",
  },
  {
    number: "02",
    title: "Country Intelligence",
    description:
      "Structures target-country statutory compliance, central clearing network specifications, currency formatting requirements, and local payment rail nuances.",
    artifact: "Artifact: Country Requirements",
  },
  {
    number: "03",
    title: "Provider Verification",
    description:
      "Executes actual provider Sandbox operations with deterministic test fixtures, capturing exact HTTP envelopes, response latencies, and parameter rejections.",
    artifact: "Artifact: Sandbox Telemetry",
  },
  {
    number: "04",
    title: "AI Gap Analysis",
    description:
      "Compares available evidence across all three inputs, identifies structural and regulatory gaps, and generates an audit-ready expansion readiness assessment.",
    artifact: "Artifact: Readiness Report",
  },
];

const findings = [
  {
    title: "ACSS Transit Format Validation Missing",
    description:
      "Regex parser accepts US 9-digit ABA routing instead of Canadian 5-digit transit and 3-digit institution code.",
    severity: "High",
    status: "Confirmed Gap",
    statusClass: "bg-rose-50 text-rose-700 border-rose-200",
    evidence: "Hyperwallet SBX 422",
    reference: "POST /bank-accounts",
    recommendation:
      "Update bank payload schema to validate Canadian 5-digit transit number and 3-digit institution ID prior to dispatch.",
  },
  {
    title: "Missing Interac e-Transfer Fallback Route",
    description:
      "Onboarding workflow only captures standard direct bank deposit parameters.",
    severity: "Medium",
    status: "Potential Gap",
    statusClass: "bg-amber-50 text-amber-800 border-amber-200",
    evidence: "AST_PAYOUT_V4#L148",
    reference: "Recipient Form Parser",
    recommendation:
      "Offer email-based Interac fallback to accommodate micro-sellers without business chequing accounts.",
  },
  {
    title: "FINTRAC Tier-1 Compliance Attributes",
    description:
      "Disbursement payload provides verified corporate registry ID and physical Canadian address.",
    severity: "Low",
    status: "No Gap Identified",
    statusClass: "bg-emerald-50 text-emerald-800 border-emerald-200",
    evidence: "STAT_CA_PCMLTFA",
    reference: "FINTRAC Tier 1 Spec",
    recommendation:
      "No action required. Current payload satisfies statutory AML reporting requirements.",
  },
  {
    title: "ACSS Return Settlement Notification Latency",
    description:
      "Webhook handler for transfer refund reversals not observed in staging test logs.",
    severity: "Low",
    status: "Insufficient Evidence",
    statusClass: "bg-slate-100 text-slate-700 border-slate-200",
    evidence: "SBX_WH_NULL_TRACE",
    reference: "Event Dispatches (0)",
    recommendation:
      "Simulate return scenario in provider Sandbox to capture exact reversal notification payload.",
  },
];

const sandboxRows = [
  {
    provider: "PayPal REST v2",
    endpoint: "/v2/checkout/orders",
    method: "POST",
    response: "201 Created",
    time: "240ms",
    evidence:
      "Order token issued; 3DS authorization liability shift flag present.",
  },
  {
    provider: "PayPal REST v2",
    endpoint: "/v2/checkout/orders/{id}/capture",
    method: "POST",
    response: "200 OK",
    time: "310ms",
    evidence:
      "Capture validated; webhook signature header SHA256 verified.",
  },
  {
    provider: "Hyperwallet v4",
    endpoint: "/rest/v4/users/{token}/bank-accounts",
    method: "POST",
    response: "201 Created",
    time: "380ms",
    evidence:
      "CAD EFT account registered; status marked ACTIVATED with ACSS transit.",
  },
  {
    provider: "Hyperwallet v4",
    endpoint: "/rest/v4/transfers",
    method: "POST",
    response: "201 Created",
    time: "420ms",
    evidence:
      "FX quote locked (USD/CAD); idempotency transfer reference acknowledged.",
  },
];

function SectionHeading({ eyebrow, title, description, className = "" }) {
  return (
    <div className={`mb-12 max-w-3xl ${className}`}>
      <p className="mb-3 text-[11px] font-medium uppercase tracking-wider text-black-400">
        {eyebrow}
      </p>

      <h2 className="font-display text-[30px] font-normal leading-tight tracking-[-0.025em] text-black-950 sm:text-[34px]">
        {title}
      </h2>

      {description && (
        <p className="mt-4 text-[14px] leading-relaxed text-black-600 sm:text-[15px]">
          {description}
        </p>
      )}
    </div>
  );
}

function HeroPipeline() {
  return (
    <div className="rounded-[3px] border border-slate-200 bg-[#fbfcfd] p-5 sm:p-7">
      <p className="mb-6  text-[12px] font-normal uppercase tracking-wider text-black-500">
        Readiness Architecture Pipeline
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          ["01 / INPUT", "Integration Profile", "AST code parse"],
          ["02 / INPUT", "Country Rules", "Statutory & rails"],
          ["03 / INPUT", "Sandbox Telemetry", "Runtime execution"],
        ].map(([number, title, description]) => (
          <div
            key={number}
            className="border border-slate-200 bg-white p-3.5"
          >
            <p className=" text-[10px] text-slate-400">{number}</p>
            <p className="mt-1 text-[12px] font-semibold text-slate-900">
              {title}
            </p>
            <p className="mt-1 text-[11px] text-slate-500">{description}</p>
          </div>
        ))}
      </div>

      <div className="flex justify-center py-1">
        <div className="h-6 w-px bg-slate-300" />
      </div>

      <div className="border border-slate-200 bg-white p-4 text-center">
        <p className=" text-[10px] font-medium text-blue-600">
          SYNTHESIS ENGINE
        </p>
        <p className="mt-1 text-[13px] font-semibold text-slate-900">
          AI Gap & Alignment Matrix
        </p>
        <p className="mx-auto mt-1 max-w-sm text-[11px] leading-relaxed text-slate-500">
          Cross-references verified runtime payloads against statutory banking
          profiles.
        </p>
      </div>

      <div className="flex justify-center py-1">
        <div className="h-6 w-px bg-slate-300" />
      </div>

      <div className="flex flex-col justify-between gap-3 rounded-[1px] bg-slate-900 p-4 text-white sm:flex-row sm:items-center">
        <div>
          <p className=" text-[10px] uppercase tracking-wider text-slate-400">
            Output Artifact
          </p>
          <p className="mt-1 text-[13px] font-normal">
            Expansion Readiness Assessment
          </p>
        </div>

        <span className="w-fit rounded-[1px] border border-slate-700 bg-slate-800 px-2 py-1 text-[10px] text-emerald-400">
          READY_WITH_CONDITIONS
        </span>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-4 text-[11px] text-black-400">
        <span>HYPERWALLET · CAD · ACSS RAIL</span>
        <span>MATCH CONFIDENCE: 88%</span>
      </div>
    </div>
  );
}

export default function HomePage() {
  const isAuthenticated = useSelector(
  (state) => state.auth.status === "authenticated"
);

const assessmentPath = isAuthenticated
  ? "/dashboard"
  : "/auth/register";
  return (
    <main id="home" className="w-full flex-1 bg-white text-slate-900">
      {/* HERO */}
      <section className="border-b border-slate-200/80 bg-white py-20 md:py-24">
        <div className="mx-auto grid w-full max-w-[1600px] grid-cols-1 items-center gap-12 px-6 sm:px-10 lg:grid-cols-12 lg:gap-14 lg:px-[5vw]">
          <div className="flex max-w-xl flex-col gap-6 lg:col-span-6">
            <p className="flex items-center gap-2  text-[11px] font-medium uppercase tracking-wider text-slate-500">
              
              Payment Expansion Intelligence
            </p>

            <h1 className="font-display text-[50px] font-normal leading-[1.08] tracking-[-0.035em] text-black-950 sm:text-[52px] lg:text-[52px]">
              Expand Across Borders With Evidence, Not Assumptions.
            </h1>

            <p className="text-[15px] leading-relaxed text-black-600 sm:text-[16px]">
              Evaluate your payment integration, verify provider capabilities
              through Sandbox execution, and understand target-country
              requirements before expanding.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <a
                href={assessmentPath}
                className="rounded-[1px] bg-blue-600 px-5 py-2.5 text-[13px] font-medium text-white transition-colors hover:bg-blue-700"
              >
                Start Your Assessment
              </a>

              <a
                href="#how-it-works"
                className="rounded-[1px] border border-slate-300 px-5 py-2.5 text-[13px] font-medium text-slate-700 transition-colors hover:bg-slate-50"
              >
                Explore How It Works
              </a>
            </div>

            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-slate-100 pt-4 text-[11px] text-blac-500 sm:text-[12px]">
              <span>AST Code Analysis</span>
              <span className="hidden h-1 w-1 rounded-full bg-slate-300 sm:block" />
              <span>Deterministic Sandboxes</span>
              <span className="hidden h-1 w-1 rounded-full bg-slate-300 sm:block" />
              <span>No Live Credentials</span>
            </div>
          </div>

          <div className="lg:col-span-6">
            <HeroPipeline />
          </div>
        </div>
      </section>

      {/* PROBLEM */}
      <section className="border-b border-slate-200/80 bg-[#fbfcfd] py-20 md:py-24">
        <div className="mx-auto w-full max-w-[1600px] px-6 sm:px-10 lg:px-[5vw]">
          <SectionHeading
            eyebrow="The Expansion Blindspot"
            title="International Expansion Involves More Than Choosing a Payment Provider."
            description="Selecting a payment provider with international logos is trivial. Knowing whether your codebase, API orchestration, and local settlement architecture can execute in a new country without failing settlement, compliance, or runtime auth is the real challenge."
            className="mb-14"
          />

          <div className="grid grid-cols-1 gap-9 border-t border-slate-200 pt-8 md:grid-cols-3 md:gap-10">
            {problems.map((problem) => (
              <article key={problem.number}>
                <p className="mb-2  text-[10px] uppercase tracking-wider text-black-400">
                  {problem.number}
                </p>

                <h3 className="mb-3 text-[16px] font-medium text-black-900">
                  {problem.title}
                </h3>

                <p className="text-[13px] leading-relaxed text-black-600">
                  {problem.description}
                </p>

                <p className="mt-4 border-t border-slate-200 pt-3  text-[10px] leading-relaxed text-black-500">
                  {problem.observation}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section
        id="how-it-works"
        className="border-b border-slate-200/80 bg-white py-20 md:py-24"
      >
        <div className="mx-auto w-full max-w-[1600px] px-6 sm:px-10 lg:px-[5vw]">
          <SectionHeading
            eyebrow="Methodology"
            title="From Existing Integration to Expansion Readiness."
            description="CheckRail connects static implementation evidence with dynamic runtime sandbox telemetry and structured regulatory intelligence."
            className="mb-14"
          />

          <div className="relative pt-3">
            <div className="absolute left-4 right-4 top-[17px] hidden h-px bg-slate-200 lg:block" />

            <div className="relative z-10 grid grid-cols-1 gap-9 sm:grid-cols-2 lg:grid-cols-4 lg:gap-9">
              {workflow.map((step, index) => (
                <article key={step.number}>
                  <div
                    className={`mb-5 flex h-9 w-9 items-center justify-center border  text-[12px] font-semibold ${
                      index === 3
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-300 bg-white text-slate-900"
                    }`}
                  >
                    {step.number}
                  </div>

                  <h3 className="mb-2 text-[15px] font-medium text-black-950">
                    {step.title}
                  </h3>

                  <p className="text-[13px] leading-relaxed text-black-600">
                    {step.description}
                  </p>

                  <p
                    className={`mt-4  text-[10px] ${
                      index === 3 ? "text-blue-600" : "text-black-400"
                    }`}
                  >
                    {step.artifact}
                  </p>
                </article>
              ))}
            </div>
          </div>

          <div className="mt-12 flex items-start gap-3 border-t border-slate-100 pt-5 text-[12px] leading-relaxed text-black-500">
            
            <p>
              CheckRail operates strictly as a decision-support and
              verification engine. No live merchant funds or production
              credentials are ever ingested.
            </p>
          </div>
        </div>
      </section>

      {/* ASSESSMENT SCENARIOS */}
      <section
        id="scenarios"
        className="border-b border-slate-200/80 bg-[#fbfcfd] py-20 md:py-24"
      >
        <div className="mx-auto w-full max-w-[1600px] px-6 sm:px-10 lg:px-[5vw]">
          <SectionHeading
            eyebrow="Assessment Objectives"
            title="Two Assessment Objectives. One Evidence-Driven Platform."
            description="CheckRail adjusts its assessment flow depending on whether you are evaluating payment processing or executing a cross-border marketplace expansion."
            className="mb-12"
          />

          <div className="grid grid-cols-1 gap-7 lg:grid-cols-2">
            {/* PAYPAL */}
            <article className="flex flex-col justify-between border border-slate-200 bg-white p-6 sm:p-7">
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-4">
                  <span className=" text-[10px] uppercase tracking-wider text-black-400">
                    Scenario A
                  </span>
                  <span className=" text-[10px] text-black-500">
                    Payment Processing Flow
                  </span>
                </div>

                <h3 className="mt-5 text-[19px] font-medium text-slate-900">
                  PayPal Checkout & Settlement Flow
                </h3>

                <p className="mt-2 text-[13px] leading-relaxed text-black-600">
                  Evaluates existing marketplace PayPal integration and
                  payment-processing behavior through Sandbox execution.
                </p>

                <div className="mt-6 border-t border-slate-100 pt-5">
                  <p className="mb-3  text-[10px] uppercase font-semibold text-black-400">
                    Execution Sequence
                  </p>

                  <div className="flex flex-wrap items-center gap-2 text-[12px] text-black-800">
                    <span>Integration Intelligence</span>
                    <span className="text-black-400">→</span>
                    <span>Provider Verification</span>
                    <span className="text-black-400">→</span>
                    <span className="font-medium text-blue-600">
                      AI Gap Analysis
                    </span>
                  </div>
                </div>

                <div className="mt-5 border border-slate-200 bg-slate-50 p-3.5 text-[12px] leading-relaxed text-black-600">
                  <strong className="text-black-900">
                    Country Intelligence Bypassed:
                  </strong>{" "}
                  This assessment focuses on payment-processing behavior
                  rather than target-country expansion requirements.
                </div>
              </div>

              <div className="mt-7 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4  text-[10px]">
                <span className="text-black-500">
                  Payment Sandbox Operations
                </span>
                <span className="font-medium text-emerald-700">
                  PAYMENT PROCESSING
                </span>
              </div>
            </article>

            {/* HYPERWALLET */}
            <article className="flex flex-col justify-between border border-slate-200 bg-white p-6 sm:p-7">
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-4">
                  <span className=" text-[10px] uppercase tracking-wider text-black-400">
                    Scenario B
                  </span>
                  <span className=" text-[10px] text-black-500">
                    Cross-Border Disbursement Flow
                  </span>
                </div>

                <h3 className="mt-5 text-[19px] font-semibold text-black-900">
                  Hyperwallet Cross-Border Expansion
                </h3>

                <p className="mt-2 text-[13px] leading-relaxed text-black-600">
                  Evaluates marketplace expansion into a target country using
                  statutory country requirements and actual Hyperwallet
                  Sandbox evidence.
                </p>

                <div className="mt-6 border-t border-slate-100 pt-5">
                  <p className="mb-3  text-[10px] uppercase font-semibold text-black-400">
                    Execution Sequence
                  </p>

                  <div className="flex flex-wrap items-center gap-2 text-[12px] text-black-800">
                    <span>Integration Intelligence</span>
                    <span className="text-black-400">→</span>
                    <span>Country Intelligence</span>
                    <span className="text-black-400">→</span>
                    <span>Provider Verification</span>
                    <span className="text-black-400">→</span>
                    <span>AI Gap Analysis</span>
                    <span className="text-black-400">→</span>
                    <span className="font-medium text-blue-600">
                      Expansion Readiness
                    </span>
                  </div>
                </div>

                <div className="mt-5 border border-slate-200 bg-slate-50 p-3.5 text-[12px] leading-relaxed text-black-600">
                  <strong className="text-black-900">
                    Country Requirements Included:
                  </strong>{" "}
                  The assessment considers the selected market's business,
                  regulatory, payment infrastructure, and operational
                  requirements.
                </div>
              </div>

              <div className="mt-7 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4  text-[10px]">
                <span className="text-black-500">
                  Target Market: Canada
                </span>
                <span className="font-medium text-amber-700">
                  EXPANSION ASSESSMENT
                </span>
              </div>
            </article>
          </div>
        </div>
      </section>

      {/* EVIDENCE FINDINGS */}
      <section
        id="findings"
        className="border-b border-slate-200/80 bg-white py-20 md:py-24"
      >
        <div className="mx-auto w-full max-w-[1600px] px-6 sm:px-10 lg:px-[5vw]">
          <SectionHeading
            eyebrow="Assessment Evidence"
            title="Every Finding Has a Reason. Every Assessment Has Evidence."
            description="CheckRail connects findings to available implementation evidence, provider Sandbox execution logs, and structured country requirements. A missing observation is not automatically treated as a confirmed compliance failure."
            className="mb-10"
          />

          <div className="mb-4 flex flex-col justify-between gap-3 border-b border-slate-200 pb-4 text-[12px] sm:flex-row sm:items-center">
            <div className="flex flex-wrap items-center gap-3 text-black-600">
              <span className="font-medium text-slate-900">
                Target: Canada (CAD) Marketplace Expansion
              </span>
              <span className="hidden text-black-300 sm:inline">|</span>
              <span className=" text-black-500">
                Report #EXP-9942
              </span>
            </div>

            <div className="flex flex-wrap gap-4  text-[10px]">
              <span className="text-black-600">
                Status:{" "}
                <strong className="font-medium text-amber-700">
                  READY_WITH_CONDITIONS
                </strong>
              </span>
              <span className="text-black-600">
                Evidence Match:{" "}
                <strong className="font-semibold text-black-900">88%</strong>
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] border-collapse text-left text-[12px]">
              <thead>
                <tr className="border-b border-slate-200  text-[10px] uppercase tracking-wider text-black-400">
                  <th className="py-3 pr-5 font-semibold">Finding</th>
                  <th className="px-3 py-3 font-semibold">Severity</th>
                  <th className="px-3 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Evidence</th>
                  <th className="py-3 pl-4 font-semibold">Recommendation</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 text-black-700">
                {findings.map((finding) => (
                  <tr
                    key={finding.title}
                    className="align-top transition-colors hover:bg-slate-50/60"
                  >
                    <td className="py-4 pr-5">
                      <p className="font-semibold text-black-900">
                        {finding.title}
                      </p>
                      <p className="mt-1 max-w-xs text-[11px] leading-relaxed text-black-500">
                        {finding.description}
                      </p>
                    </td>

                    <td className="whitespace-nowrap px-3 py-4  text-[11px]">
                      <span
                        className={
                          finding.severity === "High"
                            ? "text-rose-700"
                            : finding.severity === "Medium"
                              ? "text-amber-700"
                              : "text-black-500"
                        }
                      >
                        {finding.severity}
                      </span>
                    </td>

                    <td className="px-3 py-4">
                      <span
                        className={`inline-flex whitespace-nowrap rounded-[1px] border px-2 py-1  text-[10px] ${finding.statusClass}`}
                      >
                        {finding.status}
                      </span>
                    </td>

                    <td className="whitespace-nowrap px-4 py-4  text-[10px] text-black-500">
                      {finding.evidence}
                      <p className="mt-1 text-black-400">
                        {finding.reference}
                      </p>
                    </td>

                    <td className="max-w-xs py-4 pl-4 text-[11px] leading-relaxed text-black-600">
                      {finding.recommendation}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4  text-[9px] text-black-500">
            <span>
              TAXONOMY: CONFIRMED GAP · POTENTIAL GAP · NO GAP IDENTIFIED ·
              INSUFFICIENT EVIDENCE
            </span>
            <span>REPORT VALIDATED DETERMINISTICALLY</span>
          </div>
        </div>
      </section>

      {/* PROVIDER VERIFICATION */}
      <section className="border-b border-slate-200/80 bg-[#fbfcfd] py-20 md:py-24">
        <div className="mx-auto w-full max-w-[1600px] px-6 sm:px-10 lg:px-[5vw]">
          <SectionHeading
            eyebrow="Runtime Telemetry"
            title="Verify What Providers Actually Do."
            description="CheckRail connects deterministic test fixtures to provider sandboxes. We execute target operations and capture HTTP statuses, responses, and payload structures."
            className="mb-10"
          />

          <div className="overflow-hidden border border-slate-300 bg-white">
            <div className="flex flex-col justify-between gap-3 border-b border-black-100 p-5 sm:flex-row sm:items-center sm:p-6">
              <div>
                <h3 className="text-[14px] font-semibold text-slate-900">
                  Deterministic Sandbox Verification Runs
                </h3>
                <p className="mt-1 text-[12px] text-black-500">
                  Capturing API contract behavior under simulated merchant
                  payload scenarios.
                </p>
              </div>

              <span className=" text-[10px] text-black-500">
                Sandbox Telemetry Harness
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-[12px]">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50  text-[10px] uppercase tracking-wider text-black-400">
                    <th className="px-5 py-3 font-semibold">Provider</th>
                    <th className="px-4 py-3 font-semibold">Endpoint</th>
                    <th className="px-4 py-3 font-semibold">Method</th>
                    <th className="px-4 py-3 font-semibold">Response</th>
                    <th className="px-5 py-3 font-semibold">
                      Collected Runtime Evidence
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-200  text-[11px] text-black-700">
                  {sandboxRows.map((row) => (
                    <tr
                      key={`${row.provider}-${row.endpoint}`}
                      className="transition-colors hover:bg-slate-50"
                    >
                      <td className="whitespace-nowrap px-5 py-4 font-sans font-semibold text-slate-900">
                        {row.provider}
                      </td>

                      <td className="px-4 py-4 text-black-600">
                        {row.endpoint}
                      </td>

                      <td className="px-4 py-4 font-semibold text-blue-700">
                        {row.method}
                      </td>

                      <td className="whitespace-nowrap px-4 py-4">
                        <span className="font-medium text-emerald-700">
                          {row.response}
                        </span>
                        <span className="ml-1 text-black-400">
                          ({row.time})
                        </span>
                      </td>

                      <td className="px-5 py-4 font-sans text-[11px] leading-relaxed text-black-600">
                        {row.evidence}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-7 flex flex-col justify-between gap-2 text-[11px] text-black-500 sm:flex-row">
            <span>
              Sandbox tests execute against provider staging environments.
            </span>
            <span className="">HTTP / REST API Evidence</span>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="bg-white py-24 md:py-32">
        <div className="mx-auto flex max-w-4xl flex-col items-center px-6 text-center sm:px-8">
          <p className="mb-4  text-[10px] font-medium uppercase tracking-wider text-black-400">
            Ready For Evaluation
          </p>

          <h2 className="max-w-4xl font-display text-[40px] font-normal leading-tight tracking-[-0.03em] text-slate-950 sm:text-[42px]">
            Make Your Next Expansion an Evidence-Based Decision.
          </h2>

          <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-black-600 sm:text-[15px]">
            Understand your integration. Verify your provider. Evaluate your
            market. Identify structural and regulatory gaps before committing
            merchant funds.
          </p>

          <a
           href={assessmentPath}
            className="mt-8 rounded-[3px] bg-slate-950 px-6 py-3 text-[13px] font-medium text-white transition-colors hover:bg-slate-800"
          >
            Start Your Assessment
          </a>

          <div className="mt-12 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 border-t border-slate-100 pt-7 text-[10px]  text-black-500 sm:gap-x-8">
            <span>Evidence-Based Assessment</span>
            <span className="text-black-300">•</span>
            <span>No Live Secrets Stored</span>
            <span className="text-black-300">•</span>
            <span>Source-Level Analysis</span>
          </div>
        </div>
      </section>
    </main>
  );
}