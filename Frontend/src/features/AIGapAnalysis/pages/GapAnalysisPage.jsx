import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import useProjects from "../../project/hook/useProjects";
import useIntegration from "../../Integration/hook/useIntegration";
import useCapabilityVerification from "../../Verification/hook/useCapabilityVerification";
import useCountryIntelligence from "../../CountryIntelligence/hook/useCountryIntelligence";
import useGapAnalysis from "../hook/useGapAnalysis";

const extractProject = (response) =>
    response?.project || response?.data?.project || response?.data || response;

const extractData = (response) =>
    response?.data?.data || response?.data || response;

const getRunId = (run) =>
    run?.id || run?.runId || run?.run_id;

const getExecutionStatus = (run) => {
    const overall = String(run?.overallStatus || run?.overall_status || run?.status || "").toUpperCase();
    const execution = String(run?.executionStatus || run?.execution_status || "").toUpperCase();
    const checks = Array.isArray(run?.checks) ? run.checks : [];
    const failed = ["FAILED", "ERROR", "CANCELLED", "REJECTED", "PARTIALLY_COMPLETED"];
    if (failed.includes(overall) || checks.some((check) => failed.includes(String(check?.status || "").toUpperCase()))) {
        return "FAILED";
    }
    if (execution === "COMPLETED") {
        return checks.length
            ? checks.every((check) => ["PASSED", "SUCCESS", "SUCCEEDED", "VERIFIED", "COMPLETED"].includes(String(check?.status || "").toUpperCase()))
                ? "COMPLETED"
                : "FAILED"
            : ["VERIFIED", "COMPLETED", "SUCCESS", "SUCCEEDED"].includes(overall) ? "COMPLETED" : "UNKNOWN";
    }
    return execution || overall || "UNKNOWN";
};

const isConfirmed = (integration) =>
    ["CONFIRMED", "COMPLETED"].includes(
        String(
            integration?.reviewStatus ||
            integration?.review_status ||
            ""
        ).toUpperCase()
    );

const pretty = (value) => JSON.stringify(value ?? {}, null, 2);

function AssessmentValue({ value }) {
    if (value == null) return <span className="text-slate-400">Not provided</span>;

    if (typeof value === "string" || typeof value === "number") {
        return <span className="whitespace-pre-wrap">{String(value)}</span>;
    }

    return (
        <pre className="overflow-x-auto whitespace-pre-wrap text-xs text-slate-700">
            {pretty(value)}
        </pre>
    );
}

export default function GapAnalysisPage() {
    const { projectId } = useParams();
    const navigate = useNavigate();

    const projectHook = useProjects();
    const integrationHook = useIntegration();
    const verificationHook = useCapabilityVerification();
    const countryHook = useCountryIntelligence();
    const gapHook = useGapAnalysis();

    const [project, setProject] = useState(null);
    const [selectedCapabilityId, setSelectedCapabilityId] = useState("");
    const [pageLoading, setPageLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        let active = true;

        const load = async () => {
            setPageLoading(true);
            setError("");

            try {
                const projectResponse = await projectHook.loadProject(projectId);
                const loadedProject = extractProject(projectResponse);
                const providerCode = String(loadedProject?.provider || "").toUpperCase();

                await Promise.all([
                    integrationHook.loadProjectIntegrations(projectId),
                    verificationHook.loadRuns(projectId),
                    ...(providerCode === "HYPERWALLET"
                        ? [countryHook.loadProfiles(projectId)]
                        : []),
                ]);

                if (!active) return;
                setProject(loadedProject);
            } catch (err) {
                if (active) {
                    setError(
                        err?.response?.data?.message ||
                        "Unable to load the AI Gap Analysis workspace."
                    );
                }
            } finally {
                if (active) setPageLoading(false);
            }
        };

        load();

        return () => {
            active = false;
        };
    }, [projectId]);

    const integrations = integrationHook.integrations || [];
    const runs = verificationHook.runs || [];
    const completedRuns = useMemo(
        () =>
            runs.filter((run) => {
                const status = getExecutionStatus(run);
                return status === "COMPLETED" && Boolean(getRunId(run));
            }),
        [runs]
    );

    const confirmedIntegration = integrations.some(isConfirmed);

    const provider = String(project?.provider || "").toUpperCase();
    const targetCountries =
        project?.target_countries || project?.targetCountries || [];

    const countryProfiles = countryHook.profiles || [];

    const hyperwalletCountryReady =
        provider !== "HYPERWALLET" ||
        (
            Array.isArray(targetCountries) &&
            targetCountries.length === 1 &&
            countryProfiles.some((profile) =>
                String(profile.status || profile.profile?.status || "").toUpperCase() === "COMPLETED" &&
                String(profile.countryCode || profile.country_code || profile.country?.code || "").toUpperCase() ===
                    String(targetCountries[0]).toUpperCase()
            )
        );

    const selectedRun = completedRuns.find(
        (run) => getRunId(run) === selectedCapabilityId
    );

    const handleStart = async () => {
        setError("");

        if (!confirmedIntegration) {
            setError(
                "A confirmed Integration Profile is required before AI Gap Analysis."
            );
            return;
        }

        if (!selectedCapabilityId) {
            setError("Select a completed capability verification run.");
            return;
        }

        if (!selectedRun) {
            setError("The selected capability run is not completed.");
            return;
        }

        if (!hyperwalletCountryReady) {
            setError(
                "Hyperwallet analysis requires exactly one configured target country and a completed Country Intelligence profile for that country."
            );
            return;
        }

        try {
            const result = await gapHook.start(
                projectId,
                selectedCapabilityId
            );

            const data = extractData(result);
            const createdAnalysis = data?.analysis || data;
            const runId =
                createdAnalysis?.id ||
                createdAnalysis?.runId ||
                createdAnalysis?.run_id;

            if (runId) {
                navigate(`/projects/${projectId}/ai-gap-analysis/${runId}`);
                return;
            }
            if (createdAnalysis?.report) {
                setError("");
            }
        } catch (err) {
            setError(
                err?.response?.data?.message ||
                "AI Gap Analysis failed."
            );
        }
    };

    const handleRefreshReport = async () => {
        const analysis = gapHook.analysis;
        const runId = analysis?.id || analysis?.runId || analysis?.run_id;

        if (!runId) return;

        try {
            await gapHook.load(projectId, runId);
        } catch (err) {
            setError(
                err?.response?.data?.message ||
                "Unable to refresh the analysis report."
            );
        }
    };

    if (pageLoading) {
        return <div className="p-8 text-slate-500">Loading AI Gap Analysis...</div>;
    }

    if (!project) {
        return <div className="p-8 text-red-600">{error || "Project not found."}</div>;
    }

    const analysis = gapHook.analysis;
    const report = analysis?.report || analysis?.data?.report || null;
    const analysisStatus = String(analysis?.status || "NOT_STARTED").toUpperCase();

    const assessment = report?.assessment || report || {};
    const overallAssessment =
        assessment?.overallAssessment ||
        assessment?.overall_assessment ||
        null;

    const executiveSummary =
        assessment?.executiveSummary ||
        assessment?.executive_summary ||
        null;

    const keyRisks = assessment?.keyRisks || assessment?.key_risks || [];
    const findings = assessment?.findings || [];
    const assumptions = assessment?.assumptions || [];
    const limitations = assessment?.limitations || [];

    return (
        <main className="mx-auto max-w-6xl space-y-6 px-5 py-8">
            <div>
                <Link
                    to={`/projects/${projectId}`}
                    className="text-sm font-medium text-indigo-600 hover:underline"
                >
                    ← Back to project
                </Link>

                <p className="mt-6 text-xs font-semibold uppercase tracking-wider text-indigo-600">
                    AI Gap Analysis
                </p>

                <h1 className="mt-2 text-3xl font-bold text-slate-900">
                    Assess expansion readiness gaps
                </h1>

                <p className="mt-2 text-sm text-slate-500">
                    Compare the confirmed Integration Profile with persisted provider Sandbox evidence{provider === "HYPERWALLET" ? " and the configured target-country requirements" : ""}.
                </p>
            </div>

            {(error || gapHook.error) && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                    {error || gapHook.error}
                </div>
            )}

            <section className="rounded-xl border border-slate-200 bg-white p-5">
                <h2 className="font-semibold text-slate-900">
                    Select capability verification evidence
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                    Only completed capability runs can be used for analysis.
                </p>

                {!confirmedIntegration && (
                    <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                        No confirmed Integration Profile was found.{" "}
                        <Link
                            to={`/projects/${projectId}/integration`}
                            className="font-semibold underline"
                        >
                            Confirm an Integration Profile first.
                        </Link>
                    </p>
                )}

                <label className="mt-4 block text-sm font-medium text-slate-700">
                    Completed capability run
                    <select
                        value={selectedCapabilityId}
                        onChange={(event) => setSelectedCapabilityId(event.target.value)}
                        className="mt-2 w-full rounded-lg border border-slate-300 bg-white p-3"
                    >
                        <option value="">Select completed capability run</option>
                        {completedRuns.map((run) => {
                            const id = getRunId(run);
                            return (
                                <option key={id} value={id}>
                                    {run.provider || provider || "Provider"} ·{" "}
                                    {run.capabilityCode ||
                                        run.capability_code ||
                                        "Capability"}{" "}
                                    · {run.startedAt || run.started_at
                                        ? new Date(run.startedAt || run.started_at).toLocaleString()
                                        : "Saved run"}
                                </option>
                            );
                        })}
                    </select>
                </label>

                {completedRuns.length === 0 && (
                    <p className="mt-3 text-sm text-amber-700">
                        No completed capability runs are available.{" "}
                        <Link
                            to={`/projects/${projectId}/verification`}
                            className="font-semibold underline"
                        >
                            Run Provider Verification first.
                        </Link>
                    </p>
                )}

                {provider === "HYPERWALLET" && (
                    <div className="mt-4 rounded-lg bg-slate-50 p-4 text-sm text-slate-700">
                        <p className="font-semibold">Hyperwallet country requirement</p>
                        <p className="mt-1">
                            Target countries:{" "}
                            {Array.isArray(targetCountries)
                                ? targetCountries.join(", ") || "None configured"
                                : targetCountries || "None configured"}
                        </p>
                        <p className="mt-1">
                            Country Intelligence:{" "}
                            {hyperwalletCountryReady ? "Completed profile available" : "Required profile missing"}
                        </p>
                        {!hyperwalletCountryReady && (
                            <Link
                                to={`/projects/${projectId}/country-intelligence`}
                                className="mt-2 inline-block font-semibold text-indigo-600 underline"
                            >
                                Open Country Intelligence
                            </Link>
                        )}
                    </div>
                )}

                {selectedRun && (
                    <div className="mt-4 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
                        <p>Selected run ID: {getRunId(selectedRun)}</p>
                        <p className="mt-1">
                            Execution status: {getExecutionStatus(selectedRun)}
                        </p>
                    </div>
                )}

                <button
                    type="button"
                    onClick={handleStart}
                    disabled={
                        gapHook.submitting ||
                        !selectedCapabilityId ||
                        !confirmedIntegration ||
                        !hyperwalletCountryReady
                    }
                    className="mt-5 rounded-lg bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                    {gapHook.submitting ? "Generating analysis..." : "Run AI Gap Analysis"}
                </button>
            </section>

            {analysis && (
                <section className="rounded-xl border border-slate-200 bg-white p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <h2 className="text-xl font-bold text-slate-900">
                                Analysis report
                            </h2>
                            <p className="mt-1 break-all text-xs text-slate-500">
                                Analysis run ID: {analysis.id || analysis.runId || analysis.run_id || "—"}
                            </p>
                        </div>

                        <div className="flex items-center gap-3">
                            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                                {analysisStatus.replaceAll("_", " ")}
                            </span>

                            <button
                                type="button"
                                onClick={handleRefreshReport}
                                disabled={gapHook.loading}
                                className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50"
                            >
                                Refresh
                            </button>
                        </div>
                    </div>

                    {!report ? (
                        <p className="mt-5 text-sm text-slate-500">
                            The analysis run has been created, but the report is not
                            available in this response yet. Refresh the report to
                            retrieve its latest persisted state.
                        </p>
                    ) : (
                        <div className="mt-6 space-y-6">
                            <div>
                                <h3 className="font-semibold text-slate-900">
                                    Overall assessment
                                </h3>
                                <div className="mt-2 rounded-lg bg-slate-50 p-4 text-sm text-slate-700">
                                    <AssessmentValue value={overallAssessment} />
                                </div>
                            </div>

                            <div>
                                <h3 className="font-semibold text-slate-900">
                                    Executive summary
                                </h3>
                                <div className="mt-2 rounded-lg border border-slate-200 p-4 text-sm leading-6 text-slate-700">
                                    <AssessmentValue value={executiveSummary} />
                                </div>
                            </div>

                            <div>
                                <h3 className="font-semibold text-slate-900">
                                    Key risks
                                </h3>

                                {keyRisks.length === 0 ? (
                                    <p className="mt-2 text-sm text-slate-500">
                                        No key risks were returned.
                                    </p>
                                ) : (
                                    <div className="mt-3 space-y-3">
                                        {keyRisks.map((risk, index) => (
                                            <article
                                                key={risk.id || index}
                                                className="rounded-lg border border-amber-200 bg-amber-50 p-4"
                                            >
                                                <AssessmentValue value={risk} />
                                            </article>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div>
                                <h3 className="font-semibold text-slate-900">
                                    Findings
                                </h3>

                                {findings.length === 0 ? (
                                    <p className="mt-2 text-sm text-slate-500">
                                        No findings were returned.
                                    </p>
                                ) : (
                                    <div className="mt-3 space-y-3">
                                        {findings.map((finding, index) => (
                                            <article
                                                key={finding.id || index}
                                                className="rounded-lg border border-slate-200 p-4"
                                            >
                                                <AssessmentValue value={finding} />
                                            </article>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="rounded-lg bg-slate-50 p-4">
                                    <h3 className="font-semibold text-slate-900">
                                        Assumptions
                                    </h3>
                                    <div className="mt-2">
                                        <AssessmentValue value={assumptions} />
                                    </div>
                                </div>

                                <div className="rounded-lg bg-slate-50 p-4">
                                    <h3 className="font-semibold text-slate-900">
                                        Limitations
                                    </h3>
                                    <div className="mt-2">
                                        <AssessmentValue value={limitations} />
                                    </div>
                                </div>
                            </div>

                            {report.evidenceSummary && (
                                <div>
                                    <h3 className="font-semibold text-slate-900">
                                        Evidence summary
                                    </h3>
                                    <div className="mt-2 rounded-lg bg-slate-50 p-4">
                                        <AssessmentValue value={report.evidenceSummary} />
                                    </div>
                                </div>
                            )}

                            {report.disclaimer && (
                                <p className="border-t border-slate-200 pt-4 text-xs leading-5 text-slate-500">
                                    {report.disclaimer}
                                </p>
                            )}

                            <details>
                                <summary className="cursor-pointer text-sm font-semibold text-slate-700">
                                    View complete persisted report JSON
                                </summary>
                                <pre className="mt-3 overflow-x-auto rounded-lg bg-slate-950 p-4 text-xs text-slate-100">
                                    {pretty(report)}
                                </pre>
                            </details>
                        </div>
                    )}
                </section>
            )}
        </main>
    );
}