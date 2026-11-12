
import { createBrowserRouter, Navigate } from "react-router-dom";

// Layouts
import DashboardLayout from "./components/layout/DashboardLayout";
import PublicLayout from "./components/layout/PublicLayout";

// Route guards
import ProtectedRoute from "./components/routes/ProtectedRoute";
import PublicRoute from "./components/routes/PublicRoute";

// Public homepage
import HomePage from "./pages/HomePage";

// Authentication
import LoginPage from "./features/auth/pages/LoginPage";
import SignupPage from "./features/auth/pages/SignupPage";

// Dashboard
import DashboardPage from "./features/dashboard/pages/DashboardPage";

// Organizations
import OrganizationsPage from "./features/organization/pages/OrganizationsPage";
import OrganizationDetailsPage from "./features/organization/pages/OrganizationDetailsPage";

// Projects
import ProjectsPage from "./features/project/pages/ProjectsPage";
import ProjectDetailsPage from "./features/project/pages/ProjectDetailsPage";
import ProjectWorkflowPage from "./features/project/pages/ProjectWorkflowPage";
import CountryIntelligencePage from "./features/CountryIntelligence/pages/CountryIntelligencePage";
import CountryIntelligenceReportPage from "./features/CountryIntelligence/pages/CountryIntelligenceReportPage";
import GapAnalysisPage from "./features/AIGapAnalysis/pages/GapAnalysisPage";
import GapAnalysisReportPage from "./features/AIGapAnalysis/pages/GapAnalysisReportPage";

// Integration
import IntegrationsPage from "./features/Integration/pages/IntegrationsPage";
import IntegrationReportPage from "./features/Integration/pages/IntegrationReportPage";

// Verification
import VerificationsPage from "./features/Verification/pages/VerificationsPage";
import VerificationReportPage from "./features/Verification/pages/VerificatoinReportPage";

const router = createBrowserRouter([
  // PUBLIC LAYOUT
  {
    element: <PublicLayout />,
    children: [
      {
        path: "/",
        element: <HomePage />,
      },

      {
        element: <PublicRoute />,
        children: [
          {
            path: "/auth/login",
            element: <LoginPage />,
          },
          {
            path: "/auth/signup",
            element: <SignupPage />,
          },
        ],
      },
    ],
  },

  // PROTECTED APPLICATION
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <DashboardLayout />,
        children: [
          {
            path: "/dashboard",
            element: <DashboardPage />,
          },

          // ORGANIZATIONS
          {
            path: "/organizations",
            element: <OrganizationsPage />,
          },
          {
            path: "/organizations/:organizationId",
            element: <OrganizationDetailsPage />,
          },

          // PROJECTS
          {
            path: "/projects",
            element: <ProjectsPage />,
          },
          {
            path: "/projects/:projectId",
            element: <ProjectDetailsPage />,
          },
          {
            path: "/projects/:projectId/workflow",
            element: <ProjectWorkflowPage />,
          },
          {
            path: "/projects/:projectId/country-intelligence",
            element: <CountryIntelligencePage />,
          },
          {
            path: "/projects/:projectId/country-intelligence/:intelligenceId",
            element: <CountryIntelligenceReportPage />,
          },
          {
            path: "/projects/:projectId/ai-gap-analysis",
            element: <GapAnalysisPage />,
          },
          {
            path: "/projects/:projectId/ai-gap-analysis/:runId",
            element: <GapAnalysisReportPage />,
          },

          // INTEGRATIONS
          {
            path: "/integrations",
            element: <IntegrationsPage />,
          },
          {
            path: "/integrations/:integrationId",
            element: <IntegrationReportPage />,
          },

          // VERIFICATIONS
          {
            path: "/verifications",
            element: <VerificationsPage />,
          },
          {
            path: "/verifications/:runId",
            element: <VerificationReportPage />,
          },
        ],
      },
    ],
  },

  // FALLBACK
  {
    path: "*",
    element: <Navigate to="/" replace />,
  },
]);

export default router;
