import { Copy, ExternalLink } from 'lucide-react';
import { Button } from './ui/button';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface ContractAddressProps {
  address: string;
  showCopy?: boolean;
  showExplorer?: boolean;
  className?: string;
}

export const ContractAddress = ({ 
  address, 
  showCopy = true, 
  showExplorer = false,
  className 
}: ContractAddressProps) => {
  const truncated = `${address.slice(0, 6)}...${address.slice(-4)}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(address);
    toast({
      title: 'Address Copied',
      description: 'Contract address copied to clipboard',
    });
  };

  return (
    <div className={cn('inline-flex items-center gap-1', className)}>
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
            href={`https://explorer.somnia.network/address/${address}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <ExternalLink className="w-3 h-3" />
          </a>
        </Button>
      )}
    </div>
  );
};
