import React from 'react';

const Footer: React.FC = () => {
  const year = new Date().getFullYear();

  return (
    <footer className='max-h-10 text-white text-center flex-col w-full flex justify-center items-center'>
      <p className='text-[8px]'>Built by Theunis Duminy & Johan Smal.</p>
      <p className='text-[8px]'>© {year}</p>
    </footer>
  );
};

export default Footer;
