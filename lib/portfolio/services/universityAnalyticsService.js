import StudentProfile from '../../../models/StudentProfile.js';

export async function getUniversityAnalytics() {
  const [summary, studentsByCountry] = await Promise.all([
    StudentProfile.aggregate([
      {
        $group: {
          _id: null,
          totalStudents: { $sum: 1 },
          averageGPA: { $avg: '$GPA' },
          averageRatingScore: { $avg: '$ratingScore' }
        }
      }
    ]),
    StudentProfile.aggregate([
      { $group: { _id: { $ifNull: ['$country', 'Unknown'] }, count: { $sum: 1 } } },
      { $sort: { count: -1, _id: 1 } },
      { $project: { _id: 0, country: '$_id', count: 1 } }
    ])
  ]);

  const first = summary[0] || { totalStudents: 0, averageGPA: 0, averageRatingScore: 0 };
  return {
    totalStudents: first.totalStudents || 0,
    studentsByCountry: studentsByCountry || [],
    averageGPA: Number((first.averageGPA || 0).toFixed(2)),
    averageRatingScore: Number((first.averageRatingScore || 0).toFixed(2))
  };
}
