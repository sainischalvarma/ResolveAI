import {
  BarChart3,
  Bell,
  BookOpen,
  Bot,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Settings,
  ShieldCheck,
  User as UserIcon,
  Users,
  Wrench
} from "lucide-react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { cn } from "../utils/cn";
import { ThemeToggle } from "../components/ThemeToggle";

export function AppLayout() {
  const { user, isAdmin, isStaff, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  // Dynamic navigation items based on whether user is ADMIN, STAFF, or USER
  const navItems = isAdmin
    ? [
        { label: "Admin Console", to: "/admin/dashboard", icon: ShieldCheck },
        { label: "Staff Workbench", to: "/staff/dashboard", icon: Wrench },
        { label: "User Portal", to: "/user/dashboard", icon: LayoutDashboard },
        { label: "AI Support", to: "/support", icon: Bot },
        { label: "All Tickets", to: "/tickets", icon: ClipboardList },
        { label: "Staff Directory", to: "/technicians", icon: Users },
        { label: "Knowledge Base", to: "/knowledge", icon: BookOpen },
        { label: "Analytics", to: "/analytics", icon: BarChart3 },
        { label: "Notifications", to: "/notifications", icon: Bell },
        { label: "Settings", to: "/settings", icon: Settings }
      ]
    : isStaff
    ? [
        { label: "Technician Workbench", to: "/staff/dashboard", icon: Wrench },
        { label: "Ticket Queue", to: "/tickets", icon: ClipboardList },
        { label: "AI Support Agent", to: "/support", icon: Bot },
        { label: "Notifications", to: "/notifications", icon: Bell },
        { label: "Settings", to: "/settings", icon: Settings }
      ]
    : [
        { label: "User Dashboard", to: "/user/dashboard", icon: LayoutDashboard },
        { label: "AI Support Agent", to: "/support", icon: Bot },
        { label: "My Sessions", to: "/sessions", icon: Wrench },
        { label: "My Tickets", to: "/tickets", icon: ClipboardList },
        { label: "Notifications", to: "/notifications", icon: Bell },
        { label: "Settings", to: "/settings", icon: Settings }
      ];

  const initials = user?.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "RA";

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-950 dark:text-slate-100 lg:grid lg:grid-cols-[280px_1fr]">
      <aside className="border-b border-slate-200 dark:border-slate-800 bg-slate-950 text-white lg:min-h-screen lg:border-b-0 lg:border-r lg:border-slate-800/80 flex flex-col justify-between">
        <div>
          {/* Brand Header */}
          <div className="flex items-center justify-between px-5 py-5 border-b border-white/5">
            <div className="flex items-center gap-3">
              <div
                className={`grid h-10 w-10 place-items-center rounded-xl font-black text-slate-950 text-sm shadow-md ${
                  isAdmin
                    ? "bg-gradient-to-tr from-indigo-500 to-purple-400 text-white"
                    : isStaff
                    ? "bg-gradient-to-tr from-amber-400 to-orange-500 text-slate-950 font-black"
                    : "bg-gradient-to-tr from-teal-400 to-cyan-300 text-slate-950"
                }`}
              >
                RA
              </div>
              <div>
                <p className="font-bold tracking-tight text-white">ResolveAI</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span
                    className={`inline-block h-1.5 w-1.5 rounded-full ${
                      isAdmin ? "bg-indigo-400" : isStaff ? "bg-amber-400" : "bg-teal-400"
                    }`}
                  />
                  <p className="text-[11px] text-slate-400 font-medium">
                    {isAdmin ? "Admin Console" : isStaff ? "Technician Center" : "User Workspace"}
                  </p>
                </div>
              </div>
            </div>
            <ThemeToggle />
          </div>

          {/* Navigation Links */}
          <nav className="grid gap-1 px-3 py-4">
            <p className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              {isAdmin ? "Management & Telemetry" : isStaff ? "Support Operations" : "Employee Support"}
            </p>
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/user/dashboard" || item.to === "/admin/dashboard" || item.to === "/staff/dashboard" || item.to === "/"}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-300 hover:bg-white/10 hover:text-white transition-all",
                    isActive &&
                      (isAdmin
                        ? "bg-indigo-600 text-white font-semibold shadow-md shadow-indigo-600/30 hover:bg-indigo-600"
                        : isStaff
                        ? "bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20 hover:bg-amber-500"
                        : "bg-teal-500 text-slate-950 font-bold shadow-md shadow-teal-500/20 hover:bg-teal-500")
                  )
                }
              >
                <item.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>

        {/* User Profile & Role Switcher */}
        <div className="p-3 border-t border-white/10 bg-slate-950/80">
          <div className="rounded-xl border border-white/10 bg-white/5 p-3.5">
            <div className="flex items-center gap-3">
              <div
                className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg text-xs font-bold ${
                  isAdmin
                    ? "bg-indigo-500/20 border border-indigo-400/30 text-indigo-300"
                    : isStaff
                    ? "bg-amber-500/20 border border-amber-400/30 text-amber-300"
                    : "bg-teal-500/20 border border-teal-400/30 text-teal-300"
                }`}
              >
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-white truncate">
                    {user?.name || (isAdmin ? "Administrator" : isStaff ? "Sam Staff" : "Employee User")}
                  </p>
                  <span
                    className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded tracking-wide ${
                      isAdmin
                        ? "bg-indigo-500/30 text-indigo-300 border border-indigo-500/40"
                        : isStaff
                        ? "bg-amber-500/30 text-amber-300 border border-amber-500/40"
                        : "bg-teal-500/30 text-teal-300 border border-teal-500/40"
                    }`}
                  >
                    {user?.role || (isAdmin ? "ADMIN" : isStaff ? "STAFF" : "USER")}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 truncate mt-0.5">
                  {user?.email || (isAdmin ? "admin@resolveai.com" : isStaff ? "staff@resolveai.com" : "user@resolveai.com")}
                </p>
              </div>
            </div>

            {/* User Sign Out */}
            <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-end">
              <button
                type="button"
                onClick={handleLogout}
                className="flex items-center gap-1.5 text-xs font-medium text-rose-300 hover:text-white px-2.5 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 transition-all w-full justify-center"
                title="Sign out of account"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sign out
              </button>
            </div>
          </div>
        </div>
      </aside>

      <div className="min-w-0">
        <Outlet />
      </div>
    </div>
  );
}
