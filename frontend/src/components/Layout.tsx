import { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

interface LayoutProps {
  children: ReactNode;
  isLandingPage?: boolean;
}

export const Layout = ({ children, isLandingPage = false }: LayoutProps) => {
  return (
    <div className="flex h-screen w-full bg-sidebar overflow-hidden p-3 md:p-4 gap-3 md:gap-4">
      <div className="bg-sidebar rounded-3xl flex flex-col">
        <Sidebar isLandingPage={isLandingPage} />
      </div>
      <div className="flex-1 flex flex-col">
        <div className="flex-1 bg-card rounded-3xl overflow-hidden flex flex-col shadow-xl">
          <Header isLandingPage={isLandingPage} />
          <main className="flex-1 p-6 md:p-8 overflow-y-auto">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
};
