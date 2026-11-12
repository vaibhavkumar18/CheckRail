const footerGroups = [
  {
    title: "Product",
    links: [
      { label: "Overview", href: "#home" },
      { label: "Assessment Scenarios", href: "#scenarios" },
      { label: "Evidence Engine", href: "#findings" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "How It Works", href: "#how-it-works" },
      { label: "Documentation", href: "#" },
      { label: "API Reference", href: "#" },
    ],
  },
  {
    title: "Legal & Architecture",
    links: [
      { label: "Privacy Policy", href: "#" },
      { label: "Terms of Service", href: "#" },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-[#fbfcfd]">
      <div className="mx-auto max-w-7xl px-6 py-14 sm:px-8 lg:px-12">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-12">
          <div className="flex flex-col gap-3 md:col-span-5">
            <a href="#home" className="flex items-center gap-2.5">
              

              <span className="font-display text-xl font-medium tracking-tight bg-gradient-to-r from-[#002990] via-[#0089FA] to-[#5CC7FA] bg-clip-text text-transparent font-semibold tracking-tight text-slate-900">
                CheckRail
              </span>
            </a>

            <p className="max-w-sm text-[13px] leading-relaxed text-black-500">
              Cross-border payment expansion readiness platform. Evaluate
              integrations, verify provider sandboxes, and understand
              country-market requirements before launching.
            </p>
          </div>

          {footerGroups.map((group, index) => (
            <div
              key={group.title}
              className={`flex flex-col gap-3 text-[13px] ${
                index === 0
                  ? "md:col-span-2"
                  : index === 1
                    ? "md:col-span-2"
                    : "md:col-span-3"
              }`}
            >
              <h3 className="mb-1 font-semibold text-slate-900">
                {group.title}
              </h3>

              {group.links.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  className="text-slate-600 transition-colors hover:text-slate-950"
                >
                  {link.label}
                </a>
              ))}

              {group.title === "Legal & Architecture" && (
                <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
                  Decision-support platform only. CheckRail does not execute
                  live payments or certify legal licensure.
                </p>
              )}
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-slate-200/80 pt-7 text-center text-[11px] text-black-400 sm:flex-row sm:text-left">
          <span>© 2026 CheckRail. All rights reserved.</span>

          <span>
            Independent evaluation platform. Not affiliated with PayPal
            Holdings, Inc. or Hyperwallet Systems Inc.
          </span>
        </div>
      </div>
    </footer>
  );
}