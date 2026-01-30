import { NextResponse } from "next/server";
import { initDatabase } from "@/lib/db";
import { RecordingModel } from "@/lib/models";

// GET /api/recordings/active - Get active recordings with full metadata
export async function GET() {
  try {
    initDatabase();
    
    // Get active recordings from the database
    // File size is updated every 5 seconds by the recording service
    const activeRecordings = RecordingModel.findAll({ status: 'recording' });
    
    return NextResponse.json(activeRecordings);
  } catch (error) {
    console.error("Failed to get active recordings:", error);
    return NextResponse.json(
      { error: "Failed to get active recordings" },
      { status: 500 }
    );
  }
}
