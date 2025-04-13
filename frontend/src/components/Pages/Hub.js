import React, { useState, useEffect } from 'react';
import { Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import CreateLobby from '../System/CreateLobby';
import Lobby from '../System/Lobby';
import AnalysisPage from './AnalysisPage';
import { useAuth } from '../../context/AuthContext';

const Hub = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { token } = useAuth();
  const isLobbyPage = location.pathname.startsWith('/lobby');
  const isAnalysisPage = location.pathname.startsWith('/analysis');
  const [lobbies, setLobbies] = useState([]);
  
  // State for the password modal and lobby selection.
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [selectedLobby, setSelectedLobby] = useState(null);
  const [enteredPassword, setEnteredPassword] = useState('');

  useEffect(() => {
    if (token) {
      axios
        .get('http://localhost:8000/lobby/lobbies', {
          headers: { Authorization: `Bearer ${token}` }
        })
        .then((response) => setLobbies(response.data))
        .catch((error) => console.error('Error fetching lobbies:', error));
    }
  }, [token]);

  // Updated addLobby: now includes advancedSettings parameter
  const addLobby = (lobbyName, description, password, advancedSettings) => {
    axios
      .post(
        'http://localhost:8000/lobby/create-lobby',
        {
          lobby_name: lobbyName,
          description: description,
          user_count: 0, // Changed from 1 to 0
          password: password,
          advanced_settings: advancedSettings
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      )
      .then(() => {
        return axios.get('http://localhost:8000/lobby/lobbies', {
          headers: { Authorization: `Bearer ${token}` }
        });
      })
      .then((response) => setLobbies(response.data))
      .catch((error) => console.error('Error creating lobby:', error));
  };

  if (!token) {
    navigate('/login');
    return null;
  }

  const handleLobbyClick = async (lobby) => {
    try {
      const res = await axios.get(`http://localhost:8000/lobby/lobbies/${lobby.lobby_id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const fullLobby = res.data;
      // If the lobby does not require a password, navigate immediately.
      if (!fullLobby.password) {
        navigate(`/lobby/${lobby.lobby_id}`);
        return;
      }
      // Otherwise, show the password modal.
      setSelectedLobby(fullLobby);
      setShowPasswordModal(true);
    } catch (error) {
      console.error("Error fetching lobby:", error);
      alert("⚠️ Failed to validate lobby access.");
    }
  };

  const handlePasswordSubmit = () => {
    if (enteredPassword === selectedLobby.password) {
      navigate(`/lobby/${selectedLobby.lobby_id}`);
    } else {
      alert("❌ Incorrect password.");
    }
    setShowPasswordModal(false);
    setEnteredPassword('');
    setSelectedLobby(null);
  };

  return (
    <div className={`${isLobbyPage || isAnalysisPage ? '' : 'min-h-screen bg-gradient-to-br from-purple-900 to-indigo-900 text-white'}`}>
      {!isLobbyPage && !isAnalysisPage && (
        <>
          <div className="py-12 px-6 max-w-6xl mx-auto">
            <CreateLobby onCreateLobby={addLobby} />
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8 mt-12">
              {lobbies.map((lobby, index) => {
                const gradients = [
                  'from-fuchsia-600 to-pink-500',
                  'from-indigo-600 to-purple-500',
                  'from-cyan-500 to-blue-500',
                  'from-lime-500 to-emerald-400',
                  'from-yellow-400 to-orange-500',
                ];
                const gradient = gradients[index % gradients.length];
                return (
                  <div
                    key={lobby.lobby_id}
                    onClick={() => handleLobbyClick(lobby)}
                    className="cursor-pointer relative group transform transition duration-500 hover:scale-[1.03] animate-float"
                  >
                    <div className={`bg-gradient-to-br ${gradient} rounded-2xl p-6 shadow-2xl backdrop-blur-md bg-opacity-80 border border-white/20 transition-all duration-300`}>
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-2xl font-bold tracking-wide">{lobby.lobby_name}</h3>
                        <span className="inline-flex items-center px-2 py-1 text-sm font-semibold bg-green-500 text-white rounded-full animate-pulse shadow">
                          🟢 Online
                        </span>
                      </div>
                      <p className="text-sm text-white/90 mb-4">
                        {lobby.description || 'No description provided.'}
                      </p>
                      <div className="flex items-center gap-2 text-sm font-medium text-white/90">
                        <span className="text-lg">👥</span>
                        <span>{lobby.user_count || 0} Active Users</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Password Modal */}
          {showPasswordModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 w-80 relative">
                <button
                  onClick={() => {
                    setShowPasswordModal(false);
                    setEnteredPassword('');
                    setSelectedLobby(null);
                  }}
                  className="absolute top-2 left-2 text-3xl font-bold text-red-600 hover:text-red-800 focus:outline-none"
                >
                  &times;
                </button>
                <h3 className="text-xl font-bold mb-4 text-center text-gray-900 dark:text-gray-100">
                  Enter Lobby Password
                </h3>
                <input 
                  type="password"
                  value={enteredPassword}
                  onChange={(e) => setEnteredPassword(e.target.value)}
                  placeholder="Password"
                  className="w-full p-2 mb-4 border rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900"
                />
                <div className="flex justify-end">
                  <button 
                    onClick={handlePasswordSubmit}
                    className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700"
                  >
                    Submit
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      <Routes>
        <Route path="/lobby/:lobbyId" element={<Lobby />} />
        <Route path="/analysis" element={<AnalysisPage />} />
      </Routes>
    </div>
  );
};

export default Hub;
