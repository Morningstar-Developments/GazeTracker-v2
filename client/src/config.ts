export interface Config {
  apiBaseUrl: string;
}

// Function to dynamically determine the API base URL
function getApiBaseUrl(): string {
  const port = process.env.REACT_APP_API_PORT || '3001';
  const host = process.env.REACT_APP_API_HOST || 'localhost';
  const protocol = process.env.REACT_APP_API_PROTOCOL || 'http';
  return `${protocol}://${host}:${port}`;
}

const config: Config = {
  apiBaseUrl: getApiBaseUrl(),
};

export default config; 