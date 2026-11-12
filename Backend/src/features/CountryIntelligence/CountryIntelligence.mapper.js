
const CATEGORY_LABELS = {
  PAYMENT_ECOSYSTEM: "Payment Ecosystem",
  COLLECTIONS: "Collections",
  DISBURSEMENTS: "Disbursements",
  CURRENCY_AND_SETTLEMENT: "Currency and Settlement",
  BUSINESS_ELIGIBILITY: "Business Eligibility",
  REGULATORY: "Regulatory",
  KYC_AML: "KYC and AML",
  BANKING_AND_OPERATIONS: "Banking and Operations",
};

export const toRunResponse = (run) => ({
  runId: run.id,

  status: run.status,

  progress: {
    total: run.totalCountries,
    completed: run.completedCountries,
    failed: run.failedCountries,

    inProgress: (run.countries ?? []).filter(
      (country) => country.status === "RUNNING",
    ).length,

    queued: (run.countries ?? []).filter(
      (country) => country.status === "QUEUED",
    ).length,

    percentage: run.totalCountries
      ? Math.round(
          ((run.completedCountries + run.failedCountries) /
            run.totalCountries) *
            100,
        )
      : 0,
  },

  currentCountry: (() => {
    const current = (run.countries ?? []).find(
      (country) => country.status === "RUNNING",
    );

    return current
      ? {
          intelligenceId: current.intelligenceId,
          countryCode: current.countryCode,
          countryName: current.countryName,
        }
      : null;
  })(),

  startedAt: run.startedAt,
  completedAt: run.completedAt,

  countries: (run.countries ?? []).map((country) => ({
    intelligenceId: country.intelligenceId,
    countryCode: country.countryCode,
    countryName: country.countryName,
    status: country.status,
    requirementCount: country.requirementCount,
    sourceCount: country.sourceCount,
    error: country.errorSummary,
    researchedAt: country.researchedAt,
  })),
});

export const toProfileListResponse = (profiles) => ({
  totalCountries: profiles.length,

  profiles: profiles.map((profile) => ({
    id: profile.intelligenceId,
    runId: profile.runId,
    countryCode: profile.countryCode,
    countryName: profile.countryName,
    status: profile.status,
    requirementCount: profile.requirementCount,
    sourceCount: profile.sourceCount,
    lastResearchedAt: profile.lastResearchedAt,
  })),
});

export const toCountryDetailResponse = (profile) => {
  const grouped = new Map();

  for (const requirement of profile.requirements) {
    const category = requirement.category;

    const items = grouped.get(category) ?? [];

    items.push({
      id: requirement.id,
      title: requirement.title,
      description: requirement.description,
      applicability: requirement.applicability,
      evidenceStatus: requirement.evidenceStatus,
      confidence: requirement.confidence,

      confidenceScore:
        requirement.confidenceScore === null
          ? null
          : Number(requirement.confidenceScore),

      limitations: requirement.limitations ?? [],

      evidence: requirement.evidence.map((source) => ({
        id: source.id,
        sourceName: source.sourceName,
        url: source.url,
        domain: source.domain,
        publishedAt: source.publishedAt,
        retrievedAt: source.retrievedAt,
        excerpt: source.excerpt,
      })),
    });

    grouped.set(category, items);
  }

  return {
    id: profile.intelligenceId,

    country: {
      code: profile.countryCode,
      name: profile.countryName,
    },

    profile: {
      status: profile.status,
      runId: profile.runId,
      lastResearchedAt: profile.lastResearchedAt,
      totalRequirements: profile.requirementCount,
      totalSources: profile.sourceCount,
    },

    overview: profile.overview,

    categories: [...grouped.entries()].map(
      ([code, requirements]) => ({
        code,
        name: CATEGORY_LABELS[code] ?? code,
        requirementCount: requirements.length,
        requirements,
      }),
    ),

    sources: profile.sources.map((source) => ({
      id: source.id,
      sourceName: source.sourceName,
      url: source.url,
      domain: source.domain,
      publishedAt: source.publishedAt,
      retrievedAt: source.retrievedAt,
      excerpt: source.excerpt,
    })),
  };
};
