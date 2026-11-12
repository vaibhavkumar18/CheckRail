import { Link } from "react-router-dom";

import useDashboard from "../hook/useDashboard";
import usePermissions from "../../../core/permissions/usePermissions";
import { PERMISSIONS } from "../../../core/permissions/permissions";

const formatDate = (value) => {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const normalizeProvider = (provider) => {
  if (!provider) return "—";

  if (typeof provider === "object") {
    return provider.name || provider.provider || "—";
  }

  return provider;
};



const Metric = ({
  label,
  value,
  description,
  color = "text-slate-900",
  to,
}) => {
  const content = (
    <div className="min-w-0 border-l border-slate-200 pl-5 first:border-0 first:pl-0">
      <div className="flex items-center gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-black-500">
          {label}
        </p>

        {to && (
          <span className="text-[10px] font-medium text-black-600">View →</span>
        )}
      </div>

      <p className={`mt-2 text-3xl font-normal tracking-tight ${color}`}>
        {value}
      </p>

      <p className="mt-1 text-[11px] text-black-400">{description}</p>
    </div>
  );

  return to ? (
    <Link to={to} className="block transition hover:opacity-80">
      {content}
    </Link>
  ) : (
    content
  );
};

const ProviderBadge = ({ provider }) => {
  const isPayPal = String(provider).toLowerCase().includes("paypal");

  return (
    <span
      className={`inline-flex rounded-sm border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${
        isPayPal
          ? "border-sky-100 bg-sky-50 text-sky-700"
          : "border-slate-200 bg-slate-100 text-slate-700"
      }`}
    >
      {provider}
    </span>
  );
};

const EmptyProjects = () => (
  <div className="py-16 text-center">
    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        className="h-6 w-6"
        aria-hidden="true"
      >
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M7 8h10M7 12h6M7 16h4" />
      </svg>
    </div>

    <h3 className="mt-4 text-base font-semibold text-slate-800">
      No projects yet
    </h3>

    <p className="mt-1.5 text-sm text-slate-500">
      Projects accessible through your organizations will appear here.
    </p>

    <Link
      to="/projects"
      className="mt-4 inline-flex text-sm font-semibold text-indigo-600 hover:text-indigo-800"
    >
      View projects →
    </Link>
  </div>
);

const DashboardPage = () => {
  const { data, loading, error, refetch } = useDashboard();

  const { hasPermission } = usePermissions();

  const canViewOrganizations = hasPermission(PERMISSIONS.ORGANIZATION_VIEW);

  const recentProjects = Array.isArray(data?.recentProjects)
    ? data.recentProjects
    : [];

  const organizationCount = data?.organizationCount ?? 0;
  const projectCount = data?.projectCount ?? 0;

  const providerCount = new Set(
    recentProjects
      .map((project) => String(project.provider || "").toLowerCase())
      .filter(Boolean),
  ).size;

  if (loading) {
    return (
      <main className="min-h-full bg-[#f7f9fc] px-5 py-8 sm:px-7 lg:px-9">
        <div className="mx-auto max-w-[1500px] animate-pulse">
          <div className="h-3 w-24 rounded bg-slate-200" />
          <div className="mt-3 h-8 w-44 rounded bg-slate-200" />
          <div className="mt-2 h-4 w-80 max-w-full rounded bg-slate-100" />

          <div className="mt-10 grid grid-cols-2 gap-6 border-y border-slate-200 py-7 sm:grid-cols-4">
            {[1, 2, 3, 4].map((item) => (
              <div key={item}>
                <div className="h-3 w-24 rounded bg-slate-200" />
                <div className="mt-3 h-8 w-12 rounded bg-slate-200" />
                <div className="mt-2 h-3 w-32 rounded bg-slate-100" />
              </div>
            ))}
          </div>

          <div className="mt-10 h-5 w-48 rounded bg-slate-200" />

          {[1, 2, 3, 4].map((item) => (
            <div key={item} className="mt-6 h-14 border-b border-slate-200" />
          ))}

          <p className="mt-8 text-center text-sm text-slate-500">
            Loading CheckRail dashboard...
          </p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-full bg-[#f7f9fc] px-5 py-8 sm:px-7 lg:px-9">
        <div className="mx-auto max-w-[1500px]">
          <div className="border-b border-slate-200 pb-5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-indigo-600">
              Workspace
            </p>

            <h1 className="mt-2 text-2xl font-bold text-slate-900">
              Dashboard
            </h1>

            <p className="mt-1.5 text-sm text-slate-500">
              Your CheckRail workspace at a glance.
            </p>
          </div>

          <div className="mt-8 border-l-4 border-red-400 bg-white px-5 py-5">
            <h2 className="text-sm font-semibold text-red-700">
              Dashboard could not be loaded
            </h2>

            <p className="mt-2 text-sm text-slate-600">
              {typeof error === "string"
                ? error
                : error?.message || "An unexpected error occurred."}
            </p>

            <button
              type="button"
              onClick={refetch}
              className="mt-4 rounded-md bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Try again
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-full bg-[#f7f9fc] text-slate-900">
      <div className="mx-auto w-full max-w-[1500px] px-5 py-7 sm:px-7 lg:px-9">
        {/* Dashboard Header */}
        <header className="border-b border-slate-200 pb-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-[10px] font-normal uppercase tracking-wider text-slate-500">
                <span>Workspace</span>
                <span className="text-slate-300">/</span>
                <span className="text-indigo-600">Dashboard</span>
              </div>

              <h1 className="mt-2 text-2xl font-medium tracking-tight text-slate-900">
                Dashboard
              </h1>

              <p className="mt-1.5 max-w-2xl text-sm text-black-500">
                Your CheckRail workspace overview. Monitor organizations,
                payment integration projects, and provider configurations.
              </p>
            </div>

            <span className="inline-flex items-center gap-2 rounded-md border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
              Workspace active
            </span>
          </div>
        </header>

        {/* Dashboard Metrics */}
        <section className="border-b border-slate-200 py-6">
          <div className="grid grid-cols-2 gap-x-6 gap-y-7 sm:grid-cols-4 sm:gap-0">
            {canViewOrganizations && (
              <Metric
                label="Organizations"
                value={organizationCount}
                description="Accessible workspaces"
                to="/organizations"
              />
            )}

            <Metric
              label="Projects"
              value={projectCount}
              description="Payment integration projects"
              to="/projects"
            />

            <Metric
              label="Recent projects"
              value={recentProjects.length}
              description="Returned by dashboard API"
            />

            <Metric
              label="Providers"
              value={providerCount}
              description="In recent project records"
            />
          </div>
        </section>

        {/* Projects Table */}
        <section className="mt-8">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Recent Projects
              </h2>

              <p className="mt-1 text-sm text-black-500">
                Your latest payment integration projects across accessible
                organizations.
              </p>
            </div>

            <Link
              to="/projects"
              className="inline-flex items-center gap-2 text-sm font-medium text-black-60 transition hover:text-indigo-800"
            >
              View all projects
              <span aria-hidden="true">→</span>
            </Link>
          </div>

          <div className="mt-5 overflow-x-auto">
            {recentProjects.length === 0 ? (
              <EmptyProjects />
            ) : (
              <table className="w-full min-w-[850px] border-collapse text-left">
                <thead>
                  <tr className="border-y border-slate-200">
                    <th className="w-[32%] px-4 py-4 text-[11px] font-semibold uppercase tracking-wider text-black-500">
                      Project
                    </th>

                    <th className="px-4 py-4 text-[11px] font-semibold uppercase tracking-wider text-black-500">
                      Provider / Engine
                    </th>

                    <th className="px-4 py-4 text-[11px] font-semibold uppercase tracking-wider text-black-500">
                      Organization
                    </th>

                    <th className="px-4 py-4 text-[11px] font-semibold uppercase tracking-wider text-black-500">
                      Corridor
                    </th>

                    <th className="px-4 py-4 text-[11px] font-semibold uppercase tracking-wider text-black-500">
                      Last updated
                    </th>

                    <th className="px-4 py-4 text-right text-[11px] font-semibold uppercase tracking-wider text-black-500">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-200/80">
                  {recentProjects.map((project) => {
                    const provider = normalizeProvider(project.provider);

                    const corridor =
                      project.targetCountry ||
                      project.target_country ||
                      project.sourceCountry ||
                      project.source_country ||
                      "—";

                    return (
                      <tr
                        key={project.id}
                        className="transition-colors hover:bg-white/70"
                      >
                        <td className="px-4 py-5">
                          <div className="flex items-center gap-3">
                            <div className="min-w-0">
                              <p
                                className="max-w-[340px] truncate text-sm font-semibold text-slate-900"
                                title={project.name}
                              >
                                {project.name || "Untitled project"}
                              </p>

                              <p className="mt-1 max-w-[340px] truncate text-xs text-black-500">
                                {project.description ||
                                  "Payment integration project"}
                              </p>

                              <p className="mt-1 text-[11px] text-black-400">
                                Updated{" "}
                                {formatDate(
                                  project.updatedAt || project.updated_at,
                                )}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-5">
                          <ProviderBadge provider={provider} />
                        </td>

                        <td className="px-4 py-5 text-sm font-medium text-slate-700">
                          {project.organizationName ||
                            project.organization_name ||
                            "—"}
                        </td>

                        <td className="px-4 py-5">
                          <span className="inline-flex rounded-sm border border-slate-200 bg-white px-2.5 py-1.5 text-[10px] font-medium uppercase tracking-wide text-black-600">
                            {corridor}
                          </span>
                        </td>

                        <td className="px-4 py-5 text-xs text-black-500">
                          {formatDate(project.updatedAt || project.updated_at)}
                        </td>

                        <td className="px-4 py-5 text-right">
                          <Link
                            to={`/projects/${project.id}`}
                            className="inline-flex items-center gap-2 whitespace-nowrap text-sm font-medium text-black-600 transition hover:text-indigo-800"
                          >
                            Open
                            <span aria-hidden="true">→</span>
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Table Footer */}
          {recentProjects.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 px-4 py-4">
              <p className="text-xs text-slate-500">
                Showing {recentProjects.length} recent projects
              </p>

              <Link
                to="/projects"
                className="text-xs font-medium text-black-600 hover:text-indigo-800"
              >
                All projects →
              </Link>
            </div>
          )}
        </section>

        {/* Dashboard Footer */}
        <footer className="mt-10 flex flex-col justify-between gap-2 border-t border-slate-200 py-4 sm:flex-row sm:items-center">
          <p className="text-[11px] text-black-400">
            CheckRail · Workspace Dashboard
          </p>

          <p className="text-[11px] text-black-400">
            Data shown from your accessible workspace records
          </p>
        </footer>
      </div>
    </main>
  );
};

export default DashboardPage;
