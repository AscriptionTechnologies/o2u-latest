import {
  handleSupabaseError,
  isValidEmail,
  validatePassword,
  isOnline
} from '../errorHandler';

// Mock navigator.onLine
Object.defineProperty(global.navigator, 'onLine', {
  writable: true,
  value: true,
});

describe('Error Handler Utility', () => {
  describe('handleSupabaseError', () => {
    it('should detect network errors', () => {
      const networkError = { message: 'Failed to fetch' };
      const result = handleSupabaseError(networkError, 'Test');
      
      expect(result.type).toBe('network');
      expect(result.title).toBe('Connection Error');
      expect(result.message).toContain('internet connection');
    });

    it('should detect duplicate email errors', () => {
      const duplicateError = { message: 'User already registered' };
      const result = handleSupabaseError(duplicateError, 'Test');
      
      expect(result.type).toBe('duplicate');
      expect(result.title).toBe('Email Already Registered');
    });

    it('should detect timeout errors', () => {
      const timeoutError = { message: 'Request timeout' };
      const result = handleSupabaseError(timeoutError, 'Test');
      
      expect(result.type).toBe('timeout');
      expect(result.title).toBe('Request Timeout');
    });

    it('should handle generic errors', () => {
      const genericError = { message: 'Something went wrong' };
      const result = handleSupabaseError(genericError, 'Test');
      
      expect(result.type).toBe('generic');
      expect(result.title).toBe('Operation Failed');
      expect(result.message).toBe('Something went wrong');
    });
  });

  describe('isValidEmail', () => {
    it('should validate correct email formats', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('user.name@domain.co.uk')).toBe(true);
      expect(isValidEmail('user+tag@example.org')).toBe(true);
    });

    it('should reject invalid email formats', () => {
      expect(isValidEmail('invalid-email')).toBe(false);
      expect(isValidEmail('test@')).toBe(false);
      expect(isValidEmail('@example.com')).toBe(false);
      expect(isValidEmail('test.example.com')).toBe(false);
      expect(isValidEmail('')).toBe(false);
    });
  });

  describe('validatePassword', () => {
    it('should validate strong passwords', () => {
      const result = validatePassword('StrongPass123');
      expect(result.isValid).toBe(true);
      expect(result.message).toBe('Password is strong.');
    });

    it('should reject short passwords', () => {
      const result = validatePassword('123');
      expect(result.isValid).toBe(false);
      expect(result.message).toContain('at least 6 characters');
    });

    it('should require lowercase letters', () => {
      const result = validatePassword('PASSWORD123');
      expect(result.isValid).toBe(false);
      expect(result.message).toContain('lowercase letter');
    });

    it('should require uppercase letters', () => {
      const result = validatePassword('password123');
      expect(result.isValid).toBe(false);
      expect(result.message).toContain('uppercase letter');
    });

    it('should require numbers', () => {
      const result = validatePassword('Password');
      expect(result.isValid).toBe(false);
      expect(result.message).toContain('number');
    });
  });

  describe('isOnline', () => {
    it('should return true when online', () => {
      (global.navigator as any).onLine = true;
      expect(isOnline()).toBe(true);
    });

    it('should return false when offline', () => {
      (global.navigator as any).onLine = false;
      expect(isOnline()).toBe(false);
    });
  });
});

// Example error scenarios for testing
export const mockErrors = {
  networkError: { message: 'Failed to fetch' },
  duplicateError: { message: 'User already registered' },
  timeoutError: { message: 'Request timeout' },
  authError: { code: 'PGRST116', message: 'JWT expired' },
  validationError: { message: 'Invalid email format' },
  serverError: { message: '500 Internal Server Error' },
  rateLimit: { message: 'Too many requests' },
  genericError: { message: 'Unknown error occurred' }
};

// Test scenarios for manual testing
export const testScenarios = [
  {
    name: 'Network Failure',
    description: 'Simulate network connection failure',
    setup: () => {
      // Mock fetch to fail
      global.fetch = jest.fn().mockRejectedValue(new Error('Failed to fetch'));
    }
  },
  {
    name: 'Offline Mode',
    description: 'Simulate offline state',
    setup: () => {
      (global.navigator as any).onLine = false;
    }
  },
  {
    name: 'Duplicate Email',
    description: 'Simulate email already registered error',
    mockResponse: {
      error: { message: 'User already registered' }
    }
  },
  {
    name: 'Weak Password',
    description: 'Test password validation',
    testData: {
      passwords: ['123', 'password', 'PASSWORD', 'Pass123']
    }
  }
];
