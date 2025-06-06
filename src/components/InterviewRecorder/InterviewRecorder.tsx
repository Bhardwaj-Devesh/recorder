import { useState, useEffect, useRef } from 'react';
import { Box, Typography, TextField, Button, CircularProgress, Alert, Snackbar } from '@mui/material';
import { useStreams } from 'contexts/streams';
import useVideoSource from 'hooks/useVideoSource';
import styles from './InterviewRecorder.module.css';

const INTERVIEW_DURATION = 5; // 1 minute in seconds
const COUNTDOWN_DURATION = 3; // 3 seconds countdown

// Error messages for different scenarios
const ERROR_MESSAGES = {
  CAMERA_PERMISSION: 'Camera access is required. Please allow camera access and try again.',
  CAMERA_IN_USE: 'Camera is already in use by another application. Please close other applications using the camera.',
  RECORDING_FAILED: 'Failed to start recording. Please try again.',
  SUBMISSION_FAILED: 'Failed to submit video. Please check your internet connection and try again.',
  INVALID_EMAIL: 'Please enter a valid email address.',
  NETWORK_ERROR: 'Network error. Please check your internet connection and try again.',
  SERVER_ERROR: 'Server error. Please try again later.',
  FILE_TOO_LARGE: 'Video file is too large. Please try recording a shorter video.',
  UNKNOWN_ERROR: 'An unexpected error occurred. Please try again.',
};

const InterviewRecorder = () => {
  const [timeLeft, setTimeLeft] = useState(INTERVIEW_DURATION);
  const [countdown, setCountdown] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [isTimerComplete, setIsTimerComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showErrorSnackbar, setShowErrorSnackbar] = useState(false);
  const { cameraStream } = useStreams();
  const updateCameraSource = useVideoSource(cameraStream);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  // Validate email format
  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

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
    } else if (timeLeft === 0) {
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
        videoBitsPerSecond: 2500000, // 2.5 Mbps
      });

      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error:', event);
        setError(ERROR_MESSAGES.RECORDING_FAILED);
        setShowErrorSnackbar(true);
        stopRecording();
      };

      mediaRecorder.start(1000); // Collect data every second
      setIsRecording(true);
      setHasStarted(true);
      setIsTimerComplete(false);
      setTimeLeft(INTERVIEW_DURATION);
    } catch (error) {
      console.error('Error starting recording:', error);
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
        console.error('Error stopping recording:', error);
        setError(ERROR_MESSAGES.RECORDING_FAILED);
        setShowErrorSnackbar(true);
      }
    }
  };

  const handleRetry = () => {
    recordedChunksRef.current = [];
    setTimeLeft(INTERVIEW_DURATION);
    setHasStarted(false);
    setIsTimerComplete(false);
    setEmail('');
    setError(null);
    setSuccess(false);
  };

  const handleSubmit = async () => {
    if (!email) {
      setError(ERROR_MESSAGES.INVALID_EMAIL);
      setShowErrorSnackbar(true);
      return;
    }

    if (!validateEmail(email)) {
      setError(ERROR_MESSAGES.INVALID_EMAIL);
      setShowErrorSnackbar(true);
      return;
    }

    if (!recordedChunksRef.current.length) {
      setError(ERROR_MESSAGES.RECORDING_FAILED);
      setShowErrorSnackbar(true);
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccess(false);

    try {
      const videoBlob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
      
      // Check file size (max 100MB)
      if (videoBlob.size > 100 * 1024 * 1024) {
        throw new Error(ERROR_MESSAGES.FILE_TOO_LARGE);
      }

      const formData = new FormData();
      formData.append('video', videoBlob, 'interview.webm');
      formData.append('email', email);

      const response = await fetch('http://your-frontend-api.com/api/interview-submission', {
        method: 'POST',
        body: formData,
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (response.status >= 500) {
          throw new Error(ERROR_MESSAGES.SERVER_ERROR);
        } else if (response.status === 413) {
          throw new Error(ERROR_MESSAGES.FILE_TOO_LARGE);
        } else {
          throw new Error(errorData.message || ERROR_MESSAGES.SUBMISSION_FAILED);
        }
      }

      const data = await response.json();
      setSuccess(true);
      
      // Reset state after successful submission
      setEmail('');
      recordedChunksRef.current = [];
      setTimeLeft(INTERVIEW_DURATION);
      setHasStarted(false);
      setIsTimerComplete(false);
    } catch (error) {
      console.error('Error submitting video:', error);
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError(ERROR_MESSAGES.UNKNOWN_ERROR);
      }
      setShowErrorSnackbar(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Box className={styles.container}>
      <Typography variant="h4" className={styles.question}>
        Introduce yourself in a minute
      </Typography>

      <Box className={styles.videoContainer}>
        <video
          ref={updateCameraSource}
          autoPlay
          playsInline
          muted
          className={styles.video}
        />
        {countdown > 0 && (
          <Typography variant="h1" className={styles.countdown}>
            {countdown}
          </Typography>
        )}
        {isRecording && (
          <Typography variant="h5" className={styles.timer}>
            {timeLeft}s
          </Typography>
        )}
      </Box>

      <Box className={styles.controls}>
        {!hasStarted ? (
          <Button
            variant="contained"
            color="primary"
            onClick={initiateRecording}
            disabled={!cameraStream || countdown > 0}
          >
            Start Recording
          </Button>
        ) : isTimerComplete ? (
          <>
            <TextField
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className={styles.emailInput}
              error={!!error}
              helperText={error}
            />
            {success && (
              <Alert severity="success" className={styles.alert}>
                Video submitted successfully!
              </Alert>
            )}
            <Box className={styles.buttonGroup}>
              <Button
                variant="outlined"
                color="primary"
                onClick={handleRetry}
                disabled={isSubmitting}
              >
                Retry
              </Button>
              <Button
                variant="contained"
                color="primary"
                onClick={handleSubmit}
                disabled={!email || isSubmitting}
              >
                {isSubmitting ? <CircularProgress size={24} /> : 'Submit Video'}
              </Button>
            </Box>
          </>
        ) : null}
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
    </Box>
  );
};

export default InterviewRecorder; 