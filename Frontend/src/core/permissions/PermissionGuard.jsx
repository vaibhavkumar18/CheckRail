import usePermissions from "./usePermissions";

const PermissionGuard = ({
  permission,
  permissions = [],
  requireAll = false,
  fallback = null,
  children,
}) => {
  const {
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
  } = usePermissions();

  let allowed = true;

  if (permission) {
    allowed = hasPermission(permission);
  }

  if (permissions.length > 0) {
    allowed = requireAll
      ? hasAllPermissions(permissions)
      : hasAnyPermission(permissions);
  }

  return allowed ? children : fallback;
};

export default PermissionGuard;