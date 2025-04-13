import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';

// Set up the PDF worker
GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;

const API_BASE_URL = 'http://localhost:8000';

function NoteSubmitter({ lobbyId }) {
  const { username, token } = useAuth();
  const [content, setContent] = useState('');
  const [pdfFile, setPdfFile] = useState(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [wordCount, setWordCount] = useState(0);
  const [pdfWordCount, setPdfWordCount] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const navigate = useNavigate();

  const handleContentChange = (e) => {
    const text = e.target.value;
    setContent(text);
    const count = text.trim().split(/\s+/).length;
    setWordCount(count);
  };

  const extractTextFromPDF = async (file) => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await getDocument(arrayBuffer).promise;
      let fullText = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str).join(' ');
        fullText += pageText + ' ';
      }
      return fullText.trim();
    } catch (error) {
      console.error('Error extracting text from PDF:', error);
      throw new Error('Failed to extract text from PDF. Please ensure it is a valid PDF file.');
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type === 'application/pdf') {
      try {
        setError('');
        const pdfText = await extractTextFromPDF(file);
        const count = pdfText.split(/\s+/).length;
        setPdfWordCount(count);
        setPdfFile(file);
      } catch (error) {
        setError(error.message);
        setPdfFile(null);
        setPdfWordCount(0);
      }
    } else {
      setError('Please upload a valid PDF file.');
    }
  };

  const handlePdfChange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      try {
        setError('');
        const pdfText = await extractTextFromPDF(file);
        const count = pdfText.split(/\s+/).length;
        setPdfWordCount(count);
        setPdfFile(file);
      } catch (error) {
        setError(error.message);
        setPdfFile(null);
        setPdfWordCount(0);
      }
    } else {
      setPdfFile(null);
      setPdfWordCount(0);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsLoading(true);
    setError('');

    // Validate minimum word counts if text or PDF is provided
    if (content && wordCount < 50) {
      setError('Note must contain at least 50 words.');
      setIsLoading(false);
      return;
    }
    if (pdfFile && pdfWordCount < 50) {
      setError('PDF must contain at least 50 words.');
      setIsLoading(false);
      return;
    }
    if (!username || !lobbyId || (!content && !pdfFile)) {
      setError('Please provide note text or upload a PDF.');
      setIsLoading(false);
      return;
    }

    // Fetch advanced settings using the lobby name (using lobbyId as the lobby name)
    let advancedSettings;
    try {
      const settingsResponse = await fetch(`${API_BASE_URL}/lobbies/${lobbyId}/advanced-settings`, {
         headers: { 'Authorization': `Bearer ${token}` }
       });
      if (!settingsResponse.ok) {
         const errorText = await settingsResponse.text();
         throw new Error(`Failed to load advanced settings: ${errorText}`);
      }
      const settingsData = await settingsResponse.json();
      advancedSettings = settingsData.advanced_settings;
    } catch (err) {
      setError(err.message || 'Error fetching advanced settings.');
      setIsLoading(false);
      return;
    }

    // Create FormData with note details
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
          'Authorization': `Bearer ${token}`,
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
      await fetch(`${API_BASE_URL}/lobbies/${lobbyId}/increment-user-count`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
      });

      // Run update_student_concepts using advanced settings
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

      // Run analyze_concepts_enhanced using advanced settings
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

      // Redirect to Analysis page passing missing concepts (if any)
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
    <div 
      className="max-w-2xl mx-auto bg-gradient-to-br from-purple-900/50 to-indigo-900/50 backdrop-blur-xl rounded-xl p-8 border border-white/20 shadow-2xl mt-10 animate-fadeIn text-white transform transition-all duration-300 hover:shadow-purple-500/20"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className={`absolute inset-0 bg-purple-500/30 rounded-lg transform transition-all duration-500 ${isHovered ? 'scale-110 rotate-6' : 'scale-100 rotate-0'}`}></div>
            <svg 
              className="w-8 h-8 text-purple-300 relative z-10" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth="2" 
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" 
              />
            </svg>
          </div>
          <h2 className="text-3xl font-bold text-purple-200">
            Submit a New Note
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-sm text-purple-300 bg-purple-900/30 px-3 py-1 rounded-full flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            {wordCount + pdfWordCount} words
          </div>
        </div>
      </div>
      
      <p className="text-sm text-white/80 mb-6">
        Fill in the details, upload a PDF if needed, and hit submit. You will be redirected to view your analysis.
      </p>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <label htmlFor="content" className="block font-medium text-purple-200 flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Note Content
          </label>
          <div className="relative">
            <textarea
              id="content"
              value={content}
              onChange={handleContentChange}
              rows="6"
              disabled={isLoading}
              placeholder="Enter your note text here (minimum 50 words)"
              className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/20 focus:outline-none focus:ring-2 focus:ring-purple-500/50 text-white placeholder-white/50 resize-y transition-all duration-300 hover:border-purple-500/50"
            />
            <div className="absolute bottom-2 right-2 text-xs text-white/50">
              {wordCount}/50 words
            </div>
          </div>
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse"></div>
              <p className="text-white/70">
                Minimum 50 words required
              </p>
            </div>
            {wordCount < 50 && content && (
              <p className="text-red-300 animate-pulse">
                {50 - wordCount} more words needed
              </p>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <label htmlFor="pdfFile" className="block font-medium text-purple-200 flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            Upload PDF (optional)
          </label>
          <div
            className={`w-full p-6 rounded-lg border-2 border-dashed transition-all duration-300 ${
              isDragging
                ? 'border-purple-500 bg-purple-900/30'
                : 'border-white/30 hover:border-purple-500/50'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <input
              id="pdfFile"
              type="file"
              accept="application/pdf"
              onChange={handlePdfChange}
              disabled={isLoading}
              className="hidden"
            />
            <label
              htmlFor="pdfFile"
              className="flex flex-col items-center justify-center cursor-pointer"
            >
              <svg
                className={`w-12 h-12 text-purple-400 mb-2 transition-transform duration-300 ${isDragging ? 'scale-110' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
              <p className="text-sm text-white/70">
                {pdfFile ? pdfFile.name : 'Drag & drop a PDF or click to browse'}
              </p>
            </label>
          </div>
          {pdfFile && (
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse"></div>
                <p className="text-white/70">
                  PDF word count: {pdfWordCount}
                </p>
              </div>
              {pdfWordCount < 50 && (
                <p className="text-red-300 animate-pulse">
                  {50 - pdfWordCount} more words needed
                </p>
              )}
            </div>
          )}
        </div>

        {error && (
          <div className="bg-red-900/30 text-red-300 border border-red-500/30 px-4 py-3 rounded-lg text-sm font-medium animate-fadeIn flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className={`w-full py-3 font-bold rounded-lg text-white transition-all duration-300 transform ${
            isLoading
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-gradient-to-r from-purple-500 to-indigo-600 hover:scale-105 hover:shadow-lg hover:shadow-indigo-500/40'
          } flex items-center justify-center gap-2 group`}
        >
          {isLoading ? (
            <>
              <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>Processing...</span>
            </>
          ) : (
            <>
              <svg 
                className="w-5 h-5 transform transition-transform duration-300 group-hover:translate-x-1" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
              <span> Analyze </span>
            </>
          )}
        </button>
      </form>
    </div>
  );
}

export default NoteSubmitter;
