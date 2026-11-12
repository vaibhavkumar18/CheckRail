
import DB from "../../config/DB.js";

import {
    INSERT_ASSESSMENT_RUN,
    GET_ASSESSMENT_BY_INTEGRATION,
} from "./Assessment.queries.js";


export const createAssessmentRun = async ({
    integrationId,
    assessmentStatus,
    result,
    userId,
}) => {
    const queryResult = await DB.query(
        INSERT_ASSESSMENT_RUN,
        [
            integrationId,
            assessmentStatus,
            JSON.stringify(result),
            userId,
        ],
    );

    return queryResult.rows[0] ?? null;
};


export const getAssessmentByIntegration = async (
    integrationId,
) => {
    const queryResult = await DB.query(
        GET_ASSESSMENT_BY_INTEGRATION,
        [integrationId],
    );

    return queryResult.rows[0] ?? null;
};
