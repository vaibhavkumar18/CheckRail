import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";

import useProjects from "../../project/hook/useProjects";
import useCountryIntelligence from "../hook/useCountryIntelligence";

const extractProject = (response) =>
    response?.project || response?.data?.project || response?.data || response;

const getData = (response) =>
    response?.data?.data || response?.data || response;

const terminalStatuses = [
    "COMPLETED",
    "FAILED",
    "PARTIALLY_COMPLETED",
    "CANCELLED",
];

const formatDate = (value) =>
    value ? new Date(value).toLocaleString() : "—";

export default function CountryIntelligencePage() {
    const { projectId } = useParams();

    const projectHook = useProjects();
    const countryHook = useCountryIntelligence();

    const [project, setProject] = useState(null);
    const [pageLoading, setPageLoading] = useState(true);
    const [activeRunId, setActiveRunId] = useState("");
    const [polling, setPolling] = useState(false);
    const [error, setError] = useState("");

    const pollingRef = useRef(false);

    const refreshProfiles = useCallback(async () => {
        return countryHook.loadProfiles(projectId);
    }, [countryHook.loadProfiles, projectId]);

    useEffect(() => {
        let active = true;

        const load = async () => {
            setPageLoading(true);
            setError("");

            try {
                const projectResponse = await projectHook.loadProject(projectId);
                const loadedProject = extractProject(projectResponse);
                if (String(loadedProject?.provider || "").toUpperCase() === "HYPERWALLET") {
                    await refreshProfiles();
                }
                if (active) {
                    setProject(loadedProject);
                }
            } catch (err) {
                if (active) {
                    setError(
                        err?.response?.data?.message ||
                        "Unable to load Country Intelligence."
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

    useEffect(() => {
        if (!activeRunId) return undefined;

        let cancelled = false;
        let timeoutId;

        const poll = async () => {
            try {
                const result = await countryHook.loadRun(projectId, activeRunId);
                if (cancelled) return;

                const status = String(result?.status || "").toUpperCase();

                if (terminalStatuses.includes(status)) {
                    setPolling(false);
                    pollingRef.current = false;
                    await refreshProfiles();
                    return;
                }

                timeoutId = window.setTimeout(poll, 3000);
            } catch {
                if (!cancelled) {
                    setPolling(false);
                    pollingRef.current = false;
                }
            }
        };

        poll();

        return () => {
            cancelled = true;
            window.clearTimeout(timeoutId);
        };
    }, [activeRunId, projectId]);

    const handleStart = async () => {
        setError("");

        try {
            const result = await countryHook.start(projectId);
            const runId = result?.runId || result?.run_id;

            if (!runId) {
                throw new Error("The start response did not contain a run ID.");
            }

            setActiveRunId(runId);
            setPolling(true);
            pollingRef.current = true;
        } catch (err) {
            setError(
                err?.response?.data?.message ||
                err?.message ||
                "Unable to start Country Intelligence."
            );
        }
    };


    if (pageLoading) {
        return <div className="p-8 text-slate-500">Loading Country Intelligence...</div>;
    }

    if (!project) {
        return <div className="p-8 text-red-600">{error || "Project not found."}</div>;
    }

    if (String(project.provider || "").toUpperCase() !== "HYPERWALLET") {
        return (
            <main className="mx-auto max-w-5xl px-6 py-10">
                <Link to={`/projects/${projectId}/workflow`} className="text-sm font-medium text-indigo-600 hover:underline">← Back to workflow</Link>
                <div className="mt-8 border-y border-slate-200 py-6">
                    <h1 className="text-xl font-semibold text-slate-950">Country Intelligence is not part of this workflow</h1>
                    <p className="mt-2 text-sm leading-6 text-slate-600">This project does not have a target-market research stage. Continue with its provider verification and AI Gap Analysis stages instead.</p>
                </div>
            </main>
        );
    }

    const run = countryHook.run;
    const progress = run?.progress || {};
    const countries = run?.countries || [];
    const status = String(run?.status || "NOT_STARTED").toUpperCase();

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
                    Country Intelligence
                </p>

                <h1 className="mt-2 text-3xl font-bold text-slate-900">
                    Research target-country requirements
                </h1>

                <p className="mt-2 text-sm text-slate-500">
                    {project.name}. Research is based on the target countries
                    configured for this project.
                </p>
            </div>

            {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                    {error}
                </div>
            )}

            <section className="rounded-xl border border-slate-200 bg-white p-5">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <h2 className="font-semibold text-slate-900">
                            Start country research
                        </h2>
                        <p className="mt-1 text-sm text-slate-500">
                            The backend determines target countries from the project.
                            No country override is sent by this page.
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={handleStart}
                        disabled={countryHook.submitting || polling}
                        className="rounded-lg bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                    >
                        {countryHook.submitting
                            ? "Starting..."
                            : polling
                                ? "Research running..."
                                : "Run Country Intelligence"}
                    </button>
                </div>
            </section>

            {run && (
                <section className="rounded-xl border border-slate-200 bg-white p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <h2 className="font-semibold text-slate-900">Research run</h2>
                            <p className="mt-1 break-all text-xs text-slate-500">
                                Run ID: {run.runId || activeRunId || "—"}
                            </p>
                        </div>

                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                            {status.replaceAll("_", " ")}
                        </span>
                    </div>

                    <div className="mt-5 grid gap-3 sm:grid-cols-4">
                        {[
                            ["Total", progress.total ?? run.totalCountries ?? 0],
                            ["Completed", progress.completed ?? 0],
                            ["In progress", progress.inProgress ?? 0],
                            ["Failed", progress.failed ?? 0],
                        ].map(([label, value]) => (
                            <div key={label} className="rounded-lg bg-slate-50 p-3">
                                <p className="text-xs text-slate-500">{label}</p>
                                <p className="mt-1 text-xl font-semibold text-slate-900">
                                    {value}
                                </p>
                            </div>
                        ))}
                    </div>

                    <div className="mt-5">
                        <div className="mb-2 flex justify-between text-xs text-slate-500">
                            <span>Research progress</span>
                            <span>{progress.percentage ?? 0}%</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                            <div
                                className="h-full rounded-full bg-indigo-600 transition-all"
                                style={{
                                    width: `${Math.max(
                                        0,
                                        Math.min(100, Number(progress.percentage || 0))
                                    )}%`,
                                }}
                            />
                        </div>
                    </div>

                    {countries.length > 0 && (
                        <div className="mt-5 divide-y divide-slate-100">
                            {countries.map((country) => (
                                <div
                                    key={`${country.countryCode}-${country.intelligenceId || country.status}`}
                                    className="flex flex-wrap items-center justify-between gap-3 py-3"
                                >
                                    <div>
                                        <p className="text-sm font-semibold text-slate-800">
                                            {country.countryName} ({country.countryCode})
                                        </p>
                                        <p className="mt-1 text-xs text-slate-500">
                                            {country.requirementCount ?? 0} requirements ·{" "}
                                            {country.sourceCount ?? 0} sources
                                        </p>
                                        {country.error && (
                                            <p className="mt-1 text-xs text-red-600">
                                                {country.error}
                                            </p>
                                        )}
                                    </div>

                                    <span className="text-xs font-semibold text-slate-600">
                                        {String(country.status || "UNKNOWN").replaceAll("_", " ")}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}

                    <p className="mt-4 text-xs text-slate-500">
                        Started: {formatDate(run.startedAt)} · Completed: {formatDate(run.completedAt)}
                    </p>
                </section>
            )}

            <section className="rounded-xl border border-slate-200 bg-white p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h2 className="font-semibold text-slate-900">Saved country profiles</h2>
                        <p className="mt-1 text-sm text-slate-500">
                            Open a completed profile to inspect its requirements and sources.
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={refreshProfiles}
                        disabled={countryHook.loading}
                        className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"
                    >
                        Refresh profiles
                    </button>
                </div>

                {countryHook.profiles.length === 0 ? (
                    <p className="mt-5 text-sm text-slate-500">
                        No saved country profiles are available for this project yet.
                    </p>
                ) : (
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        {countryHook.profiles.map((item) => {
                            const id = item.id || item.intelligenceId || item.intelligence_id;
                            return (
                                <Link
                                    key={id}
                                    to={`/projects/${projectId}/country-intelligence/${id}`}
                                    className="block rounded-lg border border-slate-200 p-4 text-left transition hover:border-indigo-300 hover:bg-indigo-50/30"
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <p className="font-semibold text-slate-900">
                                            {item.countryName || item.country?.name || "Country"} ({item.countryCode || item.country_code || item.country?.code || "—"})
                                        </p>
                                        <span className="text-xs text-slate-500">
                                            {item.status || item.profile?.status || "UNKNOWN"}
                                        </span>
                                    </div>
                                    <p className="mt-2 text-xs text-slate-500">
                                        {item.requirementCount ?? 0} requirements ·{" "}
                                        {item.sourceCount ?? 0} sources
                                    </p>
                                    <p className="mt-1 text-xs text-slate-400">
                                        Last researched: {formatDate(item.lastResearchedAt)}
                                    </p>
                                </Link>
                            );
                        })}
                    </div>
                )}
            </section>

        </main>
    );
}