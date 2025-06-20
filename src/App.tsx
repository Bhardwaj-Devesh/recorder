import { useEffect } from 'react';

import InterviewRecorder from 'components/InterviewRecorder/InterviewRecorder';
import { useMediaDevices } from 'contexts/mediaDevices';
import useKeyboardShorcut from 'hooks/useKeyboardShortcut';
import { QueryParamsProvider } from './contexts/queryParams';

import { fetchCandidateInfo, fetchRoundQuestions } from './services/api';

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
        // Fetch questions after candidate info
        fetchRoundQuestions()
          .then((questions) => {
            console.log('Round Questions:', questions);
          })
          .catch((error) => {
            console.error('Failed to fetch round questions:', error);
          });
      })
      .catch((error) => {
        console.error('Failed to fetch candidate info:', error);
      });
  }, []);

  return (
    <QueryParamsProvider>
      <div className={styles.root}>
        <main className={styles.main}>
          <InterviewRecorder />
        </main>
      </div>
    </QueryParamsProvider>
  );
};

export default App;
