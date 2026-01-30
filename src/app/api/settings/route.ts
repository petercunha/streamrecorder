import { NextRequest, NextResponse } from 'next/server';
import { SettingsModel } from '@/lib/models/settings';
import { getDiskSpaceStatus } from '@/lib/utils/disk-space';
import path from 'path';

const RECORDINGS_DIR = process.env.RECORDINGS_DIR || path.join(process.cwd(), 'recordings');

// GET /api/settings - Get current settings
export async function GET() {
  try {
    const settings = SettingsModel.get();
    const diskStatus = getDiskSpaceStatus(RECORDINGS_DIR);

    return NextResponse.json({
      settings: {
        minFreeDiskMb: settings.min_free_disk_mb,
        maxRecordingSizeMb: settings.max_recording_size_mb,
        maxTotalRecordingsMb: settings.max_total_recordings_mb,
        maxRecordingDurationHours: settings.max_recording_duration_hours,
        checkIntervalSeconds: settings.check_interval_seconds,
      },
      diskStatus: {
        total: diskStatus.total,
        used: diskStatus.used,
        free: diskStatus.free,
        usedPercentage: diskStatus.usedPercentage,
        status: diskStatus.status,
      },
    });
  } catch (error) {
    console.error('Error fetching settings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch settings' },
      { status: 500 }
    );
  }
}

// POST /api/settings - Update settings
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate input types and ranges
    const updates: Parameters<typeof SettingsModel.update>[0] = {};

    if (body.minFreeDiskMb !== undefined) {
      const value = parseInt(body.minFreeDiskMb, 10);
      if (isNaN(value) || value < 0) {
        return NextResponse.json(
          { error: 'minFreeDiskMb must be a non-negative number' },
          { status: 400 }
        );
      }
      updates.min_free_disk_mb = value;
    }

    if (body.maxRecordingSizeMb !== undefined) {
      const value = parseInt(body.maxRecordingSizeMb, 10);
      if (isNaN(value) || value < 0) {
        return NextResponse.json(
          { error: 'maxRecordingSizeMb must be a non-negative number (0 = unlimited)' },
          { status: 400 }
        );
      }
      updates.max_recording_size_mb = value;
    }

    if (body.maxTotalRecordingsMb !== undefined) {
      const value = parseInt(body.maxTotalRecordingsMb, 10);
      if (isNaN(value) || value < 0) {
        return NextResponse.json(
          { error: 'maxTotalRecordingsMb must be a non-negative number (0 = unlimited)' },
          { status: 400 }
        );
      }
      updates.max_total_recordings_mb = value;
    }

    if (body.maxRecordingDurationHours !== undefined) {
      const value = parseInt(body.maxRecordingDurationHours, 10);
      if (isNaN(value) || value < 0) {
        return NextResponse.json(
          { error: 'maxRecordingDurationHours must be a non-negative number (0 = unlimited)' },
          { status: 400 }
        );
      }
      updates.max_recording_duration_hours = value;
    }

    if (body.checkIntervalSeconds !== undefined) {
      const value = parseInt(body.checkIntervalSeconds, 10);
      if (isNaN(value) || value < 30 || value > 3600) {
        return NextResponse.json(
          { error: 'checkIntervalSeconds must be between 30 and 3600' },
          { status: 400 }
        );
      }
      updates.check_interval_seconds = value;
    }

    const updatedSettings = SettingsModel.update(updates);

    if (!updatedSettings) {
      return NextResponse.json(
        { error: 'Failed to update settings' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      settings: {
        minFreeDiskMb: updatedSettings.min_free_disk_mb,
        maxRecordingSizeMb: updatedSettings.max_recording_size_mb,
        maxTotalRecordingsMb: updatedSettings.max_total_recordings_mb,
        maxRecordingDurationHours: updatedSettings.max_recording_duration_hours,
        checkIntervalSeconds: updatedSettings.check_interval_seconds,
      },
    });
  } catch (error) {
    console.error('Error updating settings:', error);
    return NextResponse.json(
      { error: 'Failed to update settings' },
      { status: 500 }
    );
  }
}
