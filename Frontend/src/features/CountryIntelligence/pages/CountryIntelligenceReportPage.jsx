import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import useProjects from "../../project/hook/useProjects";
import useCountryIntelligence from "../hook/useCountryIntelligence";

const getData = (response) => response?.data?.data || response?.data || response;
const getProject = (response) => {
    const data = getData(response);
    return data?.project || data;
};
const asArray = (value) => Array.isArray(value) ? value : [];
const formatDate = (value) => {
    if (!value) return "—";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
};
const humanize = (value) =>
    String(value || "Not recorded").replaceAll("_", " ").toLowerCase()
        .replace(/\b\w/g, (character) => character.toUpperCase());

function Metric({ label, value }) {
    return (
        <div className="border-l border-slate-200 pl-4 first:border-0 first:pl-0">
            <p className="text-xs text-slate-500">{label}</p>
            <p className="mt-1 text-xl font-semibold text-slate-950">{value}</p>
        </div>
    );
}

function EvidenceList({ evidence = [] }) {
    const items = asArray(evidence);
    if (!items.length) return null;

    return (
        <div className="mt-3 border-t border-slate-100 pt-3">
            <p className="text-xs font-semibold text-slate-500">Sources</p>
            <ul className="mt-2 space-y-2">
                {items.map((source, index) => {
                    const label = source.sourceName || source.title || source.domain || "Source";
                    return (
                        <li key={`${label}-${index}`} className="text-sm">
                            <p className="font-medium text-slate-800">{label}</p>
                            {source.excerpt && (
                                <p className="mt-1 text-sm leading-6 text-slate-600">{source.excerpt}</p>
                            )}
                            {source.url && (
                                <a
                                    href={source.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="mt-1 inline-block text-sm font-medium text-indigo-600 hover:underline"
                                >
                                    Open source
                                </a>
                            )}
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}

function RequirementRow({ requirement }) {
    return (
        <article className="border-b border-slate-100 py-5 last:border-0">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <h4 className="max-w-4xl font-semibold text-slate-900">
                    {requirement.title || "Untitled requirement"}
                </h4>
                <div className="flex flex-wrap gap-2 text-xs">
                    {requirement.evidenceStatus && (
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-700">
                            {humanize(requirement.evidenceStatus)}
                        </span>
                    )}
                    {requirement.confidence && (
                        <span className="rounded-full bg-slate-50 px-2.5 py-1 text-slate-600">
                            {humanize(requirement.confidence)} confidence
                        </span>
                    )}
                </div>
            </div>
            {requirement.description && (
                <p className="mt-2 max-w-5xl text-sm leading-6 text-slate-600">
                    {requirement.description}
                </p>
            )}
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-500">
                {requirement.applicability && <span>Applicability: {humanize(requirement.applicability)}</span>}
                {requirement.category && <span>Area: {humanize(requirement.category)}</span>}
            </div>
            {requirement.limitations && (
                <p className="mt-2 text-xs leading-5 text-amber-700">
                    Research limitation: {requirement.limitations}
                </p>
            )}
            <EvidenceList evidence={requirement.evidence} />
        </article>
    );
}

export default function CountryIntelligenceReportPage() {
    const { projectId, intelligenceId } = useParams();
    const projectHook = useProjects();
    const countryHook = useCountryIntelligence();

    const [project, setProject] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        let active = true;
        const load = async () => {
            setLoading(true);
            setError("");
            try {
                const projectResponse = await projectHook.loadProject(projectId);
                const loadedProject = getProject(projectResponse);
                if (!active) return;
                setProject(loadedProject);

                if (String(loadedProject?.provider || "").toUpperCase() !== "HYPERWALLET") {
                    return;
                }

                await countryHook.loadProfile(projectId, intelligenceId);
            } catch (err) {
                if (active) setError(
                    err?.response?.data?.message || err?.message || "Unable to load this country report."
                );
            } finally {
                if (active) setLoading(false);
            }
        };
        load();
        return () => { active = false; };
    }, [projectId, intelligenceId]);

    const profile = countryHook.profile;
    const categories = asArray(profile?.categories);
    const requirements = useMemo(
        () => categories.flatMap((category) => asArray(category.requirements)),
        [categories]
    );
    const countryName = profile?.country?.name || profile?.country?.code || "Country report";
    const sourceCount = profile?.profile?.totalSources ??
        requirements.reduce((sum, item) => sum + asArray(item.evidence).length, 0);
    const requirementCount = profile?.profile?.totalRequirements ?? requirements.length;

    if (loading) return <main className="mx-auto max-w-6xl px-6 py-10 text-sm text-slate-500">Loading country report…</main>;
    if (project && String(project.provider || "").toUpperCase() !== "HYPERWALLET") {
        return (
            <main className="mx-auto max-w-5xl px-6 py-10">
                <Link to={`/projects/${projectId}/workflow`} className="text-sm font-medium text-indigo-600 hover:underline">← Back to workflow</Link>
                <div className="mt-8 border-y border-slate-200 py-6">
                    <h1 className="text-xl font-semibold text-slate-950">Country Intelligence is not applicable</h1>
                    <p className="mt-2 text-sm text-slate-600">This provider workflow does not require target-country research.</p>
                </div>
            </main>
        );
    }

    if (error || !profile) {
        return (
            <main className="mx-auto max-w-6xl space-y-4 px-6 py-10">
                <Link to={`/projects/${projectId}/workflow`} className="text-sm font-medium text-indigo-600 hover:underline">← Back to workflow</Link>
                <div className="border-y border-red-200 py-5">
                    <h1 className="text-lg font-semibold text-red-700">Country report unavailable</h1>
                    <p className="mt-2 text-sm text-slate-600">{error || "No report data was returned."}</p>
                </div>
            </main>
        );
    }

    return (
        <main className="mx-auto max-w-6xl space-y-8 px-6 py-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <Link to={`/projects/${projectId}/workflow`} className="text-sm font-medium text-indigo-600 hover:underline">
                        ← Back to workflow
                    </Link>
                    <p className="mt-6 text-xs font-semibold uppercase tracking-[0.14em] text-indigo-600">Country Intelligence · Research report</p>
                    <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
                        {countryName}{profile?.country?.code ? ` (${profile.country.code})` : ""}
                    </h1>
                    <p className="mt-2 text-sm text-slate-500">{project?.name || "Project"} · Last researched {formatDate(profile?.profile?.updatedAt || profile?.profile?.createdAt)}</p>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700">
                    {humanize(profile?.profile?.status)}
                </span>
            </div>

            <section className="grid gap-6 border-y border-slate-200 py-5 sm:grid-cols-3">
                <Metric label="Requirements researched" value={requirementCount} />
                <Metric label="Sources referenced" value={sourceCount} />
                <Metric label="Requirement areas" value={categories.length} />
            </section>

            {profile.overview && (
                <section>
                    <h2 className="text-lg font-semibold text-slate-950">Country overview</h2>
                    <p className="mt-2 max-w-5xl whitespace-pre-wrap text-sm leading-7 text-slate-700">
                        {typeof profile.overview === "string" ? profile.overview : profile.overview.summary || "Overview recorded."}
                    </p>
                </section>
            )}

            <section>
                <div className="mb-4">
                    <h2 className="text-lg font-semibold text-slate-950">What the marketplace needs to account for</h2>
                    <p className="mt-1 text-sm text-slate-500">Requirements grouped by area. Each item shows its evidence status and the sources behind the finding.</p>
                </div>
                {categories.length ? (
                    <div className="divide-y divide-slate-200 border-y border-slate-200">
                        {categories.map((category, index) => (
                            <section key={category.code || category.name || index} className="py-5">
                                <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                                    <h3 className="text-base font-semibold text-slate-900">{category.name || "Other requirements"}</h3>
                                    <span className="text-xs text-slate-500">{asArray(category.requirements).length} requirements</span>
                                </div>
                                {asArray(category.requirements).length ? (
                                    asArray(category.requirements).map((requirement, requirementIndex) => (
                                        <RequirementRow key={requirement.id || `${category.name}-${requirementIndex}`} requirement={requirement} />
                                    ))
                                ) : (
                                    <p className="py-3 text-sm text-slate-500">No requirements were returned for this area.</p>
                                )}
                            </section>
                        ))}
                    </div>
                ) : (
                    <p className="border-y border-slate-200 py-5 text-sm text-slate-500">No structured requirements were returned for this profile.</p>
                )}
            </section>

            {asArray(profile.sources).length > 0 && (
                <section>
                    <h2 className="text-lg font-semibold text-slate-950">Research sources</h2>
                    <ul className="mt-3 divide-y divide-slate-100 border-y border-slate-200">
                        {profile.sources.map((source, index) => (
                            <li key={source.id || index} className="py-3">
                                <a href={source.url} target="_blank" rel="noreferrer" className="text-sm font-medium text-indigo-600 hover:underline">
                                    {source.title || source.sourceName || source.url}
                                </a>
                                {source.domain && <p className="mt-1 text-xs text-slate-500">{source.domain}</p>}
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            <p className="border-t border-slate-200 pt-4 text-xs leading-5 text-slate-500">
                Research findings are decision-support information. Confirm legal and regulatory obligations with qualified counsel and the relevant authorities before operating in this market.
            </p>
        </main>
    );
}
