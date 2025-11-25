
import { useEffect, useState } from 'react';
import { useAccount, useChainId, useSwitchChain, useSignMessage } from 'wagmi';
import { Navigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, Wallet, Lock } from 'lucide-react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useToast } from '@/components/ui/use-toast';

export function RequireAuth({ children }: { children: React.ReactNode }) {
    const { isConnected, address } = useAccount();
    const chainId = useChainId();
    const { switchChain } = useSwitchChain();
    const { signMessageAsync } = useSignMessage();
    const { toast } = useToast();
    const location = useLocation();

    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [isChecking, setIsChecking] = useState(true);

    // Somnia Testnet ID
    const REQUIRED_CHAIN_ID = 50312;

    useEffect(() => {
        const checkAuth = () => {
            const storedAddress = localStorage.getItem('auth_address');
            const storedSignature = localStorage.getItem('auth_signature');

            if (isConnected && address && storedAddress === address && storedSignature) {
                setIsLoggedIn(true);
            } else {
                setIsLoggedIn(false);
            }
            setIsChecking(false);
        };

        checkAuth();
    }, [isConnected, address]);

    // Auto-logout on disconnect
    useEffect(() => {
        if (!isConnected) {
            localStorage.removeItem('auth_address');
            localStorage.removeItem('auth_signature');
            localStorage.removeItem('auth_timestamp');
            setIsLoggedIn(false);
        }
    }, [isConnected]);

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
            toast({ title: 'Logged In', description: 'Welcome back!' });
        } catch (error) {
            console.error('Login failed:', error);
            toast({ title: 'Login Failed', description: 'Please sign the message to continue.', variant: 'destructive' });
        }
    };

    if (isChecking) {
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

    // 3. Check Signature (Login)
    if (!isLoggedIn) {
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
                        <Button className="w-full" onClick={handleLogin}>
                            Sign In with Wallet
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
