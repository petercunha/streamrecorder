import fs from 'fs';
import path from 'path';
import { SettingsModel } from '../models/settings';

export interface DiskSpaceInfo {
  total: number;
  free: number;
  available: number;
  used: number;
  usedPercentage: number;
}

export interface DiskCheckResult {
  allowed: boolean;
  reason?: string;
  freeSpaceMb: number;
  usedPercentage: number;
}

/**
 * Get disk space information for a path
 */
export function getDiskSpaceInfo(filePath: string): DiskSpaceInfo {
  try {
    const stats = fs.statSync(filePath);
    // For files, get the directory stats
    const dirPath = stats.isDirectory() ? filePath : path.dirname(filePath);
    
    // Use statfs if available (Node.js 18.15.0+)
    if ('statfsSync' in fs) {
      const fsStats = (fs as any).statfsSync(dirPath);
      const blockSize = fsStats.bsize;
      const total = fsStats.blocks * blockSize;
      const available = fsStats.bavail * blockSize;
      const free = fsStats.bfree * blockSize;
      const used = total - free;
      const usedPercentage = total > 0 ? Math.round((used / total) * 100) : 0;
      
      return {
        total,
        free,
        available,
        used,
        usedPercentage,
      };
    }
    
    // Fallback: return unknown values
    return {
      total: 0,
      free: 0,
      available: 0,
      used: 0,
      usedPercentage: 0,
    };
  } catch (error) {
    console.error('Error getting disk space info:', error);
    return {
      total: 0,
      free: 0,
      available: 0,
      used: 0,
      usedPercentage: 0,
    };
  }
}

/**
 * Check if there's enough disk space for a new recording
 */
export function checkDiskSpaceForRecording(
  recordingsDir: string,
  estimatedSizeMb: number = 1000 // Default 1GB estimate
): DiskCheckResult {
  const info = getDiskSpaceInfo(recordingsDir);
  const freeSpaceMb = Math.floor(info.available / (1024 * 1024));
  
  // Get limits from database
  const limits = SettingsModel.getDiskLimits();
  
  // Check minimum free space requirement
  if (limits.minFreeMb > 0 && freeSpaceMb < limits.minFreeMb + estimatedSizeMb) {
    return {
      allowed: false,
      reason: `Insufficient disk space. Free: ${freeSpaceMb}MB, Required: ${limits.minFreeMb + estimatedSizeMb}MB (min free: ${limits.minFreeMb}MB + estimated: ${estimatedSizeMb}MB)`,
      freeSpaceMb,
      usedPercentage: info.usedPercentage,
    };
  }
  
  // Check if total recordings would exceed limit
  if (limits.maxTotalRecordingsMb > 0) {
    const currentSizeMb = getTotalRecordingsSizeMb(recordingsDir);
    if (currentSizeMb + estimatedSizeMb > limits.maxTotalRecordingsMb) {
      return {
        allowed: false,
        reason: `Total recordings size limit would be exceeded. Current: ${currentSizeMb}MB, Limit: ${limits.maxTotalRecordingsMb}MB`,
        freeSpaceMb,
        usedPercentage: info.usedPercentage,
      };
    }
  }
  
  return {
    allowed: true,
    freeSpaceMb,
    usedPercentage: info.usedPercentage,
  };
}

/**
 * Get total size of all recordings in directory (in MB)
 */
export function getTotalRecordingsSizeMb(recordingsDir: string): number {
  try {
    if (!fs.existsSync(recordingsDir)) {
      return 0;
    }
    
    const files = fs.readdirSync(recordingsDir);
    let totalBytes = 0;
    
    for (const file of files) {
      const filePath = path.join(recordingsDir, file);
      try {
        const stats = fs.statSync(filePath);
        if (stats.isFile()) {
          totalBytes += stats.size;
        }
      } catch {
        // Skip files we can't stat
      }
    }
    
    return Math.floor(totalBytes / (1024 * 1024));
  } catch (error) {
    console.error('Error calculating recordings size:', error);
    return 0;
  }
}

/**
 * Format bytes to human-readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Get disk space status for monitoring
 */
export function getDiskSpaceStatus(recordingsDir: string): {
  total: string;
  used: string;
  free: string;
  usedPercentage: number;
  status: 'ok' | 'warning' | 'critical';
} {
  const info = getDiskSpaceInfo(recordingsDir);
  
  let status: 'ok' | 'warning' | 'critical' = 'ok';
  if (info.usedPercentage >= 95) {
    status = 'critical';
  } else if (info.usedPercentage >= 85) {
    status = 'warning';
  }
  
  return {
    total: formatBytes(info.total),
    used: formatBytes(info.used),
    free: formatBytes(info.available),
    usedPercentage: info.usedPercentage,
    status,
  };
}

/**
 * Get the maximum recording file size from database (in MB)
 * Returns 0 if unlimited
 */
export function getMaxRecordingSizeMb(): number {
  const limits = SettingsModel.getDiskLimits();
  return limits.maxRecordingMb;
}

/**
 * Get the maximum recording duration from database (in milliseconds)
 * Returns 0 if unlimited
 */
export function getMaxRecordingDurationMs(): number {
  const limits = SettingsModel.getDiskLimits();
  return limits.maxRecordingDurationHours * 60 * 60 * 1000;
}
