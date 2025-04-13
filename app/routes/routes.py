from fastapi import APIRouter, Depends, HTTPException, File, UploadFile, Form
from pydantic import BaseModel # Import BaseModel
from motor.motor_asyncio import AsyncIOMotorClient
from typing import Optional, List
from app.db import get_database_client
from app.extract import extract_key_concepts
import PyPDF2
import google.generativeai as genai
from fastapi import HTTPException
import os
from typing import Dict, Any
import json
from dotenv import load_dotenv

# Configure Gemini API
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")

# Only configure if key is available
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

# Assuming extract_key_concepts is defined elsewhere or remove if not used in this file
# from app.extract import extract_key_concepts

router = APIRouter()

# --- Define a Pydantic model for the request body ---
class NotePayload(BaseModel):
    user_id: str
    content: str
    class_id: str
# --- End Pydantic model definition ---

import io
import re

router = APIRouter()

@router.post("/submit-note")
async def submit_note(
    user_id: str = Form(...),
    content: str = Form(...),
    class_id: str = Form(...),
    pdf_file: Optional[UploadFile] = File(None),
    db_client: AsyncIOMotorClient = Depends(get_database_client)
):
    # If a PDF file is provided, parse its text and use that as content
    if pdf_file:
        pdf_bytes = await pdf_file.read()
        reader = PyPDF2.PdfReader(io.BytesIO(pdf_bytes))
        extracted_text = ""
        for page in reader.pages:
            page_text = page.extract_text()
            if page_text:
                extracted_text += page_text + "\n"
        # Clean up the extracted text:
        # This replaces multiple whitespace characters (including newlines) with a single space.
        note_content = re.sub(r'\s+', ' ', extracted_text).strip()
    else:
        note_content = content

    async with get_database_client() as client:
        db = client.notes_db
        note_data = {
            "user_id": user_id,
            "content": note_content,
            "class_id": class_id
        }

        result = await db.notes.update_one(
            {"user_id": user_id, "class_id": class_id},
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
        
        Keep it concise and factual and concise.
        """
        
        # Get Gemini's response
        response = gemini_model.generate_content(prompt)
        
        try:
            # Parse the JSON response
            gemini_data = json.loads(response.text)
            
            # If we have learning gaps from Gemini, use them as missing concepts
            if "learningGaps" in gemini_data and gemini_data["learningGaps"]:
                result["missing_concepts"] = gemini_data["learningGaps"]
                result["original_missing_concepts"] = missing_concepts  # Keep original for reference
            else:
                result["gemini_analysis_error"] = "No learning gaps found in Gemini response"
            
            # Add the full Gemini analysis to the result
            result["gemini_analysis"] = gemini_data
            
        except json.JSONDecodeError:
            result["gemini_analysis_error"] = "Failed to parse Gemini response as JSON"
            result["gemini_raw_response"] = response.text
        
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
    similarity_method: Optional[str] = "string",  # might be unused with our semantic compare
    sim_threshold: float = 0.8,  # threshold for common concepts using semantic similarity
    use_gemini: bool = True,
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
        print("Result: ", result)
    
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

# Endpoint to update notes with High Note enhanced content
class UpdateNotesPayload(BaseModel):
    user_id: str
    class_id: str
    notes: List[str]

@router.post("/update-notes")
async def update_notes(
    payload: UpdateNotesPayload,
    db_client: AsyncIOMotorClient = Depends(get_database_client)
):
    async with get_database_client() as client:
        db = client.notes_db
        
        # First delete existing notes for this user/class
        await db.notes.delete_many({
            "user_id": payload.user_id,
            "class_id": payload.class_id
        })
        
        # Then insert the new notes
        new_notes = []
        for note_content in payload.notes:
            new_notes.append({
                "user_id": payload.user_id,
                "class_id": payload.class_id,
                "content": note_content
            })
        
        if new_notes:
            await db.notes.insert_many(new_notes)
        
        # Also trigger an update to the student concepts
        try:
            # Get the latest inserted notes
            note_docs = await db.notes.find({
                "user_id": payload.user_id, 
                "class_id": payload.class_id
            }).to_list(length=None)
            
            if note_docs:
                # Combine content for concept extraction
                aggregated_text = " ".join([doc["content"] for doc in note_docs if "content" in doc])
                
                # Extract concepts
                concepts = extract_key_concepts(aggregated_text)
                
                # Update student concepts
                await db.student_concepts.update_one(
                    {"user_id": payload.user_id, "class_id": payload.class_id},
                    {"$set": {"concepts": concepts}},
                    upsert=True
                )
        except Exception as e:
            print(f"Error updating concepts after note update: {e}")
            # We don't want to fail the whole request if just the concept update fails
            pass
        
        return {
            "message": "Notes updated successfully",
            "count": len(new_notes)
        }

@router.get("/test-gemini")
async def test_gemini():
    """
    Test the Gemini API connection by generating a simple response.
    """
    if not GEMINI_API_KEY:
        return {"status": "error", "message": "Gemini API key not configured"}
    
    try:
        gemini_model = genai.GenerativeModel("gemini-1.5-flash")
        response = gemini_model.generate_content("Say hello and confirm you're working correctly!")
        return {
            "status": "success", 
            "message": "Gemini API connection successful", 
            "response": response.text
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}

@router.get("/detailed-note-analysis")
async def detailed_note_analysis(
    user_id: str,
    class_id: str,
    db_client: AsyncIOMotorClient = Depends(get_database_client)
):
    """
    Provide detailed analysis of a student's notes compared to class notes using Gemini.
    This analyzes the raw note content in addition to extracted concepts.
    """
    # Debug information
    print(f"Starting detailed note analysis for user {user_id} in class {class_id}")
    
    # Get API key directly from environment (don't rely on module variable)
    import os
    
    # Explicitly load environment variables
    load_dotenv()
    
    # Get the API key
    api_key = os.environ.get('GEMINI_API_KEY')
    print(f"API key loaded directly: {bool(api_key)}")
    print(f"API key length: {len(api_key) if api_key else 0}")
    
    if not api_key:
        raise HTTPException(
            status_code=400, 
            detail="Gemini API key not configured. Please add GEMINI_API_KEY to your environment variables."
        )
    
    try:
        async with db_client as client:
            db = client.notes_db
            
            # Get the student's notes
            student_notes = await db.notes.find({
                "user_id": user_id, 
                "class_id": class_id
            }).to_list(length=None)
            
            if not student_notes:
                raise HTTPException(status_code=404, detail="No notes found for this student in this class.")
            
            # Get other students' notes for comparison - THIS IS THE PRIMARY DATASET
            other_students_notes = await db.notes.find({
                "class_id": class_id,
                "user_id": {"$ne": user_id}
            }).to_list(length=None)
            
            if not other_students_notes:
                # Instead of failing, just use an empty comparison base
                print("No other students' notes found for comparison. Proceeding with analysis of just this student's notes.")
                other_students_notes = []
            
            # Extract student's note content
            student_content = " ".join([note["content"] for note in student_notes if "content" in note])
            print(f"Student content length: {len(student_content)}")
            
            # Extract other students' note content (if any)
            other_content = " ".join([note["content"] for note in other_students_notes if "content" in note])
            print(f"Other students' content length: {len(other_content)}")
            
            # Get extracted concepts for additional context
            student_concepts_doc = await db.student_concepts.find_one({"user_id": user_id, "class_id": class_id})
            student_concepts = student_concepts_doc.get("concepts", []) if student_concepts_doc else []
            print(f"Student concepts: {student_concepts}")
            
            # Create a condensed version of notes for analysis (to fit token limits)
            student_content_condensed = student_content[:3000] if len(student_content) > 3000 else student_content
            other_content_condensed = other_content[:3000] if len(other_content) > 3000 else other_content
            
            # Extract key concepts from other students' notes to use as a reference dataset
            other_students_concepts = []
            if other_content:
                other_students_concepts = extract_key_concepts(other_content)
                print(f"Extracted concepts from other students: {other_students_concepts}")
            
            try:
                print("Initializing Gemini model...")
                # Use the directly loaded API key to configure Gemini
                genai.configure(api_key=api_key)
                gemini_model = genai.GenerativeModel("gemini-1.5-flash")
                
                # Create a simpler prompt for Gemini analysis that focuses on dataset content
                if other_students_notes:
                    prompt = f"""
                    As an educational assistant, analyze these notes and focus on providing valuable information from the dataset to enhance the student's notes:
                    
                    STUDENT'S NOTES (TO BE ENHANCED):
                    {student_content_condensed}
                    
                    DATASET (NOTES FROM OTHER STUDENTS TO USE AS REFERENCE MATERIAL):
                    {other_content_condensed}
                    
                    EXTRACTED KEY CONCEPTS FROM STUDENT'S NOTES:
                    {', '.join(student_concepts)}
                    
                    EXTRACTED KEY CONCEPTS FROM DATASET:
                    {', '.join(other_students_concepts)}
                    
                    Your task is to identify SPECIFIC content and information from the DATASET (other students' notes) that would be valuable additions to the student's notes. 
                    
                    Rather than general feedback about the student's notes, focus on extracting actual knowledge, facts, examples, and definitions from the dataset that would complement the student's notes.
                    
                    Please analyze the notes and provide a JSON response with the following structure:
                    {{
                        "topicCoverage": [Main topics covered in the DATASET notes - these are reference topics],
                        "missingTopics": [Important topics from the DATASET that are missing from the student's notes],
                        "datasetKnowledge": [List of 5-10 specific facts, definitions, or examples from the DATASET that would enhance the student's notes],
                        "qualityAssessment": [Brief assessment focusing on what information from the DATASET would improve the student's notes],
                        "studyRecommendations": [3-5 specific recommendations based on DATASET content]
                    }}
                    
                    Important: Your recommendations should include actual content from the dataset, not just general study advice.
                    """
                else:
                    # If no other students' notes, provide a standalone analysis
                    prompt = f"""
                    As an educational assistant, analyze these student notes and provide feedback:
                    
                    STUDENT'S NOTES:
                    {student_content_condensed}
                    
                    EXTRACTED KEY CONCEPTS FROM STUDENT'S NOTES:
                    {', '.join(student_concepts)}
                    
                    Please analyze the notes and provide a JSON response with the following structure:
                    {{
                        "topicCoverage": [List of main topics covered in the notes],
                        "qualityAssessment": [Brief assessment of note quality, organization, and completeness],
                        "strengthsAndWeaknesses": {{
                            "strengths": [List of 2-3 strengths in the student's notes],
                            "weaknesses": [List of 2-3 areas for improvement]
                        }},
                        "studyRecommendations": [2-3 specific recommendations to improve understanding]
                    }}
                    
                    Ensure your analysis is constructive, specific, and educational.
                    """
                
                print("Sending prompt to Gemini API...")
                print(f"Prompt length: {len(prompt)}")
                
                # Get Gemini's response
                response = gemini_model.generate_content(prompt)
                print(f"Received response from Gemini API: {response.text[:100]}...")
                
                try:
                    # Parse the JSON response
                    analysis = json.loads(response.text)
                    return {
                        "status": "success",
                        "student_id": user_id,
                        "class_id": class_id,
                        "analysis": analysis
                    }
                except json.JSONDecodeError as json_err:
                    print(f"JSON parsing error: {json_err}")
                    print(f"Raw response: {response.text}")
                    
                    # Try to extract a valid JSON object from the response
                    import re
                    match = re.search(r'(\{.*\})', response.text, re.DOTALL)
                    if match:
                        try:
                            json_str = match.group(1)
                            analysis = json.loads(json_str)
                            return {
                                "status": "success",
                                "student_id": user_id,
                                "class_id": class_id,
                                "analysis": analysis
                            }
                        except:
                            pass
                    
                    # If JSON parsing fails, return both the raw text and a basic analysis
                    return {
                        "status": "partial_success",
                        "student_id": user_id,
                        "class_id": class_id,
                        "raw_analysis": response.text,
                        "basic_analysis": {
                            "topicCoverage": other_students_concepts if other_students_concepts else student_concepts,
                            "qualityAssessment": "Analysis not available - please check raw_analysis field",
                            "studyRecommendations": []
                        },
                        "error": "Failed to parse response as JSON"
                    }
                    
            except Exception as gemini_err:
                print(f"Gemini API error: {gemini_err}")
                return {
                    "status": "error",
                    "message": str(gemini_err),
                    "details": "Error occurred while processing Gemini API request"
                }
    except Exception as general_err:
        print(f"General error in detailed_note_analysis: {general_err}")
        return {
            "status": "error",
            "message": str(general_err),
            "details": "Error occurred while processing the analysis request"
        }

@router.get("/check-environment")
async def check_environment():
    """
    Check the environment variables and debug information.
    """
    import sys
    import os
    from dotenv import load_dotenv
    
    # Reload the environment variables to be sure
    load_dotenv()
    
    # Get API key
    api_key = os.environ.get('GEMINI_API_KEY')
    
    # Check if module is loaded
    gemini_loaded = 'google.generativeai' in sys.modules
    
    # Check the router-level API key variable
    router_api_key = GEMINI_API_KEY
    
    return {
        "env_api_key_exists": bool(api_key),
        "env_api_key_length": len(api_key) if api_key else 0,
        "router_api_key_exists": bool(router_api_key),
        "router_api_key_length": len(router_api_key) if router_api_key else 0,
        "gemini_module_loaded": gemini_loaded,
        "python_version": sys.version,
        "working_directory": os.getcwd(),
        "env_file_exists": os.path.exists('.env'),
    }

