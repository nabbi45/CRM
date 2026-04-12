/**
 * Authentication Tests - Unit Tests (No Supertest)
 * Tests: Token validation, role authorization logic
 */

import { jest } from '@jest/globals';
import jwt from 'jsonwebtoken';

// Inline middleware functions for testing
const authenticateUser = (req, res, next) => {
  const authHeader = req.headers?.authorization;
  if (!authHeader) {
    return res.status(401).send({ message: 'Authentication required' });
  }

  let token = authHeader;
  if (authHeader.toLowerCase().startsWith('bearer ')) {
    token = authHeader.slice(7).trim();
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'test-secret');
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).send({ message: 'Invalid or expired token' });
  }
};

const authorizeFeature = (featureKey) => {
  return (req, res, next) => {
    const userPermissions = req.user?.feature_permissions || [];
    const normalizedRole = (req.user?.user_role || '').toString().trim().toLowerCase();
    const adminRoles = ['srdev', 'dev', 'admin', 'senior admin', 'super admin'];

    if (adminRoles.includes(normalizedRole)) {
      return next();
    }

    if (userPermissions.includes(featureKey)) {
      return next();
    }

    const readableFeature = featureKey
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());

    return res.status(403).send({
      message: `Access denied. You need "${readableFeature}" permission to perform this action.`,
      requiredPermission: featureKey,
      currentPermissions: userPermissions,
    });
  };
};

const authorizeDevRole = (req, res, next) => {
  const normalizedRole = (req.user?.user_role || '').toString().trim().toLowerCase();
  const allowedRoles = ['srdev', 'dev', 'admin', 'senior admin', 'super admin'];

  if (!allowedRoles.includes(normalizedRole)) {
    return res.status(403).send({ message: 'Access denied. Only authorized admins/devs can access this route.' });
  }
  next();
};

// Mock response object
const createMockRes = () => ({
  statusCode: null,
  body: null,
  status(code) {
    this.statusCode = code;
    return this;
  },
  send(data) {
    this.body = data;
    return this;
  },
  json(data) {
    this.body = data;
    return this;
  }
});

describe('🔐 AUTHENTICATION TESTS', () => {
  describe('Test 1: authenticateUser - Valid Token', () => {
    it('should decode and attach user to request', () => {
      const validToken = jwt.sign(
        { userId: '123', user_role: 'admin', feature_permissions: ['manage_users'] },
        process.env.JWT_SECRET || 'test-secret'
      );

      const req = { headers: { authorization: validToken } };
      const res = createMockRes();
      const next = jest.fn();

      authenticateUser(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.user.userId).toBe('123');
      expect(req.user.user_role).toBe('admin');
    });
  });

  describe('Test 2: authenticateUser - Missing Token', () => {
    it('should return 401 when token is missing', () => {
      const req = { headers: {} };
      const res = createMockRes();
      const next = jest.fn();

      authenticateUser(req, res, next);

      expect(res.statusCode).toBe(401);
      expect(res.body.message).toBe('Authentication required');
    });
  });

  describe('Test 3: authenticateUser - Invalid Token', () => {
    it('should return 401 when token is invalid', () => {
      const req = { headers: { authorization: 'invalid-token' } };
      const res = createMockRes();
      const next = jest.fn();

      authenticateUser(req, res, next);

      expect(res.statusCode).toBe(401);
      expect(res.body.message).toBe('Invalid or expired token');
    });
  });

  describe('Test 4: authorizeFeature - Admin Role Access', () => {
    it('should allow admin to access any feature', () => {
      const req = { user: { user_role: 'super admin', feature_permissions: [] } };
      const res = createMockRes();
      const next = jest.fn();

      const middleware = authorizeFeature('manage_users');
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe('Test 5: authorizeFeature - HR with Permission', () => {
    it('should allow HR user with manage_users permission', () => {
      const req = { user: { user_role: 'hr', feature_permissions: ['manage_users'] } };
      const res = createMockRes();
      const next = jest.fn();

      const middleware = authorizeFeature('manage_users');
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe('Test 6: authorizeFeature - User without Permission', () => {
    it('should deny user without required permission', () => {
      const req = { user: { user_role: 'sales', feature_permissions: ['dashboard_overview'] } };
      const res = createMockRes();
      const next = jest.fn();

      const middleware = authorizeFeature('manage_users');
      middleware(req, res, next);

      expect(res.statusCode).toBe(403);
      expect(res.body.message).toContain('Access denied');
      expect(res.body.requiredPermission).toBe('manage_users');
    });
  });

  describe('Test 7: authorizeDevRole - Dev Access', () => {
    it('should allow dev role access to dev routes', () => {
      const req = { user: { user_role: 'dev' } };
      const res = createMockRes();
      const next = jest.fn();

      authorizeDevRole(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe('Test 8: authorizeDevRole - Non-Dev Denied', () => {
    it('should deny non-dev roles', () => {
      const req = { user: { user_role: 'sales' } };
      const res = createMockRes();
      const next = jest.fn();

      authorizeDevRole(req, res, next);

      expect(res.statusCode).toBe(403);
      expect(res.body.message).toContain('Access denied');
    });
  });

  describe('Test 9: Bearer Token Format', () => {
    it('should handle Bearer token format correctly', () => {
      const validToken = jwt.sign(
        { userId: '123', user_role: 'admin' },
        process.env.JWT_SECRET || 'test-secret'
      );

      const req = { headers: { authorization: `Bearer ${validToken}` } };
      const res = createMockRes();
      const next = jest.fn();

      authenticateUser(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.user.userId).toBe('123');
    });
  });
});

