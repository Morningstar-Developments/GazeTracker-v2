import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { fetchApi } from '../lib/api';

interface SessionConfig {
  participantId: string;
  isPilot: boolean;
}

interface SaveSessionResponse {
  filename: string;
}

export default function SessionControl() {
  const [participantId, setParticipantId] = useState('');
  const [isPilot, setIsPilot] = useState(false);

  const initSession = useMutation({
    mutationFn: (config: SessionConfig) =>
      fetchApi<{ message: string }>('api/sessions', {
        method: 'POST',
        body: JSON.stringify(config),
      }),
  });

  const saveSession = useMutation({
    mutationFn: () =>
      fetchApi<SaveSessionResponse>('api/sessions/current/save', {
        method: 'POST',
      }),
  });

  const clearSession = useMutation({
    mutationFn: () =>
      fetchApi('api/sessions/current', {
        method: 'DELETE',
      }),
  });

  const handleStartSession = () => {
    if (!participantId) {
      alert('Please enter a participant ID');
      return;
    }
    initSession.mutate({ participantId, isPilot });
  };

  return (
    <div className="session-control">
      <h2>Session Control</h2>
      <div className="session-form">
        <div className="form-group">
          <label>
            Participant ID:
            <input
              type="text"
              value={participantId}
              onChange={(e) => setParticipantId(e.target.value)}
              placeholder="Enter ID"
            />
          </label>
        </div>
        <div className="form-group">
          <label>
            <input
              type="checkbox"
              checked={isPilot}
              onChange={(e) => setIsPilot(e.target.checked)}
            />
            Pilot Run
          </label>
        </div>
        <div className="button-group">
          <button
            onClick={handleStartSession}
            disabled={initSession.isPending || !participantId}
          >
            Start Session
          </button>
          <button
            onClick={() => saveSession.mutate()}
            disabled={saveSession.isPending || !participantId}
          >
            Save to CSV
          </button>
          <button
            onClick={() => clearSession.mutate()}
            disabled={clearSession.isPending}
          >
            Clear Session
          </button>
        </div>
      </div>
      {saveSession.data && (
        <div className="success-message">
          Session saved as: {saveSession.data.filename}
        </div>
      )}
    </div>
  );
} 