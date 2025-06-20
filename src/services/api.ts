export async function fetchCandidateInfo() {
  // Get candidate_token from sessionStorage
  const stored = sessionStorage.getItem('recorder_query_params');
  let candidate_token: string | undefined = undefined;
  if (stored) {
    try {
      const params = JSON.parse(stored);
      candidate_token = params.candidate_token;
    } catch {}
  }
  if (!candidate_token) {
    throw new Error('No candidate_token found in session storage');
  }
  const response = await fetch(
    'http://ec2-13-60-240-125.eu-north-1.compute.amazonaws.com/api/candidates/me/',
    {
      headers: {
        Authorization: `Token ${candidate_token}`,
      },
    },
  );
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }
  return response.json();
}

export async function fetchRoundQuestions(round: string = 'pre-screening') {
  // Get recruiter_id and candidate_id from sessionStorage
  const stored = sessionStorage.getItem('recorder_query_params');
  let recruiter_id: string | undefined = undefined;
  let candidate_id: string | undefined = undefined;
  if (stored) {
    try {
      const params = JSON.parse(stored);
      recruiter_id = params.recruiter_id;
      candidate_id = params.candidate_id;
    } catch {}
  }
  if (!recruiter_id || !candidate_id) {
    throw new Error('recruiter_id or candidate_id missing in session storage');
  }
  const url = `http://ec2-13-60-240-125.eu-north-1.compute.amazonaws.com/recruiter/public-round-questions/?recruiter_id=${recruiter_id}&candidate_id=${candidate_id}&round=${encodeURIComponent(round)}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }
  const data = await response.json();
  return data.questions;
}

export async function submitRoundAnswers({
  questions,
  answers,
  round = 'pre-screening',
}: {
  questions: string[];
  answers: string[];
  round?: string;
}) {
  // Get candidate_token and recruiter_token from sessionStorage
  const stored = sessionStorage.getItem('recorder_query_params');
  let candidate_token: string | undefined = undefined;
  let recruiter_token: string | undefined = undefined;
  if (stored) {
    try {
      const params = JSON.parse(stored);
      candidate_token = params.candidate_token;
      recruiter_token = params.recruiter_token;
    } catch {}
  }
  if (!candidate_token || !recruiter_token) {
    throw new Error('candidate_token or recruiter_token missing in session storage');
  }
  const response = await fetch(
    'http://ec2-13-60-240-125.eu-north-1.compute.amazonaws.com/recruiter/round-qa/',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Token ${recruiter_token}`,
      },
      body: JSON.stringify({
        candidate_token,
        round,
        questions,
        answers,
      }),
    }
  );
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }
  return response.json();
}
