export const GRADE_CATEGORIES = ['5', '6', '7', '8', '9', '10', '11', 'student'];
export function parseGradeCategory(value, optional = false) {
  if (optional && (value === undefined || value === null || value === '')) return null;
  const category = String(value ?? '');
  if (!GRADE_CATEGORIES.includes(category)) throw new Error('Choose school grade 5–11 or Student.');
  return category;
}
export function questionsForGrade(questions, category) {
  const grouped = questions.some(question => Boolean(question.gradeCategory));
  if (grouped && !category) return questions.filter(question => !question.gradeCategory);
  return grouped ? questions.filter(question => question.gradeCategory === category) : questions;
}
export function parseGradePrizes(value) {
  if (!Array.isArray(value) || value.length > 800) throw new Error('Prizes must be a list with up to 800 entries.');
  const seen = new Set();
  return value.map(item => {
    const gradeCategory = parseGradeCategory(item.gradeCategory);
    const place = Number(item.place), name = String(item.name ?? '').trim(), photo = String(item.photo ?? '').trim();
    const key = `${gradeCategory}:${place}`;
    if (!Number.isSafeInteger(place) || place < 1 || place > 10000 || !name || name.length > 160 || seen.has(key)) throw new Error('Each prize needs a unique place within its class and a name.');
    if (photo && !/^https:\/\//i.test(photo) && !/^\/(?:api\/)?uploads\//.test(photo)) throw new Error('Prize photo must be an HTTPS URL or an uploaded image.');
    seen.add(key);
    return { gradeCategory, place, name, photo };
  });
}
