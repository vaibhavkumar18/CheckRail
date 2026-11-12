
import SidebarItem from "./SidebarItem";

export default function SidebarGroup({
    title,
    items = [],
    collapsed = false,
    onNavigate,
}) {
    return (
        <div className="mb-6">
            {!collapsed && (
                <p className="mb-2 px-3.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                    {title}
                </p>
            )}

            {collapsed && (
                <div className="mx-3 mb-3 border-t border-slate-200" />
            )}

            <div className="space-y-1">
                {items.map((item) => (
                    <SidebarItem
                        key={item.path}
                        item={item}
                        collapsed={collapsed}
                        onNavigate={onNavigate}
                    />
                ))}
            </div>
        </div>
    );
}
