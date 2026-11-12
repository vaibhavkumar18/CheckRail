
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import useProjects from "../hook/useProjects";

const normalize = (value) =>
  String(value ?? "").trim().toLowerCase();

const getProvider = (project) => {
  const provider =
    project.provider ||
    project.provider_name ||
    project.engine;

  if (typeof provider === "object" && provider !== null) {
    return provider.name || provider.provider || "—";
  }

  return provider || "—";
};

const getIntegrationType = (project) =>
  project.integrationType ||
  project.integration_type ||
  project.corridor_type ||
  project.corridorType ||
  "—";

const getCountry = (project) =>
  project.targetCountry ||
  project.target_country ||
  project.sourceCountry ||
  project.source_country ||
  project.country ||
  "—";

const getStatus = (project) => {
  const value =
    project.status ||
    project.project_status ||
    project.verification_status;

  if (!value) return null;

  const normalized = normalize(value);

  if (["active", "ready", "completed", "verified"].includes(normalized)) {
    return {
      label: value,
      style: "bg-emerald-50 text-emerald-700",
      dot: "bg-emerald-500",
    };
  }

  if (["staging", "pending", "in_progress", "processing"].includes(normalized)) {
    return {
      label: value,
      style: "bg-amber-50 text-amber-700",
      dot: "bg-amber-500",
    };
  }

  if (["failed", "error", "blocked"].includes(normalized)) {
    return {
      label: value,
      style: "bg-red-50 text-red-700",
      dot: "bg-red-500",
    };
  }

  if (["verification", "not_verified", "draft"].includes(normalized)) {
    return {
      label: value,
      style: "bg-slate-100 text-black-600",
      dot: "bg-slate-400",
    };
  }

  return {
    label: value,
    style: "bg-slate-100 text-black-600",
    dot: "bg-slate-400",
  };
};

const getUpdatedDate = (project) =>
  project.updated_at ||
  project.updatedAt ||
  project.last_updated ||
  project.created_at ||
  project.createdAt ||
  null;

export default function ProjectsPage() {
  const {
    projects = [],
    loading,
    error,
    loadProjects,
  } = useProjects();

  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState("desc");

  const projectList = Array.isArray(projects) ? projects : [];

  useEffect(() => {
    loadProjects().catch(() => {});
  }, [loadProjects]);

  // Provider counts
  const providerCounts = useMemo(() => {
    const counts = {
      all: projectList.length,
      hyperwallet: 0,
      paypal: 0,
    };

    projectList.forEach((project) => {
      const provider = normalize(getProvider(project));

      if (provider.includes("hyperwallet")) {
        counts.hyperwallet += 1;
      }

      if (provider.includes("paypal")) {
        counts.paypal += 1;
      }
    });

    return counts;
  }, [projectList]);

  // Search, provider filtering and sorting
  const filteredProjects = useMemo(() => {
    const searchText = normalize(search);

    const result = projectList.filter((project) => {
      const provider = normalize(getProvider(project));

      const matchesSearch =
        !searchText ||
        normalize(project.name).includes(searchText) ||
        normalize(project.description).includes(searchText) ||
        provider.includes(searchText) ||
        normalize(project.organization_name).includes(searchText) ||
        normalize(getIntegrationType(project)).includes(searchText) ||
        normalize(getCountry(project)).includes(searchText);

      const matchesProvider =
        activeFilter === "all" ||
        (activeFilter === "hyperwallet" &&
          provider.includes("hyperwallet")) ||
        (activeFilter === "paypal" &&
          provider.includes("paypal"));

      return matchesSearch && matchesProvider;
    });

    return [...result].sort((a, b) => {
      const dateA = getUpdatedDate(a);
      const dateB = getUpdatedDate(b);

      if (!dateA && !dateB) return 0;
      if (!dateA) return 1;
      if (!dateB) return -1;

      const timestampA = new Date(dateA).getTime();
      const timestampB = new Date(dateB).getTime();

      if (Number.isNaN(timestampA) && Number.isNaN(timestampB)) return 0;
      if (Number.isNaN(timestampA)) return 1;
      if (Number.isNaN(timestampB)) return -1;

      return sortOrder === "desc"
        ? timestampB - timestampA
        : timestampA - timestampB;
    });
  }, [projectList, search, activeFilter, sortOrder]);

  const formatDate = (date) => {
    if (!date) return null;

    const parsed = new Date(date);

    if (Number.isNaN(parsed.getTime())) return null;

    return parsed.toLocaleDateString(undefined, {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const filters = [
    {
      id: "all",
      label: "All",
      count: providerCounts.all,
    },
    {
      id: "hyperwallet",
      label: "Hyperwallet",
      count: providerCounts.hyperwallet,
    },
    {
      id: "paypal",
      label: "PayPal",
      count: providerCounts.paypal,
    },
  ];

  return (
    <main className="min-h-full bg-[#f7f9fc]">
      <div className="mx-auto w-full max-w-[1500px] px-5 py-7 sm:px-7 lg:px-9">

        {/* Page Header */}
        <header className="mb-5 border-b border-slate-200 pb-5">
          <div className="flex flex-col gap-1">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-indigo-600">
              Workspace
            </p>

            <h1 className="text-2xl font-medium tracking-tight text-black-900">
              Projects
            </h1>

            <p className="text-xs text-black-500">
              Manage your marketplace payment integration projects.
            </p>
          </div>
        </header>

        {/* Search, Filters and Sorting */}
        <section className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">

          {/* Search */}
          <div className="relative w-full lg:max-w-sm">
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
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search projects..."
              className="h-10 w-full rounded-md border border-slate-200 bg-white pl-9 pr-3 text-sm text-black-700 outline-none transition placeholder:text-black-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/10"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">

            {/* Provider Filters */}
            <div className="inline-flex items-center rounded-md border border-slate-200 bg-slate-100 p-0.5">
              {filters.map((filter) => (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => setActiveFilter(filter.id)}
                  className={`whitespace-nowrap rounded-[3px] px-3 py-2 text-[15px] font-medium transition ${
                    activeFilter === filter.id
                      ? "bg-white text-black-900 shadow-sm"
                      : "text-black-500 hover:text-black-800"
                  }`}
                >
                  {filter.label} ({filter.count})
                </button>
              ))}
            </div>

            {/* Sort */}
            <button
              type="button"
              onClick={() =>
                setSortOrder((current) =>
                  current === "desc" ? "asc" : "desc"
                )
              }
              className="inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-md border border-slate-200 bg-white px-3 text-xs font-medium text-black-600 transition hover:border-slate-300 hover:bg-slate-50"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                className="h-4 w-4"
                aria-hidden="true"
              >
                <path d="M4 6h16M7 12h10M10 18h4" />
              </svg>

              Last Updated

              <span className="text-black-400">
                {sortOrder === "desc" ? "↓" : "↑"}
              </span>
            </button>
          </div>
        </section>

        {/* Projects Table - No Outer Card */}
        <section className="w-full overflow-x-auto">
          <table className="w-full min-w-[950px] border-collapse bg-transparent text-left">

            {/* Table Header */}
            <thead>
              <tr className="border-b border-slate-200">
                <th className="w-[31%] px-5 py-4 text-[11px] font-bold uppercase tracking-wider text-black-500">
                  Project
                </th>

                <th className="px-5 py-4 text-[11px] font-bold uppercase tracking-wider text-black-500">
                  Provider / Engine
                </th>

                <th className="px-5 py-4 text-[11px] font-bold uppercase tracking-wider text-black-500">
                  Organization
                </th>

                <th className="px-5 py-4 text-[11px] font-bold uppercase tracking-wider text-black-500">
                  Corridor
                </th>

                <th className="px-5 py-4 text-[11px] font-bold uppercase tracking-wider text-black-500">
                  Status
                </th>

                <th className="px-5 py-4 text-right text-[11px] font-bold uppercase tracking-wider text-black-500">
                  Actions
                </th>
              </tr>
            </thead>

            {/* Table Body */}
            <tbody className="divide-y divide-slate-200/80">

              {/* Loading */}
              {loading ? (
                [1, 2, 3, 4].map((item) => (
                  <tr key={item} className="animate-pulse">
                    {Array.from({ length: 6 }).map((_, index) => (
                      <td key={index} className="px-5 py-6">
                        <div className="h-4 w-28 rounded bg-slate-200" />
                        <div className="mt-2 h-3 w-36 rounded bg-slate-100" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : error ? (
                /* Error State */
                <tr>
                  <td colSpan={6} className="px-5 py-16 text-center">
                    <h2 className="text-sm font-semibold text-red-700">
                      Unable to load projects
                    </h2>

                    <p className="mt-2 text-xs text-black-500">
                      {typeof error === "string"
                        ? error
                        : error?.message || "An unexpected error occurred."}
                    </p>

                    <button
                      type="button"
                      onClick={() => loadProjects().catch(() => {})}
                      className="mt-4 rounded-md border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-black-700 transition hover:bg-slate-50"
                    >
                      Try again
                    </button>
                  </td>
                </tr>
              ) : filteredProjects.length === 0 ? (
                /* Empty State */
                <tr>
                  <td colSpan={6} className="px-5 py-16 text-center">
                    <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-md bg-slate-100 text-black-500">
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.7"
                        className="h-5 w-5"
                        aria-hidden="true"
                      >
                        <circle cx="11" cy="11" r="7" />
                        <path d="m16 16 4 4" />
                      </svg>
                    </div>

                    <h2 className="mt-3 text-sm font-semibold text-black-800">
                      {search || activeFilter !== "all"
                        ? "No matching projects"
                        : "No projects found"}
                    </h2>

                    <p className="mt-1 text-xs text-black-500">
                      {search || activeFilter !== "all"
                        ? "Try changing your search or provider filter."
                        : "Projects accessible through your organization memberships will appear here."}
                    </p>

                    {(search || activeFilter !== "all") && (
                      <button
                        type="button"
                        onClick={() => {
                          setSearch("");
                          setActiveFilter("all");
                        }}
                        className="mt-3 text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                      >
                        Clear filters
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                /* Project Rows */
                filteredProjects.map((project) => {
                  const provider = getProvider(project);
                  const integrationType = getIntegrationType(project);
                  const country = getCountry(project);
                  const status = getStatus(project);
                  const updatedDate = formatDate(getUpdatedDate(project));

                  return (
                    <tr
                      key={project.id}
                      className="group transition hover:bg-white/70"
                    >
                      {/* Project */}
                      <td className="px-5 py-5">
                        <div className="min-w-0 max-w-[340px]">
                          <Link
                            to={`/projects/${project.id}`}
                            title={project.name}
                            className="block truncate text-[15px] font-semibold tracking-tight text-black-900 transition hover:text-indigo-600"
                          >
                            {project.name || "Untitled project"}
                          </Link>

                          <p
                            className="mt-1.5 truncate text-[13px] leading-5 text-black-600"
                            title={project.description || ""}
                          >
                            {project.description || "No description provided."}
                          </p>

                          {updatedDate && (
                            <p className="mt-1 text-[11px] text-black-400">
                              Updated {updatedDate}
                            </p>
                          )}
                        </div>
                      </td>

                      {/* Provider / Engine */}
                      <td className="px-5 py-5">
                        {provider !== "—" ? (
                          <span
                            className={`inline-flex rounded-sm border px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide ${
                              normalize(provider).includes("paypal")
                                ? "border-sky-100 bg-sky-50 text-sky-700"
                                : "border-slate-200 bg-slate-100 text-black-700"
                            }`}
                          >
                            {provider}
                          </span>
                        ) : (
                          <span className="text-sm text-black-400">—</span>
                        )}
                      </td>

                      {/* Organization */}
                      <td className="px-5 py-5">
                        <span className="text-sm font-medium text-black-700">
                          {project.organization_name || "—"}
                        </span>
                      </td>

                      {/* Corridor */}
                      <td className="px-5 py-5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {integrationType !== "—" && (
                            <span className="rounded-sm border border-slate-200 bg-white px-2.5 py-1.5 text-[10px] font-medium uppercase text-black-600">
                              {integrationType}
                            </span>
                          )}

                          {country !== "—" && (
                            <span className="rounded-sm border border-slate-200 bg-white px-2.5 py-1.5 text-[10px] font-medium uppercase text-black-600">
                              {country}
                            </span>
                          )}

                          {integrationType === "—" && country === "—" && (
                            <span className="text-sm text-black-400">—</span>
                          )}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-5 py-5">
                        {status ? (
                          <span
                            className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-sm px-2.5 py-1.5 text-[11px] font-medium ${status.style}`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${status.dot}`}
                            />
                            {status.label}
                          </span>
                        ) : (
                          <span className="text-sm text-black-400">—</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-5 text-right">
                        <Link
                          to={`/projects/${project.id}`}
                          className="inline-flex items-center gap-2 whitespace-nowrap text-sm font-medium text-black-600 transition hover:text-indigo-800"
                        >
                          Open

                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            className="h-4 w-4"
                            aria-hidden="true"
                          >
                            <path d="M5 12h14M13 6l6 6-6 6" />
                          </svg>
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </section>

        {/* Minimal Table Footer */}
        {!loading && !error && filteredProjects.length > 0 && (
          <div className="flex items-center justify-between border-t border-slate-200 px-5 py-4">
            <p className="text-xs text-black-500">
              Showing {filteredProjects.length} of {projectList.length}{" "}
              {projectList.length === 1 ? "project" : "projects"}
            </p>

            <p className="text-xs text-black-400">
              Sorted by last updated
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
