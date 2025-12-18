import connectDB from "./mongodb.js";
import Result from "../models/Result.js";

/**
 * Calculate ILS Level (1-9) from olympiad results
 * Uses combination algorithm:
 * - Factor 1: Best percentage score (weight: 50%)
 * - Factor 2: Number of olympiads participated (weight: 30%)
 * - Factor 3: Total points accumulated (weight: 20%)
 * 
 * @param {String} studentId - Student user ID
 * @returns {Promise<Number>} - ILS level (1-9)
 */
export async function calculateILSLevel(studentId) {
  if (!studentId) {
    return 1; // Default to level 1
  }

  await connectDB();

  try {
    // Get all results for student
    const results = await Result.find({ userId: studentId }).lean();

    if (!results || results.length === 0) {
      return 1; // No results = level 1
    }

    // Factor 1: Best percentage score (weight: 50%)
    const bestPercentage = Math.max(
      ...results.map((r) => (r.percentage || 0)),
      0
    );

    // Factor 2: Number of olympiads participated (weight: 30%)
    const olympiadsCount = results.length;

    // Factor 3: Total points accumulated (weight: 20%)
    const totalPoints = results.reduce((sum, r) => sum + (r.totalScore || 0), 0);

    // Normalize factors to 0-100 scale
    const percentageScore = bestPercentage; // Already 0-100
    const countScore = Math.min(olympiadsCount * 10, 100); // Max 10 olympiads = 100
    const pointsScore = Math.min((totalPoints / 10), 100); // Max 1000 points = 100

    // Weighted combination
    const combinedScore =
      percentageScore * 0.5 + countScore * 0.3 + pointsScore * 0.2;

    // Map to ILS level 1-9
    // Level 9: 95-100
    // Level 8: 85-94
    // Level 7: 75-84
    // Level 6: 65-74
    // Level 5: 55-64
    // Level 4: 45-54
    // Level 3: 35-44
    // Level 2: 25-34
    // Level 1: 0-24

    if (combinedScore >= 95) return 9;
    if (combinedScore >= 85) return 8;
    if (combinedScore >= 75) return 7;
    if (combinedScore >= 65) return 6;
    if (combinedScore >= 55) return 5;
    if (combinedScore >= 45) return 4;
    if (combinedScore >= 35) return 3;
    if (combinedScore >= 25) return 2;
    return 1;
  } catch (error) {
    console.error("Error calculating ILS level:", error);
    return 1; // Default to level 1 on error
  }
}

/**
 * Update ILS level for a portfolio
 * @param {String} portfolioId - Portfolio ID
 * @returns {Promise<Number>} - Updated ILS level
 */
export async function updatePortfolioILSLevel(portfolioId) {
  await connectDB();
  const Portfolio = (await import("../models/Portfolio.js")).default;

  try {
    const portfolio = await Portfolio.findById(portfolioId);
    if (!portfolio) {
      throw new Error("Portfolio not found");
    }

    const studentId = portfolio.studentId?._id || portfolio.studentId;
    if (!studentId) {
      return 1;
    }

    const ilsLevel = await calculateILSLevel(studentId.toString());
    
    // Update portfolio ILS level
    await Portfolio.findByIdAndUpdate(portfolioId, {
      $set: { ilsLevel },
    });

    return ilsLevel;
  } catch (error) {
    console.error("Error updating portfolio ILS level:", error);
    return 1;
  }
}

export default {
  calculateILSLevel,
  updatePortfolioILSLevel,
};

