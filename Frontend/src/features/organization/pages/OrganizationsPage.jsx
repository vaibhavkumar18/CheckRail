
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import useOrganizations from "../hook/useOrganizations";

export default function OrganizationsPage() {
  const {
    organizations = [],
    loading,
    submitting,
    error,
    loadOrganizations,
    create,
    update,
    remove,
  } = useOrganizations();

  const organizationList = Array.isArray(organizations)
    ? organizations
    : [];

  const [name, setName] = useState("");
  const [editing, setEditing] = useState(null);
  const [formError, setFormError] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    loadOrganizations().catch(() => {});
  }, [loadOrganizations]);

  // Modal keyboard handling
  useEffect(() => {
    if (!isModalOpen) return;

    const handleKeyDown = (event) => {
      if (event.key === "Escape" && !submitting) {
        closeModal();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isModalOpen, submitting]);

  const openCreateModal = () => {
    setEditing(null);
    setName("");
    setFormError("");
    setIsModalOpen(true);
  };

  const openEditModal = (org) => {
    setEditing(org);
    setName(org.name || "");
    setFormError("");
    setIsModalOpen(true);
  };

  const closeModal = () => {
    if (submitting) return;

    setIsModalOpen(false);
    setEditing(null);
    setName("");
    setFormError("");
  };

  const submit = async (event) => {
    event.preventDefault();
    setFormError("");

    const cleanName = name.trim();

    if (cleanName.length < 2) {
      setFormError(
        "Organization name must contain at least 2 characters."
      );
      return;
    }

    try {
      if (editing) {
        await update(editing.id, { name: cleanName });
      } else {
        await create({ name: cleanName });
      }

      setIsModalOpen(false);
      setEditing(null);
      setName("");
      setFormError("");
    } catch (e) {
      setFormError(
        e?.response?.data?.message ||
          "Unable to save organization."
      );
    }
  };

  const deleteOrganization = async (org) => {
    const confirmed = window.confirm(
      `Delete "${org.name}"? This action cannot be undone.`
    );

    if (!confirmed) return;

    try {
      await remove(org.id);
    } catch (e) {
      window.alert(
        e?.response?.data?.message ||
          "Unable to delete organization."
      );
    }
  };

  const copyOrganizationId = async (id) => {
    try {
      await navigator.clipboard.writeText(id);
    } catch {
      window.alert("Unable to copy organization ID.");
    }
  };

  const getEnvironmentLabel = (org) => {
    if (Array.isArray(org.environments)) {
      return org.environments.length
        ? org.environments
            .map((environment) =>
              typeof environment === "string"
                ? environment
                : environment?.name || environment?.label
            )
            .filter(Boolean)
            .join(", ")
        : "Not configured";
    }

    return org.environment || "—";
  };

  const getMemberLabel = (org) => {
    if (Array.isArray(org.members)) {
      return `${org.members.length} ${
        org.members.length === 1 ? "Member" : "Members"
      }`;
    }

    if (typeof org.member_count === "number") {
      return `${org.member_count} ${
        org.member_count === 1 ? "Member" : "Members"
      }`;
    }

    return "—";
  };

  const getStatus = (org) => {
    const status = org.status;

    if (!status) return null;

    const normalized = String(status).toLowerCase();

    if (
      ["active", "verified", "enabled"].includes(normalized)
    ) {
      return {
        label: status,
        color: "bg-emerald-500",
      };
    }

    if (
      ["staging", "pending", "sandbox"].includes(normalized)
    ) {
      return {
        label: status,
        color: "bg-amber-500",
      };
    }

    return {
      label: status,
      color: "bg-slate-400",
    };
  };

  return (
    <main className="min-h-full bg-[#f7f9fc]">
      <div className="mx-auto w-full max-w-[1500px] px-5 py-7 sm:px-7 lg:px-9">

        {/* Page Header */}
        <header className="mb-6 flex flex-col justify-between gap-5 border-b border-slate-200 pb-5 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-2xl font-normal  tracking-tight text-black-900">
              Organizations
            </h1>

            <p className="mt-1.5 text-sm text-black-500">
              Manage institutional payment entities, project environments, and API access.
            </p>
          </div>

          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-[3px] bg-slate-900 px-5 py-3 text-sm font-normal text-white shadow-sm transition hover:bg-slate-800"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="h-4 w-4"
              aria-hidden="true"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>

            Create organization
          </button>
        </header>

        {/* Organizations Table */}
        <section className="w-full overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-left">

            <thead>
              <tr className="border-b border-slate-200">
                <th className="w-[25%] px-5 py-4 text-[11px] font-semibold uppercase tracking-wider text-black-500">
                  Organization
                </th>

                <th className="w-[24%] px-5 py-4 text-[11px] font-semibold uppercase tracking-wider text-black-500">
                  Organization ID
                </th>

                <th className="px-5 py-4 text-[11px] font-semibold uppercase tracking-wider text-black-500">
                  Environments
                </th>

                <th className="px-5 py-4 text-[11px] font-semibold uppercase tracking-wider text-black-500">
                  Members
                </th>

                <th className="px-5 py-4 text-[11px] font-semibold uppercase tracking-wider text-black-500">
                  Status
                </th>

                <th className="px-5 py-4 text-right text-[11px] font-semibold uppercase tracking-wider text-black-500">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200/80">

              {/* Loading State */}
              {loading ? (
                [1, 2, 3].map((item) => (
                  <tr key={item} className="animate-pulse">
                    {Array.from({ length: 6 }).map((_, index) => (
                      <td key={index} className="px-5 py-7">
                        <div className="h-4 w-28 rounded bg-slate-200" />
                        <div className="mt-2 h-3 w-36 rounded bg-slate-100" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : organizationList.length === 0 ? (
                /* Empty State */
                <tr>
                  <td colSpan={6} className="px-5 py-20 text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-md bg-indigo-50 text-indigo-600">
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.7"
                        className="h-6 w-6"
                        aria-hidden="true"
                      >
                        <rect
                          x="3"
                          y="7"
                          width="18"
                          height="14"
                          rx="2"
                        />
                        <path d="M8 7V4h8v3M12 11v6M9 14h6" />
                      </svg>
                    </div>

                    <h3 className="mt-4 text-base font-semibold text-black-900">
                      No organizations found
                    </h3>

                    <p className="mt-1.5 text-sm text-black-500">
                      Create your first organization to get started.
                    </p>

                    <button
                      type="button"
                      onClick={openCreateModal}
                      className="mt-5 rounded-md bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
                    >
                      Create organization
                    </button>
                  </td>
                </tr>
              ) : (
                /* Organization Rows */
                organizationList.map((org, index) => {
                  const status = getStatus(org);

                  return (
                    <tr
                      key={org.id}
                      className="group transition hover:bg-white/70"
                    >
                      {/* Organization */}
                      <td className="px-5 py-6">
                        <div className="flex min-w-[220px] items-center gap-3">
                          

                          <div className="min-w-0">
                            <Link
                              to={`/organizations/${org.id}`}
                              className="block max-w-[240px] truncate text-[15px] font-semibold text-black-900 transition hover:text-indigo-600"
                              title={org.name}
                            >
                              {org.name || "Untitled organization"}
                            </Link>

                            <p className="mt-1.5 text-xs text-black-500">
                              Organization workspace
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Organization ID */}
                      <td className="px-5 py-6">
                        <div className="flex max-w-[220px] items-center gap-2">
                          <span
                            className="min-w-0 flex-1 break-all font-mono text-xs leading-5 text-black-600"
                            title={org.id}
                          >
                            {org.id || "—"}
                          </span>

                          {org.id && (
                            <button
                              type="button"
                              title="Copy organization ID"
                              aria-label="Copy organization ID"
                              onClick={() =>
                                copyOrganizationId(org.id)
                              }
                              className="shrink-0 text-black-400 transition hover:text-indigo-600"
                            >
                              <svg
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.7"
                                className="h-4 w-4"
                                aria-hidden="true"
                              >
                                <rect
                                  x="8"
                                  y="8"
                                  width="12"
                                  height="12"
                                  rx="2"
                                />
                                <path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Environments */}
                      <td className="px-5 py-6">
                        <span className="text-sm text-black-600">
                          {getEnvironmentLabel(org)}
                        </span>
                      </td>

                      {/* Members */}
                      <td className="px-5 py-6">
                        <span className="text-sm text-black-600">
                          {getMemberLabel(org)}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-5 py-6">
                        {status ? (
                          <span className="inline-flex items-center gap-2 whitespace-nowrap text-sm text-black-600">
                            <span
                              className={`h-2 w-2 rounded-full ${status.color}`}
                            />
                            {status.label}
                          </span>
                        ) : (
                          <span className="text-sm text-black-400">
                            —
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-6">
                        <div className="flex items-center justify-end gap-4 whitespace-nowrap">
                          <Link
                            to={`/organizations/${org.id}`}
                            className="inline-flex items-center gap-2 text-sm font-normal text-black-600 transition hover:text-indigo-800"
                          >
                            Open workspace

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

                          <button
                            type="button"
                            onClick={() => openEditModal(org)}
                            title="Edit organization"
                            aria-label={`Edit ${org.name}`}
                            className="text-black-400 transition hover:text-indigo-600"
                          >
                            <svg
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.7"
                              className="h-4 w-4"
                              aria-hidden="true"
                            >
                              <path d="m14 5 5 5M4 20l4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10L4 20Z" />
                            </svg>
                          </button>

                          <button
                            type="button"
                            onClick={() => deleteOrganization(org)}
                            title="Delete organization"
                            aria-label={`Delete ${org.name}`}
                            className="text-black-400 transition hover:text-red-600"
                          >
                            <svg
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.7"
                              className="h-4 w-4"
                              aria-hidden="true"
                            >
                              <path d="M4 7h16M10 11v6M14 11v6M5 7l1 14h12l1-14M9 7V4h6v3" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </section>

        {/* Table Footer */}
        {!loading && organizationList.length > 0 && (
          <div className="flex items-center justify-between border-t border-slate-200 px-5 py-4">
            <p className="text-sm text-black-500">
              Showing {organizationList.length}{" "}
              {organizationList.length === 1
                ? "organization"
                : "organizations"}
            </p>
          </div>
        )}

        {/* API Error */}
        {!loading && error && (
          <div
            role="alert"
            className="mt-4 rounded-md border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {typeof error === "string"
              ? error
              : error?.message || "Unable to load organizations."}
          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-slate-950/50 px-4 py-8 backdrop-blur-[3px]"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeModal();
            }
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="organization-modal-title"
            className="my-auto w-full max-w-[560px] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl shadow-slate-950/20"
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-100 px-7 py-6">
              <div>
                <h2
                  id="organization-modal-title"
                  className="text-lg font-bold tracking-tight text-black-900"
                >
                  {editing
                    ? "Edit organization"
                    : "Create organization"}
                </h2>

                <p className="mt-2 max-w-[440px] text-sm leading-6 text-black-500">
                  {editing
                    ? "Update your organization's workspace details."
                    : "Set up an institutional workspace for payment corridors and team environments."}
                </p>
              </div>

              <button
                type="button"
                onClick={closeModal}
                disabled={submitting}
                aria-label="Close dialog"
                className="ml-4 rounded-md p-1.5 text-black-400 transition hover:bg-slate-100 hover:text-black-700 disabled:opacity-50"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  className="h-5 w-5"
                  aria-hidden="true"
                >
                  <path d="m18 6-12 12M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={submit}>
              <div className="px-7 py-6">
                <label
                  htmlFor="organization-name"
                  className="mb-3 block text-sm font-semibold text-black-700"
                >
                  Organization name
                  <span className="ml-1 text-red-500">*</span>
                </label>

                <input
                  id="organization-name"
                  type="text"
                  value={name}
                  onChange={(event) => {
                    setName(event.target.value);
                    if (formError) setFormError("");
                  }}
                  maxLength={150}
                  minLength={2}
                  required
                  autoFocus
                  placeholder="e.g. Acme Technologies"
                  className="h-12 w-full rounded-md border border-slate-200 bg-white px-4 text-base text-black-800 outline-none transition placeholder:text-black-400 hover:border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10"
                />

                <p className="mt-2.5 text-xs leading-5 text-black-500">
                  Choose a recognizable corporate entity or subsidiary identifier.
                </p>

                {formError && (
                  <div
                    role="alert"
                    className="mt-4 rounded-md border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700"
                  >
                    {formError}
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="flex flex-col-reverse items-center justify-between gap-4 border-t border-slate-100 bg-slate-50/70 px-7 py-5 sm:flex-row">
                <p className="flex items-center gap-2 text-xs text-black-400">
                  Press

                  <kbd className="rounded border border-slate-200 bg-white px-2 py-1 text-xs text-black-600 shadow-sm">
                    Esc
                  </kbd>

                  to cancel
                </p>

                <div className="flex w-full items-center justify-end gap-3 sm:w-auto">
                  <button
                    type="button"
                    onClick={closeModal}
                    disabled={submitting}
                    className="rounded-md border border-slate-200 bg-white px-5 py-3 text-sm font-medium text-black-600 transition hover:bg-slate-100 disabled:opacity-50"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={submitting || name.trim().length < 2}
                    className="inline-flex min-w-[170px] items-center justify-center whitespace-nowrap rounded-md bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                  >
                    {submitting
                      ? "Saving..."
                      : editing
                      ? "Save changes"
                      : "Create organization"}
                  </button>
                </div>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
