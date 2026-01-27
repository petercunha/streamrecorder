import { NextRequest, NextResponse } from "next/server";
import { initDatabase } from "@/lib/db";
import { StreamerModel } from "@/lib/models";

// GET /api/streamers/[id] - Get a specific streamer
export async function GET(
  request: NextRequest,
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

    return NextResponse.json(streamer);
  } catch (error) {
    console.error("Failed to get streamer:", error);
    return NextResponse.json(
      { error: "Failed to get streamer" },
      { status: 500 }
    );
  }
}

// PATCH /api/streamers/[id] - Update a streamer
export async function PATCH(
  request: NextRequest,
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

    const body = await request.json();
    const streamer = StreamerModel.update(streamerId, body);
    
    if (!streamer) {
      return NextResponse.json(
        { error: "Streamer not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(streamer);
  } catch (error) {
    console.error("Failed to update streamer:", error);
    return NextResponse.json(
      { error: "Failed to update streamer" },
      { status: 500 }
    );
  }
}

// DELETE /api/streamers/[id] - Delete a streamer
export async function DELETE(
  request: NextRequest,
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

    const deleted = StreamerModel.delete(streamerId);
    
    if (!deleted) {
      return NextResponse.json(
        { error: "Streamer not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete streamer:", error);
    return NextResponse.json(
      { error: "Failed to delete streamer" },
      { status: 500 }
    );
  }
}
