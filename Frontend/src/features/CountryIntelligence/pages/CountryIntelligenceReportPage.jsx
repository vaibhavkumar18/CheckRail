
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import useProjects from "../../project/hook/useProjects";
import useCountryIntelligence from "../hook/useCountryIntelligence";

const getData = (response) =>
    response?.data?.data || response?.data || response;

const getProject = (response) => {
    const data = getData(response);
    return data?.project || data;
};

const asArray = (value) => Array.isArray(value) ? value : [];

const humanize = (value) =>
    String(value || "Not recorded")
        .replaceAll("_", " ")
        .toLowerCase()
        .replace(/\b\w/g, (character) => character.toUpperCase());

const formatDate = (value) => {
    if (!value) return "—";

    const date = new Date(value);

    return Number.isNaN(date.getTime())
        ? "—"
        : date.toLocaleDateString(undefined, {
              day: "numeric",
              month: "short",
              year: "numeric",
          });
};

const getOverviewText = (overview) => {
    if (typeof overview === "string") return overview;

    return (
        overview?.summary ||
        overview?.description ||
        overview?.overview ||
        ""
    );
};

const getSourceLabel = (source) =>
    source?.sourceName ||
    source?.source_name ||
    source?.title ||
    source?.name ||
    source?.domain ||
    "Research source";

const getRequirementSources = (requirement) =>
    asArray(requirement?.evidence);

const getLimitations = (requirement) => {
    const value =
        requirement?.limitations ||
        requirement?.limitation;

    if (Array.isArray(value)) return value;
    if (typeof value === "string" && value.trim()) return [value];

    return [];
};

/* -------------------------------------------------------------------------- */
/* Status                                                                     */
/* -------------------------------------------------------------------------- */

function StatusBadge({ value }) {
    const normalized = String(value || "UNKNOWN").toUpperCase();

    const styles = {
        COMPLETED: "bg-emerald-50 text-emerald-700",
        VERIFIED: "bg-emerald-50 text-emerald-700",
        AVAILABLE: "bg-emerald-50 text-emerald-700",
        HIGH: "bg-emerald-50 text-emerald-700",
        MEDIUM: "bg-amber-50 text-amber-700",
        LOW: "bg-slate-100 text-slate-600",
        PARTIALLY_COMPLETED: "bg-amber-50 text-amber-700",
        FAILED: "bg-red-50 text-red-700",
        UNKNOWN: "bg-slate-100 text-slate-600",
    };

    return (
        <span
            className={`inline-flex rounded px-2 py-1 text-[11px] font-medium ${
                styles[normalized] || styles.UNKNOWN
            }`}
        >
            {humanize(normalized)}
        </span>
    );
}

/* -------------------------------------------------------------------------- */
/* Metric                                                                     */
/* -------------------------------------------------------------------------- */

function Metric({ label, value }) {
    return (
        <div>
            <p className="text-xs text-slate-500">{label}</p>
            <p className="mt-1 text-2xl font-semibold tracking-tight text-[#002990]">
                {value ?? "—"}
            </p>
        </div>
    );
}

/* -------------------------------------------------------------------------- */
/* Country overview                                                           */
/* -------------------------------------------------------------------------- */

function CountryOverview({ overview }) {
    const [expanded, setExpanded] = useState(false);
    const text = getOverviewText(overview);

    if (!text) return null;

    return (
        <section>
            <h2 className="text-base font-semibold text-[#002990]">
                Country overview
            </h2>

            <p
                className={`mt-3 max-w-5xl whitespace-pre-wrap text-sm leading-7 text-slate-600 ${
                    expanded ? "" : "line-clamp-4"
                }`}
            >
                {text}
            </p>

            {text.length > 350 && (
                <button
                    type="button"
                    onClick={() => setExpanded((current) => !current)}
                    className="mt-2 text-xs font-medium text-[#0089FA] hover:underline"
                >
                    {expanded ? "Show less" : "Read full overview"}
                </button>
            )}
        </section>
    );
}

/* -------------------------------------------------------------------------- */
/* Category navigation                                                       */
/* -------------------------------------------------------------------------- */

function CategoryNavigation({
    categories,
    activeCategory,
    onChange,
}) {
    return (
        <div className="flex gap-6 overflow-x-auto border-b border-slate-200">
            {categories.map((category, index) => {
                const key =
                    category.code ||
                    category.name ||
                    String(index);

                const active = activeCategory === key;
                const count = asArray(category.requirements).length;

                return (
                    <button
                        key={key}
                        type="button"
                        onClick={() => onChange(key)}
                        className={`relative flex shrink-0 items-center gap-2 py-3 text-xs font-medium transition ${
                            active
                                ? "text-[#002990]"
                                : "text-slate-500 hover:text-[#0089FA]"
                        }`}
                    >
                        {category.name || "Other"}

                        <span
                            className={`text-[10px] ${
                                active ? "text-[#0089FA]" : "text-slate-400"
                            }`}
                        >
                            {count}
                        </span>

                        {active && (
                            <span className="absolute inset-x-0 bottom-0 h-0.5 bg-[#0089FA]" />
                        )}
                    </button>
                );
            })}
        </div>
    );
}

/* -------------------------------------------------------------------------- */
/* Requirement row                                                            */
/* -------------------------------------------------------------------------- */

function RequirementItem({ requirement, index }) {
    const [expanded, setExpanded] = useState(false);

    const title =
        requirement?.title ||
        requirement?.name ||
        `Requirement ${index + 1}`;

    const description =
        requirement?.description ||
        requirement?.summary ||
        "";

    const sources = getRequirementSources(requirement);
    const limitations = getLimitations(requirement);

    const hasDetails =
        Boolean(description) ||
        Boolean(requirement?.applicability) ||
        Boolean(requirement?.category) ||
        limitations.length > 0 ||
        sources.length > 0;

    return (
        <article className="border-b border-slate-100 py-5 last:border-0">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                    <div className="flex items-start gap-3">
                        <span className="mt-0.5 text-xs font-medium tabular-nums text-slate-400">
                            {String(index + 1).padStart(2, "0")}
                        </span>

                        <div className="min-w-0">
                            <h3 className="text-sm font-semibold leading-6 text-slate-900">
                                {title}
                            </h3>

                            {description && (
                                <p
                                    className={`mt-2 max-w-4xl text-sm leading-6 text-slate-600 ${
                                        expanded ? "" : "line-clamp-3"
                                    }`}
                                >
                                    {description}
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex shrink-0 flex-wrap gap-2 pl-6 sm:pl-0">
                    {requirement?.evidenceStatus && (
                        <StatusBadge value={requirement.evidenceStatus} />
                    )}

                    {requirement?.confidence && (
                        <span className="rounded bg-slate-100 px-2 py-1 text-[11px] text-slate-600">
                            {humanize(requirement.confidence)} confidence
                        </span>
                    )}
                </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 pl-6 text-xs">
                {requirement?.applicability && (
                    <span>
                        <span className="text-slate-400">Applicability</span>
                        <span className="ml-1.5 font-medium text-slate-700">
                            {humanize(requirement.applicability)}
                        </span>
                    </span>
                )}

                {requirement?.category && (
                    <span>
                        <span className="text-slate-400">Area</span>
                        <span className="ml-1.5 font-medium text-slate-700">
                            {humanize(requirement.category)}
                        </span>
                    </span>
                )}

                {sources.length > 0 && (
                    <span className="text-[#0089FA]">
                        {sources.length}{" "}
                        {sources.length === 1 ? "source" : "sources"}
                    </span>
                )}
            </div>

            {hasDetails && (
                <div className="pl-6">
                    <button
                        type="button"
                        onClick={() => setExpanded((current) => !current)}
                        className="mt-3 text-xs font-medium text-[#0089FA] hover:underline"
                    >
                        {expanded ? "Hide details −" : "View details +"}
                    </button>

                    {expanded && (
                        <div className="mt-4 space-y-4 border-l-2 border-[#5CC7FA] pl-4">
                            {description && (
                                <div>
                                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                                        Research description
                                    </p>

                                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                                        {description}
                                    </p>
                                </div>
                            )}

                            {limitations.length > 0 && (
                                <div>
                                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                                        Research limitations
                                    </p>

                                    <ul className="mt-2 list-inside list-disc space-y-1 text-sm leading-6 text-slate-600">
                                        {limitations.map((item, itemIndex) => (
                                            <li key={itemIndex}>{item}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {sources.length > 0 && (
                                <div>
                                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                                        Supporting evidence
                                    </p>

                                    <div className="mt-2 space-y-3">
                                        {sources.map((source, sourceIndex) => (
                                            <div
                                                key={source.id || sourceIndex}
                                                className="text-sm"
                                            >
                                                <p className="font-medium text-slate-800">
                                                    {getSourceLabel(source)}
                                                </p>

                                                {source.domain && (
                                                    <p className="mt-1 text-xs text-slate-400">
                                                        {source.domain}
                                                    </p>
                                                )}

                                                {source.excerpt && (
                                                    <p className="mt-1 text-xs leading-5 text-slate-600">
                                                        {source.excerpt}
                                                    </p>
                                                )}

                                                {source.url && (
                                                    <a
                                                        href={source.url}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="mt-1 inline-block text-xs font-medium text-[#0089FA] hover:underline"
                                                    >
                                                        Open source ↗
                                                    </a>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </article>
    );
}

/* -------------------------------------------------------------------------- */
/* Research sources                                                           */
/* -------------------------------------------------------------------------- */

function ResearchSources({ sources }) {
    const [expanded, setExpanded] = useState(false);

    const items = asArray(sources);
    const visibleItems = expanded ? items : items.slice(0, 5);

    return (
        <section>
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h2 className="text-base font-semibold text-[#002990]">
                        Research sources
                    </h2>
                    <p className="mt-1 text-xs text-slate-500">
                        Sources recorded during country research.
                    </p>
                </div>

                <span className="text-xs text-slate-500">
                    {items.length} sources
                </span>
            </div>

            <div className="mt-4 divide-y divide-slate-100 border-y border-slate-200">
                {visibleItems.map((source, index) => (
                    <div
                        key={source.id || index}
                        className="flex items-center justify-between gap-4 py-3"
                    >
                        <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-slate-800">
                                {getSourceLabel(source)}
                            </p>

                            <p className="mt-1 truncate text-xs text-slate-400">
                                {source.domain || source.url || "Source details unavailable"}
                            </p>
                        </div>

                        {source.url && (
                            <a
                                href={source.url}
                                target="_blank"
                                rel="noreferrer"
                                className="shrink-0 text-xs font-medium text-[#0089FA] hover:underline"
                            >
                                Visit source ↗
                            </a>
                        )}
                    </div>
                ))}
            </div>

            {items.length > 5 && (
                <button
                    type="button"
                    onClick={() => setExpanded((current) => !current)}
                    className="mt-3 text-xs font-medium text-[#0089FA] hover:underline"
                >
                    {expanded
                        ? "Show fewer sources"
                        : `Show all ${items.length} sources`}
                </button>
            )}
        </section>
    );
}

/* -------------------------------------------------------------------------- */
/* Main page                                                                  */
/* -------------------------------------------------------------------------- */

export default function CountryIntelligenceReportPage() {
    const { projectId, intelligenceId } = useParams();

    const projectHook = useProjects();
    const countryHook = useCountryIntelligence();

    const [project, setProject] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [activeCategory, setActiveCategory] = useState(null);

    useEffect(() => {
        let active = true;

        const initialize = async () => {
            setLoading(true);
            setError("");

            try {
                const projectResponse =
                    await projectHook.loadProject(projectId);

                const loadedProject = getProject(projectResponse);

                if (!active) return;

                setProject(loadedProject);

                if (
                    String(loadedProject?.provider || "").toUpperCase() !==
                    "HYPERWALLET"
                ) {
                    return;
                }

                await countryHook.loadProfile(
                    projectId,
                    intelligenceId
                );
            } catch (err) {
                if (active) {
                    setError(
                        err?.response?.data?.message ||
                        err?.message ||
                        "Unable to load this country report."
                    );
                }
            } finally {
                if (active) setLoading(false);
            }
        };

        initialize();

        return () => {
            active = false;
        };
    }, [projectId, intelligenceId]);

    const profile = countryHook.profile;
    const categories = asArray(profile?.categories);

    const requirements = useMemo(
        () =>
            categories.flatMap((category) =>
                asArray(category.requirements)
            ),
        [categories]
    );

    const currentCategoryKey =
        activeCategory ||
        categories[0]?.code ||
        categories[0]?.name ||
        (categories.length ? "0" : null);

    const selectedCategory = categories.find(
        (category, index) =>
            (category.code || category.name || String(index)) ===
            currentCategoryKey
    );

    const selectedRequirements = asArray(
        selectedCategory?.requirements
    );

    const countryName =
        profile?.country?.name ||
        profile?.country?.code ||
        "Country report";

    const countryCode = profile?.country?.code;

    const sourceCount =
        profile?.profile?.totalSources ??
        asArray(profile?.sources).length;

    const requirementCount =
        profile?.profile?.totalRequirements ??
        requirements.length;

    if (loading) {
        return (
            <main className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
                <div className="animate-pulse space-y-5">
                    <div className="h-3 w-32 rounded bg-slate-200" />
                    <div className="h-8 w-64 rounded bg-slate-200" />
                    <div className="h-4 w-80 max-w-full rounded bg-slate-100" />
                    <div className="grid grid-cols-3 gap-5">
                        <div className="h-20 rounded bg-slate-100" />
                        <div className="h-20 rounded bg-slate-100" />
                        <div className="h-20 rounded bg-slate-100" />
                    </div>
                </div>
            </main>
        );
    }

    if (
        project &&
        String(project.provider || "").toUpperCase() !== "HYPERWALLET"
    ) {
        return (
            <main className="mx-auto max-w-5xl px-5 py-10 sm:px-8">
                <Link
                    to={`/projects/${projectId}/workflow`}
                    className="text-sm font-medium text-[#0089FA] hover:underline"
                >
                    ← Back to workflow
                </Link>

                <div className="mt-8 border-y border-slate-200 py-6">
                    <h1 className="text-xl font-semibold text-[#002990]">
                        Country Intelligence is not applicable
                    </h1>
                    <p className="mt-2 text-sm text-slate-600">
                        This provider workflow does not require target-country
                        research.
                    </p>
                </div>
            </main>
        );
    }

    if (error || !profile) {
        return (
            <main className="mx-auto max-w-7xl space-y-4 px-5 py-10 sm:px-8">
                <Link
                    to={`/projects/${projectId}/workflow`}
                    className="text-sm font-medium text-[#0089FA] hover:underline"
                >
                    ← Back to workflow
                </Link>

                <div className="border-y border-red-200 py-5">
                    <h1 className="text-lg font-semibold text-red-700">
                        Country report unavailable
                    </h1>
                    <p className="mt-2 text-sm text-slate-600">
                        {error || "No report data was returned."}
                    </p>
                </div>
            </main>
        );
    }

    return (
        <main className="mx-auto max-w-7xl space-y-8 px-5 py-7 sm:px-8">

            {/* Page heading */}

            <header>
                <Link
                    to={`/projects/${projectId}/workflow`}
                    className="text-xs font-medium text-[#0089FA] hover:underline"
                >
                    ← Back to workflow
                </Link>

                <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#0089FA]">
                            Country Intelligence
                        </p>

                        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[#002990] sm:text-3xl">
                            {countryName}
                            {countryCode ? ` (${countryCode})` : ""}
                        </h1>

                        <p className="mt-2 text-xs text-slate-500">
                            {project?.name || "Project"}
                            <span className="mx-2 text-slate-300">·</span>
                            Last researched{" "}
                            {formatDate(
                                profile?.profile?.updatedAt ||
                                profile?.profile?.createdAt
                            )}
                        </p>
                    </div>

                    <StatusBadge value={profile?.profile?.status} />
                </div>
            </header>

            {/* Summary */}

            <section className="grid grid-cols-1 gap-6 border-y border-slate-200 py-5 sm:grid-cols-3 sm:gap-10">
                <Metric
                    label="Requirements researched"
                    value={requirementCount}
                />

                <Metric
                    label="Sources referenced"
                    value={sourceCount}
                />

                <Metric
                    label="Requirement areas"
                    value={categories.length}
                />
            </section>

            {/* Overview */}

            <CountryOverview overview={profile.overview} />

            {/* Requirements */}

            <section>
                <div className="mb-5">
                    <h2 className="text-base font-semibold text-[#002990]">
                        What the marketplace needs to account for
                    </h2>

                    <p className="mt-1 text-xs text-slate-500">
                        Requirements identified through country research,
                        grouped by area.
                    </p>
                </div>

                {categories.length > 0 ? (
                    <>
                        <CategoryNavigation
                            categories={categories}
                            activeCategory={currentCategoryKey}
                            onChange={setActiveCategory}
                        />

                        <div className="flex flex-wrap items-center justify-between gap-3 py-4">
                            <h3 className="text-sm font-semibold text-slate-800">
                                {selectedCategory?.name || "Requirements"}
                            </h3>

                            <span className="text-xs text-slate-400">
                                {selectedRequirements.length} requirements
                            </span>
                        </div>

                        {selectedRequirements.length > 0 ? (
                            <div className="border-t border-slate-200">
                                {selectedRequirements.map(
                                    (requirement, index) => (
                                        <RequirementItem
                                            key={
                                                requirement.id ||
                                                `${currentCategoryKey}-${index}`
                                            }
                                            requirement={requirement}
                                            index={index}
                                        />
                                    )
                                )}
                            </div>
                        ) : (
                            <p className="border-t border-slate-200 py-6 text-sm text-slate-500">
                                No requirements were returned for this area.
                            </p>
                        )}
                    </>
                ) : (
                    <p className="border-y border-slate-200 py-5 text-sm text-slate-500">
                        No structured requirements were returned for this profile.
                    </p>
                )}
            </section>

            {/* Sources */}

            {asArray(profile.sources).length > 0 && (
                <ResearchSources sources={profile.sources} />
            )}

            {/* Notice */}

            <footer className="border-t border-slate-200 pt-5">
                <p className="text-xs font-semibold text-[#002990]">
                    Research and decision-support notice
                </p>

                <p className="mt-2 max-w-5xl text-xs leading-6 text-slate-500">
                    These findings are research-based decision-support
                    information. They do not constitute legal advice,
                    regulatory approval or provider certification. Confirm
                    applicable obligations with qualified professionals and
                    relevant authorities before operating in this market.
                </p>
            </footer>
        </main>
    );
}
