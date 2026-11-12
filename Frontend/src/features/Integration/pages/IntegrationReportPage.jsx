import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import useIntegration from "../hook/useIntegration";

const object = (value) =>
    value && typeof value === "object" && !Array.isArray(value) ? value : {};
const list = (value) => (Array.isArray(value) ? value : []);
const text = (value, fallback = "Not established") => {
    if (value === null || value === undefined || value === "") return fallback;
    if (typeof value === "boolean") return value ? "Yes" : "No";
    if (Array.isArray(value)) return value.length ? `${value.length} items` : "None detected";
    if (typeof value === "object") return fallback;
    return String(value);
};
const title = (value = "") =>
    String(value).replace(/([a-z0-9])([A-Z])/g, "$1 $2")
        .replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim()
        .replace(/\b\w/g, (char) => char.toUpperCase());
const unique = (items) => [...new Set(items.filter(Boolean))];
const parseProfile = (value) => {
    if (typeof value === "string") {
        try { return object(JSON.parse(value)); } catch { return {}; }
    }
    return object(value);
};
const dateLabel = (value) => {
    if (!value) return "Date unavailable";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "Date unavailable" : date.toLocaleString();
};

function Status({ value }) {
    const key = String(value || "UNKNOWN").toUpperCase();
    const styles = ["CONFIRMED", "HIGH", "DIRECT_EVIDENCE"].includes(key)
        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
        : ["INFERRED", "INFERRED_RELATIONSHIP", "MEDIUM", "LOW", "PENDING"].includes(key)
          ? "border-slate-200 bg-slate-50 text-black-600"
          : ["FAILED", "CRITICAL", "HIGH_RISK"].includes(key)
            ? "border-rose-200 bg-rose-50 text-rose-700"
            : "border-slate-200 bg-white text-black-500";
    return <span className={`inline-flex items-center rounded-md border px-2 py-1 text-[10px] font-semibold tracking-wide ${styles}`}>{title(key)}</span>;
}

function Metric({ label, value, hint }) {
    return (
        <div className="min-w-0 border-l border-slate-200 pl-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-black-400">{label}</p>
            <p className="mt-1 truncate text-base font-semibold text-black-900">{text(value, "—")}</p>
            {hint && <p className="mt-1 text-xs leading-5 text-black-500">{hint}</p>}
        </div>
    );
}

function Detail({ label, value, fallback }) {
    return (
        <div className="py-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-black-400">{label}</p>
            <p className="mt-1 break-words text-sm leading-6 text-black-800">{text(value, fallback)}</p>
        </div>
    );
}

function SourceLabel({ file }) {
    if (!file) return null;
    return <span className="inline-flex max-w-full break-all rounded-md bg-slate-100 px-2.5 py-1.5 font-mono text-[11px] text-black-700">{file}</span>;
}


function Caveat({ items, heading = "Evidence note" }) {
    const values = list(items).filter(Boolean);
    if (!values.length) return null;

    return (
        <div className="mt-4 border-t border-slate-200 pt-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-black-400">
                {heading}
            </p>
            <ul className="mt-1.5 space-y-1">
                {values.slice(0, 2).map((item, index) => (
                    <li key={index} className="text-xs leading-5 text-black-500">
                        {item}
                    </li>
                ))}
                {values.length > 2 && (
                    <li className="text-[11px] font-medium text-black-400">
                        +{values.length - 2} additional notes
                    </li>
                )}
            </ul>
        </div>
    );
}

function SectionIntro({ kicker, heading, description }) {
    return (
        <div className="mb-6">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-indigo-600">{kicker}</p>
            <h2 className="mt-1.5 text-xl font-semibold tracking-tight text-black-950">{heading}</h2>
            <p className="mt-1.5 max-w-3xl text-sm leading-6 text-black-500">{description}</p>
        </div>
    );
}

// Evidence IDs are internal references. Keep them out of the user-facing report.
function EvidenceSources() {
    return null;
}

function ProviderOverview({ profile, record }) {
    const provider = object(profile.provider);
    const integration = object(profile.integration);
    return (
        <div className="space-y-6">
            <SectionIntro kicker="01 / Overview" heading="Provider overview" description="What provider is present in the codebase, what kind of integration this appears to be, and how confidently it was identified." />
            <div className="grid gap-6 border-y border-slate-200 py-5 sm:grid-cols-2 lg:grid-cols-4">
                <Metric label="Provider" value={provider.name} hint="Detected from submitted source" />
                <Metric label="Identification" value={provider.assessment || provider.identificationStatus} />
                <Metric label="Confidence" value={provider.confidence} />
                <Metric label="Integration type" value={integration.type || integration.integrationType || profile.integrationType} />
            </div>
            <div className="grid gap-x-10 sm:grid-cols-2 lg:grid-cols-3">
                <Detail label="Source package" value={record.originalFilename || record.original_filename} />
                <Detail label="Environment" value={integration.environment || profile.environment} />
                <Detail label="Integration method" value={integration.method || integration.integrationMethod} />
                <Detail label="Integration description" value={integration.description || profile.description} />
                <Detail label="Review status" value={record.reviewStatus || record.review_status} />
                <Detail label="Analysis date" value={record.createdAt || record.created_at ? dateLabel(record.createdAt || record.created_at) : null} />
            </div>
            <EvidenceSources evidenceIds={provider.evidenceIds} />
            <Caveat items={provider.limitations} />
        </div>
    );
}

function fileRole(file = "") {
    const name = file.split("/").pop().toLowerCase();
    if (name.startsWith(".env") || name.includes("config")) {
        return {
            category: "Configuration source",
            description: "A configuration-related file. Review which environment variables the application reads and where they are consumed. The file's presence alone does not prove that credentials are valid or configured in the running environment.",
        };
    }
    if (name.includes("client") || name.includes("provider") || name.includes("payment") || name.includes("gateway")) {
        return {
            category: "Provider integration source",
            description: "A likely provider-facing source file. Inspect request construction, authentication handling, response parsing and error handling in this file. Static evidence does not prove that remote requests succeed.",
        };
    }
    if (name.endsWith(".md") || name.includes("readme")) {
        return {
            category: "Project documentation",
            description: "Documentation can explain setup and intended integration behavior. Treat it as project context, not proof that the described behavior exists in executable code.",
        };
    }
    if (/\.(json|ya?ml|toml)$/.test(name)) {
        return {
            category: "Project configuration / specification",
            description: "A structured configuration or specification file. Check whether the application loads it at runtime before treating it as active behavior.",
        };
    }
    return {
        category: "Source file",
        description: "The analyzer found integration-related evidence in this file. Its exact runtime responsibility has not been established by the available profile.",
    };
}

function TechnicalApproach({ profile }) {
    const architecture = object(profile.architecture);
    const components = list(architecture.components);
    const architectureSummary = architecture.description || "Static analysis identified the following files as containing integration-related evidence. The file role descriptions below are guidance based on their names, not verified runtime call relationships.";
    return (
        <div className="space-y-6">
            <SectionIntro kicker="02 / Source map" heading="Technical approach" description="A developer-oriented reading of the files involved, what to inspect in each one, and what the current analysis can actually establish." />
            <div className="flex flex-wrap items-center gap-2"><Status value={architecture.assessment} /><Status value={architecture.confidence} /><span className="text-xs text-black-500">{components.length} relevant files identified</span></div>
            <p className="max-w-4xl text-sm leading-7 text-black-700">{architectureSummary}</p>
            {components.length ? (
                <div className="divide-y divide-slate-200 border-y border-slate-200">
                    {components.map((component, index) => {
                        const file = component.name || component.file || `Source item ${index + 1}`;
                        const inferred = fileRole(file);
                        const suppliedDescription = component.responsibility || component.description || component.purpose;
                        return (
                            <article key={`${file}-${index}`} className="grid gap-3 py-5 md:grid-cols-[minmax(0,0.85fr)_minmax(0,1.5fr)] md:gap-10">
                                <div>
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">Source {String(index + 1).padStart(2, "0")}</p>
                                    <h3 className="mt-1 break-all font-mono text-sm font-semibold text-black-900">{file}</h3>
                                    <p className="mt-2 text-xs font-semibold text-black-500">{inferred.category}</p>
                                </div>
                                <div>
                                    <p className="text-sm leading-7 text-black-700">{suppliedDescription || inferred.description}</p>
                                    <EvidenceSources evidenceIds={component.evidenceIds} />
                                </div>
                            </article>
                        );
                    })}
                </div>
            ) : (
                <p className="border-y border-slate-200 py-5 text-sm text-black-500">No source component list was returned by the analyzer.</p>
            )}
            <Caveat items={architecture.limitations} heading="What the source map does not establish" />
        </div>
    );
}

function Capabilities({ profile }) {
    const capabilities = list(profile.capabilities);
    return (
        <div className="space-y-6">
            <SectionIntro kicker="03 / Payment flow" heading="Payment capabilities" description="The payment operations that the source analysis identified. Use these findings to decide what needs code review and sandbox verification." />
            {capabilities.length ? (
                <div className="divide-y divide-slate-200 border-y border-slate-200">
                    {capabilities.map((item, index) => (
                        <article key={`${item.capability}-${index}`} className="grid gap-3 py-5 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.5fr)] md:gap-10">
                            <div>
                                <h3 className="font-semibold text-black-900">{title(item.capability || `Capability ${index + 1}`)}</h3>
                                <div className="mt-2 flex flex-wrap gap-2"><Status value={item.assessment} /><Status value={item.confidence} /></div>
                            </div>
                            <div>
                                <p className="text-sm leading-7 text-black-700">{text(item.description, "The profile identifies this capability, but does not provide a more detailed explanation.")}</p>
                                <EvidenceSources evidenceIds={item.evidenceIds} />
                                <Caveat items={item.limitations} />
                            </div>
                        </article>
                    ))}
                </div>
            ) : <p className="border-y border-slate-200 py-5 text-sm text-black-500">No payment capabilities were identified in the saved profile.</p>}
        </div>
    );
}

function Insights({ profile }) {
    const insights = list(profile.aiInsights);
    return (
        <div className="space-y-6">
            <SectionIntro kicker="04 / Findings" heading="Developer findings" description="Short, evidence-linked observations that can guide the next code review. These are interpretations, not test results." />
            {insights.length ? (
                <div className="divide-y divide-slate-200 border-y border-slate-200">
                    {insights.map((item, index) => (
                        <article key={`${item.topic}-${index}`} className="py-5">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <h3 className="font-semibold text-black-900">{title(item.topic || `Observation ${index + 1}`)}</h3>
                                <div className="flex flex-wrap gap-2"><Status value={item.interpretation} /><Status value={item.confidence} /></div>
                            </div>
                            <p className="mt-2 max-w-5xl text-sm leading-7 text-black-700">{text(item.observation)}</p>
                            <EvidenceSources evidenceIds={item.evidenceIds} />
                            <Caveat items={item.caveats} heading="Keep in mind" />
                        </article>
                    ))}
                </div>
            ) : <p className="border-y border-slate-200 py-5 text-sm text-black-500">No supplementary AI observations were saved with this profile.</p>}
        </div>
    );
}

function Configuration({ profile }) {
    const entries = list(profile.configuration);
    return (
        <div className="space-y-6">
            <SectionIntro kicker="05 / Environment setup" heading="Configuration & credentials" description="Configuration keys referenced by the source. Secret values are never displayed in this report." />
            {entries.length ? (
                <div className="divide-y divide-slate-200 border-y border-slate-200">
                    {entries.map((entry, index) => {
                        const values = list(entry.value);
                        const declared = values.some((value) => value?.declarationPresent);
                        const usage = unique(values.map((value) => value?.accessExpression));
                        return (
                            <article key={`${entry.key}-${index}`} className="grid gap-3 py-4 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.5fr)] md:gap-10">
                                <div>
                                    <h3 className="break-all font-mono text-sm font-semibold text-black-900">{text(entry.key)}</h3>
                                    <p className="mt-1 text-xs text-black-500">{title(entry.category)}</p>
                                </div>
                                <div>
                                    <div className="flex flex-wrap gap-2"><Status value={entry.assessment} /><span className="text-xs text-black-600">Declaration: <strong>{declared ? "Found" : "Not established"}</strong></span><span className="text-xs text-black-600">Handling: <strong>{entry.sensitive ? "Sensitive value hidden" : "Non-sensitive / unspecified"}</strong></span></div>
                                    {usage.length > 0 && <div className="mt-2"><p className="text-[10px] font-bold uppercase tracking-wider text-black-400">Code usage</p>{usage.slice(0, 3).map((expression) => <code key={expression} className="mt-1 block break-all text-xs text-black-700">{expression}</code>)}</div>}
                                    <EvidenceSources evidenceIds={entry.evidenceIds} />
                                </div>
                            </article>
                        );
                    })}
                </div>
            ) : <p className="border-y border-slate-200 py-5 text-sm text-black-500">No normalized configuration entries were returned.</p>}
        </div>
    );
}

function Security({ profile }) {
    const auth = object(profile.authentication);
    const findings = list(profile.securityFindings);
    return (
        <div className="space-y-6">
            <SectionIntro kicker="06 / Security" heading="Authentication & security" description="What the source reveals about authentication and security-sensitive implementation details." />
            <div className="grid gap-x-12 md:grid-cols-2">
                <div className="border-y border-slate-200 py-4">
                    <h3 className="font-semibold text-black-900">Authentication approach</h3>
                    <div className="mt-2 grid grid-cols-2 gap-x-5">
                        <Detail label="Method" value={auth.method} />
                        <Detail label="Confidence" value={auth.confidence} />
                        <Detail label="Token acquisition" value={auth.tokenAcquisition} />
                        <Detail label="Token refresh" value={auth.tokenRefresh} />
                    </div>
                    {auth.description && <p className="text-sm leading-7 text-black-700">{auth.description}</p>}
                    <EvidenceSources evidenceIds={auth.evidenceIds} />
                    <Caveat items={auth.limitations} />
                </div>
                <div className="border-b border-slate-200 py-4 md:border-y">
                    <h3 className="font-semibold text-black-900">Security findings</h3>
                    {findings.length ? findings.slice(0, 5).map((finding, index) => (
                        <div key={`${finding.title}-${index}`} className="border-b border-slate-100 py-3 last:border-0">
                            <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-medium text-black-800">{title(finding.title || `Finding ${index + 1}`)}</p><Status value={finding.severity || finding.assessment} /></div>
                            {finding.description && <p className="mt-1 text-sm leading-6 text-black-600">{finding.description}</p>}
                            <EvidenceSources evidenceIds={finding.evidenceIds} />
                        </div>
                    )) : <p className="mt-3 text-sm text-black-500">No normalized security findings were returned.</p>}
                </div>
            </div>
        </div>
    );
}

function Coverage({ profile }) {
    const operations = list(profile.apiOperations);
    const lifecycle = object(profile.transactionLifecycle);
    const lifecycleStates = list(lifecycle.states);
    return (
        <div className="space-y-6">
            <SectionIntro kicker="07 / Next steps" heading="Verification coverage" description="A practical summary of what static analysis has covered and what still needs a developer or sandbox test." />
            <div className="grid gap-6 border-y border-slate-200 py-5 sm:grid-cols-3">
                <Metric label="Source files" value={list(profile.architecture?.components).length} hint="Files referenced in the profile" />
                <Metric label="API operations" value={operations.length} hint="Operations extracted from source" />
                <Metric label="Lifecycle states" value={lifecycleStates.length} hint="Transaction states identified" />
            </div>
            <div className="space-y-4">
                <div className="flex gap-3"><span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-indigo-500" /><div><h3 className="text-sm font-semibold text-black-900">Review provider request handling</h3><p className="mt-1 text-sm leading-6 text-black-600">Trace the provider client from credential loading through request construction, response parsing and error handling. Confirm that the code path is called by the application.</p></div></div>
                <div className="flex gap-3"><span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-indigo-500" /><div><h3 className="text-sm font-semibold text-black-900">Verify transaction lifecycle in sandbox</h3><p className="mt-1 text-sm leading-6 text-black-600">Test the relevant collection or payout flow, including success, rejection, timeout and retry behavior. Static source evidence cannot prove remote execution.</p></div></div>
                <div className="flex gap-3"><span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-indigo-500" /><div><h3 className="text-sm font-semibold text-black-900">Validate configuration safely</h3><p className="mt-1 text-sm leading-6 text-black-600">Confirm required environment variables are configured in the target environment without exposing secret values in logs or reports.</p></div></div>
            </div>
            {!operations.length && <Caveat items={["No API operation records were extracted. Do not assume a specific endpoint or payment action is implemented based only on the provider name or documentation."]} />}
            {!lifecycleStates.length && <Caveat items={["No transaction lifecycle states were established. Runtime behavior remains unverified until Capability Verification is executed."]} />}
            <Caveat items={list(profile.limitations)} heading="Overall evidence limitations" />
        </div>
    );
}

function JsonPanel({ profile }) {
    const sections = ["provider", "integration", "architecture", "capabilities", "configuration", "authentication"]
        .filter((key) => profile[key] !== undefined);
    const [selected, setSelected] = useState(sections[0] || "");
    const active = sections.includes(selected) ? selected : sections[0];
    if (!active) return null;
    const json = JSON.stringify(profile[active], (key, value) =>
        /^(id|.*id|.*ids|sourceId|projectId|integrationId|evidenceId|evidenceIds)$/i.test(key) ? undefined : value, 2);
    const copy = async () => {
        try { await navigator.clipboard.writeText(json); } catch { /* clipboard permission unavailable */ }
    };
    return (
        <details className="mt-8 border-t border-slate-200 pt-5">
            <summary className="cursor-pointer text-sm font-semibold text-black-600 hover:text-black-900">
                Technical data <span className="ml-1 font-normal text-black-400">· optional JSON inspection</span>
            </summary>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-1.5">
                    {sections.map((key) => (
                        <button
                            key={key}
                            onClick={() => setSelected(key)}
                            className={`rounded-md border px-2.5 py-1.5 text-[11px] font-medium ${active === key ? "border-indigo-200 bg-indigo-50 text-indigo-700" : "border-slate-200 bg-white text-black-500 hover:bg-slate-50"}`}
                        >
                            {title(key)}
                        </button>
                    ))}
                </div>
                <button onClick={copy} className="text-sm font-semibold text-indigo-700 hover:text-indigo-900">
                    Copy section
                </button>
            </div>
            <pre className="mt-3 max-h-80 overflow-auto rounded-md border border-slate-200 bg-white p-4 text-xs leading-6 text-black-700">
                {json}
            </pre>
        </details>
    );
}

const TABS = [
    { id: "overview", label: "Provider overview" },
    { id: "approach", label: "Technical approach" },
    { id: "capabilities", label: "Payment capabilities" },
    { id: "findings", label: "Developer findings" },
    { id: "configuration", label: "Configuration" },
    { id: "security", label: "Security" },
    { id: "coverage", label: "Verification coverage" },
];

export default function IntegrationReportPage() {
    const { integrationId } = useParams();
    const { integration, loading, error, loadIntegration } = useIntegration();
    const [activeTab, setActiveTab] = useState("overview");

    useEffect(() => {
        if (integrationId) loadIntegration(integrationId).catch(() => {});
    }, [integrationId, loadIntegration]);

    const record = useMemo(() => {
        if (integration?.integration && !integration?.profile) return integration.integration;
        return integration || null;
    }, [integration]);
    const profile = useMemo(() => parseProfile(record?.profile || record?.integration_profile), [record]);

    if (loading && !record) {
        return <main className="flex min-h-[60vh] items-center justify-center bg-slate-50"><div className="text-center"><div className="mx-auto h-7 w-7 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" /><p className="mt-3 text-sm text-black-600">Loading integration report…</p></div></main>;
    }
    if (error && !record) {
        return <main className="mx-auto max-w-4xl px-5 py-12"><Link to="/integrations" className="text-sm font-semibold text-indigo-600">← Back to Integrations</Link><p className="mt-5 border-l-2 border-red-400 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p></main>;
    }
    if (!record) {
        return <main className="mx-auto max-w-4xl px-5 py-16 text-center"><h1 className="text-xl font-bold text-black-900">Integration report not found</h1><p className="mt-2 text-sm text-black-500">The requested report could not be loaded.</p><Link to="/integrations" className="mt-4 inline-block text-sm font-semibold text-indigo-600">← Back to Integrations</Link></main>;
    }

    const provider = object(profile.provider);
    const capabilities = list(profile.capabilities);
    const insights = list(profile.aiInsights);
    const status = record.reviewStatus || record.review_status || "PENDING";
    const sourceName = record.originalFilename || record.original_filename || "Integration source";

    return (
        <main className="min-h-screen bg-[#f7f8fa] px-4 py-8 text-black-900 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-6xl">
                <header className="border-b border-slate-200 pb-7">
                    <Link to="/integrations" className="text-xs font-semibold text-black-600 hover:text-indigo-800">← Back to Integrations</Link>
                    <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-black-600">CorridorGate / Integration Intelligence</p>
                            <h1 className="mt-2 text-2xl font-medium tracking-tight text-black-950 sm:text-[30px]">Integration Analysis</h1>
                            <p className="mt-2 text-sm text-black-500">{sourceName}</p>
                        </div>
                        <div className="flex items-center gap-3"><Status value={status} /><span className="text-xs text-black-500">{dateLabel(record.createdAt || record.created_at)}</span></div>
                    </div>
                    <div className="mt-6 grid gap-5 sm:grid-cols-3">
                        <Metric label="Provider" value={provider.name} />
                        <Metric label="Capabilities detected" value={capabilities.length} />
                        <Metric label="Key observations" value={insights.length} />
                    </div>
                </header>

                <nav className="sticky top-0 z-20 mt-2 border-b border-slate-200 bg-[#f7f8fa]/95 backdrop-blur" aria-label="Integration report sections">
                    <div className="flex gap-5 overflow-x-auto py-2">
                        {TABS.map((tab) => (
                            <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)} className={`shrink-0 border-b-2 px-1 py-3 text-xs font-medium transition-colors sm:text-sm ${activeTab === tab.id ? "border-indigo-600 text-black-950" : "border-transparent text-black-500 hover:text-black-800"}`}>{tab.label}</button>
                        ))}
                    </div>
                </nav>

                <div className="min-h-[420px] py-7">
                    {activeTab === "overview" && <ProviderOverview profile={profile} record={record} />}
                    {activeTab === "approach" && <TechnicalApproach profile={profile} />}
                    {activeTab === "capabilities" && <Capabilities profile={profile} />}
                    {activeTab === "findings" && <Insights profile={profile} />}
                    {activeTab === "configuration" && <Configuration profile={profile} />}
                    {activeTab === "security" && <Security profile={profile} />}
                    {activeTab === "coverage" && <Coverage profile={profile} />}
                    <JsonPanel profile={profile} />
                </div>

                <footer className="border-t border-slate-200 py-5">
                    <p className="text-xs leading-6 text-black-500">This report summarizes static evidence from the uploaded source. It does not establish successful runtime execution, valid credentials, transaction completion, regulatory compliance or production readiness. Use Provider Capability Verification to test provider behavior in the sandbox.</p>
                </footer>
            </div>
        </main>
    );
}
