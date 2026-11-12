import * as integrationService from "./Integration.services.js";

// --------------------------------------------------
// Upload + Automatic Processing
// --------------------------------------------------

export const createIntegration = async (req, res, next) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: "No file uploaded.",
            });
        }

        const result = await integrationService.createIntegration({
            file: req.file,
            projectId: req.params.projectId,
            userId: req.user.id,
        });

        return res.status(201).json({
            success: true,
            message: "Integration analysed successfully. Review is pending.",

            integrationSource: {
                id: result.integrationSource.id,
                originalFilename:
                    result.integrationSource.original_filename,
                sourceType: result.integrationSource.source_type,
                status: result.integrationSource.status,
                createdAt: result.integrationSource.created_at,
            },

            integration: {
                id: result.integration.id,
                sourceId: result.integration.sourceId,
                reviewStatus: result.integration.reviewStatus,
                profile: result.integration.profile,
            },

            processing: result.processing,
        });
    } catch (error) {
        next(error);
    }
};

// --------------------------------------------------
// Retrieve Integration Preview
// --------------------------------------------------

export const getIntegrationPreview = async (req, res, next) => {
    try {
        const integration = await integrationService.getIntegrationPreview({
            integrationId: req.params.integrationId,
            userId: req.user.id,
        });

        return res.status(200).json({
            success: true,
            message: "Integration preview retrieved successfully.",

            integration: {
                id: integration.id,
                sourceId: integration.source_id,
                projectId: integration.project_id,
                originalFilename: integration.original_filename,
                reviewStatus: integration.review_status,
                profile: integration.integration_profile,
                createdAt: integration.created_at,
                updatedAt: integration.updated_at,
            },
        });
    } catch (error) {
        next(error);
    }
};

// --------------------------------------------------
// Update Integration Preview
// --------------------------------------------------

export const updateIntegrationPreview = async (req, res, next) => {
    try {
        const { profile } = req.body;

        if (!profile || typeof profile !== "object" || Array.isArray(profile)) {
            return res.status(400).json({
                success: false,
                message: "A valid Integration Profile is required.",
            });
        }

        const integration =
            await integrationService.updateIntegrationPreview({
                integrationId: req.params.integrationId,
                userId: req.user.id,
                profile,
            });

        return res.status(200).json({
            success: true,
            message: "Integration preview updated successfully.",

            integration: {
                id: integration.id,
                reviewStatus: integration.review_status,
                profile: integration.integration_profile,
                updatedAt: integration.updated_at,
            },
        });
    } catch (error) {
        next(error);
    }
};

// --------------------------------------------------
// Confirm Integration
// --------------------------------------------------

// --------------------------------------------------
// Confirm Integration + Automatic Assessment
// --------------------------------------------------

export const confirmIntegration = async (req, res, next) => {
    try {
        const result =
            await integrationService.confirmIntegration({
                integrationId: req.params.integrationId,
                userId: req.user.id,
            });

        return res.status(200).json({
            success: true,
            message:
                "Integration confirmed and preliminary assessment completed.",

            integration: {
                id: result.integration.id,
                reviewStatus: result.integration.review_status,
                confirmedBy: result.integration.confirmed_by,
                confirmedAt: result.integration.confirmed_at,
            },

            assessment: {
                id: result.assessment.id,
                type: result.assessment.assessment_type,
                status: result.assessment.assessment_status,
                result: result.assessment.result,
                createdAt: result.assessment.created_at,
            },
        });
    } catch (error) {
        next(error);
    }
};

// --------------------------------------------------
// List Integration Profiles For Project
// --------------------------------------------------

export const getIntegrationsForProject = async (req, res, next) => {
    try {
        const integrations = await integrationService.listIntegrationsForProject({
            projectId: req.params.projectId,
            userId: req.user.id,
        });

        return res.status(200).json({
            success: true,
            message: "Project integration profiles retrieved successfully.",
            data: {
                integrations: integrations.map((integration) => ({
                    id: integration.id,
                    sourceId: integration.source_id,
                    originalFilename: integration.original_filename,
                    sourceType: integration.source_type,
                    sourceStatus: integration.source_status,
                    reviewStatus: integration.review_status,
                    createdAt: integration.created_at,
                    updatedAt: integration.updated_at,
                })),
            },
        });
    } catch (error) {
        next(error);
    }
};

// --------------------------------------------------
// List All Integration Profiles Accessible to User
// --------------------------------------------------

export const getAllIntegrations = async (req, res, next) => {
    try {
        const integrations =
            await integrationService.listIntegrationsForUser({
                userId: req.user.id,
            });

        return res.status(200).json({
            success: true,
            message: "Integration profiles retrieved successfully.",
            data: {
                integrations: integrations.map((integration) => ({
                    id: integration.id,
                    sourceId: integration.source_id,
                    projectId: integration.project_id,
                    projectName: integration.project_name,
                    originalFilename: integration.original_filename,
                    sourceType: integration.source_type,
                    sourceStatus: integration.source_status,
                    reviewStatus: integration.review_status,
                    createdAt: integration.created_at,
                    updatedAt: integration.updated_at,
                })),
            },
        });
    } catch (error) {
        next(error);
    }
};