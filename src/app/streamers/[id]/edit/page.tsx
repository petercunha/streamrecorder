"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Sidebar } from "../../../components/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft,
  Save,
  Loader2,
  Video,
  Play,
  ExternalLink,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

interface Streamer {
  id: number;
  username: string;
  display_name: string | null;
  is_active: boolean;
  auto_record: boolean;
  quality_preference: string;
  created_at: string;
}

interface Recording {
  id: number;
  stream_title: string | null;
  stream_category: string | null;
  status: "recording" | "completed" | "error" | "stopped";
  file_size_bytes: number;
  duration_seconds: number;
  quality: string | null;
  started_at: string;
  ended_at: string | null;
}

export default function EditStreamerPage() {
  const params = useParams();
  const router = useRouter();
  const id = parseInt(params.id as string);

  const [streamer, setStreamer] = useState<Streamer | null>(null);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingRecordings, setLoadingRecordings] = useState(true);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    display_name: "",
    is_active: true,
    auto_record: true,
    quality_preference: "best",
  });

  useEffect(() => {
    fetchStreamer();
    fetchRecordings();
  }, [id]);

  const fetchStreamer = async () => {
    try {
      const response = await fetch(`/api/streamers/${id}`);
      if (response.ok) {
        const data = await response.json();
        setStreamer(data);
        setFormData({
          display_name: data.display_name || "",
          is_active: data.is_active,
          auto_record: data.auto_record,
          quality_preference: data.quality_preference,
        });
      } else {
        toast.error("Streamer not found");
        router.push("/streamers");
      }
    } catch (error) {
      console.error("Failed to fetch streamer:", error);
      toast.error("Failed to load streamer");
    } finally {
      setLoading(false);
    }
  };

  const fetchRecordings = async () => {
    try {
      const response = await fetch(`/api/recordings?streamerId=${id}&limit=50`);
      if (response.ok) {
        const data = await response.json();
        setRecordings(data);
      }
    } catch (error) {
      console.error("Failed to fetch recordings:", error);
    } finally {
      setLoadingRecordings(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch(`/api/streamers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        toast.success("Streamer updated successfully");
        router.push("/streamers");
      } else {
        const error = await response.text();
        toast.error(error || "Failed to update streamer");
      }
    } catch (error) {
      toast.error("Failed to update streamer");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRecording = async (recordingId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this recording?")) return;

    try {
      const response = await fetch(`/api/recordings/${recordingId}`, {
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

  if (loading) {
    return (
      <div className="flex h-screen bg-background">
        <Sidebar />
        <main className="flex-1 overflow-auto">
          <div className="p-6">
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!streamer) {
    return (
      <div className="flex h-screen bg-background">
        <Sidebar />
        <main className="flex-1 overflow-auto">
          <div className="p-6">
            <div className="text-center py-16">
              <p className="text-muted-foreground">Streamer not found</p>
              <Button asChild className="mt-4">
                <Link href="/streamers">Back to Streamers</Link>
              </Button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" asChild className="cursor-pointer">
              <Link href="/streamers">
                <ArrowLeft className="w-4 h-4" />
              </Link>
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Edit Streamer</h1>
              <p className="text-muted-foreground mt-1">
                Editing @{streamer.username}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Form */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle>Streamer Settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="username">Username</Label>
                    <Input
                      id="username"
                      value={streamer.username}
                      disabled
                      className="bg-muted"
                    />
                    <p className="text-xs text-muted-foreground">
                      Username cannot be changed
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="display_name">Display Name</Label>
                    <Input
                      id="display_name"
                      placeholder="e.g., Shroud"
                      value={formData.display_name}
                      onChange={(e) =>
                        setFormData({ ...formData, display_name: e.target.value })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="quality">Quality Preference</Label>
                    <Select
                      value={formData.quality_preference}
                      onValueChange={(value) =>
                        setFormData({ ...formData, quality_preference: value })
                      }
                    >
                      <SelectTrigger id="quality">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="best">Best</SelectItem>
                        <SelectItem value="1080p60">1080p60</SelectItem>
                        <SelectItem value="1080p">1080p</SelectItem>
                        <SelectItem value="720p60">720p60</SelectItem>
                        <SelectItem value="720p">720p</SelectItem>
                        <SelectItem value="480p">480p</SelectItem>
                        <SelectItem value="360p">360p</SelectItem>
                        <SelectItem value="worst">Worst</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <Label htmlFor="is_active" className="cursor-pointer">
                        Active
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Enable monitoring and recording for this streamer
                      </p>
                    </div>
                    <Switch
                      id="is_active"
                      checked={formData.is_active}
                      onCheckedChange={(checked) =>
                        setFormData({ ...formData, is_active: checked })
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <Label htmlFor="auto_record" className="cursor-pointer">
                        Auto-record when live
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Automatically start recording when streamer goes live
                      </p>
                    </div>
                    <Switch
                      id="auto_record"
                      checked={formData.auto_record}
                      onCheckedChange={(checked) =>
                        setFormData({ ...formData, auto_record: checked })
                      }
                    />
                  </div>

                  <div className="flex items-center gap-4 pt-4">
                    <Button
                      onClick={handleSave}
                      disabled={saving}
                      className="min-w-[120px] cursor-pointer"
                    >
                      {saving ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4 mr-2" />
                          Save Changes
                        </>
                      )}
                    </Button>
                    <Button variant="outline" asChild className="cursor-pointer">
                      <Link href="/streamers">Cancel</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Stats */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Recording Statistics</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Total Recordings</span>
                    <span className="font-medium text-lg">{recordings.length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Total Size</span>
                    <span className="font-medium text-lg">
                      {formatBytes(
                        recordings.reduce((acc, r) => acc + r.file_size_bytes, 0)
                      )}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Total Duration</span>
                    <span className="font-medium text-lg">
                      {formatDuration(
                        recordings.reduce((acc, r) => acc + r.duration_seconds, 0)
                      )}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Recordings List */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Video className="w-5 h-5" />
                Recordings History
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingRecordings ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : recordings.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Video className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No recordings yet</p>
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Title</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Size</TableHead>
                        <TableHead>Duration</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recordings.map((recording) => (
                        <TableRow
                          key={recording.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => router.push(`/recordings/${recording.id}`)}
                        >
                          <TableCell>
                            <p className="max-w-xs truncate font-medium">
                              {recording.stream_title || "Untitled Stream"}
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
                            {new Date(recording.started_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => handleDeleteRecording(recording.id, e)}
                              className="text-destructive hover:bg-destructive/10 cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
