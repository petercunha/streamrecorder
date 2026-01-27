import { NextRequest, NextResponse } from "next/server";
import { initDatabase } from "@/lib/db";
import { RecordingModel } from "@/lib/models";

// GET /api/recordings/[id] - Get a specific recording
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    initDatabase();
    const { id } = await params;
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
  } catch (error) {
    console.error("Failed to get recording:", error);
    return NextResponse.json(
      { error: "Failed to get recording" },
      { status: 500 }
    );
  }
}

// DELETE /api/recordings/[id] - Delete a recording
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    initDatabase();
    const { id } = await params;
    const recordingId = parseInt(id);
    
    if (isNaN(recordingId)) {
      return NextResponse.json(
        { error: "Invalid recording ID" },
        { status: 400 }
      );
    }

    const deleted = RecordingModel.delete(recordingId);
    
    if (!deleted) {
      return NextResponse.json(
        { error: "Recording not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete recording:", error);
    return NextResponse.json(
      { error: "Failed to delete recording" },
      { status: 500 }
    );
  }
}
