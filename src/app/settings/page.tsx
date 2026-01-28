"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Sidebar } from "../components/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Settings, 
  FolderOpen, 
  Database, 
  Globe, 
  Save, 
  ExternalLink,
  Activity,
  RefreshCw,
  Play,
  Square,
  Radio,
  Users,
  Video,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

interface ServiceStatus {
  autoRecording: {
    isRunning: boolean;
    checkIntervalMs: number;
  };
  stats: {
    totalStreamers: number;
    autoRecordEnabled: number;
    activeRecordings: number;
  };
  recordings: Array<{
    recordingId: number;
    streamerId: number;
    username: string;
    startTime: string;
    filePath: string;
  }>;
}

export default function SettingsPage() {
  const [serviceStatus, setServiceStatus] = useState<ServiceStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);

  const [settings, setSettings] = useState({
    // Recording Settings
    outputDirectory: "./recordings",
    defaultQuality: "best",
    autoRecordEnabled: true,
    
    // Monitoring Settings
    checkInterval: "60",
    
    // Storage Settings
    autoCleanup: false,
    maxStorageGB: "100",
    
    // Notification Settings (placeholder)
    discordWebhook: "",
    notificationsEnabled: false,
  });

  useEffect(() => {
    fetchServiceStatus();
    // Refresh status every 5 seconds
    const interval = setInterval(fetchServiceStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchServiceStatus = async () => {
    try {
      const response = await fetch("/api/service/status");
      if (response.ok) {
        const data = await response.json();
        setServiceStatus(data);
      }
    } catch (error) {
      console.error("Failed to fetch service status:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleManualCheck = async () => {
    setChecking(true);
    try {
      const response = await fetch("/api/service/check", {
        method: "POST",
      });
      if (response.ok) {
        toast.success("Manual check triggered - checking for live streamers...");
        // Refresh status after a short delay
        setTimeout(fetchServiceStatus, 2000);
      } else {
        toast.error("Failed to trigger manual check");
      }
    } catch (error) {
      toast.error("Failed to trigger manual check");
    } finally {
      setTimeout(() => setChecking(false), 1000);
    }
  };

  const handleSave = () => {
    // In a real implementation, these would be saved to a config file or database
    toast.success("Settings saved successfully");
  };

  const formatDuration = (startTime: string) => {
    const start = new Date(startTime);
    const now = new Date();
    const diffMs = now.getTime() - start.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    
    if (diffHours > 0) {
      return `${diffHours}h ${diffMins % 60}m`;
    }
    return `${diffMins}m`;
  };

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Settings</h1>
              <p className="text-muted-foreground mt-1">
                Configure your Twitch recorder preferences
              </p>
            </div>
            <Button onClick={handleSave}>
              <Save className="w-4 h-4 mr-2" />
              Save Settings
            </Button>
          </div>

          <div className="space-y-6 max-w-3xl">
            {/* Service Status Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="w-5 h-5" />
                  Service Status
                </CardTitle>
                <CardDescription>
                  Monitor and control the auto-recording background service
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Status Badge */}
                <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/30">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${serviceStatus?.autoRecording.isRunning ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                    <div>
                      <p className="font-medium">
                        Auto-Recording Service
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {serviceStatus?.autoRecording.isRunning 
                          ? `Running (checks every ${serviceStatus.autoRecording.checkIntervalMs / 1000}s)` 
                          : 'Stopped'}
                      </p>
                    </div>
                  </div>
                  <Badge variant={serviceStatus?.autoRecording.isRunning ? "default" : "destructive"}>
                    {serviceStatus?.autoRecording.isRunning ? "Active" : "Inactive"}
                  </Badge>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-4 border rounded-lg text-center">
                    <Users className="w-5 h-5 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-2xl font-bold">{serviceStatus?.stats.totalStreamers || 0}</p>
                    <p className="text-xs text-muted-foreground">Total Streamers</p>
                  </div>
                  <div className="p-4 border rounded-lg text-center">
                    <Radio className="w-5 h-5 mx-auto mb-2 text-green-500" />
                    <p className="text-2xl font-bold">{serviceStatus?.stats.autoRecordEnabled || 0}</p>
                    <p className="text-xs text-muted-foreground">Auto-Record</p>
                  </div>
                  <div className="p-4 border rounded-lg text-center">
                    <Video className="w-5 h-5 mx-auto mb-2 text-red-500" />
                    <p className="text-2xl font-bold">{serviceStatus?.stats.activeRecordings || 0}</p>
                    <p className="text-xs text-muted-foreground">Recording Now</p>
                  </div>
                </div>

                {/* Manual Check Button */}
                <Button 
                  onClick={handleManualCheck} 
                  disabled={checking}
                  className="w-full"
                >
                  {checking ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Checking...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Check for Live Streamers Now
                    </>
                  )}
                </Button>

                {/* Active Recordings */}
                {serviceStatus && serviceStatus.recordings.length > 0 && (
                  <div className="space-y-2">
                    <Label>Active Recordings</Label>
                    <ScrollArea className="h-[150px] border rounded-lg p-2">
                      <div className="space-y-2">
                        {serviceStatus.recordings.map((recording) => (
                          <div 
                            key={recording.recordingId}
                            className="flex items-center justify-between p-2 bg-muted/50 rounded"
                          >
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                              <span className="font-medium">{recording.username}</span>
                            </div>
                            <span className="text-sm text-muted-foreground">
                              {formatDuration(recording.startTime)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recording Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FolderOpen className="w-5 h-5" />
                  Recording Settings
                </CardTitle>
                <CardDescription>
                  Configure default recording behavior and output settings
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="outputDirectory">Output Directory</Label>
                  <div className="flex gap-2">
                    <Input
                      id="outputDirectory"
                      value={settings.outputDirectory}
                      onChange={(e) =>
                        setSettings({ ...settings, outputDirectory: e.target.value })
                      }
                      placeholder="./recordings"
                    />
                    <Button variant="outline" size="icon">
                      <FolderOpen className="w-4 h-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Where recorded streams will be saved
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="defaultQuality">Default Quality</Label>
                  <Select
                    value={settings.defaultQuality}
                    onValueChange={(value) =>
                      setSettings({ ...settings, defaultQuality: value })
                    }
                  >
                    <SelectTrigger id="defaultQuality">
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
                  <p className="text-xs text-muted-foreground">
                    Default quality for new streamers
                  </p>
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <Label htmlFor="autoRecord" className="cursor-pointer">
                      Auto-record when live
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Automatically start recording when monitored streamers go live
                    </p>
                  </div>
                  <Switch
                    id="autoRecord"
                    checked={settings.autoRecordEnabled}
                    onCheckedChange={(checked) =>
                      setSettings({ ...settings, autoRecordEnabled: checked })
                    }
                  />
                </div>
              </CardContent>
            </Card>

            {/* Monitoring Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="w-5 h-5" />
                  Monitoring Settings
                </CardTitle>
                <CardDescription>
                  Configure how often to check if streamers are live
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="checkInterval">Check Interval (seconds)</Label>
                  <Input
                    id="checkInterval"
                    type="number"
                    min="30"
                    max="600"
                    value={settings.checkInterval}
                    onChange={(e) =>
                      setSettings({ ...settings, checkInterval: e.target.value })
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    How often to check if streamers are live (30-600 seconds)
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Storage Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="w-5 h-5" />
                  Storage Management
                </CardTitle>
                <CardDescription>
                  Configure automatic cleanup and storage limits
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <Label htmlFor="autoCleanup" className="cursor-pointer">
                      Automatic Cleanup
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Automatically delete old recordings when storage limit is reached
                    </p>
                  </div>
                  <Switch
                    id="autoCleanup"
                    checked={settings.autoCleanup}
                    onCheckedChange={(checked) =>
                      setSettings({ ...settings, autoCleanup: checked })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="maxStorage">Maximum Storage (GB)</Label>
                  <Input
                    id="maxStorage"
                    type="number"
                    min="1"
                    value={settings.maxStorageGB}
                    onChange={(e) =>
                      setSettings({ ...settings, maxStorageGB: e.target.value })
                    }
                    disabled={!settings.autoCleanup}
                  />
                  <p className="text-xs text-muted-foreground">
                    Maximum storage space to use for recordings
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* About */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  About
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Version</span>
                  <span className="font-medium">1.0.0</span>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Built with</span>
                  <span className="font-medium">Next.js + React + TypeScript</span>
                </div>
                <Separator />
                <div className="flex items-center gap-4 pt-2">
                  <Button variant="outline" asChild>
                    <Link href="/" target="_blank">
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Documentation
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
