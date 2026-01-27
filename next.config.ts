import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
  },
  async rewrites() {
    return [
      {
        // Only match paths that look like files (have an extension)
        source: "/recordings/:path*.mp4",
        destination: "/api/recordings/file/:path*.mp4",
      },
      {
        source: "/recordings/:path*.mkv",
        destination: "/api/recordings/file/:path*.mkv",
      },
      {
        source: "/recordings/:path*.ts",
        destination: "/api/recordings/file/:path*.ts",
      },
      {
        source: "/recordings/:path*.webm",
        destination: "/api/recordings/file/:path*.webm",
      },
      {
        source: "/recordings/:path*.mov",
        destination: "/api/recordings/file/:path*.mov",
      },
    ];
  },
};

export default nextConfig;
