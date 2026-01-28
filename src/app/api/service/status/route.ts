import { NextResponse } from "next/server";
import { initDatabase } from "@/lib/db";
import { autoRecordingService } from "@/lib/services/auto-recording-service";
import { StreamerModel, RecordingModel } from "@/lib/models";

// GET /api/service/status - Get service status
export async function GET() {
  try {
    initDatabase();
    
    const status = autoRecordingService.getStatus();
    const streamers = StreamerModel.findAll();
    const autoRecordStreamers = streamers.filter(s => s.auto_record);
    
    // Get active recordings from database for consistency
    // (in-memory Map may not be accessible from API routes in Next.js dev mode)
    const activeRecordings = RecordingModel.findAll({ status: 'recording' });
    
    return NextResponse.json({
      autoRecording: {
        isRunning: status.isRunning,
        checkIntervalMs: status.intervalMs,
      },
      stats: {
        totalStreamers: streamers.length,
        autoRecordEnabled: autoRecordStreamers.length,
        activeRecordings: activeRecordings.length,
      },
      recordings: activeRecordings.map(r => ({
        recordingId: r.id,
        streamerId: r.streamer_id,
        username: r.streamer_username,
        startTime: r.started_at,
        filePath: r.file_path,
      })),
    });
  } catch (error) {
    console.error("Failed to get service status:", error);
    return NextResponse.json(
      { error: "Failed to get service status" },
      { status: 500 }
    );
  }
}
