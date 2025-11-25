import { useState, useEffect } from 'react';
import { Zap, AlertTriangle, TrendingUp, Activity } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ContractAddress } from '@/components/ContractAddress';
import { mockExploits, mockContracts } from '@/lib/mockData';
import { NetworkExploit } from '@/types';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

export default function Scanner() {
  const [isScanning, setIsScanning] = useState(true);
  const [scannedCount, setScannedCount] = useState(12487);
  const [exploits] = useState<NetworkExploit[]>(mockExploits);

  useEffect(() => {
    if (!isScanning) return;

    const interval = setInterval(() => {
      setScannedCount(prev => prev + Math.floor(Math.random() * 5) + 1);
    }, 2000);

    return () => clearInterval(interval);
  }, [isScanning]);

  return (
    <div className="space-y-6">
      {/* Scanner Status */}
      <Card className="bg-gradient-to-br from-sidebar to-sidebar-accent text-sidebar-foreground">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <div className={cn(
                  'w-3 h-3 rounded-full',
                  isScanning ? 'bg-success pulse-dot' : 'bg-muted-foreground'
                )} />
                <h2 className="text-lg font-geist font-semibold">
                  {isScanning ? 'Network Scanner Active' : 'Scanner Paused'}
                </h2>
              </div>
              
              <div className="grid grid-cols-3 gap-6 mt-4">
                <div>
                  <p className="text-sm text-sidebar-foreground/60 mb-1">Contracts Scanned</p>
                  <p className="text-2xl font-geist font-bold">{scannedCount.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-sm text-sidebar-foreground/60 mb-1">Exploits Detected</p>
                  <p className="text-2xl font-geist font-bold text-destructive">{exploits.length}</p>
                </div>
                <div>
                  <p className="text-sm text-sidebar-foreground/60 mb-1">Suspicious Patterns</p>
                  <p className="text-2xl font-geist font-bold text-warning">24</p>
                </div>
              </div>
            </div>

            <Button
              variant={isScanning ? 'secondary' : 'default'}
              onClick={() => setIsScanning(!isScanning)}
              className="ml-6"
            >
              {isScanning ? 'Pause Scanning' : 'Resume Scanning'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Network Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Transactions', value: '124.5K', icon: Activity },
          { label: 'Flash Loans', value: '42', icon: Zap },
          { label: 'Reentrancy Attempts', value: '18', icon: AlertTriangle },
          { label: 'Suspicious Patterns', value: '24', icon: TrendingUp },
        ].map((stat, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                  <stat.icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="text-xl font-geist font-bold">{stat.value}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Exploit Alerts */}
      <div>
        <h2 className="text-lg font-geist font-semibold mb-4">
          Detected Exploits
        </h2>

        <div className="space-y-4">
          {exploits.map((exploit) => (
            <Card
              key={exploit.id}
              className="border-l-4 border-l-destructive hover:shadow-lg transition-all duration-200"
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <Badge className="bg-destructive text-destructive-foreground hover:bg-destructive">
                      CRITICAL
                    </Badge>
                    <h3 className="font-geist font-semibold text-lg">{exploit.type}</h3>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {formatDistanceToNow(exploit.timestamp, { addSuffix: true })}
                  </span>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Exploited Contract:</span>
                    <ContractAddress address={exploit.exploitedContract} showExplorer />
                  </div>

                  {exploit.valueLost && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Value Lost:</span>
                      <span className="text-lg font-semibold text-destructive">
                        {exploit.valueLost}
                      </span>
                    </div>
                  )}

                  <div className="p-4 rounded-lg bg-muted/50">
                    <p className="text-sm font-medium mb-1">Attack Pattern</p>
                    <p className="text-sm text-muted-foreground">{exploit.pattern}</p>
                  </div>

                  {exploit.similarContracts.length > 0 && (
                    <Card className="bg-warning/10 border-warning">
                      <CardHeader>
                        <CardTitle className="text-sm font-geist flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-warning" />
                          Warning: Similar Contracts Detected
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground mb-3">
                          The following contracts in your monitoring list share similar patterns:
                        </p>
                        <div className="space-y-2">
                          {exploit.similarContracts.map((address) => {
                            const contract = mockContracts.find(c => c.address === address);
                            return (
                              <div
                                key={address}
                                className="flex items-center justify-between p-3 rounded-lg bg-card"
                              >
                                <div>
                                  <p className="font-medium text-sm mb-1">
                                    {contract?.name || 'Unknown Contract'}
                                  </p>
                                  <ContractAddress address={address} />
                                </div>
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="text-warning border-warning">
                                    85% Similar
                                  </Badge>
                                  <Button size="sm" variant="default">
                                    Audit Now
                                  </Button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  <div className="flex gap-2 pt-2">
                    <Button variant="default">View Pattern Details</Button>
                    <Button variant="outline">Check My Contracts</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
