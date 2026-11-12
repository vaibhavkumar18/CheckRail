
import { useState } from "react";
import { Link } from "react-router-dom";
import { useSelector } from "react-redux";

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);

  const { status, user } = useSelector((state) => state.auth);

  const isAuthenticated =
    status === "authenticated" || Boolean(user);

  const isChecking = status === "checking";

  const links = [
    { label: "Product", href: "#home" },
    { label: "How It Works", href: "#how-it-works" },
    { label: "Capabilities", href: "#scenarios" },
    { label: "Documentation", href: "#findings" },
  ];

  const displayName =
    user?.name ||
    user?.fullName ||
    user?.email?.split("@")[0] ||
    "Account";

  return (
    <header className="sticky top-0 z-50 border-b border-[#002990] bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex h-16 items-center justify-between px-6 sm:px-8 lg:px-12">
        <div className="flex items-center gap-8">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="font-display text-[25px] bg-gradient-to-r from-[#002990] via-[#0089FA] to-[#5CC7FA] bg-clip-text text-transparent font-semibold tracking-tight text-slate-900">
              CheckRail
            </span>
          </Link>

          <nav className="hidden items-center gap-7 text-[13px] font-medium text-slate-600 md:flex">
            {links.map((link, index) => (
              <a
                key={link.label}
                href={link.href}
                className={`transition-colors hover:text-slate-950 ${
                  index === 0 ? "text-slate-950" : ""
                }`}
              >
                {link.label}
              </a>
            ))}
          </nav>
        </div>

        <div className="hidden items-center gap-5 text-[13px] sm:flex">
          {isChecking ? (
            <span className="text-slate-400">Checking session...</span>
          ) : isAuthenticated ? (
            <>
              <span className="max-w-[140px] truncate font-medium text-slate-600">
                {displayName}
              </span>

              <Link
                to="/dashboard"
                className="rounded-[3px] bg-slate-950 px-4 py-2.5 text-[12px] font-medium text-white transition-colors hover:bg-slate-800 bg-gradient-to-r from-[#5CC7FA] via-[#0089FA] to-[#002990] "
              >
                Go to Dashboard
              </Link>
            </>
          ) : (
            <>
              <Link
                to="/auth/login"
                className="font-medium text-slate-600 transition-colors hover:text-slate-950"
              >
                Sign In
              </Link>

              <Link
                to="/auth/signup"
                className="rounded-[3px] bg-slate-950 px-4 py-2.5 text-[12px] font-medium text-white transition-colors hover:bg-slate-800"
              >
                Start Your Assessment
              </Link>
            </>
          )}
        </div>

        <button
          type="button"
          aria-label="Toggle navigation"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
          className="flex h-9 w-9 items-center justify-center rounded-[4px] border border-slate-200 text-slate-800 md:hidden"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            className="h-5 w-5"
          >
            {menuOpen ? (
              <path d="m6 6 12 12M18 6 6 18" />
            ) : (
              <path d="M4 7h16M4 12h16M4 17h16" />
            )}
          </svg>
        </button>
      </div>

      {menuOpen && (
        <div className="border-t border-slate-200 bg-white px-6 py-5 md:hidden">
          <nav className="flex flex-col gap-4 text-sm text-slate-700">
            {links.map((link) => (
              <a
                key={link.label}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className="py-1 hover:text-blue-700"
              >
                {link.label}
              </a>
            ))}

            <div className="mt-2 flex gap-4 border-t border-slate-100 pt-4">
              {isChecking ? (
                <span className="py-2 text-slate-400">
                  Checking session...
                </span>
              ) : isAuthenticated ? (
                <Link
                  to="/dashboard"
                  onClick={() => setMenuOpen(false)}
                  className="rounded-[5px] bg-slate-950 px-4 py-2 text-white"
                >
                  Go to Dashboard
                </Link>
              ) : (
                <>
                  <Link to="/auth/login" className="py-2">
                    Sign In
                  </Link>

                  <Link
                    to="/auth/signup"
                    onClick={() => setMenuOpen(false)}
                    className="rounded-[5px] bg-slate-950 px-4 py-2 text-white"
                  >
                    Start Your Assessment
                  </Link>
                </>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
