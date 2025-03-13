import os
from flask import Flask, request, jsonify
from flask_cors import CORS
import google.generativeai as genai
import json

app = Flask(__name__)
CORS(app)  # Enable CORS for React frontend integration

# Configure Google Gemini API
GOOGLE_API_KEY = "AIzaSyBhZnViNVtXqC7Jszlnva2we1SXvwLr1G4"  # Replace this with your actual API key
genai.configure(api_key=GOOGLE_API_KEY)

@app.route('/generate', methods=['POST'])
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
