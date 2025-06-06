import InterviewRecorder from 'components/InterviewRecorder/InterviewRecorder';
import { useMediaDevices } from 'contexts/mediaDevices';
import useKeyboardShorcut from 'hooks/useKeyboardShortcut';

import styles from './App.module.css';

const App = () => {
  const {
    cameraEnabled,
    microphoneEnabled,
    setCameraEnabled,
    setMicrophoneEnabled,
  } = useMediaDevices();

  useKeyboardShorcut('e', () => setCameraEnabled(!cameraEnabled));
  useKeyboardShorcut('d', () => setMicrophoneEnabled(!microphoneEnabled));

  return (
    <div className={styles.root}>
      <main className={styles.main}>
        <InterviewRecorder />
      </main>
    </div>
  );
};

export default App;
