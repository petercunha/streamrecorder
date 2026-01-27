import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path: pathSegments } = await params;
    const filePath = path.join(process.cwd(), "recordings", ...pathSegments);
    
    // Security check: ensure the file is within the recordings directory
    const recordingsDir = path.join(process.cwd(), "recordings");
    const resolvedPath = path.resolve(filePath);
    const resolvedRecordingsDir = path.resolve(recordingsDir);
    
    if (!resolvedPath.startsWith(resolvedRecordingsDir)) {
      return NextResponse.json(
        { error: "Access denied" },
        { status: 403 }
      );
    }
    
    if (!existsSync(filePath)) {
      return NextResponse.json(
        { error: "File not found" },
        { status: 404 }
      );
    }
    
    const fileBuffer = await readFile(filePath);
    
    // Determine content type based on file extension
    const ext = path.extname(filePath).toLowerCase();
    let contentType = "application/octet-stream";
    
    switch (ext) {
      case ".mp4":
        contentType = "video/mp4";
        break;
      case ".mkv":
        contentType = "video/x-matroska";
        break;
      case ".ts":
        contentType = "video/mp2t";
        break;
      case ".m3u8":
        contentType = "application/vnd.apple.mpegurl";
        break;
      case ".webm":
        contentType = "video/webm";
        break;
      case ".mov":
        contentType = "video/quicktime";
        break;
    }
    
    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${path.basename(filePath)}"`,
      },
    });
  } catch (error) {
    console.error("Failed to serve file:", error);
    return NextResponse.json(
      { error: "Failed to serve file" },
      { status: 500 }
    );
  }
}
