export async function fetchCandidateInfo() {
  const response = await fetch(
    'http://ec2-13-60-240-125.eu-north-1.compute.amazonaws.com/api/candidates/me/',
    {
      headers: {
        Authorization: 'Token 50ba34577818cd4083529b0586784b0a657081ec',
      },
    },
  );
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }
  return response.json();
}
