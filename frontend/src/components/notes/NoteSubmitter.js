// src/components/notes/NoteSubmitter.js
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const API_BASE_URL = 'http://localhost:8000';

function NoteSubmitter({ lobbyId, advancedSettings }) {
  const { username, token } = useAuth();
  const [content, setContent] = useState('');
  const [pdfFile, setPdfFile] = useState(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsLoading(true);
    setError('');

    // Allow submission if either text content or a PDF is provided
    if (!username || !lobbyId || (!content && !pdfFile)) {
      setError('Please provide note text or upload a PDF.');
      setIsLoading(false);
      return;
    }

    // Create FormData to combine text and file data
    const formData = new FormData();
    formData.append("user_id", username);
    formData.append("class_id", lobbyId);
    formData.append("content", content);
    if (pdfFile) {
      formData.append("pdf_file", pdfFile);
    }

    try {
      // Submit note (and PDF file if provided)
      const submitResponse = await fetch(`${API_BASE_URL}/notes/submit-note`, {
        method: 'POST',
        headers: {
          // Do not set Content-Type with FormData – it is set automatically.
          'Authorization': `Bearer ${token}`
        },
        body: formData,
      });

      let submitResult = {};
      try {
        submitResult = await submitResponse.json();
      } catch (parseError) {
        console.error("Could not parse response JSON:", parseError);
        if (submitResponse.ok) {
          submitResult = {};
        } else {
          throw new Error(`HTTP error! Status: ${submitResponse.status}. Response not valid JSON.`);
        }
      }

      if (!submitResponse.ok) {
        let errorDetail = `HTTP error! Status: ${submitResponse.status}`;
        if (submitResult && submitResult.detail) {
          if (typeof submitResult.detail === 'string') {
            errorDetail = submitResult.detail;
          } else if (Array.isArray(submitResult.detail)) {
            errorDetail = submitResult.detail
              .map(err => `${err.loc ? err.loc.join('.') : 'error'}: ${err.msg}`)
              .join('; ');
          } else {
            errorDetail = JSON.stringify(submitResult.detail);
          }
        }
        throw new Error(errorDetail);
      }

      // Optionally increment the lobby's user count
      await fetch(`${API_BASE_URL}/lobby/lobbies/${lobbyId}/increment-user-count`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
      });

      // Run update_student_concepts with student-specific settings
      await fetch(`${API_BASE_URL}/notes/update-student-concepts`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          user_id: username,
          class_id: lobbyId,
          num_concepts: advancedSettings.numConceptsStudent,
          similarity_threshold: advancedSettings.similarityThresholdUpdate,
        }),
      });

      // Run analyze_concepts_enhanced with class-specific settings
      const analyzeResponse = await fetch(
        `${API_BASE_URL}/notes/analyze-concepts-enhanced?user_id=${username}&class_id=${lobbyId}` +
          `&num_concepts=${advancedSettings.numConceptsClass}` +
          `&similarity_threshold=${advancedSettings.similarityThresholdUpdate}` +
          `&sim_threshold=${advancedSettings.similarityThresholdAnalyze}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      let analyzeResult = {};
      try {
        analyzeResult = await analyzeResponse.json();
      } catch (parseError) {
        console.error("Error parsing analyze response:", parseError);
        analyzeResult = {};
      }

      // Check if there are enough notes for analysis
      if (analyzeResult.status === "insufficient_notes") {
        setError(analyzeResult.message);
        setIsLoading(false);
        return;
      }

      // Redirect to Analysis page passing the missing concepts via router state.
      navigate(
        `/analysis?classId=${lobbyId}&userId=${username}`,
        { state: { missingConcepts: analyzeResult.missing_concepts || [] } }
      );
    } catch (err) {
      console.error("Submission failed:", err);
      setError(err.message || 'Failed to submit note.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto bg-white/10 backdrop-blur-xl rounded-xl p-8 border border-white/20 shadow-2xl mt-10 animate-fadeIn text-white">
      <h2 className="text-3xl font-bold mb-2 text-purple-200">📝 Submit a New Note</h2>
      <p className="text-sm text-white/80 mb-6">
        Fill in the details, upload a PDF if needed, and hit submit. You will be redirected to view your analysis.
      </p>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="content" className="block font-medium mb-1">
            Note Content
          </label>
          <textarea
            id="content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows="6"
            disabled={isLoading}
            placeholder="Enter your note text here (optional if uploading a PDF)"
            className="w-full px-4 py-3 rounded-lg bg-white/20 border border-white/30 focus:outline-none focus:ring-2 focus:ring-purple-500 text-white placeholder-white/70 resize-y"
          />
        </div>

        <div>
          <label htmlFor="pdfFile" className="block font-medium mb-1">
            Upload PDF (optional)
          </label>
          <input
            id="pdfFile"
            type="file"
            accept="application/pdf"
            onChange={(e) => setPdfFile(e.target.files[0])}
            disabled={isLoading}
            className="w-full px-4 py-2 rounded-lg bg-gray-600/30 text-white/80 border border-white/30"
          />
        </div>

        {error && (
          <div className="bg-red-600/20 text-red-300 border border-red-500 px-4 py-2 rounded-lg text-sm font-medium">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className={`w-full py-3 font-bold rounded-lg text-white transition duration-300 ${
            isLoading
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-gradient-to-r from-purple-500 to-indigo-600 hover:scale-105 hover:shadow-lg hover:shadow-indigo-500/40'
          }`}
        >
          {isLoading ? 'Submitting...' : '🚀 Submit & Analyze'}
        </button>
      </form>
    </div>
  );
}

export default NoteSubmitter;
