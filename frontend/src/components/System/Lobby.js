import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import LobbyLayout from './LobbyLayout';
import NoteSubmitter from '../notes/NoteSubmitter';
import { useAuth } from '../../context/AuthContext';

function Lobby() {
  const { lobbyId } = useParams();
  const navigate = useNavigate();
  const { token, username } = useAuth();

  const [lobbyDetails, setLobbyDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [isCreator, setIsCreator] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [password, setPassword] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [activeTab, setActiveTab] = useState('general');

  useEffect(() => {
    setLobbyDetails(null);
    setErrorMessage('');
    setLoading(true);

    axios
      .get(`http://localhost:8000/lobby/lobbies/${lobbyId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((response) => {
        setLobbyDetails(response.data);
        setIsCreator(response.data.created_by === username);
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

  const handleSettingsClick = () => {
    setDeleteError('');
    setShowSettingsModal(true);
  };

  const handleDelete = () => {
    if (!password.trim()) {
      setDeleteError('Password is required to delete the lobby');
      return;
    }

    axios
      .delete(`http://localhost:8000/lobby/lobbies/${lobbyId}`, {
        data: { password },
        headers: { Authorization: `Bearer ${token}` },
      })
      .then(() => {
        setShowSettingsModal(false);
        navigate('/');
      })
      .catch((err) =>
        setDeleteError(err.response?.data?.detail || 'Deletion failed')
      );
  };

  return (
    
    <LobbyLayout>
      <div className="min-h-screen px-6 pt-12 pb-24 bg-gradient-to-br from-indigo-900 via-purple-800 to-fuchsia-900 text-white animate-fadeIn">
        <div className="max-w-4xl mx-auto relative">
          {isCreator && (
            <div className="absolute -top-4 -right-4 z-10">
              <button 
                onClick={handleSettingsClick}
                className="bg-white/40 p-4 rounded-xl hover:bg-white/60 active:bg-purple-500/60 transition-all duration-200 shadow-xl hover:shadow-purple-500/40 w-16 h-16 flex items-center justify-center border-2 border-white/30 group"
                title="Lobby Settings"
                aria-label="Open Settings Menu"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-10 h-10 group-hover:rotate-45 transition-transform duration-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c-.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
            </div>
          )}
          
          <div className="text-center mb-12 transform transition-all duration-300 hover:scale-105">
            {loading ? (
              <div className="animate-pulse">
                <div className="h-12 bg-purple-400/20 rounded-lg w-64 mx-auto mb-4"></div>
                <div className="h-4 bg-purple-400/20 rounded w-32 mx-auto"></div>
              </div>
            ) : errorMessage ? (
              <div className="bg-red-500/20 p-4 rounded-xl border border-red-500/30">
                <h2 className="text-4xl font-extrabold tracking-wide text-red-400 drop-shadow-lg mb-2">
                  {errorMessage}
                </h2>
              </div>
            ) : (
              <>
                <h2 className="text-4xl font-extrabold tracking-wide text-white drop-shadow-lg mb-2 animate-fadeIn">
                  {lobbyDetails.lobby_name}
                </h2>
                {lobbyDetails.description && (
                  <p className="text-purple-200 text-sm font-medium mb-2 max-w-2xl mx-auto">
                    {lobbyDetails.description}
                  </p>
                )}
              </>
            )}
          </div>
        </div>

        {!loading && !errorMessage && (
          <NoteSubmitter lobbyId={lobbyId} advancedSettings={lobbyDetails?.advancedSettings} />
        )}

        {showSettingsModal && isCreator && lobbyDetails && (
          <div
            className="fixed inset-0 bg-black/70 flex items-center justify-center z-[9999] backdrop-blur-sm animate-fadeIn"
            onClick={() => setShowSettingsModal(false)}
          >
            <div
              className="bg-gradient-to-br from-purple-900/90 to-indigo-900/90 backdrop-blur-xl border border-purple-500/30 rounded-xl shadow-2xl p-6 w-full max-w-md transform animate-popIn max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-6 border-b border-purple-400/30 pb-3">
                <h3 className="text-2xl font-bold text-white">Lobby Settings</h3>
                <button
                  onClick={() => setShowSettingsModal(false)}
                  className="text-white bg-purple-700/50 hover:bg-purple-700/80 p-2 rounded-lg transition-colors w-10 h-10 flex items-center justify-center hover:rotate-90 transform duration-300"
                  aria-label="Close settings modal"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Settings Tabs */}
              <div className="flex space-x-4 mb-6 border-b border-purple-400/30 pb-4">
                <button
                  onClick={() => setActiveTab('general')}
                  className={`px-4 py-2 rounded-lg transition-all duration-200 ${
                    activeTab === 'general'
                      ? 'bg-purple-600 text-white'
                      : 'text-purple-300 hover:bg-purple-600/30'
                  }`}
                >
                  General
                </button>
                <button
                  onClick={() => setActiveTab('security')}
                  className={`px-4 py-2 rounded-lg transition-all duration-200 ${
                    activeTab === 'security'
                      ? 'bg-purple-600 text-white'
                      : 'text-purple-300 hover:bg-purple-600/30'
                  }`}
                >
                  Security
                </button>
              </div>

              {/* General Settings Tab */}
              {activeTab === 'general' && (
                <div className="space-y-4">
                  <div className="bg-purple-800/30 p-4 rounded-lg border border-purple-500/30">
                    <h4 className="text-lg font-semibold text-white mb-2">Lobby Information</h4>
                    <div className="space-y-2">
                      <p className="text-purple-200 text-sm">
                        <span className="font-medium">Name:</span> {lobbyDetails.lobby_name}
                      </p>
                      {lobbyDetails.description && (
                        <p className="text-purple-200 text-sm">
                          <span className="font-medium">Description:</span> {lobbyDetails.description}
                        </p>
                      )}
                      <p className="text-purple-200 text-sm">
                        <span className="font-medium">Created by:</span> {lobbyDetails.created_by}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Security Settings Tab */}
              {activeTab === 'security' && (
                <div className="space-y-4">
                  <div className="bg-red-900/20 p-4 rounded-lg border border-red-500/30">
                    <h4 className="text-xl font-bold text-white mb-4">Delete Lobby</h4>
                    <p className="text-red-200 text-sm mb-4">This action cannot be undone. All notes and data will be permanently deleted.</p>
                    <input
                      type="password"
                      placeholder="Enter password to delete lobby"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full mb-3 p-3 bg-black/30 border border-red-500/40 rounded-lg text-white focus:ring-2 focus:ring-red-500/50 focus:border-red-500 transition-all"
                    />
                    {deleteError && (
                      <div className="mb-3 text-red-300 text-sm bg-red-900/30 p-2 rounded-lg">
                        {deleteError}
                      </div>
                    )}
                    <button
                      onClick={handleDelete}
                      className="w-full py-3 bg-gradient-to-r from-red-600 to-red-800 hover:from-red-700 hover:to-red-900 text-white font-bold rounded-lg shadow-lg transition-all hover:shadow-red-500/30 flex items-center justify-center group"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 group-hover:rotate-12 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Delete Lobby
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="text-center mt-12">
          <Link
            to="/"
            className="inline-block bg-gradient-to-r from-pink-500 to-purple-600 hover:from-purple-600 hover:to-pink-500 text-white font-semibold px-6 py-3 rounded-full shadow-lg hover:shadow-pink-400/40 transition-all transform hover:scale-105 hover:-translate-y-1 duration-300"
          >
            ⬅ Back to Home
          </Link>
          
        </div>
      </div>
    </LobbyLayout>
  );
}

export default Lobby;
