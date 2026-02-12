import { protect, authorize } from '../../lib/auth.js';

// Middleware to protect routes
export const requireAuth = async (req, res, next) => {
  const authResult = await protect(req);
  
  if (authResult.error) {
    return res.status(authResult.status).json({ 
      success: false,
      message: authResult.error 
    });
  }
  
  req.user = authResult.user;
  next();
};

// Middleware to check roles
export const requireRole = (...roles) => {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        success: false,
        message: 'Not authorized' 
      });
    }
    
    const authError = authorize(...roles)(req.user);
    if (authError) {
      return res.status(authError.status).json({ 
        success: false,
        message: authError.error 
      });
    }
    
    next();
  };
};

