import { useState, useEffect } from 'react';
import { AlertTriangle, Shield, Activity, Flame, Plus, Zap, TrendingUp, CheckCircle, XCircle } from 'lucide-react';
import { StatCard } from '@/components/StatCard';
import { AlertCard } from '@/components/AlertCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, Contract, Transaction } from '@/types';
import { formatDistanceToNow } from 'date-fns';
import { formatRelativeTime, getAlertTimestamp } from '@/utils/typeUtils';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn, formatGas } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { ContractAddress } from '@/components/ContractAddress';

import { useSocket } from '@/hooks/useSocket';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAccount } from 'wagmi';
import { toast } from '@/hooks/use-toast';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export default function Monitor() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [findings, setFindings] = useState<any[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [isPaused, setIsPaused] = useState(false);
  const { address } = useAccount();
  const queryClient = useQueryClient();

  // Real-time WebSocket connection
  const { lastTransaction, lastAlert, socket } = useSocket();

  // Listen for new findings (manual validation candidates)
  useEffect(() => {
    if (socket) {
      socket.on('new_finding', (finding: any) => {
        setFindings(prev => [finding, ...prev]);
        toast({
          title: "New Potential Vulnerability",
          description: "A new finding requires validation.",
        });
      });
    }
    return () => {
      if (socket) socket.off('new_finding');
    };
  }, [socket]);

  const { isAuthenticated } = useAuth(); // Get auth state

  // Fetch contracts
  const { data: contracts = [], isLoading: isLoadingContracts } = useQuery<Contract[]>({
    queryKey: ['contracts', address],
    queryFn: async () => {
      const response = await api.get('/api/contracts');
      // Handle paginated response
      return response.data || response;
    },
    enabled: isAuthenticated && !!address,
  });

  // Fetch stats
  const { data: apiStats } = useQuery({
    queryKey: ['stats'],
    queryFn: async () => {
      const response = await api.get('/api/stats');
      return response.data || response;
    },
    refetchInterval: 10000,
    enabled: isAuthenticated && contracts.length > 0,
  });

  // Fetch recent alerts
  const { data: initialAlerts } = useQuery<Alert[]>({
    queryKey: ['alerts'],
    queryFn: async () => {
      const response = await api.get('/api/alerts?limit=50');
      // Handle paginated response
      return response.data || response;
    },
    enabled: isAuthenticated && contracts.length > 0,
  });

  // Fetch recent transactions
  const { data: initialTransactions } = useQuery<Transaction[]>({
    queryKey: ['transactions'],
    queryFn: async () => {
      const response = await api.get('/api/transactions?limit=50');
      return response.data || response;
    },
    enabled: isAuthenticated && contracts.length > 0,
  });

  // Initialize state
  useEffect(() => {
    if (initialAlerts) setAlerts(initialAlerts);
  }, [initialAlerts]);

  useEffect(() => {
    if (initialTransactions) setTransactions(initialTransactions);
  }, [initialTransactions]);

  // Handle new transactions
  useEffect(() => {
    if (lastTransaction) {
      setTransactions(prev => [lastTransaction, ...prev].slice(0, 50));
    }
  }, [lastTransaction]);

  // Handle new alerts
  useEffect(() => {
    if (lastAlert) {
      setAlerts(prev => [lastAlert, ...prev].slice(0, 50));
    }
  }, [lastAlert]);

  // Manual Validation Mutation
  const validateMutation = useMutation({
    mutationFn: async (findingId: string) => {
      const res = await api.post(`/api/alerts/validate/${findingId}`, {});
      return res;
    },
    onSuccess: (data, findingId) => {
      // Remove from findings list
      setFindings(prev => prev.filter(f => f.id !== findingId));

      if (data.valid) {
        toast({
          title: "Vulnerability Confirmed",
          description: "The AI has confirmed this vulnerability and created an alert.",
          variant: "destructive"
        });
        // Alert will come via socket
      } else {
        toast({
          title: "False Positive",
          description: "The AI determined this was a false positive.",
        });
      }
    },
    onError: () => {
      toast({
        title: "Validation Failed",
        description: "Could not validate the finding.",
        variant: "destructive"
      });
    }
  });

  const togglePause = async () => {
    try {
      // In a real app, call API to toggle pause
      setIsPaused(!isPaused);
      toast({
        title: isPaused ? "Scanner Resumed" : "Scanner Paused",
        description: isPaused ? "Real-time monitoring is active." : "Monitoring paused.",
      });
    } catch (error) {
      console.error(error);
    }
  };

  const filteredAlerts = alerts.filter(alert => {
    if (filter === 'all') return true;
    return alert.severity === filter;
  });

  const stats = apiStats || {
    totalContracts: contracts.length,
    activeAlerts: alerts.filter(a => !a.dismissed).length,
    vulnerabilities24h: alerts.filter(a => {
      const time = getAlertTimestamp(a);
      if (!time) return false;
      const timestamp = typeof time === 'string' ? new Date(time).getTime() : time;
      return timestamp && Date.now() - timestamp < 24 * 60 * 60 * 1000;
    }).length,
    gasAnomalies: alerts.filter(a =>
      a.type === 'GAS_ANOMALY' ||
      a.type === 'SPAM_ATTACK' ||
      (a.type === 'SUSPICIOUS_ACTIVITY' && a.description.toLowerCase().includes('gas'))
    ).length,
  };

  const handleDismiss = (id: string) => {
    setAlerts(alerts.map(alert =>
      alert.id === id ? { ...alert, dismissed: true } : alert
    ));
  };

  if (!isLoadingContracts && contracts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6 animate-in fade-in duration-500">
        <div className="w-24 h-24 bg-muted/50 rounded-full flex items-center justify-center">
          <Shield className="w-12 h-12 text-muted-foreground/50" />
        </div>
        <div className="space-y-2 max-w-md">
          <h2 className="text-2xl font-bold font-geist">No Contracts Monitored</h2>
          <p className="text-muted-foreground">
            Add a smart contract to start monitoring for vulnerabilities, gas anomalies, and real-time threats.
          </p>
        </div>
        <Button asChild size="lg" className="gap-2">
          <Link to="/dashboard">
            <Plus className="w-5 h-5" />
            Add Contract
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Scanner Status Component */}
      <Card className="bg-gradient-to-br from-sidebar to-sidebar-accent text-sidebar-foreground">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn(
                'w-3 h-3 rounded-full',
                !isPaused ? 'bg-success pulse-dot' : 'bg-muted-foreground'
              )} />
              <div>
                <h2 className="text-lg font-geist font-semibold">
                  {!isPaused ? 'Network Scanner Active' : 'Scanner Paused'}
                </h2>
                <p className="text-sm text-sidebar-foreground/80">
                  {!isPaused
                    ? `Monitoring ${contracts.length} contracts for real-time threats`
                    : 'Real-time monitoring is currently paused'}
                </p>
              </div>
            </div>
            <Button
              variant={!isPaused ? 'secondary' : 'default'}
              onClick={togglePause}
            >
              {!isPaused ? 'Pause Scanning' : 'Resume Scanning'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <StatCard
          title="Contracts Monitored"
          value={stats.totalContracts}
          icon={Shield}
          variant="peach"
          trend={undefined}
        />
        <StatCard
          title="Total Transactions"
          value={transactions.length}
          icon={Activity}
          variant="lavender"
          trend={undefined}
        />
        <StatCard
          title="Active Alerts"
          value={stats.activeAlerts}
          icon={AlertTriangle}
          variant="mint"
          trend={undefined}
        />
        <StatCard
          title="Vulnerabilities (24h)"
          value={stats.vulnerabilities24h}
          icon={Zap}
          variant="sky"
        />
        <StatCard
          title="Gas Anomalies"
          value={stats.gasAnomalies}
          icon={Flame}
          variant="peach"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Findings & Alerts */}
        <div className="lg:col-span-2 space-y-6">

          {/* Findings (Pending Validation) */}
          {findings.length > 0 && (
            <Card className="border-warning/50 bg-warning/5">
              <CardHeader>
                <CardTitle className="text-base font-geist flex items-center gap-2 text-warning">
                  <AlertTriangle className="w-5 h-5" />
                  Pending Validation ({findings.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {findings.map((finding) => (
                  <div key={finding.id} className="flex items-start justify-between p-4 bg-background rounded-lg border">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-warning border-warning">
                          {finding.type}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {formatDistanceToNow(new Date(finding.createdAt || Date.now()), { addSuffix: true })}
                        </span>
                      </div>
                      <p className="text-sm font-medium">{finding.description || "Potential vulnerability detected"}</p>
                      <div className="mt-2 text-xs text-muted-foreground">
                        Contract: <span className="font-mono">{finding.contractAddress}</span>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => validateMutation.mutate(finding.id)}
                      disabled={validateMutation.isPending}
                    >
                      {validateMutation.isPending ? "Validating..." : "Validate with AI"}
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Active Alerts */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-geist font-semibold">Active Alerts</h2>
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
              {filteredAlerts.length > 0 ? (
                filteredAlerts.slice(0, 6).map((alert) => (
                  <AlertCard
                    key={alert.id}
                    alert={alert}
                    onDismiss={handleDismiss}
                  />
                ))
              ) : (
                <div className="text-center py-12 border rounded-xl bg-muted/20 border-dashed">
                  <p className="text-muted-foreground">No active alerts.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Activity */}
        <div className="space-y-6">
          {/* Network Activity */}
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="text-base font-geist">Network Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <div className="space-y-3">
                  {transactions.length > 0 ? (
                    transactions.slice(0, 20).map((tx) => (
                      <div
                        key={tx.hash}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                      >
                        <div className="flex-1 min-w-0" title={tx.hash}>
                          <code className="text-xs font-mono truncate block">
                            {tx.hash.slice(0, 16)}...
                          </code>
                          <span className="text-xs text-muted-foreground">
                            {formatRelativeTime(tx.timestamp)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground font-mono">
                            {formatGas(tx.gasUsed)}
                          </span>
                          <div
                            className={cn(
                              'w-2 h-2 rounded-full',
                              tx.status === 'success' ? 'bg-success' : 'bg-destructive'
                            )}
                            title={tx.status === 'success' ? 'Success' : 'Failed'}
                          />
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-12">
                      <p className="text-sm text-muted-foreground">No recent activity</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Gas Usage Chart (Bottom Full Width) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-geist">Gas Usage (24h)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] w-full">
            {transactions.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={[...transactions].reverse()}>
                  <XAxis
                    dataKey="timestamp"
                    tickFormatter={(time) => {
                      const date = new Date(time);
                      return !isNaN(date.getTime()) ? date.toLocaleTimeString() : '--';
                    }}
                    stroke="#888888"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="#888888"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => formatGas(value)}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="rounded-lg border bg-background p-2 shadow-sm">
                            <div className="grid grid-cols-2 gap-2">
                              <div className="flex flex-col">
                                <span className="text-[0.70rem] uppercase text-muted-foreground">
                                  Gas
                                </span>
                                <span className="font-bold text-muted-foreground">
                                  {formatGas(payload[0].value as number)}
                                </span>
                              </div>
                              <div className="flex flex-col">
                                <span className="text-[0.70rem] uppercase text-muted-foreground">
                                  Time
                                </span>
                                <span className="font-bold text-muted-foreground">
                                  {(() => {
                                    const date = new Date(payload[0].payload.timestamp);
                                    return !isNaN(date.getTime()) ? date.toLocaleTimeString() : 'Unknown';
                                  })()}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="gasUsed"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center border-dashed border-2 border-muted rounded-xl bg-muted/10">
                <p className="text-xs text-muted-foreground">No data</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
