export function buildQuestionReview(questions, submissions) {
  const byQuestion = new Map(submissions.map(s => [String(s.questionId), s]));
  return [...questions].sort((a,b) => (a.order ?? 0) - (b.order ?? 0)).map(q => {
    const sub = byQuestion.get(String(q._id));
    let answer = sub?.answer ?? '';
    if (typeof answer === 'string' && answer.trim().startsWith('[')) {
      try { const parsed = JSON.parse(answer); if (Array.isArray(parsed)) answer = parsed; } catch {}
    }
    const answered = Array.isArray(answer) ? answer.length > 0 : String(answer).trim().length > 0;
    const correctAnswers = q.correctAnswers?.length ? q.correctAnswers : q.correctAnswer != null ? [q.correctAnswer] : [];
    return {
      id: String(q._id), question: q.question, type: q.type,
      answer, options: q.options || [],
      correctAnswers: q.type === 'multiple-choice' ? correctAnswers : [],
      status: !answered ? 'unanswered' : q.type === 'essay' ? 'graded' : sub?.isCorrect === true ? 'correct' : 'incorrect',
      score: sub?.score ?? 0, maxScore: q.points ?? 0,
    };
  });
}
