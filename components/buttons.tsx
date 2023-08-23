import styles from '@/../styles/Button.module.css';

// If need in the future
// interface ButtonSectionProps {
//   foo: string
// }

export default function Buttons() {
  return (
    <div className={styles.buttonLayout}>
      <a className={styles.buttonLeft} href='/detail'>
        Detail view
      </a>
      <a className={styles.buttonRight} href='https://draft.premierleague.com/team/my'>
        Draft team
      </a>
    </div>
  );
}
