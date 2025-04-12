import React, { useState } from 'react';
import axios from 'axios';
import { useDropzone } from 'react-dropzone';
import './App.css';

function App() {
  const [textInput, setTextInput] = useState('');
  const [file, setFile] = useState(null);
  const [comparisonResult, setComparisonResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'application/pdf': ['.pdf']
    },
    maxFiles: 1,
    onDrop: acceptedFiles => {
      setFile(acceptedFiles[0]);
    }
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData();
    if (file) {
      formData.append('file', file);
    } else if (textInput) {
      formData.append('text', textInput);
    }

    try {
      const response = await axios.post('http://localhost:8000/submit-note', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      setComparisonResult(response.data.comparison);
    } catch (err) {
      setError(err.response?.data?.message || 'An error occurred while submitting the note');
    } finally {
      setLoading(false);
    }
  };

  const renderSentiment = (sentiment) => {
    const polarity = sentiment.overall_sentiment;
    const subjectivity = sentiment.subjectivity;
    
    return (
      <div className="sentiment-analysis">
        <div className="sentiment-score">
          <span>Sentiment: </span>
          <span className={polarity > 0 ? 'positive' : polarity < 0 ? 'negative' : 'neutral'}>
            {polarity > 0 ? 'Positive' : polarity < 0 ? 'Negative' : 'Neutral'}
          </span>
        </div>
        <div className="subjectivity-score">
          <span>Subjectivity: </span>
          <span>{Math.round(subjectivity * 100)}%</span>
        </div>
        {sentiment.key_points.length > 0 && (
          <div className="key-points">
            <h4>Key Points:</h4>
            <ul>
              {sentiment.key_points.map((point, idx) => (
                <li key={idx}>{point.text}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  };

  const renderImportanceScore = (score) => {
    const percentage = Math.round(score * 100);
    let color = '#4CAF50'; // Green
    if (percentage < 30) color = '#FFC107'; // Yellow
    if (percentage < 10) color = '#F44336'; // Red
    
    return (
      <div className="importance-score">
        <div className="importance-bar" style={{ width: `${percentage}%`, backgroundColor: color }} />
        <span>{percentage}%</span>
      </div>
    );
  };

  const renderConceptClusters = (clusters) => {
    if (!clusters || clusters.length === 0) return null;
    
    return (
      <div className="concept-clusters">
        <h4>Related Concepts</h4>
        {clusters.map((cluster, index) => (
          <div key={index} className="cluster">
            {cluster.map((concept, idx) => (
              <span key={idx} className="cluster-concept">{concept}</span>
            ))}
          </div>
        ))}
      </div>
    );
  };

  const renderSimilarConcepts = (similarConcepts) => {
    if (!similarConcepts || similarConcepts.length === 0) return null;
    
    return (
      <div className="similar-concepts">
        <h4>Similar Concepts</h4>
        <div className="concept-tags">
          {similarConcepts.map((item, index) => (
            <span key={index} className="concept-tag">
              {item.phrase}
              <span className="similarity-score">({Math.round(item.score * 100)}%)</span>
            </span>
          ))}
        </div>
      </div>
    );
  };

  const renderResults = () => {
    if (!comparisonResult) return null;

    return (
      <div className="comparison-results">
        <div className="topics-section">
          <h3>Main Topics</h3>
          <div className="topics-list">
            {comparisonResult.topics?.map((topic, index) => (
              <div key={index} className="topic-item">
                <h4>Topic {topic.topic_id + 1}</h4>
                <div className="topic-words">
                  {topic.top_words.map((word, idx) => (
                    <span key={idx} className="topic-word">{word}</span>
                  ))}
                </div>
                <div className="topic-weight">
                  Weight: {Math.round(topic.topic_weight * 100)}%
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="result-section">
          <h3>Common Concepts</h3>
          <div className="concepts-list">
            {comparisonResult.common_concepts?.map((concept, index) => (
              <div key={index} className="concept-item">
                <div className="concept-header">
                  <span className="concept-phrase">{concept.phrase}</span>
                  <span className="peer-count">
                    Mentioned by {concept.mentioned_by_peers} peers
                  </span>
                </div>
                <div className="concept-context">{concept.context}</div>
                {renderSentiment(concept.sentiment)}
                {renderSimilarConcepts(concept.similar_concepts)}
                <div className="importance-section">
                  <h4>Importance Score</h4>
                  {renderImportanceScore(concept.importance)}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="result-section">
          <h3>Missing Concepts</h3>
          <div className="concepts-list">
            {comparisonResult.missing_concepts?.map((concept, index) => (
              <div key={index} className="concept-item">
                <div className="concept-header">
                  <span className="concept-phrase">{concept.phrase}</span>
                  <span className="peer-count">
                    Mentioned by {concept.mentioned_by_peers} peers
                  </span>
                </div>
                <div className="concept-context">{concept.context}</div>
                {renderSentiment(concept.sentiment)}
                {concept.similar_in_student_notes && concept.similar_in_student_notes.length > 0 && (
                  <div className="similar-in-student">
                    <h4>Similar in Your Notes</h4>
                    <div className="concept-tags">
                      {concept.similar_in_student_notes.map((phrase, idx) => (
                        <span key={idx} className="concept-tag">{phrase}</span>
                      ))}
                    </div>
                  </div>
                )}
                <div className="importance-section">
                  <h4>Importance Score</h4>
                  {renderImportanceScore(concept.importance)}
                </div>
              </div>
            ))}
          </div>
        </div>

        {comparisonResult.concept_clusters && (
          <div className="result-section">
            <h3>Concept Clusters</h3>
            <div className="clusters-section">
              <div className="student-clusters">
                <h4>Your Concept Clusters</h4>
                {renderConceptClusters(comparisonResult.concept_clusters.student_clusters)}
              </div>
              <div className="peer-clusters">
                <h4>Peer Concept Clusters</h4>
                {comparisonResult.concept_clusters.peer_clusters.map((clusters, index) => (
                  <div key={index} className="peer-cluster-group">
                    <h5>Peer {index + 1}</h5>
                    {renderConceptClusters(clusters)}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Student Notes Comparison</h1>
      </header>
      
      <main className="App-main">
        <form onSubmit={handleSubmit} className="note-form">
          <div className="input-section">
            <h2>Submit Your Notes</h2>
            
            <div className="text-input">
              <label htmlFor="textInput">Or enter your notes as text:</label>
              <textarea
                id="textInput"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="Enter your notes here..."
                rows="10"
              />
            </div>

            <div className="file-input">
              <div {...getRootProps()} className={`dropzone ${isDragActive ? 'active' : ''}`}>
                <input {...getInputProps()} />
                {isDragActive ? (
                  <p>Drop the PDF here...</p>
                ) : (
                  <p>Drag and drop a PDF file here, or click to select a file</p>
                )}
              </div>
              {file && (
                <div className="selected-file">
                  Selected file: {file.name}
                </div>
              )}
            </div>
          </div>

          <button type="submit" disabled={loading || (!file && !textInput)}>
            {loading ? 'Submitting...' : 'Submit Notes'}
          </button>
        </form>

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        {renderResults()}
      </main>
    </div>
  );
}

export default App; 