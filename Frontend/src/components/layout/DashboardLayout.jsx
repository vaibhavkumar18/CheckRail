
import { useState } from "react";
import { Outlet } from "react-router-dom";

import Sidebar from "./Sidebar";
import PageHeader from "./PageHeader";

export default function DashboardLayout() {
    const [collapsed, setCollapsed] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);

    const toggleSidebar = () => {
        setCollapsed((current) => !current);
    };

    const closeMobileSidebar = () => {
        setMobileOpen(false);
    };

    return (
        <div className="flex min-h-screen w-full bg-slate-50">
            <Sidebar
                collapsed={collapsed}
                onToggle={toggleSidebar}
                mobileOpen={mobileOpen}
                onClose={closeMobileSidebar}
            />

            <div className="flex min-h-screen min-w-0 flex-1 flex-col">
                {/* Mobile top bar */}
                <div className="sticky top-0 z-30 flex h-[60px] shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4 lg:hidden">
                    <button
                        type="button"
                        onClick={() => setMobileOpen(true)}
                        aria-label="Open navigation"
                        className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 transition hover:bg-slate-100"
                    >
                        <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            className="h-5 w-5"
                        >
                            <path
                                d="M4 6h16M4 12h16M4 18h16"
                                stroke="currentColor"
                                strokeWidth="1.8"
                                strokeLinecap="round"
                            />
                        </svg>
                    </button>

                    <span className="text-base font-bold tracking-tight text-slate-800">
                        CheckRail
                    </span>
                </div>

                {/* Application header */}
                <PageHeader />

                {/* Route content */}
                <main className="min-h-0 flex-1 px-5 py-6 sm:px-8 sm:py-8">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
