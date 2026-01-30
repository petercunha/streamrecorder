"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Video, Play, ExternalLink } from "lucide-react";
import Link from "next/link";

interface Recording {
  id: number;
  streamer_username: string;
  streamer_display_name: string;
  stream_title: string | null;
  status: "recording" | "completed" | "error" | "stopped";
  file_size_bytes: number;
  duration_seconds: number;
  started_at: string;
}

interface RecentRecordingsProps {
  limit?: number;
}

export function RecentRecordings({ limit = 10 }: RecentRecordingsProps) {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    fetchRecordings();
    const interval = setInterval(fetchRecordings, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchRecordings = async () => {
    try {
      const response = await fetch(`/api/recordings?limit=${limit}`);
      const data = await response.json();
      setRecordings(data);
    } catch (error) {
      console.error("Failed to fetch recordings:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const formatDuration = (seconds: number) => {
    if (seconds <= 0) return "Just started";
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m ${seconds % 60}s`;
  };

  const calculateDuration = (startedAt: string) => {
    // SQLite DATETIME is UTC, convert to ISO 8601 UTC for correct parsing
    const isoString = startedAt.replace(' ', 'T') + 'Z';
    const start = new Date(isoString).getTime();
    const now = Date.now();
    return Math.max(0, Math.floor((now - start) / 1000));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "recording":
        return "bg-yellow-500/20 text-yellow-500 border-yellow-500/50";
      case "completed":
        return "bg-green-500/20 text-green-500 border-green-500/50";
      case "error":
        return "bg-red-500/20 text-red-500 border-red-500/50";
      case "stopped":
        return "bg-gray-500/20 text-gray-500 border-gray-500/50";
      default:
        return "bg-gray-500/20 text-gray-500";
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <Video className="w-5 h-5 text-muted-foreground" />
          <CardTitle>Recent Recordings</CardTitle>
        </div>
        <Link href="/recordings">
          <Button variant="ghost" size="sm" className="cursor-pointer">
            View All
          </Button>
        </Link>
      </CardHeader>
      <CardContent>
        {recordings.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Video className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No recordings yet</p>
          </div>
        ) : (
          <ScrollArea className="h-[300px]">
            <div className="space-y-2">
              {recordings.map((recording) => (
                <Link
                  key={recording.id}
                  href={`/recordings/${recording.id}`}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                      {recording.status === "recording" ? (
                        <div className="w-4 h-4 rounded-full bg-red-500 animate-pulse" />
                      ) : (
                        <Play className="w-4 h-4 text-primary" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-foreground">
                        {recording.streamer_display_name || recording.streamer_username}
                      </p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>{formatBytes(recording.file_size_bytes)}</span>
                        <span>•</span>
                        <span>
                          {mounted && recording.status === 'recording'
                            ? formatDuration(calculateDuration(recording.started_at))
                            : formatDuration(recording.duration_seconds)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={getStatusColor(recording.status)}
                    >
                      {recording.status}
                    </Badge>
                    <Button variant="ghost" size="icon" asChild className="cursor-pointer hover:bg-primary/10">
                      <span>
                        <ExternalLink className="w-4 h-4" />
                      </span>
                    </Button>
                  </div>
                </Link>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
