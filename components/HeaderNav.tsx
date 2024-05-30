'use client';
import Link from 'next/link';
/* eslint-disable @next/next/no-img-element */
// import { usePathname } from 'next/navigation';

// import Link from 'next/link';

// export default function Header() {
//   const path = usePathname();

//   //  sticky top-0 z-20

//   return (
//     <div className='text-white text-center font-semibold pb-5 bg-[#00edfd] sm:w-full pt-5'>
//       <div className='flex flex-col justify-center items-center relative sm:sticky sm:top-0'>
//         <img
//           className='max-w-screen-lg w-32'
//           src='../premier-league.png'
//           alt='premier league logo'
//         />
//         {path === '/' && <h1 className='pt-5 text-[#310639]'>Draft League Standings</h1>}
//         {path === '/detail' && <h1 className='pt-5 text-[#310639]'>Detailed Points Breakdown</h1>}

//         {path !== '/' && (
//           <Link href={'/'} className='text-[#310639] hover:text-white'>
//             Back to Home
//           </Link>
//         )}
//       </div>
//     </div>
//   );
// }

const navigation = [
  { name: 'Home', href: '/', target: '_self' },
  { name: 'Detail', href: '/detail', target: '_self' },
  { name: 'Draft', href: 'https://draft.premierleague.com/team/my', target: '_blank' },
];

export default function HeaderNav() {
  return (
    <header className='bg-gradient-to-t from-[#00edfd] to-[#75fa95]'>
      <nav className='mx-auto max-w-7xl px-6 lg:px-8' aria-label='Top'>
        <div className='flex flex-col w-full items-center justify-between border-b-2 border-premPurple py-6'>
          <div className='flex items-center'>
            <Link href='/'>
              <span className='sr-only'>Draft League Standings</span>
              <img
                className='max-w-screen-lg w-32'
                src='../premier-league.png'
                alt='premier league logo'
              />
            </Link>
            <div className='ml-10 hidden space-x-8 lg:block'>
              {navigation.map((link) => (
                <a
                  target={link.target}
                  key={link.name}
                  href={link.href}
                  className='text-md font-medium text-premPurple hover:text-indigo-50'
                >
                  {link.name}
                </a>
              ))}
            </div>
          </div>
          {/* <div className='ml-10 space-x-4'>
            <a
              href='#'
              className='inline-block rounded-md border border-transparent bg-indigo-500 px-4 py-2 text-base font-medium text-white hover:bg-opacity-75'
            >
              Sign in
            </a>
            <a
              href='#'
              className='inline-block rounded-md border border-transparent bg-white px-4 py-2 text-base font-medium text-indigo-600 hover:bg-indigo-50'
            >
              Sign up
            </a>
          </div> */}
        </div>
        <div className='flex flex-wrap justify-center gap-x-6 py-4 sticky top-0 z-20 lg:hidden'>
          {navigation.map((link) => (
            <a
              target={link.target}
              key={link.name}
              href={link.href}
              className='text-md font-medium text-premPurple hover:text-indigo-50'
            >
              {link.name}
            </a>
          ))}
        </div>
      </nav>
    </header>
  );
}
