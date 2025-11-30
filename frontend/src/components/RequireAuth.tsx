
import { useAccount, useChainId, useSwitchChain } from 'wagmi';
import { Navigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, Lock } from 'lucide-react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAuth } from '@/contexts/AuthContext';

export function RequireAuth({ children }: { children: React.ReactNode }) {
    const { isConnected } = useAccount();
    const chainId = useChainId();
    const { switchChain } = useSwitchChain();
    const location = useLocation();
    const { isAuthenticated, login, isLoading } = useAuth();

    // Somnia Testnet ID
    const REQUIRED_CHAIN_ID = 50312;

    if (isLoading) {
        return <div className="flex items-center justify-center min-h-screen">Checking auth...</div>;
    }

    // 1. Check Wallet Connection
    if (!isConnected) {
        return <Navigate to="/" state={{ from: location }} replace />;
    }

    // 2. Check Network
    if (chainId !== REQUIRED_CHAIN_ID) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-background p-4">
                <Card className="w-full max-w-md border-warning">
                    <CardHeader className="text-center">
                        <div className="mx-auto w-12 h-12 bg-warning/10 rounded-full flex items-center justify-center mb-4">
                            <AlertTriangle className="w-6 h-6 text-warning" />
                        </div>
                        <CardTitle>Wrong Network</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 text-center">
                        <p className="text-muted-foreground">
                            Please switch to <strong>Somnia Testnet</strong> to use ChainGuard.
                        </p>
                        <Button
                            className="w-full"
                            onClick={() => switchChain({ chainId: REQUIRED_CHAIN_ID })}
                        >
                            Switch to Somnia Testnet
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    // 3. Check Authentication
    if (!isAuthenticated) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-background p-4">
                <Card className="w-full max-w-md">
                    <CardHeader className="text-center">
                        <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                            <Lock className="w-6 h-6 text-primary" />
                        </div>
                        <CardTitle>Authentication Required</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 text-center">
                        <p className="text-muted-foreground">
                            Please sign a message to verify your wallet ownership and access your dashboard.
                        </p>
                        <Button className="w-full" onClick={login} disabled={isLoading}>
                            {isLoading ? 'Signing in...' : 'Sign In with Wallet'}
                        </Button>
                        <div className="pt-4 border-t">
                            <p className="text-xs text-muted-foreground mb-2">Connected as:</p>
                            <ConnectButton showBalance={false} />
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return <>{children}</>;
}
