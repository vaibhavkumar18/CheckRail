import { useEffect, useRef, useState } from "react";

import SidebarGroup from "./SidebarGroup";
import { SidebarIcon } from "./SidebarItem";
import useAuth from "../../features/auth/hook/useAuth";

const navigationGroups = [
  {
    title: "General",
    items: [
      {
        label: "Home",
        path: "/",
        icon: "home",
        end: true,
      },
    ],
  },
  {
    title: "Workspace",
    items: [
      {
        label: "Dashboard",
        path: "/dashboard",
        icon: "dashboard",
        end: true,
      },
      {
        label: "Organizations",
        path: "/organizations",
        icon: "building",
      },
      {
        label: "Projects",
        path: "/projects",
        icon: "projects",
      },
    ],
  },
  {
    title: "Payment Intelligence",
    items: [
      {
        label: "Integrations",
        path: "/integrations",
        icon: "integration",
      },
      {
        label: "Verifications",
        path: "/verifications",
        icon: "verification",
      },
    ],
  },
];

export default function Sidebar({ collapsed, onToggle, mobileOpen, onClose }) {
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);

  const accountMenuRef = useRef(null);

  const { user, logout } = useAuth();

  // Detect the active project from the URL.

  // Identify the configured provider.

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (
        accountMenuRef.current &&
        !accountMenuRef.current.contains(event.target)
      ) {
        setAccountMenuOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setAccountMenuOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);

      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const handleLogout = async () => {
    setAccountMenuOpen(false);
    await logout();
  };

  const accountLabel =
    user?.name || user?.fullName || user?.full_name || user?.email || "Account";

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={onClose}
          className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-[2px] lg:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex h-screen flex-col border-r border-[#5CC7FA] bg-black transition-[width,transform] duration-300 ease-in-out lg:sticky lg:top-0 lg:z-30 lg:translate-x-0 ${
          collapsed ? "w-[76px]" : "w-[264px]"
        } ${
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        {/* Sidebar brand */}
        <div
          className={`flex h-[72px] shrink-0 items-center border-b border-emerald-200/80 ${
            collapsed ? "justify-center px-2" : "justify-between px-5"
          }`}
        >
          {!collapsed ? (
            <>
              <div className="min-w-0">
                <h1 className="text-xl font-normal tracking-tight bg-gradient-to-r from-[#002990] via-[#0089FA] to-[#5CC7FA] bg-clip-text text-transparent font-semibold tracking-tight text-slate-900  ">
                  CheckRail
                </h1>

                <p className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.15em] text-white">
                  Payment Intelligence
                </p>
              </div>

              <button
                type="button"
                onClick={onClose}
                aria-label="Close sidebar"
                className="rounded-lg p-2 text-white hover:bg-white lg:hidden"
              >
                <SidebarIcon name="dashboard" />
              </button>
            </>
          ) : (
            <div
              title="CheckRail"
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-lg font-bold text-blue-700 shadow-sm"
            >
              CR
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-6">
          {navigationGroups.map((group) => (
            <SidebarGroup
              key={group.title}
              title={group.title}
              items={group.items}
              collapsed={collapsed}
              onNavigate={onClose}
            />
          ))}
        </div>

        {/* Account section */}
        <div
          ref={accountMenuRef}
          className="relative shrink-0 border-t border-emerald-200/80 p-3"
        >
          {accountMenuOpen && (
            <div
              role="menu"
              aria-label="Account options"
              className={`absolute bottom-[calc(100%+8px)] z-[60] min-w-[190px] rounded-lg border border-slate-200 bg-white p-1.5 shadow-lg ${
                collapsed ? "left-3" : "left-3 right-3"
              }`}
            >
              <div className="border-b border-slate-100 px-3 py-2">
                <p className="truncate text-sm font-semibold text-slate-800">
                  {accountLabel}
                </p>

                {user?.email && user?.name && (
                  <p className="truncate text-xs text-slate-500">
                    {user.email}
                  </p>
                )}
              </div>

              <button
                type="button"
                role="menuitem"
                onClick={handleLogout}
                className="mt-1 flex w-full items-center gap-2 rounded-md px-3 py-2.5 text-left text-sm font-medium text-red-600 transition hover:bg-red-50"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  className="h-4 w-4"
                  aria-hidden="true"
                >
                  <path
                    d="M10 17l5-5-5-5M15 12H3m9-8h6a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-6"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                Logout
              </button>
            </div>
          )}

          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={accountMenuOpen}
            onClick={() => setAccountMenuOpen((open) => !open)}
            title={collapsed ? "Account options" : undefined}
            className={`flex w-full items-center gap-3 rounded-lg p-2 text-left transition hover:bg-white/60 ${
              collapsed ? "justify-center" : ""
            }`}
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-sm font-semibold text-slate-700">
              <SidebarIcon name="profile" className="h-[18px] w-[18px]" />
            </span>

            {!collapsed && (
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-white">
                  {accountLabel}
                </span>

                <span className="block text-xs text-white ">
                  Workspace profile
                </span>
              </span>
            )}

            {!collapsed && (
              <svg
                viewBox="0 0 24 24"
                fill="none"
                className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${
                  accountMenuOpen ? "rotate-180" : ""
                }`}
                aria-hidden="true"
              >
                <path
                  d="m6 9 6 6 6-6"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </button>
        </div>

        {/* Collapse button */}
        <button
          type="button"
          onClick={onToggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="absolute -right-3 top-[88px] z-50 hidden h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-md transition hover:bg-slate-50 hover:text-blue-600 lg:flex"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            className={`h-4 w-4 transition-transform duration-300 ${
              collapsed ? "rotate-180" : ""
            }`}
          >
            <path
              d="m14.5 5-7 7 7 7"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </aside>
    </>
  );
}
