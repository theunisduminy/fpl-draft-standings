import { ReactNode } from 'react';
import Header from './header';
import Footer from './Footer';

interface LayoutProps {
  children: ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <>
      <Header />
      <div>
        {children}
        <Footer />
      </div>
    </>
  );
};

export default Layout;
