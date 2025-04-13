from fastapi import APIRouter, Depends, HTTPException, Body # Body might not be needed here
from pydantic import BaseModel # Import BaseModel
from motor.motor_asyncio import AsyncIOMotorClient
from typing import Optional
from app.db import get_database_client
from app.extract import extract_key_concepts
import google.generativeai as genai
from fastapi import HTTPException
import os
from typing import Dict, Any, List
# Assuming extract_key_concepts is defined elsewhere or remove if not used in this file
# from app.extract import extract_key_concepts

# Configure Gemini API
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")

# Only configure if key is available
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)


router = APIRouter()

# --- Define a Pydantic model for the request body ---
class NotePayload(BaseModel):
    user_id: str
    content: str
    class_id: str
# --- End Pydantic model definition ---

# Route that only submits a note
@router.post("/submit-note")
async def submit_note(
    payload: NotePayload,
    db_client: AsyncIOMotorClient = Depends(get_database_client)
):
    async with get_database_client() as client:
        db = client.notes_db
        note_data = {
            "user_id": payload.user_id,
            "content": payload.content,
            "class_id": payload.class_id
        }

        # Update existing note or insert if it doesn't exist
        result = await db.notes.update_one(
            {"user_id": payload.user_id, "class_id": payload.class_id},
            {"$set": note_data},
            upsert=True
        )

        return {
            "message": "Note submitted or updated successfully",
            "modified_count": result.modified_count,
            "upserted_id": str(result.upserted_id) if result.upserted_id else None
        }

# ... (rest of your routes remain the same) ...


# Separate route that retrieves notes for a given student and class,
# then performs RAKE to extract key concepts and uploads them to a document
# mapping the student (and optionally, the class) to these concepts.
@router.post("/update-student-concepts")
async def update_student_concepts(
    user_id: str,
    class_id: str,
    num_concepts: Optional[int] = 5,
    similarity_threshold: Optional[float] = 0.75,
    similarity_method: Optional[str] = "string",
    db_client: AsyncIOMotorClient = Depends(get_database_client)
):
    # Use async with to properly retrieve the client from the async context manager
    async with db_client as client:
        db = client.notes_db
        # Retrieve all notes for the specified student and class
        notes_docs = await db.notes.find({"user_id": user_id, "class_id": class_id}).to_list(length=None)
        if not notes_docs:
            raise HTTPException(status_code=404, detail="No notes found for this student and class.")
        
        # Combine the content from all retrieved notes into a single text string
        aggregated_text = " ".join([doc["content"] for doc in notes_docs if "content" in doc])
        
        # Call extract_key_concepts positionally
        concepts = extract_key_concepts(aggregated_text, num_concepts, similarity_threshold, similarity_method)
        
        # Update or insert (upsert) the student's concepts in a dedicated collection (student_concepts)
        await db.student_concepts.update_one(
            {"user_id": user_id, "class_id": class_id},
            {"$set": {"concepts": concepts}},
            upsert=True
        )
        
        return {
            "message": "Student concepts updated successfully.",
            "user_id": user_id,
            "class_id": class_id,
            "concepts": concepts
        }


from sentence_transformers import SentenceTransformer, util

# Initialize the model once (reuse it across requests).
model = SentenceTransformer('paraphrase-MiniLM-L6-v2')

def find_common_concepts(student_concepts, other_concepts, sim_threshold=0.8):
    """
    Compare two lists of concept phrases semantically and return a list of common concepts
    based on a cosine similarity threshold.
    """
    common = set()
    
    # Generate embeddings for both lists of phrases
    student_embeddings = model.encode(student_concepts, convert_to_tensor=True)
    other_embeddings = model.encode(other_concepts, convert_to_tensor=True)
    
    # For each student concept, compute its similarity with all other concepts
    for idx, student_emb in enumerate(student_embeddings):
        # Compute cosine similarities between this student concept and all concepts from other students
        cosine_scores = util.cos_sim(student_emb, other_embeddings)
        # Check if any cosine similarity score exceeds our threshold
        if cosine_scores.max().item() >= sim_threshold:
            common.add(student_concepts[idx])
    
    return list(common)


# Create a middleware function that processes results from your existing implementation
async def apply_gemini_filter(result: Dict[str, Any]) -> Dict[str, Any]:
    """
    Apply Gemini API as a filter layer to enhance the existing analysis.
    This keeps all original data intact and adds Gemini's insights.
    """
    # Check if API key is available
    if not GEMINI_API_KEY:
        result["gemini_analysis_error"] = "Gemini API key not configured"
        return result
        
    # Initialize Gemini model
    try:
        gemini_model = genai.GenerativeModel("gemini-1.5-flash")
        
        # Prepare context from the existing results
        student_concepts = result.get("student_concepts", [])
        other_concepts = result.get("other_students_concepts", [])
        missing_concepts = result.get("missing_concepts", [])
        extra_concepts = result.get("extra_concepts", [])
        common_concepts = result.get("common_concepts", [])
        
        # Build prompt for Gemini
        concepts_summary = {
            "student_concepts": student_concepts,
            "other_concepts": other_concepts,
            "missing_concepts": missing_concepts,
            "extra_concepts": extra_concepts,
            "common_concepts": common_concepts
        }
        
        prompt = f"""
        As an educational assistant, analyze these concept lists from student notes:
        
        Student's concepts: {', '.join(student_concepts) if student_concepts else 'None'}
        Other students' concepts: {', '.join(other_concepts) if other_concepts else 'None'}
        Common concepts: {', '.join(common_concepts) if common_concepts else 'None'}
        Missing concepts: {', '.join(missing_concepts) if missing_concepts else 'None'}
        Extra concepts: {', '.join(extra_concepts) if extra_concepts else 'None'}
        
        Provide a brief JSON analysis with three fields:
        1. "conceptHierarchy": Group the concepts into related themes/categories
        2. "learningGaps": Identify potential knowledge gaps based on missing concepts
        3. "studyRecommendations": 1-2 specific study recommendations
        
        Keep it concise and factual.
        """
        
        # Get Gemini's response
        response = gemini_model.generate_content(prompt)
        
        # Add Gemini's analysis to the result, but keep all original data
        result["gemini_analysis"] = response.text
        
        return result
    
    except Exception as e:
        # In case of any error, return the original result with an error message
        result["gemini_analysis_error"] = str(e)
        return result

# Example usage within your endpoint's logic
@router.get("/analyze-concepts-enhanced")
async def analyze_concepts_enhanced(
    user_id: str,
    class_id: str,
    num_concepts: Optional[int] = 10,
    similarity_threshold: Optional[float] = 0.75,
    similarity_method: Optional[str] = "string",
    sim_threshold: float = 0.8,
    use_gemini: bool = False,  # New parameter to toggle Gemini enhancement
    db_client: AsyncIOMotorClient = Depends(get_database_client)
):
    # Use the async context manager to get the actual client instance
    async with db_client as client:
        db = client.notes_db

        # Retrieve notes of other students
        other_notes_docs = await db.notes.find({
            "class_id": class_id,
            "user_id": {"$ne": user_id}
        }).to_list(length=None)
    
        # Retrieve notes of the given student
        student_notes_docs = await db.notes.find({
            "class_id": class_id,
            "user_id": user_id
        }).to_list(length=None)
    
        if not other_notes_docs:
            raise HTTPException(status_code=404, detail="No notes found from other students.")
        if not student_notes_docs:
            raise HTTPException(status_code=404, detail="No notes found for this student.")
    
        # Aggregate content
        aggregated_other_text = " ".join(doc["content"] for doc in other_notes_docs if "content" in doc)
        aggregated_student_text = " ".join(doc["content"] for doc in student_notes_docs if "content" in doc)
    
        # Use your existing RAKE function to extract concepts using positional arguments
        other_concepts = extract_key_concepts(aggregated_other_text, num_concepts, similarity_threshold, similarity_method)
        student_concepts = extract_key_concepts(aggregated_student_text, num_concepts, similarity_threshold, similarity_method)
    
        # Identify common concepts using semantic similarity
        common_concepts = find_common_concepts(student_concepts, other_concepts, sim_threshold=sim_threshold)
    
        # Compute missing and extra concepts using simple set operations
        missing_concepts = list(set(other_concepts) - set(student_concepts))
        extra_concepts = list(set(student_concepts) - set(other_concepts))
    
        # Create the result dictionary
        result = {
            "other_students_concepts": other_concepts,
            "student_concepts": student_concepts,
            "missing_concepts": missing_concepts,
            "extra_concepts": extra_concepts,
            "common_concepts": common_concepts
        }
        
        # Apply Gemini filter if requested
        if use_gemini:
            print("Applying Gemini filter")
            result = await apply_gemini_filter(result)
    
        return result



@router.get("/class-concepts-weight")
async def calculate_class_concept_weights(
    class_id: str,
    similarity_threshold: Optional[float] = 0.75,
    similarity_method: Optional[str] = "string",
    db_client: AsyncIOMotorClient = Depends(get_database_client)
):
    # Use async with to obtain the database client instance
    async with db_client as client:
        db = client.notes_db
        
        # Retrieve all notes for the given class
        notes_docs = await db.notes.find({"class_id": class_id}).to_list(length=None)
        if not notes_docs:
            raise HTTPException(status_code=404, detail="No notes found for this class.")
        
        total_notes = len(notes_docs)
        concept_frequency = {}
        total_concept_mentions = 0  # To accumulate total mentions for normalization if needed
        
        # Process each note individually to extract its key concepts and count mentions
        for doc in notes_docs:
            if "content" in doc:
                note_content = doc["content"]
                # Extract concepts from the note's content using your extraction function.
                # Assume extract_key_concepts now returns a variable-length list based on relevance.
                # We do not pass a fixed number; alternatively, you could set a very high limit.
                concepts = extract_key_concepts(
                    note_content,
                    similarity_threshold=similarity_threshold,
                    similarity_method=similarity_method
                )
                
                # For each concept extracted, count how many times it appears in the note.
                for concept in concepts:
                    # Use a case-insensitive count
                    count = note_content.lower().count(concept.lower())
                    # Update the overall frequency for the concept.
                    concept_frequency[concept] = concept_frequency.get(concept, 0) + count
                    total_concept_mentions += count
        
        # Compute weight percentage for each concept
        # You could calculate the weight as a percentage of total concept mentions,
        # or, if you prefer, keep the raw counts.
        concept_weights = {}
        for concept, freq in concept_frequency.items():
            # Example 1: Normalize by total mentions so that the weights sum to 100%
            # weight_percent = (freq / total_concept_mentions) * 100
            
            # Example 2: Compute an average mentions per note percentage, if that makes more sense:
            weight_percent = (freq / total_notes)  # This is raw average mention count per note
            
            concept_weights[concept] = round(weight_percent, 2)
    
    return {
        "class_id": class_id,
        "total_notes": total_notes,
        "total_concept_mentions": total_concept_mentions,
        "concept_weights": concept_weights
    }



@router.get("/get-student-notes")
async def get_student_notes(
    user_id: str,
    class_id: str,
    db_client: AsyncIOMotorClient = Depends(get_database_client)
):
    async with get_database_client() as client:
        db = client.notes_db
        notes = await db.notes.find({
            "user_id": user_id,
            "class_id": class_id
        }).to_list(length=None)
        
        if not notes:
            raise HTTPException(status_code=404, detail="No notes found for this student and class.")
        
        return {
            "notes": [note["content"] for note in notes if "content" in note]
        }

