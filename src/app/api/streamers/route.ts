import { NextRequest, NextResponse } from "next/server";
import { initDatabase } from "@/lib/db";
import { StreamerModel } from "@/lib/models";

// GET /api/streamers - List all streamers
export async function GET(request: NextRequest) {
  try {
    initDatabase();
    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get("all") === "true";
    
    const streamers = StreamerModel.findAll(includeInactive);
    return NextResponse.json(streamers);
  } catch (error) {
    console.error("Failed to get streamers:", error);
    return NextResponse.json(
      { error: "Failed to get streamers" },
      { status: 500 }
    );
  }
}

// POST /api/streamers - Create a new streamer
export async function POST(request: NextRequest) {
  try {
    initDatabase();
    const body = await request.json();
    
    // Validate required fields
    if (!body.username) {
      return NextResponse.json(
        { error: "Username is required" },
        { status: 400 }
      );
    }

    // Check if streamer already exists
    const existing = StreamerModel.findByUsername(body.username);
    if (existing) {
      return NextResponse.json(
        { error: "Streamer already exists" },
        { status: 409 }
      );
    }

    const streamer = StreamerModel.create({
      username: body.username,
      display_name: body.display_name,
      auto_record: body.auto_record,
      quality_preference: body.quality_preference,
    });

    return NextResponse.json(streamer, { status: 201 });
  } catch (error) {
    console.error("Failed to create streamer:", error);
    return NextResponse.json(
      { error: "Failed to create streamer" },
      { status: 500 }
    );
  }
}
