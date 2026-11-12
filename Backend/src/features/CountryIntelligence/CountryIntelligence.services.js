
import * as model from "./CountryIntelligence.model.js";
import {
  executeCountryIntelligenceRun,
} from "./research/countryResearch.engine.js";

const createError = (message, statusCode = 400) =>
  Object.assign(new Error(message), { statusCode });

const resolveCountryName = (countryCode) => {
  try {
    const name = new Intl.DisplayNames(["en"], {
      type: "region",
    }).of(countryCode);

    if (!name || name === countryCode) {
      throw new Error("Unknown country code");
    }

    return name;
  } catch {
    throw createError(
      `Unsupported ISO country code: ${countryCode}.`,
      400,
    );
  }
};

const normalizeTargetCountries = (value) => {
  if (!Array.isArray(value)) return [];

  return [
    ...new Set(
      value
        .map((item) => String(item).trim().toUpperCase())
        .filter((code) => /^[A-Z]{2}$/.test(code)),
    ),
  ];
};

const getProjectContextOrThrow = async (projectId, userId) => {
  const project = await model.getAuthorizedProjectContext(
    projectId,
    userId,
  );

  if (!project) {
    throw createError(
      "Project not found or you do not have access to it.",
      404,
    );
  }

  const countries = normalizeTargetCountries(
    project.targetCountries,
  );

  if (!countries.length) {
    throw createError(
      "This project has no target countries configured. Country Intelligence is available for projects with saved target countries.",
      400,
    );
  }

  return {
    project,
    countries: countries.map((code) => ({
      code,
      name: resolveCountryName(code),
    })),
  };
};

export const startCountryIntelligence = async ({
  projectId,
  userId,
}) => {
  const { countries } = await getProjectContextOrThrow(
    projectId,
    userId,
  );

  const result = await model.createResearchRun({
    projectId,
    userId,
    countries,
  });

  if (!result.existing) {
    // In-process execution. No worker, queue, Redis or separate service.
    setImmediate(() => {
      executeCountryIntelligenceRun(result.run.id).catch(
        async (error) => {
          console.error(
            "Country Intelligence in-process execution failed:",
            error.message,
          );

          try {
            await model.finishRun(result.run.id, {
              completed: 0,
              failed: countries.length,
              errorSummary: error.message,
            });
          } catch (persistError) {
            console.error(
              "Failed to persist Country Intelligence execution failure:",
              persistError.message,
            );
          }
        },
      );
    });
  }

  const runDetails = result.existing
    ? await model.getRun(result.run.id, projectId)
    : null;

  return {
    run: result.run,
    alreadyRunning: result.existing,
    countries:
      result.existing && runDetails?.countries?.length
        ? runDetails.countries.map((country) => ({
            countryCode: country.countryCode,
            countryName: country.countryName,
            status: country.status,
          }))
        : countries.map(({ code, name }) => ({
            countryCode: code,
            countryName: name,
            status: "QUEUED",
          })),
  };
};

export const getCountryIntelligenceRun = async ({
  projectId,
  runId,
  userId,
}) => {
  await getProjectContextOrThrow(projectId, userId);

  const run = await model.getRun(runId, projectId);

  if (!run) {
    throw createError(
      "Country Intelligence run not found.",
      404,
    );
  }

  return run;
};

export const getCountryIntelligenceProfiles = async ({
  projectId,
  userId,
}) => {
  await getProjectContextOrThrow(projectId, userId);

  return model.getLatestProfiles(projectId);
};

export const getCountryIntelligenceProfile = async ({
  projectId,
  intelligenceId,
  userId,
}) => {
  // Ensure the requesting user has access to this project.
  await getProjectContextOrThrow(projectId, userId);

  // The profile UUID is the resource identifier.
  const profile = await model.getCountryProfileById(
    projectId,
    intelligenceId,
  );

  if (!profile) {
    throw createError(
      "Country Intelligence profile not found for this project.",
      404,
    );
  }

  return profile;
};
