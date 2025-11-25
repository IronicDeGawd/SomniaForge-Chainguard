import { useState, useEffect } from 'react';
import { AlertTriangle, Shield, Activity, Flame, Plus } from 'lucide-react';
import { StatCard } from '@/components/StatCard';
import { AlertCard } from '@/components/AlertCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, Contract, Transaction } from '@/types';
import { formatDistanceToNow } from 'date-fns';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

import { useSocket } from '@/hooks/useSocket';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAccount } from 'wagmi';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export default function Dashboard() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const { address } = useAccount();

  // Real-time WebSocket connection
  const { lastTransaction, lastAlert } = useSocket();

  // Fetch contracts to check if we have any
  const { data: contracts = [], isLoading: isLoadingContracts } = useQuery<Contract[]>({
    queryKey: ['contracts', address],
    queryFn: async () => {
      return api.get('/api/contracts');
    },
  });

  // Fetch stats from API
  const { data: apiStats } = useQuery({
    queryKey: ['stats'],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/api/stats`);
      if (!res.ok) throw new Error('Failed to fetch stats');
      return res.json();
    },
    refetchInterval: 10000,
    enabled: contracts.length > 0,
  });

  // Fetch recent alerts
  const { data: initialAlerts } = useQuery<Alert[]>({
    queryKey: ['alerts'],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/api/alerts?limit=50`);
      if (!res.ok) throw new Error('Failed to fetch alerts');
      return res.json();
    },
    enabled: contracts.length > 0,
  });

  // Fetch recent transactions
  const { data: initialTransactions } = useQuery<Transaction[]>({
    queryKey: ['transactions'],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/api/transactions?limit=50`);
      if (!res.ok) throw new Error('Failed to fetch transactions');
      return res.json();
    },
    enabled: contracts.length > 0,
  });

  // Initialize state with fetched data
  useEffect(() => {
    if (initialAlerts) setAlerts(initialAlerts);
  }, [initialAlerts]);

  useEffect(() => {
    if (initialTransactions) setTransactions(initialTransactions);
  }, [initialTransactions]);

  // Handle new transactions from socket
  useEffect(() => {
    if (lastTransaction) {
      setTransactions(prev => [lastTransaction, ...prev].slice(0, 50));
    }
  }, [lastTransaction]);

  // Handle new alerts from socket
  useEffect(() => {
    if (lastAlert) {
      setAlerts(prev => [lastAlert, ...prev].slice(0, 50));
    }
  }, [lastAlert]);

  const filteredAlerts = alerts.filter(alert => {
    if (filter === 'all') return true;
    return alert.severity === filter;
  });

  const stats = apiStats || {
    totalContracts: contracts.length,
    activeAlerts: alerts.filter(a => !a.dismissed).length,
    vulnerabilities24h: alerts.filter(a => Date.now() - a.timestamp < 24 * 60 * 60 * 1000).length,
    gasAnomalies: alerts.filter(a => a.type === 'GAS_ANOMALY').length,
  };

  const handleDismiss = (id: string) => {
    setAlerts(alerts.map(alert =>
      alert.id === id ? { ...alert, dismissed: true } : alert
    ));
  };

  // Empty State
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
          <Link to="/monitor">
            <Plus className="w-5 h-5" />
            Add Contract
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Contracts Monitored"
          value={stats.totalContracts}
          icon={Shield}
          variant="peach"
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
                <p className="text-muted-foreground">No alerts detected yet.</p>
              </div>
            )}
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
                {transactions.length > 0 ? (
                  transactions.slice(0, 15).map((tx) => (
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

      {/* Gas Usage Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-geist">Gas Usage (24h)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center border-dashed border-2 border-muted rounded-xl bg-muted/10">
            <p className="text-muted-foreground">Gas usage data will appear here once transactions are detected.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
