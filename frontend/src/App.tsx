import React, { useState, useEffect, useRef } from 'react';
import io, { Socket } from 'socket.io-client';
import * as faceapi from 'face-api.js';
import './App.css';

// Detect if running in Docker, local dev, or production build
const BACKEND_URL = process.env.NODE_ENV === 'production'
  ? '/'  // Production (Same domain)
  : (window.location.hostname === 'localhost' && window.location.port === '3000'
    ? 'http://localhost:5001'  // Local Development
    : `http://${window.location.hostname}:5001`); // Docker/Network

function App() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [sessionId, setSessionId] = useState<string>('');
  const [joinSessionId, setJoinSessionId] = useState<string>('');
  const [inSession, setInSession] = useState(false);

  // Admin/Participant roles
  const [isAdmin, setIsAdmin] = useState(false);
  const [sessionDuration, setSessionDuration] = useState(30); // minutes

  // Admin states
  const [referenceUploaded, setReferenceUploaded] = useState(false);
  const [matchedParticipants, setMatchedParticipants] = useState<any[]>([]);
  const [totalParticipants, setTotalParticipants] = useState(0);
  const [matchedCount, setMatchedCount] = useState(0);

  // Participant states
  const [participantName, setParticipantName] = useState('');
  const [verificationResult, setVerificationResult] = useState<any>(null);

  // Common states
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string>('');
  const [shareLink, setShareLink] = useState<string>('');
  const [selectedImage, setSelectedImage] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize socket connection
  useEffect(() => {
    const newSocket = io(BACKEND_URL);
    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, []);

  // Check for session ID in URL and auto-join
  useEffect(() => {
    if (!socket || !modelsLoaded) return;

    const urlParams = new URLSearchParams(window.location.search);
    const sessionFromUrl = urlParams.get('session');

    if (sessionFromUrl && !inSession) {
      setJoinSessionId(sessionFromUrl);
      // Auto-join after a short delay
      setTimeout(() => {
        socket.emit('join-session', sessionFromUrl.toUpperCase(), (response: { success: boolean; sessionId?: string; isAdmin?: boolean; error?: string }) => {
          if (response.success) {
            setSessionId(sessionFromUrl.toUpperCase());
            setInSession(true);
            setIsAdmin(response.isAdmin || false);
            setError('');
            window.history.replaceState({}, '', window.location.pathname);
          } else {
            setError(response.error || 'Failed to join session');
          }
        });
      }, 500);
    }
  }, [socket, modelsLoaded, inSession]);

  // Load face-api models
  useEffect(() => {
    const loadModels = async () => {
      try {
        const MODEL_URL = '/models';
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
        ]);
        setModelsLoaded(true);
        console.log('✅ Face detection models loaded successfully');
      } catch (err) {
        console.error('❌ Error loading models:', err);
        setError('Failed to load face detection models');
      }
    };

    loadModels();
  }, []);

  // Socket event listeners
  useEffect(() => {
    if (!socket) return;

    // For admin: someone joined
    socket.on('participant-joined', ({ participantCount }: any) => {
      console.log('Participant joined, count:', participantCount);
    });

    // For admin: gallery updated with new match
    socket.on('gallery-updated', ({ participants, totalParticipants: total, matchedCount: matched }: any) => {
      console.log('Gallery updated:', matched, 'matches out of', total);
      setMatchedParticipants(participants);
      setTotalParticipants(total);
      setMatchedCount(matched);
    });

    // For participant: verification result
    socket.on('verification-result', (result: any) => {
      console.log('Verification result received:', result.matched);
      setVerificationResult(result);
      setProcessing(false);
    });

    return () => {
      socket.off('participant-joined');
      socket.off('gallery-updated');
      socket.off('verification-result');
    };
  }, [socket]);

  const createSession = () => {
    if (!socket) return;

    socket.emit('create-session', { durationMinutes: sessionDuration }, (response: { success: boolean; sessionId: string; isAdmin: boolean; error?: string }) => {
      if (response.success) {
        setSessionId(response.sessionId);
        setInSession(true);
        setIsAdmin(response.isAdmin);
        setError('');
        // Generate shareable link
        const link = `${window.location.origin}?session=${response.sessionId}`;
        setShareLink(link);
      } else {
        setError(response.error || 'Failed to create session');
      }
    });
  };

  const joinSession = () => {
    if (!socket || !joinSessionId) return;

    socket.emit('join-session', joinSessionId.toUpperCase(), (response: { success: boolean; sessionId?: string; isAdmin?: boolean; error?: string }) => {
      if (response.success) {
        setSessionId(joinSessionId.toUpperCase());
        setInSession(true);
        setIsAdmin(response.isAdmin || false);
        setError('');
      } else {
        setError(response.error || 'Failed to join session');
      }
    });
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !modelsLoaded) return;

    console.log('📸 Processing image:', file.name, 'Size:', (file.size / 1024).toFixed(2), 'KB');
    setProcessing(true);
    setError('');

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const imageData = e.target?.result as string;
        setSelectedImage(imageData);

        const img = new Image();
        img.src = imageData;

        img.onload = async () => {
          try {
            console.log('🖼️ Image loaded:', img.width, 'x', img.height);
            console.time('Face Detection');

            const detection = await faceapi
              .detectSingleFace(img, new faceapi.TinyFaceDetectorOptions({
                inputSize: 224,
                scoreThreshold: 0.5
              }))
              .withFaceLandmarks()
              .withFaceDescriptor();

            console.timeEnd('Face Detection');

            if (!detection) {
              console.error('❌ No face detected');
              setError('No face detected in the image. Please upload a clear photo of your face.');
              setProcessing(false);
              setSelectedImage('');
              return;
            }

            console.log('✅ Face detected! Descriptor length:', detection.descriptor.length);

            const faceDescriptor = Array.from(detection.descriptor);

            // Different actions for admin vs participant
            if (isAdmin) {
              // Admin uploads reference image
              console.log('📤 Uploading reference image...');
              socket?.emit('upload-reference-image', {
                sessionId,
                image: imageData,
                faceDescriptor
              }, (response: { success: boolean; error?: string }) => {
                if (response.success) {
                  console.log('✅ Reference image uploaded');
                  setReferenceUploaded(true);
                  setProcessing(false);
                } else {
                  console.error('❌ Upload failed:', response.error);
                  setError(response.error || 'Failed to upload reference image');
                  setProcessing(false);
                }
              });
            } else {
              // Participant uploads for verification
              console.log('📤 Uploading for verification...');
              socket?.emit('upload-participant-image', {
                sessionId,
                image: imageData,
                faceDescriptor,
                name: participantName
              }, (response: { success: boolean; error?: string }) => {
                if (response.success) {
                  console.log('✅ Upload successful, waiting for result');
                } else {
                  console.error('❌ Upload failed:', response.error);
                  setError(response.error || 'Failed to upload image');
                  setProcessing(false);
                }
              });
            }

          } catch (err) {
            console.error('❌ Face detection error:', err);
            setError('Error processing face. Please try another image.');
            setProcessing(false);
            setSelectedImage('');
          }
        };

        img.onerror = () => {
          console.error('❌ Failed to load image');
          setError('Failed to load image. Please try a different file.');
          setProcessing(false);
        };
      };

      reader.readAsDataURL(file);

    } catch (err) {
      console.error('❌ File reading error:', err);
      setError('Error reading file');
      setProcessing(false);
    }
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(shareLink);
      alert('Link copied to clipboard!');
    } catch (err) {
      console.error('Failed to copy:', err);
      alert('Please copy the link manually');
    }
  };

  const resetSession = () => {
    setSessionId('');
    setJoinSessionId('');
    setInSession(false);
    setIsAdmin(false);
    setReferenceUploaded(false);
    setMatchedParticipants([]);
    setTotalParticipants(0);
    setMatchedCount(0);
    setParticipantName('');
    setVerificationResult(null);
    setProcessing(false);
    setError('');
    setSelectedImage('');
    setShareLink('');
  };

  return (
    <div className="App">
      <div className="container">
        <h1>🔐 Face Verify</h1>
        <p className="subtitle">
          {isAdmin ? 'Verify multiple identities against your reference' : 'Privacy-focused identity verification'}
        </p>

        {!modelsLoaded && (
          <div className="status">
            <div className="spinner"></div>
            Loading face detection models...
          </div>
        )}

        {error && <div className="error">{error}</div>}

        {!inSession ? (
          <div className="session-controls">
            <div>
              <label>Session Duration (minutes):</label>
              <input
                type="number"
                min="5"
                max="120"
                value={sessionDuration}
                onChange={(e) => setSessionDuration(parseInt(e.target.value) || 30)}
                style={{ marginLeft: '10px', padding: '5px' }}
              />
            </div>

            <button
              className="btn btn-primary"
              onClick={createSession}
              disabled={!modelsLoaded || !socket}
            >
              Create New Session
            </button>

            <div className="input-group">
              <input
                type="text"
                placeholder="SESSION ID"
                value={joinSessionId}
                onChange={(e) => setJoinSessionId(e.target.value)}
                maxLength={8}
              />
              <button
                className="btn btn-secondary"
                onClick={joinSession}
                disabled={!modelsLoaded || !socket || !joinSessionId}
              >
                Join Session
              </button>
            </div>
          </div>
        ) : (
          <>
            {isAdmin ? (
              // ADMIN VIEW
              <>
                <div className="session-info">
                  <div className="status">Session ID:</div>
                  <div className="session-id">{sessionId}</div>

                  {shareLink && (
                    <div className="share-link-container">
                      <div className="status" style={{ marginTop: '15px' }}>Share this link:</div>
                      <div className="share-link-box">
                        <input
                          type="text"
                          value={shareLink}
                          readOnly
                          className="share-link-input"
                          onClick={(e) => (e.target as HTMLInputElement).select()}
                        />
                        <button
                          className="btn btn-copy"
                          onClick={copyToClipboard}
                        >
                          📋 Copy
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="status" style={{ marginTop: '15px' }}>
                    Duration: {sessionDuration} minutes
                  </div>
                </div>

                {!referenceUploaded && !processing && (
                  <div className="upload-section">
                    <h3>Step 1: Upload Your Reference Photo</h3>
                    <div
                      className="upload-area"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <h3>📸 Upload Your Photo</h3>
                      <p>This will be used to verify participants</p>
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileSelect}
                      style={{ display: 'none' }}
                    />
                  </div>
                )}

                {processing && (
                  <div className="status">
                    <div className="spinner"></div>
                    Processing your photo...
                  </div>
                )}

                {selectedImage && referenceUploaded && (
                  <div className="preview-section">
                    <h3>✓ Reference Photo Uploaded</h3>
                    <img src={selectedImage} alt="Reference" className="preview-image" />
                  </div>
                )}

                {referenceUploaded && (
                  <>
                    <div className="admin-stats">
                      <h3>Participant Status</h3>
                      <p>Total Submissions: {totalParticipants} | Matched: {matchedCount}</p>
                    </div>

                    {matchedParticipants.length > 0 && (
                      <div className="gallery-section">
                        <h3>✓ Verified Participants</h3>
                        <div className="participants-grid">
                          {matchedParticipants.map((participant, index) => (
                            <div key={index} className="participant-card">
                              <img src={participant.image} alt={participant.name} />
                              <div className="participant-info">
                                <strong>{participant.name}</strong>
                                <small>Match: {(1 - participant.matchDistance).toFixed(2)}%</small>
                                <small>{new Date(participant.timestamp).toLocaleTimeString()}</small>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}

                <button
                  className="btn btn-primary"
                  onClick={resetSession}
                  style={{ marginTop: '30px' }}
                >
                  End Session
                </button>
              </>
            ) : (
              // PARTICIPANT VIEW
              <>
                <div className="session-info">
                  <div className="status">Verifying with Session:</div>
                  <div className="session-id">{sessionId}</div>
                </div>

                {!verificationResult && (
                  <div className="upload-section">
                    <h3>Verify Your Identity</h3>

                    <div style={{ marginBottom: '20px' }}>
                      <label>Your Name (optional):</label>
                      <input
                        type="text"
                        placeholder="Enter your name"
                        value={participantName}
                        onChange={(e) => setParticipantName(e.target.value)}
                        style={{ width: '100%', padding: '10px', marginTop: '5px' }}
                        disabled={processing}
                      />
                    </div>

                    <div
                      className={`upload-area ${processing ? 'processing' : ''}`}
                      onClick={() => !processing && fileInputRef.current?.click()}
                    >
                      {processing ? (
                        <>
                          <div className="spinner"></div>
                          Verifying your identity...
                        </>
                      ) : (
                        <>
                          <h3>📸 Upload Your Photo</h3>
                          <p>Click to select a clear photo of your face</p>
                        </>
                      )}
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileSelect}
                      style={{ display: 'none' }}
                    />
                  </div>
                )}

                {verificationResult && (
                  <div className={`results ${verificationResult.matched ? 'matched' : 'not-matched'}`}>
                    <h2>{verificationResult.matched ? '✓ Identity Verified!' : '✗ Verification Failed'}</h2>
                    <p>
                      {verificationResult.matched
                        ? 'Your identity has been successfully verified!'
                        : 'Your photo does not match the session holder. Please ensure you are the correct person.'}
                    </p>

                    {verificationResult.matched && verificationResult.referenceImage && (
                      <div className="images-grid">
                        <div className="image-container">
                          <h3>Session Holder</h3>
                          <img src={verificationResult.referenceImage} alt="Reference" className="preview-image" />
                        </div>
                        <div className="image-container">
                          <h3>You</h3>
                          <img src={verificationResult.participantImage} alt="Your photo" className="preview-image" />
                        </div>
                      </div>
                    )}

                    <button
                      className="btn btn-primary"
                      onClick={resetSession}
                      style={{ marginTop: '30px' }}
                    >
                      Done
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default App;
