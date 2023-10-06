import React from 'react';

const Footer: React.FC = () => {
  const year = new Date().getFullYear();

  return (
    <footer className='text-white w-full flex justify-center py-6 mb-10'>
      <p className='text-[8px]'>Built by Theunis Duminy & Johan Smal. © {year}</p>
    </footer>
  );
};

export default Footer;
