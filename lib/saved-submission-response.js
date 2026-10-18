export function savedSubmissionResponse(result, attempt) {
  const savedAt = new Date(result.completedAt).getTime();
  const startedAt = attempt ? new Date(attempt.startedAt).getTime() : 0;
  const sameAttempt = !attempt || (Number.isFinite(savedAt) && Number.isFinite(startedAt) && savedAt >= startedAt);
  return {
    status: sameAttempt ? 200 : 409,
    body: {
      success: sameAttempt,
      code: sameAttempt ? 'SUBMISSION_ALREADY_SAVED' : 'OLYMPIAD_ALREADY_SUBMITTED',
      message: sameAttempt ? 'Your submission is already saved.' : 'You already submitted this olympiad in an earlier attempt. Open your saved result. Your current answers have not replaced it.',
      alreadySubmitted: true,
      submissionId: String(result._id),
      score: result.totalScore,
      totalPoints: result.maxScore,
      percentage: result.percentage,
      submittedAt: result.completedAt,
    },
  };
}
