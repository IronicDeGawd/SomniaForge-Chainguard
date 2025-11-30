import { useState } from 'react';
import { Plus, AlertCircle, CheckCircle, AlertTriangle, Trash2, Clock, XCircle, Radio, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ContractAddress } from '@/components/ContractAddress';
import { Contract } from '@/types';
import { toast } from '@/hooks/use-toast';
import { cn, formatGas } from '@/lib/utils';
import { formatRelativeTime } from '@/utils/typeUtils';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';
import { api } from '@/lib/api';
import { useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { logger } from '@/utils/logger';
import { useAuth } from '@/contexts/AuthContext';
import { useSecurityAlerts } from '@/hooks/useSecurityAlerts';
import { parseContractText, ParsedContract } from '@/utils/contractParser';
import { BulkAddModal } from '@/components/dashboard/BulkAddModal';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function Dashboard() {
  const [newAddress, setNewAddress] = useState('');
  const [newName, setNewName] = useState('');
  const [network, setNetwork] = useState('testnet');
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [bulkContracts, setBulkContracts] = useState<ParsedContract[]>([]);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const queryClient = useQueryClient();

  const { address, isConnected } = useAccount();
  const { isAuthenticated, login, isLoading: authLoading } = useAuth();
  const { alerts: liveAlerts, isConnected: isSDSConnected, dismissAlert } = useSecurityAlerts();
  const [socketAlerts, setSocketAlerts] = useState<any[]>([]);

  // Fetch contracts
  const { data: contracts = [], isLoading } = useQuery<Contract[]>({
    queryKey: ['contracts', isAuthenticated, address],
    queryFn: async () => {
      const response = await api.get('/api/contracts');
      // Handle paginated response
      return response.data || response;
    },
    refetchInterval: 5000,
    enabled: isAuthenticated && !!address,
  });

  // Real-time updates
  useEffect(() => {
    const socket = io(API_URL);

    socket.on('connect', () => {
      logger.debug('Dashboard socket connected:', socket.id);
    });

    socket.on('contract_update', (updatedContract: Contract) => {
      logger.debug('Received contract_update:', updatedContract);
      queryClient.setQueryData(['contracts', isAuthenticated, address], (oldData: Contract[] | undefined) => {
        if (!oldData) return [updatedContract];
        return oldData.map(c => c.address === updatedContract.address ? updatedContract : c);
      });

      // Also update selected contract if it's the one being viewed
      if (selectedContract?.address === updatedContract.address) {
        setSelectedContract(updatedContract);
      }
    });

    socket.on('transaction', (data) => {
      console.log('Received transaction event:', data);
    });

    socket.on('new_findings', (data) => {
      console.log('Received new_findings event:', data);
      // Manually add to alerts list for immediate feedback
      const newAlerts = data.findings.map((f: any) => ({
        timestamp: new Date(data.timestamp).getTime(),
        contractAddress: data.contractAddress,
        txHash: data.txHash,
        alertType: f.type,
        severity: f.severity,
        description: f.description,
        value: '0',
        gasUsed: '0',
        confidence: 0
      }));
      setSocketAlerts(prev => [...newAlerts, ...prev]);
    });

    return () => {
      socket.disconnect();
    };
  }, [queryClient, isAuthenticated, address, selectedContract]);

  // Merge socket alerts with SDS alerts (deduplicated by txHash + type)
  const allAlerts = [...socketAlerts, ...liveAlerts].filter((alert, index, self) =>
    index === self.findIndex((t) => (
      t.txHash === alert.txHash && t.alertType === alert.alertType
    ))
  ).sort((a, b) => b.timestamp - a.timestamp);

  // Add contract mutation
  const addContractMutation = useMutation({
    mutationFn: async (data: { address: string; name?: string; network: string }) => {
      return api.post('/api/contracts', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      setNewAddress('');
      setNewName('');
      setNetwork('testnet');
      toast({
        title: 'Contract Added',
        description: 'Contract is now being monitored',
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

  // Remove contract mutation
  const removeContractMutation = useMutation({
    mutationFn: async (address: string) => {
      return api.delete(`/api/contracts/${address}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      toast({
        title: 'Contract Removed',
        description: 'Contract has been removed from monitoring',
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

  const handleAddContract = () => {
    if (!newAddress) {
      toast({
        title: 'Error',
        description: 'Please enter a contract address',
        variant: 'destructive',
      });
      return;
    }

    if (!newAddress.startsWith('0x') || newAddress.length !== 42) {
      toast({
        title: 'Invalid Address',
        description: 'Please enter a valid Ethereum address',
        variant: 'destructive',
      });
      return;
    }

    addContractMutation.mutate({ address: newAddress, name: newName, network });
  };

  const handleRemoveContract = (address: string) => {
    if (confirm('Are you sure you want to stop monitoring this contract?')) {
      removeContractMutation.mutate(address);
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData('text');
    const parsed = parseContractText(text);

    if (parsed.length === 0) return;

    e.preventDefault();

    if (parsed.length === 1) {
      // Single contract - auto fill
      setNewName(parsed[0].name);
      setNewAddress(parsed[0].address);
      toast({
        title: 'Smart Paste',
        description: 'Contract details auto-filled from clipboard',
      });
    } else {
      // Multiple contracts - open bulk modal
      setBulkContracts(parsed);
      setIsBulkModalOpen(true);
    }
  };

  const handleBulkConfirm = (contracts: ParsedContract[]) => {
    contracts.forEach(contract => {
      addContractMutation.mutate({
        address: contract.address,
        name: contract.name,
        network
      });
    });
    setBulkContracts([]);
  };

  const getStatusIcon = (status: Contract['status']) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="w-5 h-5 text-success" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-warning" />;
      case 'critical':
        return <AlertCircle className="w-5 h-5 text-destructive" />;
      case 'pending':
        return <Clock className="w-5 h-5 text-muted-foreground" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-destructive" />;
      default:
        return <AlertTriangle className="w-5 h-5 text-warning" />;
    }
  };

  const getStatusColor = (status: Contract['status']) => {
    switch (status) {
      case 'healthy':
        return 'border-l-success';
      case 'warning':
        return 'border-l-warning';
      case 'critical':
        return 'border-l-destructive';
      case 'pending':
        return 'border-l-muted';
      case 'error':
        return 'border-l-destructive';
      default:
        return 'border-l-warning';
    }
  };

  return (
    <div className="space-y-6">
      {/* Live Security Feed */}
      <Card className="border-l-4 border-l-primary">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Radio className={cn("w-5 h-5", isSDSConnected ? "text-green-500 animate-pulse" : "text-muted-foreground")} />
            Live Security Feed (SDS)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {allAlerts.length > 0 ? (
            <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
              {allAlerts.map((alert, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg text-sm hover:bg-muted transition-colors group">
                  <div className="flex items-center gap-3">
                    <Badge variant={alert.severity === 'CRITICAL' ? 'destructive' : 'default'} className={cn(alert.severity === 'HIGH' && "bg-orange-500 hover:bg-orange-600")}>
                      {alert.severity}
                    </Badge>
                    <div className="flex flex-col">
                      <span className="font-medium">{alert.alertType}</span>
                      <div className="flex flex-col gap-1 text-xs text-muted-foreground mt-1">
                        <div className="flex items-center gap-1">
                          <span className="font-semibold">Contract:</span>
                          <ContractAddress address={alert.contractAddress} className="text-xs" />
                        </div>
                        {alert.txHash && alert.txHash !== '0x0000000000000000000000000000000000000000000000000000000000000000' && (
                          <div className="flex items-center gap-1">
                            <span className="font-semibold">Tx:</span>
                            <a
                              href={`https://shannon-explorer.somnia.network/tx/${alert.txHash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:text-primary flex items-center gap-1 transition-colors"
                            >
                              {alert.txHash.slice(0, 6)}...{alert.txHash.slice(-4)}
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <span className="text-xs text-muted-foreground block">
                        {formatRelativeTime(Number(alert.timestamp))}
                      </span>
                      <span className="text-xs font-mono text-muted-foreground">
                        Conf: {alert.confidence}%
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-6 h-6 opacity-0 group-hover:opacity-100 transition-opacity hover:text-destructive"
                      onClick={() => dismissAlert(alert.txHash)}
                      title="Dismiss alert"
                    >
                      <XCircle className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Radio className="w-8 h-8 mb-2 opacity-20" />
              <p className="text-sm">Waiting for security events...</p>
              {!isSDSConnected && <p className="text-xs mt-1 text-yellow-500">Connecting to SDS...</p>}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Contract Form */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base font-geist">Add Contract to Monitor</CardTitle>
          <ConnectButton />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-1">
              <Label htmlFor="address">Contract Address *</Label>
              <Input
                id="address"
                placeholder="0x..."
                value={newAddress}
                onChange={(e) => setNewAddress(e.target.value)}
                onPaste={handlePaste}
                className="font-mono"
              />
            </div>
            <div className="md:col-span-1">
              <Label htmlFor="name">Contract Name (Optional)</Label>
              <Input
                id="name"
                placeholder="My Contract"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
            <div className="md:col-span-1">
              <Label htmlFor="network">Network</Label>
              <Select value={network} onValueChange={setNetwork}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="testnet">Somnia Testnet</SelectItem>
                  <SelectItem value="mainnet">Somnia Mainnet</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              {!isConnected ? (
                <div className="w-full flex items-center justify-center h-10 border rounded-md bg-muted/50 text-sm text-muted-foreground">
                  Connect Wallet to Add
                </div>
              ) : !isAuthenticated ? (
                <Button
                  onClick={login}
                  disabled={authLoading}
                  className="w-full"
                >
                  {authLoading ? 'Signing in...' : 'Sign in to Add'}
                </Button>
              ) : (
                <Button
                  onClick={handleAddContract}
                  className="w-full bg-foreground text-background hover:bg-foreground/90"
                  disabled={addContractMutation.isPending}
                >
                  {addContractMutation.isPending ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-background mr-2"></div>
                  ) : (
                    <Plus className="w-4 h-4 mr-2" />
                  )}
                  Add Contract
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Monitored Contracts */}
      <div>
        {/* ... (existing header and loading/empty states) */}

        {/* Contract List */}
        {!isLoading && contracts.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {contracts.map((contract) => (
              <Card
                key={contract.address}
                className={cn(
                  'hover:shadow-md transition-all duration-200 border-l-4',
                  getStatusColor(contract.status)
                )}
              >
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(contract.status)}
                      <Badge variant="outline" className="text-xs capitalize">
                        {contract.status}
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        {contract.network === 'mainnet' ? 'Mainnet' : 'Testnet'}
                      </Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-8 h-8 hover:text-destructive"
                      onClick={() => handleRemoveContract(contract.address)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>

                  <h3 className="font-semibold mb-2">
                    {contract.name || 'Unnamed Contract'}
                  </h3>

                  <ContractAddress
                    address={contract.address}
                    network={contract.network}
                    showExplorer
                    className="mb-4"
                  />

                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total Txs</span>
                      <span className="font-medium">{contract.totalTxs.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Failed Txs</span>
                      <span className="font-medium text-destructive">{contract.failedTxs}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Avg Gas</span>
                      <span className="font-medium font-mono">{formatGas(contract.avgGas)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Last Activity</span>
                      <span className="text-xs">
                        {formatRelativeTime(contract.lastActivity, 'Never')}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-border">
                    {(contract.findings?.length || 0) > 0 && (
                      <p className="text-xs text-muted-foreground mb-2">
                        {contract.findings?.length || 0} finding(s) detected
                      </p>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => setSelectedContract(contract)}
                    >
                      View Details
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Contract Details Modal */}
      <Dialog open={!!selectedContract} onOpenChange={(open) => !open && setSelectedContract(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedContract?.name || 'Contract Details'}
              {selectedContract && (
                <Badge variant="outline" className="ml-2">
                  {selectedContract.network}
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription>
              <ContractAddress
                address={selectedContract?.address || ''}
                network={selectedContract?.network}
                showCopy
                showExplorer
              />
            </DialogDescription>
          </DialogHeader>

          {selectedContract && (
            <div className="space-y-6">
              {/* Stats Grid */}
              <div className="grid grid-cols-3 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold">{selectedContract.totalTxs}</div>
                    <p className="text-xs text-muted-foreground">Total Transactions</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold text-destructive">{selectedContract.failedTxs}</div>
                    <p className="text-xs text-muted-foreground">Failed Transactions</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold font-mono">{formatGas(selectedContract.avgGas)}</div>
                    <p className="text-xs text-muted-foreground">Avg Gas Usage</p>
                  </CardContent>
                </Card>
              </div>

              {/* Findings Section */}
              <div>
                <h3 className="text-lg font-semibold mb-3">Vulnerability Findings</h3>
                {selectedContract.findings && selectedContract.findings.length > 0 ? (
                  <div className="space-y-3">
                    {selectedContract.findings.map((finding: any) => (
                      <Card key={finding.id} className="border-l-4 border-l-destructive">
                        <CardContent className="p-4">
                          <div className="flex justify-between items-start mb-2">
                            <h4 className="font-medium">{finding.type}</h4>
                            <Badge variant="destructive">{finding.severity}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">
                            {finding.description || 'Potential vulnerability detected'}
                          </p>
                          {finding.codeSnippet && (
                            <pre className="bg-muted p-2 rounded text-xs overflow-x-auto">
                              {finding.codeSnippet}
                            </pre>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center p-8 border rounded-lg bg-muted/20">
                    <CheckCircle className="w-8 h-8 text-success mx-auto mb-2" />
                    <p className="text-muted-foreground">No vulnerabilities detected</p>
                  </div>
                )}
              </div>

              {/* Recent Alerts Section */}
              <div>
                <h3 className="text-lg font-semibold mb-3">Recent Alerts</h3>
                {selectedContract.alerts && selectedContract.alerts.length > 0 ? (
                  <div className="space-y-3">
                    {selectedContract.alerts.map((alert: any) => (
                      <div key={alert.id} className="flex items-start gap-3 p-3 border rounded-lg">
                        <AlertTriangle className={cn(
                          "w-5 h-5 mt-0.5",
                          alert.severity === 'CRITICAL' ? "text-destructive" : "text-warning"
                        )} />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{alert.type}</span>
                            <Badge variant="outline" className="text-xs">{alert.severity}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">{alert.description}</p>
                          <p className="text-xs text-muted-foreground mt-2">
                            {formatRelativeTime(alert.createdAt)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No recent alerts</p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <BulkAddModal
        isOpen={isBulkModalOpen}
        onClose={() => setIsBulkModalOpen(false)}
        contracts={bulkContracts}
        onConfirm={handleBulkConfirm}
      />
    </div>
  );
}
