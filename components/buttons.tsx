import styles from '@/../styles/Button.module.css';
import Link from 'next/link';

// If need in the future
// interface ButtonSectionProps {
//   foo: string
// }

export default function Buttons() {
  return (
    <div className={styles.buttonLayout}>
      <Link className={styles.buttonLeft} href={'/detail'}>
        Detail view
      </Link>
      <Link className={styles.buttonRight} href={'https://draft.premierleague.com/team/my'}>
        Draft team
      </Link>
    </div>
  );
}
