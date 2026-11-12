
import * as service from "./CountryIntelligence.services.js";
import * as mapper from "./CountryIntelligence.mapper.js";

const getUserId = (req) => req.user?.id ?? req.user?.userId;

const sendError = (res, error) => {
  const statusCode = Number.isInteger(error.statusCode)
    ? error.statusCode
    : 500;

  return res.status(statusCode).json({
    success: false,
    message:
      statusCode < 500
        ? error.message
        : "Country Intelligence request failed.",
    ...(error.code && statusCode < 500
      ? { code: error.code }
      : {}),
  });
};

export const startCountryIntelligence = async (req, res) => {
  try {
    const result = await service.startCountryIntelligence({
      projectId: req.params.projectId,
      userId: getUserId(req),
    });

    return res.status(result.alreadyRunning ? 200 : 202).json({
      success: true,
      message: result.alreadyRunning
        ? "Country Intelligence research is already running for this project."
        : "Country Intelligence research has been queued.",
      data: {
        runId: result.run.id,
        status: result.run.status,
        totalCountries: result.run.totalCountries,
        countries: result.countries,
      },
    });
  } catch (error) {
    return sendError(res, error);
  }
};

export const getCountryIntelligenceRun = async (req, res) => {
  try {
    const run = await service.getCountryIntelligenceRun({
      projectId: req.params.projectId,
      runId: req.params.runId,
      userId: getUserId(req),
    });

    return res.status(200).json({
      success: true,
      data: mapper.toRunResponse(run),
    });
  } catch (error) {
    return sendError(res, error);
  }
};

export const getCountryIntelligenceProfiles = async (req, res) => {
  try {
    const profiles = await service.getCountryIntelligenceProfiles({
      projectId: req.params.projectId,
      userId: getUserId(req),
    });

    return res.status(200).json({
      success: true,
      data: mapper.toProfileListResponse(profiles),
    });
  } catch (error) {
    return sendError(res, error);
  }
};

export const getCountryIntelligenceProfile = async (req, res) => {
  try {
    const profile = await service.getCountryIntelligenceProfile({
      projectId: req.params.projectId,
      intelligenceId: req.params.intelligenceId,
      userId: getUserId(req),
    });

    return res.status(200).json({
      success: true,
      data: mapper.toCountryDetailResponse(profile),
    });
  } catch (error) {
    return sendError(res, error);
  }
};
