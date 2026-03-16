import jwt from 'jsonwebtoken';

// Authentication Middleware to check if the user is authenticated
export const authenticateUser = async (req, res, next) => {
  try {
    const token = req.headers.authorization; // Extract token from Bearer <token>

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
  if (req.user?.user_role !== 'srdev' && req.user?.user_role !== 'dev') {
    return res.status(403).send({ message: 'Access denied. Only devs can access this route.' });
  }
  next(); // Proceed if the user has the 'dev' or 'srdev' role
};


