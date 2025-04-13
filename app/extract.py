import re
from typing import List
from difflib import SequenceMatcher
from rake_nltk import Rake
from nltk.corpus import stopwords
from sentence_transformers import SentenceTransformer, util
import nltk

# Download required resources if not present
nltk.download('stopwords')
nltk.download('punkt_tab')  # This downloads the missing tokenizer data

model = SentenceTransformer('paraphrase-MiniLM-L6-v2')

def normalize_phrase(text: str) -> str:
    return re.sub(r'[\W_]+', ' ', text.lower()).strip()

def is_similar(phrase_a: str, phrase_b: str, threshold: float = 0.75, method: str = 'string') -> bool:
    if method == 'string':
        return SequenceMatcher(None, normalize_phrase(phrase_a), normalize_phrase(phrase_b)).ratio() >= threshold
    elif method == 'semantic':
        emb_a = model.encode(phrase_a, convert_to_tensor=True)
        emb_b = model.encode(phrase_b, convert_to_tensor=True)
        return util.pytorch_cos_sim(emb_a, emb_b).item() >= threshold
    else:
        raise ValueError("Unsupported similarity method")

def filter_similar_phrases(phrases: List[str], threshold: float = 0.75, method: str = 'string') -> List[str]:
    filtered = []
    for phrase in phrases:
        if not any(is_similar(phrase, f, threshold, method) for f in filtered):
            filtered.append(phrase)
    return filtered

def extract_key_concepts(text: str, num_concepts: int = 10, threshold: float = 0.75, similarity_method: str = 'string') -> List[str]:
    """
    Extract key concepts from text using RAKE algorithm.
    
    Args:
        text: The text to extract concepts from
        num_concepts: Maximum number of concepts to extract
        threshold: Similarity threshold for filtering similar concepts
        similarity_method: Method for similarity comparison ('string' or 'semantic')
        
    Returns:
        List of extracted key concepts
    """
    print(f"Extracting key concepts from text of length {len(text)}")
    print(f"Parameters: num_concepts={num_concepts}, threshold={threshold}, method={similarity_method}")
    
    # Handle empty or extremely short text
    if not text or len(text) < 50:
        print("Text too short for meaningful extraction")
        return []
    
    try:
        # Initialize RAKE with English stopwords from NLTK
        rake = Rake(stopwords=stopwords.words('english'))
        rake.extract_keywords_from_text(text)
        ranked = rake.get_ranked_phrases()
        
        print(f"RAKE found {len(ranked)} initial phrases")
        
        # Filter out very short or very long phrases
        filtered_by_length = [phrase for phrase in ranked if 3 <= len(phrase) <= 100]
        
        print(f"After length filtering: {len(filtered_by_length)} phrases")
        
        # Filter similar phrases
        unique = filter_similar_phrases(filtered_by_length, threshold, similarity_method)
        
        print(f"After similarity filtering: {len(unique)} unique concepts")
        
        # Take the top concepts
        result = unique[:num_concepts]
        
        print(f"Final concepts extracted: {result}")
        return result
    except Exception as e:
        print(f"Error extracting key concepts: {e}")
        return []
