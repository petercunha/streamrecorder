"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  MoreHorizontal,
  Play,
  Square,
  Edit,
  Trash2,
  Users,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

interface Streamer {
  id: number;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  is_active: boolean;
  auto_record: boolean;
  quality_preference: string;
  created_at: string;
}

interface StreamersListProps {
  limit?: number;
}

export function StreamersList({ limit }: StreamersListProps) {
  const [streamers, setStreamers] = useState<Streamer[]>([]);
  const [loading, setLoading] = useState(true);
  const [recordingIds, setRecordingIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    fetchStreamers();
    fetchActiveRecordings();
    const interval = setInterval(() => {
      fetchActiveRecordings();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchStreamers = async () => {
    try {
      const response = await fetch("/api/streamers");
      const data = await response.json();
      setStreamers(limit ? data.slice(0, limit) : data);
    } catch (error) {
      console.error("Failed to fetch streamers:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchActiveRecordings = async () => {
    try {
      const response = await fetch("/api/recordings/active");
      const data = await response.json();
      setRecordingIds(new Set(data.map((r: any) => r.streamerId)));
    } catch (error) {
      console.error("Failed to fetch active recordings:", error);
    }
  };

  const handleStartRecording = async (streamerId: number, username: string) => {
    try {
      const response = await fetch(`/api/recordings/start/${streamerId}`, {
        method: "POST",
      });
      if (response.ok) {
        toast.success(`Started recording ${username}`);
        fetchActiveRecordings();
      } else {
        const error = await response.text();
        toast.error(error);
      }
    } catch (error) {
      toast.error("Failed to start recording");
    }
  };

  const handleStopRecording = async (streamerId: number, username: string) => {
    try {
      const response = await fetch(`/api/recordings/stop/${streamerId}`, {
        method: "POST",
      });
      if (response.ok) {
        toast.success(`Stopped recording ${username}`);
        fetchActiveRecordings();
      } else {
        toast.error("Failed to stop recording");
      }
    } catch (error) {
      toast.error("Failed to stop recording");
    }
  };

  const handleDelete = async (streamerId: number, username: string) => {
    if (!confirm(`Are you sure you want to delete ${username}?`)) return;

    try {
      const response = await fetch(`/api/streamers/${streamerId}`, {
        method: "DELETE",
      });
      if (response.ok) {
        toast.success(`Deleted ${username}`);
        fetchStreamers();
      } else {
        toast.error("Failed to delete streamer");
      }
    } catch (error) {
      toast.error("Failed to delete streamer");
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
          <Users className="w-5 h-5 text-muted-foreground" />
          <CardTitle>Streamers</CardTitle>
        </div>
        <Link href="/streamers">
          <Button variant="ghost" size="sm" className="cursor-pointer">
            View All
          </Button>
        </Link>
      </CardHeader>
      <CardContent>
        {streamers.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No streamers added yet</p>
            <Link href="/streamers">
              <Button className="mt-4 cursor-pointer" size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Add Streamer
              </Button>
            </Link>
          </div>
        ) : (
          <ScrollArea className="h-[300px]">
            <div className="space-y-2">
              {streamers.map((streamer) => {
                const isRecording = recordingIds.has(streamer.id);
                const initials = streamer.username
                  .slice(0, 2)
                  .toUpperCase();

                return (
                  <div
                    key={streamer.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="w-10 h-10">
                        <AvatarImage 
                          src={streamer.avatar_url || undefined} 
                          alt={streamer.username}
                          className="object-cover"
                        />
                        <AvatarFallback className="bg-primary/20 text-primary">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      <Link href={`/streamers/${streamer.id}/edit`} className="hover:underline">
                        <p className="font-medium text-foreground">
                          {streamer.display_name || streamer.username}
                        </p>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span>@{streamer.username}</span>
                          <Badge
                            variant={streamer.auto_record ? "default" : "secondary"}
                            className="text-xs"
                          >
                            {streamer.quality_preference}
                          </Badge>
                        </div>
                      </Link>
                    </div>

                    <div className="flex items-center gap-2">
                      {isRecording && (
                        <div className="flex items-center gap-1.5 mr-2">
                          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                          <span className="text-xs text-red-500 font-medium">
                            REC
                          </span>
                        </div>
                      )}

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="cursor-pointer hover:bg-primary/10">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {isRecording ? (
                            <DropdownMenuItem
                              onClick={() =>
                                handleStopRecording(streamer.id, streamer.username)
                              }
                              className="text-yellow-500"
                            >
                              <Square className="w-4 h-4 mr-2" />
                              Stop Recording
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              onClick={() =>
                                handleStartRecording(streamer.id, streamer.username)
                              }
                              className="text-green-500"
                            >
                              <Play className="w-4 h-4 mr-2" />
                              Start Recording
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem asChild>
                            <Link href={`/streamers/${streamer.id}/edit`}>
                              <Edit className="w-4 h-4 mr-2" />
                              Edit
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              handleDelete(streamer.id, streamer.username)
                            }
                            className="text-destructive"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
