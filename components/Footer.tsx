import React from 'react';

const Footer: React.FC = () => {
  const year = new Date().getFullYear();

  // return (
  //   <footer className='text-white w-full flex justify-center bg-black py-8'>
  //     <p className='text-xs'>Built by Theunis Duminy & Johan Smal. © {year}</p>
  //   </footer>
  // );

  return (
    <footer className='bg-[#310639] block bottom-0'>
      <div className='mx-auto max-w-7xl overflow-hidden py-6 lg:px-8'>
        <p className='text-center text-xs leading-5 text-gray-100'>
          Built by Theunis Duminy & Johan Smal. &copy; {year}
        </p>
      </div>
    </footer>
  );
};

export default Footer;
