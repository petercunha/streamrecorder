import { NextResponse } from "next/server";
import { initDatabase } from "@/lib/db";
import { StreamerModel } from "@/lib/models";
import recordingService from "@/lib/services/recording-service";

// POST /api/recordings/start/[id] - Start recording a streamer
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

    const streamer = StreamerModel.findById(streamerId);
    if (!streamer) {
      return NextResponse.json(
        { error: "Streamer not found" },
        { status: 404 }
      );
    }

    if (recordingService.isRecording(streamerId)) {
      return NextResponse.json(
        { error: "Already recording this streamer" },
        { status: 409 }
      );
    }

    const recordingId = await recordingService.startRecording(streamerId);
    return NextResponse.json({ recordingId });
  } catch (error: any) {
    console.error("Failed to start recording:", error);
    return NextResponse.json(
      { error: error.message || "Failed to start recording" },
      { status: 500 }
    );
  }
}
