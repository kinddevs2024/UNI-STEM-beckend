const DEFAULT_RATING_WEIGHTS = {
  GPA: 0.25,
  certifications: 0.2,
  internships: 0.15,
  projects: 0.15,
  awards: 0.15,
  languages: 0.1
};

function normalizeWeights(rawWeights) {
  const merged = { ...DEFAULT_RATING_WEIGHTS, ...(rawWeights || {}) };
  const total = Object.values(merged).reduce((sum, value) => sum + Number(value || 0), 0);
  if (!total) return DEFAULT_RATING_WEIGHTS;
  return Object.fromEntries(
    Object.entries(merged).map(([key, value]) => [key, Number(value || 0) / total])
  );
}

export function getRatingWeights() {
  const raw = process.env.RATING_WEIGHTS_JSON;
  if (!raw) return DEFAULT_RATING_WEIGHTS;
  try {
    return normalizeWeights(JSON.parse(raw));
  } catch {
    return DEFAULT_RATING_WEIGHTS;
  }
}
