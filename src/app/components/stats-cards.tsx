"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HardDrive, Radio, Users, Disc, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

interface Stats {
  totalDownloaded: string;
  activeRecordings: number;
  totalStreamers: number;
  totalRecordings: number;
  recordingStats: {
    total: number;
    recording: number;
    completed: number;
    error: number;
    stopped: number;
  };
}

interface StatCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon: React.ComponentType<{ className?: string }>;
  trend?: "up" | "down" | "neutral";
  color?: "purple" | "green" | "blue" | "orange" | "red";
  animate?: boolean;
}

function StatCard({
  title,
  value,
  description,
  icon: Icon,
  trend = "neutral",
  color = "purple",
  animate = false,
}: StatCardProps) {
  const colorClasses = {
    purple: "from-purple-500/20 to-purple-600/10 text-purple-400",
    green: "from-green-500/20 to-green-600/10 text-green-400",
    blue: "from-blue-500/20 to-blue-600/10 text-blue-400",
    orange: "from-orange-500/20 to-orange-600/10 text-orange-400",
    red: "from-red-500/20 to-red-600/10 text-red-400",
  };

  return (
    <Card className="relative overflow-hidden group hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
      <div
        className={cn(
          "absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-opacity duration-300",
          colorClasses[color]
        )}
      />
      <CardHeader className="flex flex-row items-center justify-between pb-2 relative">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div
          className={cn(
            "p-2 rounded-lg bg-gradient-to-br",
            colorClasses[color]
          )}
        >
          <Icon className="w-4 h-4" />
        </div>
      </CardHeader>
      <CardContent className="relative">
        <div className="text-2xl font-bold text-foreground">{value}</div>
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
        {animate && (
          <div className="absolute top-0 right-0 w-2 h-2 rounded-full bg-green-500 animate-pulse" />
        )}
      </CardContent>
    </Card>
  );
}

export function StatsCards() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchStats = async () => {
    try {
      const response = await fetch("/api/stats");
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="h-32 animate-pulse bg-muted" />
        ))}
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center text-muted-foreground py-8">
        Failed to load statistics
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <StatCard
        title="Total Downloaded"
        value={stats.totalDownloaded}
        description="All-time data downloaded"
        icon={HardDrive}
        color="purple"
      />
      <StatCard
        title="Active Recordings"
        value={stats.activeRecordings}
        description="Currently recording"
        icon={Radio}
        color="green"
        animate={stats.activeRecordings > 0}
      />
      <StatCard
        title="Total Streamers"
        value={stats.totalStreamers}
        description="Streamers being monitored"
        icon={Users}
        color="blue"
      />
      <StatCard
        title="Total Recordings"
        value={stats.totalRecordings}
        description={`${stats.recordingStats.completed} completed`}
        icon={Disc}
        color="orange"
      />
    </div>
  );
}
