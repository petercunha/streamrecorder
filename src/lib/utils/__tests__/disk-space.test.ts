import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getDiskSpaceInfo,
  checkDiskSpaceForRecording,
  getTotalRecordingsSizeMb,
  formatBytes,
  getDiskSpaceStatus,
  getMaxRecordingSizeMb,
  getMaxRecordingDurationMs,
} from '../disk-space';
import fs from 'fs';

// Mock fs
vi.mock('fs', () => ({
  default: {
    statSync: vi.fn(),
    statfsSync: vi.fn(),
    existsSync: vi.fn(),
    readdirSync: vi.fn(),
  },
}));

// Mock SettingsModel
vi.mock('@/lib/models/settings', () => ({
  SettingsModel: {
    getDiskLimits: vi.fn(() => ({
      minFreeMb: 5000,
      maxRecordingMb: 0,
      maxTotalRecordingsMb: 0,
      maxRecordingDurationHours: 0,
    })),
  },
}));

import { SettingsModel } from '@/lib/models/settings';

describe('disk-space utilities', () => {
  const mockStatSync = fs.statSync as ReturnType<typeof vi.fn>;
  const mockStatfsSync = (fs as any).statfsSync as ReturnType<typeof vi.fn>;
  const mockExistsSync = fs.existsSync as ReturnType<typeof vi.fn>;
  const mockReaddirSync = fs.readdirSync as ReturnType<typeof vi.fn>;
  const mockGetDiskLimits = SettingsModel.getDiskLimits as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset default mock values
    mockGetDiskLimits.mockReturnValue({
      minFreeMb: 5000,
      maxRecordingMb: 0,
      maxTotalRecordingsMb: 0,
      maxRecordingDurationHours: 0,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getDiskSpaceInfo', () => {
    it('should return disk space info when statfs is available', () => {
      const mockFsStats = {
        bsize: 4096,
        blocks: 1000000,
        bavail: 400000,
        bfree: 450000,
      };

      mockStatSync.mockReturnValue({ isDirectory: () => true });
      mockStatfsSync.mockReturnValue(mockFsStats);

      const result = getDiskSpaceInfo('/test/path');

      expect(result.total).toBe(4096 * 1000000);
      expect(result.available).toBe(4096 * 400000);
      expect(result.usedPercentage).toBeGreaterThan(0);
    });

    it('should return zeros when statfs fails', () => {
      mockStatSync.mockImplementation(() => {
        throw new Error('Stat failed');
      });

      const result = getDiskSpaceInfo('/test/path');

      expect(result.total).toBe(0);
      expect(result.free).toBe(0);
      expect(result.available).toBe(0);
    });

    it('should handle file paths by getting parent directory', () => {
      const mockFsStats = {
        bsize: 4096,
        blocks: 1000000,
        bavail: 400000,
        bfree: 450000,
      };

      mockStatSync.mockReturnValue({ isDirectory: () => false });
      mockStatfsSync.mockReturnValue(mockFsStats);

      const result = getDiskSpaceInfo('/test/path/file.txt');

      expect(mockStatfsSync).toHaveBeenCalledWith('/test/path');
      expect(result.total).toBeGreaterThan(0);
    });
  });

  describe('checkDiskSpaceForRecording', () => {
    it('should allow recording when sufficient space exists', () => {
      const mockFsStats = {
        bsize: 4096,
        blocks: 10000000,
        bavail: 8000000, // ~32GB free
        bfree: 8500000,
      };

      mockStatSync.mockReturnValue({ isDirectory: () => true });
      mockStatfsSync.mockReturnValue(mockFsStats);

      const result = checkDiskSpaceForRecording('/test/path', 1000);

      expect(result.allowed).toBe(true);
      expect(result.freeSpaceMb).toBeGreaterThan(0);
    });

    it('should deny recording when disk is full', () => {
      const mockFsStats = {
        bsize: 4096,
        blocks: 1000000,
        bavail: 100, // Very little free space
        bfree: 200,
      };

      mockStatSync.mockReturnValue({ isDirectory: () => true });
      mockStatfsSync.mockReturnValue(mockFsStats);

      const result = checkDiskSpaceForRecording('/test/path', 1000);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Insufficient disk space');
    });

    it('should deny recording when total size limit would be exceeded', () => {
      const mockFsStats = {
        bsize: 4096,
        blocks: 10000000,
        bavail: 8000000, // Plenty of free space
        bfree: 8500000,
      };

      mockStatSync.mockReturnValue({ isDirectory: () => true });
      mockStatfsSync.mockReturnValue(mockFsStats);
      mockExistsSync.mockReturnValue(true);
      mockReaddirSync.mockReturnValue(['file1.mp4', 'file2.mp4']);
      
      // Mock file sizes (100MB each)
      let callCount = 0;
      mockStatSync.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return { isDirectory: () => true };
        return { size: 100 * 1024 * 1024, isFile: () => true };
      });

      // Temporarily override the limit
      mockGetDiskLimits.mockReturnValue({
        minFreeMb: 5000,
        maxRecordingMb: 0,
        maxTotalRecordingsMb: 150, // 150MB limit
        maxRecordingDurationHours: 0,
      });

      const result = checkDiskSpaceForRecording('/test/path', 100);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Total recordings size limit');
    });
  });

  describe('getTotalRecordingsSizeMb', () => {
    it('should calculate total size of recording files', () => {
      mockExistsSync.mockReturnValue(true);
      mockReaddirSync.mockReturnValue(['file1.mp4', 'file2.mp4', 'not-a-video.txt']);
      
      let callCount = 0;
      mockStatSync.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return { size: 100 * 1024 * 1024, isFile: () => true };
        } else if (callCount === 2) {
          return { size: 200 * 1024 * 1024, isFile: () => true };
        } else {
          return { size: 1024, isFile: () => true };
        }
      });

      const result = getTotalRecordingsSizeMb('/test/path');

      expect(result).toBe(300); // 300MB total
    });

    it('should return 0 when directory does not exist', () => {
      mockExistsSync.mockReturnValue(false);

      const result = getTotalRecordingsSizeMb('/test/path');

      expect(result).toBe(0);
    });

    it('should handle errors gracefully', () => {
      mockExistsSync.mockReturnValue(true);
      mockReaddirSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      const result = getTotalRecordingsSizeMb('/test/path');

      expect(result).toBe(0);
    });
  });

  describe('formatBytes', () => {
    it('should format bytes correctly', () => {
      expect(formatBytes(0)).toBe('0 B');
      expect(formatBytes(1024)).toBe('1 KB');
      expect(formatBytes(1024 * 1024)).toBe('1 MB');
      expect(formatBytes(1024 * 1024 * 1024)).toBe('1 GB');
    });

    it('should format with decimal places', () => {
      const result = formatBytes(1536); // 1.5 KB
      expect(result).toBe('1.5 KB');
    });
  });

  describe('getDiskSpaceStatus', () => {
    it('should return ok status when disk usage is low', () => {
      const mockFsStats = {
        bsize: 4096,
        blocks: 1000000,
        bavail: 900000,
        bfree: 950000,
      };

      mockStatSync.mockReturnValue({ isDirectory: () => true });
      mockStatfsSync.mockReturnValue(mockFsStats);

      const result = getDiskSpaceStatus('/test/path');

      expect(result.status).toBe('ok');
      expect(result.usedPercentage).toBeLessThan(85);
    });

    it('should return warning status when disk usage is high', () => {
      const mockFsStats = {
        bsize: 4096,
        blocks: 1000000,
        bavail: 100000, // 90% used
        bfree: 150000,
      };

      mockStatSync.mockReturnValue({ isDirectory: () => true });
      mockStatfsSync.mockReturnValue(mockFsStats);

      const result = getDiskSpaceStatus('/test/path');

      expect(result.status).toBe('warning');
    });

    it('should return critical status when disk is almost full', () => {
      const mockFsStats = {
        bsize: 4096,
        blocks: 1000000,
        bavail: 30000, // 97% used
        bfree: 50000,
      };

      mockStatSync.mockReturnValue({ isDirectory: () => true });
      mockStatfsSync.mockReturnValue(mockFsStats);

      const result = getDiskSpaceStatus('/test/path');

      expect(result.status).toBe('critical');
    });
  });

  describe('getMaxRecordingSizeMb', () => {
    it('should return max recording size from database', () => {
      mockGetDiskLimits.mockReturnValue({
        minFreeMb: 5000,
        maxRecordingMb: 10000,
        maxTotalRecordingsMb: 0,
        maxRecordingDurationHours: 0,
      });

      const result = getMaxRecordingSizeMb();

      expect(result).toBe(10000);
    });

    it('should return 0 when unlimited', () => {
      mockGetDiskLimits.mockReturnValue({
        minFreeMb: 5000,
        maxRecordingMb: 0,
        maxTotalRecordingsMb: 0,
        maxRecordingDurationHours: 0,
      });

      const result = getMaxRecordingSizeMb();

      expect(result).toBe(0);
    });
  });

  describe('getMaxRecordingDurationMs', () => {
    it('should return max recording duration in milliseconds', () => {
      mockGetDiskLimits.mockReturnValue({
        minFreeMb: 5000,
        maxRecordingMb: 0,
        maxTotalRecordingsMb: 0,
        maxRecordingDurationHours: 2,
      });

      const result = getMaxRecordingDurationMs();

      expect(result).toBe(2 * 60 * 60 * 1000); // 2 hours in ms
    });

    it('should return 0 when unlimited', () => {
      mockGetDiskLimits.mockReturnValue({
        minFreeMb: 5000,
        maxRecordingMb: 0,
        maxTotalRecordingsMb: 0,
        maxRecordingDurationHours: 0,
      });

      const result = getMaxRecordingDurationMs();

      expect(result).toBe(0);
    });
  });
});
