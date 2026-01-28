import { NextResponse } from "next/server";
import { initDatabase } from "@/lib/db";
import { RecordingModel } from "@/lib/models";
import recordingService from "@/lib/services/recording-service";

// GET /api/recordings/active - Get active recordings with full metadata
export async function GET() {
  try {
    initDatabase();
    
    // Get active recordings from the database with full metadata
    const activeRecordings = RecordingModel.findAll({ status: 'recording' });
    
    // Also get the in-memory recordings for real-time updates
    const inMemoryRecordings = recordingService.getActiveRecordings();
    
    // Merge the data - prioritize database data but add any in-memory recording if not in DB yet
    const dbRecordingIds = new Set(activeRecordings.map(r => r.id));
    
    // Find recordings that are in memory but might not be fully saved yet
    for (const memRecording of inMemoryRecordings) {
      if (!dbRecordingIds.has(memRecording.recordingId)) {
        // Get the streamer info
        const { StreamerModel } = await import("@/lib/models");
        const streamer = StreamerModel.findById(memRecording.streamerId);
        
        if (streamer) {
          activeRecordings.push({
            id: memRecording.recordingId,
            streamer_id: memRecording.streamerId,
            streamer_username: streamer.username,
            streamer_display_name: streamer.display_name || streamer.username,
            streamer_avatar_url: streamer.avatar_url,
            stream_title: null,
            stream_category: null,
            file_path: memRecording.filePath,
            file_size_bytes: 0,
            duration_seconds: 0,
            quality: null,
            started_at: memRecording.startTime.toISOString(),
            ended_at: null,
            status: 'recording',
            error_message: null,
          });
        }
      }
    }
    
    return NextResponse.json(activeRecordings);
  } catch (error) {
    console.error("Failed to get active recordings:", error);
    return NextResponse.json(
      { error: "Failed to get active recordings" },
      { status: 500 }
    );
  }
}
