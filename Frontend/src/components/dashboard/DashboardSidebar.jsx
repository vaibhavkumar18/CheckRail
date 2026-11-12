
import { NavLink } from "react-router-dom";

import usePermissions from "../../core/permissions/usePermissions";
import { navigation } from "../../features/dashboard/config/navigation";

function DashboardSidebar() {
  const { hasPermission } = usePermissions();

  const visibleNavigation = navigation.filter((item) =>
    hasPermission(item.permission)
  );

  return (
    <aside className="flex min-h-screen w-64 shrink-0 flex-col border-r border-gray-200 bg-white">
      <div className="border-b border-gray-200 px-6 py-5">
        <h1 className="text-xl font-bold tracking-tight">
          Corridor<span className="text-blue-600">Gate</span>
        </h1>

        <p className="mt-1 text-xs text-gray-500">
          Workspace
        </p>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-5">
        {visibleNavigation.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === "/dashboard"}
            className={({ isActive }) =>
              `block rounded-lg px-4 py-3 text-sm font-medium transition ${
                isActive
                  ? "bg-blue-50 text-blue-700"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}

export default DashboardSidebar;
