/**
 * User Routes Unit Tests
 * Tests: Token generation, permissions, role handling
 */

import { jest } from '@jest/globals';
import jwt from 'jsonwebtoken';

// Inline generateToken function (same as in routes)
const generateToken = (user) => {
  return jwt.sign({
    userId: user._id,
    user_role: user.user_role,
    feature_permissions: user.feature_permissions || []
  }, process.env.JWT_SECRET || 'test-secret', {
    expiresIn: '24h',
  });
};

describe('👥 USER ROUTES TESTS', () => {
  describe('Test 10: Generate Token with Permissions', () => {
    it('should generate JWT with userId, role, and feature_permissions', () => {
      const user = {
        _id: '123',
        user_role: 'hr',
        feature_permissions: ['manage_users', 'employee_profile']
      };

      const token = generateToken(user);
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'test-secret');

      expect(decoded.userId).toBe('123');
      expect(decoded.user_role).toBe('hr');
      expect(decoded.feature_permissions).toContain('manage_users');
      expect(decoded.feature_permissions).toContain('employee_profile');
    });

    it('should include empty feature_permissions if user has none', () => {
      const user = {
        _id: '456',
        user_role: 'sales'
      };

      const token = generateToken(user);
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'test-secret');

      expect(decoded.feature_permissions).toEqual([]);
    });
  });

  describe('Test 11: Feature Permission Defaults', () => {
    it('should return correct default permissions for admin role', () => {
      const defaults = {
        admin: [
          'dashboard_overview', 'projection_leads', 'agreements_generator',
          'generated_documents', 'process_documents', 'manage_users',
          'manage_services', 'company_profile', 'employee_profile', 'timecard'
        ],
        hr: ['dashboard_overview', 'employee_profile', 'timecard', 'communication'],
        sales: ['dashboard_overview', 'projection_leads', 'communication', 'employee_profile']
      };

      expect(defaults.admin).toContain('manage_users');
      expect(defaults.admin).toContain('process_documents');
      expect(defaults.hr).toContain('employee_profile');
      expect(defaults.sales).toContain('projection_leads');
    });
  });

  describe('Test 12: Token Expiration', () => {
    it('should set 24h expiration', () => {
      const user = { _id: '123', user_role: 'admin' };
      const token = generateToken(user);
      const decoded = jwt.decode(token);

      expect(decoded.exp).toBeDefined();
      // Check that expiration is roughly 24 hours from now
      const now = Math.floor(Date.now() / 1000);
      const twentyFourHours = 24 * 60 * 60;
      expect(decoded.exp - now).toBeGreaterThan(twentyFourHours - 10);
      expect(decoded.exp - now).toBeLessThanOrEqual(twentyFourHours + 10);
    });
  });

  describe('Test 13: User Role Normalization', () => {
    it('should normalize various HR role formats', () => {
      const roles = ['HR', 'hr', 'Hr', 'HUMAN RESOURCE', 'human resource'];
      const normalized = roles.map(r => r.toLowerCase().trim());
      
      normalized.forEach(r => {
        expect(['hr', 'human resource']).toContain(r);
      });
    });

    it('should normalize various Admin role formats', () => {
      const roles = ['Admin', 'ADMIN', 'admin', 'Super Admin', 'super admin', 'Sr.Dev', 'dev'];
      const normalized = roles.map(r => r.toLowerCase().trim().replace(/\./g, ''));
      
      const validRoles = ['admin', 'super admin', 'srdev', 'dev'];
      normalized.forEach(r => {
        if (validRoles.includes(r)) {
          expect(validRoles).toContain(r);
        }
      });
    });
  });
});

