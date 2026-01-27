import { NextRequest, NextResponse } from "next/server";
import { initDatabase } from "@/lib/db";
import { RecordingModel } from "@/lib/models";

// GET /api/recordings - List all recordings
export async function GET(request: NextRequest) {
  try {
    initDatabase();
    const { searchParams } = new URL(request.url);
    
    const filters = {
      status: searchParams.get("status") || undefined,
      streamerId: searchParams.get("streamerId") 
        ? parseInt(searchParams.get("streamerId")!) 
        : undefined,
      search: searchParams.get("search") || undefined,
      limit: searchParams.get("limit") 
        ? parseInt(searchParams.get("limit")!) 
        : undefined,
      offset: searchParams.get("offset") 
        ? parseInt(searchParams.get("offset")!) 
        : undefined,
    };

    const recordings = RecordingModel.findAll(filters);
    return NextResponse.json(recordings);
  } catch (error) {
    console.error("Failed to get recordings:", error);
    return NextResponse.json(
      { error: "Failed to get recordings" },
      { status: 500 }
    );
  }
}
