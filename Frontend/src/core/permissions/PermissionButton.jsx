
import PermissionGuard from "./PermissionGuard";

function PermissionButton({
  permission,
  children,
  onClick,
  className = "",
  disabled = false,
  type = "button",
  title,
}) {
  return (
    <PermissionGuard permission={permission}>
      <button
        type={type}
        onClick={onClick}
        disabled={disabled}
        title={title}
        className={className}
      >
        {children}
      </button>
    </PermissionGuard>
  );
}

export default PermissionButton;
