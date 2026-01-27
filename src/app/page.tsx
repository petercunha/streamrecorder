"use client";

import { Sidebar } from "./components/sidebar";
import { StatsCards } from "./components/stats-cards";
import { StreamersList } from "./components/streamers-list";
import { RecentRecordings } from "./components/recent-recordings";
import { ActivityLogs } from "./components/activity-logs";

export default function Dashboard() {
  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
              <p className="text-muted-foreground mt-1">
                Monitor and manage your Twitch recordings
              </p>
            </div>
          </div>

          {/* Stats Cards */}
          <StatsCards />

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Streamers List */}
            <StreamersList limit={5} />

            {/* Recent Recordings */}
            <RecentRecordings limit={5} />
          </div>

          {/* Activity Logs */}
          <ActivityLogs />
        </div>
      </main>
    </div>
  );
}
