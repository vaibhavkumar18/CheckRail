
import * as projectService from "./project.services.js";

const getAuthenticatedUserId = (req) => {
    return req.user?.id ?? req.user?.userId;
};

// NEW: Get all projects accessible to the authenticated user.
export const getProjectsForUser = async (req, res, next) => {
    try {
        const userId = getAuthenticatedUserId(req);

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Authenticated user not found",
            });
        }

        const projects = await projectService.getProjectsForUser(userId);

        return res.status(200).json({
            success: true,
            message: "Projects fetched successfully",
            data: projects,
        });
    } catch (error) {
        next(error);
    }
};

export const createProject = async (req, res, next) => {
    try {
        const userId = getAuthenticatedUserId(req);

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Authenticated user not found",
            });
        }

        const project = await projectService.createProject(
            {
                ...req.body,
                organizationId: req.params.organizationId,
            },
            userId
        );

        return res.status(201).json({
            success: true,
            message: "Project created successfully",
            data: project,
        });
    } catch (error) {
        next(error);
    }
};

export const getProjectsByOrganization = async (req, res, next) => {
    try {
        const projects = await projectService.getProjectsByOrganization(
            req.params.organizationId
        );

        return res.status(200).json({
            success: true,
            message: "Projects fetched successfully",
            data: projects,
        });
    } catch (error) {
        next(error);
    }
};

export const getProjectById = async (req, res, next) => {
    try {
        const project = await projectService.getProjectById(
            req.params.projectId
        );

        if (!project) {
            return res.status(404).json({
                success: false,
                message: "Project not found",
            });
        }

        return res.status(200).json({
            success: true,
            message: "Project fetched successfully",
            data: project,
        });
    } catch (error) {
        next(error);
    }
};

export const updateProject = async (req, res, next) => {
    try {
        const project = await projectService.updateProject(
            req.params.projectId,
            req.body
        );

        if (!project) {
            return res.status(404).json({
                success: false,
                message: "Project not found",
            });
        }

        return res.status(200).json({
            success: true,
            message: "Project updated successfully",
            data: project,
        });
    } catch (error) {
        next(error);
    }
};

export const deleteProject = async (req, res, next) => {
    try {
        const deletedProject = await projectService.deleteProject(
            req.params.projectId
        );

        if (!deletedProject) {
            return res.status(404).json({
                success: false,
                message: "Project not found",
            });
        }

        return res.status(200).json({
            success: true,
            message: "Project deleted successfully",
            data: {
                id: deletedProject.id,
            },
        });
    } catch (error) {
        next(error);
    }
};
