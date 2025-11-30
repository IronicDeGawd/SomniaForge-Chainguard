import { useState } from 'react';
import { AlertSeverity, Alert } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SeverityBadge } from '@/components/SeverityBadge';
import { ContractAddress } from '@/components/ContractAddress';
import { formatDistanceToNow } from 'date-fns';
import { formatRelativeTime, getAlertTimestamp } from '@/utils/typeUtils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ChevronDown, ChevronRight, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSecurityAlerts } from '@/hooks/useSecurityAlerts';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export default function Alerts() {
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [expandedAlert, setExpandedAlert] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // SDS real-time subscription
  const { alerts: sdsAlerts, isConnected: isSDSConnected, error: sdsError } = useSecurityAlerts();

  const { isAuthenticated } = useAuth();

  // Fetch alerts
  const { data: alerts = [], isLoading } = useQuery<Alert[]>({
    queryKey: ['alerts'],
    queryFn: async () => {
      const response = await api.get('/api/alerts');
      // Handle paginated response
      return response.data || response;
    },
    refetchInterval: 5000,
    enabled: isAuthenticated,
  });

  // Show toast notification when new SDS alerts arrive
  useEffect(() => {
    if (sdsAlerts.length > 0) {
      const latestAlert = sdsAlerts[0];
      toast({
        title: '🚨 New Security Alert (via SDS)',
        description: `${latestAlert.severity}: ${latestAlert.description}`,
        variant: latestAlert.severity === 'CRITICAL' || latestAlert.severity === 'HIGH' ? 'destructive' : 'default',
      });
      // Refetch alerts to get the latest from the API
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
    }
  }, [sdsAlerts, queryClient]);

  // Show error toast if SDS connection fails
  useEffect(() => {
    if (sdsError) {
      toast({
        title: 'SDS Connection Error',
        description: sdsError,
        variant: 'destructive',
      });
    }
  }, [sdsError]);

  // Resolve alert mutation
  const resolveAlertMutation = useMutation({
    mutationFn: async (id: string) => {
      return api.post(`/api/alerts/${id}/resolve`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
      toast({
        title: 'Alert Resolved',
        description: 'Alert has been marked as resolved',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const filteredAlerts = alerts.filter(alert => {
    if (severityFilter !== 'all' && alert.severity !== severityFilter) return false;
    if (statusFilter === 'active' && alert.dismissed) return false;
    if (statusFilter === 'dismissed' && !alert.dismissed) return false;
    return true;
  });

  const handleMarkResolved = (id: string) => {
    resolveAlertMutation.mutate(id);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-geist font-bold">Alerts Center</h1>
          <p className="text-muted-foreground mt-1">
            Manage and review all security alerts
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isSDSConnected ? (
            <Badge variant="outline" className="gap-1.5 bg-green-500/10 text-green-600 border-green-500/20">
              <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              SDS Live
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-1.5 bg-yellow-500/10 text-yellow-600 border-yellow-500/20">
              <div className="h-2 w-2 rounded-full bg-yellow-500" />
              Connecting...
            </Badge>
          )}
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Severity:</span>
              <Select value={severityFilter} onValueChange={setSeverityFilter}>
                <SelectTrigger className="w-32">
                  <SelectValue />
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

            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Status:</span>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="dismissed">Dismissed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="ml-auto">
              <span className="text-sm text-muted-foreground">
                {filteredAlerts.length} alert(s) found
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Alerts Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12"></TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Contract</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center">
                    <div className="flex justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                  </TableCell>
                </TableRow>
              ) : filteredAlerts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                    No alerts found matching your filters.
                  </TableCell>
                </TableRow>
              ) : (
                filteredAlerts.map((alert) => (
                  <>
                    <TableRow
                      key={alert.id}
                      className={cn(
                        'cursor-pointer hover:bg-muted/50',
                        alert.dismissed && 'opacity-50'
                      )}
                      onClick={() => setExpandedAlert(
                        expandedAlert === alert.id ? null : alert.id
                      )}
                    >
                      <TableCell>
                        {expandedAlert === alert.id ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </TableCell>
                      <TableCell>
                        <SeverityBadge severity={alert.severity} />
                      </TableCell>
                      <TableCell className="font-medium">
                        {alert.type.replace('_', ' ')}
                      </TableCell>
                      <TableCell>
                        {alert.contractName ? (
                          <div>
                            <div className="font-medium">{alert.contractName}</div>
                            <ContractAddress address={alert.contractAddress} showCopy={false} />
                          </div>
                        ) : (
                          <ContractAddress address={alert.contractAddress} />
                        )}
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {alert.description}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {formatRelativeTime(getAlertTimestamp(alert))}
                      </TableCell>
                      <TableCell>
                        {alert.dismissed ? (
                          <Badge variant="outline" className="gap-1">
                            <CheckCircle className="w-3 h-3" />
                            Resolved
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-warning border-warning">
                            Active
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {!alert.dismissed && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMarkResolved(alert.id);
                            }}
                          >
                            Mark Resolved
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>

                    {/* Expanded Details */}
                    {expandedAlert === alert.id && (
                      <TableRow>
                        <TableCell colSpan={8} className="bg-muted/30">
                          <div className="p-4 space-y-4">
                            <div>
                              <h4 className="font-semibold mb-2">Full Description</h4>
                              <p className="text-sm text-muted-foreground">
                                {alert.description}
                              </p>
                            </div>

                            {alert.recommendation && (
                              <div>
                                <h4 className="font-semibold mb-2">Recommendation</h4>
                                <p className="text-sm text-muted-foreground">
                                  {alert.recommendation}
                                </p>
                              </div>
                            )}

                            {alert.txHash && (
                              <div>
                                <h4 className="font-semibold mb-2">Related Transaction</h4>
                                <code className="text-sm font-mono">{alert.txHash}</code>
                              </div>
                            )}

                            <div className="flex gap-2">
                              <Button size="sm" variant="default">
                                View in Explorer
                              </Button>
                              <Button size="sm" variant="outline">
                                Export Details
                              </Button>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
