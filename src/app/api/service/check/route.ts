import { NextResponse } from "next/server";
import { initDatabase } from "@/lib/db";
import recordingService from "@/lib/services/recording-service";

// POST /api/service/check - Manually trigger a check for live streamers
export async function POST() {
  try {
    initDatabase();
    
    console.log("Manual check triggered via API");
    
    // Run the check asynchronously
    recordingService.checkAndRecordStreamers();
    
    return NextResponse.json({
      message: "Check triggered successfully",
      status: "checking",
    });
  } catch (error) {
    console.error("Failed to trigger check:", error);
    return NextResponse.json(
      { error: "Failed to trigger check" },
      { status: 500 }
    );
  }
}
