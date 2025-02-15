import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';

interface SessionConfig {
  participantId: string;
  isPilot: boolean;
}

export default function SessionControl() {
  const [participantId, setParticipantId] = useState('');
  const [isPilot, setIsPilot] = useState(false);

  const initSession = useMutation({
    mutationFn: (config: SessionConfig) =>
      fetch('/api/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
      }).then(res => res.json()),
  });

  const saveSession = useMutation({
    mutationFn: () =>
      fetch('/api/sessions/current/save', {
        method: 'POST',
      }).then(res => res.json()),
  });

  const clearSession = useMutation({
    mutationFn: () =>
      fetch('/api/sessions/current', {
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