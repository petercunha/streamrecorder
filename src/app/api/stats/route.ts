import { NextResponse } from "next/server";
import { initDatabase } from "@/lib/db";
import { StatsModel, RecordingModel } from "@/lib/models";

export async function GET() {
  try {
    initDatabase();
    const stats = StatsModel.getSystemStats();
    
    // Use database count for active recordings for consistency
    // (in-memory Map may not be accessible from API routes in Next.js dev mode)
    stats.activeRecordings = RecordingModel.getActiveCount();
    
    return NextResponse.json(stats);
  } catch (error) {
    console.error("Failed to get stats:", error);
    return NextResponse.json(
      { error: "Failed to get stats" },
      { status: 500 }
    );
  }
}
