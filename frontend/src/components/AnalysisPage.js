import React, { useEffect, useState } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

function AnalysisPage() {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const classId = searchParams.get('classId');
  const userId = searchParams.get('userId');
  const { token } = useAuth();

  const [notesContent, setNotesContent] = useState([]);
  const [missingConcepts, setMissingConcepts] = useState(
    location.state?.missingConcepts || []
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId || !classId) {
      console.warn('Missing userId or classId from URL:', { userId, classId });
      setLoading(false);
      return;
    }

    const fetchNotes = async () => {
      try {
        const response = await axios.get('http://localhost:8000/notes/get-student-notes', {
          params: { user_id: userId, class_id: classId },
          headers: { Authorization: `Bearer ${token}` }
        });
        setNotesContent(response.data.notes);
      } catch (error) {
        console.error('Failed to fetch student notes:', error.response?.data || error.message);
        setNotesContent([]);
      }
    };

    fetchNotes();
    const delay = setTimeout(() => setLoading(false), 5000);
    return () => clearTimeout(delay);
  }, [userId, classId, token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-800 via-purple-700 to-purple-600">
        <div className="flex flex-col items-center bg-white p-8 rounded-2xl shadow-lg">
          <div className="relative w-16 h-16 mb-6">
            <div className="absolute inset-0 rounded-full border-4 border-green-600 border-t-transparent animate-spin" />
            <div className="absolute inset-2 rounded-full bg-gradient-to-br from-green-400 to-emerald-600"></div>
          </div>
          <p className="text-lg font-medium text-black tracking-wide animate-pulse">
            Analyzing your notes
            <span className="animate-bounce inline-block">.</span>
            <span className="animate-bounce inline-block delay-150">.</span>
            <span className="animate-bounce inline-block delay-300">.</span>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-100 via-emerald-200 to-green-300 text-gray-900 py-10 px-4 animate-fade-in">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row gap-8">
  
        {/* Main Content */}
        <div className="flex-1 bg-white/60 backdrop-blur-md p-10 rounded-3xl shadow-[0_10px_40px_rgba(0,0,0,0.15)] transition-transform hover:scale-[1.01]">
          <h1 className="text-5xl font-extrabold mb-8 text-emerald-800 border-b-2 border-emerald-300 pb-4 tracking-tight drop-shadow-md flex items-center gap-2">
            Your Analyzed Submission
          </h1>
  
          {notesContent.length === 0 ? (
            <p className="text-gray-700 italic">No notes found for this class and user.</p>
          ) : (
            notesContent.map((note, index) => (
              <textarea
                key={index}
                value={note}
                onChange={(e) => {
                  const updated = [...notesContent];
                  updated[index] = e.target.value;
                  setNotesContent(updated);
                }}
                className="w-full bg-white text-gray-900 p-5 rounded-xl mb-6 shadow-md resize-none whitespace-pre-wrap transition focus:ring-4 focus:ring-emerald-300"
                rows={10}
              />
            ))
          )}
        </div>
  
        {/* Sidebar for Missing Concepts */}
        {missingConcepts && missingConcepts.length > 0 && (
          <aside className="w-full md:w-1/3 bg-white/70 backdrop-blur-md p-8 rounded-3xl shadow-lg border border-white/20">
            <h2 className="text-xl font-semibold mb-5 text-emerald-900 border-b border-white/50 pb-2 drop-shadow-sm">
            Additional Key Concepts
            </h2>
            <ul className="space-y-3">
              {missingConcepts.map((concept, index) => (
                <li
                  key={index}
                  className="bg-gradient-to-r from-emerald-800 to-green-700 text-white text-sm p-3 rounded-xl shadow hover:scale-105 transition-transform"
                >
                  {concept}
                </li>
              ))}
            </ul>
          </aside>
        )}
      </div>
    </div>
  );
  
  
  
}

export default AnalysisPage;
