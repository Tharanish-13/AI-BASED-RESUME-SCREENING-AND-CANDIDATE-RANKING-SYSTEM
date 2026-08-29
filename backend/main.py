import io
import mimetypes # Added
import asyncio
import os
from datetime import datetime, timedelta
from typing import List, Optional
import google.generativeai as genai
import PyPDF2 # Added back
from bson import ObjectId
from bson.errors import InvalidId
from docx import Document 
from dotenv import load_dotenv
# --- FIX 1: Add Path ---
from fastapi import FastAPI, File, HTTPException, Depends, Query, UploadFile, status, Path
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse 
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
# --- FIX 2: Import AsyncIOMotorDatabase ---
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from passlib.context import CryptContext
from pydantic import BaseModel, EmailStr, Field 
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity

load_dotenv()

app = FastAPI(title="AI Resume Manager API", version="1.0.0")
security = HTTPBearer()

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# MongoDB connection
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
client = AsyncIOMotorClient(MONGO_URI)
# --- FIX 3: Correct Type Hint ---
db: Optional[AsyncIOMotorDatabase] = client.ai_resume_manager # Assign DB directly

# Security
SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Initialize AI models
sentence_model = SentenceTransformer('BAAI/bge-base-en-v1.5')

# Google Generative AI Configuration
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")
AVAILABLE_GEMINI_MODELS = [
    'gemini-3.6-flash',
    'gemini-3.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-flash-latest',
    'gemini-3.7-flash',
    'gemini-pro-latest'
]

if GOOGLE_API_KEY:
    try:
        genai.configure(api_key=GOOGLE_API_KEY)
        print("Gemini API configured successfully with model list:", AVAILABLE_GEMINI_MODELS)
    except Exception as err:
        print(f"Error configuring Gemini API key: {err}")
else:
    print("Warning: GOOGLE_API_KEY not found in .env. AI features relying on Gemini will use mock responses or fail.")

async def generate_gemini_content(prompt: str, max_tokens: int = 500) -> str:
    if not GOOGLE_API_KEY:
        raise ValueError("Google Gemini API key not configured")
    
    last_error = None
    generation_config = genai.types.GenerationConfig(max_output_tokens=max_tokens)
    
    for model_name in AVAILABLE_GEMINI_MODELS:
        try:
            model = genai.GenerativeModel(model_name)
            response = await model.generate_content_async(prompt, generation_config=generation_config)
            if response and response.text:
                return response.text
        except Exception as e:
            last_error = e
            continue
            
    raise last_error or RuntimeError("Could not generate content with any Gemini model")

# Pydantic models
class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    role: str = "student"

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str

class JobDescription(BaseModel):
    title: str
    description: str
    requirements: str
    resume_ids: Optional[List[str]] = None

class InterviewQuestion(BaseModel):
    job_role: str

class ChatMessage(BaseModel):
    message: str
    context: Optional[str] = None

class ResumeEnhanceRequest(BaseModel):
    resume_text: str
    target_job: str

# Utility functions
def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta if expires_delta else timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)) # Use constant
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = await db.users.find_one({"email": email})
    if user is None:
        raise credentials_exception
    # You might want to return a user model instead of a dict for better type hints
    return user

def extract_text_from_pdf(file_content: bytes):
    try:
        pdf_reader = PyPDF2.PdfReader(io.BytesIO(file_content))
        return "".join([page.extract_text() or "" for page in pdf_reader.pages])
    except Exception as e:
        # Log the error properly in a real application
        print(f"Error extracting PDF text: {e}")
        return f"Error extracting PDF text: {str(e)}"

def extract_text_from_docx(file_content: bytes):
    try:
        doc = Document(io.BytesIO(file_content))
        return "\n".join([p.text for p in doc.paragraphs])
    except Exception as e:
        print(f"Error extracting DOCX text: {e}")
        return f"Error extracting DOCX text: {str(e)}"

def calculate_similarity(job_description: str, resume_text: str) -> float:
    # Basic check for empty inputs
    if not job_description or not resume_text:
        return 0.0
    try:
        # Ensure inputs are lists for batch encoding, even if single items
        job_embedding = sentence_model.encode([job_description])
        resume_embedding = sentence_model.encode([resume_text])
        # Calculate cosine similarity
        similarity = cosine_similarity(job_embedding, resume_embedding)[0][0]
        # Clamp the value between 0 and 1 (cosine similarity range)
        return max(0.0, min(1.0, float(similarity)))
    except Exception as e:
        print(f"Similarity calculation error: {e}")
        return 0.0

# --- Routes ---

@app.get("/")
async def root():
    return {"message": "AI Resume Manager API is running"}

# --- Auth Routes ---
@app.post("/auth/register", response_model=Token)
async def register(user: UserCreate):
    existing_user = await db.users.find_one({"email": user.email})
    if existing_user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")
    hashed_password = get_password_hash(user.password)
    user_doc = {
        "email": user.email,
        "full_name": user.full_name,
        "role": user.role,
        "hashed_password": hashed_password,
        "created_at": datetime.utcnow(),
        "is_active": True # Default to active
    }
    await db.users.insert_one(user_doc)
    access_token = create_access_token(data={"sub": user.email})
    return {"access_token": access_token, "token_type": "bearer"}

@app.post("/auth/login", response_model=Token)
async def login(form_data: UserLogin): # Changed variable name for clarity
    db_user = await db.users.find_one({"email": form_data.email})
    if not db_user or not verify_password(form_data.password, db_user["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not db_user.get("is_active", True): # Check if user is active
         raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Inactive user")
    access_token = create_access_token(data={"sub": db_user["email"]})
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/auth/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    # Return only non-sensitive info
    return {
        "email": current_user["email"],
        "full_name": current_user["full_name"],
        "role": current_user["role"]
        # Avoid returning hashed_password, _id etc.
    }

# --- Resume Routes ---
@app.post("/resumes/upload", summary="Upload Resumes", tags=["Resumes"])
async def upload_resumes(files: List[UploadFile] = File(...), current_user: dict = Depends(get_current_user)):
    """Uploads one or more resume files (PDF, DOCX) and stores their content and extracted text."""
    if db is None: # Check DB connection
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Database connection not available")

    uploaded_resumes_info = []
    allowed_content_types = [
        "application/pdf", 
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/msword",
        "application/octet-stream",
        "application/x-zip-compressed",
        "application/wps-office.docx",
        "application/wps-office.pdf"
    ]
    MAX_FILE_SIZE = 10 * 1024 * 1024 # 10 MB limit

    for file in files:
        # Use a nested try-finally to ensure file closure even if processing fails early
        try:
            filename_lower = (file.filename or "").lower()
            is_valid_type = (
                file.content_type in allowed_content_types 
                or filename_lower.endswith(".pdf") 
                or filename_lower.endswith(".docx") 
                or filename_lower.endswith(".doc")
            )

            if not is_valid_type:
                print(f"Skipping file '{file.filename}': Unsupported type '{file.content_type}'")
                continue

            # Read content carefully, check size
            content = await file.read()
            if not content:
                print(f"Skipping empty file: '{file.filename}'")
                continue
            if len(content) > MAX_FILE_SIZE:
                 print(f"Skipping large file: '{file.filename}' ({len(content)} bytes > {MAX_FILE_SIZE} bytes)")
                 continue

            # Extract text
            text = ""
            try:
                if filename_lower.endswith(".pdf") or file.content_type == "application/pdf":
                    text = extract_text_from_pdf(content)
                else: # DOCX / DOC
                    text = extract_text_from_docx(content)
                
                if not text or "Error extracting" in text:
                     print(f"Warning extracting text from '{file.filename}': {text}")
                     text = f"Content extracted from {file.filename}"
            except Exception as text_extraction_error:
                print(f"Error extracting text from '{file.filename}': {text_extraction_error}")
                text = f"Content extracted from {file.filename}"

            if not text or not text.strip():
                text = f"Resume content for {file.filename}"

            # Prepare document for MongoDB
            resume_doc = {
                "filename": file.filename,
                "content_type": file.content_type or "application/octet-stream",
                "text": text, # Extracted text
                "uploaded_by": current_user["email"],
                "uploaded_at": datetime.utcnow(),
                "size": len(content),
                "content": content # Store the raw file bytes
            }
            # Insert into database
            result = await db.resumes.insert_one(resume_doc)

            # Prepare response data
            text_preview = (text[:197].strip() + "...") if len(text) > 200 else text.strip()
            uploaded_resumes_info.append({
                "id": str(result.inserted_id),
                "filename": file.filename,
                "text_preview": text_preview,
                "uploaded_at": resume_doc["uploaded_at"].isoformat()
            })
            print(f"Successfully processed and stored: '{file.filename}'")

        except Exception as e:
            # Log unexpected errors during processing a single file
            print(f"Failed to process file '{file.filename}': {e}")
        finally:
             # Crucial: Ensure the file handle is closed
             await file.close()

    # Check if *any* files were successfully processed
    if not uploaded_resumes_info:
         raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No valid resume files were processed. Check file types, sizes, and content.")

    return {"message": f"Successfully processed {len(uploaded_resumes_info)} resume(s)", "resumes": uploaded_resumes_info}


@app.get("/resumes/all")
async def get_all_resumes(current_user: dict = Depends(get_current_user)):
    resumes = []
    cursor = db.resumes.find(
        {"uploaded_by": current_user["email"]},
        {"filename": 1, "uploaded_at": 1, "content_type": 1, "text": 1, "_id": 1}
    ).sort("uploaded_at", -1)

    async for resume in cursor:
        text = resume.get("text", "")
        text_preview = (text[:197].strip() + "...") if len(text) > 200 else text.strip()
        resumes.append({
            "id": str(resume["_id"]),
            "filename": resume["filename"],
            "uploaded_at": resume["uploaded_at"].isoformat() if resume.get("uploaded_at") else None,
            "content_type": resume.get("content_type", "application/octet-stream"),
            "text_preview": text_preview or f"Resume content for {resume.get('filename', '')}"
        })
    return {"resumes": resumes}

@app.delete("/resumes/{resume_id}", summary="Delete a Resume", tags=["Resumes"], status_code=status.HTTP_200_OK)
async def delete_resume(resume_id: str = Path(..., description="The ID of the resume to delete"), current_user: dict = Depends(get_current_user)): # Applied Fix 1
    if db is None: raise HTTPException(status_code=503, detail="Database unavailable")
    try:
        obj_id = ObjectId(resume_id)
    except InvalidId:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid resume ID format")

    # Check ownership before deleting
    delete_result = await db.resumes.delete_one({"_id": obj_id, "uploaded_by": current_user["email"]})

    if delete_result.deleted_count == 0:
        # Check if the document exists at all to differentiate 404 from 403
        exists = await db.resumes.count_documents({"_id": obj_id}) > 0
        status_code = status.HTTP_403_FORBIDDEN if exists else status.HTTP_404_NOT_FOUND
        detail = "Permission denied" if exists else "Resume not found"
        raise HTTPException(status_code=status_code, detail=detail)

    return {"message": "Resume deleted successfully"} # Return 200 OK on success

@app.get("/resumes/file/{resume_id}", summary="Download/Preview Resume File", tags=["Resumes"])
async def get_resume_file(
    resume_id: str = Path(..., description="The ID of the resume file to retrieve"), # Applied Fix 1
    disposition: str = Query("inline", enum=["inline", "attachment"], description="'inline' for preview, 'attachment' for download"),
    current_user: dict = Depends(get_current_user)
):
    if db is None: raise HTTPException(status_code=503, detail="Database unavailable")
    try:
        obj_id = ObjectId(resume_id)
    except InvalidId:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid resume ID format")

    resume_meta = await db.resumes.find_one(
        {"_id": obj_id, "uploaded_by": current_user["email"]},
        {"content": 1, "filename": 1, "content_type": 1} # Fetch necessary fields
    )

    if not resume_meta:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resume not found or access denied")

    file_content = resume_meta.get("content")
    if not isinstance(file_content, bytes): # Basic check if content exists and is bytes
        print(f"Content issue for resume ID: {resume_id}. Type: {type(file_content)}")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resume file content is missing or invalid in database")

    filename = resume_meta.get("filename", f"resume_{resume_id}")
    media_type = resume_meta.get("content_type") or mimetypes.guess_type(filename)[0] or "application/octet-stream"

    # Sanitize filename for header
    safe_filename = filename.replace('"', '_').encode('utf-8', 'ignore').decode('latin-1') # More robust sanitization
    headers = {'Content-Disposition': f'{disposition}; filename="{safe_filename}"'}

    return StreamingResponse(io.BytesIO(file_content), media_type=media_type, headers=headers)


# --- Job Analysis Route ---
@app.post("/jobs/analyze")
async def analyze_job(job_request: JobDescription, current_user: dict = Depends(get_current_user)): # Renamed input var
    # Store the job description details
    job_doc = {
        "title": job_request.title,
        "description": job_request.description,
        "requirements": job_request.requirements,
        "created_by": current_user["email"],
        "created_at": datetime.utcnow()
    }
    job_result = await db.jobs.insert_one(job_doc)
    job_id_str = str(job_result.inserted_id)

    # Determine which resumes to analyze
    resume_query_filter = {"uploaded_by": current_user["email"]}
    if job_request.resume_ids:
        object_ids = []
        for rid in job_request.resume_ids:
            try:
                object_ids.append(ObjectId(rid))
            except InvalidId:
                print(f"Skipping invalid resume ID format: {rid}")
                continue # Skip invalid IDs
        if not object_ids:
             # If IDs were provided but all were invalid, maybe return error or empty list?
             # Let's proceed but it will likely result in an empty 'resumes' list below.
             print("Warning: resume_ids provided but none were valid ObjectIds.")
             # Explicitly make sure no resumes match if only invalid IDs were given
             resume_query_filter["_id"] = {"$in": []}
        else:
             resume_query_filter["_id"] = {"$in": object_ids}


    # Fetch resumes with necessary fields (text for analysis, uploaded_at for display)
    resumes_cursor = db.resumes.find(resume_query_filter, {"text": 1, "filename": 1, "uploaded_at": 1, "_id": 1})
    resumes_to_analyze = await resumes_cursor.to_list(length=None) # Fetch all matching

    if not resumes_to_analyze:
         # No resumes found matching the criteria
         # Decide whether to store an empty analysis or return an error/message
         print(f"No resumes found for user {current_user['email']} matching the criteria for job {job_id_str}.")
         # Let's store an empty analysis record for consistency
         ranked_resumes = []
    else:
        job_text = f"{job_request.title} {job_request.description} {job_request.requirements}"
        ranked_resumes = []
        for resume in resumes_to_analyze:
            similarity_score = calculate_similarity(job_text, resume.get("text", "")) # Use .get for safety
            ranked_resumes.append({
                "id": str(resume["_id"]),
                "filename": resume.get("filename", "Unknown Filename"),
                "similarity_score": similarity_score,
                "text_preview": (resume.get("text", "")[:300] + "...") if len(resume.get("text", "")) > 300 else resume.get("text", ""),
                "uploaded_at": resume.get("uploaded_at").isoformat() if resume.get("uploaded_at") else None
            })
        ranked_resumes.sort(key=lambda x: x["similarity_score"], reverse=True)

    # Store analysis results
    analysis_doc = {
        "job_id": job_id_str,
        "ranked_resumes": ranked_resumes,
        "analyzed_by": current_user["email"],
        "analyzed_at": datetime.utcnow()
    }
    await db.analyses.insert_one(analysis_doc)

    return {
        "job_id": job_id_str,
        "total_resumes": len(ranked_resumes),
        "ranked_resumes": ranked_resumes
    }


# --- AI Endpoints ---
@app.post("/ai/enhance-resume")
async def enhance_resume(request: ResumeEnhanceRequest, current_user: dict = Depends(get_current_user)):
    if not GOOGLE_API_KEY:
        return {"suggestions": "(Mock Response) Gemini API key not configured."}
    try:
        system_prompt = "You are a professional resume enhancer and expert career coach. Analyze the resume provided and offer actionable bullet-point improvements tailored to the target job role."
        user_prompt = f"Enhance this resume for the target job: {request.target_job}\n\nResume Text:\n{request.resume_text}"
        full_prompt = f"{system_prompt}\n\n{user_prompt}"

        suggestions = await generate_gemini_content(full_prompt, max_tokens=600)

    except ValueError as ve:
        print(f"Content generation blocked for user {current_user['email']}: {ve}")
        suggestions = "The response was blocked due to safety settings. Please rephrase your request."
    except Exception as e:
        print(f"Error generating suggestions for user {current_user['email']}: {e}")
        suggestions = f"Error generating suggestions: {str(e)}"

    enhancement_doc = {
        "original_text": request.resume_text,
        "target_job": request.target_job,
        "suggestions": suggestions,
        "user_email": current_user["email"],
        "created_at": datetime.utcnow()
    }
    await db.enhancements.insert_one(enhancement_doc)
    return {"suggestions": suggestions}


@app.post("/ai/interview-question")
async def generate_interview_question(request: InterviewQuestion, current_user: dict = Depends(get_current_user)):
    if not GOOGLE_API_KEY:
        mock_questions = { "default": "Tell me about a challenging project..." }
        return {"question": mock_questions["default"]}
    try:
        system_prompt = "You are an experienced technical interviewer. Generate one relevant, insightful interview question for the specified job role."
        user_prompt = f"Generate an interview question for a {request.job_role} position."
        full_prompt = f"{system_prompt}\n\n{user_prompt}"

        question = await generate_gemini_content(full_prompt, max_tokens=150)

    except ValueError as ve:
        print(f"Content generation blocked for user {current_user['email']}: {ve}")
        question = "Could not generate question due to content restrictions. Try a different role."
    except Exception as e:
        print(f"Error generating question for user {current_user['email']}: {e}")
        question = f"Error generating question: {str(e)}"

    return {"question": question}


@app.post("/ai/chat")
async def chat_with_ai(message: ChatMessage, current_user: dict = Depends(get_current_user)):
    if not GOOGLE_API_KEY:
        return {"response": "(Mock Response) AI Chat not available without Gemini API key."}
    try:
        system_prompt = "You are an AI career assistant for an AI Resume Manager platform. Provide helpful, concise, and accurate advice regarding resumes, job applications, interview prep, and career growth."
        full_prompt = f"{system_prompt}\n\nUser: {message.message}\nAssistant:"

        reply = await generate_gemini_content(full_prompt, max_tokens=400)

    except ValueError as ve:
        print(f"Chat response blocked for user {current_user['email']}: {ve}")
        reply = "My response was blocked due to safety settings. Can you ask differently?"
    except Exception as e:
        print(f"Error generating chat response for user {current_user['email']}: {e}")
        reply = f"Sorry, I encountered an error: {str(e)}"

    chat_doc = {
        "user_message": message.message,
        "ai_response": reply,
        "user_email": current_user["email"],
        "timestamp": datetime.utcnow()
    }
    await db.chats.insert_one(chat_doc)
    return {"response": reply}


# --- Other Routes ---
@app.get("/templates", summary="Get Resume Templates", tags=["General"])
async def get_resume_templates():
    """Returns a list of available resume template examples inspired by Resume.io."""
    templates = [
        {
            "id": "stockholm-modern",
            "name": "Stockholm (Modern)",
            "description": "Dual-column layout with a dark sidebar, skill tags, and crisp typography",
            "category": "Modern",
            "layout": "sidebar-left",
            "defaultColor": "#1e293b",
            "preview": "https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=400&auto=format&fit=crop&q=80"
        },
        {
            "id": "harvard-professional",
            "name": "Harvard (Professional)",
            "description": "Executive top banner with clean horizontal rules, ideal for corporate roles",
            "category": "Professional",
            "layout": "header-banner",
            "defaultColor": "#0f766e",
            "preview": "https://images.unsplash.com/photo-1586281380117-5a60ae2050cc?w=400&auto=format&fit=crop&q=80"
        },
        {
            "id": "vibrant-creative",
            "name": "Vibrant (Creative)",
            "description": "Stylish headers and rounded skill badge chips for tech & design roles",
            "category": "Creative",
            "layout": "creative-vibrant",
            "defaultColor": "#4f46e5",
            "preview": "https://images.unsplash.com/photo-1512486130939-2c4f79935e4f?w=400&auto=format&fit=crop&q=80"
        },
        {
            "id": "dublin-minimalist",
            "name": "Dublin (Minimalist)",
            "description": "Ultra-clean single-column layout with subtle dividers and spacious typography",
            "category": "Minimalist",
            "layout": "minimalist-single",
            "defaultColor": "#2563eb",
            "preview": "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&auto=format&fit=crop&q=80"
        },
        {
            "id": "onyx-executive",
            "name": "Onyx (Executive)",
            "description": "Premium dark accent header banner with a two-column experience & skills matrix",
            "category": "Executive",
            "layout": "onyx-executive",
            "defaultColor": "#09090b",
            "preview": "https://images.unsplash.com/photo-1450133064473-71024230f91b?w=400&auto=format&fit=crop&q=80"
        },
        {
            "id": "sydney-compact",
            "name": "Sydney (Compact)",
            "description": "High-density balanced 2-column layout optimized for technical experience",
            "category": "Compact",
            "layout": "sydney-compact",
            "defaultColor": "#d97706",
            "preview": "https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=400&auto=format&fit=crop&q=80"
        }
    ]
    return {"templates": templates}

@app.get("/dashboard/stats", summary="Get Dashboard Statistics", tags=["Dashboard"])
async def get_dashboard_stats(current_user: dict = Depends(get_current_user)):
    """Retrieves key statistics and recent activity for the user's dashboard."""
    if db is None: raise HTTPException(status_code=503, detail="Database unavailable")
    try:
        # Perform counts concurrently
        count_tasks = [
            db.resumes.count_documents({"uploaded_by": current_user["email"]}),
            db.jobs.count_documents({"created_by": current_user["email"]}), # Assuming HR creates jobs
            db.analyses.count_documents({"analyzed_by": current_user["email"]})
        ]
        # Fetch recent resumes concurrently
        recent_resumes_task = db.resumes.find(
            {"uploaded_by": current_user["email"]},
            {"filename": 1, "uploaded_at": 1, "_id": 1} # Project only needed fields
        ).sort("uploaded_at", -1).limit(5).to_list(length=5)

        # Await all concurrent operations
        results = await asyncio.gather(*count_tasks, recent_resumes_task, return_exceptions=True)

        # Check for errors from gather
        exceptions = [res for res in results if isinstance(res, Exception)]
        if exceptions:
             print(f"Error fetching dashboard stats for {current_user['email']}: {exceptions}")
             raise HTTPException(status_code=500, detail="Failed to fetch dashboard statistics.")

        total_resumes, total_jobs, total_analyses, recent_resumes_list = results

        # Process recent resumes
        recent_resumes_processed = [
            {
                "_id": str(resume["_id"]), # Return string ID
                "filename": resume.get("filename", "N/A"),
                "uploaded_at": resume.get("uploaded_at").isoformat() if resume.get("uploaded_at") else None
            } for resume in recent_resumes_list
        ]

        return {
            "total_resumes": total_resumes,
            "total_jobs": total_jobs,
            "total_analyses": total_analyses,
            "recent_resumes": recent_resumes_processed
        }
    except Exception as e:
         print(f"Unexpected error in get_dashboard_stats for {current_user['email']}: {e}")
         raise HTTPException(status_code=500, detail="An unexpected error occurred while fetching dashboard data.")
     
@app.get("/analyses/history", summary="Get Analysis History", tags=["Analysis"])
async def get_analysis_history(current_user: dict = Depends(get_current_user)):
    """Retrieves all past analysis results run by the current user, including job titles."""
    if db is None:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Database unavailable")

    pipeline = [
        # Match analyses run by the current user
        { "$match": { "analyzed_by": current_user["email"] } },
        # Sort by date, newest first
        { "$sort": { "analyzed_at": -1 } },
        # Add a temporary field converting string job_id to ObjectId for lookup
        # Handle potential errors if job_id is missing or not a valid ObjectId string
        {
            "$addFields": {
                "job_id_obj": {
                    "$cond": {
                        "if": { "$ne": ["$job_id", None] }, # Check if job_id exists
                        "then": {
                           "$cond": {
                               "if": { "$ne": ["$job_id", ""] }, # Check if job_id is not empty string
                               "then": { "$toObjectId": "$job_id" },
                               "else": None # Handle empty string case
                           }
                        },
                        "else": None # Handle missing job_id case
                    }
                }
            }
        },
        # Lookup job details from the 'jobs' collection
        {
            "$lookup": {
                "from": "jobs",
                "localField": "job_id_obj",
                "foreignField": "_id",
                "as": "jobDetails"
            }
        },
        # Unwind the jobDetails array (should usually be one match)
        # Preserve analyses even if the associated job was deleted
        {
            "$unwind": {
                "path": "$jobDetails",
                "preserveNullAndEmptyArrays": True
            }
        },
        # Project the desired output format
        {
            "$project": {
                "_id": { "$toString": "$_id" }, # Convert analysis ObjectId to string
                "analysisId": { "$toString": "$_id" }, # Duplicate _id as analysisId for clarity if needed
                "jobTitle": { "$ifNull": ["$jobDetails.title", "Job Title Not Found"] }, # Get job title, provide default
                "analyzedAt": "$analyzed_at", # Keep the date object or convert to ISO string: {"$dateToString": {"format": "%Y-%m-%dT%H:%M:%SZ", "date": "$analyzed_at"}},
                "rankedResumes": { # Ensure rankedResumes are included and sorted (already sorted from analysis)
                    "$map": { # Optional: ensure required fields exist in each resume
                        "input": "$ranked_resumes",
                        "as": "resume",
                        "in": {
                            "id": "$$resume.id", # Should already be string
                            "filename": "$$resume.filename",
                            "similarity_score": "$$resume.similarity_score",
                             # Add other fields from ranked_resumes if needed
                        }
                    }
                }
                # Remove temporary job_id_obj and full jobDetails
                # "job_id": 0, # Exclude original job_id string if desired
                # "job_id_obj": 0,
                # "jobDetails": 0,
                # "analyzed_by": 0 # Exclude if not needed on frontend (we know it's the current user)
            }
        }
    ]

    try:
        analysis_history = await db.analyses.aggregate(pipeline).to_list(length=None) # Fetch all results
        return {"history": analysis_history}
    except Exception as e:
        print(f"Error fetching analysis history for {current_user['email']}: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Could not retrieve analysis history.")


# --- Main Execution Guard ---
if __name__ == "__main__":
    import uvicorn
    # asyncio import is already at the top

    port = int(os.getenv("PORT", 8000))
    # Default to 127.0.0.1 for development security unless overridden
    host = os.getenv("HOST", "127.0.0.1")
    print(f"Starting Uvicorn server on http://{host}:{port}")
    # Set reload based on an environment variable, e.g., APP_ENV=development
    reload_flag = os.getenv("APP_ENV", "production").lower() == "development"
    uvicorn.run("main:app", host=host, port=port, reload=reload_flag)