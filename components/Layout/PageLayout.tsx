import React, { ReactNode } from 'react';
import { bgGradient } from '@/utils/tailwindVars';

interface LayoutProps {
  children: ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <main
      className={`mx-auto flex h-[100%] w-full flex-col items-center justify-start pb-20 pt-10`}
    >
      {children}
    </main>
  );
};

export default Layout;
