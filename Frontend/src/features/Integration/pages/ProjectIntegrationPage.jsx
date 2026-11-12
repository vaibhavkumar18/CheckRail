import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import useProjects from "../../project/hook/useProjects";
import useIntegration from "../hook/useIntegration";

const extractProject = (response) =>
    response?.project || response?.data?.project || response?.data || response;

const extractIntegration = (response) =>
    response?.integration ||
    response?.data?.integration ||
    response?.data ||
    response;

const prettyJSON = (value) => JSON.stringify(value ?? {}, null, 2);

export default function ProjectIntegrationPage() {
    const { projectId } = useParams();

    const projectHook = useProjects();
    const integrationHook = useIntegration();

    const [project, setProject] = useState(null);
    const [selectedFile, setSelectedFile] = useState(null);
    const [selectedIntegrationId, setSelectedIntegrationId] = useState("");
    const [profileText, setProfileText] = useState("{}");
    const [integration, setIntegration] = useState(null);

    const [pageLoading, setPageLoading] = useState(true);
    const [savingProfile, setSavingProfile] = useState(false);
    const [confirming, setConfirming] = useState(false);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");

    const loadIntegration = async (integrationId) => {
        const record = await integrationHook.loadIntegration(integrationId);
        const normalized = extractIntegration(record);

        setIntegration(normalized);
        setSelectedIntegrationId(integrationId);
        setProfileText(prettyJSON(normalized?.profile));
        return normalized;
    };

    useEffect(() => {
        let active = true;

        const load = async () => {
            setPageLoading(true);
            setError("");

            try {
                const [projectResponse, integrations] = await Promise.all([
                    projectHook.loadProject(projectId),
                    integrationHook.loadProjectIntegrations(projectId),
                ]);

                if (!active) return;

                setProject(extractProject(projectResponse));

                if (integrations.length > 0) {
                    const first = integrations[0];
                    const id = first.id || first.integrationId || first.integration_id;

                    if (id) {
                        await loadIntegration(id);
                    }
                }
            } catch (err) {
                if (active) {
                    setError(
                        err?.response?.data?.message ||
                        "Unable to load the project Integration workspace."
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

    const handleUpload = async (event) => {
        event.preventDefault();
        setError("");
        setMessage("");

        if (!selectedFile) {
            setError("Select a ZIP file containing your payment integration source.");
            return;
        }

        if (!selectedFile.name.toLowerCase().endsWith(".zip")) {
            setError("The backend currently accepts ZIP files only.");
            return;
        }

        try {
            const response = await integrationHook.startIntegration(
                projectId,
                selectedFile
            );

            const record = extractIntegration(response);
            const integrationId =
                record?.id || record?.integrationId || record?.integration_id;

            if (!integrationId) {
                throw new Error(
                    "Upload succeeded but the response did not contain an Integration ID."
                );
            }

            await integrationHook.loadProjectIntegrations(projectId);
            await loadIntegration(integrationId);

            setSelectedFile(null);
            setMessage(
                "Source analysed. Review the generated Integration Profile before confirming it."
            );
        } catch (err) {
            setError(
                err?.response?.data?.message ||
                err?.message ||
                "Integration upload failed."
            );
        }
    };

    const handleLoadExisting = async (event) => {
        const id = event.target.value;
        setSelectedIntegrationId(id);
        setError("");
        setMessage("");

        if (!id) {
            setIntegration(null);
            setProfileText("{}");
            return;
        }

        try {
            await loadIntegration(id);
        } catch (err) {
            setError(
                err?.response?.data?.message ||
                "Unable to load this Integration Profile."
            );
        }
    };

    const handleSaveProfile = async () => {
        if (!integration?.id) return;

        setError("");
        setMessage("");

        let profile;

        try {
            profile = JSON.parse(profileText);
        } catch {
            setError("The profile editor contains invalid JSON.");
            return;
        }

        if (!profile || Array.isArray(profile) || typeof profile !== "object") {
            setError("The Integration Profile must be a JSON object.");
            return;
        }

        setSavingProfile(true);

        try {
            await integrationHook.updateProfile(integration.id, profile);
            await loadIntegration(integration.id);
            setMessage("Integration Profile changes saved.");
        } catch (err) {
            setError(
                err?.response?.data?.message ||
                "Unable to save the Integration Profile."
            );
        } finally {
            setSavingProfile(false);
        }
    };

    const handleConfirm = async () => {
        if (!integration?.id) return;

        setError("");
        setMessage("");
        setConfirming(true);

        try {
            const response = await integrationHook.confirm(integration.id);

            await loadIntegration(integration.id);

            setMessage(
                response?.message ||
                response?.data?.message ||
                "Integration Profile confirmation completed."
            );
        } catch (err) {
            setError(
                err?.response?.data?.message ||
                "Unable to confirm the Integration Profile."
            );
        } finally {
            setConfirming(false);
        }
    };

    if (pageLoading) {
        return <div className="p-8 text-slate-500">Loading Integration workspace...</div>;
    }

    if (!project) {
        return (
            <div className="p-8">
                <p className="text-red-600">{error || "Project not found."}</p>
                <Link to="/projects" className="text-indigo-600">Back to projects</Link>
            </div>
        );
    }

    const integrations = integrationHook.integrations || [];
    const reviewStatus = String(
        integration?.reviewStatus || integration?.review_status || "UNKNOWN"
    ).toUpperCase();

    const confirmed = ["CONFIRMED", "COMPLETED"].includes(reviewStatus);

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
                    Step 1 · Integration Intelligence
                </p>

                <h1 className="mt-2 text-3xl font-bold text-slate-900">
                    Analyse payment integration
                </h1>

                <p className="mt-2 text-sm text-slate-500">
                    {project.name} · Upload your existing payment integration source,
                    review the extracted profile, and confirm it.
                </p>
            </div>

            {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                    {error}
                </div>
            )}

            {message && (
                <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-700">
                    {message}
                </div>
            )}

            <section className="rounded-xl border border-slate-200 bg-white p-5">
                <h2 className="text-lg font-semibold text-slate-900">
                    Upload integration source
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                    ZIP files only. The backend analyses the uploaded source during
                    the upload request.
                </p>

                <form onSubmit={handleUpload} className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-end">
                    <label className="flex-1 text-sm font-medium text-slate-700">
                        Source ZIP
                        <input
                            type="file"
                            accept=".zip,application/zip"
                            onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
                            className="mt-2 block w-full rounded-lg border border-slate-300 p-3 text-sm"
                        />
                    </label>

                    <button
                        type="submit"
                        disabled={integrationHook.loading}
                        className="rounded-lg bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                    >
                        {integrationHook.loading ? "Analysing..." : "Upload and analyse"}
                    </button>
                </form>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h2 className="text-lg font-semibold text-slate-900">
                            Integration Profile
                        </h2>
                        <p className="mt-1 text-sm text-slate-500">
                            Select an existing profile or review the newly analysed source.
                        </p>
                    </div>

                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                        {reviewStatus.replaceAll("_", " ")}
                    </span>
                </div>

                <select
                    value={selectedIntegrationId}
                    onChange={handleLoadExisting}
                    className="mt-4 w-full rounded-lg border border-slate-300 bg-white p-3 text-sm"
                >
                    <option value="">Select an Integration Profile</option>
                    {integrations.map((item) => {
                        const id = item.id || item.integrationId || item.integration_id;
                        return (
                            <option key={id} value={id}>
                                {item.originalFilename ||
                                    item.original_filename ||
                                    item.filename ||
                                    id}{" "}
                                · {item.reviewStatus || item.review_status || item.sourceStatus || "Unknown"}
                            </option>
                        );
                    })}
                </select>

                {integration && (
                    <>
                        <div className="mt-5 grid gap-3 sm:grid-cols-3">
                            <div className="rounded-lg bg-slate-50 p-3">
                                <p className="text-xs text-slate-500">Integration ID</p>
                                <p className="mt-1 break-all text-sm font-medium text-slate-800">
                                    {integration.id}
                                </p>
                            </div>

                            <div className="rounded-lg bg-slate-50 p-3">
                                <p className="text-xs text-slate-500">Review status</p>
                                <p className="mt-1 text-sm font-medium text-slate-800">
                                    {reviewStatus.replaceAll("_", " ")}
                                </p>
                            </div>

                            <div className="rounded-lg bg-slate-50 p-3">
                                <p className="text-xs text-slate-500">Source</p>
                                <p className="mt-1 break-all text-sm font-medium text-slate-800">
                                    {integration.originalFilename ||
                                        integration.original_filename ||
                                        integration.sourceId ||
                                        "Uploaded source"}
                                </p>
                            </div>
                        </div>

                        <label className="mt-5 block text-sm font-semibold text-slate-700">
                            Extracted profile JSON
                            <textarea
                                value={profileText}
                                onChange={(event) => setProfileText(event.target.value)}
                                rows={20}
                                spellCheck="false"
                                className="mt-2 w-full rounded-lg border border-slate-300 bg-slate-950 p-4 font-mono text-xs text-slate-100"
                            />
                        </label>

                        <div className="mt-4 flex flex-wrap gap-3">
                            <button
                                type="button"
                                onClick={handleSaveProfile}
                                disabled={savingProfile || confirming || confirmed}
                                className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                            >
                                {savingProfile ? "Saving..." : "Save profile changes"}
                            </button>

                            <button
                                type="button"
                                onClick={handleConfirm}
                                disabled={confirming || savingProfile || confirmed}
                                className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                            >
                                {confirming
                                    ? "Confirming..."
                                    : confirmed
                                        ? "Profile confirmed"
                                        : "Confirm Integration Profile"}
                            </button>
                        </div>

                        {confirmed && (
                            <div className="mt-5 rounded-lg border border-green-200 bg-green-50 p-4">
                                <p className="text-sm font-semibold text-green-800">
                                    Integration Profile confirmed.
                                </p>
                                <p className="mt-1 text-sm text-green-700">
                                    You can now continue to Provider Verification.
                                </p>
                                <Link
                                    to={`/projects/${projectId}/verification`}
                                    className="mt-3 inline-block text-sm font-semibold text-green-800 underline"
                                >
                                    Continue to Provider Verification →
                                </Link>
                            </div>
                        )}
                    </>
                )}
            </section>
        </main>
    );
}