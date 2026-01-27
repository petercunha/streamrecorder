import { NextRequest, NextResponse } from "next/server";
import { initDatabase } from "@/lib/db";
import { RecordingLogModel } from "@/lib/models";

// GET /api/logs - Get recent logs
export async function GET(request: NextRequest) {
  try {
    initDatabase();
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get("limit") 
      ? parseInt(searchParams.get("limit")!) 
      : 50;

    const logs = RecordingLogModel.getRecent(limit);
    return NextResponse.json(logs);
  } catch (error) {
    console.error("Failed to get logs:", error);
    return NextResponse.json(
      { error: "Failed to get logs" },
      { status: 500 }
    );
  }
}
