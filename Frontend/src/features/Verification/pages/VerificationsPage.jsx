
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
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

const getStatus = (run) => {
    const execution = String(run.execution_status || "").toUpperCase();
    const overall = String(run.overall_status || "").toUpperCase();

    // Explicit failure takes priority over execution completion.
    if (execution === "RUNNING") return "RUNNING";
    if (execution === "AWAITING_APPROVAL") return "AWAITING APPROVAL";

    if (
        execution === "FAILED" ||
        overall === "FAILED"
    ) {
        return "FAILED";
    }

    if (execution === "SKIPPED") return "SKIPPED";

    if (overall === "VERIFIED") return "VERIFIED";

    return "UNVERIFIED";
};

const statusStyles = {
    VERIFIED: "bg-emerald-50 text-emerald-700",
    FAILED: "bg-red-50 text-red-700",
    RUNNING: "bg-blue-50 text-blue-700",
    "AWAITING APPROVAL": "bg-amber-50 text-amber-700",
    SKIPPED: "bg-slate-100 text-black-600",
    UNVERIFIED: "bg-slate-100 text-black-600",
};

const StatusBadge = ({ status }) => (
    <span
        className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1.5 text-xs font-medium ${
            statusStyles[status] || statusStyles.UNVERIFIED
        }`}
    >
  
        {status}
    </span>
);

const SummaryItem = ({
    label,
    value,
    color = "text-black-900",
    description,
}) => (
    <div className="min-w-0 border-l border-slate-200 pl-5 first:border-0 first:pl-0">
        <p className="text-xs font-medium uppercase tracking-wide text-black-500">
            {label}
        </p>

        <p className={`mt-2 text-3xl font-medium tracking-tight ${color}`}>
            {value}
        </p>

        {description && (
            <p className="mt-1 text-xs text-black-400">
                {description}
            </p>
        )}
    </div>
);

export default function VerificationsPage() {
    const {
        runs = [],
        loading,
        error,
        loadAllRuns,
    } = useCapabilityVerification();

    const verificationRuns = Array.isArray(runs) ? runs : [];

    const [search, setSearch] = useState("");
    const [filter, setFilter] = useState("ALL");

    // Load verification history automatically.
    useEffect(() => {
        loadAllRuns().catch(() => {});
    }, [loadAllRuns]);

    // Summary counts
    const counts = useMemo(() => {
        const statuses = verificationRuns.map(getStatus);

        return {
            total: verificationRuns.length,
            verified: statuses.filter(
                (item) => item === "VERIFIED"
            ).length,
            failed: statuses.filter(
                (item) => item === "FAILED"
            ).length,
            active: statuses.filter(
                (item) =>
                    item === "RUNNING" ||
                    item === "AWAITING APPROVAL"
            ).length,
            awaitingApproval: statuses.filter(
                (item) => item === "AWAITING APPROVAL"
            ).length,
            unverified: statuses.filter(
                (item) => item === "UNVERIFIED"
            ).length,
        };
    }, [verificationRuns]);

    // Search and filter
    const filteredRuns = useMemo(() => {
        const term = search.trim().toLowerCase();

        return verificationRuns.filter((run) => {
            const status = getStatus(run);

            const matchesFilter =
                filter === "ALL" || status === filter;

            const searchable = [
                run.project_name,
                run.original_filename,
                run.provider,
                run.environment,
                run.capability_code,
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();

            const matchesSearch =
                !term || searchable.includes(term);

            return matchesFilter && matchesSearch;
        });
    }, [verificationRuns, search, filter]);

    const filters = [
        {
            label: "All",
            value: "ALL",
            count: counts.total,
        },
        {
            label: "Verified",
            value: "VERIFIED",
            count: counts.verified,
        },
        {
            label: "Failed",
            value: "FAILED",
            count: counts.failed,
        },
        {
            label: "Running",
            value: "RUNNING",
            count: verificationRuns.filter(
                (run) => getStatus(run) === "RUNNING"
            ).length,
        },
        {
            label: "Awaiting approval",
            value: "AWAITING APPROVAL",
            count: counts.awaitingApproval,
        },
        {
            label: "Unverified",
            value: "UNVERIFIED",
            count: counts.unverified,
        },
    ];

    const clearFilters = () => {
        setSearch("");
        setFilter("ALL");
    };

    const hasFilters =
        search.trim().length > 0 || filter !== "ALL";

    return (
        <main className="min-h-full bg-[#f7f9fc]">
            <div className="mx-auto w-full max-w-[1500px] px-5 py-7 sm:px-7 lg:px-9">

                {/* Page Header */}
                <header className="mb-6 border-b border-slate-200 pb-5">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-black-600">
                        Payment Verification
                    </p>

                    <h1 className="mt-2 text-2xl font-medium tracking-tight text-black-900">
                        Verification history
                    </h1>

                    <p className="mt-1.5 text-sm text-black-500">
                        Review Sandbox execution results across your accessible projects.
                    </p>
                </header>

                {/* Summary Metrics */}
                <section className="mb-8">
                    <div className="grid grid-cols-2 gap-x-5 gap-y-7 sm:grid-cols-4 sm:gap-0">
                        <SummaryItem
                            label="Total runs"
                            value={counts.total}
                            description="Across accessible projects"
                        />

                        <SummaryItem
                            label="Verified"
                            value={counts.verified}
                            color="text-emerald-600"
                            description="Successfully verified"
                        />

                        <SummaryItem
                            label="Failed"
                            value={counts.failed}
                            color="text-red-600"
                            description="Failed verification runs"
                        />

                        <SummaryItem
                            label="In progress"
                            value={counts.active}
                            color="text-blue-600"
                            description="Running or awaiting approval"
                        />
                    </div>
                </section>

                {/* Search and Filters */}
                <section className="mb-5">
                    <div className="flex flex-col gap-4">

                        {/* Search */}
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                            <div className="relative w-full lg:max-w-md">
                                <svg
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="1.7"
                                    className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black-400"
                                    aria-hidden="true"
                                >
                                    <circle cx="11" cy="11" r="7" />
                                    <path d="m16 16 4 4" />
                                </svg>

                                <input
                                    type="search"
                                    value={search}
                                    onChange={(event) =>
                                        setSearch(event.target.value)
                                    }
                                    placeholder="Search project, provider or capability..."
                                    className="h-10 w-full rounded-md border border-slate-200 bg-white pl-9 pr-3 text-sm text-black-700 outline-none transition placeholder:text-black-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/10"
                                />
                            </div>

                            <p className="text-xs text-black-400">
                                {filteredRuns.length} of {verificationRuns.length} runs
                            </p>
                        </div>

                        {/* Status Filters */}
                        <div className="flex flex-wrap items-center gap-1.5">
                            {filters.map((item) => (
                                <button
                                    key={item.value}
                                    type="button"
                                    onClick={() => setFilter(item.value)}
                                    className={`rounded-md px-3 py-2 text-xs font-medium transition ${
                                        filter === item.value
                                            ? "bg-slate-900 text-white"
                                            : "text-black-500 hover:bg-slate-100 hover:text-black-800"
                                    }`}
                                >
                                    {item.label}

                                    <span
                                        className={`ml-1.5 ${
                                            filter === item.value
                                                ? "text-white/70"
                                                : "text-black-400"
                                        }`}
                                    >
                                        {item.count}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Error State */}
                {error && (
                    <div
                        role="alert"
                        className="mb-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                    >
                        {typeof error === "string"
                            ? error
                            : error?.message || "Unable to load verification history."}
                    </div>
                )}

                {/* Verification Table */}
                <section className="w-full overflow-x-auto">

                    {loading && verificationRuns.length === 0 ? (
                        <div className="divide-y divide-slate-200">
                            {[1, 2, 3, 4].map((item) => (
                                <div
                                    key={item}
                                    className="flex animate-pulse items-center gap-5 py-6"
                                >
                                    <div className="h-4 w-28 rounded bg-slate-200" />

                                    <div className="h-4 flex-1 rounded bg-slate-100" />

                                    <div className="h-5 w-20 rounded bg-slate-200" />

                                    <div className="h-4 w-24 rounded bg-slate-100" />
                                </div>
                            ))}
                        </div>
                    ) : filteredRuns.length === 0 ? (
                        /* Empty State */
                        <div className="py-20 text-center">
                            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-md border border-slate-200 bg-white text-black-500">
                                <svg
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="1.7"
                                    className="h-6 w-6"
                                    aria-hidden="true"
                                >
                                    <circle cx="11" cy="11" r="7" />
                                    <path d="m16 16 4 4" />
                                </svg>
                            </div>

                            <h3 className="mt-4 text-base font-semibold text-black-900">
                                {hasFilters
                                    ? "No matching verification runs"
                                    : "No verification runs found"}
                            </h3>

                            <p className="mt-1.5 text-sm text-black-500">
                                {hasFilters
                                    ? "Try changing your search or status filter."
                                    : "Completed and in-progress verification runs will appear here."}
                            </p>

                            {hasFilters && (
                                <button
                                    type="button"
                                    onClick={clearFilters}
                                    className="mt-4 text-sm font-semibold text-indigo-600 hover:text-indigo-800"
                                >
                                    Clear filters
                                </button>
                            )}
                        </div>
                    ) : (
                        <table className="w-full min-w-[950px] border-collapse text-left">

                            {/* Table Header */}
                            <thead>
                                <tr className="border-b border-slate-200">
                                    <th className="px-4 py-4 text-[11px] font-bold uppercase tracking-wider text-black-500">
                                        Provider / Capability
                                    </th>

                                    <th className="px-4 py-4 text-[11px] font-bold uppercase tracking-wider text-black-500">
                                        Project & Source
                                    </th>

                                    <th className="px-4 py-4 text-[11px] font-bold uppercase tracking-wider text-black-500">
                                        Environment
                                    </th>

                                    <th className="px-4 py-4 text-[11px] font-bold uppercase tracking-wider text-black-500">
                                        Status
                                    </th>

                                    <th className="px-4 py-4 text-[11px] font-bold uppercase tracking-wider text-black-500">
                                        Started
                                    </th>

                                    <th className="px-4 py-4 text-right text-[11px] font-bold uppercase tracking-wider text-black-500">
                                        Report
                                    </th>
                                </tr>
                            </thead>

                            {/* Table Body */}
                            <tbody className="divide-y divide-slate-200/80">
                                {filteredRuns.map((run) => {
                                    const status = getStatus(run);

                                    return (
                                        <tr
                                            key={run.id}
                                            className="transition-colors hover:bg-white/70"
                                        >
                                            {/* Provider / Capability */}
                                            <td className="px-4 py-5">
                                                <p className="text-sm font-medium   text-black-900">
                                                    {run.provider || "Provider unavailable"}
                                                </p>

                                                <p className="mt-1 text-xs font-medium text-black-500">
                                                    {run.capability_code || "Capability not specified"}
                                                </p>
                                            </td>

                                            {/* Project and Source */}
                                            <td className="px-4 py-5">
                                                <p className="text-sm font-medium text-black-800">
                                                    {run.project_name || "Project"}
                                                </p>

                                                {run.original_filename && (
                                                    <p
                                                        className="mt-1 max-w-xs truncate font-mono text-xs text-black-500"
                                                        title={run.original_filename}
                                                    >
                                                        {run.original_filename}
                                                    </p>
                                                )}
                                            </td>

                                            {/* Environment */}
                                            <td className="px-4 py-5">
                                                <span className="text-xs font-medium uppercase tracking-wide text-black-600">
                                                    {run.environment || "—"}
                                                </span>
                                            </td>

                                            {/* Status */}
                                            <td className="px-4 py-5">
                                                <StatusBadge status={status} />
                                            </td>

                                            {/* Started */}
                                            <td className="px-4 py-5 text-xs text-black-500">
                                                {formatDate(
                                                    run.started_at || run.created_at
                                                )}
                                            </td>

                                            {/* Report */}
                                            <td className="px-4 py-5 text-right">
                                                <Link
                                                    to={`/verifications/${run.id}`}
                                                    className="inline-flex items-center gap-2 whitespace-nowrap text-sm font-medium text-black-600 transition hover:text-indigo-800"
                                                >
                                                    View report

                                                    <span aria-hidden="true">
                                                        →
                                                    </span>
                                                </Link>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </section>

                {/* Table Footer */}
                {!loading && filteredRuns.length > 0 && (
                    <footer className="flex flex-col justify-between gap-2 border-t border-slate-200 px-4 py-4 sm:flex-row sm:items-center">
                        <p className="text-xs text-black-500">
                            Showing {filteredRuns.length} of {verificationRuns.length} verification runs
                        </p>

                        <p className="text-xs text-black-400">
                            Sorted by latest verification activity
                        </p>
                    </footer>
                )}
            </div>
        </main>
    );
}
