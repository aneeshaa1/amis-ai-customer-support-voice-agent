"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Vapi from '@vapi-ai/web';

interface VapiWidgetProps {
  apiKey: string;
  assistantId: string;
}

function formatVapiError(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message);
  }
  if (typeof error === 'string') return error;
  return 'Something went wrong starting the call.';
}

const VapiWidget: React.FC<VapiWidgetProps> = ({ apiKey, assistantId }) => {
  const vapiRef = useRef<Vapi | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [transcript, setTranscript] = useState<Array<{role: string, text: string}>>([]);

  useEffect(() => {
    const vapiInstance = new Vapi(apiKey);
    vapiRef.current = vapiInstance;

    vapiInstance.on('call-start', () => {
      setIsConnected(true);
      setStartError(null);
      setIsStarting(false);
    });

    vapiInstance.on('call-end', () => {
      setIsConnected(false);
      setIsSpeaking(false);
      setIsStarting(false);
    });

    vapiInstance.on('speech-start', () => {
      setIsSpeaking(true);
    });

    vapiInstance.on('speech-end', () => {
      setIsSpeaking(false);
    });

    vapiInstance.on('message', (message) => {
      if (message.type === 'transcript') {
        setTranscript(prev => [...prev, {
          role: message.role,
          text: message.transcript
        }]);
      }
    });

    vapiInstance.on('error', (error) => {
      setStartError(formatVapiError(error));
      setIsStarting(false);
    });

    vapiInstance.on('call-start-failed', (event) => {
      setStartError(event.error || 'Call failed to start.');
      setIsStarting(false);
      setIsConnected(false);
    });

    return () => {
      vapiRef.current = null;
      void vapiInstance.stop();
    };
  }, [apiKey]);

  const startCall = useCallback(async () => {
    setStartError(null);
    const client = vapiRef.current;
    if (!client) {
      setStartError('Voice client is still loading. Try again in a moment.');
      return;
    }
    if (!assistantId?.trim()) {
      setStartError('Missing assistant ID. Set VAPI_ASSISTANT_ID in your environment.');
      return;
    }
    setIsStarting(true);
    try {
      await client.start(assistantId);
    } catch (e) {
      setStartError(formatVapiError(e));
      setIsStarting(false);
    }
  }, [assistantId]);

  const endCall = () => {
    void vapiRef.current?.stop();
  };

  return (
    <div style={{
      position: 'fixed',
      bottom: '24px',
      right: '24px',
      zIndex: 1000,
      fontFamily: 'Arial, sans-serif'
    }}>
      {!isConnected ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px', maxWidth: '320px' }}>
          {startError ? (
            <div
              role="alert"
              style={{
                background: '#3d1f1f',
                color: '#ffb4b4',
                border: '1px solid #ff6b6b',
                borderRadius: '8px',
                padding: '10px 12px',
                fontSize: '13px',
                lineHeight: 1.4,
              }}
            >
              {startError}
            </div>
          ) : null}
          <button
            type="button"
            disabled={isStarting}
            onClick={() => void startCall()}
            style={{
              background: isStarting ? '#0d8a7a' : '#12A594',
              color: '#fff',
              border: 'none',
              borderRadius: '50px',
              padding: '16px 24px',
              fontSize: '16px',
              fontWeight: 'bold',
              cursor: isStarting ? 'wait' : 'pointer',
              opacity: isStarting ? 0.85 : 1,
              boxShadow: '0 4px 12px rgba(18, 165, 148, 0.3)',
              transition: 'all 0.3s ease',
            }}
            onMouseOver={(e) => {
              if (isStarting) return;
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 6px 16px rgba(18, 165, 148, 0.4)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(18, 165, 148, 0.3)';
            }}
          >
            {isStarting ? 'Connecting…' : '🎤 Talk to Assistant'}
          </button>
        </div>
      ) : (
        <div style={{
          background: '#fff',
          borderRadius: '12px',
          padding: '20px',
          width: '320px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
          border: '1px solid #e1e5e9'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '16px'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <div style={{
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                background: isSpeaking ? '#ff4444' : '#12A594',
                animation: isSpeaking ? 'pulse 1s infinite' : 'none'
              }}></div>
              <span style={{ fontWeight: 'bold', color: '#333' }}>
                {isSpeaking ? 'Assistant Speaking...' : 'Listening...'}
              </span>
            </div>
            <button
              onClick={endCall}
              style={{
                background: '#ff4444',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                padding: '6px 12px',
                fontSize: '12px',
                cursor: 'pointer'
              }}
            >
              End Call
            </button>
          </div>
          
          <div style={{
            maxHeight: '200px',
            overflowY: 'auto',
            marginBottom: '12px',
            padding: '8px',
            background: '#f8f9fa',
            borderRadius: '8px'
          }}>
            {transcript.length === 0 ? (
              <p style={{ color: '#666', fontSize: '14px', margin: 0 }}>
                Conversation will appear here...
              </p>
            ) : (
              transcript.map((msg, i) => (
                <div
                  key={i}
                  style={{
                    marginBottom: '8px',
                    textAlign: msg.role === 'user' ? 'right' : 'left'
                  }}
                >
                  <span style={{
                    background: msg.role === 'user' ? '#12A594' : '#333',
                    color: '#fff',
                    padding: '8px 12px',
                    borderRadius: '12px',
                    display: 'inline-block',
                    fontSize: '14px',
                    maxWidth: '80%'
                  }}>
                    {msg.text}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
      
      <style>{`
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.5; }
          100% { opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default VapiWidget;
