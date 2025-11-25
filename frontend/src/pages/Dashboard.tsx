import { useState, useEffect } from 'react';
import { AlertTriangle, Shield, Activity, Flame } from 'lucide-react';
import { StatCard } from '@/components/StatCard';
import { AlertCard } from '@/components/AlertCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { mockAlerts, mockTransactions, mockGasData } from '@/lib/mockData';
import { Alert } from '@/types';
import { formatDistanceToNow } from 'date-fns';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Dot } from 'recharts';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

export default function Dashboard() {
  const [alerts, setAlerts] = useState<Alert[]>(mockAlerts);
  const [filter, setFilter] = useState<string>('all');

  const filteredAlerts = alerts.filter(alert => {
    if (filter === 'all') return true;
    return alert.severity === filter;
  });

  const stats = {
    totalContracts: 5,
    activeAlerts: alerts.filter(a => !a.dismissed).length,
    vulnerabilities24h: 8,
    gasAnomalies: 3,
  };

  const handleDismiss = (id: string) => {
    setAlerts(alerts.map(alert => 
      alert.id === id ? { ...alert, dismissed: true } : alert
    ));
  };

  // Simulate real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      // Add visual pulse to recent items
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Contracts Monitored"
          value={stats.totalContracts}
          icon={Shield}
          variant="peach"
          trend={{ value: 12, isPositive: true }}
        />
        <StatCard
          title="Active Alerts"
          value={stats.activeAlerts}
          icon={AlertTriangle}
          variant="mint"
          trend={{ value: 8, isPositive: false }}
        />
        <StatCard
          title="Vulnerabilities (24h)"
          value={stats.vulnerabilities24h}
          icon={Activity}
          variant="sky"
        />
        <StatCard
          title="Gas Anomalies"
          value={stats.gasAnomalies}
          icon={Flame}
          variant="lavender"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Alerts Feed */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-geist font-semibold">Recent Alerts</h2>
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="CRITICAL">Critical</SelectItem>
                <SelectItem value="HIGH">High</SelectItem>
                <SelectItem value="MEDIUM">Medium</SelectItem>
                <SelectItem value="LOW">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            {filteredAlerts.slice(0, 6).map((alert) => (
              <AlertCard
                key={alert.id}
                alert={alert}
                onDismiss={handleDismiss}
              />
            ))}
          </div>
        </div>

        {/* Network Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-geist">Network Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-96">
              <div className="space-y-3">
                {mockTransactions.slice(0, 15).map((tx) => (
                  <div
                    key={tx.hash}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <code className="text-xs font-mono truncate block">
                        {tx.hash.slice(0, 16)}...
                      </code>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(tx.timestamp, { addSuffix: true })}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {(tx.gasUsed / 1000).toFixed(0)}k
                      </span>
                      <div
                        className={cn(
                          'w-2 h-2 rounded-full',
                          tx.status === 'success' ? 'bg-success' : 'bg-destructive'
                        )}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Gas Usage Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-geist">Gas Usage (24h)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={mockGasData}>
              <XAxis
                dataKey="timestamp"
                tickFormatter={(ts) => new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit' })}
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
              />
              <YAxis
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                tickFormatter={(val) => `${(val / 1000).toFixed(0)}k`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
                labelFormatter={(ts) => new Date(ts).toLocaleString()}
                formatter={(val: number) => [`${val.toLocaleString()} gas`, 'Usage']}
              />
              <Line
                type="monotone"
                dataKey="gas"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={(props: any) => {
                  const point = mockGasData[props.index];
                  if (point?.anomaly) {
                    return (
                      <Dot
                        {...props}
                        r={6}
                        fill="hsl(var(--destructive))"
                        stroke="hsl(var(--destructive))"
                      />
                    );
                  }
                  return null;
                }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
