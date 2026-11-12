export const resolveScenarioDependencies = ({
    step,
    completedSteps,
}) => {
    for (const dependencyId of step.dependsOn || []) {
        const dependency = completedSteps.get(dependencyId);

        if (!dependency) {
            return {
                ready: false,
                reason: `Dependency ${dependencyId} has not completed.`,
            };
        }

        if (dependency.status !== "PASSED") {
            return {
                ready: false,
                reason: `Dependency ${dependencyId} did not pass.`,
            };
        }
    }

    return {
        ready: true,
        reason: null,
    };
};

export const validateScenarioDefinition = (scenario) => {
    if (!scenario || !Array.isArray(scenario.steps)) {
        throw new Error("Invalid Sandbox scenario definition.");
    }

    const stepIds = new Set();

    for (const step of scenario.steps) {
        if (!step.id || !step.operation) {
            throw new Error(
                "Every scenario step must define an ID and operation.",
            );
        }

        if (stepIds.has(step.id)) {
            throw new Error(
                `Duplicate scenario step: ${step.id}`,
            );
        }

        stepIds.add(step.id);
    }

    for (const step of scenario.steps) {
        for (const dependency of step.dependsOn || []) {
            if (!stepIds.has(dependency)) {
                throw new Error(
                    `Unknown scenario dependency: ${dependency}`,
                );
            }

            if (dependency === step.id) {
                throw new Error(
                    `Scenario step cannot depend on itself: ${dependency}`,
                );
            }
        }
    }

    return true;
};