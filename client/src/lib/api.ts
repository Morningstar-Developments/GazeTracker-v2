import config from '../config';

/**
 * API client for making requests to the backend
 */

/**
 * Constructs the full API URL for a given path
 */
export function getApiUrl(path: string): string {
  // Remove leading slash if present to avoid double slashes
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  return `${config.apiBaseUrl}/${cleanPath}`;
}

/**
 * Makes a fetch request to the API with proper headers and error handling
 */
export async function fetchApi<T>(
  path: string, 
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(getApiUrl(path), {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`API call failed: ${response.statusText}`);
  }

  return response.json();
}

/**
 * API endpoints for sessions
 */
export const sessionsApi = {
  create: (config: SessionConfig) => 
    fetchApi('api/sessions', {
      method: 'POST',
      body: JSON.stringify(config)
    }),

  addGazeData: (data: GazeData) =>
    fetchApi('api/sessions/current/gaze', {
      method: 'POST', 
      body: JSON.stringify(data)
    }),

  complete: () =>
    fetchApi('api/sessions/current', {
      method: 'PUT',
      body: JSON.stringify({ status: 'completed' })
    }),

  getCurrentGaze: () =>
    fetchApi<GazeData[]>('api/sessions/current/gaze')
};

// Types
export interface SessionConfig {
  participantId: string;
  isPilot: boolean;
}

export interface GazeData {
  x: number;
  y: number;
  confidence: number;
  timestamp: number;
}