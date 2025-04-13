// src/components/System/Lobby.js
import React, { useEffect, useState, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import LobbyLayout from './LobbyLayout';
import NoteSubmitter from '../notes/NoteSubmitter';
import { useAuth } from '../../context/AuthContext';

// Get the API base URL from environment or use default
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000';
const WS_BASE_URL = API_BASE_URL.replace('http', 'ws'); // Convert http to ws for WebSocket

function Lobby() {
  const { lobbyId } = useParams();
  const navigate = useNavigate();
  const { token, username } = useAuth();

  const [lobbyDetails, setLobbyDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [isCreator, setIsCreator] = useState(false);
  
  // WebSocket connection
  const [wsConnected, setWsConnected] = useState(false);
  const webSocketRef = useRef(null);
  const [participantCount, setParticipantCount] = useState(1);

  // States for Settings Modal
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  // For editing settings, if lobbyDetails contains advanced_settings then initialize from it
  const [editedSettings, setEditedSettings] = useState({
    numConceptsStudent: 10,
    numConceptsClass: 15,
    similarityThresholdUpdate: 0.75,
    similarityThresholdAnalyze: 0.8,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  // State for delete functionality
  const [password, setPassword] = useState('');
  const [deleteError, setDeleteError] = useState('');

  // WebSocket connection setup
  useEffect(() => {
    if (!token || !lobbyId) return;
    
    // Create WebSocket connection
    const wsUrl = `${WS_BASE_URL}/ws/${lobbyId}`;
    console.log(`Connecting to WebSocket at: ${wsUrl}`);
    
    const ws = new WebSocket(wsUrl);
    webSocketRef.current = ws;
    
    ws.onopen = () => {
      console.log('WebSocket connected');
      setWsConnected(true);
      // Send join event to notify others
      ws.send(JSON.stringify({
        event: 'join',
        username: username,
        timestamp: new Date().toISOString()
      }));
    };
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('WebSocket message received:', data);
        
        // Handle different types of events
        if (data.event === 'join') {
          // Someone joined - could update participant count
          setParticipantCount(prev => prev + 1);
        } else if (data.event === 'disconnect') {
          // Someone left
          setParticipantCount(prev => Math.max(1, prev - 1));
        } else if (data.event === 'new_note') {
          // New note was added - you can trigger a refresh or directly update the UI
          // This depends on your implementation
        }
      } catch (err) {
        console.error('Error parsing WebSocket message:', err);
      }
    };
    
    ws.onclose = () => {
      console.log('WebSocket disconnected');
      setWsConnected(false);
    };
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setWsConnected(false);
    };
    
    // Cleanup on component unmount
    return () => {
      if (webSocketRef.current) {
        webSocketRef.current.close();
      }
    };
  }, [lobbyId, token, username]);

  // Fetch lobby details and initialize settings
  useEffect(() => {
    setLobbyDetails(null);
    setErrorMessage('');
    setLoading(true);

    axios
      .get(`${API_BASE_URL}/lobby/lobbies/${lobbyId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((response) => {
        setLobbyDetails(response.data);
        // Check if current user is the creator
        setIsCreator(response.data.created_by === username);
        // Initialize the settings to the advanced_settings if available.
        if (response.data?.advanced_settings) {
          setEditedSettings({ ...response.data.advanced_settings });
        }
        // Set initial participant count
        if (response.data.user_count) {
          setParticipantCount(response.data.user_count);
        }
      })
      .catch((error) => {
        console.error("Failed to fetch lobby details:", error);
        setErrorMessage(
          error.response?.data?.detail || 'Error loading lobby details'
        );
      })
      .finally(() => {
        setLoading(false);
      });
  }, [lobbyId, token, username]);

  // Increment user count when joining the lobby
  useEffect(() => {
    if (lobbyId && token && !loading && lobbyDetails) {
      axios
        .put(`${API_BASE_URL}/lobby/lobbies/${lobbyId}/increment-user-count`, {}, {
          headers: { Authorization: `Bearer ${token}` },
        })
        .catch((err) => {
          console.error("Failed to increment user count:", err);
        });
    }
  }, [lobbyId, token, loading, lobbyDetails]);

  const handleSettingsClick = () => {
    // Reset edited settings to current lobby details (if any) when opening the modal
    if (lobbyDetails?.advanced_settings) {
      setEditedSettings({ ...lobbyDetails.advanced_settings });
    }
    // Clear any previous errors
    setDeleteError('');
    setSaveError('');
    setShowSettingsModal(true);
  };

  const handleSettingsChange = (e) => {
    const { name, value } = e.target;
    setEditedSettings((prev) => ({
      ...prev,
      [name]: name.includes("numConcepts") ? parseInt(value, 10) : parseFloat(value),
    }));
  };

  const handleSaveSettings = async () => {
    if (!editedSettings) return;

    setIsSaving(true);
    setSaveError('');

    try {
      await axios.put(
        `${API_BASE_URL}/lobby/lobbies/${lobbyId}/update-settings`,
        { advanced_settings: editedSettings },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Update local lobby details with the new advanced settings
      setLobbyDetails((prev) => ({
        ...prev,
        advanced_settings: { ...editedSettings }
      }));

      // Broadcast settings update to all users in the lobby
      if (webSocketRef.current && webSocketRef.current.readyState === WebSocket.OPEN) {
        webSocketRef.current.send(JSON.stringify({
          event: 'settings_updated',
          settings: editedSettings,
          updatedBy: username
        }));
      }

      setShowSettingsModal(false);
    } catch (error) {
      console.error("Failed to save settings:", error);
      setSaveError(error.response?.data?.detail || 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = () => {
    // Require a password before deletion
    if (!password.trim()) {
      setDeleteError('Password is required to delete the lobby');
      return;
    }

    axios
      .delete(`${API_BASE_URL}/lobby/lobbies/${lobbyId}`, {
        data: { password },
        headers: { Authorization: `Bearer ${token}` },
      })
      .then(() => {
        // Notify all users that the lobby was deleted
        if (webSocketRef.current && webSocketRef.current.readyState === WebSocket.OPEN) {
          webSocketRef.current.send(JSON.stringify({
            event: 'lobby_deleted',
            deletedBy: username
          }));
        }
        
        setShowSettingsModal(false);
        navigate('/');
      })
      .catch((err) =>
        setDeleteError(err.response?.data?.detail || 'Deletion failed')
      );
  };

  // Handle WebSocket events for lobby deletion
  useEffect(() => {
    // Function to handle lobby_deleted event
    const handleLobbyDeleted = (data) => {
      alert(`This lobby has been deleted by ${data.deletedBy}`);
      navigate('/');
    };

    // Add event listener for the lobby_deleted event
    if (webSocketRef.current) {
      const socket = webSocketRef.current;
      const onMessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.event === 'lobby_deleted') {
            handleLobbyDeleted(data);
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };
      
      socket.addEventListener('message', onMessage);
      
      // Clean up the event listener
      return () => {
        socket.removeEventListener('message', onMessage);
      };
    }
  }, [navigate]);

  return (
    <LobbyLayout>
      <div className="min-h-screen px-6 pt-12 pb-24 bg-gradient-to-br from-indigo-900 via-purple-800 to-fuchsia-900 text-white animate-fadeIn">
        <div className="max-w-4xl mx-auto relative">
          {/* WebSocket Status Indicator */}
          <div className="absolute top-2 right-2">
            <div className={`flex items-center ${wsConnected ? 'text-green-400' : 'text-red-400'}`}>
              <div className={`w-3 h-3 rounded-full mr-2 ${wsConnected ? 'bg-green-400' : 'bg-red-400'}`}></div>
              <span className="text-xs">{wsConnected ? 'Connected' : 'Disconnected'}</span>
            </div>
            {wsConnected && (
              <div className="text-xs text-purple-300 mt-1">
                {participantCount} {participantCount === 1 ? 'participant' : 'participants'}
              </div>
            )}
          </div>
          
          {/* Header with Settings Icon - Only show for creator */}
          {isCreator && (
            <div className="absolute -top-4 -right-4 z-10">
              <button 
                onClick={handleSettingsClick}
                className="bg-white/40 p-4 rounded-xl hover:bg-white/60 active:bg-purple-500/60 transition-all duration-200 shadow-xl hover:shadow-purple-500/40 w-16 h-16 flex items-center justify-center border-2 border-white/30"
                title="Lobby Settings"
                aria-label="Open Settings Menu"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-10 h-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c-.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
            </div>
          )}
          
          <div className="text-center mb-12">
            {loading ? (
              <h2 className="text-4xl font-extrabold tracking-wide text-white drop-shadow-lg mb-2">
                Loading...
              </h2>
            ) : errorMessage ? (
              <h2 className="text-4xl font-extrabold tracking-wide text-red-400 drop-shadow-lg mb-2">
                {errorMessage}
              </h2>
            ) : (
              <>
                <h2 className="text-4xl font-extrabold tracking-wide text-white drop-shadow-lg mb-2">
                  {lobbyDetails.lobby_name}
                </h2>
                {lobbyDetails.created_by && (
                  <p className="text-purple-300 text-xs font-medium mb-1">
                    Created by: {lobbyDetails.created_by} {isCreator && <span className="bg-purple-500/30 px-2 py-0.5 rounded-full text-[10px] ml-1">You</span>}
                  </p>
                )}
              </>
            )}
            <p className="text-purple-200 text-sm font-medium">
              Welcome to your personal note-taking lounge ✨
            </p>
          </div>
        </div>

        {/* Pass advanced settings to the NoteSubmitter – either from lobbyDetails if available or fallback */}
        {!loading && !errorMessage && (
          <NoteSubmitter
            lobbyId={lobbyId}
            advancedSettings={(lobbyDetails && lobbyDetails.advanced_settings) || editedSettings}
          />
        )}

        {/* Settings Modal - Only shown if user is creator AND modal is open */}
        {showSettingsModal && isCreator && lobbyDetails && editedSettings && (
          <div
            className="fixed inset-0 bg-black/70 flex items-center justify-center z-[9999] backdrop-blur-sm animate-fadeIn"
            onClick={() => setShowSettingsModal(false)}
          >
            <div
              className="bg-gradient-to-br from-purple-900/90 to-indigo-900/90 backdrop-blur-xl border border-purple-500/30 rounded-xl shadow-2xl p-6 w-full max-w-md transform animate-popIn max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-6 border-b border-purple-400/30 pb-3">
                <h3 className="text-2xl font-bold text-white">Advanced Settings</h3>
                <button
                  onClick={() => setShowSettingsModal(false)}
                  className="text-white bg-purple-700/50 hover:bg-purple-700/80 p-2 rounded-lg transition-colors w-10 h-10 flex items-center justify-center"
                  aria-label="Close settings modal"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              {/* Editable Settings Form */}
              <div className="grid grid-cols-1 gap-4 mb-8">
                <div className="bg-white/10 p-4 rounded-lg shadow-inner hover:bg-white/15 transition-colors">
                  <label className="block text-sm font-medium text-purple-200 mb-1">
                    Student Concepts Count
                  </label>
                  <input
                    type="number"
                    name="numConceptsStudent"
                    value={editedSettings.numConceptsStudent}
                    onChange={handleSettingsChange}
                    className="w-full bg-white/20 border border-purple-400/30 rounded-lg p-2 text-white font-bold text-xl"
                    min="1"
                    max="50"
                  />
                </div>
                <div className="bg-white/10 p-4 rounded-lg shadow-inner hover:bg-white/15 transition-colors">
                  <label className="block text-sm font-medium text-purple-200 mb-1">
                    Class Concepts Count
                  </label>
                  <input
                    type="number"
                    name="numConceptsClass"
                    value={editedSettings.numConceptsClass}
                    onChange={handleSettingsChange}
                    className="w-full bg-white/20 border border-purple-400/30 rounded-lg p-2 text-white font-bold text-xl"
                    min="1"
                    max="50"
                  />
                </div>
                <div className="bg-white/10 p-4 rounded-lg shadow-inner hover:bg-white/15 transition-colors">
                  <label className="block text-sm font-medium text-purple-200 mb-1">
                    Update Threshold
                  </label>
                  <input
                    type="number"
                    step="0.05"
                    name="similarityThresholdUpdate"
                    value={editedSettings.similarityThresholdUpdate}
                    onChange={handleSettingsChange}
                    className="w-full bg-white/20 border border-purple-400/30 rounded-lg p-2 text-white font-bold text-xl"
                    min="0"
                    max="1"
                  />
                </div>
                <div className="bg-white/10 p-4 rounded-lg shadow-inner hover:bg-white/15 transition-colors">
                  <label className="block text-sm font-medium text-purple-200 mb-1">
                    Analyze Threshold
                  </label>
                  <input
                    type="number"
                    step="0.05"
                    name="similarityThresholdAnalyze"
                    value={editedSettings.similarityThresholdAnalyze}
                    onChange={handleSettingsChange}
                    className="w-full bg-white/20 border border-purple-400/30 rounded-lg p-2 text-white font-bold text-xl"
                    min="0"
                    max="1"
                  />
                </div>
              </div>

              {/* Save Settings Button */}
              {saveError && (
                <div className="mb-4 bg-red-500/20 border border-red-500 p-3 rounded-lg text-red-200">
                  {saveError}
                </div>
              )}
              <button
                onClick={handleSaveSettings}
                disabled={isSaving}
                className="w-full mb-4 py-3 bg-gradient-to-r from-purple-600 to-indigo-700 hover:from-purple-700 hover:to-indigo-800 text-white font-bold rounded-lg shadow-lg transition-all hover:shadow-purple-500/30"
              >
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>

              {/* Delete Lobby Section */}
              <div className="mt-8 pt-6 border-t border-purple-400/30">
                <h4 className="text-xl font-bold text-white mb-4">Delete Lobby</h4>
                <div className="bg-red-900/20 p-4 rounded-lg border border-red-500/30">
                  <input
                    type="password"
                    placeholder="Enter password to delete lobby"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full mb-3 p-3 bg-black/30 border border-red-500/40 rounded-lg text-white"
                  />
                  {deleteError && (
                    <div className="mb-3 text-red-300 text-sm">
                      {deleteError}
                    </div>
                  )}
                  <button
                    onClick={handleDelete}
                    className="w-full py-3 bg-gradient-to-r from-red-600 to-red-800 hover:from-red-700 hover:to-red-900 text-white font-bold rounded-lg shadow-lg transition-all hover:shadow-red-500/30 flex items-center justify-center"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Delete Lobby
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="text-center mt-12">
          <Link
            to="/"
            className="inline-block bg-gradient-to-r from-pink-500 to-purple-600 hover:from-purple-600 hover:to-pink-500 text-white font-semibold px-6 py-3 rounded-full shadow-lg hover:shadow-pink-400/40 transition transform hover:scale-105"
          >
            ⬅ Back to Home
          </Link>
        </div>
      </div>
    </LobbyLayout>
  );
}

export default Lobby;
