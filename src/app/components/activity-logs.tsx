"use client";

import { useEffect, useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Terminal, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

interface LogEntry {
  id: number;
  recording_id: number | null;
  streamer_username: string | null;
  message: string;
  level: "info" | "warn" | "error" | "success";
  created_at: string;
}

export function ActivityLogs() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 2000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Auto-scroll to bottom
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const fetchLogs = async () => {
    try {
      const response = await fetch("/api/logs?limit=50");
      const data = await response.json();
      setLogs(data.reverse());
    } catch (error) {
      console.error("Failed to fetch logs:", error);
    } finally {
      setLoading(false);
    }
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case "info":
        return "text-blue-400";
      case "warn":
        return "text-yellow-400";
      case "error":
        return "text-red-400";
      case "success":
        return "text-green-400";
      default:
        return "text-gray-400";
    }
  };

  const getLevelBg = (level: string) => {
    switch (level) {
      case "info":
        return "bg-blue-500/10";
      case "warn":
        return "bg-yellow-500/10";
      case "error":
        return "bg-red-500/10";
      case "success":
        return "bg-green-500/10";
      default:
        return "bg-gray-500/10";
    }
  };

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <Terminal className="w-5 h-5 text-muted-foreground" />
          <CardTitle>Activity Logs</CardTitle>
        </div>
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-green-500 animate-pulse" />
          <span className="text-xs text-muted-foreground">Live</span>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-[300px] bg-muted animate-pulse rounded-lg" />
        ) : (
          <ScrollArea className="h-[300px]" ref={scrollRef}>
            <div className="space-y-1 font-mono text-sm">
              {logs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No activity yet
                </div>
              ) : (
                logs.map((log) => (
                  <div
                    key={log.id}
                    className={cn(
                      "flex items-start gap-2 p-1.5 rounded animate-slide-in",
                      getLevelBg(log.level)
                    )}
                  >
                    <span className="text-xs text-muted-foreground shrink-0">
                      {new Date(log.created_at).toLocaleTimeString()}
                    </span>
                    {log.streamer_username && (
                      <span className="text-xs text-purple-400 shrink-0">
                        [{log.streamer_username}]
                      </span>
                    )}
                    <span className={cn("text-xs", getLevelColor(log.level))}>
                      {log.message}
                    </span>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
