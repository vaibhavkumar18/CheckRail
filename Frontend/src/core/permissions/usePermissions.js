import { useSelector } from "react-redux";
import { ROLE_PERMISSIONS } from "./rolePermissions";

const usePermissions = () => {
  const user = useSelector((state) => state.auth.user);

  const role = user?.role?.toUpperCase();

  const permissions = ROLE_PERMISSIONS[role] || [];

  const hasPermission = (permission) => {
    return permissions.includes(permission);
  };

  const hasAnyPermission = (requiredPermissions = []) => {
    return requiredPermissions.some((permission) =>
      permissions.includes(permission)
    );
  };

  const hasAllPermissions = (requiredPermissions = []) => {
    return requiredPermissions.every((permission) =>
      permissions.includes(permission)
    );
  };

  return {
    user,
    role,
    permissions,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
  };
};

export default usePermissions;