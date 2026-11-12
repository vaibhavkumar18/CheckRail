import { getDashboardForUser } from "./dashboard.model.js";

export const getDashboard = async (req, res, next) => {
  try {
    const result = await getDashboardForUser(req.user.id);

    return res.status(200).json({
      success: true,
      message: "Dashboard retrieved successfully.",
      data: {
        organizationCount: Number(result.organization_count ?? 0),
        projectCount: Number(result.project_count ?? 0),
        recentProjects: (result.recent_projects ?? []).map((project) => ({
          id: project.id,
          organizationId: project.organization_id,
          organizationName: project.organization_name,
          name: project.name,
          provider: project.provider,
          sourceCountry: project.source_country,
          targetCountries: project.target_countries,
          createdAt: project.created_at,
          updatedAt: project.updated_at,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
};
