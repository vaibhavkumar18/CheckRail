
import { PERMISSIONS as P } from "../../../core/permissions/permissions";

export const navigation = [
  {
    label: "Dashboard",
    path: "/dashboard",
    permission: P.DASHBOARD_VIEW,
  },
  {
    label: "Organization",
    path: "/dashboard/organization",
    permission: P.ORGANIZATION_VIEW,
  },
  {
    label: "Team",
    path: "/dashboard/team",
    permission: P.TEAM_VIEW,
  },
  {
    label: "Projects",
    path: "/dashboard/projects",
    permission: P.PROJECT_VIEW,
  },
  {
    label: "Integration",
    path: "/dashboard/integration",
    permission: P.INTEGRATION_VIEW,
  },
  {
    label: "Verification",
    path: "/dashboard/verification",
    permission: P.VERIFICATION_VIEW,
  },
  {
    label: "Country Intelligence",
    path: "/dashboard/country-intelligence",
    permission: P.COUNTRY_INTELLIGENCE_VIEW,
  },
  {
    label: "Gap Analysis",
    path: "/dashboard/gap-analysis",
    permission: P.GAP_ANALYSIS_VIEW,
  },
];
