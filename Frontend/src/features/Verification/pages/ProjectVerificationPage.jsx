import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import useProjects from "../../project/hook/useProjects";
import useIntegration from "../../Integration/hook/useIntegration";
import useCredentials from "../../Credentials/hook/useCredentials";
import useCapabilityVerification from "../hook/useCapabilityVerification";

const extractProject = (response) =>
    response?.project || response?.data?.project || response?.data || response;

const extractData = (response) =>
    response?.data?.data || response?.data || response;

const getId = (item) =>
    item?.id || item?.integrationId || item?.integration_id;

const getStatus = (item) =>
    String(
        item?.executionStatus ||
        item?.execution_status ||
        item?.overallStatus ||
        item?.overall_status ||
        item?.status ||
        "UNKNOWN"
    ).toUpperCase();

const pretty = (value) => JSON.stringify(value ?? {}, null, 2);

export default function ProjectVerificationPage() {
    const { projectId } = useParams();

    const projectHook = useProjects();
    const integrationHook = useIntegration();
    const credentialHook = useCredentials();
    const verificationHook = useCapabilityVerification();

    const [project, setProject] = useState(null);
    const [selectedIntegrationId, setSelectedIntegrationId] = useState("");
    const [selectedCredential, setSelectedCredential] = useState(null);

    const [provider, setProvider] = useState("PAYPAL");
    const [clientId, setClientId] = useState("");
    const [clientSecret, setClientSecret] = useState("");
    const [webhookId, setWebhookId] = useState("");

    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [programToken, setProgramToken] = useState("");

    const [capabilityCode, setCapabilityCode] = useState("PAYMENT_PROCESSING");
    const [recipientJSON, setRecipientJSON] = useState("{}");

    const [result, setResult] = useState(null);
    const [pageLoading, setPageLoading] = useState(true);
    const [savingCredentials, setSavingCredentials] = useState(false);
    const [starting, setStarting] = useState(false);
    const [resuming, setResuming] = useState(false);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");

    useEffect(() => {
        let active = true;

        const load = async () => {
            setPageLoading(true);
            setError("");

            try {
                const [projectResponse, integrations] = await Promise.all([
                    projectHook.loadProject(projectId),
                    integrationHook.loadProjectIntegrations(projectId),
                    verificationHook.loadRuns(projectId),
                ]);

                if (!active) return;

                const projectRecord = extractProject(projectResponse);
                setProject(projectRecord);

                const projectProvider = String(
                    projectRecord?.provider || "PAYPAL"
                ).toUpperCase();

                setProvider(
                    projectProvider === "HYPERWALLET"
                        ? "HYPERWALLET"
                        : "PAYPAL"
                );

                const confirmedIntegration = integrations.find((item) => {
                    const status = String(
                        item.reviewStatus || item.review_status || ""
                    ).toUpperCase();

                    return ["CONFIRMED", "COMPLETED"].includes(status);
                });

                const firstIntegration = confirmedIntegration || integrations[0];

                if (firstIntegration) {
                    const id = getId(firstIntegration);
                    if (id) setSelectedIntegrationId(id);
                }
            } catch (err) {
                if (active) {
                    setError(
                        err?.response?.data?.message ||
                        "Unable to load Provider Verification."
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
        if (!selectedIntegrationId) {
            setSelectedCredential(null);
            return;
        }

        let active = true;

        const loadCredentials = async () => {
            try {
                const records = await credentialHook.load(selectedIntegrationId);

                if (!active) return;

                const matching = records.find(
                    (item) =>
                        String(item.provider || "").toUpperCase() === provider
                );

                setSelectedCredential(matching || null);
            } catch (err) {
                if (active) {
                    setError(
                        err?.response?.data?.message ||
                        "Unable to load saved credential metadata."
                    );
                }
            }
        };

        loadCredentials();

        return () => {
            active = false;
        };
    }, [selectedIntegrationId, provider]);

    const integrations = integrationHook.integrations || [];
    const selectedIntegration = useMemo(
        () => integrations.find((item) => getId(item) === selectedIntegrationId),
        [integrations, selectedIntegrationId]
    );

    const integrationConfirmed = [
        "CONFIRMED",
        "COMPLETED",
    ].includes(
        String(
            selectedIntegration?.reviewStatus ||
            selectedIntegration?.review_status ||
            ""
        ).toUpperCase()
    );

    const verificationResult = result || verificationHook.result;
    const resultData = extractData(verificationResult);
    const capabilityRunId =
        resultData?.capabilityRunId ||
        resultData?.capability?.runId ||
        resultData?.capability?.id ||
        resultData?.capability_run_id ||
        null;

    const approvalRequired = Boolean(
        resultData?.approvalRequired || resultData?.approval_required
    );

    const approvalUrl =
        resultData?.approvalUrl || resultData?.approval_url || null;

    const credentialStatus =
        resultData?.credential?.status ||
        resultData?.credential?.credentialStatus ||
        resultData?.credentialStatus ||
        "UNKNOWN";

    const handleSaveCredentials = async (event) => {
        event.preventDefault();
        setError("");
        setMessage("");

        if (!selectedIntegrationId) {
            setError("Select an Integration Profile first.");
            return;
        }

        if (!integrationConfirmed) {
            setError("Confirm the Integration Profile before configuring verification.");
            return;
        }

        let credentials;

        if (provider === "PAYPAL") {
            if (!clientId.trim() || !clientSecret.trim()) {
                setError("PayPal Client ID and Client Secret are required.");
                return;
            }

            credentials = {
                clientId: clientId.trim(),
                clientSecret: clientSecret.trim(),
                ...(webhookId.trim() ? { webhookId: webhookId.trim() } : {}),
            };
        } else {
            if (
                !username.trim() ||
                !password.trim() ||
                !programToken.trim()
            ) {
                setError(
                    "Hyperwallet username, password and program token are required."
                );
                return;
            }

            credentials = {
                username: username.trim(),
                password: password.trim(),
                programToken: programToken.trim(),
            };
        }

        const payload = {
            provider,
            environment: "SANDBOX",
            credentials,
        };

        setSavingCredentials(true);

        try {
            if (selectedCredential?.id) {
                await credentialHook.update(
                    selectedIntegrationId,
                    selectedCredential.id,
                    {
                        provider,
                        credentials,
                    }
                );

                setMessage("Saved Sandbox credentials updated.");
            } else {
                await credentialHook.create(selectedIntegrationId, payload);
                setMessage("Sandbox credentials saved.");
            }

            const records = await credentialHook.load(selectedIntegrationId);
            const updated = records.find(
                (item) => String(item.provider || "").toUpperCase() === provider
            );

            setSelectedCredential(updated || null);

            // Clear secret inputs after successful save.
            setClientId("");
            setClientSecret("");
            setWebhookId("");
            setUsername("");
            setPassword("");
            setProgramToken("");
        } catch (err) {
            setError(
                err?.response?.data?.message ||
                "Unable to save Sandbox credentials."
            );
        } finally {
            setSavingCredentials(false);
        }
    };

    const handleStartVerification = async () => {
        setError("");
        setMessage("");
        setResult(null);

        if (!selectedIntegrationId || !integrationConfirmed) {
            setError("A confirmed Integration Profile is required.");
            return;
        }

        if (!selectedCredential?.id) {
            setError("Save Sandbox credentials before starting verification.");
            return;
        }

        const payload = { capabilityCode };

        if (capabilityCode === "RECIPIENT_MANAGEMENT") {
            try {
                const recipient = JSON.parse(recipientJSON);

                if (
                    !recipient ||
                    Array.isArray(recipient) ||
                    typeof recipient !== "object"
                ) {
                    throw new Error("Recipient input must be a JSON object.");
                }

                payload.sandboxInput = { recipient };
            } catch (err) {
                setError(err.message || "Recipient JSON is invalid.");
                return;
            }
        }

        setStarting(true);

        try {
            const response = await verificationHook.start(
                selectedCredential.id,
                payload
            );

            setResult(response);
            await verificationHook.loadRuns(projectId);

            const data = extractData(response);
            const runId =
                data?.capabilityRunId ||
                data?.capability?.runId ||
                data?.capability?.id;

            setMessage(
                runId
                    ? `Unified verification started. Capability run ID: ${runId}`
                    : "Unified verification request completed. Review the returned result below."
            );
        } catch (err) {
            setError(
                err?.response?.data?.message ||
                "Provider Verification failed."
            );
        } finally {
            setStarting(false);
        }
    };

    const handleResume = async () => {
        if (!capabilityRunId) {
            setError("The response does not contain a capability run ID to resume.");
            return;
        }

        setError("");
        setMessage("");
        setResuming(true);

        try {
            const response = await verificationHook.resume(capabilityRunId);
            setResult(response);
            await verificationHook.loadRuns(projectId);
            setMessage("The existing capability verification run was resumed.");
        } catch (err) {
            setError(
                err?.response?.data?.message ||
                "Unable to resume the capability verification run."
            );
        } finally {
            setResuming(false);
        }
    };

    if (pageLoading) {
        return <div className="p-8 text-slate-500">Loading Provider Verification...</div>;
    }

    if (!project) {
        return <div className="p-8 text-red-600">{error || "Project not found."}</div>;
    }

    const runs = verificationHook.runs || [];

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
                    Provider Verification
                </p>

                <h1 className="mt-2 text-3xl font-bold text-slate-900">
                    Verify provider Sandbox capabilities
                </h1>

                <p className="mt-2 text-sm text-slate-500">
                    Save provider credentials, authenticate against the Sandbox,
                    and execute the selected capability scenario in one workflow.
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
                <h2 className="font-semibold text-slate-900">Integration Profile</h2>

                <label className="mt-4 block text-sm font-medium text-slate-700">
                    Select confirmed Integration Profile
                    <select
                        value={selectedIntegrationId}
                        onChange={(event) => setSelectedIntegrationId(event.target.value)}
                        className="mt-2 w-full rounded-lg border border-slate-300 bg-white p-3"
                    >
                        <option value="">Select Integration Profile</option>
                        {integrations.map((item) => {
                            const id = getId(item);
                            return (
                                <option key={id} value={id}>
                                    {item.originalFilename ||
                                        item.original_filename ||
                                        id}{" "}
                                    · {item.reviewStatus || item.review_status || "Unknown"}
                                </option>
                            );
                        })}
                    </select>
                </label>

                {!integrationConfirmed && selectedIntegrationId && (
                    <p className="mt-3 text-sm text-amber-700">
                        This Integration Profile is not confirmed.{" "}
                        <Link
                            to={`/projects/${projectId}/integration`}
                            className="font-semibold underline"
                        >
                            Review and confirm it first.
                        </Link>
                    </p>
                )}

                <div className="mt-4 text-sm text-slate-600">
                    Provider: <strong>{provider}</strong> · Environment: <strong>SANDBOX</strong>
                </div>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h2 className="font-semibold text-slate-900">
                            Sandbox credential configuration
                        </h2>
                        <p className="mt-1 text-sm text-slate-500">
                            Existing secret values are never returned by the backend.
                            Enter new values when creating or updating credentials.
                        </p>
                    </div>

                    {selectedCredential && (
                        <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
                            Saved · Version {selectedCredential.credentialVersion || "—"}
                        </span>
                    )}
                </div>

                <form onSubmit={handleSaveCredentials} className="mt-5 space-y-4">
                    {provider === "PAYPAL" ? (
                        <>
                            <label className="block text-sm font-medium text-slate-700">
                                PayPal Client ID
                                <input
                                    value={clientId}
                                    onChange={(event) => setClientId(event.target.value)}
                                    autoComplete="off"
                                    className="mt-2 w-full rounded-lg border border-slate-300 p-3"
                                    placeholder="Enter Sandbox Client ID"
                                />
                            </label>

                            <label className="block text-sm font-medium text-slate-700">
                                PayPal Client Secret
                                <input
                                    type="password"
                                    value={clientSecret}
                                    onChange={(event) => setClientSecret(event.target.value)}
                                    autoComplete="new-password"
                                    className="mt-2 w-full rounded-lg border border-slate-300 p-3"
                                    placeholder="Enter Sandbox Client Secret"
                                />
                            </label>

                            <label className="block text-sm font-medium text-slate-700">
                                Webhook ID (optional)
                                <input
                                    value={webhookId}
                                    onChange={(event) => setWebhookId(event.target.value)}
                                    autoComplete="off"
                                    className="mt-2 w-full rounded-lg border border-slate-300 p-3"
                                    placeholder="Webhook ID"
                                />
                            </label>
                        </>
                    ) : (
                        <>
                            <label className="block text-sm font-medium text-slate-700">
                                Hyperwallet Username
                                <input
                                    value={username}
                                    onChange={(event) => setUsername(event.target.value)}
                                    autoComplete="off"
                                    className="mt-2 w-full rounded-lg border border-slate-300 p-3"
                                />
                            </label>

                            <label className="block text-sm font-medium text-slate-700">
                                Hyperwallet Password
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(event) => setPassword(event.target.value)}
                                    autoComplete="new-password"
                                    className="mt-2 w-full rounded-lg border border-slate-300 p-3"
                                />
                            </label>

                            <label className="block text-sm font-medium text-slate-700">
                                Hyperwallet Program Token
                                <input
                                    type="password"
                                    value={programToken}
                                    onChange={(event) => setProgramToken(event.target.value)}
                                    autoComplete="new-password"
                                    className="mt-2 w-full rounded-lg border border-slate-300 p-3"
                                />
                            </label>
                        </>
                    )}

                    <button
                        type="submit"
                        disabled={
                            savingCredentials ||
                            !selectedIntegrationId ||
                            !integrationConfirmed
                        }
                        className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                        {savingCredentials
                            ? "Saving..."
                            : selectedCredential
                                ? "Update Sandbox credentials"
                                : "Save Sandbox credentials"}
                    </button>
                </form>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-5">
                <h2 className="font-semibold text-slate-900">
                    Execute unified verification
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                    This single operation authenticates the saved credentials and,
                    after successful authentication, executes the selected capability.
                </p>

                <label className="mt-4 block text-sm font-medium text-slate-700">
                    Capability scenario
                    <select
                        value={capabilityCode}
                        onChange={(event) => setCapabilityCode(event.target.value)}
                        className="mt-2 w-full rounded-lg border border-slate-300 bg-white p-3"
                    >
                        <option value="PAYMENT_PROCESSING">Payment Processing</option>
                        <option value="RECIPIENT_MANAGEMENT">Recipient Management</option>
                        <option value="PAYMENT_DISBURSEMENT">Payment Disbursement</option>
                    </select>
                </label>

                {capabilityCode === "RECIPIENT_MANAGEMENT" && (
                    <label className="mt-4 block text-sm font-medium text-slate-700">
                        Sandbox recipient input (JSON)
                        <textarea
                            value={recipientJSON}
                            onChange={(event) => setRecipientJSON(event.target.value)}
                            rows={8}
                            spellCheck="false"
                            className="mt-2 w-full rounded-lg border border-slate-300 bg-slate-950 p-4 font-mono text-xs text-white"
                        />
                        <span className="mt-2 block text-xs text-slate-500">
                            The backend requires a recipient object for this capability.
                            Use the recipient fields expected by the selected provider's
                            Sandbox scenario.
                        </span>
                    </label>
                )}

                {capabilityCode === "PAYMENT_DISBURSEMENT" && (
                    <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
                        The backend builds the Hyperwallet Sandbox fixture using the
                        project's configured target country. This page does not send
                        a country override.
                    </p>
                )}

                <button
                    type="button"
                    onClick={handleStartVerification}
                    disabled={
                        starting ||
                        !selectedCredential?.id ||
                        !integrationConfirmed
                    }
                    className="mt-5 rounded-lg bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                    {starting ? "Running verification..." : "Verify Integration"}
                </button>
            </section>

            {verificationResult && (
                <section className="rounded-xl border border-slate-200 bg-white p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <h2 className="font-semibold text-slate-900">
                            Verification result
                        </h2>
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                            {String(credentialStatus).replaceAll("_", " ")}
                        </span>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <div className="rounded-lg bg-slate-50 p-3">
                            <p className="text-xs text-slate-500">Parent verification run ID</p>
                            <p className="mt-1 break-all text-xs font-medium text-slate-800">
                                {resultData?.verificationRunId || "—"}
                            </p>
                        </div>

                        <div className="rounded-lg bg-slate-50 p-3">
                            <p className="text-xs text-slate-500">Capability run ID</p>
                            <p className="mt-1 break-all text-xs font-medium text-slate-800">
                                {capabilityRunId || "Not created"}
                            </p>
                        </div>
                    </div>

                    {approvalRequired && (
                        <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4">
                            <h3 className="font-semibold text-amber-900">
                                Provider approval required
                            </h3>
                            <p className="mt-1 text-sm text-amber-800">
                                Complete the provider approval step, then resume this
                                existing capability run.
                            </p>

                            {approvalUrl && (
                                <a
                                    href={approvalUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="mt-3 inline-block text-sm font-semibold text-amber-900 underline"
                                >
                                    Open provider approval
                                </a>
                            )}

                            <div>
                                <button
                                    type="button"
                                    onClick={handleResume}
                                    disabled={resuming || !capabilityRunId}
                                    className="mt-4 rounded-lg bg-amber-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                                >
                                    {resuming ? "Resuming..." : "Resume capability verification"}
                                </button>
                            </div>
                        </div>
                    )}

                    <details className="mt-5">
                        <summary className="cursor-pointer text-sm font-semibold text-slate-700">
                            View complete verification response
                        </summary>
                        <pre className="mt-3 overflow-x-auto rounded-lg bg-slate-950 p-4 text-xs text-slate-100">
                            {pretty(verificationResult)}
                        </pre>
                    </details>

                    {capabilityRunId && (
                        <Link
                            to={`/verifications/${capabilityRunId}`}
                            className="mt-5 inline-block text-sm font-semibold text-indigo-600 hover:underline"
                        >
                            Open capability verification report →
                        </Link>
                    )}

                    {capabilityRunId && (
                        <Link
                            to={`/projects/${projectId}/gap-analysis`}
                            className="ml-5 inline-block text-sm font-semibold text-indigo-600 hover:underline"
                        >
                            Continue to AI Gap Analysis →
                        </Link>
                    )}
                </section>
            )}

            <section className="rounded-xl border border-slate-200 bg-white p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h2 className="font-semibold text-slate-900">
                            Project verification history
                        </h2>
                        <p className="mt-1 text-sm text-slate-500">
                            Previously persisted capability execution runs.
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={() => verificationHook.loadRuns(projectId)}
                        disabled={verificationHook.loading}
                        className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"
                    >
                        Refresh
                    </button>
                </div>

                {runs.length === 0 ? (
                    <p className="mt-4 text-sm text-slate-500">
                        No capability verification runs found for this project.
                    </p>
                ) : (
                    <div className="mt-4 divide-y divide-slate-100">
                        {runs.map((run, index) => {
                            const id = run.id || run.runId || run.run_id;
                            const status = getStatus(run);

                            return (
                                <div
                                    key={id || index}
                                    className="flex flex-wrap items-center justify-between gap-3 py-3"
                                >
                                    <div>
                                        <p className="break-all text-sm font-semibold text-slate-800">
                                            {id || `Run ${index + 1}`}
                                        </p>
                                        <p className="mt-1 text-xs text-slate-500">
                                            {run.provider || provider} ·{" "}
                                            {run.capabilityCode || run.capability_code || "Capability"}
                                        </p>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        <span className="text-xs font-semibold text-slate-600">
                                            {status.replaceAll("_", " ")}
                                        </span>
                                        {id && (
                                            <Link
                                                to={`/verifications/${id}`}
                                                className="text-sm font-semibold text-indigo-600 hover:underline"
                                            >
                                                Details
                                            </Link>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </section>
        </main>
    );
}