
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import useCapabilityVerification from "../hook/useCapabilityVerification";

const formatDate = (value) => {
    if (!value) return "—";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "—";

    return date.toLocaleString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
};

const formatTime = (value) => {
    if (!value) return "—";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "—";

    return date.toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
    });
};

const getDuration = (startedAt, completedAt) => {
    if (!startedAt || !completedAt) return "—";

    const start = new Date(startedAt).getTime();
    const end = new Date(completedAt).getTime();

    if (
        Number.isNaN(start) ||
        Number.isNaN(end) ||
        end < start
    ) {
        return "—";
    }

    const milliseconds = end - start;

    if (milliseconds < 1000) {
        return `${milliseconds} ms`;
    }

    return `${(milliseconds / 1000).toFixed(2)} sec`;
};

const prettyLabel = (value) => {
    if (!value) return "Not specified";

    return String(value)
        .replaceAll("_", " ")
        .replaceAll("-", " ")
        .toLowerCase()
        .replace(/\b\w/g, (character) => character.toUpperCase());
};

const getStatus = (run) => {
    const execution = String(run?.execution_status || "").toUpperCase();
    const overall = String(run?.overall_status || "").toUpperCase();

    if (execution === "RUNNING") return "RUNNING";
    if (execution === "AWAITING_APPROVAL") return "AWAITING APPROVAL";
    if (execution === "FAILED" || overall === "FAILED") return "FAILED";
    if (execution === "SKIPPED") return "SKIPPED";
    if (overall === "VERIFIED") return "VERIFIED";

    return "UNVERIFIED";
};

const statusStyles = {
    PASSED: "bg-emerald-50 text-emerald-700",
    VERIFIED: "bg-emerald-50 text-emerald-700",
    FAILED: "bg-red-50 text-red-700",
    BLOCKED: "bg-amber-50 text-amber-700",
    UNKNOWN: "bg-amber-50 text-amber-700",
    RUNNING: "bg-blue-50 text-blue-700",
    PENDING: "bg-slate-100 text-slate-600",
    SKIPPED: "bg-slate-100 text-slate-600",
    UNSUPPORTED: "bg-slate-100 text-slate-600",
    NOT_RUN: "bg-slate-100 text-slate-600",
    UNVERIFIED: "bg-slate-100 text-slate-600",
    "AWAITING APPROVAL": "bg-amber-50 text-amber-700",
};

const Badge = ({ value }) => {
    const status = String(value || "UNVERIFIED").toUpperCase();

    return (
        <span
            className={`inline-flex shrink-0 items-center rounded-full px-3 py-1.5 text-xs font-semibold ${
                statusStyles[status] || statusStyles.UNVERIFIED
            }`}
        >
            {prettyLabel(status)}
        </span>
    );
};

const InfoItem = ({ label, value }) => (
    <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            {label}
        </p>

        <p className="mt-1.5 break-words text-sm font-semibold text-slate-900">
            {value || "—"}
        </p>
    </div>
);

const SectionHeading = ({ eyebrow, title, description, count }) => (
    <div className="mb-5 flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
        <div>
            {eyebrow && (
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-indigo-600">
                    {eyebrow}
                </p>
            )}

            <h2 className="mt-1.5 text-xl font-semibold tracking-tight text-slate-900">
                {title}
            </h2>

            {description && (
                <p className="mt-1.5 text-sm leading-6 text-slate-500">
                    {description}
                </p>
            )}
        </div>

        {count !== undefined && (
            <span className="text-sm text-slate-500">
                {count} {count === 1 ? "record" : "records"}
            </span>
        )}
    </div>
);

const SummaryItem = ({ label, value, color = "text-slate-900" }) => (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-4">
        <p className="text-xs font-medium text-slate-500">{label}</p>

        <p className={`mt-1.5 text-2xl font-semibold ${color}`}>
            {value}
        </p>
    </div>
);

const safeJson = (value) => {
    if (value === null || value === undefined) return "Not available";

    try {
        return JSON.stringify(value, null, 2);
    } catch {
        return String(value);
    }
};

/* -------------------------------------------------------
   Operation result row
   Only execution summary is displayed here.
------------------------------------------------------- */

const OperationRow = ({ check, index }) => {
    const status = String(check.status || "NOT_RUN").toUpperCase();

    const operationName =
        check.operation || check.name || "Unnamed operation";

    const executionTime = check.completed_at || check.started_at;

    return (
        <div className="grid grid-cols-1 gap-3 border-b border-slate-100 px-4 py-5 last:border-0 sm:grid-cols-[minmax(0,1.5fr)_minmax(130px,1fr)_minmax(100px,0.7fr)_auto] sm:items-center sm:gap-5 sm:px-5">
            <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-semibold text-slate-600">
                    {String(index + 1).padStart(2, "0")}
                </span>

                <div className="min-w-0">
                    <p className="break-words text-sm font-semibold text-slate-900">
                        {prettyLabel(operationName)}
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                        Provider operation
                    </p>
                </div>
            </div>

            <div>
                <p className="text-xs text-slate-500 sm:hidden">
                    Execution time
                </p>

                <p className="text-sm font-medium text-slate-700">
                    {formatTime(executionTime)}
                </p>

                <p className="mt-1 text-xs text-slate-400">
                    {formatDate(executionTime)}
                </p>
            </div>

            <div>
                <p className="text-xs text-slate-500 sm:hidden">
                    Duration
                </p>

                <p className="text-sm font-medium text-slate-700">
                    {getDuration(check.started_at, check.completed_at)}
                </p>
            </div>

            <div className="sm:justify-self-end">
                <Badge value={status} />
            </div>
        </div>
    );
};

/* -------------------------------------------------------
   Evidence detail card
   Technical information lives only in this tab.
------------------------------------------------------- */

const EvidenceItem = ({ item, index }) => {
    const [expanded, setExpanded] = useState(false);

    const hasMetadata =
        item.metadata &&
        typeof item.metadata === "object" &&
        Object.keys(item.metadata).length > 0;

    const hasDetails =
        hasMetadata ||
        item.endpoint ||
        item.http_method ||
        item.http_status != null;

    return (
        <article className="overflow-hidden rounded-xl border border-slate-200 bg-white transition hover:border-slate-300">
            <button
                type="button"
                onClick={() => setExpanded((current) => !current)}
                aria-expanded={expanded}
                className="flex w-full flex-col gap-4 p-5 text-left sm:flex-row sm:items-center sm:justify-between sm:p-6"
            >
                <div className="flex min-w-0 items-start gap-4">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-sm font-semibold text-indigo-700">
                        {String(index + 1).padStart(2, "0")}
                    </span>

                    <div className="min-w-0">
                        <h3 className="text-base font-semibold text-slate-900">
                            {prettyLabel(
                                item.operation || item.evidence_type
                            )}
                        </h3>

                        <p className="mt-1.5 break-all text-sm text-slate-600">
                            {item.http_method && (
                                <span className="mr-2 inline-flex rounded bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                                    {item.http_method}
                                </span>
                            )}

                            {item.endpoint || "Endpoint not recorded"}
                        </p>

                        <p className="mt-2 text-xs text-slate-500">
                            Recorded{" "}
                            {formatDate(item.observed_at || item.created_at)}
                        </p>
                    </div>
                </div>

                <div className="flex shrink-0 items-center justify-between gap-3 sm:justify-end">
                    {item.http_status != null && (
                        <span className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700">
                            HTTP {item.http_status}
                        </span>
                    )}

                    <span
                        className={`flex h-9 w-9 items-center justify-center rounded-full transition ${
                            expanded
                                ? "rotate-180 bg-indigo-50 text-indigo-700"
                                : "bg-slate-100 text-slate-500"
                        }`}
                    >
                        <svg
                            viewBox="0 0 20 20"
                            fill="none"
                            className="h-4 w-4"
                            aria-hidden="true"
                        >
                            <path
                                d="m5 7.5 5 5 5-5"
                                stroke="currentColor"
                                strokeWidth="1.8"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        </svg>
                    </span>
                </div>
            </button>

            {expanded && (
                <div className="border-t border-slate-100 bg-slate-50/70 px-5 py-5 sm:px-6">
                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                        <InfoItem
                            label="Evidence type"
                            value={prettyLabel(item.evidence_type)}
                        />

                        <InfoItem
                            label="HTTP method"
                            value={item.http_method}
                        />

                        <InfoItem
                            label="HTTP response"
                            value={
                                item.http_status != null
                                    ? `HTTP ${item.http_status}`
                                    : "Not recorded"
                            }
                        />

                        <InfoItem
                            label="Recorded at"
                            value={formatDate(
                                item.observed_at || item.created_at
                            )}
                        />
                    </div>

                    {item.endpoint && (
                        <div className="mt-5 border-t border-slate-200 pt-4">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Request endpoint
                            </p>

                            <p className="mt-2 break-all rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                                {item.endpoint}
                            </p>
                        </div>
                    )}

                    {hasMetadata && (
                        <div className="mt-5 border-t border-slate-200 pt-4">
                            <h4 className="text-sm font-semibold text-slate-800">
                                Technical details
                            </h4>

                            <p className="mt-1 text-xs leading-5 text-slate-500">
                                Recorded metadata for this provider interaction.
                            </p>

                            <pre className="mt-3 max-h-96 overflow-auto rounded-xl border border-slate-800 bg-slate-950 p-4 text-xs leading-6 text-slate-200">
                                {safeJson(item.metadata)}
                            </pre>
                        </div>
                    )}

                    {!hasDetails && (
                        <p className="mt-4 text-sm text-slate-500">
                            No additional technical details were recorded.
                        </p>
                    )}
                </div>
            )}
        </article>
    );
};

/* -------------------------------------------------------
   Main report page
------------------------------------------------------- */

export default function VerificationReportPage() {
    const { runId } = useParams();

    const {
        runDetails,
        loading,
        error,
        loadRunDetails,
    } = useCapabilityVerification();

    const [activeTab, setActiveTab] = useState("operations");

    useEffect(() => {
        if (runId) {
            loadRunDetails(runId).catch(() => {});
        }
    }, [runId, loadRunDetails]);

    const run = runDetails;

    const checks = Array.isArray(run?.checks) ? run.checks : [];
    const evidence = Array.isArray(run?.evidence) ? run.evidence : [];

    const status = run ? getStatus(run) : "UNVERIFIED";

    const checkCounts = useMemo(() => {
        const statuses = checks.map((item) =>
            String(item.status || "").toUpperCase()
        );

        return {
            total: checks.length,
            passed: statuses.filter((item) => item === "PASSED").length,
            failed: statuses.filter((item) => item === "FAILED").length,
            pending: statuses.filter((item) =>
                ["PENDING", "RUNNING"].includes(item)
            ).length,
        };
    }, [checks]);

    if (loading && !run) {
        return (
            <main className="mx-auto max-w-7xl px-5 py-16 text-center">
                <p className="text-sm text-slate-500">
                    Loading verification report...
                </p>
            </main>
        );
    }

    if (error && !run) {
        return (
            <main className="mx-auto max-w-4xl px-5 py-12">
                <Link
                    to="/verifications"
                    className="text-sm font-medium text-indigo-600 hover:text-indigo-800"
                >
                    ← Back to verification history
                </Link>

                <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-5">
                    <h1 className="font-semibold text-red-800">
                        Unable to load verification report
                    </h1>

                    <p className="mt-2 text-sm text-red-700">{error}</p>
                </div>
            </main>
        );
    }

    if (!run) return null;

    return (
        <main className="mx-auto w-full max-w-7xl px-5 py-8 sm:px-8">
            <Link
                to="/verifications"
                className="text-sm font-medium text-slate-500 transition hover:text-indigo-600"
            >
                ← Verification history
            </Link>

            {/* Report header */}
            <header className="mt-5 border-b border-slate-200 pb-7">
                <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600">
                            Verification report
                        </p>

                        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
                            {prettyLabel(run.provider)} verification
                        </h1>

                        <p className="mt-2 text-sm text-slate-500">
                            {prettyLabel(run.capability_code)} ·{" "}
                            {prettyLabel(run.environment)}
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        <Badge value={status} />

                        <button
                            type="button"
                            onClick={() => loadRunDetails(runId).catch(() => {})}
                            disabled={loading}
                            className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                        >
                            {loading ? "Refreshing..." : "Refresh"}
                        </button>
                    </div>
                </div>
            </header>

            {/* Overview */}
            <section className="border-b border-slate-200 py-8">
                <SectionHeading
                    eyebrow="01 / Overview"
                    title="Execution overview"
                    description="A summary of the provider, environment and execution state recorded for this Sandbox run."
                />

                <div className="grid grid-cols-1 gap-x-8 gap-y-6 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-2 sm:p-6 lg:grid-cols-4">
                    <InfoItem
                        label="Provider"
                        value={prettyLabel(run.provider)}
                    />

                    <InfoItem
                        label="Environment"
                        value={prettyLabel(run.environment)}
                    />

                    <InfoItem
                        label="Capability"
                        value={prettyLabel(run.capability_code)}
                    />

                    <InfoItem
                        label="Overall result"
                        value={prettyLabel(run.overall_status)}
                    />

                    <InfoItem
                        label="Execution state"
                        value={prettyLabel(run.execution_status)}
                    />

                    <InfoItem
                        label="Started"
                        value={formatDate(run.started_at)}
                    />

                    <InfoItem
                        label="Completed"
                        value={formatDate(run.completed_at)}
                    />

                    <InfoItem
                        label="Recorded"
                        value={formatDate(run.created_at)}
                    />
                </div>
            </section>

            {/* Results tabs */}
            <section className="py-8">
                <div className="border-b border-slate-200">
                    <div className="flex flex-wrap items-center gap-2 sm:gap-8">
                        <button
                            type="button"
                            onClick={() => setActiveTab("operations")}
                            className={`border-b-2 px-1 pb-4 pt-1 text-base font-medium transition ${
                                activeTab === "operations"
                                    ? "border-indigo-600 text-indigo-600"
                                    : "border-transparent text-slate-500 hover:text-slate-800"
                            }`}
                        >
                            Operation Results ({checks.length})
                        </button>

                        <button
                            type="button"
                            onClick={() => setActiveTab("evidence")}
                            className={`border-b-2 px-1 pb-4 pt-1 text-base font-medium transition ${
                                activeTab === "evidence"
                                    ? "border-indigo-600 text-indigo-600"
                                    : "border-transparent text-slate-500 hover:text-slate-800"
                            }`}
                        >
                            Evidence ({evidence.length})
                        </button>
                    </div>
                </div>

                {/* Operation Results tab */}
                {activeTab === "operations" && (
                    <div className="pt-7">
                        <SectionHeading
                            title="Operation Results"
                            description="A summary of each request made during the verification run, including its execution time and result."
                            count={checks.length}
                        />

                        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                            <SummaryItem
                                label="Total operations"
                                value={checkCounts.total}
                            />

                            <SummaryItem
                                label="Passed"
                                value={checkCounts.passed}
                                color="text-emerald-600"
                            />

                            <SummaryItem
                                label="Failed"
                                value={checkCounts.failed}
                                color="text-red-600"
                            />

                            <SummaryItem
                                label="Pending / running"
                                value={checkCounts.pending}
                                color="text-blue-600"
                            />
                        </div>

                        {checks.length === 0 ? (
                            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-5 py-12 text-center">
                                <h3 className="text-sm font-semibold text-slate-800">
                                    No operation results available
                                </h3>

                                <p className="mt-1.5 text-sm text-slate-500">
                                    No individual operation checks were recorded for this run.
                                </p>
                            </div>
                        ) : (
                            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                                <div className="hidden grid-cols-[minmax(0,1.5fr)_minmax(130px,1fr)_minmax(100px,0.7fr)_auto] gap-5 border-b border-slate-200 bg-slate-50 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 sm:grid">
                                    <span>Request / Operation</span>
                                    <span>Execution time</span>
                                    <span>Duration</span>
                                    <span className="text-right">Result</span>
                                </div>

                                {checks.map((check, index) => (
                                    <OperationRow
                                        key={
                                            check.id ||
                                            `${check.operation}-${index}`
                                        }
                                        check={check}
                                        index={index}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Evidence tab */}
                {activeTab === "evidence" && (
                    <div className="pt-7">
                        <SectionHeading
                            title="Execution Evidence"
                            description="Technical records captured during provider requests, including endpoints, HTTP responses and recorded metadata."
                            count={evidence.length}
                        />

                        {evidence.length === 0 ? (
                            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-5 py-12 text-center">
                                <h3 className="text-sm font-semibold text-slate-800">
                                    No evidence available
                                </h3>

                                <p className="mt-1.5 text-sm text-slate-500">
                                    No separate evidence records were saved for this run.
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {evidence.map((item, index) => (
                                    <EvidenceItem
                                        key={
                                            item.id ||
                                            `${item.operation}-${index}`
                                        }
                                        item={item}
                                        index={index}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </section>

            {/* Disclaimer */}
            <section className="border-t border-slate-200 py-6">
                <p className="text-xs leading-6 text-slate-500">
                    This report reflects the saved Sandbox execution evidence.
                    A successful Sandbox run does not, by itself, establish
                    production readiness, regulatory compliance or successful
                    live payments.
                </p>
            </section>
        </main>
    );
}
