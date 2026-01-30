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
import { 
  Settings, 
  FolderOpen, 
  Database, 
  Globe, 
  Save, 
  ExternalLink,
  Activity,
  RefreshCw,
  Radio,
  Users,
  Video,
  Loader2,
  Clock,
  Bell,
  Info,
  HardDrive,
  AlertTriangle,
  CheckCircle,
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
}

interface AppSettings {
  minFreeDiskMb: number;
  maxRecordingSizeMb: number;
  maxTotalRecordingsMb: number;
  maxRecordingDurationHours: number;
  checkIntervalSeconds: number;
}

interface DiskStatus {
  total: string;
  used: string;
  free: string;
  usedPercentage: number;
  status: 'ok' | 'warning' | 'critical';
}

export default function SettingsPage() {
  const [serviceStatus, setServiceStatus] = useState<ServiceStatus | null>(null);
  const [settings, setSettings] = useState<AppSettings>({
    minFreeDiskMb: 5000,
    maxRecordingSizeMb: 0,
    maxTotalRecordingsMb: 0,
    maxRecordingDurationHours: 0,
    checkIntervalSeconds: 60,
  });
  const [diskStatus, setDiskStatus] = useState<DiskStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    fetchServiceStatus();
    fetchSettings();
    // Refresh status every 5 seconds
    const interval = setInterval(() => {
      fetchServiceStatus();
    }, 5000);
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
    }
  };

  const fetchSettings = async () => {
    try {
      const response = await fetch("/api/settings");
      if (response.ok) {
        const data = await response.json();
        setSettings(data.settings);
        setDiskStatus(data.diskStatus);
      }
    } catch (error) {
      console.error("Failed to fetch settings:", error);
      toast.error("Failed to load settings");
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

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });

      if (response.ok) {
        const data = await response.json();
        setSettings(data.settings);
        toast.success("Settings saved successfully");
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to save settings");
      }
    } catch (error) {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const getDiskStatusColor = (status: string) => {
    switch (status) {
      case 'ok': return 'text-green-500';
      case 'warning': return 'text-yellow-500';
      case 'critical': return 'text-red-500';
      default: return 'text-gray-500';
    }
  };

  const getDiskStatusBg = (status: string) => {
    switch (status) {
      case 'ok': return 'bg-green-500/10 border-green-500/20';
      case 'warning': return 'bg-yellow-500/10 border-yellow-500/20';
      case 'critical': return 'bg-red-500/10 border-red-500/20';
      default: return 'bg-gray-500/10 border-gray-500/20';
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen bg-background">
        <Sidebar />
        <main className="flex-1 overflow-auto flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
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
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Settings</h1>
              <p className="text-muted-foreground mt-1">
                Configure your Twitch recorder preferences
              </p>
            </div>
            <Button onClick={handleSave} disabled={saving} className="cursor-pointer">
              {saving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Save Settings
            </Button>
          </div>

          {/* Main Grid - Two Columns */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            
            {/* Left Column */}
            <div className="space-y-6">
              {/* Service Status Card */}
              <Card className="border-l-4 border-l-primary">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="w-5 h-5 text-primary" />
                    Service Status
                  </CardTitle>
                  <CardDescription>
                    Monitor and control the auto-recording background service
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Status Badge */}
                  <div className="flex items-center justify-between p-4 rounded-lg bg-gradient-to-r from-muted/50 to-muted/30 border">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${serviceStatus?.autoRecording.isRunning ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                      <div>
                        <p className="font-medium">
                          Auto-Recording Service
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {serviceStatus?.autoRecording.isRunning 
                            ? `Running (checks every ${serviceStatus.autoRecording.checkIntervalMs / 1000}s)` 
                            : 'Stopped - Auto-recording disabled'}
                        </p>
                      </div>
                    </div>
                    <Badge 
                      variant={serviceStatus?.autoRecording.isRunning ? "default" : "destructive"}
                      className="px-3 py-1"
                    >
                      {serviceStatus?.autoRecording.isRunning ? "Active" : "Inactive"}
                    </Badge>
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20 text-center">
                      <Users className="w-5 h-5 mx-auto mb-2 text-blue-500" />
                      <p className="text-2xl font-bold">{serviceStatus?.stats.totalStreamers || 0}</p>
                      <p className="text-xs text-muted-foreground">Total Streamers</p>
                    </div>
                    <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20 text-center">
                      <Radio className="w-5 h-5 mx-auto mb-2 text-green-500" />
                      <p className="text-2xl font-bold">{serviceStatus?.stats.autoRecordEnabled || 0}</p>
                      <p className="text-xs text-muted-foreground">Auto-Record</p>
                    </div>
                    <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-center">
                      <Video className="w-5 h-5 mx-auto mb-2 text-red-500" />
                      <p className="text-2xl font-bold">{serviceStatus?.stats.activeRecordings || 0}</p>
                      <p className="text-xs text-muted-foreground">Recording Now</p>
                    </div>
                  </div>

                  {/* Manual Check Button */}
                  <Button 
                    onClick={handleManualCheck} 
                    disabled={checking}
                    className="w-full cursor-pointer"
                    variant="secondary"
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
                </CardContent>
              </Card>

              {/* Disk Space & Recording Limits */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2">
                    <HardDrive className="w-5 h-5 text-blue-500" />
                    Disk Space & Recording Limits
                  </CardTitle>
                  <CardDescription>
                    Configure disk space requirements and recording limits to prevent system crashes
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  {/* Disk Status */}
                  {diskStatus && (
                    <div className={`p-4 rounded-lg border ${getDiskStatusBg(diskStatus.status)}`}>
                      <div className="flex items-center gap-2 mb-3">
                        {diskStatus.status === 'ok' ? (
                          <CheckCircle className={`w-5 h-5 ${getDiskStatusColor(diskStatus.status)}`} />
                        ) : (
                          <AlertTriangle className={`w-5 h-5 ${getDiskStatusColor(diskStatus.status)}`} />
                        )}
                        <span className="font-medium">Disk Status: {diskStatus.status.toUpperCase()}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Total</p>
                          <p className="font-medium">{diskStatus.total}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Used</p>
                          <p className="font-medium">{diskStatus.used} ({diskStatus.usedPercentage}%)</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Free</p>
                          <p className="font-medium">{diskStatus.free}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  <Separator />

                  {/* Min Free Disk Space */}
                  <div className="space-y-2">
                    <Label htmlFor="minFreeDiskMb">Minimum Free Disk Space (MB)</Label>
                    <div className="flex items-center gap-3">
                      <Input
                        id="minFreeDiskMb"
                        type="number"
                        min="0"
                        value={settings.minFreeDiskMb}
                        onChange={(e) =>
                          setSettings({ ...settings, minFreeDiskMb: parseInt(e.target.value) || 0 })
                        }
                        className="max-w-[150px]"
                      />
                      <span className="text-sm text-muted-foreground">
                        ~{(settings.minFreeDiskMb / 1024).toFixed(1)} GB
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Recordings will not start if free space falls below this limit (0 = no limit)
                    </p>
                  </div>

                  {/* Max Recording Size */}
                  <div className="space-y-2">
                    <Label htmlFor="maxRecordingSizeMb">Max Recording Size (MB)</Label>
                    <div className="flex items-center gap-3">
                      <Input
                        id="maxRecordingSizeMb"
                        type="number"
                        min="0"
                        value={settings.maxRecordingSizeMb}
                        onChange={(e) =>
                          setSettings({ ...settings, maxRecordingSizeMb: parseInt(e.target.value) || 0 })
                        }
                        className="max-w-[150px]"
                      />
                      <span className="text-sm text-muted-foreground">
                        {settings.maxRecordingSizeMb === 0 ? 'Unlimited' : `~${(settings.maxRecordingSizeMb / 1024).toFixed(1)} GB`}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Individual recordings will stop when they reach this size (0 = unlimited)
                    </p>
                  </div>

                  {/* Max Total Recordings */}
                  <div className="space-y-2">
                    <Label htmlFor="maxTotalRecordingsMb">Max Total Recordings (MB)</Label>
                    <div className="flex items-center gap-3">
                      <Input
                        id="maxTotalRecordingsMb"
                        type="number"
                        min="0"
                        value={settings.maxTotalRecordingsMb}
                        onChange={(e) =>
                          setSettings({ ...settings, maxTotalRecordingsMb: parseInt(e.target.value) || 0 })
                        }
                        className="max-w-[150px]"
                      />
                      <span className="text-sm text-muted-foreground">
                        {settings.maxTotalRecordingsMb === 0 ? 'Unlimited' : `~${(settings.maxTotalRecordingsMb / 1024).toFixed(1)} GB`}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      New recordings will not start if total size exceeds this limit (0 = unlimited)
                    </p>
                  </div>

                  {/* Max Recording Duration */}
                  <div className="space-y-2">
                    <Label htmlFor="maxRecordingDurationHours">Max Recording Duration (hours)</Label>
                    <div className="flex items-center gap-3">
                      <Input
                        id="maxRecordingDurationHours"
                        type="number"
                        min="0"
                        value={settings.maxRecordingDurationHours}
                        onChange={(e) =>
                          setSettings({ ...settings, maxRecordingDurationHours: parseInt(e.target.value) || 0 })
                        }
                        className="max-w-[150px]"
                      />
                      <span className="text-sm text-muted-foreground">
                        {settings.maxRecordingDurationHours === 0 ? 'Unlimited' : `${settings.maxRecordingDurationHours} hours`}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Recordings will stop automatically after this duration (0 = unlimited)
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* About Card */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2">
                    <Info className="w-5 h-5 text-purple-500" />
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
                    <Button variant="outline" asChild className="cursor-pointer">
                      <Link href="/" target="_blank">
                        <ExternalLink className="w-4 h-4 mr-2" />
                        Documentation
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right Column */}
            <div className="space-y-6">
              {/* Monitoring Settings */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2">
                    <Globe className="w-5 h-5 text-green-500" />
                    Monitoring Settings
                  </CardTitle>
                  <CardDescription>
                    Configure how often to check if streamers are live
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="checkIntervalSeconds">Check Interval (seconds)</Label>
                    <div className="flex items-center gap-3">
                      <Input
                        id="checkIntervalSeconds"
                        type="number"
                        min="30"
                        max="3600"
                        value={settings.checkIntervalSeconds}
                        onChange={(e) =>
                          setSettings({ ...settings, checkIntervalSeconds: parseInt(e.target.value) || 60 })
                        }
                        className="max-w-[150px]"
                      />
                      <span className="text-sm text-muted-foreground">
                        <Clock className="w-4 h-4 inline mr-1" />
                        Seconds between checks
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      How often to check if streamers are live (30-3600 seconds)
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Recording Settings */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2">
                    <FolderOpen className="w-5 h-5 text-blue-500" />
                    Recording Settings
                  </CardTitle>
                  <CardDescription>
                    Configure output directory and quality settings
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="outputDirectory">Output Directory</Label>
                    <div className="flex gap-2">
                      <Input
                        id="outputDirectory"
                        value="./recordings"
                        disabled
                        className="bg-muted"
                      />
                      <Button variant="outline" size="icon" className="cursor-pointer shrink-0" disabled>
                        <FolderOpen className="w-4 h-4" />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Recordings are saved to the ./recordings directory (configured via RECORDINGS_DIR env var)
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Notifications Settings */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2">
                    <Bell className="w-5 h-5 text-yellow-500" />
                    Notifications
                  </CardTitle>
                  <CardDescription>
                    Configure notification settings for recording events
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50 border">
                    <div>
                      <Label htmlFor="notificationsEnabled" className="cursor-pointer font-medium">
                        Enable Notifications
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Receive notifications when recordings start/stop
                      </p>
                    </div>
                    <Switch
                      id="notificationsEnabled"
                      checked={false}
                      disabled
                      className="cursor-not-allowed"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Notification settings coming soon
                  </p>
                </CardContent>
              </Card>

              {/* Quick Actions Card */}
              <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="w-5 h-5 text-primary" />
                    Quick Actions
                  </CardTitle>
                  <CardDescription>
                    Common tasks and operations
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button 
                    variant="outline" 
                    className="w-full justify-start cursor-pointer" 
                    asChild
                  >
                    <Link href="/streamers">
                      <Users className="w-4 h-4 mr-2" />
                      Manage Streamers
                    </Link>
                  </Button>
                  <Button 
                    variant="outline" 
                    className="w-full justify-start cursor-pointer" 
                    asChild
                  >
                    <Link href="/recordings">
                      <Video className="w-4 h-4 mr-2" />
                      View Recordings
                    </Link>
                  </Button>
                  <Button 
                    variant="outline" 
                    className="w-full justify-start cursor-pointer" 
                    asChild
                  >
                    <Link href="/monitor">
                      <Activity className="w-4 h-4 mr-2" />
                      Live Monitor
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
