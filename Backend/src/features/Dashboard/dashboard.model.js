import DB from "../../config/DB.js";
import { GET_DASHBOARD } from "./dashboard.queries.js";

export const getDashboardForUser = async (userId) => {
  const { rows } = await DB.query(GET_DASHBOARD, [userId]);
  return rows[0] ?? {
    organization_count: 0,
    project_count: 0,
    recent_projects: [],
  };
};
