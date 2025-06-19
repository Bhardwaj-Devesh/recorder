import { useEffect } from 'react';

import InterviewRecorder from 'components/InterviewRecorder/InterviewRecorder';
import { useMediaDevices } from 'contexts/mediaDevices';
import useKeyboardShorcut from 'hooks/useKeyboardShortcut';

import { fetchCandidateInfo } from './services/api';

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

  useEffect(() => {
    fetchCandidateInfo()
      .then((data) => {
        console.log('Candidate Info:', data);
      })
      .catch((error) => {
        console.error('Failed to fetch candidate info:', error);
      });
  }, []);

  return (
    <div className={styles.root}>
      <main className={styles.main}>
        <InterviewRecorder />
      </main>
    </div>
  );
};

export default App;
