import { NextResponse } from "next/server";
import { initDatabase } from "@/lib/db";
import recordingService from "@/lib/services/recording-service";

// POST /api/recordings/stop/[id] - Stop recording a streamer
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    initDatabase();
    const { id } = await params;
    const streamerId = parseInt(id);
    
    if (isNaN(streamerId)) {
      return NextResponse.json(
        { error: "Invalid streamer ID" },
        { status: 400 }
      );
    }

    if (!recordingService.isRecording(streamerId)) {
      return NextResponse.json(
        { error: "Not recording this streamer" },
        { status: 409 }
      );
    }

    const stopped = await recordingService.stopRecording(streamerId);
    if (stopped) {
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json(
        { error: "Failed to stop recording" },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("Failed to stop recording:", error);
    return NextResponse.json(
      { error: error.message || "Failed to stop recording" },
      { status: 500 }
    );
  }
}
