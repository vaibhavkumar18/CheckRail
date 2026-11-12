import * as model from "../CountryIntelligence.model.js";
import { researchCountry } from "./countryResearch.service.js";

export const executeCountryIntelligenceRun = async (runId) => {
  await model.markRunStarted(runId);
  const profiles = await model.getRunProfilesForExecution(runId);
  let completed = 0;
  let failed = 0;
  const errors = [];

  // Sequential execution limits search/LLM bursts and keeps provider costs predictable.
  for (const profile of profiles) {
    try {
      await model.markProfileStarted(profile.id);
      const result = await researchCountry({
        countryCode: profile.countryCode,
        countryName: profile.countryName,
      });
      await model.saveCountryResearch({
        profileId: profile.id,
        overview: result.overview,
        sources: result.sources,
        requirements: result.requirements,
      });
      completed += 1;
    } catch (error) {
      failed += 1;
      errors.push(`${profile.countryCode}: ${error.message}`);
      await model.markProfileFailed(profile.id, error.message);
    }
  }

  await model.finishRun(runId, {
    completed,
    failed,
    errorSummary: errors.length ? errors.join(" | ").slice(0, 4000) : null,
  });
};
