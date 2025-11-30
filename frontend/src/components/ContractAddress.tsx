import { Copy, ExternalLink } from 'lucide-react';
import { Button } from './ui/button';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface ContractAddressProps {
  address: string;
  network?: string; // 'testnet' | 'mainnet'
  showCopy?: boolean;
  showExplorer?: boolean;
  className?: string;
}

export const ContractAddress = ({
  address,
  network = 'testnet',
  showCopy = true,
  showExplorer = false,
  className
}: ContractAddressProps) => {
  const truncated = `${address.slice(0, 6)}...${address.slice(-4)}`;

  const getExplorerUrl = () => {
    if (network === 'mainnet') {
      return `https://explorer.somnia.network/address/${address}`;
    }
    return `https://shannon-explorer.somnia.network/address/${address}`;
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(address);
    toast({
      title: 'Address Copied',
      description: 'Contract address copied to clipboard',
    });
  };

  return (
    <span className={cn('inline-flex items-center gap-1', className)}>
      <code className="font-mono text-sm">{truncated}</code>
      {showCopy && (
        <Button
          variant="ghost"
          size="icon"
          className="w-7 h-7"
          onClick={handleCopy}
        >
          <Copy className="w-3 h-3" />
        </Button>
      )}
      {showExplorer && (
        <Button
          variant="ghost"
          size="icon"
          className="w-7 h-7"
          asChild
        >
          <a
            href={getExplorerUrl()}
            target="_blank"
            rel="noopener noreferrer"
          >
            <ExternalLink className="w-3 h-3" />
          </a>
        </Button>
      )}
    </span>
  );
};
