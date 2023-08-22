import styles from '@/../styles/Button.module.css';
import { useRouter } from 'next/router';
import Link from 'next/link';

interface HeaderSectionProps {
  showTitle?: boolean;
}

export default function Buttons(props: HeaderSectionProps) {
  // const router = useRouter();
  // const path = router.pathname;

  return (
    <div className={styles.homeNav}>
      <p>hello</p>
    </div>
  );
}
