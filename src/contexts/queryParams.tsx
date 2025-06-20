import  { createContext, useContext } from 'react';

export interface QueryParams {
  candidate_id?: string;
  candidate_token?: string;
  recruiter_id?: string;
  recruiter_token?: string;
}

const QueryParamsContext = createContext<QueryParams>({});

export const useQueryParams = () => useContext(QueryParamsContext);

const STORAGE_KEY = 'recorder_query_params';

function getQueryParamsFromUrl(): QueryParams {
  const params = new URLSearchParams(window.location.search);
  return {
    candidate_id: params.get('candidate_id') || undefined,
    candidate_token: params.get('candidate_token') || undefined,
    recruiter_id: params.get('recruiter_id') || undefined,
    recruiter_token: params.get('recruiter_token') || undefined,
  };
}

function getQueryParams(): QueryParams {
  // Try sessionStorage first
  const stored = sessionStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {}
  }
  // Fallback to URL
  const params = getQueryParamsFromUrl();
  // Store in sessionStorage for future use
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(params));
  return params;
}

export const QueryParamsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryParams = getQueryParams();
  return (
    <QueryParamsContext.Provider value={queryParams}>
      {children}
    </QueryParamsContext.Provider>
  );
}; 