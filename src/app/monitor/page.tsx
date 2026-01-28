"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "../components/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Radio, Users, Video, Activity, Loader2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface Recording {
  id: number;
  streamer_id: number;
  streamer_username: string;
  streamer_display_name: string;
  streamer_avatar_url: string | null;
  stream_title: string | null;
  stream_category: string | null;
  file_size_bytes: number;
  duration_seconds: number;
  quality: string | null;
  started_at: string;
}

interface Stats {
  totalStreamers: number;
  activeRecordings: number;
  totalRecordings: number;
  totalStorage: number;
}

export default function MonitorPage() {
  const router = useRouter();
  const [activeRecordings, setActiveRecordings] = useState<Recording[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => {
      fetchData();
      setCurrentTime(new Date());
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      const [recordingsRes, statsRes, streamersRes] = await Promise.all([
        fetch("/api/recordings/active"),
        fetch("/api/stats"),
        fetch("/api/streamers"),
      ]);

      const recordings = await recordingsRes.json();
      const statsData = await statsRes.json();
      const streamers = await streamersRes.json();

      setActiveRecordings(recordings);
      setStats({
        totalStreamers: streamers.length,
        activeRecordings: recordings.length,
        totalRecordings: statsData.recordings?.total || 0,
        totalStorage: statsData.storage?.totalBytes || 0,
      });
    } catch (error) {
      console.error("Failed to fetch monitor data:", error);
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
    if (seconds === 0) return "Just started";
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) return `${hours}h ${mins}m ${secs}s`;
    return `${mins}m ${secs}s`;
  };

  const calculateDuration = (startedAt: string) => {
    const start = new Date(startedAt).getTime();
    const now = currentTime.getTime();
    return Math.floor((now - start) / 1000);
  };

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Live Monitor</h1>
              <p className="text-muted-foreground mt-1">
                Real-time monitoring of active recordings
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
              <span className="text-sm text-muted-foreground">
                Last updated: {currentTime.toLocaleTimeString()}
              </span>
            </div>
          </div>

          {/* Stats Overview */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Active Streams</p>
                    <p className="text-3xl font-bold">
                      {loading ? "-" : stats?.activeRecordings || 0}
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
                    <Radio className="w-6 h-6 text-red-500" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Streamers</p>
                    <p className="text-3xl font-bold">
                      {loading ? "-" : stats?.totalStreamers || 0}
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                    <Users className="w-6 h-6 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Recordings</p>
                    <p className="text-3xl font-bold">
                      {loading ? "-" : stats?.totalRecordings || 0}
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center">
                    <Video className="w-6 h-6 text-blue-500" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Storage</p>
                    <p className="text-3xl font-bold">
                      {loading ? "-" : formatBytes(stats?.totalStorage || 0)}
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center">
                    <Activity className="w-6 h-6 text-green-500" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Active Recordings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Radio className="w-5 h-5 text-red-500" />
                Active Recordings
                {activeRecordings.length > 0 && (
                  <Badge variant="outline" className="ml-2">
                    {activeRecordings.length}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : activeRecordings.length === 0 ? (
                <div className="text-center py-16">
                  <Video className="w-16 h-16 mx-auto mb-4 opacity-30" />
                  <p className="text-muted-foreground text-lg">No active recordings</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Recordings will appear here when streamers go live
                  </p>
                </div>
              ) : (
                <ScrollArea className="h-[calc(100vh-400px)]">
                  <div className="space-y-4">
                    {activeRecordings.map((recording) => {
                      const duration = calculateDuration(recording.started_at);
                      return (
                        <Card 
                          key={recording.id} 
                          className="border-l-4 border-l-red-500 cursor-pointer hover:shadow-md hover:border-l-red-600 transition-all"
                          onClick={() => router.push(`/recordings/${recording.id}`)}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                  <Avatar className="w-8 h-8">
                                    <AvatarImage 
                                      src={recording.streamer_avatar_url || undefined} 
                                      alt={recording.streamer_username}
                                      className="object-cover"
                                    />
                                    <AvatarFallback className="bg-primary/20 text-primary text-sm">
                                      {recording.streamer_username.slice(0, 2).toUpperCase()}
                                    </AvatarFallback>
                                  </Avatar>
                                  <h3 className="font-semibold text-lg">
                                    {recording.streamer_display_name || recording.streamer_username}
                                  </h3>
                                  <Badge
                                    variant="outline"
                                    className="bg-red-500/20 text-red-500 border-red-500/50"
                                  >
                                    <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse mr-1" />
                                    LIVE
                                  </Badge>
                                </div>
                                <p className="text-muted-foreground max-w-2xl truncate">
                                  {recording.stream_title || "No stream title"}
                                </p>
                                <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
                                  {recording.stream_category && (
                                    <Badge variant="secondary">
                                      {recording.stream_category}
                                    </Badge>
                                  )}
                                  <span>Quality: {recording.quality || "best"}</span>
                                  <span>Started: {new Date(recording.started_at).toLocaleTimeString()}</span>
                                </div>
                              </div>
                              <div className="text-right min-w-[150px]">
                                <div className="text-2xl font-mono font-bold">
                                  {formatDuration(duration)}
                                </div>
                                <p className="text-sm text-muted-foreground mt-1">
                                  {formatBytes(recording.file_size_bytes)}
                                </p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
