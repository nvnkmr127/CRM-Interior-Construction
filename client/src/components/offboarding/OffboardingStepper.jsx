import styles from './OffboardingModal.module.css';

const STAGES = [
  'pending_manager',
  'pending_hr',
  'active_transfer',
  'pending_asset_return',
  'completed',
  'archived'
];

export default function OffboardingStepper({ status }) {
  const currentIndex = STAGES.indexOf(status);

  return (
    <div className={styles.stepperContainer}>
      {STAGES.map((stage, idx) => {
        const isCompleted = idx < currentIndex || status === 'archived';
        const isActive = idx === currentIndex && status !== 'archived';
        
        let display = stage.replace(/_/g, ' ');
        if (stage === 'active_transfer') display = 'transfers';
        
        return (
          <div key={stage} className={styles.step}>
            <div className={`${styles.stepCircle} ${isCompleted ? styles.completed : ''} ${isActive ? styles.active : ''}`}>
              {isCompleted ? '\u2713' : idx + 1}
            </div>
            <div className={styles.stepLabel}>{display}</div>
            {idx < STAGES.length - 1 && (
              <div className={`${styles.stepLine} ${isCompleted ? styles.completedLine : ''}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}
