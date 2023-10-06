/* eslint-disable @next/next/no-img-element */
import { useRouter } from 'next/router';
import Link from 'next/link';

export default function Header() {
  const router = useRouter();
  const path = router.pathname;

  return (
    <div className='text-white text-center font-semibold pb-5 mb-10 sticky top-0 z-20 bg-cyan-500 sm:w-full pt-5'>
      <div className='flex flex-col justify-center items-center relative sm:sticky sm:top-0'>
        <img
          className='w-32 max-w-screen-lg sm:w-48'
          src='../premier-league.png'
          alt='premier league logo'
        />
        {path === '/' && <h1 className='pt-5 text-[#310639]'>Draft League Standings</h1>}
        {path === '/detail' && <h1 className='pt-5 text-[#310639]'>Detailed Points Breakdown</h1>}

        {path !== '/' && (
          <Link href={'/'} className='text-[#310639] hover:text-white'>
            <i className='fa fa-arrow-left'></i> Back to Home
          </Link>
        )}
      </div>
    </div>
  );
}
