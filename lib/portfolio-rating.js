import connectDB from "./mongodb.js";
import Portfolio from "../models/Portfolio.js";
import Result from "../models/Result.js";
import { calculateILSLevel } from "./ils-calculation.js";

/**
 * Calculate portfolio rating
 * Algorithm:
 * - ilsScore = ilsLevel * 100
 * - olympiadScore = bestOlympiadScore + (resultsCount * 20)
 * - achievementScore = achievementsCount * 30
 * - baseScore = ilsScore + olympiadScore + achievementScore
 * - portfolioRating = baseScore * verificationMultiplier
 * 
 * @param {Object} portfolio - Portfolio document
 * @returns {Promise<Number>} - Portfolio rating
 */
export async function calculatePortfolioRating(portfolio) {
  if (!portfolio) {
    return 0;
  }

  await connectDB();

  try {
    const studentId = portfolio.studentId?._id || portfolio.studentId;
    if (!studentId) {
      return 0;
    }

    // 1. ILS Score = ilsLevel * 100
    const ilsLevel = portfolio.ilsLevel || 1;
    const ilsScore = ilsLevel * 100;

    // 2. Olympiad Score = bestOlympiadScore + (resultsCount * 20)
    const results = await Result.find({ userId: studentId }).lean();
    const resultsCount = results.length;
    const bestOlympiadScore =
      results.length > 0
        ? Math.max(...results.map((r) => r.totalScore || 0), 0)
        : 0;
    const olympiadScore = bestOlympiadScore + resultsCount * 20;

    // 3. Achievement Score = achievementsCount * 30
    const blocks =
      portfolio.layout?.blocks ||
      (portfolio.layout &&
        typeof portfolio.layout === "object" &&
        portfolio.layout.blocks
        ? portfolio.layout.blocks
        : []);
    
    const achievementsCount = blocks.filter(
      (block) => block.type === "achievements" || block.type === "certificates"
    ).length;
    const achievementScore = achievementsCount * 30;

    // 4. Base Score
    const baseScore = ilsScore + olympiadScore + achievementScore;

    // 5. Verification Multiplier
    const verificationStatus = portfolio.verificationStatus || "unverified";
    let verificationMultiplier = 1.0;
    switch (verificationStatus) {
      case "verified":
        verificationMultiplier = 1.15;
        break;
      case "pending":
        verificationMultiplier = 1.0;
        break;
      case "unverified":
        verificationMultiplier = 0.9;
        break;
      case "rejected":
        verificationMultiplier = 0.7;
        break;
      default:
        verificationMultiplier = 0.9;
    }

    // 6. Final Rating
    const portfolioRating = Math.round(baseScore * verificationMultiplier);

    return portfolioRating;
  } catch (error) {
    console.error("Error calculating portfolio rating:", error);
    return 0;
  }
}

/**
 * Recalculate and update portfolio rating
 * @param {String} portfolioId - Portfolio ID
 * @returns {Promise<Object>} - Updated portfolio with new rating
 */
export async function recalculatePortfolioRating(portfolioId) {
  await connectDB();

  try {
    const portfolio = await Portfolio.findById(portfolioId);
    if (!portfolio) {
      throw new Error("Portfolio not found");
    }

    // Update ILS level first (if needed)
    const studentId = portfolio.studentId?._id || portfolio.studentId;
    if (studentId) {
      const ilsLevel = await calculateILSLevel(studentId.toString());
      if (portfolio.ilsLevel !== ilsLevel) {
        portfolio.ilsLevel = ilsLevel;
      }
    }

    // Calculate rating
    const portfolioRating = await calculatePortfolioRating(portfolio);

    // Update portfolio
    await Portfolio.findByIdAndUpdate(portfolioId, {
      $set: {
        ilsLevel: portfolio.ilsLevel,
        portfolioRating,
      },
    });

    return {
      portfolioId,
      ilsLevel: portfolio.ilsLevel,
      portfolioRating,
    };
  } catch (error) {
    console.error("Error recalculating portfolio rating:", error);
    throw error;
  }
}

/**
 * Recalculate ratings for all portfolios (admin function)
 * @param {Number} limit - Limit number of portfolios to process
 * @returns {Promise<Object>} - Summary of recalculation
 */
export async function recalculateAllPortfolioRatings(limit = 100) {
  await connectDB();

  try {
    const portfolios = await Portfolio.find({})
      .limit(limit)
      .lean();

    let updated = 0;
    let errors = 0;

    for (const portfolio of portfolios) {
      try {
        await recalculatePortfolioRating(portfolio._id);
        updated++;
      } catch (error) {
        console.error(
          `Error recalculating rating for portfolio ${portfolio._id}:`,
          error
        );
        errors++;
      }
    }

    return {
      processed: portfolios.length,
      updated,
      errors,
    };
  } catch (error) {
    console.error("Error in bulk rating recalculation:", error);
    throw error;
  }
}

export default {
  calculatePortfolioRating,
  recalculatePortfolioRating,
  recalculateAllPortfolioRatings,
};

