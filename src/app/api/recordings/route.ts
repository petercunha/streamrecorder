import { NextRequest, NextResponse } from "next/server";
import { initDatabase } from "@/lib/db";
import { RecordingModel } from "@/lib/models";

// GET /api/recordings - List all recordings or get single by id
export async function GET(request: NextRequest) {
  try {
    initDatabase();
    const { searchParams } = new URL(request.url);
    
    // Check if id is provided for single recording fetch
    const id = searchParams.get("id");
    if (id) {
      const recordingId = parseInt(id);
      if (isNaN(recordingId)) {
        return NextResponse.json(
          { error: "Invalid recording ID" },
          { status: 400 }
        );
      }
      
      const recording = RecordingModel.findById(recordingId);
      if (!recording) {
        return NextResponse.json(
          { error: "Recording not found" },
          { status: 404 }
        );
      }
      return NextResponse.json(recording);
    }
    
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
