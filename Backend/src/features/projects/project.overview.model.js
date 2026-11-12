import DB from "../../config/DB.js";
import { GET_PROJECT_OVERVIEW } from "./project.overview.queries.js";

export const getProjectOverviewForUser = async (projectId, userId) => {
  const { rows } = await DB.query(GET_PROJECT_OVERVIEW, [projectId, userId]);
  return rows[0] ?? null;
};