
import { Navigate, Outlet } from "react-router-dom";
import { useSelector } from "react-redux";

import DashboardSidebar from "./DashboardSidebar";

function DashboardLayout() {
  const { user, isAuthenticated } = useSelector(
    (state) => state.auth
  );

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <DashboardSidebar />

      <div className="min-w-0 flex-1">
        <header className="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-6">
          <h2 className="font-semibold text-gray-800">
            Workspace
          </h2>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-semibold text-gray-900">
                {user.name || user.email}
              </p>

              <p className="text-xs text-gray-500">
                {user.role}
              </p>
            </div>

            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 font-semibold text-blue-700">
              {(user.name || user.email || "U")
                .charAt(0)
                .toUpperCase()}
            </div>
          </div>
        </header>

        <main className="p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default DashboardLayout;
