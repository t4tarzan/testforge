// FIXTURE — uses CSS Modules, no inline style props.
import styles from './Good.module.css';
export function Card() {
  return (
    <div className={styles.card}>
      <h2 className={styles.title}>Title</h2>
    </div>
  );
}
