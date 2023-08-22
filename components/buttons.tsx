import styles from '@/../styles/Button.module.css';

interface HeaderSectionProps {
  showTitle?: boolean;
}

export default function Buttons(props: HeaderSectionProps) {
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
