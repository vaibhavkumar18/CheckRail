const normalizeText = (value) => {
  if (typeof value !== "string") return "";

  return value.trim().toLowerCase().replace(/\s+/g, " ");
};

const getSourceFile = (evidence) => {
  return normalizeText(evidence?.source?.file);
};

const getSubject = (evidence) => {
  return normalizeText(evidence?.subject);
};

const createCorrelationKey = (evidence) => {
  const sourceFile = getSourceFile(evidence);
  const subject = getSubject(evidence);

  if (sourceFile && subject) {
    return `${sourceFile}::${subject}`;
  }

  return null;
};

const addToMap = (map, key, evidence) => {
  if (!key) return;

  if (!map.has(key)) {
    map.set(key, []);
  }

  map.get(key).push(evidence);
};

const correlateEvidence = (groupedResult) => {
  if (!groupedResult || !groupedResult.groups) {
    throw new Error("Valid grouped evidence is required.");
  }

  const groups = groupedResult.groups;

  const evidenceBySource = new Map();
  const evidenceBySubject = new Map();
  const evidenceByCorrelationKey = new Map();

  const processedEvidenceIds = new Set();

  for (const evidenceGroup of Object.values(groups)) {
    if (!Array.isArray(evidenceGroup)) continue;

    for (const evidence of evidenceGroup) {
      if (!evidence?.evidenceId) continue;

      // Prevent duplicate processing when evidence
      // belongs to multiple categories.
      if (processedEvidenceIds.has(evidence.evidenceId)) {
        continue;
      }

      processedEvidenceIds.add(evidence.evidenceId);

      const sourceFile = getSourceFile(evidence);
      const subject = getSubject(evidence);
      const correlationKey = createCorrelationKey(evidence);

      addToMap(evidenceBySource, sourceFile, evidence);
      addToMap(evidenceBySubject, subject, evidence);
      addToMap(evidenceByCorrelationKey, correlationKey, evidence);
    }
  }

  const correlations = [];

  const createCorrelation = (type, entries) => {
    const uniqueEntries = [
      ...new Map(entries.map((item) => [item.evidenceId, item])).values(),
    ];

    if (uniqueEntries.length < 2) return;

    correlations.push({
      correlationType: type,
      evidenceIds: uniqueEntries.map((item) => item.evidenceId),
      sourceFiles: [
        ...new Set(
          uniqueEntries.map((item) => item.source?.file).filter(Boolean),
        ),
      ],
    });
  };

  // Evidence originating from the same source file.
  for (const entries of evidenceBySource.values()) {
    createCorrelation("SAME_SOURCE_FILE", entries);
  }

  // Evidence sharing the same normalized subject.
  for (const entries of evidenceBySubject.values()) {
    createCorrelation("SAME_SUBJECT", entries);
  }

  // Evidence sharing both source file and subject.
  for (const entries of evidenceByCorrelationKey.values()) {
    createCorrelation("SAME_SOURCE_AND_SUBJECT", entries);
  }

  return {
    correlations,
    summary: {
      totalEvidence: processedEvidenceIds.size,
      totalCorrelations: correlations.length,
    },
  };
};

export default correlateEvidence;
