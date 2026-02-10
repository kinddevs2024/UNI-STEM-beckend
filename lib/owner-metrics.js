import connectMongoDB from './mongodb.js';
import User from '../models/User.js';
import Olympiad from '../models/Olympiad.js';
import Submission from '../models/Submission.js';
import Result from '../models/Result.js';

const toDateKey = (date) => date.toISOString().slice(0, 10);

const buildDateRange = (startDate, endDate) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const days = [];
  const current = new Date(start);
  current.setHours(0, 0, 0, 0);
  const endDay = new Date(end);
  endDay.setHours(0, 0, 0, 0);

  while (current <= endDay) {
    days.push(toDateKey(current));
    current.setDate(current.getDate() + 1);
  }

  return days;
};

const mapSeries = (days, rows, valueKey = 'count') => {
  const values = {};
  rows.forEach((row) => {
    values[row._id] = row[valueKey];
  });

  return days.map((day) => ({
    date: day,
    value: values[day] || 0,
  }));
};

export async function getOwnerMetrics(startDate, endDate) {
  await connectMongoDB();

  const start = new Date(startDate);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  const days = buildDateRange(start, end);

  const [
    usersByDay,
    olympiadsByDay,
    submissionsByDay,
    resultsByDay,
    averageScoreByDay,
  ] = await Promise.all([
    User.aggregate([
      { $match: { createdAt: { $gte: start, $lte: end } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
    ]),
    Olympiad.aggregate([
      { $match: { createdAt: { $gte: start, $lte: end } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
    ]),
    Submission.aggregate([
      { $match: { createdAt: { $gte: start, $lte: end } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
    ]),
    Result.aggregate([
      { $match: { completedAt: { $gte: start, $lte: end } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$completedAt' } }, count: { $sum: 1 } } },
    ]),
    Result.aggregate([
      { $match: { completedAt: { $gte: start, $lte: end } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$completedAt' } }, avgScore: { $avg: '$percentage' } } },
    ]),
  ]);

  return {
    users: mapSeries(days, usersByDay || []),
    olympiads: mapSeries(days, olympiadsByDay || []),
    submissions: mapSeries(days, submissionsByDay || []),
    results: mapSeries(days, resultsByDay || []),
    averageScore: mapSeries(days, averageScoreByDay || [], 'avgScore'),
  };
}

export default {
  getOwnerMetrics,
};
