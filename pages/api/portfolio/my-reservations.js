import { handleCORS } from '../../../lib/api-helpers.js';
import { protect } from '../../../lib/auth.js';
import { getReservedPortfoliosByUser } from '../../../lib/portfolio-reservation-helper.js';
import { findUserByIdWithoutPassword } from '../../../lib/user-helper.js';

/**
 * @swagger
 * /api/portfolio/my-reservations:
 *   get:
 *     summary: Get all portfolios reserved by current user
 *     tags: [Portfolio]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Maximum number of results
 *       - in: query
 *         name: skip
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Number of results to skip
 */
export default async function handler(req, res) {
  // Handle CORS preflight
  if (handleCORS(req, res)) return;

  // Set cache-control headers
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      message: 'Method not allowed'
    });
  }

  try {
    // Check authentication
    const authResult = await protect(req);
    if (authResult.error) {
      return res.status(authResult.status).json({
        success: false,
        message: authResult.error
      });
    }

    const user = authResult.user;
    const limit = parseInt(req.query.limit) || 50;
    const skip = parseInt(req.query.skip) || 0;

    const reservations = await getReservedPortfoliosByUser(user._id.toString(), limit, skip);

    // Add logo URL to each portfolio in reservations
    const reservationsWithLogo = reservations.map((reservation) => {
      const portfolio = reservation.portfolio;
      if (!portfolio) {
        return reservation;
      }

      const portfolioObj = portfolio.toObject
        ? portfolio.toObject({
            virtuals: false,
            getters: false,
            minimize: false,
          })
        : portfolio;

      // Get logo URL from user's userLogo field
      let logoUrl = null;
      if (portfolio.studentId) {
        if (typeof portfolio.studentId === "object" && portfolio.studentId !== null) {
          logoUrl = portfolio.studentId.userLogo || null;
        } else {
          // If studentId is a string, try to get user data
          const studentUser = findUserByIdWithoutPassword(portfolio.studentId);
          if (studentUser) {
            logoUrl = studentUser.userLogo || null;
          }
        }
      }

      return {
        ...reservation,
        portfolio: {
          ...portfolioObj,
          logo: logoUrl,
        },
      };
    });

    res.json({
      success: true,
      data: reservationsWithLogo,
      count: reservationsWithLogo.length
    });
  } catch (error) {
    console.error('Get reserved portfolios error:', error);
    
    // Handle MongoDB connection errors
    const isMongoConnectionError =
      error.name === 'MongooseServerSelectionError' ||
      error.name === 'MongoServerSelectionError' ||
      error.message?.includes('ECONNREFUSED') ||
      error.message?.includes('connect ECONNREFUSED') ||
      error.message?.includes('connection skipped');

    if (isMongoConnectionError) {
      return res.status(503).json({
        success: false,
        message: 'Database service is currently unavailable. Please ensure MongoDB is running and try again.'
      });
    }

    res.status(500).json({
      success: false,
      message: error.message || 'Error retrieving reserved portfolios'
    });
  }
}

