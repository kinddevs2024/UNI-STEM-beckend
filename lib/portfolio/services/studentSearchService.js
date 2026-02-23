import StudentProfile from '../../../models/StudentProfile.js';

function toNumber(value, fallback = null) {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function toArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildStudentSearchQuery(params) {
  const query = {};
  const minGPA = toNumber(params.minGPA);
  const maxGPA = toNumber(params.maxGPA);
  const minRatingScore = toNumber(params.minRatingScore);
  const minProjectCount = toNumber(params.minProjectCount);
  const minAwardsCount = toNumber(params.minAwardsCount);

  if (minGPA !== null || maxGPA !== null) {
    query.GPA = {};
    if (minGPA !== null) query.GPA.$gte = minGPA;
    if (maxGPA !== null) query.GPA.$lte = maxGPA;
  }
  if (minRatingScore !== null) query.ratingScore = { $gte: minRatingScore };
  if (params.country) query.country = String(params.country).trim();

  const skills = toArray(params.skills);
  if (skills.length) query.skills = { $all: skills };
  const languages = toArray(params.languages);
  if (languages.length) query.languages = { $all: languages };
  if (params.certificationName) {
    query['certifications.title'] = { $regex: String(params.certificationName).trim(), $options: 'i' };
  }
  if (params.hasInternship === 'true') query.$expr = { $gt: [{ $size: '$internships' }, 0] };
  if (params.hasInternship === 'false') query.$expr = { $eq: [{ $size: '$internships' }, 0] };
  if (minProjectCount !== null) {
    query.$expr = query.$expr
      ? { $and: [query.$expr, { $gte: [{ $size: '$projects' }, minProjectCount] }] }
      : { $gte: [{ $size: '$projects' }, minProjectCount] };
  }
  if (minAwardsCount !== null) {
    query.$expr = query.$expr
      ? { $and: [query.$expr, { $gte: [{ $size: '$awards' }, minAwardsCount] }] }
      : { $gte: [{ $size: '$awards' }, minAwardsCount] };
  }
  if (params.q) {
    const q = String(params.q).trim();
    if (q) {
      query.$or = [
        { firstName: { $regex: q, $options: 'i' } },
        { lastName: { $regex: q, $options: 'i' } },
        { country: { $regex: q, $options: 'i' } },
        { skills: { $elemMatch: { $regex: q, $options: 'i' } } },
        { languages: { $elemMatch: { $regex: q, $options: 'i' } } },
        { 'certifications.title': { $regex: q, $options: 'i' } }
      ];
    }
  }
  return query;
}

function buildSort(sortBy, sortOrder) {
  const allowed = new Set(['ratingScore', 'GPA', 'createdAt']);
  const field = allowed.has(sortBy) ? sortBy : 'ratingScore';
  const order = String(sortOrder).toLowerCase() === 'asc' ? 1 : -1;
  return { [field]: order, _id: 1 };
}

export async function searchStudents(params) {
  const page = Math.max(toNumber(params.page, 1), 1);
  const limit = Math.min(Math.max(toNumber(params.limit, 20), 1), 100);
  const skip = (page - 1) * limit;
  const query = buildStudentSearchQuery(params);
  const sort = buildSort(params.sortBy, params.sortOrder);

  const [items, total] = await Promise.all([
    StudentProfile.find(query).sort(sort).skip(skip).limit(limit).lean(),
    StudentProfile.countDocuments(query)
  ]);

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(Math.ceil(total / limit), 1)
    }
  };
}
