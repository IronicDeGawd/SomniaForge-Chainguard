import { useState, useEffect } from 'react';
import { NetworkExploit } from '@/types';

interface MonitorStatus {
  isMonitoring: boolean;
  isPaused: boolean;
  monitoredContracts: string[];
  activeSubscriptions: number;
}

interface NetworkStats {
  totalTransactions: number;
  flashLoans: number;
  reentrancyAttempts: number;
  suspiciousPatterns: number;
}

export function useScannerData() {
  const [status, setStatus] = useState<MonitorStatus | null>(null);
  const [stats, setStats] = useState<NetworkStats | null>(null);
  const [exploits, setExploits] = useState<NetworkExploit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const [statusRes, statsRes, alertsRes] = await Promise.all([
        fetch('http://localhost:3000/api/monitor/status'),
        fetch('http://localhost:3000/api/stats/network'),
        fetch('http://localhost:3000/api/alerts?status=active')
      ]);

      if (!statusRes.ok || !statsRes.ok || !alertsRes.ok) {
        throw new Error('Failed to fetch scanner data');
      }

      const statusData = await statusRes.json();
      const statsData = await statsRes.json();
      const alertsData = await alertsRes.json();

      setStatus(statusData);
      setStats(statsData);
      
      // Transform alerts to NetworkExploit format if needed
      // Assuming alertsData matches or we map it
      const mappedExploits = alertsData.map((alert: any) => ({
        id: alert.id,
        type: alert.type,
        contract: alert.contract?.name || 'Unknown',
        exploitedContract: alert.contractAddress,
        timestamp: new Date(alert.createdAt).getTime(),
        severity: alert.severity,
        valueLost: alert.valueLost || null, // Assuming this field might exist or be added later
        pattern: alert.description,
        similarContracts: [] // Backend doesn't provide this yet
      }));
      
      setExploits(mappedExploits);
      setError(null);
    } catch (err) {
      console.error('Error fetching scanner data:', err);
      setError('Failed to load scanner data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000); // Poll every 5 seconds
    return () => clearInterval(interval);
  }, []);

  const togglePause = async () => {
    if (!status) return;
    try {
      const res = await fetch('http://localhost:3000/api/monitor/pause', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paused: !status.isPaused })
      });
      
      if (res.ok) {
        const data = await res.json();
        setStatus(prev => prev ? { ...prev, isPaused: data.isPaused } : null);
      }
    } catch (err) {
      console.error('Error toggling pause:', err);
    }
  };

  return {
    status,
    stats,
    exploits,
    isLoading,
    error,
    togglePause,
    refresh: fetchData
  };
}
