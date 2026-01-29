import { NextResponse } from "next/server";
import { initDatabase } from "@/lib/db";
import recordingService from "@/lib/services/recording-service";
import { StreamerModel, RecordingModel } from "@/lib/models";

// GET /api/service/status - Get service status
export async function GET() {
  try {
    initDatabase();
    
    const streamers = StreamerModel.findAll();
    const autoRecordStreamers = streamers.filter(s => s.auto_record);
    
    // Get active recordings from database for consistency
    const activeRecordings = RecordingModel.findAll({ status: 'recording' });
    
    return NextResponse.json({
      autoRecording: {
        isRunning: recordingService.getActiveCount() >= 0, // Service is running if accessible
        checkIntervalMs: 60000,
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
