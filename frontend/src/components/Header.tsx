import { Bell, Copy, LogOut } from 'lucide-react';
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
import { Link, useNavigate } from 'react-router-dom';
import { useAccount, useDisconnect } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useEffect, useRef } from 'react';

interface HeaderProps {
  isLandingPage?: boolean;
}

export const Header = ({ isLandingPage }: HeaderProps) => {
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const navigate = useNavigate();
  const prevIsConnected = useRef(isConnected);

  useEffect(() => {
    // Only redirect if we just connected (transition from false to true)
    if (isLandingPage && isConnected && !prevIsConnected.current) {
      navigate('/dashboard');
    }
    prevIsConnected.current = isConnected;
  }, [isConnected, isLandingPage, navigate]);

  const handleDisconnect = () => {
    disconnect();
    toast({
      title: 'Wallet Disconnected',
      description: 'Your wallet has been disconnected',
    });
  };

  const handleCopyAddress = () => {
    if (address) {
      navigator.clipboard.writeText(address);
      toast({
        title: 'Address Copied',
        description: 'Wallet address copied to clipboard',
      });
    }
  };

  return (
    <header className="h-16 flex items-center justify-between px-8 border-b border-border">
      <Link to="/" className="flex items-center gap-4 hover:opacity-80 transition-opacity">
        <h1 className="text-xl font-geist font-bold tracking-tight">ChainGuard</h1>
        <Badge variant="outline" className="text-xs border-border/50">
          <span className="w-1.5 h-1.5 rounded-full bg-success mr-2" />
          Somnia Network
        </Badge>
      </Link>

      <div className="flex items-center gap-2">
        {isConnected && (
          <Button variant="ghost" size="icon" className="relative hover:bg-muted/50">
            <Bell className="w-5 h-5" strokeWidth={1.5} />
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-destructive rounded-full" />
          </Button>
        )}

        <ConnectButton.Custom>
          {({
            account,
            chain,
            openAccountModal,
            openChainModal,
            openConnectModal,
            authenticationStatus,
            mounted,
          }) => {
            const ready = mounted && authenticationStatus !== 'loading';
            const connected =
              ready &&
              account &&
              chain &&
              (!authenticationStatus ||
                authenticationStatus === 'authenticated');

            return (
              <div
                {...(!ready && {
                  'aria-hidden': true,
                  'style': {
                    opacity: 0,
                    pointerEvents: 'none',
                    userSelect: 'none',
                  },
                })}
              >
                {(() => {
                  if (!connected) {
                    return (
                      <Button
                        onClick={openConnectModal}
                        className="bg-foreground text-background hover:bg-foreground/90"
                      >
                        {isLandingPage ? "Launch App" : "Connect Wallet"}
                      </Button>
                    );
                  }

                  if (chain.unsupported) {
                    return (
                      <Button onClick={openChainModal} variant="destructive">
                        Wrong network
                      </Button>
                    );
                  }

                  return (
                    <div className="flex items-center gap-2">
                      {isLandingPage && (
                        <Button
                          variant="ghost"
                          onClick={() => navigate('/dashboard')}
                          className="hidden md:flex"
                        >
                          Go to Dashboard
                        </Button>
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" className="gap-2">
                            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary to-secondary" />
                            <span className="font-mono text-sm">{account.displayName}</span>
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
                    </div>
                  );
                })()}
              </div>
            );
          }}
        </ConnectButton.Custom>
      </div>
    </header>
  );
};
