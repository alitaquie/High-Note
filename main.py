from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import PyPDF2
import io
import nltk
from nltk.tokenize import word_tokenize, sent_tokenize
from nltk.corpus import stopwords
from sklearn.feature_extraction.text import TfidfVectorizer, CountVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.decomposition import LatentDirichletAllocation
import numpy as np
import spacy
import json
from typing import List, Dict, Tuple
import os
from collections import defaultdict
from textblob import TextBlob
from sentence_transformers import SentenceTransformer
import networkx as nx

# Download required NLTK data
nltk.download('punkt')
nltk.download('stopwords')

# Load spaCy model and sentence transformer
nlp = spacy.load('en_core_web_sm')
sentence_transformer = SentenceTransformer('all-MiniLM-L6-v2')

app = FastAPI()

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory storage for notes (replace with database in production)
notes_storage = []

def extract_text_from_pdf(pdf_file: bytes) -> str:
    """Extract text from PDF file."""
    pdf_reader = PyPDF2.PdfReader(io.BytesIO(pdf_file))
    text = ""
    for page in pdf_reader.pages:
        text += page.extract_text()

    print(text)
    return text

def extract_key_phrases(text: str) -> List[str]:
    """Extract meaningful phrases from text using spaCy."""
    doc = nlp(text)
    phrases = []
    
    # Extract noun phrases
    for chunk in doc.noun_chunks:
        if len(chunk.text.split()) > 1:
            phrases.append(chunk.text.lower())
    
    # Extract verb phrases
    for token in doc:
        if token.pos_ == "VERB":
            phrase = token.text.lower()
            for child in token.children:
                if child.dep_ in ["dobj", "attr", "acomp"]:
                    phrase += " " + child.text.lower()
            if len(phrase.split()) > 1:
                phrases.append(phrase)
    
    return list(set(phrases))

def find_context_for_phrase(phrase: str, text: str) -> str:
    """Find a sentence containing the phrase for context."""
    sentences = sent_tokenize(text)
    for sentence in sentences:
        if phrase.lower() in sentence.lower():
            return sentence
    return ""

def analyze_sentiment(text: str) -> Dict:
    """Analyze sentiment of text and extract key points."""
    blob = TextBlob(text)
    sentences = blob.sentences
    
    key_points = []
    for sentence in sentences:
        sentiment = sentence.sentiment
        # Consider sentences with strong sentiment as key points
        if abs(sentiment.polarity) > 0.3:
            key_points.append({
                "text": str(sentence),
                "sentiment": sentiment.polarity,
                "subjectivity": sentiment.subjectivity
            })
    
    return {
        "overall_sentiment": blob.sentiment.polarity,
        "subjectivity": blob.sentiment.subjectivity,
        "key_points": key_points
    }

def group_similar_concepts(phrases: List[str], threshold: float = 0.7) -> List[List[str]]:
    """Group similar concepts using semantic similarity."""
    if not phrases:
        return []
    
    # Get embeddings for all phrases
    embeddings = sentence_transformer.encode(phrases)
    
    # Create similarity matrix
    similarity_matrix = cosine_similarity(embeddings)
    
    # Create graph
    G = nx.Graph()
    for i, phrase1 in enumerate(phrases):
        for j, phrase2 in enumerate(phrases):
            if i < j and similarity_matrix[i][j] > threshold:
                G.add_edge(phrase1, phrase2, weight=similarity_matrix[i][j])
    
    # Find connected components (groups of similar concepts)
    groups = list(nx.connected_components(G))
    
    # Add ungrouped phrases as single-item groups
    all_grouped = set().union(*groups)
    for phrase in phrases:
        if phrase not in all_grouped:
            groups.append({phrase})
    
    return [list(group) for group in groups]

def extract_topics(texts: List[str], n_topics: int = 3) -> List[Dict]:
    """Extract main topics from texts using LDA."""
    if len(texts) < 2:
        return []
        
    # Adjust n_topics based on number of documents
    n_topics = min(n_topics, len(texts))
    
    # Create document-term matrix with adjusted parameters for small document sets
    vectorizer = CountVectorizer(
        max_df=1.0,  # Include terms that appear in all documents
        min_df=1,    # Include terms that appear in at least 1 document
        stop_words='english',
        max_features=100  # Limit vocabulary size to prevent overfitting
    )
    
    try:
        dtm = vectorizer.fit_transform(texts)
        
        # Fit LDA model
        lda = LatentDirichletAllocation(
            n_components=n_topics,
            random_state=42,
            max_iter=10,  # Reduce iterations for small datasets
            learning_method='online'
        )
        lda.fit(dtm)
        
        # Get feature names
        feature_names = vectorizer.get_feature_names_out()
        
        # Extract topics
        topics = []
        for topic_idx, topic in enumerate(lda.components_):
            top_words = [feature_names[i] for i in topic.argsort()[:-6:-1]]
            topics.append({
                "topic_id": topic_idx,
                "top_words": top_words,
                "topic_weight": float(np.mean(lda.transform(dtm)[:, topic_idx]))
            })
        
        return topics
    except ValueError as e:
        print(f"Error in topic modeling: {str(e)}")
        return []

def calculate_dynamic_threshold(phrases: List[str]) -> float:
    """Calculate threshold based on phrase characteristics."""
    if not phrases:
        return 0.7  # Default threshold
    
    avg_length = np.mean([len(p.split()) for p in phrases])
    if avg_length > 5:  # Longer phrases need higher threshold
        return 0.8
    return 0.7  # Default threshold for shorter phrases

def enhanced_semantic_similarity(phrase1: str, phrase2: str, context1: str, context2: str) -> float:
    """Calculate similarity considering both phrase and context."""
    phrase_sim = cosine_similarity(
        sentence_transformer.encode([phrase1, phrase2])
    )[0][1]
    
    context_sim = cosine_similarity(
        sentence_transformer.encode([context1, context2])
    )[0][1]
    
    return 0.7 * phrase_sim + 0.3 * context_sim  # Weighted combination

def calculate_concept_importance(phrase: str, context: str) -> float:
    """Calculate importance score based on multiple factors."""
    # Frequency in the text
    frequency = context.lower().count(phrase.lower())
    
    # Position in the text (earlier mentions might be more important)
    first_occurrence = context.lower().find(phrase.lower())
    position_score = 1 - (first_occurrence / len(context)) if first_occurrence != -1 else 0
    
    # Sentiment analysis
    sentiment = TextBlob(phrase).sentiment.polarity
    sentiment_score = abs(sentiment)
    
    # Combine scores
    return 0.4 * frequency + 0.3 * position_score + 0.3 * sentiment_score

def cluster_concepts(phrases: List[str], threshold: float = 0.5) -> List[List[str]]:
    """Group similar concepts into clusters."""
    if not phrases:
        return []
        
    embeddings = sentence_transformer.encode(phrases)
    similarity_matrix = cosine_similarity(embeddings)
    
    clusters = []
    used_indices = set()
    
    for i in range(len(phrases)):
        if i in used_indices:
            continue
            
        cluster = [phrases[i]]
        used_indices.add(i)
        
        for j in range(i + 1, len(phrases)):
            if j not in used_indices and similarity_matrix[i][j] >= threshold:
                cluster.append(phrases[j])
                used_indices.add(j)
                
        clusters.append(cluster)
    
    return clusters

def compare_notes(student_note: str, peer_notes: List[str]) -> Dict:
    """Compare student's note with peer notes and return missing and common concepts."""
    # Extract key phrases from all notes
    student_phrases = extract_key_phrases(student_note)
    peer_phrases_list = [extract_key_phrases(note) for note in peer_notes]
    
    # Calculate dynamic thresholds
    rake_threshold = calculate_dynamic_threshold(student_phrases)
    semantic_threshold = 0.5  # Base threshold for semantic similarity
    
    # Flatten peer phrases and count occurrences
    all_peer_phrases = defaultdict(int)
    for phrases in peer_phrases_list:
        for phrase in phrases:
            all_peer_phrases[phrase] += 1
    
    # Group similar concepts
    all_phrases = list(set(student_phrases + list(all_peer_phrases.keys())))
    concept_groups = group_similar_concepts(all_phrases, semantic_threshold)
    
    # Calculate importance scores
    student_importance = {p: calculate_concept_importance(p, student_note) 
                         for p in student_phrases}
    
    # Find common phrases with enhanced similarity
    common_phrases = []
    for phrase in student_phrases:
        if phrase in all_peer_phrases:
            context = find_context_for_phrase(phrase, student_note)
            sentiment = analyze_sentiment(context)
            similar_phrases = [p for p in all_phrases 
                             if p != phrase and 
                             any(p in group and phrase in group for group in concept_groups)]
            
            # Calculate enhanced similarity scores
            similarity_scores = []
            for similar_phrase in similar_phrases:
                peer_context = find_context_for_phrase(similar_phrase, peer_notes[0])
                similarity = enhanced_semantic_similarity(
                    phrase, similar_phrase, context, peer_context
                )
                similarity_scores.append({
                    "phrase": similar_phrase,
                    "score": similarity
                })
            
            common_phrases.append({
                "phrase": phrase,
                "context": context,
                "mentioned_by_peers": all_peer_phrases[phrase],
                "sentiment": sentiment,
                "similar_concepts": similarity_scores,
                "importance": student_importance[phrase]
            })
    
    # Find missing phrases with enhanced analysis
    missing_phrases = []
    for phrase, count in all_peer_phrases.items():
        if phrase not in student_phrases and count >= 2:
            for peer_note in peer_notes:
                context = find_context_for_phrase(phrase, peer_note)
                if context:
                    sentiment = analyze_sentiment(context)
                    # Find similar concepts in student's notes
                    similar_in_student = [p for p in student_phrases
                                        if any(p in group and phrase in group 
                                              for group in concept_groups)]
                    
                    missing_phrases.append({
                        "phrase": phrase,
                        "context": context,
                        "mentioned_by_peers": count,
                        "sentiment": sentiment,
                        "similar_in_student_notes": similar_in_student,
                        "importance": calculate_concept_importance(phrase, peer_note)
                    })
                    break
    
    # Cluster concepts for better organization
    student_clusters = cluster_concepts(student_phrases, semantic_threshold)
    peer_clusters = [cluster_concepts(phrases, semantic_threshold) 
                    for phrases in peer_phrases_list]
    
    return {
        "common_concepts": common_phrases,
        "missing_concepts": missing_phrases,
        "concept_clusters": {
            "student_clusters": student_clusters,
            "peer_clusters": peer_clusters
        },
        "importance_scores": student_importance
    }

@app.post("/submit-note")
async def submit_note(
    file: UploadFile = File(None),
    text: str = Form(None)
):
    try:
        if file:
            content = await file.read()
            note_text = extract_text_from_pdf(content)
        elif text:
            note_text = text
        else:
            return JSONResponse(
                status_code=400,
                content={"message": "Either file or text must be provided"}
            )
        
        # Store the note
        notes_storage.append(note_text)
        
        # Compare with existing notes
        if len(notes_storage) > 1:
            comparison_result = compare_notes(note_text, notes_storage[:-1])
        else:
            comparison_result = {
                "common_concepts": [],
                "missing_concepts": [],
                "topics": [],
                "concept_groups": []
            }
        
        return {
            "message": "Note submitted successfully",
            "comparison": comparison_result
        }
    
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"message": f"Error processing note: {str(e)}"}
        )

@app.get("/notes")
async def get_notes():
    return {"notes": notes_storage}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)