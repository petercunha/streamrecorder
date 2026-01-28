"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Sidebar } from "../../components/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  Video,
  User,
  Clock,
  HardDrive,
  Calendar,
  Trash2,
  Loader2,
  AlertCircle,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Download,
  Square,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";

interface Recording {
  id: number;
  streamer_id: number;
  streamer_username: string;
  streamer_display_name: string;
  streamer_avatar_url: string | null;
  stream_title: string | null;
  stream_category: string | null;
  file_path: string;
  file_size_bytes: number;
  duration_seconds: number;
  quality: string | null;
  started_at: string;
  ended_at: string | null;
  status: "recording" | "completed" | "error" | "stopped";
  error_message: string | null;
}

export default function RecordingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = parseInt(params.id as string);
  const videoRef = useRef<HTMLVideoElement>(null);

  const [recording, setRecording] = useState<Recording | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  useEffect(() => {
    fetchRecording();
  }, [id]);

  const fetchRecording = async () => {
    try {
      const response = await fetch(`/api/recordings?id=${id}`);
      if (response.ok) {
        const data = await response.json();
        // API returns array, get first item
        const recordingData = Array.isArray(data) ? data[0] : data;
        if (recordingData) {
          setRecording(recordingData);
          // Create a video URL from the file path
          // The file path is relative, so we need to serve it from the recordings folder
          const filename = recordingData.file_path.split("/").pop();
          if (filename) {
            setVideoUrl(`/recordings/${filename}`);
          }
        } else {
          toast.error("Recording not found");
          router.push("/recordings");
        }
      } else {
        toast.error("Recording not found");
        router.push("/recordings");
      }
    } catch (error) {
      console.error("Failed to fetch recording:", error);
      toast.error("Failed to load recording");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!recording) return;
    if (!confirm("Are you sure you want to delete this recording?")) return;

    try {
      const response = await fetch(`/api/recordings/${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast.success("Recording deleted");
        router.push("/recordings");
      } else {
        toast.error("Failed to delete recording");
      }
    } catch (error) {
      toast.error("Failed to delete recording");
    }
  };

  const handleStopRecording = async () => {
    if (!recording) return;
    if (!confirm("Are you sure you want to stop this recording?")) return;

    try {
      const response = await fetch(`/api/recordings/stop/${recording.streamer_id}`, {
        method: "POST",
      });

      if (response.ok) {
        toast.success("Recording stopped");
        fetchRecording();
      } else {
        toast.error("Failed to stop recording");
      }
    } catch (error) {
      toast.error("Failed to stop recording");
    }
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const toggleFullscreen = () => {
    if (videoRef.current) {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        videoRef.current.requestFullscreen();
      }
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
    const secs = seconds % 60;
    if (hours > 0) return `${hours}h ${mins}m ${secs}s`;
    return `${mins}m ${secs}s`;
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

  if (!recording) {
    return (
      <div className="flex h-screen bg-background">
        <Sidebar />
        <main className="flex-1 overflow-auto">
          <div className="p-6">
            <div className="text-center py-16">
              <Video className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p className="text-muted-foreground text-lg">Recording not found</p>
              <Button asChild className="mt-4">
                <Link href="/recordings">Back to Recordings</Link>
              </Button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const filename = recording.file_path.split("/").pop() || recording.file_path;
  const canPlay = recording.status === "completed" || recording.status === "stopped";

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="outline" size="icon" asChild>
                <Link href="/recordings">
                  <ArrowLeft className="w-4 h-4" />
                </Link>
              </Button>
              <div>
                <h1 className="text-3xl font-bold text-foreground">Recording Details</h1>
                <p className="text-muted-foreground mt-1">
                  Recording #{recording.id}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {recording.status === "recording" && (
                <Button 
                  variant="outline" 
                  onClick={handleStopRecording}
                  className="text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50 dark:hover:bg-yellow-950/30 cursor-pointer"
                >
                  <Square className="w-4 h-4 mr-2" />
                  Stop Recording
                </Button>
              )}
              <Button variant="outline" onClick={handleDelete} className="text-destructive cursor-pointer">
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </Button>
            </div>
          </div>

          {/* Video Player */}
          {canPlay && videoUrl && (
            <Card className="overflow-hidden">
              <CardContent className="p-0">
                <div className="relative bg-black aspect-video">
                  <video
                    ref={videoRef}
                    src={videoUrl}
                    className="w-full h-full"
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                    onEnded={() => setIsPlaying(false)}
                  />
                  {/* Custom Controls Overlay */}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 opacity-0 hover:opacity-100 transition-opacity">
                    <div className="flex items-center gap-4">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-white hover:bg-white/20"
                        onClick={togglePlay}
                      >
                        {isPlaying ? (
                          <Pause className="w-6 h-6" />
                        ) : (
                          <Play className="w-6 h-6" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-white hover:bg-white/20"
                        onClick={toggleMute}
                      >
                        {isMuted ? (
                          <VolumeX className="w-5 h-5" />
                        ) : (
                          <Volume2 className="w-5 h-5" />
                        )}
                      </Button>
                      <div className="flex-1" />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-white hover:bg-white/20"
                        onClick={toggleFullscreen}
                      >
                        <Maximize className="w-5 h-5" />
                      </Button>
                    </div>
                  </div>
                  {/* Play Button Center Overlay (shown when paused) */}
                  {!isPlaying && (
                    <div
                      className="absolute inset-0 flex items-center justify-center cursor-pointer"
                      onClick={togglePlay}
                    >
                      <div className="w-20 h-20 rounded-full bg-primary/90 flex items-center justify-center hover:bg-primary transition-colors">
                        <Play className="w-10 h-10 text-primary-foreground ml-1" />
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {recording.status === "recording" && (
            <Card className="bg-yellow-500/10 border-yellow-500/20">
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-yellow-500 animate-pulse" />
                  <p className="font-medium">This recording is currently in progress</p>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  Video playback will be available once the recording is completed.
                </p>
              </CardContent>
            </Card>
          )}

          {recording.status === "error" && (
            <Card className="bg-red-500/10 border-red-500/20">
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-red-500" />
                  <p className="font-medium">This recording encountered an error</p>
                </div>
                {recording.error_message && (
                  <p className="text-sm text-muted-foreground mt-2">
                    Error: {recording.error_message}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Info */}
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Video className="w-5 h-5" />
                    Stream Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-sm text-muted-foreground">Stream Title</label>
                    <p className="text-lg font-medium">
                      {recording.stream_title || "No title available"}
                    </p>
                  </div>
                  {recording.stream_category && (
                    <div>
                      <label className="text-sm text-muted-foreground">Category</label>
                      <p className="font-medium">{recording.stream_category}</p>
                    </div>
                  )}
                  <Separator />
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={getStatusColor(recording.status)}
                    >
                      {recording.status === "recording" && (
                        <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse mr-1" />
                      )}
                      {recording.status}
                    </Badge>
                    {recording.quality && (
                      <Badge variant="secondary">{recording.quality}</Badge>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <HardDrive className="w-5 h-5" />
                    File Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-sm text-muted-foreground">Filename</label>
                    <p className="font-mono text-sm break-all">{filename}</p>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Full Path</label>
                    <p className="font-mono text-sm break-all text-muted-foreground">
                      {recording.file_path}
                    </p>
                  </div>
                  {canPlay && videoUrl && (
                    <div className="pt-2">
                      <Button asChild>
                        <a href={videoUrl} download={filename}>
                          <Download className="w-4 h-4 mr-2" />
                          Download Video
                        </a>
                      </Button>
                    </div>
                  )}
                  {recording.error_message && (
                    <>
                      <Separator />
                      <div className="flex items-start gap-2 p-4 bg-red-500/10 rounded-lg border border-red-500/20">
                        <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" />
                        <div>
                          <label className="text-sm font-medium text-red-500">Error</label>
                          <p className="text-sm text-red-400">{recording.error_message}</p>
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Sidebar Info */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="w-5 h-5" />
                    Streamer
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Link
                    href={`/streamers/${recording.streamer_id}/edit`}
                    className="flex items-center gap-3 hover:bg-muted p-2 rounded-lg transition-colors -ml-2"
                  >
                    <Avatar className="w-12 h-12">
                      <AvatarImage 
                        src={recording.streamer_avatar_url || undefined} 
                        alt={recording.streamer_username}
                        className="object-cover"
                      />
                      <AvatarFallback className="bg-primary/20 text-primary text-lg">
                        {recording.streamer_username.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-semibold">
                        {recording.streamer_display_name || recording.streamer_username}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        @{recording.streamer_username}
                      </p>
                    </div>
                  </Link>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="w-5 h-5" />
                    Duration & Size
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Duration</span>
                    <span className="font-mono font-medium">
                      {formatDuration(recording.duration_seconds)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">File Size</span>
                    <span className="font-mono font-medium">
                      {formatBytes(recording.file_size_bytes)}
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="w-5 h-5" />
                    Timestamps
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <span className="text-sm text-muted-foreground">Started</span>
                    <p className="font-medium">
                      {new Date(recording.started_at).toLocaleString()}
                    </p>
                  </div>
                  {recording.ended_at && (
                    <div>
                      <span className="text-sm text-muted-foreground">Ended</span>
                      <p className="font-medium">
                        {new Date(recording.ended_at).toLocaleString()}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
