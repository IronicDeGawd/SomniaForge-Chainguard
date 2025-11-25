import { useState } from 'react';
import { AlertSeverity, Alert } from '@/types';
import { mockAlerts } from '@/lib/mockData';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SeverityBadge } from '@/components/SeverityBadge';
import { ContractAddress } from '@/components/ContractAddress';
import { formatDistanceToNow } from 'date-fns';
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

export default function Alerts() {
  const [alerts, setAlerts] = useState<Alert[]>(mockAlerts);
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [expandedAlert, setExpandedAlert] = useState<string | null>(null);

  const filteredAlerts = alerts.filter(alert => {
    if (severityFilter !== 'all' && alert.severity !== severityFilter) return false;
    if (statusFilter === 'active' && alert.dismissed) return false;
    if (statusFilter === 'dismissed' && !alert.dismissed) return false;
    return true;
  });

  const handleMarkResolved = (id: string) => {
    setAlerts(alerts.map(alert =>
      alert.id === id ? { ...alert, dismissed: true } : alert
    ));
    toast({
      title: 'Alert Resolved',
      description: 'Alert has been marked as resolved',
    });
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
              {filteredAlerts.map((alert) => (
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
                      {formatDistanceToNow(alert.timestamp, { addSuffix: true })}
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
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
