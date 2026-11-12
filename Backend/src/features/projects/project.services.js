
import * as projectModel from "./project.model.js";

export const createProject = async (data, userId) => {
    return projectModel.createProject({
        ...data,
        createdBy: userId,
    });
};

// NEW: User-scoped project listing.
export const getProjectsForUser = async (userId) => {
    return projectModel.getProjectsForUser(userId);
};

export const getProjectsByOrganization = async (organizationId) => {
    return projectModel.getProjectsByOrganization(organizationId);
};

export const getProjectById = async (projectId) => {
    return projectModel.getProjectById(projectId);
};

export const updateProject = async (projectId, updates) => {
    const existingProject = await projectModel.getProjectById(projectId);

    if (!existingProject) {
        return null;
    }

    const sourceCountry =
        updates.sourceCountry ?? existingProject.sourceCountry;

    const targetCountries =
        updates.targetCountries ?? existingProject.targetCountries;

    if (
        Array.isArray(targetCountries) &&
        targetCountries.includes(sourceCountry)
    ) {
        const error = new Error(
            "Source country cannot also be a target country"
        );

        error.statusCode = 400;
        throw error;
    }

    return projectModel.updateProject(projectId, updates);
};

export const deleteProject = async (projectId) => {
    return projectModel.deleteProject(projectId);
};
