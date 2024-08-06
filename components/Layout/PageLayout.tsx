import React, { ReactNode } from 'react';
import { bgGradient } from '@/utils/tailwindVars';

interface LayoutProps {
  children: ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  return <main className={`${bgGradient} justify-start pt-10 pb-20`}>{children}</main>;
};

export default Layout;
