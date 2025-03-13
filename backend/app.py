import os
from flask import Flask, request, jsonify, g
from flask_cors import CORS
import google.generativeai as genai
import json
import hashlib
import jwt
import datetime
import functools
import gspread
from oauth2client.service_account import ServiceAccountCredentials
from werkzeug.security import generate_password_hash, check_password_hash
from dotenv import load_dotenv


load_dotenv()

# Create Flask app instance first
app = Flask(__name__)
CORS(app)  # Enable CORS for React frontend integration

# Configure Google Sheets API
SCOPE = ["https://spreadsheets.google.com/feeds", "https://www.googleapis.com/auth/drive"]
CREDS_FILE = "credentials.json"  # You need to create this from Google Cloud Console
SPREADSHEET_NAME = "AI_Generator_Users"  # Replace with your Google Sheet name

try:
    creds = ServiceAccountCredentials.from_json_keyfile_name(CREDS_FILE, SCOPE)
    client = gspread.authorize(creds)
    sheet = client.open(SPREADSHEET_NAME).sheet1
except Exception as e:
    print(f"Error connecting to Google Sheets: {str(e)}")
    sheet = None

# Secret key for JWT
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "your-secret-key-here")

# Configure Google Gemini API
GOOGLE_API_KEY = "AIzaSyBhZnViNVtXqC7Jszlnva2we1SXvwLr1G4"  # Replace this with your actual API key
genai.configure(api_key=GOOGLE_API_KEY)

# Token validation middleware
def token_required(f):
    @functools.wraps(f)
    def decorated(*args, **kwargs):
        token = None
        auth_header = request.headers.get('Authorization')
        
        if auth_header and auth_header.startswith('Bearer '):
            token = auth_header.split(" ")[1]
            
        if not token:
            return jsonify({'error': 'Token is missing'}), 401
            
        try:
            data = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
            # You can fetch user from the database here if needed
            g.user = data
        except Exception as e:
            return jsonify({'error': 'Token is invalid or expired'}), 401
            
        return f(*args, **kwargs)
    return decorated

# User registration endpoint
@app.route('/register', methods=['POST'])
def register():
    data = request.json
    name = data.get('name')
    email = data.get('email', '').lower()
    password = data.get('password')
    
    if not all([name, email, password]):
        return jsonify({"error": "All fields are required"}), 400
    
    # Validate email format
    import re
    if not re.match(r"[^@]+@[^@]+\.[^@]+", email):
        return jsonify({"error": "Invalid email format"}), 400
    
    try:
        # Check if email already exists
        if sheet:
            # Find all emails
            all_emails = sheet.col_values(2)[1:]  # Skip header row
            if email in all_emails:
                return jsonify({"error": "Email already registered"}), 409
            
            # Hash the password
            hashed_password = generate_password_hash(password)
            
            # Get the next available row
            next_row = len(sheet.get_all_values()) + 1
            
            # Add the new user
            sheet.update_cell(next_row, 1, name)  # Column 1 - Name
            sheet.update_cell(next_row, 2, email)  # Column 2 - Email
            sheet.update_cell(next_row, 3, hashed_password)  # Column 3 - Password
            sheet.update_cell(next_row, 4, datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"))  # Column 4 - Created At
            
            return jsonify({"message": "User registered successfully"}), 201
        else:
            return jsonify({"error": "Unable to connect to user database"}), 500
            
    except Exception as e:
        print(f"Registration error: {str(e)}")
        return jsonify({"error": "Registration failed"}), 500

# User login endpoint
@app.route('/login', methods=['POST'])
def login():
    data = request.json
    email = data.get('email', '').lower()
    password = data.get('password')
    
    if not all([email, password]):
        return jsonify({"error": "Email and password are required"}), 400
    
    try:
        if sheet:
            # Find all emails
            all_records = sheet.get_all_values()[1:]  # Skip header row
            
            user = None
            for record in all_records:
                if record[1] == email:  # Email is in column 2 (index 1)
                    user = {
                        "name": record[0],
                        "email": record[1],
                        "password": record[2]
                    }
                    break
            
            if not user:
                return jsonify({"error": "Invalid email or password"}), 401
            
            # Check password
            if check_password_hash(user["password"], password):
                # Generate access token
                token = jwt.encode({
                    'email': user['email'],
                    'name': user['name'],
                    'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=24)
                }, SECRET_KEY, algorithm="HS256")
                
                return jsonify({
                    "message": "Login successful",
                    "token": token,
                    "user": {
                        "name": user["name"],
                        "email": user["email"]
                    }
                }), 200
            else:
                return jsonify({"error": "Invalid email or password"}), 401
        else:
            return jsonify({"error": "Unable to connect to user database"}), 500
            
    except Exception as e:
        print(f"Login error: {str(e)}")
        return jsonify({"error": "Login failed"}), 500

@app.route('/generate', methods=['POST'])
@token_required
def generate_code():
    """Generate HTML and CSS based on user prompt using Google's Gemini API"""
    data = request.json
    user_prompt = data.get('prompt', '')
    
    if not user_prompt:
        return jsonify({"error": "No prompt provided"}), 400
    
    try:
        # Configure the model - using the recommended newer model
        model = genai.GenerativeModel('gemini-2.0-flash')
        
        # Create the system prompt with context
        prompt = """
        You are an expert web developer specializing in converting natural language descriptions into clean, 
        modern HTML and CSS code. Generate valid, well-structured code based on the user's description.
        
        User request: {user_prompt}
        
        Return only a JSON object with two keys:
        - html: containing the HTML code
        - css: containing the CSS code
        
        The JSON should be properly formatted and valid.
        """.format(user_prompt=user_prompt)
        
        # Generate the response
        response = model.generate_content(prompt)
        
        # Extract the text from the response
        response_text = response.text
        
        # Try to parse as JSON
        try:
            # Check if the response is already a JSON
            json_obj = json.loads(response_text)
            return jsonify({"result": json.dumps(json_obj)})
        except json.JSONDecodeError:
            # If it's not a valid JSON, we'll try to extract JSON from text
            # Look for code blocks in markdown format
            if "```json" in response_text:
                # Extract the JSON part
                json_parts = response_text.split("```json")
                if len(json_parts) > 1:
                    json_text = json_parts[1].split("```")[0].strip()
                    json_obj = json.loads(json_text)
                    return jsonify({"result": json.dumps(json_obj)})
            
            # Fallback - create a structured response
            return jsonify({
                "result": json.dumps({
                    "html": response_text,
                    "css": "/* Please reformat the response as it wasn't in the expected JSON format */"
                })
            })
    
    except Exception as e:
        print(f"Error: {str(e)}")  # Add this for debugging
        return jsonify({"error": str(e)}), 500

# Simple route to test if API is running
@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({"status": "ok"})

if __name__ == '__main__':
    app.run(debug=True, port=5000)