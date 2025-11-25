import { Home, Search, Globe, AlertTriangle, Shield } from 'lucide-react';
import { NavLink } from './NavLink';
import { cn } from '@/lib/utils';

const navigation = [
  { name: 'Dashboard', href: '/', icon: Home },
  { name: 'Monitor', href: '/monitor', icon: Search },
  { name: 'Scanner', href: '/scanner', icon: Globe },
  { name: 'Alerts', href: '/alerts', icon: AlertTriangle },
];

export const Sidebar = () => {
  return (
    <aside className="w-20 bg-sidebar flex flex-col items-center py-8 gap-8">
      {/* Logo */}
      <div className="flex items-center justify-center w-12 h-12 rounded-xl border-2 border-sidebar-foreground/10">
        <Shield className="w-6 h-6 text-sidebar-foreground/80" strokeWidth={1.5} />
      </div>

      {/* Navigation */}
      <nav className="flex-1 flex flex-col gap-3 w-full px-3">
        {navigation.map((item) => (
          <NavLink
            key={item.name}
            to={item.href}
            end
            className="flex items-center justify-center w-full h-12 rounded-xl text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 transition-all duration-200 group relative"
            activeClassName="text-sidebar-foreground bg-sidebar-accent"
          >
            <item.icon className="w-5 h-5" strokeWidth={1.5} />
            <span className="sr-only">{item.name}</span>
            
            {/* Tooltip */}
            <span className="absolute left-full ml-3 px-3 py-1.5 bg-sidebar-accent text-sidebar-foreground text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 shadow-lg">
              {item.name}
            </span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
};
