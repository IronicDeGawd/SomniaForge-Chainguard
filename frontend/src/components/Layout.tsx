import { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

interface LayoutProps {
  children: ReactNode;
}

export const Layout = ({ children }: LayoutProps) => {
  return (
    <div className="flex h-screen w-full bg-sidebar overflow-hidden">
      <Sidebar />
      <div className="flex-1 p-3 md:p-4 flex flex-col">
        <div className="flex-1 bg-card rounded-3xl overflow-hidden flex flex-col shadow-xl">
          <Header />
          <main className="flex-1 p-6 md:p-8 overflow-y-auto">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
};
