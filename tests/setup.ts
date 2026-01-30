import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeAll, vi } from 'vitest';
import { getTestDb, clearTestDb } from './db-mock';

// Mock the database module before any imports
vi.mock('@/lib/db', async () => {
  const { getTestDb } = await import('./db-mock');
  return {
    default: getTestDb(),
    initDatabase: vi.fn(),
  };
});

// Clean up after each test
afterEach(() => {
  cleanup();
  clearTestDb();
});

// Global test timeout
beforeAll(() => {
  // Initialize database
  getTestDb();
});
