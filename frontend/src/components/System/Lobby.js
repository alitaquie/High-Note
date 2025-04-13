// src/components/System/Lobby.js
import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import NoteSubmitter from '../notes/NoteSubmitter';
import axios from 'axios';
import LobbyLayout from './LobbyLayout';
import { useAuth } from '../../context/AuthContext';

function Lobby() {
  const { lobbyId } = useParams();
  const [lobbyDetails, setLobbyDetails] = useState(null);
  const [password, setPassword] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const navigate = useNavigate();
  const { token } = useAuth();

  // Advanced settings with separasate concept counts for student and class,
  // plus thresholds.
  const [advancedSettings, setAdvancedSettings] = useState({
    numConceptsStudent: 10,
    numConceptsClass: 15,
    similarityThresholdUpdate: 0.75,
    similarityThresholdAnalyze: 0.8,
  });

  const handleSettingsChange = (e) => {
    const { name, value } = e.target;
    setAdvancedSettings((prev) => ({
      ...prev,
      [name]:
        name.includes("numConcepts")
          ? parseInt(value, 10)
          : parseFloat(value),
    }));
  };

  useEffect(() => {
    setLobbyDetails(null);
    axios
      .get(`http://localhost:8000/lobby/lobbies/${lobbyId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((response) => {
        console.log("Lobby details:", response.data);
        setLobbyDetails(response.data);
      })
      .catch((error) => {
        console.error("Failed to fetch lobby details:", error);
        setLobbyDetails({ lobby_name: "Error loading lobby" });
      });
  }, [lobbyId, token]);

  const handleDelete = () => {
    axios
      .delete(`http://localhost:8000/lobby/lobbies/${lobbyId}`, {
        data: { password },
        headers: { Authorization: `Bearer ${token}` },
      })
      .then(() => navigate('/'))
      .catch((err) =>
        setDeleteError(err.response?.data?.detail || 'Deletion failed')
      );
  };

  return (
    <LobbyLayout>
      <div className="min-h-screen px-6 pt-12 pb-24 bg-gradient-to-br from-indigo-900 via-purple-800 to-fuchsia-900 text-white animate-fadeIn">
        <div className="max-w-4xl mx-auto text-center mb-12">
          <h2 className="text-4xl font-extrabold tracking-wide text-white drop-shadow-lg mb-2">
            {lobbyDetails?.lobby_name || 'Loading...'}
          </h2>
          <p className="text-purple-200 text-sm font-medium">
            {'Welcome to your personal note-taking lounge ✨'}
          </p>
        </div>

        {/* Pass advanced settings as a prop to NoteSubmitter */}
        <NoteSubmitter lobbyId={lobbyId} advancedSettings={advancedSettings} />

        {/* Advanced Settings Section */}
        <div className="mt-10 bg-white/20 p-4 rounded-xl">
          <h3 className="text-xl font-bold mb-2">Advanced Settings</h3>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium">
                Student Concepts Count
              </label>
              <input
                type="number"
                name="numConceptsStudent"
                value={advancedSettings.numConceptsStudent}
                onChange={handleSettingsChange}
                className="mt-1 block w-full rounded-md p-2 text-black"
              />
            </div>
            <div>
              <label className="block text-sm font-medium">
                Class Concepts Count
              </label>
              <input
                type="number"
                name="numConceptsClass"
                value={advancedSettings.numConceptsClass}
                onChange={handleSettingsChange}
                className="mt-1 block w-full rounded-md p-2 text-black"
              />
            </div>
            <div>
              <label className="block text-sm font-medium">
                Update Threshold
              </label>
              <input
                type="number"
                step="0.05"
                name="similarityThresholdUpdate"
                value={advancedSettings.similarityThresholdUpdate}
                onChange={handleSettingsChange}
                className="mt-1 block w-full rounded-md p-2 text-black"
              />
            </div>
            <div>
              <label className="block text-sm font-medium">
                Analyze Threshold
              </label>
              <input
                type="number"
                step="0.05"
                name="similarityThresholdAnalyze"
                value={advancedSettings.similarityThresholdAnalyze}
                onChange={handleSettingsChange}
                className="mt-1 block w-full rounded-md p-2 text-black"
              />
            </div>
          </div>
        </div>

        {/* Existing deletion functionality */}
        <div className="mt-10">
          <input
            type="password"
            placeholder="Enter password to delete lobby"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="px-4 py-2 rounded"
          />
          <button
            onClick={handleDelete}
            className="ml-2 bg-red-500 text-white px-4 py-2 rounded"
          >
            Delete Lobby
          </button>
          {deleteError && <div className="mt-2 text-red-400">{deleteError}</div>}
        </div>

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
