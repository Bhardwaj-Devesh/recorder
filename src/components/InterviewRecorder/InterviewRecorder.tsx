import { useState, useEffect, useRef } from 'react';
import { Box, Typography, Button, CircularProgress, Alert, Snackbar, Stepper, Step, StepLabel, Paper } from '@mui/material';
import { useStreams } from 'contexts/streams';
import useVideoSource from 'hooks/useVideoSource';
import { fetchRoundQuestions, submitRoundAnswers } from 'services/api';
import styles from './InterviewRecorder.module.css';

const INTERVIEW_DURATION = 5; // 1 minute in seconds
const COUNTDOWN_DURATION = 3; // 3 seconds countdown

const ERROR_MESSAGES = {
  CAMERA_PERMISSION: 'Camera access is required. Please allow camera access and try again.',
  CAMERA_IN_USE: 'Camera is already in use by another application. Please close other applications using the camera.',
  RECORDING_FAILED: 'Failed to start recording. Please try again.',
  NETWORK_ERROR: 'Network error. Please check your internet connection and try again.',
  UNKNOWN_ERROR: 'An unexpected error occurred. Please try again.',
};

const InterviewRecorder = () => {
  const [questions, setQuestions] = useState<string[]>([]);
  const [questionsLoading, setQuestionsLoading] = useState(true);
  const [questionsError, setQuestionsError] = useState<string | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<{ video: Blob; transcript: string }[]>([]);
  const [countdown, setCountdown] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [isTimerComplete, setIsTimerComplete] = useState(false);
  const [timeLeft, setTimeLeft] = useState(INTERVIEW_DURATION);
  const [error, setError] = useState<string | null>(null);
  const [showErrorSnackbar, setShowErrorSnackbar] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcript, setTranscript] = useState<string>('');
  const [showSubmit, setShowSubmit] = useState(false);
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { cameraStream } = useStreams();
  const updateCameraSource = useVideoSource(cameraStream);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recognitionRef = useRef<any>(null);

  // Fetch questions from API on mount
  useEffect(() => {
    setQuestionsLoading(true);
    fetchRoundQuestions()
      .then((q) => {
        setQuestions(q);
        setQuestionsLoading(false);
      })
      .catch((err) => {
        setQuestionsError('Failed to load questions.');
        setQuestionsLoading(false);
      });
  }, []);

  // Handle camera permission errors
  const handleCameraError = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach(track => track.stop());
      return false;
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          setError(ERROR_MESSAGES.CAMERA_PERMISSION);
        } else if (error.name === 'NotReadableError') {
          setError(ERROR_MESSAGES.CAMERA_IN_USE);
        } else {
          setError(ERROR_MESSAGES.UNKNOWN_ERROR);
        }
      }
      setShowErrorSnackbar(true);
      return true;
    }
  };

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (countdown > 0) {
      timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            startRecording();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [countdown]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isRecording && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0 && isRecording) {
      stopRecording();
      setIsTimerComplete(true);
    }
    return () => clearInterval(timer);
  }, [isRecording, timeLeft]);

  const initiateRecording = async () => {
    const hasError = await handleCameraError();
    if (hasError) return;
    setCountdown(COUNTDOWN_DURATION);
  };

  const startRecording = async () => {
    if (!cameraStream) {
      setError(ERROR_MESSAGES.CAMERA_PERMISSION);
      setShowErrorSnackbar(true);
      return;
    }
    try {
      recordedChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(cameraStream, {
        mimeType: 'video/webm;codecs=vp8,opus',
        videoBitsPerSecond: 2500000,
      });
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };
      mediaRecorder.onerror = (event) => {
        setError(ERROR_MESSAGES.RECORDING_FAILED);
        setShowErrorSnackbar(true);
        stopRecording();
      };
      mediaRecorder.start(1000);
      setIsRecording(true);
      setIsTimerComplete(false);
      setTimeLeft(INTERVIEW_DURATION);
      setTranscript('');
    } catch (error) {
      setError(ERROR_MESSAGES.RECORDING_FAILED);
      setShowErrorSnackbar(true);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      try {
        mediaRecorderRef.current.stop();
        setIsRecording(false);
      } catch (error) {
        setError(ERROR_MESSAGES.RECORDING_FAILED);
        setShowErrorSnackbar(true);
      }
    }
  };

  // Start browser speech recognition
  const startSpeechRecognition = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setTranscript('Speech recognition not supported in this browser.');
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = true;
    recognition.continuous = true;
    recognitionRef.current = recognition;
    let finalTranscript = '';
    recognition.onresult = (event: any) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      setTranscript(finalTranscript + interim);
    };
    recognition.onerror = (event: any) => {
      setTranscript('Speech recognition error: ' + JSON.stringify(event));
    };
    recognition.start();
  };

  // Stop browser speech recognition
  const stopSpeechRecognition = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
  };

  // Start speech recognition when recording starts
  useEffect(() => {
    if (isRecording) {
      setTranscript('');
      startSpeechRecognition();
    } else {
      stopSpeechRecognition();
    }
    // eslint-disable-next-line
  }, [isRecording]);

  const handleReRecord = () => {
    recordedChunksRef.current = [];
    setTimeLeft(INTERVIEW_DURATION);
    setIsTimerComplete(false);
    setTranscript('');
    setIsRecording(false);
    setCountdown(0);
  };

  const handleNext = () => {
    // Save answer
    const videoBlob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
    setAnswers((prev) => [
      ...prev,
      { video: videoBlob, transcript },
    ]);
    // Reset for next question
    recordedChunksRef.current = [];
    setTimeLeft(INTERVIEW_DURATION);
    setIsTimerComplete(false);
    setTranscript('');
    setIsRecording(false);
    setCountdown(0);
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion((q) => q + 1);
    } else {
      setShowSubmit(true);
    }
  };

  const handleFinalSubmit = async () => {
    // Save last answer if not already saved
    if (answers.length < questions.length) {
      const videoBlob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
      setAnswers((prev) => [
        ...prev,
        { video: videoBlob, transcript },
      ]);
    }
    setIsSubmitting(true);
    setShowSubmit(false);
    try {
      // Prepare answers as array of transcripts
      const allAnswers = [
        ...answers.map((a) => a.transcript),
        transcript
      ];
      await submitRoundAnswers({
        questions,
        answers: allAnswers,
        round: 'pre-screening',
      });
      setSuccess(true);
    } catch (err) {
      setError('Failed to submit answers. Please try again.');
      setShowErrorSnackbar(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Add a useEffect to log the transcript when recording is done
  useEffect(() => {
    if (isTimerComplete && transcript) {
      console.log(`Transcript for Q${currentQuestion + 1}:`, transcript);
    }
    // eslint-disable-next-line
  }, [isTimerComplete, transcript]);

  // UI
  if (questionsLoading) {
    return (
      <Box className={styles.container} display="flex" alignItems="center" justifyContent="center" minHeight="300px">
        <CircularProgress />
        <Typography variant="h6" style={{ marginLeft: 16 }}>Loading questions...</Typography>
      </Box>
    );
  }
  if (questionsError || !questions.length) {
    return (
      <Box className={styles.container} display="flex" alignItems="center" justifyContent="center" minHeight="300px">
        <Alert severity="error">{questionsError || 'No questions found.'}</Alert>
      </Box>
    );
  }

  if (success) {
    return (
      <Paper elevation={3} className={styles.container} style={{ textAlign: 'center', padding: 32 }}>
        <Typography variant="h4" color="primary" gutterBottom>
          Hurray! You've submitted the assignment.
        </Typography>
        <Typography variant="h6" color="textSecondary">
          We'll get back to you soon.
        </Typography>
      </Paper>
    );
  }

  return (
    <Box
      className={styles.container}
      display="flex"
      alignItems="center"
      justifyContent="center"
      sx={{ width: '95vw', margin: 'auto' }}
    >
      <Box display="flex" flexDirection="row" width="100%" height="100%" boxShadow={3} borderRadius={3} overflow="hidden" bgcolor="#fff">
        {/* Left half: Info and actions */}
        <Box flex={1} display="flex" flexDirection="column" justifyContent="center" alignItems="center" p={4} bgcolor="#f7f9fa">
          <Stepper activeStep={currentQuestion} alternativeLabel style={{ width: '100%', marginBottom: 24 }}>
            {questions.map((q, idx) => (
              <Step key={q} completed={answers.length > idx}>
                <StepLabel className={styles.question}>Q{idx + 1}</StepLabel>
              </Step>
            ))}
          </Stepper>
          <Paper elevation={2} className={styles.questionBox} style={{ width: '100%', marginBottom: 24, padding: 24 }}>
            <Typography className={styles.question} style={{ marginBottom: 8 }}>
              {questions[currentQuestion]}
            </Typography>
          </Paper>
          {/* Controls and transcript */}
          <Box className={styles.controls} width="100%" display="flex" flexDirection="column" alignItems="center">
            {!isRecording && !isTimerComplete && !isTranscribing && countdown === 0 && (
              <Button
                variant="contained"
                color="primary"
                onClick={initiateRecording}
                disabled={!cameraStream}
                size="large"
                style={{ minWidth: 180, marginBottom: 16 }}
              >
                Start Recording
              </Button>
            )}
            {isRecording && (
              <Typography variant="body1" color="primary" style={{ marginTop: 12 }}>
                Recording... Speak your answer
              </Typography>
            )}
            {isTimerComplete && !isTranscribing && (
              <Box display="flex" flexDirection="column" alignItems="center" gap={2} width="100%">
                <Box display="flex" gap={2}>
                  <Button
                    variant="outlined"
                    color="primary"
                    onClick={handleReRecord}
                    size="large"
                  >
                    Re-record
                  </Button>
                  {currentQuestion < questions.length - 1 ? (
                    <Button
                      variant="contained"
                      color="primary"
                      onClick={handleNext}
                      disabled={!transcript}
                      size="large"
                    >
                      Next Question
                    </Button>
                  ) : (
                    <Button
                      variant="contained"
                      color="primary"
                      onClick={handleFinalSubmit}
                      disabled={!transcript || isSubmitting}
                      size="large"
                    >
                      {isSubmitting ? 'Submitting...' : 'Submit'}
                    </Button>
                  )}
                </Box>
              </Box>
            )}
            {isTranscribing && (
              <Box display="flex" flexDirection="column" alignItems="center" gap={2}>
                <CircularProgress style={{ margin: 16 }} />
                <Typography variant="body2">Transcribing your answer...</Typography>
              </Box>
            )}
          </Box>
        </Box>
        {/* Right half: Video preview */}
        <Box flex={1} display="flex" flexDirection="column" justifyContent="center" alignItems="center" bgcolor="#f7f9fa" position="relative">
          <Box className={styles.videoContainer} display="flex" flexDirection="column" alignItems="center" justifyContent="center" width="100%">
            <video
              ref={updateCameraSource}
              autoPlay
              playsInline
              muted
              className={styles.video}
              style={{ width: '90%', maxWidth: 480, borderRadius: 16, boxShadow: '0 4px 24px rgba(0,0,0,0.10)' }}
            />
            {countdown > 0 && (
              <Typography variant="h1" className={styles.countdown} style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: '#1976d2', fontWeight: 700, textShadow: '0 2px 8px #fff' }}>
                {countdown}
              </Typography>
            )}
            {isRecording && (
              <Typography variant="h5" className={styles.timer} style={{ position: 'absolute', top: 24, right: 32, background: '#fff', borderRadius: 8, padding: '4px 16px', boxShadow: '0 2px 8px #eee' }}>
                {timeLeft}s
              </Typography>
            )}
          </Box>
        </Box>
      </Box>
      <Snackbar
        open={showErrorSnackbar}
        autoHideDuration={6000}
        onClose={() => setShowErrorSnackbar(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          onClose={() => setShowErrorSnackbar(false)} 
          severity="error" 
          sx={{ width: '100%' }}
        >
          {error}
        </Alert>
      </Snackbar>
      {/* Submit confirmation dialog */}
      {showSubmit && (
        <Box
          position="fixed"
          top={0}
          left={0}
          width="100vw"
          height="100vh"
          display="flex"
          alignItems="center"
          justifyContent="center"
          style={{ background: 'rgba(0,0,0,0.25)', zIndex: 9999 }}
        >
          <Paper elevation={4} style={{ padding: 32, textAlign: 'center' }}>
            <Typography variant="h5" gutterBottom>
              Ready to submit your answers?
            </Typography>
            <Button
              variant="contained"
              color="primary"
              onClick={handleFinalSubmit}
              style={{ marginRight: 16 }}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Submitting...' : 'Submit'}
            </Button>
            <Button
              variant="outlined"
              color="primary"
              onClick={() => setShowSubmit(false)}
            >
              Cancel
            </Button>
          </Paper>
        </Box>
      )}
    </Box>
  );
};

export default InterviewRecorder; 