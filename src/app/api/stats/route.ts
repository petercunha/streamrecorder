import { NextResponse } from "next/server";
import { initDatabase } from "@/lib/db";
import { StatsModel } from "@/lib/models";

export async function GET() {
  try {
    initDatabase();
    const stats = StatsModel.getSystemStats();
    return NextResponse.json(stats);
  } catch (error) {
    console.error("Failed to get stats:", error);
    return NextResponse.json(
      { error: "Failed to get stats" },
      { status: 500 }
    );
  }
}
