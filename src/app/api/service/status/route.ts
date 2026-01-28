import { NextResponse } from "next/server";
import { initDatabase } from "@/lib/db";
import { autoRecordingService } from "@/lib/services/auto-recording-service";
import recordingService from "@/lib/services/recording-service";
import { StreamerModel } from "@/lib/models";

// GET /api/service/status - Get service status
export async function GET() {
  try {
    initDatabase();
    
    const status = autoRecordingService.getStatus();
    const activeRecordings = recordingService.getActiveRecordings();
    const streamers = StreamerModel.findAll();
    const autoRecordStreamers = streamers.filter(s => s.auto_record);
    
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
        recordingId: r.recordingId,
        streamerId: r.streamerId,
        username: r.username,
        startTime: r.startTime,
        filePath: r.filePath,
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
