import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import api from "../../../api/axios";

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

const getData = (response) =>
    response?.data?.data || response?.data || response;

const getArray = (response, key) => {
    const data = getData(response);

    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.[key])) return data[key];

    return [];
};

const getId = (item) =>
    item?.id ||
    item?.integrationId ||
    item?.integration_id ||
    item?.runId ||
    item?.run_id ||
    item?.profileId ||
    item?.profile_id ||
    item?.intelligenceId ||
    item?.intelligence_id;

const getDate = (item) =>
    item?.createdAt ||
    item?.created_at ||
    item?.startedAt ||
    item?.started_at ||
    item?.completedAt ||
    item?.completed_at ||
    item?.lastResearchedAt ||
    item?.last_researched_at ||
    null;

const formatDate = (value) => {
    if (!value) return "—";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "—";

    return date.toLocaleString(undefined, {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
};

const getStatus = (item) => {
    const overall = item?.overallStatus || item?.overall_status;
    const general =
        item?.reviewStatus ||
        item?.review_status ||
        item?.status;
    const execution =
        item?.executionStatus ||
        item?.execution_status;

    if (
        String(overall || "").toUpperCase() === "FAILED" ||
        String(general || "").toUpperCase() === "FAILED"
    ) {
        return "FAILED";
    }

    return overall || general || execution || "UNKNOWN";
};

const statusClass = (status) => {
    const value = String(status || "UNKNOWN").toUpperCase();

    if (
        ["CONFIRMED", "VERIFIED", "SUCCESS", "PASSED", "COMPLETED"].includes(value)
    ) {
        return "border-emerald-200 bg-emerald-50 text-emerald-700";
    }

    if (["FAILED", "ERROR"].includes(value)) {
        return "border-red-200 bg-red-50 text-red-700";
    }

    if (["RUNNING", "IN_PROGRESS", "PROCESSING"].includes(value)) {
        return "border-blue-200 bg-blue-50 text-blue-700";
    }

    if (["QUEUED", "PENDING", "AWAITING_APPROVAL"].includes(value)) {
        return "border-amber-200 bg-amber-50 text-amber-700";
    }

    return "border-slate-200 bg-slate-50 text-black-600";
};

const formatStatus = (status) =>
    String(status || "UNKNOWN").replace(/_/g, " ");

const getInitials = (value) => {
    if (!value) return "—";

    return String(value)
        .split(/[\s_-]+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0].toUpperCase())
        .join("");
};

const getIntegrationName = (item, index) =>
    item?.originalFilename ||
    item?.original_filename ||
    item?.filename ||
    item?.name ||
    `Integration ${index + 1}`;

const getProviderName = (item) =>
    item?.providerName ||
    item?.provider_name ||
    item?.provider ||
    "Provider";

const getCountryName = (item) =>
    item?.countryName ||
    item?.country_name ||
    item?.countryCode ||
    item?.country_code ||
    item?.country ||
    "Country profile";

/* -------------------------------------------------------------------------- */
/* Small reusable components                                                  */
/* -------------------------------------------------------------------------- */

function StatusBadge({ status }) {
    return (
        <span
            className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded border px-2 py-1 text-[11px] font-medium ${statusClass(status)}`}
        >
           
            {formatStatus(status)}
        </span>
    );
}

function InformationItem({ label, value }) {
    return (
        <div className="min-w-0 border-l-2 border-slate-200 pl-3">
            <p className="text-xs text-black-500">{label}</p>
            <p className="mt-1 break-words text-sm font-semibold text-black-900">
                {value || "—"}
            </p>
        </div>
    );
}

function ModuleTabs({ tabs, activeTab, onChange }) {
    return (
        <div className="overflow-x-auto border-b border-slate-200">
            <div className="flex min-w-max items-center gap-6">
                {tabs.map((tab) => {
                    const active = activeTab === tab.id;

                    return (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => onChange(tab.id)}
                            className={`relative flex items-center gap-2 whitespace-nowrap pb-3 text-sm transition ${
                                active
                                    ? "font-semibold text-[#0089FA]"
                                    : "font-medium text-black-600 hover:text-black-900"
                            }`}
                        >
                            {tab.label}
                            <span
                                className={`text-xs ${
                                    active ? "text-indigo-700" : "text-black-400"
                                }`}
                            >
                                {tab.count}
                            </span>
                            {active && (
                                <span className="absolute inset-x-0 bottom-0 h-0.5 bg-[#0089FA]" />
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

function EmptyRecords({ title, description }) {
    return (
        <div className="py-12 text-center">
            <p className="text-sm font-medium text-black-800">{title}</p>
            <p className="mt-1 text-sm text-black-500">{description}</p>
        </div>
    );
}

function RecordRow({
    title,
    subtitle,
    date,
    status,
    action,
    onAction,
    initials,
    children,
}) {
    return (
        <article className="border-b border-slate-200 py-4 last:border-b-0">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                    

                    <div className="min-w-0">
                        <h3 className="break-words text-sm font-semibold text-black-900">
                            {title}
                        </h3>

                        {subtitle && (
                            <p className="mt-1 break-words text-sm text-black-500">
                                {subtitle}
                            </p>
                        )}

                        {children}

                        <p className="mt-1.5 text-xs text-black-400">
                            {formatDate(date)}
                        </p>
                    </div>
                </div>

                <div className="flex shrink-0 items-center gap-3 pl-12 sm:pl-0">
                    <StatusBadge status={status} />

                    {onAction && (
                        <button
                            type="button"
                            onClick={onAction}
                            className="whitespace-nowrap text-sm font-medium text-black-700 hover:text-indigo-900"
                        >
                            {action || "View"} →
                        </button>
                    )}
                </div>
            </div>
        </article>
    );
}

/* -------------------------------------------------------------------------- */
/* Integration Intelligence                                                   */
/* -------------------------------------------------------------------------- */

function IntegrationContent({ records, navigate }) {
    if (!records.length) {
        return (
            <EmptyRecords
                title="No integration records found"
                description="Uploaded source files and Integration Profiles will appear here."
            />
        );
    }

    return (
        <div>
            {records.map((item, index) => {
                const id = getId(item);
                const filename = getIntegrationName(item, index);
                const projectName =
                    item?.projectName ||
                    item?.project_name ||
                    item?.project?.name ||
                    "";
                const fileType = String(
                    item?.sourceType ||
                    item?.source_type ||
                    item?.fileType ||
                    item?.file_type ||
                    filename.split(".").pop() ||
                    "FILE"
                ).toUpperCase();

                return (
                    <RecordRow
                        key={id || index}
                        initials={fileType === "ZIP" ? "ZIP" : "FILE"}
                        title={filename}
                        subtitle={
                            projectName
                                ? `${fileType} · ${projectName}`
                                : fileType
                        }
                        date={getDate(item)}
                        status={getStatus(item)}
                        action="View profile"
                        onAction={
                            id
                                ? () => navigate(`/integrations/${id}`)
                                : undefined
                        }
                    />
                );
            })}
        </div>
    );
}

/* -------------------------------------------------------------------------- */
/* Country Intelligence                                                       */
/* -------------------------------------------------------------------------- */

function CountryContent({ records, navigate, projectId }) {
    if (!records.length) {
        return (
            <EmptyRecords
                title="No country intelligence records found"
                description="Completed target-country research profiles will appear here."
            />
        );
    }

    return (
        <div>
            {records.map((item, index) => {
                const code =
                    item?.countryCode ||
                    item?.country_code ||
                    item?.country ||
                    "";

                return (
                    <RecordRow
                        key={getId(item) || index}
                        initials={getInitials(code || getCountryName(item))}
                        title={getCountryName(item)}
                        subtitle="Target-country intelligence profile"
                        date={getDate(item)}
                        status={getStatus(item)}
                        action="View country report"
                        onAction={
                            getId(item)
                                ? () => navigate(`/projects/${projectId}/country-intelligence/${getId(item)}`)
                                : undefined
                        }
                    />
                );
            })}
        </div>
    );
}

/* -------------------------------------------------------------------------- */
/* Provider Verification                                                      */
/* -------------------------------------------------------------------------- */

function VerificationContent({ records, navigate }) {
    if (!records.length) {
        return (
            <EmptyRecords
                title="No verification runs found"
                description="Provider Sandbox execution results will appear here."
            />
        );
    }

    return (
        <div>
            {records.map((item, index) => {
                const id = getId(item);
                const provider = getProviderName(item);
                const capability =
                    item?.capabilityCode ||
                    item?.capability_code ||
                    item?.capability ||
                    "Provider verification";
                const projectName =
                    item?.projectName ||
                    item?.project_name ||
                    item?.project?.name ||
                    "";
                const environment =
                    item?.environment ||
                    item?.environmentName ||
                    item?.environment_name ||
                    "";

                return (
                    <RecordRow
                        key={id || index}
                        initials={getInitials(provider)}
                        title={`${provider} · ${capability}`}
                        subtitle={[projectName, environment].filter(Boolean).join(" · ")}
                        date={getDate(item)}
                        status={getStatus(item)}
                        action="View report"
                        onAction={
                            id
                                ? () => navigate(`/verifications/${id}`)
                                : undefined
                        }
                    />
                );
            })}
        </div>
    );
}

/* -------------------------------------------------------------------------- */
/* AI Gap Analysis                                                            */
/* -------------------------------------------------------------------------- */

function AnalysisContent({ records, navigate, projectId }) {
    if (!records.length) {
        return (
            <EmptyRecords
                title="No AI Gap Analysis reports found"
                description="Generated expansion assessment reports will appear here."
            />
        );
    }

    return (
        <div>
            {records.map((item, index) => {
                const report =
                    item?.report ||
                    item?.result?.report ||
                    item?.result ||
                    item?.analysis ||
                    item;

                const assessment =
                    report?.assessment ||
                    item?.assessment ||
                    {};

                const overallAssessment =
                    assessment?.overallAssessment ||
                    assessment?.overall_assessment ||
                    item?.overallAssessment ||
                    item?.overall_assessment ||
                    "";

                const summary =
                    assessment?.executiveSummary ||
                    assessment?.executive_summary ||
                    item?.executiveSummary ||
                    item?.executive_summary ||
                    item?.summary ||
                    "";

                const findings =
                    assessment?.findings ||
                    item?.findings ||
                    [];

                const risks =
                    assessment?.keyRisks ||
                    assessment?.key_risks ||
                    item?.keyRisks ||
                    item?.key_risks ||
                    [];

                return (
                    <RecordRow
                        key={getId(item) || index}
                        initials="AI"
                        title={item?.title || item?.name || "Expansion Gap Analysis"}
                        subtitle={
                            overallAssessment
                                ? `Overall assessment: ${String(overallAssessment).replace(/_/g, " ")}`
                                : "Expansion assessment report"
                        }
                        date={getDate(item)}
                        status={getStatus(item)}
                        action="View analysis"
                        onAction={
                            getId(item)
                                ? () => navigate(`/projects/${projectId}/ai-gap-analysis/${getId(item)}`)
                                : undefined
                        }
                    >
                        {summary && (
                            <p className="mt-2 max-w-3xl text-sm leading-5 text-black-600">
                                {summary}
                            </p>
                        )}

                        <p className="mt-2 text-xs text-black-500">
                            Findings: {Array.isArray(findings) ? findings.length : 0}
                            <span className="mx-2 text-black-300">·</span>
                            Key risks: {Array.isArray(risks) ? risks.length : 0}
                        </p>
                    </RecordRow>
                );
            })}
        </div>
    );
}

/* -------------------------------------------------------------------------- */
/* Main Page                                                                  */
/* -------------------------------------------------------------------------- */

export default function ProjectDetailsPage() {
    const { projectId } = useParams();
    const navigate = useNavigate();

    const [project, setProject] = useState(null);
    const [integrations, setIntegrations] = useState([]);
    const [countryProfiles, setCountryProfiles] = useState([]);
    const [verificationRuns, setVerificationRuns] = useState([]);
    const [analysisRuns, setAnalysisRuns] = useState([]);

    const [activeTab, setActiveTab] = useState("integration");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const loadProjectDetails = useCallback(async () => {
        setLoading(true);
        setError("");

        try {
            const projectResponse = await api.get(`/projects/${projectId}`);
            const projectData = getData(projectResponse);
            const projectRecord = projectData?.project || projectData;
            setProject(projectRecord);

            const providerCode = String(
                projectRecord?.provider || projectRecord?.providerName || projectRecord?.provider_name || ""
            ).toUpperCase();
            const needsCountryIntelligence = providerCode === "HYPERWALLET";

            const [integrationResponse, verificationResponse, countryResponse, overviewResponse] =
                await Promise.all([
                    api.get(`/integration/projects/${projectId}/integrations`),
                    api.get(`/capability-verification/projects/${projectId}/runs`),
                    needsCountryIntelligence
                        ? api.get(`/country-intelligence/${projectId}/country-intelligence`)
                        : Promise.resolve({ data: { profiles: [] } }),
                    api.get(`/projects/${projectId}/overview`),
                ]);

            setIntegrations(getArray(integrationResponse, "integrations"));
            setVerificationRuns(getArray(verificationResponse, "runs"));
            setCountryProfiles(needsCountryIntelligence ? getArray(countryResponse, "profiles") : []);

            const overview = getData(overviewResponse);
            const latestAnalysis =
                overview?.latestRuns?.aiGapAnalysis ||
                overview?.latestRecords?.aiGapAnalysis ||
                null;

            setAnalysisRuns(
                Array.isArray(latestAnalysis)
                    ? latestAnalysis
                    : latestAnalysis
                        ? [latestAnalysis]
                        : []
            );
        } catch (err) {
            setError(
                err?.response?.data?.message ||
                "Unable to load project details."
            );
        } finally {
            setLoading(false);
        }
    }, [projectId]);

    useEffect(() => {
        loadProjectDetails();
    }, [loadProjectDetails]);

    if (loading) {
        return (
            <main className="min-h-full bg-[#f8fafc] px-5 py-8 sm:px-8">
                <div className="mx-auto max-w-[1400px] animate-pulse">
                    <div className="h-3 w-28 rounded bg-slate-200" />
                    <div className="mt-4 h-7 w-72 rounded bg-slate-200" />
                    <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        {[1, 2, 3, 4].map((item) => (
                            <div key={item} className="h-24 rounded-md bg-white" />
                        ))}
                    </div>
                    <div className="mt-10 h-10 rounded bg-slate-200" />
                </div>
            </main>
        );
    }

    if (!project) {
        return (
            <main className="min-h-full bg-[#f8fafc] px-5 py-10 sm:px-8">
                <div className="mx-auto max-w-[1400px]">
                    <div className="border border-red-200 bg-white p-5">
                        <h2 className="font-semibold text-red-700">
                            Unable to open project
                        </h2>
                        <p className="mt-2 text-sm text-black-600">
                            {error || "Project not found."}
                        </p>
                        <Link
                            to="/projects"
                            className="mt-4 inline-flex text-sm font-medium text-indigo-700"
                        >
                            Back to projects →
                        </Link>
                    </div>
                </div>
            </main>
        );
    }

    const organizationId =
        project.organizationId ||
        project.organization_id;

    const provider =
        project.provider ||
        project.providerName ||
        project.provider_name ||
        "—";

    const integrationType =
        project.integrationType ||
        project.integration_type ||
        "—";

    const sourceCountry =
        project.sourceCountry ||
        project.source_country ||
        "—";

    const targetCountries =
        project.targetCountries ||
        project.target_countries ||
        [];

    const targetCountryText = Array.isArray(targetCountries)
        ? targetCountries.join(", ") || "—"
        : targetCountries || "—";

    const isPayPalProject = String(provider).toUpperCase() === "PAYPAL";
    const tabs = [
        { id: "integration", label: "Integration Intelligence", count: integrations.length },
        ...(!isPayPalProject ? [{ id: "country", label: "Country Intelligence", count: countryProfiles.length }] : []),
        { id: "verification", label: "Provider Verification", count: verificationRuns.length },
        { id: "analysis", label: "AI Gap Analysis", count: analysisRuns.length },
    ];

    // A previously selected Country tab may remain in component state after
    // switching projects. Fall back to Integration for PayPal projects.
    const visibleActiveTab = isPayPalProject && activeTab === "country" ? "integration" : activeTab;

    return (
        <main className="min-h-full bg-[#f8fafc] text-black-900">
            <div className="mx-auto w-full max-w-[1400px] space-y-8 px-5 py-7 sm:px-8 lg:px-10">

                {/* Page heading */}
                <header className="border-b border-slate-200 pb-5">
                    <div className="flex items-center gap-2 text-xs text-black-500">
                        <Link to="/projects" className="hover:text-indigo-700">
                            Projects
                        </Link>
                        <span>/</span>
                        {organizationId ? (
                            <Link
                                to={`/organizations/${organizationId}`}
                                className="hover:text-indigo-700"
                            >
                                Organization
                            </Link>
                        ) : (
                            <span>Workspace</span>
                        )}
                        <span>/</span>
                        <span className="text-black-700">Details</span>
                    </div>

                    <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
                        <div className="min-w-0">
                            <h1 className="break-words text-2xl font-medium tracking-tight text-black-900">
                                {project.name || "Project details"}
                            </h1>

                            <p className="mt-1.5 text-sm text-black-500">
                                {provider}
                                <span className="mx-2 text-black-300">·</span>
                                {integrationType}
                            </p>

                            {project.description && (
                                <p className="mt-2 max-w-3xl text-sm leading-5 text-black-600">
                                    {project.description}
                                </p>
                            )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            
                            <button
                                type="button"
                                onClick={() => navigate(`/projects/${projectId}/workflow`)}
                                className="inline-flex shrink-0 items-center gap-2 rounded-[3px] bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
                            >
                                + Start workflow
                            </button>
                        </div>
                    </div>
                </header>

                {error && (
                    <div className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                        {error}
                    </div>
                )}

                {/* Project information */}
                <section>
                    <h2 className="text-base font-semibold text-black-900">
                        Project information
                    </h2>

                    <p className="mt-1 text-sm text-black-500">
                        Configuration and target-market details for this project.
                    </p>

                    <div className="mt-4 grid gap-5 border-y border-slate-200 bg-white px-4 py-4 sm:grid-cols-2 lg:grid-cols-4">
                        <InformationItem label="Provider" value={provider} />
                        <InformationItem label="Integration type" value={integrationType} />
                        {!isPayPalProject && <InformationItem label="Source country" value={sourceCountry} />}
                        {!isPayPalProject && <InformationItem label="Target countries" value={targetCountryText} />}
                    </div>
                </section>

                {/* Previous records */}
                <section>
                    <div className="mb-4">
                        <h2 className="text-lg font-semibold text-black-900">
                            Previous records and reports
                        </h2>
                        <p className="mt-1 text-sm text-black-500">
                            Browse saved records and evidence for this project.
                        </p>
                    </div>

                    <ModuleTabs
                        tabs={tabs}
                        activeTab={visibleActiveTab}
                        onChange={setActiveTab}
                    />

                    <div className="min-h-40">
                        {visibleActiveTab === "integration" && (
                            <IntegrationContent
                                records={integrations}
                                navigate={navigate}
                            />
                        )}

                        {!isPayPalProject && visibleActiveTab === "country" && (
                            <CountryContent records={countryProfiles} navigate={navigate} projectId={projectId} />
                        )}

                        {visibleActiveTab === "verification" && (
                            <VerificationContent
                                records={verificationRuns}
                                navigate={navigate}
                            />
                        )}

                        {visibleActiveTab === "analysis" && (
                            <AnalysisContent records={analysisRuns} navigate={navigate} projectId={projectId} />
                        )}
                    </div>
                </section>

                {/* Footer */}
                <footer className="flex flex-col justify-between gap-2 border-t border-slate-200 pt-4 sm:flex-row sm:items-center">
                    <p className="text-xs text-black-500">
                        CheckRail · Project Workspace
                    </p>

                    <Link
                        to="/projects"
                        className="text-xs font-medium text-indigo-700 hover:text-indigo-900"
                    >
                        Back to all projects →
                    </Link>
                </footer>
            </div>
        </main>
    );
}
