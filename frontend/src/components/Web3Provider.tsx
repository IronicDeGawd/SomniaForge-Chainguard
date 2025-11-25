
import '@rainbow-me/rainbowkit/styles.css';
import {
    getDefaultConfig,
    RainbowKitProvider,
} from '@rainbow-me/rainbowkit';
import { WagmiProvider } from 'wagmi';
import {
    QueryClientProvider,
    QueryClient,
} from "@tanstack/react-query";
import { defineChain } from 'viem';

const somniaTestnet = defineChain({
    id: 50312,
    name: 'Somnia Testnet',
    network: 'somnia-testnet',
    nativeCurrency: {
        decimals: 18,
        name: 'STT',
        symbol: 'STT',
    },
    rpcUrls: {
        default: { http: ['https://dream-rpc.somnia.network'] },
        public: { http: ['https://dream-rpc.somnia.network'] },
    },
    blockExplorers: {
        default: { name: 'Somnia Explorer', url: 'https://shannon-explorer.somnia.network' },
    },
    testnet: true,
});

const somniaMainnet = defineChain({
    id: 5031,
    name: 'Somnia Mainnet',
    network: 'somnia-mainnet',
    nativeCurrency: {
        decimals: 18,
        name: 'STT',
        symbol: 'STT',
    },
    rpcUrls: {
        default: { http: ['https://api.infra.mainnet.somnia.network'] },
        public: { http: ['https://api.infra.mainnet.somnia.network'] },
    },
    blockExplorers: {
        default: { name: 'Somnia Explorer', url: 'https://explorer.somnia.network' },
    },
    testnet: false,
});

const config = getDefaultConfig({
    appName: 'ChainGuard',
    projectId: 'YOUR_PROJECT_ID', // TODO: Get a project ID from WalletConnect
    chains: [somniaTestnet, somniaMainnet],
    ssr: false,
});

const queryClient = new QueryClient();

export function Web3Provider({ children }: { children: React.ReactNode }) {
    return (
        <WagmiProvider config={config}>
            <QueryClientProvider client={queryClient}>
                <RainbowKitProvider>
                    {children}
                </RainbowKitProvider>
            </QueryClientProvider>
        </WagmiProvider>
    );
}
