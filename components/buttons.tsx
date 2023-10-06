import Link from 'next/link';

export default function Buttons() {
  return (
    <div className='mt-12 text-center m-10 sm:my-10'>
      <Link
        href={'/detail'}
        className='inline-block px-7 py-3 mr-4 text-white bg-gradient-to-r from-cyan-600 to-blue-500 rounded-lg text-sm hover:text-black shadow-2xl'
      >
        Detail view
      </Link>
      <Link
        href={'https://draft.premierleague.com/team/my'}
        className='inline-block px-7 py-3 ml-4 text-white bg-gradient-to-r from-cyan-600 to-blue-500 rounded-lg text-sm hover:text-black shadow-2xl'
      >
        Draft team
      </Link>
    </div>
  );
}
