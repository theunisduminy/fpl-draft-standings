import styles from '@/../styles/Header.module.css';
import { useRouter } from 'next/router';
import Link from 'next/link';

interface HeaderSectionProps {
  showTitle?: boolean;
}

export default function Header(props: HeaderSectionProps) {
  const { showTitle = true } = props;
  const router = useRouter();
  const path = router.pathname;

  return (
    <div className={styles.homeNav}>
      {path !== '/' && (
        <Link href={'/'} className={styles.backButton}>
          <i className='fa fa-arrow-left'></i> Back to Home
        </Link>
      )}
      <br></br>
      <div className={styles.description}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className={styles.banner} src='../premier-league-banner-teal.png' alt='premier league logo' />
        {showTitle && <h1>Draft League Standings</h1>}
      </div>
    </div>
  );
}
