
import { Link, useLocation } from "react-router-dom";

const routeLabels = {
    dashboard: "Dashboard",
    organizations: "Organizations",
    projects: "Projects",
    integrations: "Integrations",
    verifications: "Verifications",
    integration: "Integration",
    verification: "Verification",
    "country-intelligence": "Country Intelligence",
    "ai-analysis": "AI Gap Analysis",
};

export default function PageHeader({
    title,
    description,
    actions,
}) {
    const location = useLocation();

    const segments = location.pathname
        .split("/")
        .filter(Boolean);

    const breadcrumbs = segments.map((segment, index) => {
        const isId = /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(segment);

        return {
            label: isId
                ? "Details"
                : routeLabels[segment] ||
                  segment.replaceAll("-", " ").replace(/\b\w/g, (c) => c.toUpperCase()),
            path: "/" + segments.slice(0, index + 1).join("/"),
            isLast: index === segments.length - 1,
        };
    });

    const pageTitle =
        title ||
        breadcrumbs[breadcrumbs.length - 1]?.label ||
        "Dashboard";

    return (
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
            <div className="flex min-h-[68px] flex-wrap items-center justify-between gap-3 px-5 py-3 sm:px-8">
                <div className="min-w-0">
                    <nav
                        aria-label="Breadcrumb"
                        className="mb-1 flex flex-wrap items-center gap-2 text-xs text-slate-400"
                    >
                        <Link
                            to="/dashboard"
                            className="font-medium transition hover:text-blue-600"
                        >
                            Workspace
                        </Link>

                        {breadcrumbs.map((crumb, index) => (
                            <span
                                key={crumb.path}
                                className="flex items-center gap-2"
                            >
                                <span>/</span>

                                {crumb.isLast ? (
                                    <span className="font-medium text-slate-600">
                                        {crumb.label}
                                    </span>
                                ) : (
                                    <Link
                                        to={crumb.path}
                                        className="transition hover:text-blue-600"
                                    >
                                        {crumb.label}
                                    </Link>
                                )}
                            </span>
                        ))}
                    </nav>

                    <div className="flex flex-wrap items-center gap-2">
                        <h1 className="text-sm font-semibold text-slate-800">
                            {pageTitle}
                        </h1>

                        {description && (
                            <span className="hidden text-xs text-slate-400 sm:inline">
                                · {description}
                            </span>
                        )}
                    </div>
                </div>

                {actions && (
                    <div className="flex shrink-0 items-center gap-2">
                        {actions}
                    </div>
                )}
            </div>
        </header>
    );
}
