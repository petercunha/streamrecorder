import { NextResponse } from "next/server";
import { initDatabase } from "@/lib/db";
import { StatsModel } from "@/lib/models";
import recordingService from "@/lib/services/recording-service";

export async function GET() {
  try {
    initDatabase();
    const stats = StatsModel.getSystemStats();
    
    // Use the in-memory active recordings count for consistency
    // This ensures the dashboard shows the same count as the settings page
    stats.activeRecordings = recordingService.getActiveCount();
    
    return NextResponse.json(stats);
  } catch (error) {
    console.error("Failed to get stats:", error);
    return NextResponse.json(
      { error: "Failed to get stats" },
      { status: 500 }
    );
  }
}
