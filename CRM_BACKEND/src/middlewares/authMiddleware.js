import jwt from 'jsonwebtoken';

// Authentication Middleware to check if the user is authenticated
export const authenticateUser = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || req.headers.Authorization || req.headers['x-access-token'];

    let token = authHeader;
    if (typeof authHeader === 'string' && authHeader.toLowerCase().startsWith('bearer ')) {
      token = authHeader.slice(7).trim();
    }

    if (!token) {
      return res.status(401).send({ message: 'Authentication required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET); // Replace with your JWT secret
    req.user = decoded; // Attach user data (including role) to request object
    next(); // Proceed to the next middleware or route handler
  } catch (error) {
    return res.status(401).send({ message: 'Invalid or expired token' });
  }
};

export const authorizeDevRole = (req, res, next) => {
  const normalizedRole = (req.user?.user_role || '').toString().trim().toLowerCase();
  const allowedRoles = ['srdev', 'dev', 'admin', 'senior admin', 'super admin'];

  if (!allowedRoles.includes(normalizedRole)) {
    return res.status(403).send({ message: 'Access denied. Only authorized admins/devs can access this route.' });
  }
  next();
};

// Middleware to check if user has a specific feature permission
export const authorizeFeature = (featureKey) => {
  return (req, res, next) => {
    const userPermissions = req.user?.feature_permissions || [];
    const normalizedRole = (req.user?.user_role || '').toString().trim().toLowerCase();
    const adminRoles = ['srdev', 'dev', 'admin', 'senior admin', 'super admin'];

    // Allow admin/dev roles full access
    if (adminRoles.includes(normalizedRole)) {
      return next();
    }

    // Check if user has the required feature permission
    if (userPermissions.includes(featureKey)) {
      return next();
    }

    return res.status(403).send({
      message: `Access denied. You need '${featureKey}' permission to access this route.`,
    });
  };
};


