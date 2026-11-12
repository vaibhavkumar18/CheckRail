
import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import useAuth from "../hook/useAuth";

const LoginPage = () => {
  const { login } = useAuth();

  const location = useLocation();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    email: "",
    password: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));

    if (error) setError("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    setError("");
    setLoading(true);

    try {
      const result = await login({
        email: form.email.trim(),
        password: form.password,
      });

      if (!result?.success) {
        setError(result?.message || "Unable to sign in. Please try again.");
        return;
      }

      const destination =
        location.state?.from?.pathname || "/dashboard";

      navigate(destination, {
        replace: true,
      });
    } catch (err) {
      setError(
        err?.message || "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-[calc(100vh-4.5rem)] items-center justify-center bg-[#f6f8fc] px-4 py-12 sm:px-6">
      <div className="w-full max-w-[470px]">
        <div className="rounded-2xl border border-slate-200/90 bg-white px-6 py-9 shadow-[0_4px_18px_rgba(15,23,42,0.045)] sm:px-10 sm:py-10">
          {/* Brand */}
          <Link
            to="/"
            className="inline-flex items-center text-[25px] font-bold tracking-[-1.2px] bg-gradient-to-r from-[#002990] via-[#0089FA] to-[#5CC7FA] bg-clip-text text-transparent transition-opacity hover:opacity-80"
          >
            CheckRail
            <span className="text-[#009cde]"></span>
          </Link>

          {/* Heading */}
          <div className="mt-9">
            <p className="text-[11px] font-semibold uppercase tracking-[1.6px] text-[#0070ba]">
              Workspace access
            </p>

            <h1 className="mt-3 text-[27px] font-semibold tracking-[-0.8px] text-slate-950 sm:text-[30px]">
              Welcome back
            </h1>

            <p className="mt-2 text-[14px] leading-6 text-slate-500">
              Sign in to continue managing your payment expansion
              assessments.
            </p>
          </div>

          {/* Error */}
          {error && (
            <div
              role="alert"
              className="mt-6 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3"
            >
              <span className="mt-0.5 text-sm font-semibold text-red-600">
                !
              </span>
              <p className="text-[13px] leading-5 text-red-700">
                {error}
              </p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div>
              <label
                htmlFor="login-email"
                className="mb-2 block text-[13px] font-medium text-slate-800"
              >
                Email address
              </label>

              <input
                id="login-email"
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                autoComplete="email"
                placeholder="you@example.com"
                required
                disabled={loading}
                className="h-[50px] w-full rounded-lg border border-slate-300 bg-white px-4 text-[14px] text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-[#0070ba] focus:ring-[3px] focus:ring-[#0070ba]/10 disabled:cursor-not-allowed disabled:bg-slate-50"
              />
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <label
                  htmlFor="login-password"
                  className="block text-[13px] font-medium text-slate-800"
                >
                  Password
                </label>
              </div>

              <input
                id="login-password"
                type="password"
                name="password"
                value={form.password}
                onChange={handleChange}
                autoComplete="current-password"
                placeholder="Enter your password"
                required
                disabled={loading}
                className="h-[50px] w-full rounded-lg border border-slate-300 bg-white px-4 text-[14px] text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-[#0070ba] focus:ring-[3px] focus:ring-[#0070ba]/10 disabled:cursor-not-allowed disabled:bg-slate-50"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-2 flex h-[50px] w-full items-center justify-center rounded-lg bg-[#0089FA] px-4 text-[14px] font-semibold text-white transition hover:bg-[#002990] focus:outline-none focus:ring-[3px] focus:ring-[#0057ff]/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  Signing in...
                </span>
              ) : (
                "Sign in"
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="mt-7 border-t border-slate-100 pt-6 text-center">
            <p className="text-[13px] text-slate-500">
              Don't have an account?{" "}
              <Link
                to="/auth/signup"
                className="font-semibold text-[#0057ff] transition hover:text-[#0047dc]"
              >
                Create account
              </Link>
            </p>
          </div>
        </div>

        <p className="mt-6 text-center text-[11px] text-slate-400">
          CheckRail · Payment expansion readiness
        </p>
      </div>
    </main>
  );
};

export default LoginPage;
