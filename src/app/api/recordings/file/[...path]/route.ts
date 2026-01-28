import { NextRequest, NextResponse } from "next/server";
import { createReadStream, statSync } from "fs";
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
    
    const stats = statSync(filePath);
    const fileSize = stats.size;
    
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

    // Handle range requests for video streaming
    const range = request.headers.get("range");
    
    if (range) {
      // Parse range header
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunkSize = end - start + 1;
      
      // Create read stream for the range
      const readStream = createReadStream(filePath, { start, end });
      
      // Convert stream to buffer
      const chunks: Buffer[] = [];
      for await (const chunk of readStream) {
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);
      
      return new NextResponse(buffer, {
        status: 206, // Partial Content
        headers: {
          "Content-Type": contentType,
          "Content-Length": chunkSize.toString(),
          "Content-Range": `bytes ${start}-${end}/${fileSize}`,
          "Accept-Ranges": "bytes",
        },
      });
    } else {
      // No range requested, return entire file
      // For large files, we still want to stream them
      const readStream = createReadStream(filePath);
      
      // Convert stream to buffer (for NextResponse compatibility)
      const chunks: Buffer[] = [];
      for await (const chunk of readStream) {
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);
      
      return new NextResponse(buffer, {
        headers: {
          "Content-Type": contentType,
          "Content-Length": fileSize.toString(),
          "Accept-Ranges": "bytes",
          "Content-Disposition": `inline; filename="${path.basename(filePath)}"`,
        },
      });
    }
  } catch (error) {
    console.error("Failed to serve file:", error);
    return NextResponse.json(
      { error: "Failed to serve file" },
      { status: 500 }
    );
  }
}
