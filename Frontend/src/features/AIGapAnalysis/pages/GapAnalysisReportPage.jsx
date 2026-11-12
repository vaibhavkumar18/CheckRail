import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import useProjects from "../../project/hook/useProjects";
import useGapAnalysis from "../hook/useGapAnalysis";

const getData = (response) => response?.data?.data || response?.data || response;
const getProject = (response) => {
    const data = getData(response);
    return data?.project || data;
};
const text = (value, fallback = "Not recorded") =>
    value === null || value === undefined || value === "" ? fallback : String(value);
const humanize = (value) =>
    String(value || "Not recorded").replaceAll("_", " ").toLowerCase()
        .replace(/\b\w/g, (character) => character.toUpperCase());
const asArray = (value) => Array.isArray(value) ? value : [];
const runStatus = (analysis) =>
    String(analysis?.status || analysis?.executionStatus || analysis?.execution_status || "UNKNOWN").toUpperCase();

function Status({ value }) {
    const normalized = String(value || "UNKNOWN").toUpperCase();
    const styles = {
        READY: "bg-emerald-50 text-emerald-700",
        READY_WITH_CONDITIONS: "bg-amber-50 text-amber-800",
        NOT_READY: "bg-red-50 text-red-700",
        COMPLETED: "bg-emerald-50 text-emerald-700",
        FAILED: "bg-red-50 text-red-700",
        HIGH: "bg-red-50 text-red-700",
        MEDIUM: "bg-amber-50 text-amber-800",
        LOW: "bg-slate-100 text-slate-700",
    };
    return (
        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${styles[normalized] || "bg-slate-100 text-slate-700"}`}>
            {humanize(normalized)}
        </span>
    );
}

function Section({ title, count, children }) {
    return (
        <section>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
                {count !== undefined && <span className="text-xs text-slate-500">{count} {count === 1 ? "item" : "items"}</span>}
            </div>
            {children}
        </section>
    );
}

function Finding({ finding, index }) {
    const heading = finding.title || finding.name || finding.topic || `Finding ${index + 1}`;
    const severity = finding.severity || finding.priority;
    const category = finding.category || finding.type;
    const status = finding.status || finding.assessment;
    const requirement = finding.requirement;
    const evidence = [
        ...asArray(finding.evidence),
        ...asArray(finding.evidenceSources || finding.evidence_sources),
    ].filter((item) => item && typeof item === "object");

    return (
        <article className="border-b border-slate-200 py-5 last:border-0">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-xs font-medium text-slate-500">Finding {String(index + 1).padStart(2, "0")}</p>
                    <h3 className="mt-1 font-semibold text-slate-950">{heading}</h3>
                    {category && <p className="mt-1 text-xs text-slate-500">{humanize(category)}</p>}
                </div>
                <div className="flex flex-wrap gap-2">
                    {severity && <Status value={severity} />}
                    {status && <Status value={status} />}
                </div>
            </div>

            {requirement && (
                <div className="mt-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Requirement</p>
                    <p className="mt-1 text-sm leading-6 text-slate-700">
                        {typeof requirement === "string" ? requirement : text(requirement.title || requirement.name || requirement.description)}
                    </p>
                </div>
            )}

            <div className="mt-4 grid gap-x-8 gap-y-4 md:grid-cols-2">
                {(finding.observedState || finding.observed_state) && (
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Observed in the project</p>
                        <p className="mt-1 text-sm leading-6 text-slate-700">{finding.observedState || finding.observed_state}</p>
                    </div>
                )}
                {(finding.businessImpact || finding.business_impact || finding.impact) && (
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Impact</p>
                        <p className="mt-1 text-sm leading-6 text-slate-700">{finding.businessImpact || finding.business_impact || finding.impact}</p>
                    </div>
                )}
                {(finding.recommendation || finding.remediation) && (
                    <div className="md:col-span-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Recommended action</p>
                        <p className="mt-1 text-sm leading-6 text-slate-800">{finding.recommendation || finding.remediation}</p>
                    </div>
                )}
                {finding.rationale && (
                    <div className="md:col-span-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Why this was flagged</p>
                        <p className="mt-1 text-sm leading-6 text-slate-600">{finding.rationale}</p>
                    </div>
                )}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                {(finding.confidence || finding.confidenceLevel || finding.confidence_level) && (
                    <span>Confidence: {humanize(finding.confidence || finding.confidenceLevel || finding.confidence_level)}</span>
                )}
                {evidence.length > 0 && <span>{evidence.length} linked evidence sources</span>}
                {finding.evidenceStatus && <span>Evidence: {humanize(finding.evidenceStatus)}</span>}
            </div>
            {evidence.length > 0 && (
                <ul className="mt-3 space-y-1 border-l-2 border-slate-200 pl-3">
                    {evidence.map((item, itemIndex) => (
                        <li key={item.id || itemIndex} className="text-xs text-slate-600">
                            {item.sourceName || item.title || item.name || item.url || "Supporting source"}
                            {item.url && (
                                <> · <a href={item.url} target="_blank" rel="noreferrer" className="font-medium text-indigo-600 hover:underline">Open</a></>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </article>
    );
}

function Risk({ risk, index }) {
    if (typeof risk === "string") {
        return <li className="border-b border-slate-100 py-3 text-sm leading-6 text-slate-700 last:border-0">{risk}</li>;
    }
    return (
        <li className="border-b border-slate-100 py-3 last:border-0">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-900">{risk.title || risk.name || `Risk ${index + 1}`}</p>
                {risk.severity && <Status value={risk.severity} />}
            </div>
            {(risk.description || risk.impact || risk.businessImpact) && (
                <p className="mt-1 text-sm leading-6 text-slate-600">{risk.description || risk.impact || risk.businessImpact}</p>
            )}
        </li>
    );
}

function SimpleList({ items, emptyText }) {
    const values = asArray(items);
    if (!values.length) return <p className="text-sm text-slate-500">{emptyText}</p>;
    return (
        <ul className="list-disc space-y-2 pl-5 text-sm leading-6 text-slate-600">
            {values.map((item, index) => (
                <li key={index}>
                    {typeof item === "string" ? item : item.description || item.text || item.title || JSON.stringify(item)}
                </li>
            ))}
        </ul>
    );
}

export default function GapAnalysisReportPage() {
    const { projectId, runId } = useParams();
    const projectHook = useProjects();
    const gapHook = useGapAnalysis();
    const [project, setProject] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const load = async () => {
        setError("");
        await gapHook.load(projectId, runId);
    };

    useEffect(() => {
        let active = true;
        const initialize = async () => {
            setLoading(true);
            try {
                const [projectResponse] = await Promise.all([
                    projectHook.loadProject(projectId),
                    gapHook.load(projectId, runId),
                ]);
                if (active) setProject(getProject(projectResponse));
            } catch (err) {
                if (active) setError(err?.response?.data?.message || err?.message || "Unable to load this assessment report.");
            } finally {
                if (active) setLoading(false);
            }
        };
        initialize();
        return () => { active = false; };
    }, [projectId, runId]);

    const analysis = gapHook.analysis;
    const report = analysis?.report || analysis?.data?.report || null;
    const assessment = report?.assessment || report || {};
    const overall = assessment?.overallAssessment || assessment?.overall_assessment || "NOT ASSESSED";
    const findings = asArray(assessment?.findings);
    const risks = asArray(assessment?.keyRisks || assessment?.key_risks);
    const evidenceSummary = report?.evidenceSummary || report?.evidence_summary || {};
    const counts = useMemo(() => ({
        findings: findings.length,
        risks: risks.length,
    }), [findings.length, risks.length]);

    if (loading || gapHook.loading) {
        return <main className="mx-auto max-w-6xl px-6 py-10 text-sm text-slate-500">Loading assessment report…</main>;
    }
    if (error || gapHook.error || !analysis) {
        return (
            <main className="mx-auto max-w-6xl space-y-4 px-6 py-10">
                <Link to={`/projects/${projectId}/workflow`} className="text-sm font-medium text-indigo-600 hover:underline">← Back to workflow</Link>
                <div className="border-y border-red-200 py-5">
                    <h1 className="text-lg font-semibold text-red-700">Assessment report unavailable</h1>
                    <p className="mt-2 text-sm text-slate-600">{error || gapHook.error || "No report data was returned."}</p>
                    <button type="button" onClick={load} className="mt-3 text-sm font-semibold text-indigo-600 hover:underline">Try again</button>
                </div>
            </main>
        );
    }

    return (
        <main className="mx-auto max-w-6xl space-y-8 px-6 py-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <Link to={`/projects/${projectId}/workflow`} className="text-sm font-medium text-indigo-600 hover:underline">← Back to workflow</Link>
                    <p className="mt-6 text-xs font-semibold uppercase tracking-[0.14em] text-indigo-600">AI Gap Analysis · Assessment report</p>
                    <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{project?.name || "Project assessment"}</h1>
                    <p className="mt-2 text-sm text-slate-500">
                        {project?.provider || "Provider"} · Generated {analysis?.createdAt || analysis?.created_at ? new Date(analysis.createdAt || analysis.created_at).toLocaleString() : "date unavailable"}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Status value={runStatus(analysis)} />
                    <button type="button" onClick={load} disabled={gapHook.loading} className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">Refresh</button>
                </div>
            </div>

            {!report ? (
                <div className="border-y border-amber-200 py-5">
                    <h2 className="font-semibold text-amber-800">Report is not ready yet</h2>
                    <p className="mt-1 text-sm text-slate-600">The analysis run exists, but no persisted report was returned. Refresh after the run finishes.</p>
                </div>
            ) : (
                <>
                    <section className="border-y border-slate-200 py-6">
                        <div className="flex flex-wrap items-center justify-between gap-4">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Overall assessment</p>
                                <div className="mt-2"><Status value={overall} /></div>
                            </div>
                            <div className="flex gap-8">
                                <div><p className="text-xs text-slate-500">Findings</p><p className="mt-1 text-2xl font-semibold text-slate-950">{counts.findings}</p></div>
                                <div><p className="text-xs text-slate-500">Key risks</p><p className="mt-1 text-2xl font-semibold text-slate-950">{counts.risks}</p></div>
                            </div>
                        </div>
                        {(assessment.executiveSummary || assessment.executive_summary) && (
                            <p className="mt-5 max-w-5xl text-sm leading-7 text-slate-700">{assessment.executiveSummary || assessment.executive_summary}</p>
                        )}
                    </section>

                    {risks.length > 0 && (
                        <Section title="Key risks" count={risks.length}>
                            <ul className="divide-y divide-slate-200 border-y border-slate-200">
                                {risks.map((risk, index) => <Risk key={risk.id || index} risk={risk} index={index} />)}
                            </ul>
                        </Section>
                    )}

                    <Section title="Findings and recommended work" count={findings.length}>
                        {findings.length ? (
                            <div className="divide-y divide-slate-200 border-y border-slate-200">
                                {findings.map((finding, index) => <Finding key={finding.id || index} finding={finding} index={index} />)}
                            </div>
                        ) : (
                            <p className="border-y border-slate-200 py-5 text-sm text-slate-500">No findings were recorded in this report.</p>
                        )}
                    </Section>

                    {Object.keys(evidenceSummary).length > 0 && (
                        <Section title="Evidence used">
                            <div className="grid gap-5 border-y border-slate-200 py-5 sm:grid-cols-2 lg:grid-cols-4">
                                {[
                                    ["Country sources", evidenceSummary.totalCountrySources ?? evidenceSummary.total_country_sources],
                                    ["Provider checks", evidenceSummary.totalCapabilityChecks ?? evidenceSummary.total_capability_checks],
                                    ["Provider evidence", evidenceSummary.totalCapabilityEvidence ?? evidenceSummary.total_capability_evidence],
                                    ["Country requirements", evidenceSummary.totalCountryRequirements ?? evidenceSummary.total_country_requirements],
                                ].filter(([, value]) => value !== undefined && value !== null).map(([label, value]) => (
                                    <div key={label}><p className="text-xs text-slate-500">{label}</p><p className="mt-1 text-xl font-semibold text-slate-950">{value}</p></div>
                                ))}
                            </div>
                        </Section>
                    )}

                    <div className="grid gap-8 border-t border-slate-200 pt-6 md:grid-cols-2">
                        <Section title="Assumptions">
                            <SimpleList items={assessment.assumptions} emptyText="No assumptions were recorded." />
                        </Section>
                        <Section title="Limitations">
                            <SimpleList items={assessment.limitations} emptyText="No limitations were recorded." />
                        </Section>
                    </div>

                    {report.disclaimer && (
                        <p className="border-t border-slate-200 pt-4 text-xs leading-5 text-slate-500">{report.disclaimer}</p>
                    )}
                </>
            )}
        </main>
    );
}
