"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Sidebar } from "../components/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Search,
  Video,
  Play,
  ExternalLink,
  Trash2,
  Filter,
} from "lucide-react";
import { toast } from "sonner";

interface Recording {
  id: number;
  streamer_username: string;
  streamer_display_name: string;
  stream_title: string | null;
  stream_category: string | null;
  status: "recording" | "completed" | "error" | "stopped";
  file_size_bytes: number;
  duration_seconds: number;
  quality: string | null;
  started_at: string;
  ended_at: string | null;
}

export default function RecordingsPage() {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  useEffect(() => {
    fetchRecordings();
    const interval = setInterval(fetchRecordings, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchRecordings = async () => {
    try {
      const response = await fetch("/api/recordings?limit=100");
      const data = await response.json();
      setRecordings(data);
    } catch (error) {
      console.error("Failed to fetch recordings:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number, username: string) => {
    if (!confirm(`Are you sure you want to delete this recording from ${username}?`)) return;

    try {
      const response = await fetch(`/api/recordings/${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast.success("Recording deleted");
        fetchRecordings();
      } else {
        toast.error("Failed to delete recording");
      }
    } catch (error) {
      toast.error("Failed to delete recording");
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
    if (seconds === 0) return "-";
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m ${seconds % 60}s`;
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

  const filteredRecordings = recordings.filter((r) => {
    const matchesSearch =
      r.streamer_username.toLowerCase().includes(search.toLowerCase()) ||
      (r.stream_title?.toLowerCase() || "").includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Recordings</h1>
              <p className="text-muted-foreground mt-1">
                View and manage your recorded streams
              </p>
            </div>
          </div>

          {/* Filters */}
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search recordings..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="recording">Recording</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="error">Error</SelectItem>
                <SelectItem value="stopped">Stopped</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Recordings Table */}
          <div className="border rounded-lg">
            <ScrollArea className="h-[calc(100vh-300px)]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Streamer</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Started</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8">
                        Loading...
                      </TableCell>
                    </TableRow>
                  ) : filteredRecordings.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8">
                        <Video className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p className="text-muted-foreground">No recordings found</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredRecordings.map((recording) => (
                      <TableRow key={recording.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">
                              {recording.streamer_display_name || recording.streamer_username}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              @{recording.streamer_username}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <p className="max-w-xs truncate">
                            {recording.stream_title || "-"}
                          </p>
                          {recording.stream_category && (
                            <p className="text-xs text-muted-foreground">
                              {recording.stream_category}
                            </p>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={getStatusColor(recording.status)}
                          >
                            {recording.status === "recording" && (
                              <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse mr-1" />
                            )}
                            {recording.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatBytes(recording.file_size_bytes)}</TableCell>
                        <TableCell>{formatDuration(recording.duration_seconds)}</TableCell>
                        <TableCell>
                          {new Date(recording.started_at).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button variant="ghost" size="icon" asChild>
                              <Link href={`/recordings/${recording.id}`}>
                                <ExternalLink className="w-4 h-4" />
                              </Link>
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() =>
                                handleDelete(recording.id, recording.streamer_username)
                              }
                              className="text-destructive"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>
        </div>
      </main>
    </div>
  );
}
