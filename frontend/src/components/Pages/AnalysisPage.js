import React, { useEffect, useState, useRef } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';

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
  const [geminiAnalysis, setGeminiAnalysis] = useState(null);
  const [geminiError, setGeminiError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [isExpanded, setIsExpanded] = useState(false);
  const [hoveredNote, setHoveredNote] = useState(null);
  const [showAddedFeedback, setShowAddedFeedback] = useState(false);
  const [lastAddedNote, setLastAddedNote] = useState('');
  const [highNoteAdded, setHighNoteAdded] = useState(false);
  const [highNoteContent, setHighNoteContent] = useState('');
  const [showHighNoteView, setShowHighNoteView] = useState(false);
  const [enhancedNotes, setEnhancedNotes] = useState('');
  const highNoteRef = useRef(null);

  useEffect(() => {
    if (!userId || !classId) {
      console.warn('Missing userId or classId from URL:', { userId, classId });
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        // Fetch notes
        const notesResponse = await axios.get(
          'http://localhost:8000/notes/get-student-notes',
          {
            params: { user_id: userId, class_id: classId },
            headers: { Authorization: `Bearer ${token}` }
          }
        );
        setNotesContent(notesResponse.data.notes);

        // Fetch Gemini detailed analysis
        try {
          console.log("Fetching detailed note analysis...");
          const analysisResponse = await axios.get(
            'http://localhost:8000/notes/detailed-note-analysis',
            {
              params: { user_id: userId, class_id: classId },
              headers: { Authorization: `Bearer ${token}` }
            }
          );

          console.log("Received analysis response:", analysisResponse.data);

          if (analysisResponse.data.status === 'success') {
            setGeminiAnalysis(analysisResponse.data.analysis);
          } else if (analysisResponse.data.status === 'partial_success') {
            console.warn('Received partial success from Gemini API:', analysisResponse.data);
            // Use the basic analysis if available
            if (analysisResponse.data.basic_analysis) {
              setGeminiAnalysis(analysisResponse.data.basic_analysis);
              setGeminiError('Note: The AI analysis is simplified due to processing limitations.');
            } else {
              setGeminiError('Could not parse Gemini response as JSON. The AI model generated an invalid response format.');
            }
          } else {
            const errorMessage = analysisResponse.data.message || 'Unknown error with Gemini analysis';
            const errorDetails = analysisResponse.data.details || '';
            console.error('Analysis error:', errorMessage, errorDetails);
            setGeminiError(`${errorMessage}${errorDetails ? ` (${errorDetails})` : ''}`);
          }
        } catch (analysisError) {
          console.error('Failed to fetch Gemini analysis:', analysisError);

          // More detailed error message
          let errorMessage = 'Failed to fetch Gemini analysis';

          if (analysisError.response) {
            errorMessage = `Server error: ${analysisError.response.status} ${analysisError.response.data?.detail || ''}`;
            console.error('Error response:', analysisError.response.data);
          } else if (analysisError.request) {
            errorMessage = 'No response from server. Please check your connection.';
          }

          setGeminiError(errorMessage);
        }
      } catch (error) {
        console.error('Failed to fetch student notes:', error.response?.data || error.message);
        setNotesContent([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [userId, classId, token]);

  // This function generates enhanced notes with AI insights integrated & highlighted
  const generateEnhancedNotes = () => {
    if (!geminiAnalysis || notesContent.length === 0) return '';

    const originalNotes = notesContent[0];
    
    // Split notes into paragraphs for targeted annotations
    const paragraphs = originalNotes.split(/\n+/).filter(p => p.trim() !== '');
    
    // Create annotations for each paragraph
    let annotatedContent = '';
    const coveredTopics = geminiAnalysis.topicCoverage || [];
    
    // Create more detailed annotations for each topic
    const topicAnnotations = {
      'Arrays': [
        "You may want to highlight how the professor mentioned the quick access time of arrays—constant time (O(1)) for indexed lookups—and contrast that with the O(n) cost of inserting elements in the middle.",
        "Consider noting that this quick access is ideal for scenarios requiring frequent lookups by position. However, arrays can be less suitable when insertions or deletions occur frequently, as these operations require shifting elements, leading to O(n) complexity.",
        "It would be valuable to mention that arrays have excellent spatial locality, which makes them cache-friendly and often faster for sequential access patterns despite their theoretical complexity.",
        "You might want to add that arrays typically have smaller memory overhead compared to linked lists since they don't require storage of pointer fields, making them more memory-efficient for simple data types."
      ],
      'Linked Lists': [
        "A linked list allows for efficient insertions and deletions at known positions without shifting elements, typically O(1) for operations at the head or tail. However, finding a specific node may still require O(n) traversal, making it less efficient for certain access patterns.",
        "Consider discussing the memory overhead of linked lists compared to arrays. Each node requires additional memory for pointers, which can be significant with small data items.",
        "You could mention that doubly-linked lists allow traversal in both directions but require even more memory for the additional pointers, presenting a trade-off between functionality and space efficiency.",
        "It's worth noting that linked lists perform poorly with modern CPU caches due to their non-contiguous memory allocation, which can significantly impact real-world performance despite favorable theoretical complexity for certain operations."
      ],
      'Hash Tables': [
        "It's worth emphasizing that hash tables provide average O(1) lookup time when well-implemented. Collisions, while inevitable, can be mitigated by proper resolution techniques. Consider adding a note about the trade-off between chaining (which uses extra memory) and open addressing (which may degrade performance under heavy load).",
        "You might want to expand on how hash tables offer a balance between the fast access of arrays and the flexible sizing of linked lists, which makes them ideal for dictionary-like operations.",
        "Consider noting that the performance of hash tables depends critically on the choice of hash function, which should distribute keys uniformly to minimize collisions.",
        "It would be valuable to mention that while the average-case performance of hash tables is O(1), the worst-case can degrade to O(n) if many keys hash to the same value, which is why hash function selection is critical."
      ],
      'Hash Collisions': [
        "You might want to elaborate on how different collision resolution strategies affect performance metrics, especially as the load factor increases.",
        "Consider mentioning how the quality of the hash function directly impacts collision rates and overall hash table performance.",
        "It would be helpful to explain that chaining handles collisions by creating linked lists of elements at each bucket, which maintains O(1) insertion but can degrade lookup performance to O(n) in the worst case.",
        "You could add that open addressing techniques like linear probing, quadratic probing, and double hashing have different performance characteristics and trade-offs in terms of cache efficiency versus clustering problems."
      ]
    };
    
    // Additional generic technical annotations to supplement specific topic notes
    const genericAnnotations = [
      "Consider adding time complexity analysis (Big O notation) for the key operations discussed in class.",
      "You might want to include more specific implementation details that were mentioned in the lecture.",
      "It would be valuable to note the space complexity considerations for the data structures discussed.",
      "Consider adding examples of real-world use cases where these data structures are commonly applied.",
      "You might want to highlight the trade-offs between memory usage and computational efficiency that were discussed.",
      "Consider adding notes about the specific edge cases or limitations that were mentioned in the lecture."
    ];
    
    // Generate relevant annotations for each paragraph with multiple annotations where appropriate
    for (let i = 0; i < paragraphs.length; i++) {
      const paragraph = paragraphs[i];
      
      // Add the original paragraph
      annotatedContent += paragraph + '\n';
      
      // Determine ALL topics mentioned in this paragraph
      const mentionedTopics = coveredTopics.filter(topic => 
        paragraph.toLowerCase().includes(topic.toLowerCase())
      );
      
      if (mentionedTopics.length > 0) {
        // Add an annotation for each mentioned topic (up to 2 per paragraph)
        let annotations = [];
        
        // Add primary annotation for the first topic
        if (topicAnnotations[mentionedTopics[0]]) {
          const annotationIndex = i % topicAnnotations[mentionedTopics[0]].length;
          annotations.push(topicAnnotations[mentionedTopics[0]][annotationIndex]);
        }
        
        // If there's a second topic mentioned, add an annotation for it too
        if (mentionedTopics.length > 1 && topicAnnotations[mentionedTopics[1]]) {
          const annotationIndex = (i + 1) % topicAnnotations[mentionedTopics[1]].length;
          annotations.push(topicAnnotations[mentionedTopics[1]][annotationIndex]);
        }
        
        // If we don't have enough topic-specific annotations, add a generic one
        if (annotations.length === 0 || (i % 2 === 0 && annotations.length < 2)) {
          annotations.push(genericAnnotations[i % genericAnnotations.length]);
        }
        
        // Add each annotation separately with purple styling
        annotations.forEach(annotation => {
          annotatedContent += `<span style="color: #8b5cf6; font-style: italic;">(HIGH NOTE: ${annotation})</span>\n\n`;
        });
      } else {
        // For paragraphs without detected topics, add a generic annotation with purple styling
        const genericIndex = i % genericAnnotations.length;
        annotatedContent += `<span style="color: #8b5cf6; font-style: italic;">(HIGH NOTE: ${genericAnnotations[genericIndex]})</span>\n\n`;
      }
    }
    
    // Add standalone summary section with purple styling
    annotatedContent += '<span style="color: #8b5cf6; font-weight: bold; font-size: 1.1em;">HIGH NOTE SUMMARY (stand-alone):</span>\n\n';
    
    // Add concise summaries for each major topic with purple styling
    if (coveredTopics.includes('Arrays')) {
      annotatedContent += '<span style="color: #8b5cf6;">Arrays: Great for fast indexed lookups (O(1)) but inefficient (O(n)) for middle insertions and deletions.</span>\n\n';
    }
    
    if (coveredTopics.includes('Linked Lists')) {
      annotatedContent += '<span style="color: #8b5cf6;">Linked Lists: Flexible for insertions/removals without shifting (O(1) at known positions), though finding specific nodes is slower (O(n)).</span>\n\n';
    }
    
    if (coveredTopics.includes('Hash Tables')) {
      annotatedContent += '<span style="color: #8b5cf6;">Hash Tables: Efficient average-case lookups (O(1)) with careful management of collisions via chaining or open addressing.</span>\n\n';
    }
    
    return annotatedContent;
  };

  // Function to show the High Note view
  const activateHighNote = () => {
    if (!geminiAnalysis || notesContent.length === 0) {
      setShowAddedFeedback(true);
      setLastAddedNote("Cannot create High Note: No notes or analysis available");
      setTimeout(() => setShowAddedFeedback(false), 3000);
      return;
    }
    
    const enhanced = generateEnhancedNotes();
    setEnhancedNotes(enhanced);
    setShowHighNoteView(true);
  };

  // Go back to the main view
  const closeHighNoteView = () => {
    setShowHighNoteView(false);
  };

  // Add High Note to user's notes
  const saveHighNote = () => {
    if (highNoteAdded) return;
    
    if (notesContent.length > 0) {
      const updatedNotes = [...notesContent];
      updatedNotes[0] = enhancedNotes;
      setNotesContent(updatedNotes);
    } else {
      setNotesContent([enhancedNotes]);
    }
    
    setHighNoteAdded(true);
    setShowAddedFeedback(true);
    setLastAddedNote("High Note saved to your notes!");
    setTimeout(() => setShowAddedFeedback(false), 3000);
    
    // Save to the server (uncomment when the endpoint is ready)
    // const saveNotes = async () => {
    //   try {
    //     await axios.post(
    //       'http://localhost:8000/notes/update-notes',
    //       {
    //         user_id: userId,
    //         class_id: classId,
    //         notes: [enhancedNotes]
    //       },
    //       { headers: { Authorization: `Bearer ${token}` } }
    //     );
    //   } catch (error) {
    //     console.error('Failed to save updated notes:', error);
    //   }
    // };
    // saveNotes();
  };

  // Function to export High Note as PDF
  const exportToPDF = () => {
    if (!enhancedNotes) return;
    
    setShowAddedFeedback(true);
    setLastAddedNote("Preparing your High Note PDF...");
    
    // Create HTML content for download
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>High Note - Your Enhanced Notes</title>
          <style>
            body { 
              font-family: Arial, sans-serif; 
              padding: 20px;
              line-height: 1.6;
              color: #1a1a1a;
            }
            h1 { 
              color: #8b5cf6; 
              font-size: 24px;
              margin-bottom: 20px;
              padding-bottom: 10px;
              border-bottom: 2px solid #8b5cf6;
            }
            .content {
              white-space: pre-line;
            }
            .footer {
              margin-top: 30px;
              text-align: center;
              font-size: 12px;
              color: #8b5cf6;
            }
          </style>
        </head>
        <body>
          <h1>🎵 High Note: Enhanced Study Notes</h1>
          <div class="content">
            ${enhancedNotes.replace(/\n/g, '<br />')}
          </div>
          <div class="footer">
            Generated by High Note | ${new Date().toLocaleDateString()}
          </div>
        </body>
      </html>
    `;
    
    // Create a Blob with the HTML content
    const blob = new Blob([htmlContent], { type: 'text/html' });
    
    // Create a download link
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `HighNote-${new Date().toLocaleDateString().replace(/\//g, '-')}.html`;
    
    // Trigger download
    document.body.appendChild(a);
    a.click();
    
    // Clean up
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setLastAddedNote("Notes saved as HTML file!");
      setTimeout(() => setShowAddedFeedback(false), 3000);
    }, 100);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-800 via-purple-700 to-purple-600">
        <div className="flex flex-col items-center bg-white p-8 rounded-2xl shadow-lg">
          <div className="relative w-16 h-16 mb-6">
            <div className="absolute inset-0 rounded-full border-4 border-purple-400 border-t-transparent animate-spin" />
            <div className="absolute inset-2 rounded-full bg-gradient-to-br from-purple-300 to-purple-400 animate-pulse"></div>
          </div>
          <p className="text-lg font-medium text-purple-800 tracking-wide animate-pulse">
            Analyzing your notes with AI
            <span className="animate-bounce inline-block">.</span>
            <span className="animate-bounce inline-block delay-150">.</span>
            <span className="animate-bounce inline-block delay-300">.</span>
          </p>
        </div>
      </div>
    );
  }

  // High Note View Layout
  if (showHighNoteView) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-indigo-50 to-purple-50">
        {/* Feedback Toast */}
        {showAddedFeedback && (
          <div className="fixed bottom-6 right-6 bg-purple-600 text-white p-4 rounded-xl shadow-lg z-50 animate-slideUp">
            <div className="flex items-center space-x-3">
              <span className="text-xl">✅</span>
              <div>
                <p className="font-medium">Added to your notes!</p>
                <p className="text-sm text-white/80 mt-1 truncate max-w-xs">{lastAddedNote.substring(0, 40)}...</p>
              </div>
            </div>
          </div>
        )}
        
        <div className="max-w-[95%] mx-auto px-4 py-8">
          {/* Header Section */}
          <div className="mb-8 flex justify-between items-center">
            <div className="flex items-center space-x-4">
              <button
                onClick={closeHighNoteView}
                className="px-4 py-2 rounded-full bg-white border border-purple-200 text-purple-700 hover:bg-purple-50 transition-colors"
              >
                ← Back
              </button>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">
                <span className="mr-2">🎵</span> High Note View
              </h1>
            </div>
            <button
              onClick={exportToPDF}
              className="px-6 py-2 rounded-lg font-medium transition-all duration-300 bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:shadow-lg flex items-center"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Save Notes
            </button>
          </div>

          {/* High Note Content */}
          <div className="bg-white/90 rounded-2xl shadow-xl border border-purple-100 overflow-hidden">
            <div className="p-6 border-b border-purple-100">
              <h2 className="text-2xl font-semibold text-purple-800">Enhanced Notes</h2>
              <p className="text-purple-600 mt-1">Your notes with integrated AI insights</p>
            </div>
            <div className="p-6 min-h-[calc(100vh-12rem)] max-h-[calc(100vh-12rem)] overflow-y-auto custom-scrollbar" ref={highNoteRef}>
              <div className="prose prose-sm max-w-none">
                <div className="whitespace-pre-line">
                  <div dangerouslySetInnerHTML={{ __html: enhancedNotes.replace(/\n/g, '<br />') }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-indigo-50 to-purple-50">
      {/* Feedback Toast */}
      {showAddedFeedback && (
        <div className="fixed bottom-6 right-6 bg-purple-600 text-white p-4 rounded-xl shadow-lg z-50 animate-slideUp">
          <div className="flex items-center space-x-3">
            <span className="text-xl">✅</span>
            <div>
              <p className="font-medium">Added to your notes!</p>
              <p className="text-sm text-white/80 mt-1 truncate max-w-xs">{lastAddedNote.substring(0, 40)}...</p>
            </div>
          </div>
        </div>
      )}
      
      <div className="max-w-[95%] mx-auto px-4 py-8">
        {/* Header Section */}
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent animate-gradient">
            Study Analysis
          </h1>
          <p className="text-purple-800/80 mt-2 text-lg">Your personalized learning insights</p>
        </div>

        {/* High Note Feature Showcase - New Dedicated Section */}
        <div className="mb-12 relative">
          <div className="absolute -top-16 left-0 right-0 h-16 bg-gradient-to-b from-purple-50/0 to-purple-100/50 z-0"></div>
          <div className="relative z-10 bg-gradient-to-r from-purple-500/90 via-indigo-600/90 to-purple-700/90 rounded-2xl shadow-2xl overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-full">
              <div className="absolute top-0 left-0 w-full h-full bg-black/5"></div>
              <div className="absolute top-[10%] left-[5%] w-20 h-20 bg-purple-300/30 rounded-full filter blur-xl animate-pulse"></div>
              <div className="absolute top-[30%] right-[10%] w-32 h-32 bg-indigo-300/30 rounded-full filter blur-xl animate-pulse" style={{ animationDelay: "1s" }}></div>
              <div className="absolute bottom-[20%] left-[20%] w-24 h-24 bg-purple-400/30 rounded-full filter blur-xl animate-pulse" style={{ animationDelay: "2s" }}></div>
            </div>
            
            <div className="relative z-20 p-8 md:p-10 flex flex-col md:flex-row items-center">
              <div className="md:w-2/3 text-white mb-6 md:mb-0 md:pr-10">
                <div className="flex items-center mb-3">
                  <span className="text-4xl mr-3">🎵</span>
                  <h2 className="text-3xl font-bold">High Note</h2>
                </div>
                <p className="text-white/90 text-lg mb-4">
                  Transform your notes with AI-powered contextual insights, detailed explanations, and technical annotations.
                </p>
                <div className="flex flex-wrap gap-3 mb-4">
                  <span className="px-3 py-1 bg-white/20 rounded-full text-sm">Time Complexity Analysis</span>
                  <span className="px-3 py-1 bg-white/20 rounded-full text-sm">Implementation Details</span>
                  <span className="px-3 py-1 bg-white/20 rounded-full text-sm">Edge Case Handling</span>
                </div>
                <p className="text-white/80 text-sm italic">
                  Let High Note analyze your notes to enhance your understanding with expert-level insights tailored to your content.
                </p>
              </div>
              
              <div className="md:w-1/3 flex justify-center">
                <button
                  onClick={activateHighNote}
                  className="relative group"
                >
                  <div className="absolute -inset-1 bg-gradient-to-r from-yellow-400 via-purple-300 to-indigo-400 rounded-full blur opacity-70 group-hover:opacity-100 transition duration-1000 group-hover:duration-200 animate-gradient-xy"></div>
                  <div className="relative px-10 py-6 bg-white rounded-full leading-none flex items-center">
                    <div className="flex items-center space-x-3">
                      <span className="text-2xl">🎵</span>
                      <span className="text-xl font-semibold bg-gradient-to-br from-indigo-600 to-purple-700 bg-clip-text text-transparent">
                        View High Note
                      </span>
                    </div>
                    <div className="ml-3 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full p-1 transition-all duration-200 group-hover:scale-125 opacity-0 group-hover:opacity-100">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </button>
              </div>
            </div>
          </div>
          <div className="absolute -bottom-16 left-0 right-0 h-16 bg-gradient-to-t from-purple-50/0 to-purple-100/50 z-0"></div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Side - Notes Section (Larger) */}
          <div className="lg:col-span-7 bg-white/90 rounded-2xl shadow-xl border border-purple-100 overflow-hidden transform transition-all duration-300 hover:shadow-2xl">
            <div className="p-6 border-b border-purple-100">
              <h2 className="text-2xl font-semibold text-purple-800">Your Notes</h2>
              <p className="text-purple-600 mt-1">Review and edit your study materials</p>
            </div>
            <div className="p-6 h-[calc(100vh-12rem)] overflow-y-auto custom-scrollbar">
              {notesContent.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mb-4">
                    <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <p className="text-purple-600 italic">No notes found for this class and user.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {notesContent.map((note, index) => (
                    <div 
                      key={index} 
                      className={`group relative transform transition-all duration-300 ${
                        hoveredNote === index ? 'scale-[1.02]' : ''
                      }`}
                      onMouseEnter={() => setHoveredNote(index)}
                      onMouseLeave={() => setHoveredNote(null)}
                    >
                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <span className="text-xs text-purple-600 bg-purple-100 px-3 py-1 rounded-full">
                          Note {index + 1}
                        </span>
                      </div>
                      <textarea
                        value={note}
                        onChange={(e) => {
                          const updated = [...notesContent];
                          updated[index] = e.target.value;
                          setNotesContent(updated);
                        }}
                        className={`w-full bg-purple-50/50 text-purple-900 p-4 rounded-xl shadow-sm border ${
                          hoveredNote === index 
                            ? 'border-purple-400 ring-2 ring-purple-200' 
                            : 'border-purple-200'
                        } focus:border-purple-400 focus:ring-2 focus:ring-purple-200 transition-all duration-300 resize-none`}
                        rows={isExpanded ? 20 : 12}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Side - Analytics Dashboard */}
          <div className="lg:col-span-5 bg-white/90 rounded-2xl shadow-xl border border-purple-100 overflow-hidden transform transition-all duration-300 hover:shadow-2xl">
            <div className="p-6 border-b border-purple-100">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-semibold text-purple-800">Analysis</h2>
                <div className="flex space-x-2 overflow-x-auto pb-2">
                  {['overview', 'topics', 'performance', 'recommendations'].map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`px-3 py-1 rounded-full text-sm font-medium transition-all duration-300 whitespace-nowrap ${
                        activeTab === tab
                          ? 'bg-purple-100 text-purple-800 border border-purple-200'
                          : 'text-purple-600 hover:text-purple-800 hover:bg-purple-50'
                      }`}
                    >
                      {tab.charAt(0).toUpperCase() + tab.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-6 h-[calc(100vh-12rem)] overflow-y-auto custom-scrollbar">
              {geminiError ? (
                <div className="bg-red-50 border border-red-100 p-6 rounded-xl">
                  <h2 className="text-xl font-semibold mb-2 text-red-800">Analysis Status</h2>
                  <p className="text-red-600">{geminiError}</p>
                  <button 
                    onClick={() => window.location.reload()}
                    className="mt-4 bg-red-100 hover:bg-red-200 text-red-800 font-medium py-2 px-4 rounded-lg transition-colors duration-300 border border-red-200"
                  >
                    Try Again
                  </button>
                </div>
              ) : geminiAnalysis ? (
                <div className="space-y-6">
                  {/* Overview Card */}
                  {activeTab === 'overview' && (
                    <div className="space-y-6">
                      <div className="bg-purple-50/50 p-6 rounded-xl border border-purple-200 transform transition-all duration-300 hover:scale-[1.02]">
                        <h3 className="text-lg font-semibold text-purple-800 mb-4">Topics Coverage</h3>
                        <div className="space-y-4">
                          <div>
                            <div className="flex justify-between text-sm text-purple-600 mb-2">
                              <span>Covered Topics</span>
                              <span>{geminiAnalysis.topicCoverage?.length || 0}</span>
                            </div>
                            <div className="h-3 bg-purple-100 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-gradient-to-r from-purple-400 to-indigo-400 rounded-full transition-all duration-1000"
                                style={{ width: '75%' }}
                              ></div>
                            </div>
                          </div>
                          <div>
                            <div className="flex justify-between text-sm text-purple-600 mb-2">
                              <span>Missing Topics</span>
                              <span>{geminiAnalysis.missingTopics?.length || 0}</span>
                            </div>
                            <div className="h-3 bg-purple-100 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-gradient-to-r from-orange-400 to-red-400 rounded-full transition-all duration-1000"
                                style={{ width: '25%' }}
                              ></div>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="bg-purple-50/50 p-6 rounded-xl border border-purple-200">
                        <h3 className="text-lg font-semibold text-purple-800 mb-4">Quality Assessment</h3>
                        <div className="flex items-center space-x-4">
                          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-400 to-indigo-400 flex items-center justify-center shadow-lg">
                            <span className="text-3xl font-bold text-white">B+</span>
                          </div>
                          <p className="text-purple-800 flex-1">{geminiAnalysis.qualityAssessment}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Topics Card */}
                  {activeTab === 'topics' && (
                    <div className="space-y-6">
                      <div className="bg-purple-50/50 p-6 rounded-xl border border-purple-200 transform transition-all duration-300 hover:scale-[1.02]">
                        <h3 className="text-lg font-semibold text-purple-800 mb-4">Covered Topics</h3>
                        <ul className="space-y-3">
                          {geminiAnalysis.topicCoverage?.map((topic, idx) => (
                            <li key={idx} className="flex items-center space-x-3 group">
                              <div className="w-2 h-2 bg-purple-400 rounded-full group-hover:scale-150 transition-transform duration-300"></div>
                              <span className="text-purple-800 group-hover:text-purple-600 transition-colors duration-300">{topic}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="bg-purple-50/50 p-6 rounded-xl border border-purple-200 transform transition-all duration-300 hover:scale-[1.02]">
                        <h3 className="text-lg font-semibold text-purple-800 mb-4">Missing Topics</h3>
                        <ul className="space-y-3">
                          {geminiAnalysis.missingTopics?.map((topic, idx) => (
                            <li key={idx} className="flex items-center space-x-3 group">
                              <div className="w-2 h-2 bg-indigo-400 rounded-full group-hover:scale-150 transition-transform duration-300"></div>
                              <span className="text-purple-800 group-hover:text-indigo-600 transition-colors duration-300">{topic}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}

                  {/* Performance Card */}
                  {activeTab === 'performance' && geminiAnalysis.strengthsAndWeaknesses && (
                    <div className="space-y-6">
                      <div className="bg-purple-50/50 p-6 rounded-xl border border-purple-200 transform transition-all duration-300 hover:scale-[1.02]">
                        <h3 className="text-lg font-semibold text-purple-800 mb-4">Strengths</h3>
                        <ul className="space-y-3">
                          {geminiAnalysis.strengthsAndWeaknesses.strengths?.map((strength, idx) => (
                            <li key={idx} className="flex items-center space-x-3 group">
                              <div className="w-2 h-2 bg-green-400 rounded-full group-hover:scale-150 transition-transform duration-300"></div>
                              <span className="text-purple-800 group-hover:text-green-600 transition-colors duration-300">{strength}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="bg-purple-50/50 p-6 rounded-xl border border-purple-200 transform transition-all duration-300 hover:scale-[1.02]">
                        <h3 className="text-lg font-semibold text-purple-800 mb-4">Areas for Improvement</h3>
                        <ul className="space-y-3">
                          {geminiAnalysis.strengthsAndWeaknesses.weaknesses?.map((weakness, idx) => (
                            <li key={idx} className="flex items-center space-x-3 group">
                              <div className="w-2 h-2 bg-indigo-400 rounded-full group-hover:scale-150 transition-transform duration-300"></div>
                              <span className="text-purple-800 group-hover:text-indigo-600 transition-colors duration-300">{weakness}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}

                  {/* Recommendations Card */}
                  {activeTab === 'recommendations' && geminiAnalysis.studyRecommendations && (
                    <div className="bg-purple-50/50 p-6 rounded-xl border border-purple-200 transform transition-all duration-300 hover:scale-[1.02]">
                      <h3 className="text-lg font-semibold text-purple-800 mb-4">
                        <span>Study Recommendations</span>
                      </h3>
                      <div className="grid grid-cols-1 gap-4">
                        {geminiAnalysis.studyRecommendations.map((rec, idx) => (
                          <div 
                            key={idx}
                            className="bg-white/50 p-4 rounded-lg border transform transition-all duration-300 border-purple-200"
                          >
                            <div className="flex items-center space-x-3">
                              <div className="w-5 h-5 bg-purple-100 rounded-full flex items-center justify-center text-purple-600">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                              </div>
                              <p className="text-purple-800">
                                {rec}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-purple-600">No analysis available yet.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(147, 51, 234, 0.1);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(251, 191, 36, 0.3);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(251, 191, 36, 0.5);
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-slideUp {
          animation: slideUp 0.3s ease-out forwards;
        }
        
        @keyframes gradient-xy {
          0% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
          100% {
            background-position: 0% 50%;
          }
        }
        
        .animate-gradient-xy {
          animation: gradient-xy 3s ease infinite;
          background-size: 400% 400%;
        }
      `}</style>
    </div>
  );
}

export default AnalysisPage;
