
import { NavLink } from "react-router-dom";

const icons = {
    home: (
        <>
            <path d="m3 10 9-7 9 7" />
            <path d="M5 9v12h14V9" />
            <path d="M9 21v-7h6v7" />
        </>
    ),

    dashboard: (
        <>
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="14" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
        </>
    ),

    building: (
        <>
            <path d="M3 21h18" />
            <path d="M5 21V7l8-4v18" />
            <path d="M19 21V11l-6-4" />
            <path d="M9 9v.01M9 12v.01M9 15v.01M9 18v.01" />
        </>
    ),

    projects: (
        <>
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <path d="M7 8h12M7 12h8M7 16h5" />
        </>
    ),

    integration: (
        <>
            <path d="M8 12h8M12 8v8" />
            <circle cx="12" cy="12" r="9" />
        </>
    ),

    verification: (
        <>
            <path d="m7 12 3 3 7-7" />
            <circle cx="12" cy="12" r="9" />
        </>
    ),

    country: (
        <>
            <circle cx="12" cy="12" r="9" />
            <path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" />
        </>
    ),

    analysis: (
        <>
            <path d="M4 19V5M4 19h16" />
            <path d="m7 15 3-4 3 2 5-7" />
        </>
    ),

    profile: (
        <>
            <circle cx="12" cy="8" r="4" />
            <path d="M4 21a8 8 0 0 1 16 0" />
        </>
    ),

    settings: (
        <>
            <circle cx="12" cy="12" r="3" />
            <path d="m19.4 15 .1.1 1.4 1.1-1.5 2.6-1.7-.6a8 8 0 0 1-1.8 1l-.3 1.8h-3l-.3-1.8a8 8 0 0 1-1.8-1l-1.7.6-1.5-2.6 1.4-1.1a8 8 0 0 1 0-2l-1.4-1.1 1.5-2.6 1.7.6a8 8 0 0 1 1.8-1l.3-1.8h3l.3 1.8a8 8 0 0 1 1.8 1l1.7-.6 1.5 2.6-1.4 1.1a8 8 0 0 1 0 2Z" />
        </>
    ),
};

export const SidebarIcon = ({
    name,
    className = "h-5 w-5",
}) => (
    <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden="true"
    >
        {icons[name] || icons.dashboard}
    </svg>
);

export default function SidebarItem({
    item,
    collapsed = false,
    onNavigate,
}) {
    return (
        <NavLink
            to={item.path}
            end={item.end ?? false}
            onClick={onNavigate}
            title={collapsed ? item.label : undefined}
            className={({ isActive }) =>
                `group relative flex min-h-[46px] items-center gap-3 rounded-lg px-3.5 py-2.5 transition-all duration-200 ${
                    isActive
                        ? "bg-blue-50 text-blue-700"
                        : "text-slate-600 hover:bg-white/70 hover:text-slate-900"
                } ${collapsed ? "justify-center px-2" : ""}`
            }
        >
            {({ isActive }) => (
                <>
                    {isActive && (
                        <span className="absolute bottom-2 left-0 top-2 w-[3px] rounded-r-full bg-blue-600" />
                    )}

                    <SidebarIcon
                        name={item.icon}
                        className={`h-5 w-5 shrink-0 ${
                            isActive
                                ? "text-blue-600"
                                : "text-slate-500 group-hover:text-slate-700"
                        }`}
                    />

                    {!collapsed && (
                        <span className="min-w-0 flex-1 truncate text-sm font-medium">
                            {item.label}
                        </span>
                    )}
                </>
            )}
        </NavLink>
    );
}
