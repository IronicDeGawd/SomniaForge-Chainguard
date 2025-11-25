import { useState } from 'react';
import { Bell, Copy, LogOut, User } from 'lucide-react';
import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { Badge } from './ui/badge';
import { toast } from '@/hooks/use-toast';

export const Header = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [address] = useState('0x742d...5f0bEb');

  const handleConnect = () => {
    setIsConnected(true);
    toast({
      title: 'Wallet Connected',
      description: 'Successfully connected to MetaMask',
    });
  };

  const handleDisconnect = () => {
    setIsConnected(false);
    toast({
      title: 'Wallet Disconnected',
      description: 'Your wallet has been disconnected',
    });
  };

  const handleCopyAddress = () => {
    navigator.clipboard.writeText('0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb');
    toast({
      title: 'Address Copied',
      description: 'Wallet address copied to clipboard',
    });
  };

  return (
    <header className="h-16 flex items-center justify-between px-8 border-b border-border">
      <div className="flex items-center gap-4">
        <h1 className="text-xl font-geist font-bold tracking-tight">ChainGuard</h1>
        <Badge variant="outline" className="text-xs border-border/50">
          <span className="w-1.5 h-1.5 rounded-full bg-success mr-2" />
          Ethereum Mainnet
        </Badge>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="relative hover:bg-muted/50">
          <Bell className="w-5 h-5" strokeWidth={1.5} />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-destructive rounded-full" />
        </Button>

        {isConnected ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary to-secondary" />
                <span className="font-mono text-sm">{address}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={handleCopyAddress}>
                <Copy className="w-4 h-4 mr-2" />
                Copy Address
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleDisconnect}>
                <LogOut className="w-4 h-4 mr-2" />
                Disconnect
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Button onClick={handleConnect} className="bg-foreground text-background hover:bg-foreground/90">
            Connect Wallet
          </Button>
        )}
      </div>
    </header>
  );
};
