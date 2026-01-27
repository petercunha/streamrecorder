"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Sidebar } from "../components/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Search, Play, Square, Trash2, Edit, Users } from "lucide-react";
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

export default function StreamersPage() {
  const [streamers, setStreamers] = useState<Streamer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [recordingIds, setRecordingIds] = useState<Set<number>>(new Set());
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newStreamer, setNewStreamer] = useState({
    username: "",
    display_name: "",
    auto_record: true,
    quality_preference: "best",
  });

  useEffect(() => {
    fetchStreamers();
    fetchActiveRecordings();
    const interval = setInterval(fetchActiveRecordings, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchStreamers = async () => {
    try {
      const response = await fetch("/api/streamers?all=true");
      const data = await response.json();
      setStreamers(data);
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

  const handleAddStreamer = async () => {
    try {
      const response = await fetch("/api/streamers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newStreamer),
      });

      if (response.ok) {
        toast.success(`Added ${newStreamer.username}`);
        setNewStreamer({
          username: "",
          display_name: "",
          auto_record: true,
          quality_preference: "best",
        });
        setIsAddDialogOpen(false);
        fetchStreamers();
      } else {
        const error = await response.text();
        toast.error(error);
      }
    } catch (error) {
      toast.error("Failed to add streamer");
    }
  };

  const handleDelete = async (id: number, username: string) => {
    if (!confirm(`Are you sure you want to delete ${username}?`)) return;

    try {
      const response = await fetch(`/api/streamers/${id}`, {
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

  const handleStartRecording = async (id: number, username: string) => {
    try {
      const response = await fetch(`/api/recordings/start/${id}`, {
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

  const handleStopRecording = async (id: number, username: string) => {
    try {
      const response = await fetch(`/api/recordings/stop/${id}`, {
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

  const filteredStreamers = streamers.filter(
    (s) =>
      s.username.toLowerCase().includes(search.toLowerCase()) ||
      (s.display_name?.toLowerCase() || "").includes(search.toLowerCase())
  );

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Streamers</h1>
              <p className="text-muted-foreground mt-1">
                Manage streamers to monitor and record
              </p>
            </div>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Streamer
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Streamer</DialogTitle>
                  <DialogDescription>
                    Enter the Twitch username of the streamer you want to record.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="username">Username *</Label>
                    <Input
                      id="username"
                      placeholder="e.g., shroud"
                      value={newStreamer.username}
                      onChange={(e) =>
                        setNewStreamer({ ...newStreamer, username: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="display_name">Display Name</Label>
                    <Input
                      id="display_name"
                      placeholder="e.g., Shroud"
                      value={newStreamer.display_name}
                      onChange={(e) =>
                        setNewStreamer({ ...newStreamer, display_name: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="quality">Quality Preference</Label>
                    <Select
                      value={newStreamer.quality_preference}
                      onValueChange={(value) =>
                        setNewStreamer({ ...newStreamer, quality_preference: value })
                      }
                    >
                      <SelectTrigger>
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
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="auto_record"
                      checked={newStreamer.auto_record}
                      onCheckedChange={(checked) =>
                        setNewStreamer({ ...newStreamer, auto_record: checked })
                      }
                    />
                    <Label htmlFor="auto_record">Auto-record when live</Label>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleAddStreamer} disabled={!newStreamer.username}>
                    Add Streamer
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search streamers..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Streamers Table */}
          <div className="border rounded-lg">
            <ScrollArea className="h-[calc(100vh-300px)]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Streamer</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Quality</TableHead>
                    <TableHead>Auto Record</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8">
                        Loading...
                      </TableCell>
                    </TableRow>
                  ) : filteredStreamers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8">
                        <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p className="text-muted-foreground">No streamers found</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredStreamers.map((streamer) => {
                      const isRecording = recordingIds.has(streamer.id);
                      const initials = streamer.username.slice(0, 2).toUpperCase();

                      return (
                        <TableRow key={streamer.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar className="w-10 h-10">
                                <AvatarFallback className="bg-primary/20 text-primary">
                                  {initials}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-medium">
                                  {streamer.display_name || streamer.username}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  @{streamer.username}
                                </p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={streamer.is_active ? "default" : "secondary"}
                            >
                              {streamer.is_active ? "Active" : "Inactive"}
                            </Badge>
                            {isRecording && (
                              <Badge
                                variant="outline"
                                className="ml-2 bg-red-500/20 text-red-500 border-red-500/50"
                              >
                                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse mr-1" />
                                REC
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>{streamer.quality_preference}</TableCell>
                          <TableCell>
                            {streamer.auto_record ? (
                              <span className="text-green-500">Yes</span>
                            ) : (
                              <span className="text-gray-500">No</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              {isRecording ? (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() =>
                                    handleStopRecording(streamer.id, streamer.username)
                                  }
                                  className="text-yellow-500"
                                >
                                  <Square className="w-4 h-4" />
                                </Button>
                              ) : (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() =>
                                    handleStartRecording(streamer.id, streamer.username)
                                  }
                                  className="text-green-500"
                                >
                                  <Play className="w-4 h-4" />
                                </Button>
                              )}
                              <Button variant="ghost" size="icon" asChild>
                                <Link href={`/streamers/${streamer.id}/edit`}>
                                  <Edit className="w-4 h-4" />
                                </Link>
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() =>
                                  handleDelete(streamer.id, streamer.username)
                                }
                                className="text-destructive"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
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
