import { NextRequest, NextResponse } from "next/server";
import { initDatabase } from "@/lib/db";
import { StreamerModel } from "@/lib/models";
import recordingService from "@/lib/services/recording-service";

// Fetch Twitch avatar using decapi.me (free, no auth required)
async function fetchTwitchAvatar(username: string): Promise<string | null> {
  try {
    const response = await fetch(`https://decapi.me/twitch/avatar/${encodeURIComponent(username)}`);
    if (response.ok) {
      const avatarUrl = await response.text();
      // Check if we got a valid URL (not an error message)
      if (avatarUrl.startsWith('http')) {
        return avatarUrl.trim();
      }
    }
  } catch (error) {
    console.error('Failed to fetch avatar:', error);
  }
  return null;
}

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

    // Fetch avatar from Twitch
    const avatarUrl = await fetchTwitchAvatar(body.username);

    const streamer = StreamerModel.create({
      username: body.username,
      display_name: body.display_name,
      avatar_url: avatarUrl || undefined,
      auto_record: body.auto_record,
      quality_preference: body.quality_preference,
    });

    // If auto_record is enabled, immediately check if the streamer is live
    if (streamer.auto_record) {
      console.log(`Auto-record enabled for ${streamer.username}, checking if live...`);
      // Run the check in the background without awaiting to not delay the response
      recordingService.checkAndRecordStreamers().catch((error) => {
        console.error(`Error checking live status for ${streamer.username}:`, error);
      });
    }

    return NextResponse.json(streamer, { status: 201 });
  } catch (error) {
    console.error("Failed to create streamer:", error);
    return NextResponse.json(
      { error: "Failed to create streamer" },
      { status: 500 }
    );
  }
}
