export const COUNTRY_REQUIREMENT_CATEGORIES = [
  "PAYMENT_ECOSYSTEM",
  "COLLECTIONS",
  "DISBURSEMENTS",
  "CURRENCY_AND_SETTLEMENT",
  "BUSINESS_ELIGIBILITY",
  "REGULATORY",
  "KYC_AML",
  "BANKING_AND_OPERATIONS",
];

export const COUNTRY_RESEARCH_TOPICS = [
  {
    key: "PAYMENTS_AND_COLLECTIONS",
    query: (country) => `Official payment ecosystem in ${country}: payment methods, domestic and cross-border payment acceptance, merchant acquiring, card networks, wallets, bank transfers, local payment methods. Prefer central bank, regulator, government and payment network sources.`,
  },
  {
    key: "PAYOUTS_AND_CURRENCY",
    query: (country) => `Official requirements in ${country} for business payouts, marketplace seller disbursements, cross-border transfers, local bank transfers, supported currencies, foreign exchange and settlement. Prefer central bank, regulator, government and bank sources.`,
  },
  {
    key: "BUSINESS_AND_REGULATORY",
    query: (country) => `Official ${country} rules relevant to foreign or domestic marketplaces and payment businesses: business eligibility, licensing, payment services regulation, money transmission, marketplace operator obligations. Prefer laws, government and financial regulator sources.`,
  },
  {
    key: "KYC_AML_AND_OPERATIONS",
    query: (country) => `Official ${country} requirements for KYC, AML, beneficial ownership, seller onboarding, recipient verification, banking, payment operations, consumer protection and data handling for marketplaces and payment providers. Prefer government and regulator sources.`,
  },
];
