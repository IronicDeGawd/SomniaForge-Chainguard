import { useState } from 'react';
import { Plus, AlertCircle, CheckCircle, AlertTriangle, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ContractAddress } from '@/components/ContractAddress';
import { mockContracts } from '@/lib/mockData';
import { Contract } from '@/types';
import { toast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

export default function Monitor() {
  const [contracts, setContracts] = useState<Contract[]>(mockContracts);
  const [newAddress, setNewAddress] = useState('');
  const [newName, setNewName] = useState('');

  const handleAddContract = () => {
    if (!newAddress) {
      toast({
        title: 'Error',
        description: 'Please enter a contract address',
        variant: 'destructive',
      });
      return;
    }

    // Basic validation
    if (!newAddress.startsWith('0x') || newAddress.length !== 42) {
      toast({
        title: 'Invalid Address',
        description: 'Please enter a valid Ethereum address',
        variant: 'destructive',
      });
      return;
    }

    const newContract: Contract = {
      address: newAddress,
      name: newName || undefined,
      status: 'healthy',
      totalTxs: 0,
      failedTxs: 0,
      avgGas: 0,
      lastActivity: Date.now(),
      findings: [],
    };

    setContracts([...contracts, newContract]);
    setNewAddress('');
    setNewName('');

    toast({
      title: 'Contract Added',
      description: 'Contract is now being monitored',
    });
  };

  const handleRemoveContract = (address: string) => {
    setContracts(contracts.filter(c => c.address !== address));
    toast({
      title: 'Contract Removed',
      description: 'Contract has been removed from monitoring',
    });
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
        <CardHeader>
          <CardTitle className="text-base font-geist">Add Contract to Monitor</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
            <div className="flex items-end">
              <Button onClick={handleAddContract} className="w-full bg-foreground text-background hover:bg-foreground/90">
                <Plus className="w-4 h-4 mr-2" />
                Add Contract
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Monitored Contracts */}
      <div>
        <h2 className="text-lg font-geist font-semibold mb-4">
          Monitored Contracts ({contracts.length})
        </h2>
        
        {contracts.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-4">
                <AlertCircle className="w-10 h-10 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No Contracts Yet</h3>
              <p className="text-muted-foreground text-center max-w-md">
                Add your first contract above to start monitoring for security vulnerabilities and suspicious activity.
              </p>
            </CardContent>
          </Card>
        ) : (
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

                  {contract.findings.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-border">
                      <p className="text-xs text-muted-foreground mb-2">
                        {contract.findings.length} finding(s) detected
                      </p>
                      <Button variant="outline" size="sm" className="w-full">
                        View Details
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
