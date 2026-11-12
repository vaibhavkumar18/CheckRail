import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import useOrganizations from "../hook/useOrganizations";
import useProjects from "../../project/hook/useProjects";

const inputClass = "w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100";
const labelClass = "mb-1.5 block text-sm font-medium text-slate-700";

function Modal({ title, onClose, children }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
    <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
      <div className="mb-5 flex items-center justify-between"><h2 className="text-xl font-bold">{title}</h2><button onClick={onClose} className="text-2xl text-slate-400 hover:text-slate-800">×</button></div>
      {children}
    </div>
  </div>;
}

export default function OrganizationDetailsPage() {
  const { organizationId } = useParams();
  const org = useOrganizations();
  const project = useProjects();
  const [tab, setTab] = useState("projects");
  const [projectModal, setProjectModal] = useState(false);
  const [memberModal, setMemberModal] = useState(false);
  const [memberMode, setMemberMode] = useState("new");
  const [memberSearch, setMemberSearch] = useState("");
  const [foundUser, setFoundUser] = useState(null);
  const [localError, setLocalError] = useState("");
  const [projectForm, setProjectForm] = useState({
    name: "", description: "", provider: "PAYPAL", assessmentObjective: "PAYMENT_TESTING",
    integrationType: "PAYMENT", sourceCountry: "", targetCountries: "",
  });
  const [memberForm, setMemberForm] = useState({ name: "", email: "", password: "", role: "DEVELOPER" });

  useEffect(() => {
    org.loadOrganization(organizationId).catch(() => {});
    project.loadProjects(organizationId).catch(() => {});
  }, [organizationId]); // load on organization change

  const current = org.current;
  const isAdmin = useMemo(() => current?.user_role === "ADMIN" || current?.owner_id === current?.current_user_id, [current]);
  const setProjectField = (key, value) => setProjectForm((old) => ({ ...old, [key]: value }));

  const submitProject = async (event) => {
    event.preventDefault();
    setLocalError("");
    const targets = projectForm.targetCountries.split(",").map((value) => value.trim().toUpperCase()).filter(Boolean);
    const payload = {
      name: projectForm.name.trim(),
      description: projectForm.description.trim(),
      provider: projectForm.provider,
      assessmentObjective: projectForm.assessmentObjective,
      integrationType: projectForm.integrationType,
      sourceCountry: projectForm.provider === "HYPERWALLET" ? projectForm.sourceCountry.trim().toUpperCase() : null,
      targetCountries: projectForm.provider === "HYPERWALLET" ? targets : [],
    };
    try {
      await project.create(organizationId, payload);
      setProjectModal(false);
      setProjectForm({ name: "", description: "", provider: "PAYPAL", assessmentObjective: "PAYMENT_TESTING", integrationType: "PAYMENT", sourceCountry: "", targetCountries: "" });
    } catch (e) { setLocalError(e?.response?.data?.message || "Unable to create project."); }
  };

  const changeProvider = (provider) => setProjectForm((old) => ({
    ...old,
    provider,
    assessmentObjective: provider === "PAYPAL" ? "PAYMENT_TESTING" : "INTERNATIONAL_EXPANSION",
    integrationType: provider === "PAYPAL" ? "PAYMENT" : "PAYOUT",
  }));

  const submitMember = async (event) => {
    event.preventDefault();
    setLocalError("");
    try {
      if (memberMode === "new") {
        await org.addNewMember(organizationId, { ...memberForm, name: memberForm.name.trim(), email: memberForm.email.trim().toLowerCase() });
      } else {
        if (!foundUser?.id) throw new Error("Search for an existing user first.");
        await org.addExistingMember(organizationId, { userId: foundUser.id, role: memberForm.role });
      }
      setMemberModal(false);
      setMemberForm({ name: "", email: "", password: "", role: "DEVELOPER" });
      setFoundUser(null); setMemberSearch("");
    } catch (e) { setLocalError(e?.response?.data?.message || e.message || "Unable to add member."); }
  };

  const searchMember = async () => {
    setLocalError(""); setFoundUser(null);
    try {
      const result = await org.searchMember(organizationId, memberSearch.trim().toLowerCase());
      if (result?.already_member) return setLocalError("This user is already a member of this organization.");
      setFoundUser(result?.user || null);
      if (!result?.user) setLocalError("User was not found.");
    } catch (e) { setLocalError(e?.response?.data?.message || "Unable to search user."); }
  };

  const editMemberRole = async (member) => {
    const role = window.prompt("Enter role: DEVELOPER or REVIEWER", member.role);
    if (!role || !["DEVELOPER", "REVIEWER"].includes(role.toUpperCase())) return;
    try { await org.editMember(organizationId, member.membership_id, { role: role.toUpperCase() }); }
    catch (e) { window.alert(e?.response?.data?.message || "Unable to update member."); }
  };

  const deleteMember = async (member) => {
    if (!window.confirm(`Remove ${member.name || member.email} from this organization?`)) return;
    try { await org.removeMember(organizationId, member.membership_id); }
    catch (e) { window.alert(e?.response?.data?.message || "Unable to remove member."); }
  };

  if (org.loading && !current) return <div className="mx-auto max-w-6xl px-5 py-16 text-center text-slate-500">Loading organization...</div>;
  if (!current) return <div className="mx-auto max-w-6xl px-5 py-16"><p className="text-red-600">{org.error || "Organization not found or access denied."}</p><Link className="mt-4 inline-block text-indigo-600" to="/organizations">← Back to organizations</Link></div>;

  return <main className="mx-auto w-full max-w-6xl px-5 py-8">
    <Link to="/organizations" className="text-sm font-medium text-indigo-600 hover:underline">← All organizations</Link>
    <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
      <div><p className="text-xs font-semibold uppercase tracking-widest text-indigo-600">Organization workspace</p><h1 className="mt-2 text-3xl font-bold text-slate-900">{current.name}</h1><p className="mt-2 text-sm text-slate-500">Manage projects and organization members.</p></div>
      <div className="flex gap-2"><button onClick={() => { org.loadOrganization(organizationId).catch(() => {}); project.loadProjects(organizationId).catch(() => {}); }} className="rounded-lg border px-4 py-2 text-sm">Refresh</button>{isAdmin && <button onClick={() => { setLocalError(""); setProjectModal(true); }} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white">Create project</button>}</div>
    </div>

    <div className="mt-8 border-b border-slate-200">
      <div className="flex gap-7">
        <button onClick={() => setTab("projects")} className={`border-b-2 px-1 pb-3 text-sm font-semibold ${tab === "projects" ? "border-indigo-600 text-indigo-700" : "border-transparent text-slate-500"}`}>Projects ({project.projects.length})</button>
        <button onClick={() => setTab("members")} className={`border-b-2 px-1 pb-3 text-sm font-semibold ${tab === "members" ? "border-indigo-600 text-indigo-700" : "border-transparent text-slate-500"}`}>Members ({org.members.length})</button>
      </div>
    </div>

    {tab === "projects" ? <section className="py-6">
      <div className="mb-5 flex items-center justify-between"><div><h2 className="text-xl font-semibold">Projects</h2><p className="mt-1 text-sm text-slate-500">Projects created under this organization.</p></div>{isAdmin && <button onClick={() => setProjectModal(true)} className="rounded-lg border border-indigo-200 px-3 py-2 text-sm font-semibold text-indigo-700">+ New project</button>}</div>
      {project.loading ? <p className="py-10 text-center text-slate-500">Loading projects...</p> : project.projects.length === 0 ? <div className="rounded-xl border border-dashed border-slate-300 py-14 text-center"><h3 className="font-semibold">No projects yet</h3><p className="mt-2 text-sm text-slate-500">Create a project to start the payment expansion assessment.</p></div> :
        <div className="grid gap-4 md:grid-cols-2">
          {project.projects.map((item) => <article key={item.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3"><h3 className="text-lg font-semibold text-slate-900">{item.name}</h3><span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700">{item.provider || "Provider not specified"}</span></div>
            <p className="mt-2 line-clamp-2 text-sm text-slate-500">{item.description || "No description provided."}</p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-600"><span className="rounded bg-slate-100 px-2 py-1">{item.integration_type || item.integrationType || "Integration type unavailable"}</span><span className="rounded bg-slate-100 px-2 py-1">{item.assessment_objective || item.assessmentObjective || "Objective unavailable"}</span></div>
            <p className="mt-3 text-xs text-slate-400">Project ID: {item.id}</p>
            <Link to={`/projects/${item.id}`} className="mt-4 inline-flex text-sm font-semibold text-indigo-600 hover:underline">Open project →</Link>
          </article>)}
        </div>}
      {project.error && <p className="mt-3 text-sm text-red-600">{project.error}</p>}
    </section> : <section className="py-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-semibold">Members</h2><p className="mt-1 text-sm text-slate-500">People who can access this organization.</p></div>{isAdmin && <button onClick={() => { setLocalError(""); setMemberModal(true); }} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white">Add member</button>}</div>
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white"><table className="w-full min-w-[620px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Member</th><th className="px-4 py-3">Email</th><th className="px-4 py-3">Role</th>{isAdmin && <th className="px-4 py-3">Actions</th>}</tr></thead><tbody className="divide-y divide-slate-100">{org.members.map((member) => <tr key={member.membership_id}><td className="px-4 py-3 font-medium text-slate-800">{member.name || "—"}</td><td className="px-4 py-3 text-slate-600">{member.email || "—"}</td><td className="px-4 py-3"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs">{member.role}</span></td>{isAdmin && <td className="px-4 py-3"><div className="flex gap-3"><button onClick={() => editMemberRole(member)} className="text-indigo-600 hover:underline">Change role</button><button onClick={() => deleteMember(member)} className="text-red-600 hover:underline">Remove</button></div></td>}</tr>)}</tbody></table></div>
    </section>}

    {projectModal && <Modal title="Create project" onClose={() => setProjectModal(false)}>
      <form onSubmit={submitProject} className="space-y-4">
        <div><label className={labelClass}>Project name</label><input required minLength={2} value={projectForm.name} onChange={(e) => setProjectField("name", e.target.value)} className={inputClass} /></div>
        <div><label className={labelClass}>Description</label><textarea value={projectForm.description} onChange={(e) => setProjectField("description", e.target.value)} rows={3} className={inputClass} /></div>
        <div><label className={labelClass}>Provider</label><select value={projectForm.provider} onChange={(e) => changeProvider(e.target.value)} className={inputClass}><option value="PAYPAL">PayPal</option><option value="HYPERWALLET">Hyperwallet</option></select></div>
        {projectForm.provider === "HYPERWALLET" && <>
          <div><label className={labelClass}>Source country (ISO alpha-2)</label><input required maxLength={2} placeholder="US" value={projectForm.sourceCountry} onChange={(e) => setProjectField("sourceCountry", e.target.value.toUpperCase())} className={inputClass} /></div>
          <div><label className={labelClass}>Target countries (comma-separated ISO alpha-2)</label><input required placeholder="IN, GB, CA" value={projectForm.targetCountries} onChange={(e) => setProjectField("targetCountries", e.target.value.toUpperCase())} className={inputClass} /></div>
        </>}
        <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-500">Objective and integration type are set according to the selected provider and backend-supported project configuration.</p>
        {localError && <p className="text-sm text-red-600">{localError}</p>}
        <div className="flex justify-end gap-2"><button type="button" onClick={() => setProjectModal(false)} className="rounded-lg border px-4 py-2">Cancel</button><button disabled={project.submitting} className="rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white disabled:opacity-50">{project.submitting ? "Creating..." : "Create project"}</button></div>
      </form>
    </Modal>}

    {memberModal && <Modal title="Add organization member" onClose={() => setMemberModal(false)}>
      <div className="mb-4 flex gap-2"><button onClick={() => { setMemberMode("new"); setLocalError(""); }} className={`rounded-lg px-3 py-2 text-sm ${memberMode === "new" ? "bg-indigo-600 text-white" : "bg-slate-100"}`}>Create new user</button><button onClick={() => { setMemberMode("existing"); setLocalError(""); }} className={`rounded-lg px-3 py-2 text-sm ${memberMode === "existing" ? "bg-indigo-600 text-white" : "bg-slate-100"}`}>Add existing user</button></div>
      <form onSubmit={submitMember} className="space-y-4">
        {memberMode === "new" ? <><div><label className={labelClass}>Name</label><input required value={memberForm.name} onChange={(e) => setMemberForm({ ...memberForm, name: e.target.value })} className={inputClass} /></div><div><label className={labelClass}>Email</label><input required type="email" value={memberForm.email} onChange={(e) => setMemberForm({ ...memberForm, email: e.target.value })} className={inputClass} /></div><div><label className={labelClass}>Temporary password</label><input required minLength={8} type="password" value={memberForm.password} onChange={(e) => setMemberForm({ ...memberForm, password: e.target.value })} className={inputClass} /></div></> : <><div><label className={labelClass}>Existing user's email</label><div className="flex gap-2"><input type="email" value={memberSearch} onChange={(e) => setMemberSearch(e.target.value)} className={inputClass} /><button type="button" onClick={searchMember} className="shrink-0 rounded-lg border px-3">Search</button></div></div>{foundUser && <p className="rounded-lg bg-green-50 p-3 text-sm text-green-800">Found: {foundUser.name} · {foundUser.email}</p>}</>}
        <div><label className={labelClass}>Organization role</label><select value={memberForm.role} onChange={(e) => setMemberForm({ ...memberForm, role: e.target.value })} className={inputClass}><option value="DEVELOPER">Developer</option><option value="REVIEWER">Reviewer</option></select></div>
        {localError && <p className="text-sm text-red-600">{localError}</p>}
        <div className="flex justify-end gap-2"><button type="button" onClick={() => setMemberModal(false)} className="rounded-lg border px-4 py-2">Cancel</button><button disabled={org.submitting || (memberMode === "existing" && !foundUser)} className="rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white disabled:opacity-50">{org.submitting ? "Adding..." : "Add member"}</button></div>
      </form>
    </Modal>}
  </main>;
}
