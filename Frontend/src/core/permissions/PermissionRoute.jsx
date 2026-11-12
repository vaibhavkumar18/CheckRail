import { Navigate, Outlet } from "react-router-dom";
import PermissionGuard from "./PermissionGuard";

const PermissionRoute = ({
  permission,
  children,
}) => {
  return (
    <PermissionGuard
      permission={permission}
      fallback={<Navigate to="/dashboard" replace />}
    >
      {children || <Outlet />}
    </PermissionGuard>
  );
};

export default PermissionRoute;