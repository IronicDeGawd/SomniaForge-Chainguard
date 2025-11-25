import { useState } from 'react';
import { Plus, AlertCircle, CheckCircle, AlertTriangle, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ContractAddress } from '@/components/ContractAddress';
import { Contract } from '@/types';
import { toast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useSignMessage } from 'wagmi';
import { api } from '@/lib/api';
import { useEffect } from 'react';

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

export default function Monitor() {
  const [newAddress, setNewAddress] = useState('');
  const [newName, setNewName] = useState('');
  const [network, setNetwork] = useState('testnet');
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const queryClient = useQueryClient();

  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // Check login status on load
  useEffect(() => {
    const storedAddress = localStorage.getItem('auth_address');
    const storedSignature = localStorage.getItem('auth_signature');
    const storedTimestamp = localStorage.getItem('auth_timestamp');

    if (isConnected && address && storedAddress === address && storedSignature && storedTimestamp) {
      // Check if timestamp is valid (within 5 mins) - actually backend checks this for requests, 
      // but for session persistence we might want longer or just re-sign.
      // For this demo, we'll assume session is valid if present and address matches.
      setIsLoggedIn(true);
    } else {
      setIsLoggedIn(false);
    }
  }, [isConnected, address]);

  const handleLogin = async () => {
    try {
      if (!address) return;

      const timestamp = Date.now().toString();
      const message = `Login to ChainGuard: ${timestamp}`;

      const signature = await signMessageAsync({
        message,
        account: address
      });

      localStorage.setItem('auth_address', address);
      localStorage.setItem('auth_signature', signature);
      localStorage.setItem('auth_timestamp', timestamp);

      setIsLoggedIn(true);
      toast({ title: 'Logged In', description: 'You can now manage your contracts.' });
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
    } catch (error) {
      console.error('Login failed:', error);
      toast({ title: 'Login Failed', description: 'Please sign the message to login.', variant: 'destructive' });
    }
  };

  // Fetch contracts
  const { data: contracts = [], isLoading } = useQuery<Contract[]>({
    queryKey: ['contracts', isLoggedIn, address], // Refetch on login/address change
    queryFn: async () => {
      // If not logged in, we might still want to show public contracts? 
      // Or just return empty if we want strict privacy.
      // The backend returns public + user contracts.
      return api.get('/api/contracts');
    },
    refetchInterval: 5000,
  });

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

  const getStatusIcon = (status: Contract['status']) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="w-5 h-5 text-success" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-warning" />;
      case 'critical':
        return <AlertCircle className="w-5 h-5 text-destructive" />;
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
    }
  };

  return (
    <div className="space-y-6">
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
              ) : !isLoggedIn ? (
                <Button
                  onClick={handleLogin}
                  className="w-full"
                >
                  Sign in to Add
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
                      <span className="font-medium font-mono">{contract.avgGas.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Last Activity</span>
                      <span className="text-xs">
                        {formatDistanceToNow(contract.lastActivity, { addSuffix: true })}
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
                    <div className="text-2xl font-bold font-mono">{selectedContract.avgGas.toLocaleString()}</div>
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
                            {formatDistanceToNow(new Date(alert.createdAt), { addSuffix: true })}
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
    </div>
  );
}
