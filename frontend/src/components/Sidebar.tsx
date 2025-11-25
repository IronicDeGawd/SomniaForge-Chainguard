import { Home, Search, Globe, AlertTriangle, Shield, Zap, Wallet } from 'lucide-react';
import { NavLink } from './NavLink';
import { cn } from '@/lib/utils';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Link } from 'react-router-dom';
import { useAccount } from 'wagmi';

interface SidebarProps {
  isLandingPage?: boolean;
}

export const Sidebar = ({ isLandingPage }: SidebarProps) => {
  const { isConnected } = useAccount();

  const navigation = [
    ...(isLandingPage ? [{ name: 'Home', href: '/', icon: Zap }] : []),
    { name: 'Dashboard', href: '/dashboard', icon: Home },
    { name: 'Monitor', href: '/monitor', icon: Search },
    { name: 'Scanner', href: '/scanner', icon: Globe },
    { name: 'Alerts', href: '/alerts', icon: AlertTriangle },
  ];

  return (
    <aside className="w-20 bg-sidebar flex flex-col items-center py-8 gap-8">
      {/* Logo */}
      <Link to="/" className="flex items-center justify-center w-12 h-12 rounded-xl border-2 border-sidebar-foreground/10 hover:border-sidebar-foreground/30 transition-colors">
        <Shield className="w-6 h-6 text-sidebar-foreground/80" strokeWidth={1.5} />
      </Link>

      {/* Navigation */}
      <nav className="flex-1 flex flex-col gap-3 w-full px-3">
        {navigation.map((item) => {
          const isDisabled = isLandingPage && !isConnected && item.href !== '/';
          return (
            <NavLink
              key={item.name}
              to={item.href}
              end
              className={cn(
                "flex items-center justify-center w-full h-12 rounded-xl text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 transition-all duration-200 group relative",
                isDisabled && "pointer-events-none opacity-50"
              )}
              activeClassName="text-sidebar-foreground bg-sidebar-accent"
              onClick={(e) => isDisabled && e.preventDefault()}
            >
              <item.icon className="w-5 h-5" strokeWidth={1.5} />
              <span className="sr-only">{item.name}</span>

              {/* Tooltip */}
              <span className="absolute left-full ml-3 px-3 py-1.5 bg-sidebar-accent text-sidebar-foreground text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 shadow-lg">
                {isDisabled ? "Connect Wallet" : item.name}
              </span>
            </NavLink>
          );
        })}
      </nav>

      {/* Wallet Connect Button */}
      {isLandingPage && (
        <div className="px-2">
          <ConnectButton.Custom>
            {({ openConnectModal, mounted }) => {
              if (!mounted) return null;
              return (
                <button
                  onClick={openConnectModal}
                  className="w-12 h-12 rounded-xl bg-primary/10 hover:bg-primary/20 flex items-center justify-center transition-colors group relative"
                >
                  <Wallet className="w-5 h-5 text-primary" />
                  <span className="absolute left-full ml-3 px-3 py-1.5 bg-sidebar-accent text-sidebar-foreground text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 shadow-lg">
                    Connect Wallet
                  </span>
                </button>
              );
            }}
          </ConnectButton.Custom>
        </div>
      )}
    </aside>
  );
};
