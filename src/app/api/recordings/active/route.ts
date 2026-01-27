import { NextResponse } from "next/server";
import { initDatabase } from "@/lib/db";
import recordingService from "@/lib/services/recording-service";

// GET /api/recordings/active - Get active recordings
export async function GET() {
  try {
    initDatabase();
    const activeRecordings = recordingService.getActiveRecordings();
    return NextResponse.json(activeRecordings);
  } catch (error) {
    console.error("Failed to get active recordings:", error);
    return NextResponse.json(
      { error: "Failed to get active recordings" },
      { status: 500 }
    );
  }
}
