
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import useIntegration from "../hook/useIntegration";

const FILTERS = [
  { label: "All integrations", value: "ALL" },
  { label: "Confirmed", value: "CONFIRMED" },
  { label: "Pending review", value: "PENDING" },
  { label: "Failed", value: "FAILED" },
];

const getStatus = (integration) => {
  const reviewStatus = String(
    integration?.reviewStatus || ""
  ).toUpperCase();

  const sourceStatus = String(
    integration?.sourceStatus || ""
  ).toUpperCase();

  if (sourceStatus === "FAILED") return "FAILED";
  if (reviewStatus === "CONFIRMED") return "CONFIRMED";
  if (reviewStatus === "PENDING") return "PENDING";

  return reviewStatus || sourceStatus || "UNKNOWN";
};

const formatDate = (value) => {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const getInitials = (value) => {
  if (!value) return "IN";

  return String(value)
    .split(/[\s_-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
};

function StatusBadge({ status }) {
  const styles = {
    CONFIRMED: "bg-emerald-50 text-emerald-700",
    PENDING: "bg-amber-50 text-amber-700",
    FAILED: "bg-rose-50 text-rose-700",
  };

  const labels = {
    CONFIRMED: "Confirmed",
    PENDING: "Pending review",
    FAILED: "Failed",
  };

  const style =
    styles[status] || "bg-slate-100 text-black-600";

  return (
    <span
      className={`inline-flex items-center gap-2 whitespace-nowrap rounded-md px-2.5 py-1.5 text-xs font-medium ${style}`}
    >

      {labels[status] || "Unknown"}
    </span>
  );
}

function SummaryItem({ label, value, description, valueColor }) {
  return (
    <div className="min-w-0 border-l border-slate-200 pl-5 first:border-0 first:pl-0">
      <p className="text-xs font-medium uppercase tracking-wide text-black-500">
        {label}
      </p>

      <div className="mt-2 flex items-baseline gap-2">
        <p
          className={`text-3xl font-medium tracking-tight ${
            valueColor || "text-black-900"
          }`}
        >
          {value}
        </p>

        <p className="hidden text-xs text-black-400 sm:block">
          {description}
        </p>
      </div>

      <p className="mt-1 text-xs text-black-400 sm:hidden">
        {description}
      </p>
    </div>
  );
}

function IntegrationIdentity({ integration }) {
  const filename =
    integration.originalFilename || "Untitled integration";

  const projectName =
    integration.projectName || "Project not available";

  return (
    <div className="flex min-w-0 items-start gap-3">
      

      <div className="min-w-0">
        <p
          className="truncate text-sm font-medium text-black-900"
          title={filename}
        >
          {filename}
        </p>

        <p
          className="mt-1 truncate text-xs text-black-500"
          title={projectName}
        >
          {projectName}
        </p>
      </div>
    </div>
  );
}

function EmptyState({ hasSearch, onReset }) {
  return (
    <div className="flex flex-col items-center justify-center px-5 py-20 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-black-500">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className="h-6 w-6"
          aria-hidden="true"
        >
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="M7 8h10M7 12h6M7 16h4" />
        </svg>
      </div>

      <h3 className="mt-4 text-base font-semibold text-black-900">
        {hasSearch
          ? "No matching integrations"
          : "No integrations yet"}
      </h3>

      <p className="mt-1 max-w-sm text-sm leading-6 text-black-500">
        {hasSearch
          ? "Try changing your search or selected status filter."
          : "Integration profiles created from your project workspaces will appear here."}
      </p>

      {hasSearch && (
        <button
          type="button"
          onClick={onReset}
          className="mt-4 text-sm font-semibold text-indigo-600 hover:text-indigo-800"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}

export default function IntegrationsPage() {
  const navigate = useNavigate();

  const {
    integrations = [],
    loading,
    error,
    loadAllIntegrations,
  } = useIntegration();

  const records = Array.isArray(integrations)
    ? integrations
    : [];

  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("ALL");

  const refresh = useCallback(async () => {
    try {
      await loadAllIntegrations();
    } catch {
      // The hook maintains the API error message.
    }
  }, [loadAllIntegrations]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const summary = useMemo(() => {
    return {
      total: records.length,
      confirmed: records.filter(
        (item) => getStatus(item) === "CONFIRMED"
      ).length,
      pending: records.filter(
        (item) => getStatus(item) === "PENDING"
      ).length,
      failed: records.filter(
        (item) => getStatus(item) === "FAILED"
      ).length,
    };
  }, [records]);

  const filteredIntegrations = useMemo(() => {
    const query = search.trim().toLowerCase();

    return records.filter((item) => {
      const status = getStatus(item);

      const matchesFilter =
        activeFilter === "ALL" ||
        status === activeFilter;

      const searchable = [
        item.originalFilename,
        item.projectName,
        item.projectProvider,
        item.projectIntegrationType,
        item.sourceType,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch =
        !query || searchable.includes(query);

      return matchesFilter && matchesSearch;
    });
  }, [records, search, activeFilter]);

  const clearFilters = () => {
    setSearch("");
    setActiveFilter("ALL");
  };

  const openReport = (integrationId) => {
    if (!integrationId) return;

    navigate(`/integrations/${integrationId}`);
  };

  const hasFilters =
    search.trim().length > 0 || activeFilter !== "ALL";

  return (
    <main className="min-h-full bg-[#f7f9fc] text-black-900">
      <div className="mx-auto w-full max-w-[1500px] px-5 py-7 sm:px-7 lg:px-9">

        {/* Page Header */}
        <header className="flex flex-col justify-between gap-5 border-b border-slate-200 pb-5 sm:flex-row sm:items-center">
          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-black-600">
              Payment Intelligence
            </p>

            <h1 className="text-2xl font-medium tracking-tight text-black-900">
              Integrations
            </h1>

            <p className="mt-1.5 text-sm text-black-500">
              A central view of the payment integrations analysed across your accessible projects.
            </p>
          </div>

         
        </header>

        {/* Summary */}
        <section className="mt-7">
          <div className="grid grid-cols-2 gap-x-5 gap-y-7 sm:grid-cols-4 sm:gap-0">
            <SummaryItem
              label="Total integrations"
              value={summary.total}
              description="Across accessible projects"
            />

            <SummaryItem
              label="Confirmed"
              value={summary.confirmed}
              description="Profiles reviewed and confirmed"
              valueColor="text-black-900"
            />

            <SummaryItem
              label="Pending review"
              value={summary.pending}
              description="Awaiting confirmation"
              valueColor="text-amber-700"
            />

            <SummaryItem
              label="Failed"
              value={summary.failed}
              description="Source processing failed"
              valueColor="text-black-400"
            />
          </div>
        </section>

        {/* Search and Filters */}
        <section className="mt-8">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">

            <div className="relative w-full lg:max-w-md">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black-400"
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
                placeholder="Search by filename, project or provider..."
                className="h-10 w-full rounded-md border border-slate-200 bg-white pl-9 pr-3 text-sm text-black-800 outline-none transition placeholder:text-black-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/10"
              />
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {FILTERS.map((filter) => {
                const active =
                  activeFilter === filter.value;

                const count =
                  filter.value === "ALL"
                    ? summary.total
                    : filter.value === "CONFIRMED"
                    ? summary.confirmed
                    : filter.value === "PENDING"
                    ? summary.pending
                    : summary.failed;

                return (
                  <button
                    key={filter.value}
                    type="button"
                    onClick={() =>
                      setActiveFilter(filter.value)
                    }
                    className={`rounded-md px-3 py-2 text-xs font-medium transition ${
                      active
                        ? "bg-slate-900 text-white"
                        : "text-black-500 hover:bg-slate-100 hover:text-black-800"
                    }`}
                  >
                    {filter.label}{" "}
                    <span className={active ? "text-white/70" : "text-black-400"}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* API Error */}
        {error && (
          <div
            role="alert"
            className="mt-5 flex flex-col gap-3 rounded-md border border-rose-200 bg-rose-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="text-sm font-semibold text-rose-800">
                Unable to load integrations
              </p>

              <p className="mt-1 text-sm text-rose-600">
                {typeof error === "string"
                  ? error
                  : error?.message || "An unexpected error occurred."}
              </p>
            </div>

            <button
              type="button"
              onClick={refresh}
              className="text-left text-sm font-semibold text-rose-700 hover:text-rose-900"
            >
              Try again
            </button>
          </div>
        )}

        {/* Loading */}
        {loading && records.length === 0 && (
          <div className="mt-5">
            {[1, 2, 3, 4].map((item) => (
              <div
                key={item}
                className="flex animate-pulse items-center gap-4 border-b border-slate-200 px-4 py-6"
              >
                <div className="h-10 w-10 rounded-md bg-slate-200" />

                <div className="flex-1 space-y-2">
                  <div className="h-4 w-48 rounded bg-slate-200" />
                  <div className="h-3 w-36 rounded bg-slate-100" />
                </div>

                <div className="h-6 w-20 rounded-md bg-slate-100" />
              </div>
            ))}
          </div>
        )}

        {/* Desktop Integration Table */}
        {!loading && (
          <section className="mt-5 hidden md:block">
            {filteredIntegrations.length > 0 ? (
              <div className="w-full overflow-x-auto">
                <table className="w-full min-w-[760px] border-collapse text-left">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="px-4 py-4 text-[11px] font-semibold uppercase tracking-wider text-black-500">
                        Integration
                      </th>

                      <th className="px-4 py-4 text-[11px] font-semibold uppercase tracking-wider text-black-500">
                        Source
                      </th>

                      <th className="px-4 py-4 text-[11px] font-semibold uppercase tracking-wider text-black-500">
                        Status
                      </th>

                      <th className="px-4 py-4 text-[11px] font-semibold uppercase tracking-wider text-black-500">
                        Created
                      </th>

                      <th className="px-4 py-4 text-right text-[11px] font-semibold uppercase tracking-wider text-black-500">
                        Report
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-200/80">
                    {filteredIntegrations.map((item) => (
                      <tr
                        key={item.id}
                        className="transition-colors hover:bg-white/70"
                      >
                        <td className="px-4 py-5">
                          <IntegrationIdentity
                            integration={item}
                          />
                        </td>

                        <td className="px-4 py-5">
                          <span className="inline-flex rounded-md border border-slate-200 bg-slate-100 px-2.5 py-1.5 text-xs font-medium uppercase text-black-600">
                            {item.sourceType || "—"}
                          </span>
                        </td>

                        <td className="px-4 py-5">
                          <StatusBadge
                            status={getStatus(item)}
                          />
                        </td>

                        <td className="px-4 py-5 text-sm text-black-500">
                          {formatDate(item.createdAt)}
                        </td>

                        <td className="px-4 py-5 text-right">
                          <button
                            type="button"
                            onClick={() => openReport(item.id)}
                            disabled={!item.id}
                            className="inline-flex items-center gap-2 whitespace-nowrap text-sm font-medium  text-black-600 transition hover:text-indigo-800 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            View report

                            <span aria-hidden="true">
                              →
                            </span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="flex items-center justify-between border-t border-slate-200 px-4 py-4">
                  <p className="text-xs text-black-500">
                    Showing {filteredIntegrations.length} of{" "}
                    {summary.total} records
                  </p>

                  <p className="text-xs text-black-400">
                    Integration profiles are grouped by their source project
                  </p>
                </div>
              </div>
            ) : (
              <EmptyState
                hasSearch={hasFilters}
                onReset={clearFilters}
              />
            )}
          </section>
        )}

        {/* Mobile Integration Records */}
        {!loading && (
          <section className="mt-5 space-y-4 md:hidden">
            {filteredIntegrations.length > 0 ? (
              filteredIntegrations.map((item) => (
                <article
                  key={item.id}
                  className="border-b border-slate-200 py-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <IntegrationIdentity
                      integration={item}
                    />

                    <StatusBadge
                      status={getStatus(item)}
                    />
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-4 border-t border-slate-200 pt-4">
                    <div>
                      <p className="text-xs text-black-400">
                        Source type
                      </p>

                      <p className="mt-1 text-sm font-medium text-black-700">
                        {item.sourceType || "—"}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-black-400">
                        Created
                      </p>

                      <p className="mt-1 text-sm font-medium text-black-700">
                        {formatDate(item.createdAt)}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => openReport(item.id)}
                    disabled={!item.id}
                    className="mt-4 flex w-full items-center justify-center gap-2 rounded-md border border-slate-200 bg-white py-3 text-sm font-semibold text-indigo-600 transition hover:bg-slate-50 disabled:opacity-50"
                  >
                    Open integration report
                    <span aria-hidden="true">→</span>
                  </button>
                </article>
              ))
            ) : (
              <EmptyState
                hasSearch={hasFilters}
                onReset={clearFilters}
              />
            )}
          </section>
        )}

        {/* Record Count */}
        {!loading && filteredIntegrations.length > 0 && (
          <div className="mt-4 flex items-center justify-between text-xs text-black-400 md:hidden">
            <span>
              Showing {filteredIntegrations.length} of {summary.total} records
            </span>
          </div>
        )}
      </div>
    </main>
  );
}
