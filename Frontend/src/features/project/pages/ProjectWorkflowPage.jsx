import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import useProjects from "../hook/useProjects";

const TERMINAL_COUNTRY_STATUSES = [
  "COMPLETED",
  "FAILED",
  "PARTIALLY_COMPLETED",
  "CANCELLED",
];

const getData = (response) =>
  response?.data?.data || response?.data || response;

const extractProject = (response) => {
  const data = getData(response);
  return data?.project || data;
};

const getError = (error, fallback) =>
  error?.response?.data?.message || error?.message || fallback;

const getIntegration = (response) => {
  const data = getData(response);
  return data?.integration || data;
};

const getCountryRun = (response) => {
  const data = getData(response);
  return data?.run || data;
};

const getVerificationResult = (response) => {
  const data = getData(response);
  return data?.result || data;
};

const getAnalysis = (response) => {
  const data = getData(response);
  return data?.analysis || data;
};

// execution_status describes whether the operation sequence finished.
// overall_status describes whether the capability actually succeeded.
// A finished execution can still be FAILED when one operation returned an error.
const getCapabilityOutcome = (capability, parent = null) => {
  const normalize = (value) => String(value ?? "").trim().toUpperCase();
  const failureValues = new Set([
    "FAILED",
    "ERROR",
    "CANCELLED",
    "REJECTED",
    "PARTIALLY_COMPLETED",
  ]);
  const successValues = new Set([
    "PASSED",
    "SUCCESS",
    "SUCCEEDED",
    "VERIFIED",
    "COMPLETED",
  ]);

  // Parent credential+capability workflow status is authoritative when present.
  // In particular, parentStatus=FAILED must never be hidden by executionStatus=COMPLETED.
  const parentStatus = normalize(
    parent?.parentStatus ||
      parent?.parent_status ||
      parent?.status ||
      parent?.credential?.parentStatus ||
      parent?.credential?.parent_status,
  );
  if (failureValues.has(parentStatus)) return "FAILED";
  if (!capability) return "UNKNOWN";

  const overallStatus = normalize(
    capability.overallStatus || capability.overall_status || capability.status,
  );
  const executionStatus = normalize(
    capability.executionStatus || capability.execution_status,
  );

  if (failureValues.has(overallStatus)) return "FAILED";

  const checks = Array.isArray(capability.checks) ? capability.checks : [];
  const checkStatuses = checks.map((check) => normalize(check?.status));

  if (checkStatuses.some((status) => failureValues.has(status))) {
    return "FAILED";
  }

  // Execution completion means the sequence stopped, not that every operation passed.
  if (executionStatus === "FAILED" || executionStatus === "CANCELLED") {
    return "FAILED";
  }

  const executionFinished =
    executionStatus === "COMPLETED" ||
    executionStatus === "SUCCEEDED" ||
    executionStatus === "SUCCESS";

  if (executionFinished) {
    // NOT_RUN / BLOCKED / missing statuses are not successful outcomes.
    if (checks.length > 0) {
      const allChecksPassed = checkStatuses.every((status) =>
        successValues.has(status),
      );
      return allChecksPassed ? "COMPLETED" : "FAILED";
    }

    // A persisted successful overall status is required when there are no checks.
    return successValues.has(overallStatus) ? "COMPLETED" : "UNKNOWN";
  }

  if (failureValues.has(executionStatus)) return "FAILED";
  if (["IN_PROGRESS", "PENDING", "RUNNING", "AWAITING_APPROVAL"].includes(executionStatus)) {
    return "IN_PROGRESS";
  }

  // A success overall status alone is insufficient while execution is not finished.
  return "UNKNOWN";
};

const prettyJSON = (value) => JSON.stringify(value ?? {}, null, 2);

const formatDate = (value) => {
  if (!value) return "—";

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
};

function StepStatus({ status }) {
  const styles = {
    NOT_STARTED: "bg-slate-100 text-slate-600",
    IN_PROGRESS: "bg-blue-50 text-blue-700",
    COMPLETED: "bg-green-50 text-green-700",
    FAILED: "bg-red-50 text-red-700",
    WAITING: "bg-amber-50 text-amber-700",
  };

  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-semibold ${
        styles[status] || styles.NOT_STARTED
      }`}
    >
      {String(status || "NOT_STARTED").replaceAll("_", " ")}
    </span>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  required = false,
}) {
  return (
    <label className="block text-sm font-medium text-slate-700">
      {label}
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
        autoComplete="off"
        className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
      />
    </label>
  );
}

function SectionHeading({ eyebrow, title, description }) {
  return (
    <div>
      {eyebrow && (
        <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600">
          {eyebrow}
        </p>
      )}
      <h2 className="mt-2 text-xl font-bold text-slate-900">{title}</h2>
      {description && (
        <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
      )}
    </div>
  );
}



const humanizeKey = (key) =>
  String(key)
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const isPlainObject = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);

function readProfileValue(object, ...keys) {
  for (const key of keys) {
    const value = object?.[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return null;
}

function IntegrationProfileModal({
  profile,
  onChange,
  onClose,
  onSave,
  onConfirm,
  saving,
  confirming,
  confirmed,
}) {
  const [editing, setEditing] = useState(false);
  const provider = isPlainObject(profile?.provider)
    ? profile.provider
    : { name: profile?.provider || profile?.paymentProvider || "Unknown provider" };
  const integration = profile?.integration || {};
  const architecture = profile?.architecture || {};
  const components = Array.isArray(architecture.components) ? architecture.components : [];
  const capabilities = Array.isArray(profile?.capabilities) ? profile.capabilities : [];
  const operations = Array.isArray(profile?.apiOperations || profile?.api_operations)
    ? (profile.apiOperations || profile.api_operations)
    : [];
  const configuration = Array.isArray(profile?.configuration) ? profile.configuration : [];
  const authentication = profile?.authentication || {};
  const limitations = [
    ...(Array.isArray(profile?.limitations) ? profile.limitations : []),
    ...(Array.isArray(architecture.limitations) ? architecture.limitations : []),
    ...(Array.isArray(authentication.limitations) ? authentication.limitations : []),
  ].filter((item, index, all) => {
    const value = typeof item === "string" ? item : item?.description || item?.message;
    return value && all.findIndex((candidate) => (typeof candidate === "string" ? candidate : candidate?.description || candidate?.message) === value) === index;
  });
  const updateProvider = (field, value) => onChange({
    ...profile,
    provider: { ...provider, [field]: value },
  });
  const updateIntegration = (field, value) => onChange({
    ...profile,
    integration: { ...integration, [field]: value },
  });
  const textValue = (value) => typeof value === "string" ? value : value == null ? "" : String(value);
  const fieldClass = "mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100";
  const sourceName = (component) => component?.name || component?.path || component?.file || "Source file";
  const confidence = String(provider.confidence || architecture.confidence || "NOT ASSESSED").replaceAll("_", " ");

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/65 p-2 backdrop-blur-sm sm:p-5" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="integration-profile-title" className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-7">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-indigo-600">Integration Intelligence</p>
            <h2 id="integration-profile-title" className="mt-1 text-xl font-bold text-slate-950 sm:text-2xl">Integration profile</h2>
            <p className="mt-1 text-sm text-slate-500">A developer-focused view of the payment implementation detected in the uploaded source.</p>
          </div>
          <button type="button" onClick={onClose} className="shrink-0 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">Close ×</button>
        </header>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto bg-slate-50/70 px-5 py-5 sm:px-7">
          <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Detected integration</p>
                <h3 className="mt-1 text-lg font-bold text-slate-950">{textValue(provider.name || provider.providerName || "Provider not identified")}</h3>
                <p className="mt-1 text-sm text-slate-500">{textValue(readProfileValue(integration, "description") || architecture.description || "No integration description was provided.")}</p>
              </div>
              <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">{confidence}</span>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">Payment flow</p><p className="mt-1 text-sm font-semibold text-slate-900">{textValue(readProfileValue(integration, "type", "integrationType", "integration_type") || profile?.integrationType || profile?.paymentFlow || "Not identified")}</p></div>
              <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">Environment</p><p className="mt-1 text-sm font-semibold text-slate-900">{textValue(readProfileValue(integration, "environment") || "Not established")}</p></div>
              <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">Integration method</p><p className="mt-1 text-sm font-semibold text-slate-900">{textValue(readProfileValue(integration, "integrationMethod", "integration_method", "method") || "Not established")}</p></div>
            </div>
            {editing && (
              <div className="mt-4 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2">
                <label className="text-xs font-semibold text-slate-600">Provider name<input className={fieldClass} value={textValue(provider.name)} onChange={(event) => updateProvider("name", event.target.value)} /></label>
                <label className="text-xs font-semibold text-slate-600">Payment flow<input className={fieldClass} value={textValue(readProfileValue(integration, "type", "integrationType", "integration_type") || "")} onChange={(event) => updateIntegration("type", event.target.value)} /></label>
                <label className="text-xs font-semibold text-slate-600">Environment<input className={fieldClass} value={textValue(integration.environment)} onChange={(event) => updateIntegration("environment", event.target.value)} placeholder="e.g. Sandbox" /></label>
                <label className="text-xs font-semibold text-slate-600">Integration method<input className={fieldClass} value={textValue(integration.integrationMethod || integration.integration_method || integration.method)} onChange={(event) => updateIntegration("integrationMethod", event.target.value)} placeholder="e.g. REST API" /></label>
                <label className="text-xs font-semibold text-slate-600 sm:col-span-2">Description<textarea className={fieldClass} rows={2} value={textValue(integration.description)} onChange={(event) => updateIntegration("description", event.target.value)} /></label>
              </div>
            )}
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3"><h3 className="font-semibold text-slate-950">Detected architecture</h3><span className="text-xs text-slate-500">{components.length} source files</span></div>
            {components.length ? <div className="mt-3 divide-y divide-slate-100">
              {components.map((component, index) => <div key={`${sourceName(component)}-${index}`} className="flex flex-wrap items-start justify-between gap-2 py-3 first:pt-1">
                <div className="min-w-0"><p className="break-all font-mono text-sm font-semibold text-slate-900">{sourceName(component)}</p><p className="mt-1 text-sm text-slate-500">{component.responsibility || component.description || "Payment-related source identified."}</p></div>
                {component.type && <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">{String(component.type).replaceAll("_", " ")}</span>}
              </div>)}
            </div> : <p className="mt-3 text-sm text-slate-500">No architecture components were identified.</p>}
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3"><h3 className="font-semibold text-slate-950">Payment capabilities</h3><span className="text-xs text-slate-500">{capabilities.length} detected</span></div>
            {capabilities.length ? <div className="mt-3 grid gap-3 sm:grid-cols-2">{capabilities.map((item, index) => <div key={`${item.capability || item.name || index}`} className="rounded-lg border border-slate-200 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold text-slate-900">{String(item.capability || item.name || "Capability").replaceAll("_", " ")}</p><span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-800">{String(item.assessment || "NOT ASSESSED").replaceAll("_", " ")}</span></div><p className="mt-2 text-sm text-slate-600">{item.description || "No capability description was returned."}</p><p className="mt-2 text-xs text-slate-500">Confidence: {String(item.confidence || "Not assessed").replaceAll("_", " ")}</p></div>)}</div> : <p className="mt-3 text-sm text-slate-500">No payment capabilities were identified.</p>}
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3"><h3 className="font-semibold text-slate-950">API operations detected</h3><span className="text-xs text-slate-500">{operations.length} operations</span></div>
            {operations.length ? <div className="mt-3 space-y-3">{operations.map((operation, index) => <div key={`${operation.method || operation.name || index}`} className="rounded-lg border border-slate-200 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><span className="rounded-md bg-slate-100 px-2 py-1 font-mono text-xs font-bold text-slate-800">{operation.method || operation.name || "HTTP"}</span><span className="text-sm font-semibold text-slate-900">{operation.client || operation.request?.client || "HTTP client"}</span></div><span className="text-xs text-slate-500">{String(operation.assessment || "OBSERVED").replaceAll("_", " ")}</span></div><div className="mt-3 grid gap-2 sm:grid-cols-2"><div><p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Endpoint</p><p className="mt-1 text-sm text-slate-700">{typeof operation.endpoint === "string" && !["template-literal", "dynamic", "object-expression"].includes(operation.endpoint) ? operation.endpoint : "Dynamic endpoint — not resolved by static analysis"}</p></div><div><p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Request body</p><p className="mt-1 text-sm text-slate-700">{operation.bodyExpression || operation.body_expression || operation.request?.body || "Not established"}</p></div></div><p className="mt-2 text-xs text-slate-500">Headers detected: {Array.isArray(operation.headers || operation.request?.headers) ? (operation.headers || operation.request.headers).map((header) => typeof header === "string" ? header : header.name).filter(Boolean).join(", ") || "None" : "Not provided"}. Header values are intentionally hidden.</p></div>)}</div> : <p className="mt-3 text-sm text-slate-500">No API operations were identified.</p>}
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-semibold text-slate-950">Authentication and configuration</h3><span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">{String(authentication.assessment || "INFERRED").replaceAll("_", " ")}</span></div>
            <p className="mt-1 text-sm text-slate-600">{authentication.description || "Configuration declarations were detected, but runtime credential use has not been established."}</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">{configuration.map((item, index) => <div key={`${item.key || item.name || index}`} className="rounded-lg bg-slate-50 p-3"><p className="font-mono text-sm font-semibold text-slate-900">{item.key || item.name || "Configuration entry"}</p><p className="mt-1 text-xs text-slate-500">{item.sensitive ? "Sensitive value hidden" : item.source || item.category || "Configuration reference detected"} · {String(item.assessment || "OBSERVED").replaceAll("_", " ")}</p></div>)}</div>
            <div className="mt-3 rounded-lg border border-amber-100 bg-amber-50/60 p-3"><p className="text-sm font-semibold text-amber-950">Runtime behavior not established</p><p className="mt-1 text-sm leading-6 text-amber-900">Static declarations do not prove valid authentication, token acquisition or refresh, successful API responses, or end-to-end transaction execution.</p></div>
          </section>

          {limitations.length > 0 && <details className="rounded-xl border border-slate-200 bg-white p-4"><summary className="cursor-pointer text-sm font-semibold text-slate-700">Analysis boundaries ({limitations.length})</summary><ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-600">{limitations.slice(0, 5).map((item, index) => <li key={index}>{typeof item === "string" ? item : item.description || item.message || "Additional limitation recorded."}</li>)}</ul>{limitations.length > 5 && <p className="mt-2 text-xs text-slate-500">{limitations.length - 5} additional limitations retained in the profile data.</p>}</details>}
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white px-5 py-4 sm:px-7">
          <p className="text-xs text-slate-500">Evidence identifiers remain linked internally; this report shows source names and engineering findings.</p>
          <div className="flex flex-wrap gap-2">
            {!confirmed && <button type="button" onClick={() => setEditing((value) => !value)} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">{editing ? "Done editing" : "Edit profile"}</button>}
            <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Close</button>
            {!confirmed && <><button type="button" onClick={onSave} disabled={saving || confirming} className="rounded-lg border border-indigo-200 px-4 py-2.5 text-sm font-semibold text-indigo-700 hover:bg-indigo-50 disabled:opacity-50">{saving ? "Saving..." : "Save changes"}</button><button type="button" onClick={onConfirm} disabled={saving || confirming} className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">{confirming ? "Confirming..." : "Confirm profile"}</button></>}
          </div>
        </footer>
      </section>
    </div>
  );
}

function CountryIntelligenceModal({ profile, onClose }) {
  const country = profile?.country || {};
  const categories = Array.isArray(profile?.categories) ? profile.categories : [];
  const requirements = categories.flatMap((category) => (category.requirements || []).map((item) => ({ ...item, categoryName: category.name || category.code || "General" })));
  const sourceCount = profile?.profile?.totalSources ?? requirements.reduce((count, item) => count + (item.evidence || []).length, 0);
  const groups = categories.length ? categories : [{ name: "Country requirements", requirements }];
  const evidenceLabel = (value) => String(value || "NOT ASSESSED").replaceAll("_", " ");

  return (
    <div className="fixed inset-0 z-[115] flex items-center justify-center bg-slate-950/65 p-2 backdrop-blur-sm sm:p-5" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="country-report-title" className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-7"><div><p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-indigo-600">Country Intelligence</p><h2 id="country-report-title" className="mt-1 text-xl font-bold text-slate-950 sm:text-2xl">{country.name || profile?.countryName || "Country profile"} {country.code || profile?.countryCode ? `(${country.code || profile.countryCode})` : ""}</h2><p className="mt-1 text-sm text-slate-500">Market requirements relevant to payment collection, disbursement and operations.</p></div><button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600">Close ×</button></header>
        <div className="grid grid-cols-2 gap-3 border-b border-slate-200 bg-slate-50 px-5 py-4 sm:grid-cols-3 sm:px-7"><div className="rounded-lg bg-white p-3"><p className="text-xs text-slate-500">Requirements</p><p className="mt-1 text-xl font-bold text-slate-950">{profile?.profile?.totalRequirements ?? requirements.length}</p></div><div className="rounded-lg bg-white p-3"><p className="text-xs text-slate-500">Research sources</p><p className="mt-1 text-xl font-bold text-slate-950">{sourceCount}</p></div><div className="col-span-2 rounded-lg bg-white p-3 sm:col-span-1"><p className="text-xs text-slate-500">Requirement domains</p><p className="mt-1 text-xl font-bold text-slate-950">{categories.length}</p></div></div>
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto bg-slate-50/60 px-5 py-5 sm:px-7">
          {groups.map((category, categoryIndex) => <section key={`${category.code || category.name || categoryIndex}`} className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5"><div className="flex items-center justify-between gap-3"><h3 className="font-semibold text-slate-950">{category.name || "Requirements"}</h3><span className="text-xs text-slate-500">{(category.requirements || []).length} items</span></div><div className="mt-3 space-y-3">{(category.requirements || []).map((requirement, index) => { const key = requirement.id || `${categoryIndex}-${index}`; const evidence = Array.isArray(requirement.evidence) ? requirement.evidence : []; const applicable = requirement.applicability || requirement.applicabilityStatus || requirement.applicability_status; return <article key={key} className="rounded-lg border border-slate-200 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h4 className="text-sm font-semibold leading-6 text-slate-950">{requirement.title || "Untitled requirement"}</h4></div><div className="flex flex-wrap gap-2"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700">Research: {evidenceLabel(requirement.evidenceStatus || requirement.evidence_status)}</span><span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700">{applicable ? evidenceLabel(applicable) : "Applicability not assessed"}</span></div></div><p className="mt-2 text-xs text-slate-500">Research confidence: {evidenceLabel(requirement.confidence)} · {evidence.length} sources</p><details className="mt-3 border-t border-slate-100 pt-3"><summary className="cursor-pointer text-xs font-semibold text-indigo-700">View requirement details and sources</summary><p className="mt-3 text-sm leading-6 text-slate-600">{requirement.description || "No requirement description was returned."}</p>{evidence.length > 0 && <ul className="mt-3 space-y-2">{evidence.map((item, evidenceIndex) => <li key={item.id || evidenceIndex} className="text-sm"><p className="font-medium text-slate-800">{item.sourceName || item.title || item.domain || "Research source"}</p>{item.url && <a href={item.url} target="_blank" rel="noreferrer" className="text-xs text-indigo-700 hover:underline">Open source ↗</a>}</li>)}</ul>}</details></article>; })}</div></section>)}
          <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">A confirmed country-research finding confirms that a requirement was identified in research. It does not prove that the marketplace has satisfied that requirement. Applicability and the marketplace's compliance evidence must be assessed separately.</p>
        </div>
        <footer className="flex justify-end border-t border-slate-200 bg-white px-5 py-3 sm:px-7"><button type="button" onClick={onClose} className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white">Done</button></footer>
      </section>
    </div>
  );
}

function ProviderVerificationModal({ verification, onClose }) {
  const data = verification?.capability || verification?.run || verification || {};
  const checks = Array.isArray(data.checks) ? [...data.checks].sort((a, b) => (a.execution_order || 0) - (b.execution_order || 0)) : [];
  const evidence = Array.isArray(data.evidence) ? data.evidence : [];
  const outcome = getCapabilityOutcome(data, verification);
  const [selectedCheck, setSelectedCheck] = useState(null);
  const selected = checks.find((item) => item.id === selectedCheck) || null;
  const selectedEvidence = selected ? evidence.filter((item) => item.check_id === selected.id).map((item) => ({ type: item.evidence_type, method: item.http_method, endpoint: item.endpoint, httpStatus: item.http_status, resourceId: item.resource_id, observedAt: item.observed_at, metadata: item.metadata && Object.keys(item.metadata).length ? item.metadata : undefined })) : [];
  const operationJson = selected ? { operation: selected.operation, status: selected.status, message: selected.message, providerHttpStatus: selected.provider_status, providerResource: selected.resource_id || undefined, attemptCount: selected.attempt_count, evidence: selectedEvidence } : null;
  const duration = data.started_at && data.completed_at ? Math.max(0, Math.round((new Date(data.completed_at) - new Date(data.started_at)) / 1000)) : null;
  const statusTone = (status) => ["PASSED", "COMPLETED", "VERIFIED"].includes(String(status).toUpperCase()) ? "bg-green-50 text-green-700" : String(status).toUpperCase() === "FAILED" ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-700";

  return (
    <div className="fixed inset-0 z-[115] flex items-center justify-center bg-slate-950/65 p-2 backdrop-blur-sm sm:p-5" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="provider-report-title" className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-5 py-4 sm:px-7"><div><p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-indigo-600">Provider Capability Verification</p><h2 id="provider-report-title" className="mt-1 text-xl font-bold text-slate-950 sm:text-2xl">{data.provider || "Provider"} · {String(data.capability_code || data.capabilityCode || "Capability").replaceAll("_", " ")}</h2><p className="mt-1 text-sm text-slate-500">{data.environment || "Sandbox"} execution results and operation-level evidence.</p></div><div className="flex items-center gap-2"><span className={`rounded-full px-3 py-1.5 text-xs font-bold ${statusTone(outcome)}`}>{outcome.replaceAll("_", " ")}</span><button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600">Close ×</button></div></header>
        <div className="grid grid-cols-3 gap-3 border-b border-slate-200 bg-slate-50 px-5 py-4 sm:px-7"><div className="rounded-lg bg-white p-3"><p className="text-xs text-slate-500">Passed operations</p><p className="mt-1 text-xl font-bold text-slate-950">{checks.filter((item) => String(item.status).toUpperCase() === "PASSED").length}/{checks.length}</p></div><div className="rounded-lg bg-white p-3"><p className="text-xs text-slate-500">Execution progress</p><p className="mt-1 text-xl font-bold text-slate-950">{data.progress_percent ?? (checks.length ? Math.round(checks.filter((item) => item.status !== "NOT_RUN").length / checks.length * 100) : 0)}%</p></div><div className="rounded-lg bg-white p-3"><p className="text-xs text-slate-500">Duration</p><p className="mt-1 text-xl font-bold text-slate-950">{duration === null ? "—" : `${duration}s`}</p></div></div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7"><div className="mb-4 flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold text-slate-950">Tested operation lifecycle</h3><p className="text-xs text-slate-500">Select an operation to inspect its technical response.</p></div>
          {checks.length ? <ol className="space-y-3">{checks.map((check, index) => <li key={check.id || index} className="rounded-xl border border-slate-200 bg-white p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div className="flex min-w-0 items-start gap-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-700">{check.execution_order || index + 1}</span><div className="min-w-0"><h4 className="text-sm font-semibold text-slate-950">{String(check.operation || "Operation").replaceAll("_", " ")}</h4><p className="mt-1 text-sm leading-6 text-slate-600">{check.message || "No operation message was returned."}</p><p className="mt-2 text-xs text-slate-500">Provider response: HTTP {check.provider_status ?? "—"} · Attempts: {check.attempt_count ?? 1}</p></div></div><span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${statusTone(check.status)}`}>{check.status || "UNKNOWN"}</span></div><div className="mt-3 flex justify-end"><button type="button" onClick={() => setSelectedCheck((current) => current === check.id ? null : check.id)} className="text-xs font-semibold text-indigo-700 hover:text-indigo-900">{selectedCheck === check.id ? "Hide technical details" : "View operation JSON"}</button></div>{selectedCheck === check.id && <pre className="mt-3 max-h-80 overflow-auto rounded-lg border border-slate-200 bg-white p-4 font-mono text-sm leading-6 text-black shadow-inner">{JSON.stringify(operationJson, null, 2)}</pre>}</li>)}</ol> : <p className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-500">No operation checks were returned for this verification run.</p>}
          <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4"><h3 className="text-sm font-semibold text-slate-900">Verification boundary</h3><p className="mt-1 text-sm leading-6 text-slate-600">This run proves the listed operations in the provider's {data.environment || "Sandbox"} environment. It does not by itself prove that the uploaded marketplace application uses the same credentials, executes the same flow, or is approved for production.</p></div>
        </div>
        <footer className="flex justify-end border-t border-slate-200 bg-white px-5 py-3 sm:px-7"><button type="button" onClick={onClose} className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white">Done</button></footer>
      </section>
    </div>
  );
}


function ReportStatusBadge({ value }) {
  const status = String(value || "ASSESSMENT UNAVAILABLE").replaceAll("_", " ").toUpperCase();
  const tone = status === "READY"
    ? "border-green-200 bg-green-50 text-green-800"
    : status === "READY WITH CONDITIONS"
      ? "border-amber-200 bg-amber-50 text-amber-800"
      : status === "NOT READY"
        ? "border-red-200 bg-red-50 text-red-800"
        : "border-slate-200 bg-slate-100 text-slate-700";

  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-bold tracking-wide ${tone}`}>
      {status}
    </span>
  );
}

function ReportModal({ report, assessment, onClose, onRefresh }) {
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const findings = Array.isArray(assessment?.findings) ? assessment.findings : [];
  const findingGroups = [
    { title: "High priority", tone: "border-red-200 bg-red-50/50", items: findings.filter((item) => /CRITICAL|HIGH/.test(String(item.priority || item.severity || "").toUpperCase())) },
    { title: "Needs attention", tone: "border-amber-200 bg-amber-50/40", items: findings.filter((item) => /MEDIUM/.test(String(item.priority || item.severity || "").toUpperCase())) },
    { title: "Other findings", tone: "border-slate-200 bg-slate-50", items: findings.filter((item) => !/CRITICAL|HIGH|MEDIUM/.test(String(item.priority || item.severity || "").toUpperCase())) },
  ].filter((group) => group.items.length > 0);
  const risks = Array.isArray(assessment?.keyRisks) ? assessment.keyRisks : [];
  const assumptions = Array.isArray(assessment?.assumptions) ? assessment.assumptions : [];
  const limitations = Array.isArray(assessment?.limitations) ? assessment.limitations : [];

  const renderListValue = (item) => {
    if (typeof item === "string" || typeof item === "number") return String(item);
    if (item && typeof item === "object") {
      return item.title || item.description || item.message || prettyJSON(item);
    }
    return String(item ?? "—");
  };

  const detailFields = (finding) => [
    ["Requirement", finding.requirementTitle || finding.requirement_title || (isPlainObject(finding.requirement) ? finding.requirement.title : null) || (typeof finding.requirement === "string" && !/^(country_requirement:)?[0-9a-f-]{30,}$/i.test(finding.requirement) ? finding.requirement : null)],
    ["Observed state", finding.observedState || finding.observed_state],
    ["Business impact", finding.businessImpact || finding.business_impact],
    ["Recommendation", finding.recommendation],
    ["Rationale", finding.rationale],
    ["Confidence", finding.confidence],
  ].filter(([, value]) => value !== undefined && value !== null && value !== "");

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/65 p-2 backdrop-blur-sm sm:p-5"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="analysis-report-title"
        className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl"
      >
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-8">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-indigo-600">CorridorGate · Assessment</p>
            <h2 id="analysis-report-title" className="mt-1 text-xl font-bold tracking-tight text-slate-950 sm:text-2xl">
              Expansion readiness report
            </h2>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <ReportStatusBadge value={assessment?.overallAssessment} />
            <button
              type="button"
              onClick={onClose}
              aria-label="Close report"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Close <span aria-hidden="true">×</span>
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-8">
          <section className="border-b border-slate-200 pb-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-base font-semibold text-slate-950">Overall assessment</h3>
              <span className="text-xs text-slate-500">Based on the evidence available at the time of this run</span>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <ReportStatusBadge value={assessment?.overallAssessment} />
              {assessment?.confidence && (
                <span className="text-sm text-slate-600">Confidence: {String(assessment.confidence)}</span>
              )}
            </div>
            <div className="mt-5">
              <h4 className="text-sm font-semibold text-slate-800">Executive summary</h4>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-700">
                {assessment?.executiveSummary || "No executive summary was returned."}
              </p>
            </div>
          </section>

          <section className="border-b border-slate-200 py-6">
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="text-base font-semibold text-slate-950">Key risks</h3>
              <span className="text-xs text-slate-500">{risks.length} identified</span>
            </div>
            {risks.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">No key risks were identified in the returned assessment.</p>
            ) : (
              <ol className="mt-3 space-y-3">
                {risks.map((risk, index) => (
                  <li key={index} className="border-l-2 border-amber-400 py-1 pl-4 text-sm leading-6 text-slate-700">
                    <span className="mr-2 text-xs font-semibold text-amber-700">{String(index + 1).padStart(2, "0")}</span>
                    {renderListValue(risk)}
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section className="border-b border-slate-200 py-6">
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="text-base font-semibold text-slate-950">Assessment findings</h3>
              <span className="text-xs text-slate-500">{findings.length} findings</span>
            </div>
            {findings.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">No findings were returned in the assessment.</p>
            ) : (
              <div className="mt-3 space-y-4">
                {findingGroups.map((group) => (
                  <section key={group.title} className={`rounded-xl border p-3 sm:p-4 ${group.tone}`}>
                    <div className="mb-2 flex items-center justify-between gap-2"><h4 className="text-sm font-semibold text-slate-900">{group.title}</h4><span className="text-xs text-slate-500">{group.items.length} findings</span></div>
                    <div className="divide-y divide-slate-200/80">
                  {group.items.map((finding, index) => (
                  <article key={finding.id || `${group.title}-${index}`} className="py-5 first:pt-3 last:pb-1">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Finding {String(index + 1).padStart(2, "0")}</p>
                        <h4 className="mt-1 text-sm font-semibold leading-6 text-slate-950">
                          {finding.title || `Finding ${index + 1}`}
                        </h4>
                        {finding.category && (
                          <p className="mt-1 text-xs text-slate-500">{String(finding.category).replaceAll("_", " ")}</p>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {finding.severity && <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-800">{String(finding.severity).replaceAll("_", " ")}</span>}
                        {finding.status && <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">{String(finding.status).replaceAll("_", " ")}</span>}
                      </div>
                    </div>

                    {(finding.recommendation || finding.action) && (
                      <div className="mt-4 rounded-lg border border-indigo-100 bg-indigo-50/60 p-3">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-indigo-700">Recommended action</p>
                        <p className="mt-1 text-sm leading-6 text-slate-800">{finding.recommendation || finding.action}</p>
                      </div>
                    )}
                    {detailFields(finding).filter(([label]) => !["Recommendation"].includes(label)).length > 0 && (
                      <details className="mt-3 rounded-lg border border-slate-200 p-3">
                        <summary className="cursor-pointer text-xs font-semibold text-slate-600">Technical rationale and assessment details</summary>
                        <dl className="mt-3 grid gap-x-8 gap-y-4 sm:grid-cols-2">
                          {detailFields(finding).filter(([label]) => label !== "Recommendation").map(([label, value]) => (
                            <div key={label}>
                              <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{label}</dt>
                              <dd className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-700">{typeof value === "object" ? JSON.stringify(value, null, 2) : String(value)}</dd>
                            </div>
                          ))}
                        </dl>
                      </details>
                    )}
                    {Array.isArray(finding.evidenceRefs || finding.evidence_refs) && (finding.evidenceRefs || finding.evidence_refs).some((ref) => ref && typeof ref === "object" && (ref.sourceName || ref.fileName || ref.path || ref.title)) && (
                      <div className="mt-3"><p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Supporting sources</p><ul className="mt-2 space-y-1 text-xs text-slate-600">{(finding.evidenceRefs || finding.evidence_refs).filter((ref) => ref && typeof ref === "object" && (ref.sourceName || ref.fileName || ref.path || ref.title)).map((ref, refIndex) => <li key={refIndex}>{ref.sourceName || ref.fileName || ref.path || ref.title}</li>)}</ul></div>
                    )}
                    {Array.isArray(finding.caveats) && finding.caveats.length > 0 && (
                      <p className="mt-3 text-xs leading-5 text-amber-800">Caveat: {finding.caveats.map(renderListValue).join(" · ")}</p>
                    )}
                  </article>
                ))}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </section>

          <section className="grid gap-6 border-b border-slate-200 py-6 sm:grid-cols-2">
            <div>
              <h3 className="text-base font-semibold text-slate-950">Assumptions</h3>
              {assumptions.length ? (
                <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
                  {assumptions.map((item, index) => <li key={index} className="flex gap-2"><span className="text-slate-400">—</span><span>{renderListValue(item)}</span></li>)}
                </ul>
              ) : <p className="mt-3 text-sm text-slate-500">No assumptions were recorded.</p>}
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-950">Limitations</h3>
              {limitations.length ? (
                <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
                  {limitations.map((item, index) => <li key={index} className="flex gap-2"><span className="text-slate-400">—</span><span>{renderListValue(item)}</span></li>)}
                </ul>
              ) : <p className="mt-3 text-sm text-slate-500">No limitations were recorded.</p>}
            </div>
          </section>

          {report?.evidenceSummary && (
            <section className="border-b border-slate-200 py-6">
              <h3 className="text-base font-semibold text-slate-950">Evidence coverage</h3>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {Object.entries(report.evidenceSummary).filter(([, value]) => value !== null && ["string", "number", "boolean"].includes(typeof value)).map(([key, value]) => <div key={key} className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">{humanizeKey(key)}</p><p className="mt-1 text-lg font-semibold text-slate-950">{String(value)}</p></div>)}
              </div>
              <details className="mt-3 rounded-lg border border-slate-200 p-3"><summary className="cursor-pointer text-xs font-semibold text-slate-600">View assessment evidence JSON</summary><pre className="mt-3 max-h-72 overflow-auto rounded-lg border border-slate-200 bg-white p-4 font-mono text-sm leading-6 text-black">{prettyJSON(report.evidenceSummary)}</pre></details>
            </section>
          )}

          {report?.disclaimer && (
            <section className="pt-5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Important note</h3>
              <p className="mt-2 text-xs leading-6 text-slate-500">{report.disclaimer}</p>
            </section>
          )}
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-5 py-3 sm:px-8">
          <p className="text-xs text-slate-500">This report reflects the evidence and records available for this assessment run.</p>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onRefresh} className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">Refresh report</button>
            <button type="button" onClick={onClose} className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">Done</button>
          </div>
        </footer>
      </section>
    </div>
  );
}


export default function ProjectWorkflowPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const workflowMode = searchParams.get("mode") || "resume";
  const storageKey = `corridorgate:workflow:${projectId}`;

  const workflow = useProjects();

  const mountedRef = useRef(true);
  const restoredRef = useRef(false);
  const finishingRef = useRef(false);

  const [project, setProject] = useState(null);
  const [pageLoading, setPageLoading] = useState(true);

  const [activeStep, setActiveStep] = useState(1);
  const [stepStatuses, setStepStatuses] = useState({
    1: "NOT_STARTED",
    2: "NOT_STARTED",
    3: "NOT_STARTED",
    4: "NOT_STARTED",
  });

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // --------------------------------------------------
  // Step 1: Integration Intelligence
  // --------------------------------------------------

  const [sourceFile, setSourceFile] = useState(null);
  const [uploadingSource, setUploadingSource] = useState(false);
  const [integration, setIntegration] = useState(null);
  const [profileText, setProfileText] = useState("{}");
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [confirmingProfile, setConfirmingProfile] = useState(false);

  // --------------------------------------------------
  // Step 2: Country Intelligence
  // --------------------------------------------------

  const [countryRun, setCountryRun] = useState(null);
  const [countryRunning, setCountryRunning] = useState(false);
  const [countryProfiles, setCountryProfiles] = useState([]);
  const [countryReportProfile, setCountryReportProfile] = useState(null);

  // --------------------------------------------------
  // Step 3: Provider Verification
  // --------------------------------------------------

  const [credential, setCredential] = useState(null);
  const [editingCredential, setEditingCredential] = useState(false);
  const [savingCredential, setSavingCredential] = useState(false);

  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [webhookId, setWebhookId] = useState("");

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [programToken, setProgramToken] = useState("");

  const [capabilityCode, setCapabilityCode] = useState("PAYMENT_PROCESSING");
  const [recipientJSON, setRecipientJSON] = useState("{}");

  const [verificationResult, setVerificationResult] = useState(null);
  const [verificationRunning, setVerificationRunning] = useState(false);
  const [resumingVerification, setResumingVerification] = useState(false);
  const [providerReportOpen, setProviderReportOpen] = useState(false);

  // --------------------------------------------------
  // Step 4: AI Gap Analysis
  // --------------------------------------------------

  const [analysis, setAnalysis] = useState(null);
  const [analysisRunning, setAnalysisRunning] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);

  // --------------------------------------------------
  // Restore an in-progress workflow after reload.
  //
  // Only non-secret identifiers and UI progress are stored locally.
  // Integration profiles, credentials metadata, country profiles,
  // capability runs and AI reports are reloaded from backend APIs.
  // Credential secrets are NEVER persisted in browser storage.
  // --------------------------------------------------

  useEffect(() => {
    mountedRef.current = true;
    restoredRef.current = false;

    const resetWorkflowState = () => {
      setIntegration(null);
      setCredential(null);
      setCountryRun(null);
      setCountryProfiles([]);
      setVerificationResult(null);
      setAnalysis(null);
      setStepStatuses({
        1: "NOT_STARTED",
        2: "NOT_STARTED",
        3: "NOT_STARTED",
        4: "NOT_STARTED",
      });
      setActiveStep(1);
    };

    const loadProjectAndRestore = async () => {
      setPageLoading(true);
      setError("");
      setNotice("");
      setProject(null);
      resetWorkflowState();

      try {
        const projectResponse = await workflow.getProject(projectId);

        if (!mountedRef.current) return;

        const loadedProject = extractProject(projectResponse);
        setProject(loadedProject);

        // "new" is a one-time command, not a persistent page mode.
        // Clear the previous browser pointer once, then replace the URL with
        // mode=resume. Otherwise every browser reload would execute this
        // branch again and erase the workflow progress being saved.
        if (workflowMode === "new") {
          localStorage.removeItem(storageKey);
          restoredRef.current = true;
          setNotice(
            "A new workflow is ready. Existing project records were not deleted."
          );

          navigate(
            `/projects/${projectId}/workflow?mode=resume`,
            { replace: true }
          );

          return;
        }

        let saved = null;

        try {
          const raw = localStorage.getItem(storageKey);
          saved = raw ? JSON.parse(raw) : null;
        } catch {
          localStorage.removeItem(storageKey);
        }

        if (!saved || saved.projectId !== projectId) {
          restoredRef.current = true;
          setNotice("No saved in-progress workflow was found. You can start a new assessment.");
          return;
        }

        const restoredStatuses = {
          1: saved.stepStatuses?.[1] || "NOT_STARTED",
          2: saved.stepStatuses?.[2] || "NOT_STARTED",
          3: saved.stepStatuses?.[3] || "NOT_STARTED",
          4: saved.stepStatuses?.[4] || "NOT_STARTED",
        };

        // Restore the confirmed or pending Integration Profile.
        if (saved.integrationId) {
          try {
            const response = await workflow.getIntegrationPreview(saved.integrationId);
            const record = getIntegration(response);

            if (mountedRef.current && record?.id) {
              setIntegration(record);
              setProfileText(prettyJSON(record.profile || {}));

              const reviewStatus = String(
                record.reviewStatus || record.review_status || ""
              ).toUpperCase();

              restoredStatuses[1] = ["CONFIRMED", "COMPLETED"].includes(reviewStatus)
                ? "COMPLETED"
                : "IN_PROGRESS";
            }
          } catch (restoreError) {
            console.warn("Unable to restore Integration Profile:", restoreError);
          }
        }

        // Restore safe credential metadata only. Secret values are not returned
        // by this endpoint and are never stored in localStorage.
        if (saved.integrationId && saved.credentialId) {
          try {
            const response = await workflow.getCredentials(saved.integrationId);
            const data = getData(response);
            const records = Array.isArray(data)
              ? data
              : data?.credentials ||
                (data?.credential ? [data.credential] : []);

            const existingCredential = records.find(
              (item) => item.id === saved.credentialId
            ) || records[0];

            if (mountedRef.current && existingCredential) {
              setCredential(existingCredential);
              restoredStatuses[3] =
                saved.stepStatuses?.[3] || "IN_PROGRESS";
            }
          } catch (restoreError) {
            console.warn("Unable to restore credential metadata:", restoreError);
          }
        }

        // Restore Country Intelligence run and individual country profiles.
        if (saved.countryRunId) {
          try {
            const response = await workflow.getCountryRun(projectId, saved.countryRunId);
            const run = getCountryRun(response);

            if (mountedRef.current && run) {
              setCountryRun(run);
              const status = String(run.status || "").toUpperCase();
              restoredStatuses[2] =
                status === "COMPLETED"
                  ? "COMPLETED"
                  : ["FAILED", "PARTIALLY_COMPLETED", "CANCELLED"].includes(status)
                    ? "FAILED"
                    : "IN_PROGRESS";
            }
          } catch (restoreError) {
            console.warn("Unable to restore Country Intelligence run:", restoreError);
          }
        }

        if (Array.isArray(saved.countryProfileIds) && saved.countryProfileIds.length) {
          const profileResponses = await Promise.allSettled(
            saved.countryProfileIds.map((id) =>
              workflow.getCountryProfile(projectId, id)
            )
          );

          const profiles = profileResponses
            .filter((item) => item.status === "fulfilled")
            .map((item) => getData(item.value));

          if (mountedRef.current) {
            setCountryProfiles(profiles);
          }
        }

        // Restore the capability execution run. This ID is the child
        // capability_verification_runs ID used by resume and AI Gap Analysis.
        if (saved.capabilityRunId) {
          try {
            const response = await workflow.getCapabilityRun(saved.capabilityRunId);
            const data = getData(response);
            const run = data?.run || data;

            if (mountedRef.current && run) {
              setVerificationResult({
                capabilityRunId: saved.capabilityRunId,
                capability: run,
                approvalRequired: Boolean(saved.approvalRequired),
                approvalUrl: saved.approvalUrl || null,
              });

              const capabilityOutcome = getCapabilityOutcome(run);

              restoredStatuses[3] =
                capabilityOutcome === "COMPLETED"
                  ? "COMPLETED"
                  : capabilityOutcome === "FAILED"
                    ? "FAILED"
                    : saved.approvalRequired
                      ? "WAITING"
                      : "IN_PROGRESS";
            }
          } catch (restoreError) {
            console.warn("Unable to restore capability verification run:", restoreError);
          }
        }

        // Restore the latest AI Gap Analysis report.
        if (saved.analysisRunId) {
          try {
            const response = await workflow.getAnalysisRun(projectId, saved.analysisRunId);
            const result = getAnalysis(response);

            if (mountedRef.current && result) {
              setAnalysis(result);

              const analysisStatus = String(result.status || "").toUpperCase();
              restoredStatuses[4] =
                analysisStatus === "COMPLETED" && result.report
                  ? "COMPLETED"
                  : ["FAILED", "CANCELLED"].includes(analysisStatus)
                    ? "FAILED"
                    : "IN_PROGRESS";
            }
          } catch (restoreError) {
            console.warn("Unable to restore AI Gap Analysis:", restoreError);
          }
        }

        if (!mountedRef.current) return;

        setStepStatuses(restoredStatuses);

        const requestedStep = Number(saved.activeStep || 1);
        const nextStep =
          restoredStatuses[4] === "COMPLETED"
            ? 4
            : restoredStatuses[3] === "COMPLETED"
              ? 4
              : restoredStatuses[2] === "COMPLETED" ||
                  (String(loadedProject?.provider || "").toUpperCase() === "PAYPAL" &&
                    restoredStatuses[1] === "COMPLETED")
                ? 3
                : restoredStatuses[1] === "COMPLETED"
                  ? 2
                  : 1;

        const normalizedRequestedStep =
          String(loadedProject?.provider || "").toUpperCase() === "PAYPAL" && requestedStep === 2
            ? 3
            : requestedStep;
        const visibleStepIndexes = String(loadedProject?.provider || "").toUpperCase() === "PAYPAL"
          ? [1, 3, 4]
          : [1, 2, 3, 4];

        setActiveStep(
          Number.isInteger(normalizedRequestedStep) && visibleStepIndexes.includes(normalizedRequestedStep)
            ? normalizedRequestedStep
            : nextStep
        );

        setNotice("Your previous workflow has been restored. Continue from where you left off.");
        restoredRef.current = true;
      } catch (err) {
        if (mountedRef.current) {
          setError(getError(err, "Unable to load and restore this workflow."));
          restoredRef.current = true;
        }
      } finally {
        if (mountedRef.current) {
          setPageLoading(false);
        }
      }
    };

    loadProjectAndRestore();

    return () => {
      mountedRef.current = false;
    };
  }, [projectId, workflowMode, storageKey, navigate]);

  const provider = String(project?.provider || "").toUpperCase();

  const isPayPal = provider === "PAYPAL";
  const isHyperwallet = provider === "HYPERWALLET";

  const targetCountries =
    project?.targetCountries || project?.target_countries || [];

  const targetCountryList = Array.isArray(targetCountries)
    ? targetCountries
    : [];

  // PayPal marketplace testing has no target-market expansion context.
  // Keep the existing internal step indexes for backward-compatible restore,
  // but expose only the three relevant stages in its workflow UI.
  const workflowSteps = isPayPal
    ? [
        { index: 1, number: "01", title: "Integration Intelligence", description: "Upload, analyse and confirm your integration." },
        { index: 3, number: "02", title: "Provider Verification", description: "Authenticate and execute Sandbox capabilities." },
        { index: 4, number: "03", title: "AI Gap Analysis", description: "Review implementation gaps and runtime evidence." },
      ]
    : [
        { index: 1, number: "01", title: "Integration Intelligence", description: "Upload, analyse and confirm your integration." },
        { index: 2, number: "02", title: "Country Intelligence", description: "Research the configured target countries." },
        { index: 3, number: "03", title: "Provider Verification", description: "Authenticate and execute Sandbox capabilities." },
        { index: 4, number: "04", title: "AI Gap Analysis", description: "Generate the evidence-based assessment." },
      ];
  const activeStagePosition = workflowSteps.findIndex((step) => step.index === activeStep);
  const activeStageNumber = activeStagePosition >= 0 ? activeStagePosition + 1 : 1;
  const totalWorkflowStages = workflowSteps.length;
  const nextWorkflowStep = workflowSteps[activeStagePosition + 1]?.index ?? null;
  const previousWorkflowStep = workflowSteps[activeStagePosition - 1]?.index ?? null;

  const integrationId = integration?.id || null;

  const integrationStatus = String(
    integration?.reviewStatus || integration?.review_status || "",
  ).toUpperCase();

  const integrationConfirmed = ["CONFIRMED", "COMPLETED"].includes(
    integrationStatus,
  );

  const verificationData = getVerificationResult(verificationResult);

  const capabilityRunId =
    verificationData?.capabilityRunId ||
    verificationData?.capability?.runId ||
    verificationData?.capability?.id ||
    verificationData?.capability_run_id ||
    null;

  const approvalRequired = Boolean(
    verificationData?.approvalRequired || verificationData?.approval_required,
  );

  const approvalUrl =
    verificationData?.approvalUrl || verificationData?.approval_url || null;

  const verificationStatus = getCapabilityOutcome(
    verificationData?.capability,
    verificationData,
  );

  const completedCapability = verificationStatus === "COMPLETED";

  const countryStatus = String(countryRun?.status || "").toUpperCase();

  // PARTIALLY_COMPLETED is not equivalent to a completed country profile.
  // Hyperwallet analysis checks the individual target-country profile below.
  const countryCompleted = countryStatus === "COMPLETED";

  const analysisData = getAnalysis(analysis);
  const report = analysisData?.report || null;
  // The backend stores AI-generated fields under report.assessment.
  // Evidence summary and disclaimer remain at the report root.
  const assessment = report?.assessment || report || {};

  // Persist only IDs and progress markers. Never store credentials/secrets.
  useEffect(() => {
    if (!restoredRef.current || !projectId || finishingRef.current) return;

    const snapshot = {
      projectId,
      activeStep,
      stepStatuses,
      integrationId: integration?.id || null,
      countryRunId: countryRun?.runId || countryRun?.run_id || null,
      countryProfileIds: countryProfiles
        .map((profile) => profile.id || profile.intelligenceId)
        .filter(Boolean),
      credentialId: credential?.id || null,
      capabilityRunId:
        verificationData?.capabilityRunId ||
        verificationData?.capability?.runId ||
        verificationData?.capability?.id ||
        verificationData?.capability_run_id ||
        null,
      approvalRequired: Boolean(
        verificationData?.approvalRequired ||
        verificationData?.approval_required
      ),
      approvalUrl:
        verificationData?.approvalUrl ||
        verificationData?.approval_url ||
        null,
      analysisRunId:
        analysisData?.id ||
        analysisData?.runId ||
        analysisData?.run_id ||
        null,
      updatedAt: new Date().toISOString(),
    };

    try {
      localStorage.setItem(storageKey, JSON.stringify(snapshot));
    } catch (storageError) {
      console.warn("Unable to persist workflow progress:", storageError);
    }
  }, [
    projectId,
    storageKey,
    activeStep,
    stepStatuses,
    integration,
    countryRun,
    countryProfiles,
    credential,
    verificationData,
    analysisData,
  ]);

  const setStepStatus = (step, status) => {
    setStepStatuses((previous) => ({
      ...previous,
      [step]: status,
    }));
  };

  const clearMessages = () => {
    setError("");
    setNotice("");
  };

  const goToStep = (step) => {
    clearMessages();
    setActiveStep(step);
  };

  // --------------------------------------------------
  // Step 1: Upload source
  // --------------------------------------------------

  const handleUploadSource = async (event) => {
    event.preventDefault();
    clearMessages();

    if (!sourceFile) {
      setError("Select a ZIP file before uploading.");
      return;
    }

    if (!sourceFile.name.toLowerCase().endsWith(".zip")) {
      setError("Only ZIP files are currently accepted by the backend.");
      return;
    }

    setUploadingSource(true);
    setStepStatus(1, "IN_PROGRESS");

    try {
      const formData = new FormData();
      formData.append("file", sourceFile);

      const response = await workflow.uploadIntegration(projectId, formData);

      const record = getIntegration(response);

      if (!record?.id) {
        throw new Error(
          "The upload response did not contain an Integration Profile ID.",
        );
      }

      setIntegration(record);
      setProfileText(prettyJSON(record.profile || {}));
      setSourceFile(null);
      setStepStatus(1, "IN_PROGRESS");

      setNotice(
        "Source analysed successfully. Review the generated Integration Profile before confirming it.",
      );
    } catch (err) {
      setStepStatus(1, "FAILED");
      setError(getError(err, "Unable to upload and analyse the source."));
    } finally {
      setUploadingSource(false);
    }
  };

  // --------------------------------------------------
  // Step 1: Save edited profile
  // --------------------------------------------------

  const handleSaveProfile = async () => {
    clearMessages();

    if (!integrationId) {
      setError("Upload and analyse an integration source first.");
      return false;
    }

    let profile;

    try {
      profile = JSON.parse(profileText);
    } catch {
      setError("The Integration Profile data is invalid.");
      return false;
    }

    if (!profile || Array.isArray(profile) || typeof profile !== "object") {
      setError("The Integration Profile must be a structured object.");
      return false;
    }

    setSavingProfile(true);

    try {
      const response = await workflow.updateIntegrationProfile(integrationId, profile);

      const updated = getIntegration(response);

      setIntegration((previous) => ({
        ...previous,
        ...updated,
        profile: updated?.profile || profile,
      }));

      setProfileText(prettyJSON(updated?.profile || profile));
      setNotice("Integration Profile changes saved.");
      return true;
    } catch (err) {
      setError(getError(err, "Unable to save the Integration Profile."));
      return false;
    } finally {
      setSavingProfile(false);
    }
  };

  // --------------------------------------------------
  // Step 1: Confirm profile
  // --------------------------------------------------

  const handleConfirmProfile = async () => {
    clearMessages();

    if (!integrationId) {
      setError("No Integration Profile is available to confirm.");
      return;
    }

    setConfirmingProfile(true);

    try {
      const response = await workflow.confirmIntegration(integrationId);

      const refreshed = await workflow.getIntegrationPreview(integrationId);

      const updated = getIntegration(refreshed);

      setIntegration(updated);

      const status = String(
        updated?.reviewStatus || updated?.review_status || "",
      ).toUpperCase();

      if (!["CONFIRMED", "COMPLETED"].includes(status)) {
        const responseData = getData(response);
        const responseStatus = String(
          responseData?.integration?.reviewStatus ||
            responseData?.reviewStatus ||
            "",
        ).toUpperCase();

        if (!["CONFIRMED", "COMPLETED"].includes(responseStatus)) {
          throw new Error(
            "The backend did not return a confirmed Integration Profile. Check the integration review status.",
          );
        }
      }

      setStepStatus(1, "COMPLETED");
      setNotice(
        isHyperwallet
          ? "Integration Profile confirmed. Continue to Country Intelligence."
          : "Integration Profile confirmed. You can run Country Intelligence or continue directly to Provider Verification.",
      );
    } catch (err) {
      setStepStatus(1, "FAILED");
      setError(getError(err, "Unable to confirm the Integration Profile."));
    } finally {
      setConfirmingProfile(false);
    }
  };

  // --------------------------------------------------
  // Step 2: Country Intelligence
  // --------------------------------------------------

  const handleStartCountryIntelligence = async () => {
    clearMessages();

    if (isPayPal) {
      setError("Country Intelligence is not part of the PayPal marketplace integration workflow.");
      return;
    }

    if (targetCountryList.length === 0) {
      setError(
        "This project has no target countries configured. Configure target countries in the project before running Country Intelligence.",
      );
      return;
    }

    setCountryRunning(true);
    setStepStatus(2, "IN_PROGRESS");
    setCountryRun(null);
    setCountryProfiles([]);

    try {
      const startResponse = await workflow.startCountryIntelligence(projectId);

      const started = getCountryRun(startResponse);
      const runId = started?.runId || started?.run_id;

      if (!runId) {
        throw new Error(
          "The Country Intelligence start response did not contain a run ID.",
        );
      }

      setCountryRun(started);

      let latestRun = started;
      let finished = false;
      let attempts = 0;

      while (!finished && attempts < 180) {
        attempts += 1;

        const currentStatus = String(latestRun?.status || "").toUpperCase();

        if (TERMINAL_COUNTRY_STATUSES.includes(currentStatus)) {
          finished = true;
          break;
        }

        await new Promise((resolve) => window.setTimeout(resolve, 3000));

        if (!mountedRef.current) return;

        const runResponse = await workflow.getCountryRun(projectId, runId);

        latestRun = getCountryRun(runResponse);
        setCountryRun(latestRun);
      }

      if (!finished) {
        throw new Error(
          "Country Intelligence is still processing. You can leave this page and check the run later from project details.",
        );
      }

      const finalStatus = String(latestRun?.status || "").toUpperCase();

      if (finalStatus === "FAILED") {
        throw new Error("Country Intelligence run failed.");
      }

      const completedCountries = (latestRun?.countries || []).filter(
        (country) => country.intelligenceId || country.intelligence_id,
      );

      const profileResponses = await Promise.allSettled(
        completedCountries.map((country) => {
          const id = country.intelligenceId || country.intelligence_id;

          return workflow.getCountryProfile(projectId, id);
        }),
      );

      const profiles = profileResponses
        .filter((item) => item.status === "fulfilled")
        .map((item) => getData(item.value));

      setCountryProfiles(profiles);

      if (finalStatus === "COMPLETED") {
        setStepStatus(2, "COMPLETED");
        setNotice(
          "Country Intelligence completed. Review the country research results below.",
        );
      } else {
        setStepStatus(2, "FAILED");
        setNotice(
          "Country Intelligence finished with partial results. Review each target-country profile; incomplete countries must be researched again before Hyperwallet Gap Analysis.",
        );
      }
    } catch (err) {
      setStepStatus(2, "FAILED");
      setError(getError(err, "Country Intelligence failed."));
    } finally {
      setCountryRunning(false);
    }
  };

  // --------------------------------------------------
  // Step 3: Save credentials
  // --------------------------------------------------

  const handleSaveCredentials = async (event) => {
    event.preventDefault();
    clearMessages();

    if (!integrationConfirmed || !integrationId) {
      setError(
        "Confirm the Integration Profile before configuring provider credentials.",
      );
      return;
    }

    if (!isPayPal && !isHyperwallet) {
      setError(
        `Provider "${provider || "UNKNOWN"}" is not supported by this verification form.`,
      );
      return;
    }

    let credentials;

    if (isPayPal) {
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
      if (!username.trim() || !password.trim() || !programToken.trim()) {
        setError(
          "Hyperwallet username, password and program token are required.",
        );
        return;
      }

      credentials = {
        username: username.trim(),
        password: password.trim(),
        programToken: programToken.trim(),
      };
    }

    setSavingCredential(true);

    try {
      const payload = {
        provider,
        environment: "SANDBOX",
        credentials,
      };

      const response = credential?.id
        ? await workflow.updateCredentials(integrationId, credential.id, { provider, credentials })
        : await workflow.createCredentials(integrationId, payload);

      const data = getData(response);
      setCredential(data?.credential || data?.data?.credential || data);
      setEditingCredential(false);

      setClientId("");
      setClientSecret("");
      setWebhookId("");
      setUsername("");
      setPassword("");
      setProgramToken("");

      setNotice("Sandbox credentials saved securely.");
    } catch (err) {
      const status = err?.response?.status;

      if (status === 409) {
        setError(
          "Credentials already exist for this Integration Profile. Reload the project workflow to retrieve the saved credential record, then enter the replacement secret values to update it.",
        );
      } else {
        setError(getError(err, "Unable to save Sandbox credentials."));
      }
    } finally {
      setSavingCredential(false);
    }
  };

  // --------------------------------------------------
  // Step 3: Unified credential + capability verification
  // --------------------------------------------------

  // The unified verification POST returns the capabilityRunId. Use that child
  // run ID to retrieve the persisted execution record until it reaches a
  // terminal state. This is the same run used by resume and AI Gap Analysis.
  const pollCapabilityExecution = async (runId, initialResult = {}) => {
    let latestRun = initialResult?.capability || null;
    let status = String(
      latestRun?.executionStatus ||
        latestRun?.execution_status ||
        latestRun?.overallStatus ||
        latestRun?.overall_status ||
        latestRun?.status ||
        ""
    ).toUpperCase();

    const terminalStatuses = ["COMPLETED", "FAILED", "CANCELLED"];
    let attempts = 0;

    while (!terminalStatuses.includes(status) && attempts < 120) {
      if (!mountedRef.current) return latestRun;

      await new Promise((resolve) => window.setTimeout(resolve, 3000));
      if (!mountedRef.current) return latestRun;

      const response = await workflow.getCapabilityRun(runId);
      const data = getData(response);
      latestRun = data?.run || data?.capability || data;
      status = String(
        latestRun?.executionStatus ||
          latestRun?.execution_status ||
          latestRun?.overallStatus ||
          latestRun?.overall_status ||
          latestRun?.status ||
          ""
      ).toUpperCase();
      attempts += 1;

      setVerificationResult((previous) => ({
        ...(previous || initialResult),
        capabilityRunId: runId,
        capability: latestRun,
      }));
    }

    return latestRun;
  };

  const handleStartVerification = async () => {
    clearMessages();

    if (!credential?.id) {
      setError("Save Sandbox credentials before starting verification.");
      return;
    }

    if (!integrationConfirmed) {
      setError("A confirmed Integration Profile is required.");
      return;
    }

    const payload = {
      capabilityCode,
    };

    if (capabilityCode === "RECIPIENT_MANAGEMENT") {
      let recipient;

      try {
        recipient = JSON.parse(recipientJSON);
      } catch {
        setError("Recipient JSON is invalid.");
        return;
      }

      if (
        !recipient ||
        Array.isArray(recipient) ||
        typeof recipient !== "object"
      ) {
        setError("Recipient input must be a JSON object.");
        return;
      }

      payload.sandboxInput = { recipient };
    }

    setVerificationRunning(true);
    setStepStatus(3, "IN_PROGRESS");

    try {
      const response = await workflow.startVerification(credential.id, payload);

      const result = getVerificationResult(response);

      setVerificationResult(result);

      const runId =
        result?.capabilityRunId ||
        result?.capability?.runId ||
        result?.capability?.id ||
        result?.capability_run_id;

      const approval = Boolean(
        result?.approvalRequired || result?.approval_required,
      );

      if (runId && !approval) {
        const latestRun = await pollCapabilityExecution(runId, result);
        if (latestRun) {
          result.capability = latestRun;
          result.capabilityRunId = runId;
          setVerificationResult(result);
        }
      }

      const capabilityStatus = getCapabilityOutcome(
        result?.capability,
        result,
      );

      if (approval) {
        setStepStatus(3, "WAITING");
        setNotice(
          "Provider approval is required. Complete the provider approval step, then resume this capability run.",
        );
      } else if (runId && capabilityStatus === "COMPLETED") {
        setStepStatus(3, "COMPLETED");
        setNotice(
          "Provider authentication and capability execution completed.",
        );
      } else if (runId && capabilityStatus === "FAILED") {
        setStepStatus(3, "FAILED");
        setError(
          "Provider authentication succeeded, but one or more capability operations failed. Review the failed operation and its provider error before continuing.",
        );
      } else if (runId) {
        setStepStatus(3, "IN_PROGRESS");
        setNotice(
          "Verification run created. Review the returned execution status and evidence.",
        );
      } else {
        setStepStatus(3, "FAILED");
        setError(
          "The verification response did not contain a capability run ID. Check the backend response.",
        );
      }
    } catch (err) {
      setStepStatus(3, "FAILED");
      setError(getError(err, "Provider Verification failed."));
    } finally {
      setVerificationRunning(false);
    }
  };

  // --------------------------------------------------
  // Step 3: Resume the same capability run
  // --------------------------------------------------

  const handleResumeVerification = async () => {
    clearMessages();

    if (!capabilityRunId) {
      setError("No capability run ID is available to resume.");
      return;
    }

    setResumingVerification(true);

    try {
      const response = await workflow.resumeVerification(capabilityRunId);

      const result = getVerificationResult(response);
      const resumedRunId =
        result?.capabilityRunId ||
        result?.capability?.runId ||
        result?.capability?.id ||
        capabilityRunId;

      const resumedApprovalRequired = Boolean(
        result?.approvalRequired || result?.approval_required
      );

      if (resumedRunId && !resumedApprovalRequired) {
        const latestRun = await pollCapabilityExecution(resumedRunId, result);
        if (latestRun) {
          result.capabilityRunId = resumedRunId;
          result.capability = latestRun;
        }
      }

      setVerificationResult(result);

      const capabilityStatus = getCapabilityOutcome(
        result?.capability,
        result,
      );

      if (capabilityStatus === "COMPLETED") {
        setStepStatus(3, "COMPLETED");
        setNotice("The existing capability verification run completed.");
      } else if (capabilityStatus === "FAILED") {
        setStepStatus(3, "FAILED");
        setError(
          "The resumed capability run finished with failed operations. Review the provider error in the execution evidence.",
        );
      } else {
        setStepStatus(3, "IN_PROGRESS");
        setNotice(
          "The capability run was resumed. Review its latest execution status.",
        );
      }
    } catch (err) {
      setError(getError(err, "Unable to resume capability verification."));
    } finally {
      setResumingVerification(false);
    }
  };

  // --------------------------------------------------
  // Step 4: AI Gap Analysis
  // --------------------------------------------------

  const handleStartAnalysis = async () => {
    clearMessages();

    if (!integrationConfirmed) {
      setError("A confirmed Integration Profile is required.");
      return;
    }

    if (!capabilityRunId || !completedCapability) {
      setError(
        "A completed capability verification run from this workflow is required.",
      );
      return;
    }

    const requiredCountryCode = String(
      targetCountryList[0] || "",
    ).toUpperCase();

    const matchingCompletedCountryProfile = countryProfiles.some(
      (profile) =>
        String(profile.country?.code || "").toUpperCase() ===
          requiredCountryCode &&
        String(profile.profile?.status || "").toUpperCase() === "COMPLETED",
    );

    if (
      isHyperwallet &&
      (targetCountryList.length !== 1 || !matchingCompletedCountryProfile)
    ) {
      setError(
        "Hyperwallet AI Gap Analysis requires exactly one configured target country and completed Country Intelligence from this workflow.",
      );
      return;
    }

    setAnalysisRunning(true);
    setStepStatus(4, "IN_PROGRESS");

    try {
      const response = await workflow.startGapAnalysis(projectId, { capabilityId: capabilityRunId });

      const result = getAnalysis(response);
      setAnalysis(result);

      const analysisStatus = String(result?.status || "").toUpperCase();

      if (result?.report || analysisStatus === "COMPLETED") {
        setStepStatus(4, "COMPLETED");
        setNotice("AI Gap Analysis report generated successfully.");
      } else {
        setStepStatus(4, "IN_PROGRESS");
        setNotice("Analysis run created. The report may still be processing.");
      }
    } catch (err) {
      setStepStatus(4, "FAILED");
      setError(getError(err, "AI Gap Analysis failed."));
    } finally {
      setAnalysisRunning(false);
    }
  };

  const handleRefreshAnalysis = async () => {
    clearMessages();

    const runId = analysis?.id || analysis?.runId || analysis?.run_id;

    if (!runId) {
      setError("No analysis run ID is available.");
      return;
    }

    try {
      const response = await workflow.refreshGapAnalysis(projectId, runId);

      const result = getAnalysis(response);
      setAnalysis(result);

      const refreshedStatus = String(result?.status || "").toUpperCase();
      if (refreshedStatus === "COMPLETED" && result?.report) {
        setStepStatus(4, "COMPLETED");
      } else if (["FAILED", "CANCELLED"].includes(refreshedStatus)) {
        setStepStatus(4, "FAILED");
      }
    } catch (err) {
      setError(getError(err, "Unable to refresh the analysis report."));
    }
  };

  // Finish means clear only this project's browser workflow checkpoint.
  // Backend records, credentials, project data and saved reports remain untouched.
  const handleFinishAndReturn = () => {
    if (finishingRef.current) return;

    finishingRef.current = true;

    try {
      localStorage.removeItem(storageKey);
      navigate(`/projects/${projectId}`, { replace: true });
    } catch (storageError) {
      finishingRef.current = false;
      console.error("Unable to clear this project's workflow checkpoint:", storageError);
      setError(
        "The workflow checkpoint could not be cleared from this browser. Check browser storage permissions and try again."
      );
    }
  };

  // --------------------------------------------------
  // Navigation rules
  // --------------------------------------------------

  const canOpenStep = (step) => {
    if (step === 1) return true;
    if (step === 2) return isHyperwallet && stepStatuses[1] === "COMPLETED";
    if (step === 3) {
      return stepStatuses[1] === "COMPLETED" &&
        (!isHyperwallet || stepStatuses[2] === "COMPLETED");
    }
    if (step === 4) {
      return stepStatuses[3] === "COMPLETED" &&
        (!isHyperwallet || stepStatuses[2] === "COMPLETED");
    }
    return false;
  };

  const handleContinue = () => {
    clearMessages();
    if (nextWorkflowStep !== null && canOpenStep(nextWorkflowStep)) {
      setActiveStep(nextWorkflowStep);
    }
  };

  // --------------------------------------------------
  // Loading / error states
  // --------------------------------------------------

  if (pageLoading) {
    return (
      <div className="mx-auto max-w-6xl px-5 py-16 text-center text-sm text-slate-500">
        Loading your workflow...
      </div>
    );
  }

  if (!project) {
    return (
      <main className="mx-auto max-w-6xl px-5 py-16">
        <p className="text-sm text-red-600">{error || "Project not found."}</p>
        <Link
          to="/projects"
          className="mt-4 inline-block text-sm font-semibold text-indigo-600 hover:underline"
        >
          ← Back to projects
        </Link>
      </main>
    );
  }

  // --------------------------------------------------
  // Main workspace
  // --------------------------------------------------

  return (
    <main className="mx-auto w-full max-w-7xl px-5 py-7">
      <div className="mb-6">
        <Link
          to={`/projects/${projectId}`}
          className="text-sm font-medium text-indigo-600 hover:underline"
        >
          ← Back to project details
        </Link>

        <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-slate-500">
              Workflow
            </p>
            <h1 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">
              {project.name || "Project workflow"}
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              {provider} ·{" "}
              {project.integrationType ||
                project.integration_type ||
                "Payment integration"}
            </p>
          </div>

          <Link
            to={`/projects/${projectId}`}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Project details
          </Link>
        </div>
      </div>

      {error && (
        <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {notice && (
        <div className="mb-5 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-700">
          {notice}
        </div>
      )}

      {/* Clickable horizontal workflow progress */}
      <nav aria-label="Assessment workflow stages" className="mb-8 border-y border-slate-200 py-5">
        <div
          className="grid gap-3"
          style={{ gridTemplateColumns: `repeat(${workflowSteps.length}, minmax(0, 1fr))` }}
        >
          {workflowSteps.map((step, position) => {
            const status = stepStatuses[step.index];
            const completed = status === "COMPLETED";
            const active = activeStep === step.index;
            const available = canOpenStep(step.index) || completed || active;

            return (
              <div key={step.index} className="relative min-w-0">
                {position < workflowSteps.length - 1 && (
                  <span
                    aria-hidden="true"
                    className={`absolute left-[calc(50%+18px)] right-[-50%] top-4 hidden h-px sm:block ${
                      completed ? "bg-emerald-500" : "bg-slate-200"
                    }`}
                  />
                )}
                <button
                  type="button"
                  onClick={() => goToStep(step.index)}
                  disabled={!available}
                  aria-current={active ? "step" : undefined}
                  className="group relative z-10 flex w-full flex-col items-center text-center disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-full border text-sm font-semibold transition ${
                      completed
                        ? "border-emerald-600 bg-emerald-600 text-white"
                        : active
                          ? "border-indigo-600 bg-indigo-600 text-white"
                          : "border-slate-300 bg-white text-slate-500 group-hover:border-slate-400"
                    }`}
                  >
                    {completed ? "✓" : step.number}
                  </span>
                  <span className={`mt-2 text-xs font-semibold sm:text-sm ${active ? "text-indigo-700" : "text-slate-800"}`}>
                    {step.title}
                  </span>
                  <span className="mt-1 hidden max-w-[220px] text-xs leading-5 text-slate-500 sm:block">
                    {step.description}
                  </span>
                  <span className={`mt-2 h-0.5 w-8 rounded-full ${active ? "bg-indigo-600" : "bg-transparent"}`} />
                </button>
              </div>
            );
          })}
        </div>
        {isHyperwallet && (
          <p className="mt-4 text-xs text-slate-500">
            Target market: <span className="font-medium text-slate-700">{targetCountryList.join(", ") || "Not configured"}</span>
          </p>
        )}
      </nav>

      {/* Only the selected stage is displayed below the progress bar. */}
      <section className="min-w-0">
          {activeStep === 1 && (
            <div className="space-y-6">
              <SectionHeading
                eyebrow={`Step 1 of ${totalWorkflowStages}`}
                title="Integration Intelligence"
                description="Upload the marketplace's existing payment integration source. The backend will analyse it and generate a profile for this workflow."
              />

              {!integration && (
                <form
                  onSubmit={handleUploadSource}
                  className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6"
                >
                  <label className="block text-sm font-semibold text-slate-700">
                    Payment integration source ZIP
                    <input
                      type="file"
                      accept=".zip,application/zip"
                      onChange={(event) =>
                        setSourceFile(event.target.files?.[0] || null)
                      }
                      className="mt-3 block w-full rounded-lg border border-slate-300 bg-white p-3 text-sm"
                    />
                  </label>

                  <p className="mt-2 text-xs text-slate-500">
                    ZIP files only. The source is uploaded and analysed by the
                    backend.
                  </p>

                  <button
                    type="submit"
                    disabled={uploadingSource}
                    className="mt-5 rounded-lg bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {uploadingSource
                      ? "Uploading and analysing..."
                      : "Upload and analyse"}
                  </button>
                </form>
              )}

              {integration && (
                <div className="space-y-5">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-xs text-slate-500">
                          Newly generated Integration Profile
                        </p>
                        <p className="mt-1 break-all text-sm font-semibold text-slate-900">
                          {integration.originalFilename ||
                            integration.original_filename ||
                            integration.id}
                        </p>
                      </div>
                      <StepStatus
                        status={
                          integrationConfirmed ? "COMPLETED" : "IN_PROGRESS"
                        }
                      />
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-5">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <h3 className="text-base font-semibold text-slate-900">
                          Review generated Integration Profile
                        </h3>
                        <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
                          Review the detected payment architecture, API operations, configuration and authentication findings. Source evidence stays linked without exposing internal IDs.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setProfileModalOpen(true)}
                        className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
                      >
                        Open profile review
                      </button>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                      <div className="rounded-lg bg-slate-50 p-3">
                        <p className="text-xs text-slate-500">Architecture files</p>
                        <p className="mt-1 text-lg font-semibold text-slate-900">
                          {(() => {
                            try {
                              const parsed = JSON.parse(profileText || "{}");
                              return Array.isArray(parsed?.architecture?.components) ? parsed.architecture.components.length : 0;
                            } catch { return 0; }
                          })()}
                        </p>
                      </div>
                      <div className="rounded-lg bg-slate-50 p-3">
                        <p className="text-xs text-slate-500">Review status</p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">
                          {integrationConfirmed ? "Confirmed" : "Pending review"}
                        </p>
                      </div>
                      <div className="rounded-lg bg-slate-50 p-3">
                        <p className="text-xs text-slate-500">Editing mode</p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">
                          Structured fields
                        </p>
                      </div>
                    </div>
                  </div>

                  {integrationConfirmed && (
                    <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
                      Integration Profile confirmed for this workflow.
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {activeStep === 2 && (
            <div className="space-y-6">
              <SectionHeading
                eyebrow={`Step 2 of ${totalWorkflowStages}`}
                title="Country Intelligence"
                description="Research the payment, business, regulatory and operational requirements for this project's configured target countries."
              />
              <Link to={`/projects/${projectId}/country-intelligence`} className="inline-flex text-sm font-semibold text-indigo-600 hover:underline">
                Open Country Intelligence workspace →
              </Link>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Configured target countries
                </p>
                <p className="mt-2 text-lg font-semibold text-slate-900">
                  {targetCountryList.join(", ") || "None configured"}
                </p>
              </div>

              {(
                !countryRun ||
                ["FAILED", "PARTIALLY_COMPLETED", "CANCELLED"].includes(
                  String(countryRun?.status || "").toUpperCase()
                )
              ) && (
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={handleStartCountryIntelligence}
                    disabled={countryRunning || targetCountryList.length === 0}
                    className="rounded-lg bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {countryRunning
                      ? "Research in progress..."
                      : countryRun
                        ? "Retry Country Intelligence"
                        : "Run Country Intelligence"}
                  </button>

                  {countryRun && (
                    <p className="text-xs text-slate-500">
                      The previous run is retained in project history. Retrying
                      creates a new research run.
                    </p>
                  )}
                </div>
              )}

              {countryRun && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        Country research run
                      </p>
                    </div>
                    <StepStatus
                      status={
                        countryCompleted
                          ? "COMPLETED"
                          : countryStatus === "FAILED"
                            ? "FAILED"
                            : "IN_PROGRESS"
                      }
                    />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-4">
                    {[
                      [
                        "Total",
                        countryRun.progress?.total ??
                          countryRun.totalCountries ??
                          0,
                      ],
                      ["Completed", countryRun.progress?.completed ?? 0],
                      ["In progress", countryRun.progress?.inProgress ?? 0],
                      ["Failed", countryRun.progress?.failed ?? 0],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-lg bg-slate-50 p-3">
                        <p className="text-xs text-slate-500">{label}</p>
                        <p className="mt-1 text-xl font-bold text-slate-900">
                          {value}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-indigo-600 transition-all"
                      style={{
                        width: `${Math.max(
                          0,
                          Math.min(
                            100,
                            Number(countryRun.progress?.percentage || 0),
                          ),
                        )}%`,
                      }}
                    />
                  </div>

                  {(countryRun.countries || []).map((country) => (
                    <div
                      key={country.countryCode}
                      className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 py-3"
                    >
                      <div>
                        <p className="text-sm font-semibold text-slate-800">
                          {country.countryName} ({country.countryCode})
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {country.requirementCount ?? 0} requirements ·{" "}
                          {country.sourceCount ?? 0} sources
                        </p>
                      </div>
                      <StepStatus
                        status={
                          String(country.status).toUpperCase() === "COMPLETED"
                            ? "COMPLETED"
                            : String(country.status).toUpperCase() === "FAILED"
                              ? "FAILED"
                              : "IN_PROGRESS"
                        }
                      />
                    </div>
                  ))}

                  {countryProfiles.map((profile) => (
                    <div key={profile.id || profile.country?.code} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4">
                      <div className="min-w-0"><p className="font-semibold text-slate-900">{profile.country?.name || "Country profile"} {profile.country?.code ? `(${profile.country.code})` : ""}</p><p className="mt-1 text-sm text-slate-500">{profile.profile?.totalRequirements ?? (profile.categories || []).reduce((total, category) => total + (category.requirements || []).length, 0)} requirements · {profile.profile?.totalSources ?? (profile.categories || []).reduce((total, category) => total + (category.requirements || []).reduce((sum, requirement) => sum + (requirement.evidence || []).length, 0), 0)} sources</p></div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button type="button" onClick={() => setCountryReportProfile(profile)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Quick view</button>
                        <Link to={`/projects/${projectId}/country-intelligence/${profile.id || profile.intelligenceId || profile.intelligence_id}`} className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800">Open full report →</Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeStep === 3 && (
            <div className="space-y-6">
              <SectionHeading
                eyebrow={`Step ${isPayPal ? 2 : 3} of ${totalWorkflowStages}`}
                title="Provider Verification"
                description="Save Sandbox credentials and execute authentication plus capability operations in one unified verification flow."
              />

              {!integrationConfirmed && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                  Complete Integration Intelligence before continuing.
                </div>
              )}

              <div className="rounded-lg bg-slate-50 p-4">
                <p className="text-xs text-slate-500">Provider</p>
                <p className="mt-1 font-semibold text-slate-900">
                  {provider || "Provider not configured"}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Environment: SANDBOX
                </p>
              </div>

              {(!credential || editingCredential) && (
                <form onSubmit={handleSaveCredentials} className="space-y-4">
                  <h3 className="font-semibold text-slate-900">
                    {credential ? "Replace Sandbox credentials" : "Configure Sandbox credentials"}
                  </h3>
                  {credential && (
                    <p className="text-xs leading-5 text-amber-700">
                      Enter all required secret fields again. Existing secret values are never returned by the backend.
                    </p>
                  )}

                  {isPayPal ? (
                    <>
                      <Field
                        label="PayPal Client ID"
                        value={clientId}
                        onChange={setClientId}
                        placeholder="Sandbox Client ID"
                        required
                      />
                      <Field
                        label="PayPal Client Secret"
                        value={clientSecret}
                        onChange={setClientSecret}
                        type="password"
                        placeholder="Sandbox Client Secret"
                        required
                      />
                      <Field
                        label="Webhook ID (optional)"
                        value={webhookId}
                        onChange={setWebhookId}
                        placeholder="Webhook ID"
                      />
                    </>
                  ) : isHyperwallet ? (
                    <>
                      <Field
                        label="Hyperwallet Username"
                        value={username}
                        onChange={setUsername}
                        required
                      />
                      <Field
                        label="Hyperwallet Password"
                        value={password}
                        onChange={setPassword}
                        type="password"
                        required
                      />
                      <Field
                        label="Hyperwallet Program Token"
                        value={programToken}
                        onChange={setProgramToken}
                        type="password"
                        required
                      />
                    </>
                  ) : (
                    <p className="text-sm text-red-600">
                      This workflow form currently supports PAYPAL and
                      HYPERWALLET.
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={
                      savingCredential ||
                      !integrationConfirmed ||
                      (!isPayPal && !isHyperwallet)
                    }
                    className="rounded-lg bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {savingCredential
                      ? "Saving credentials..."
                      : "Save Sandbox credentials"}
                  </button>
                </form>
              )}

              {credential && !editingCredential && (
                <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                  <p className="font-semibold text-green-900">
                    Sandbox credentials saved
                  </p>
                  <p className="mt-1 break-all text-xs text-green-800">
                    Credential ID: {credential.id}
                  </p>
                  <p className="mt-1 text-xs text-green-800">
                    Version: {credential.credentialVersion || "—"}
                  </p>
                  <p className="mt-2 text-xs text-green-800">
                    Secret values are not displayed or retrieved.
                  </p>
                  <button
                    type="button"
                    onClick={() => setEditingCredential(true)}
                    className="mt-3 rounded-lg border border-green-300 px-3 py-2 text-xs font-semibold text-green-900 hover:bg-green-100"
                  >
                    Replace credentials
                  </button>
                </div>
              )}

              {credential && !editingCredential && (
                <div className="space-y-4 border-t border-slate-200 pt-5">
                  <h3 className="font-semibold text-slate-900">
                    Execute capability scenario
                  </h3>

                  <label className="block text-sm font-medium text-slate-700">
                    Capability
                    <select
                      value={capabilityCode}
                      onChange={(event) =>
                        setCapabilityCode(event.target.value)
                      }
                      className="mt-2 w-full rounded-lg border border-slate-300 bg-white p-3"
                    >
                      <option value="PAYMENT_PROCESSING">
                        Payment Processing
                      </option>
                      <option value="RECIPIENT_MANAGEMENT">
                        Recipient Management
                      </option>
                      <option value="PAYMENT_DISBURSEMENT">
                        Payment Disbursement
                      </option>
                    </select>
                  </label>

                  {capabilityCode === "RECIPIENT_MANAGEMENT" && (
                    <label className="block text-sm font-medium text-slate-700">
                      Recipient Sandbox input (JSON)
                      <textarea
                        value={recipientJSON}
                        onChange={(event) =>
                          setRecipientJSON(event.target.value)
                        }
                        rows={8}
                        spellCheck="false"
                        className="mt-2 w-full rounded-lg border border-slate-300 bg-slate-950 p-4 font-mono text-xs text-white"
                      />
                      <span className="mt-2 block text-xs text-slate-500">
                        Provide the recipient object expected by the provider's
                        Sandbox scenario.
                      </span>
                    </label>
                  )}

                  {capabilityCode === "PAYMENT_DISBURSEMENT" && (
                    <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
                      The backend uses the project's configured target country
                      for the Hyperwallet Sandbox fixture. No country override
                      is sent.
                    </p>
                  )}

                  <button
                    type="button"
                    onClick={handleStartVerification}
                    disabled={verificationRunning || !credential?.id}
                    className="rounded-lg bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {verificationRunning
                      ? "Verifying..."
                      : "Verify Integration"}
                  </button>
                </div>
              )}

              {verificationResult && (
                <div className="space-y-4 rounded-lg border border-slate-200 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="font-semibold text-slate-900">
                      Verification result
                    </h3>
                    <StepStatus
                      status={
                        completedCapability
                          ? "COMPLETED"
                          : verificationStatus === "FAILED"
                            ? "FAILED"
                            : approvalRequired
                              ? "WAITING"
                              : "IN_PROGRESS"
                      }
                    />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">Provider</p><p className="mt-1 text-sm font-semibold text-slate-900">{verificationData?.capability?.provider || provider || "—"}</p></div>
                    <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">Environment</p><p className="mt-1 text-sm font-semibold text-slate-900">{verificationData?.capability?.environment || "SANDBOX"}</p></div>
                    <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">Operations</p><p className="mt-1 text-sm font-semibold text-slate-900">{verificationData?.capability?.checks?.length || 0} tested</p></div>
                  </div>

                  {approvalRequired && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                      <p className="font-semibold text-amber-900">
                        Provider approval required
                      </p>
                      <p className="mt-1 text-sm text-amber-800">
                        Complete provider approval, then resume this same
                        capability run.
                      </p>

                      {approvalUrl && (
                        <a
                          href={approvalUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-2 inline-block text-sm font-semibold text-amber-900 underline"
                        >
                          Open provider approval
                        </a>
                      )}

                      <div>
                        <button
                          type="button"
                          onClick={handleResumeVerification}
                          disabled={resumingVerification || !capabilityRunId}
                          className="mt-4 rounded-lg bg-amber-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                        >
                          {resumingVerification
                            ? "Resuming..."
                            : "Resume verification"}
                        </button>
                      </div>
                    </div>
                  )}

                  {verificationStatus === "FAILED" && (
                    <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
                      Capability execution finished, but the verification failed. The workflow cannot continue to AI Gap Analysis until the failed operation is corrected and verification succeeds.
                    </p>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <div><p className="text-sm font-semibold text-slate-900">Operation-level verification report</p><p className="mt-1 text-xs text-slate-500">Review each tested operation, provider response and selected technical JSON.</p></div>
                    <button type="button" onClick={() => setProviderReportOpen(true)} className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800">View verification report →</button>
                  </div>

                  {completedCapability && (
                    <p className="text-sm font-medium text-green-700">
                      Capability execution completed. You can continue to AI Gap
                      Analysis.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {activeStep === 4 && (
            <div className="space-y-6">
              <SectionHeading
                eyebrow={`Step ${totalWorkflowStages} of ${totalWorkflowStages}`}
                title="AI Gap Analysis"
                description="Generate the final evidence-based assessment using the Integration Profile and capability evidence created during this workflow."
              />
              <Link to={`/projects/${projectId}/ai-gap-analysis`} className="inline-flex text-sm font-semibold text-indigo-600 hover:underline">
                Open AI Gap Analysis workspace →
              </Link>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg bg-slate-50 p-4">
                  <p className="text-xs text-slate-500">Integration Profile</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {integrationConfirmed ? "Confirmed" : "Not confirmed"}
                  </p>
                </div>

                <div className="rounded-lg bg-slate-50 p-4">
                  <p className="text-xs text-slate-500">Capability execution</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {completedCapability ? "Completed" : "Not completed"}
                  </p>
                </div>
              </div>

              {isHyperwallet && (
                <div className="rounded-lg border border-slate-200 p-4">
                  <p className="text-sm font-semibold text-slate-900">
                    Hyperwallet country requirement
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    Target countries: {targetCountryList.join(", ") || "None"}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    Country Intelligence:{" "}
                    {countryCompleted ? "Completed" : "Not completed"}
                  </p>
                </div>
              )}

              {!completedCapability && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                  AI Gap Analysis requires a completed capability verification
                  run from this workflow. Return to Step 3 and complete
                  verification first.
                </div>
              )}

              <button
                type="button"
                onClick={handleStartAnalysis}
                disabled={
                  analysisRunning ||
                  !integrationConfirmed ||
                  !capabilityRunId ||
                  !completedCapability ||
                  (isHyperwallet &&
                    (targetCountryList.length !== 1 || !countryCompleted))
                }
                className="rounded-lg bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {analysisRunning
                  ? "Generating analysis..."
                  : "Generate AI Gap Analysis"}
              </button>

              {analysis && (
                <div className="border-t border-slate-200 pt-5">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="min-w-0">
                      <h3 className="text-base font-semibold text-slate-950">Analysis report</h3>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <StepStatus
                        status={
                          String(analysis.status).toUpperCase() === "COMPLETED" && report
                            ? "COMPLETED"
                            : ["FAILED", "CANCELLED"].includes(String(analysis.status).toUpperCase())
                              ? "FAILED"
                              : "IN_PROGRESS"
                        }
                      />
                      <button
                        type="button"
                        onClick={handleRefreshAnalysis}
                        className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Refresh
                      </button>
                    </div>
                  </div>

                  {!report ? (
                    <p className="mt-4 text-sm leading-6 text-slate-500">
                      The analysis run exists, but the report is not available yet. Refresh to retrieve its latest state.
                    </p>
                  ) : (
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-4 border-y border-slate-100 py-4">
                      <div className="flex min-w-0 items-center gap-3">
                        <ReportStatusBadge value={assessment?.overallAssessment} />
                        <p className="text-sm text-slate-600">
                          {Array.isArray(assessment?.findings) ? assessment.findings.length : 0} findings · {Array.isArray(assessment?.keyRisks) ? assessment.keyRisks.length : 0} key risks
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setReportModalOpen(true)}
                          className="rounded-md border border-slate-300 px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                        >
                          Quick view
                        </button>
                        <Link
                          to={`/projects/${projectId}/ai-gap-analysis/${analysis.id || analysis.runId || analysis.run_id}`}
                          className="rounded-md bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
                        >
                          Open full report →
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {countryReportProfile && (
            <CountryIntelligenceModal profile={countryReportProfile} onClose={() => setCountryReportProfile(null)} />
          )}

          {providerReportOpen && verificationData?.capability && (
            <ProviderVerificationModal verification={verificationData} onClose={() => setProviderReportOpen(false)} />
          )}

          {reportModalOpen && report && (
            <ReportModal
              report={report}
              assessment={assessment}
              onClose={() => setReportModalOpen(false)}
              onRefresh={handleRefreshAnalysis}
            />
          )}

          {profileModalOpen && integration && (
            <IntegrationProfileModal
              profile={(() => {
                try {
                  const parsed = JSON.parse(profileText || "{}");
                  return isPlainObject(parsed) ? parsed : {};
                } catch {
                  return {};
                }
              })()}
              onChange={(nextProfile) => setProfileText(prettyJSON(nextProfile))}
              onClose={() => setProfileModalOpen(false)}
              onSave={handleSaveProfile}
              onConfirm={async () => {
                const saved = await handleSaveProfile();
                if (saved) await handleConfirmProfile();
              }}
              saving={savingProfile}
              confirming={confirmingProfile}
              confirmed={integrationConfirmed}
            />
          )}

          {/* Bottom navigation */}
          <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-5">
            <button
              type="button"
              onClick={() => {
                clearMessages();
                if (previousWorkflowStep !== null) setActiveStep(previousWorkflowStep);
              }}
              disabled={previousWorkflowStep === null}
              className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            >
              ← Previous
            </button>

            {nextWorkflowStep !== null && (
              <button
                type="button"
                onClick={handleContinue}
                disabled={!canOpenStep(nextWorkflowStep)}
                className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-40"
              >
                Continue →
              </button>
            )}

            {activeStep === 4 && stepStatuses[4] === "COMPLETED" && (
              <button
                type="button"
                onClick={handleFinishAndReturn}
                className="rounded-lg bg-green-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-green-700"
              >
                Finish and return to project →
              </button>
            )}
          </div>
      </section>
    </main>
  );
}
