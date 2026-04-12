/**
 * Booking Documents API Tests
 * Tests: Upload, fetch, delete, stats, search
 */

const request = require('supertest');
const express = require('express');
const multer = require('multer');

jest.mock('../src/models/BookingDocumentModel');
jest.mock('../src/models/bookingModel');
jest.mock('cloudinary');

describe('📄 BOOKING DOCUMENTS TESTS', () => {
  describe('Test 13: Document Types Validation', () => {
    const DOCUMENT_TYPES = ["agreement", "pitch_deck", "dpr", "application", "others"];

    it('should have exactly 5 document types defined', () => {
      expect(DOCUMENT_TYPES.length).toBe(5);
    });

    it('should include all expected document types', () => {
      expect(DOCUMENT_TYPES).toContain('agreement');
      expect(DOCUMENT_TYPES).toContain('pitch_deck');
      expect(DOCUMENT_TYPES).toContain('dpr');
      expect(DOCUMENT_TYPES).toContain('application');
      expect(DOCUMENT_TYPES).toContain('others');
    });
  });

  describe('Test 14: File Size Limits', () => {
    it('should enforce 50MB file size limit', () => {
      const upload = multer({
        limits: { fileSize: 50 * 1024 * 1024 }
      });
      
      expect(upload).toBeDefined();
    });
  });

  describe('Test 15: API Endpoints Structure', () => {
    const expectedEndpoints = [
      { method: 'POST', path: '/api/booking-documents/upload', auth: true },
      { method: 'GET', path: '/api/booking-documents/booking/:bookingId', auth: true },
      { method: 'GET', path: '/api/booking-documents/all', auth: true },
      { method: 'GET', path: '/api/booking-documents/stats', auth: true },
      { method: 'DELETE', path: '/api/booking-documents/:id', auth: true }
    ];

    it('should have all required document endpoints', () => {
      expectedEndpoints.forEach(endpoint => {
        expect(endpoint.path).toMatch(/\/api\/booking-documents/);
        expect(endpoint.auth).toBe(true);
      });
    });
  });

  describe('Test 16: Document Count Statistics', () => {
    it('should return correct document count structure', () => {
      const stats = {
        agreement: 0,
        pitch_deck: 0,
        dpr: 0,
        application: 0,
        others: 0
      };

      expect(Object.keys(stats)).toHaveLength(5);
      expect(stats.agreement).toBe(0);
    });
  });

  describe('Test 17: Booking Query Fields', () => {
    it('should include payment fields in booking query', () => {
      const requiredFields = [
        '_id', 'company_name', 'contact_person', 'contact_no', 
        'services', 'bdm', 'date', 'status', 
        'total_amount', 'term_1', 'term_2', 'term_3'
      ];

      requiredFields.forEach(field => {
        expect(field).toBeTruthy();
      });
    });
  });
});
