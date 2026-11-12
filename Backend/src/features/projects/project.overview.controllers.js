import { getProjectOverviewForUser } from "./project.overview.model.js";

export const getProjectOverview = async (req, res, next) => {
  try {
    const project = await getProjectOverviewForUser(
      req.params.projectId,
      req.user.id,
    );

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found or access denied.",
      });
    }

    const countryStatus = project.country_intelligence_status;
    const capabilityStatus = project.capability_execution_status;

    return res.status(200).json({
      success: true,
      message: "Project overview retrieved successfully.",
      data: {
        project: {
          id: project.project_id,
          organizationId: project.organization_id,
          name: project.project_name,
          provider: project.provider,
          sourceCountry: project.source_country,
          targetCountries: project.target_countries,
          integrationType: project.integration_type,
          createdAt: project.created_at,
          updatedAt: project.updated_at,
        },
        workflow: {
          integration: project.integration_id
            ? project.integration_review_status
            : "NOT_STARTED",
          capabilityVerification: capabilityStatus ?? "NOT_STARTED",
          countryIntelligence: countryStatus ?? "NOT_STARTED",
          aiGapAnalysis: project.gap_analysis_status ?? "NOT_STARTED",
        },
        latestRecords: {
          integrationProfile: project.integration_id
            ? {
                id: project.integration_id,
                reviewStatus: project.integration_review_status,
                createdAt: project.integration_created_at,
                updatedAt: project.integration_updated_at,
              }
            : null,
        },
        latestRuns: {
          capabilityVerification: project.capability_run_id
            ? {
                id: project.capability_run_id,
                overallStatus: project.capability_overall_status,
                executionStatus: project.capability_execution_status,
                startedAt: project.capability_started_at,
                completedAt: project.capability_completed_at,
              }
            : null,
          countryIntelligence: project.country_intelligence_id
            ? {
                id: project.country_intelligence_id,
                countryCode: project.country_intelligence_country_code,
                status: project.country_intelligence_status,
                researchedAt: project.country_intelligence_researched_at,
              }
            : null,
          aiGapAnalysis: project.gap_analysis_run_id
            ? {
                id: project.gap_analysis_run_id,
                status: project.gap_analysis_status,
                createdAt: project.gap_analysis_created_at,
                completedAt: project.gap_analysis_completed_at,
              }
            : null,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};