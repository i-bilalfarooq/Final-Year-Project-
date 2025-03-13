import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import './App.css';
import Login from './components/Login';
import Register from './components/Register';

function Generator() {
  const [prompt, setPrompt] = useState('');
  const [htmlCode, setHtmlCode] = useState('');
  const [cssCode, setCssCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('html');
  const [copyMessage, setCopyMessage] = useState('Copy Code');
  const navigate = useNavigate();

  const generateCode = async () => {
    if (!prompt.trim()) {
      alert('Please enter a description first.');
      return;
    }

    setIsLoading(true);
    setHtmlCode('');
    setCssCode('');

    try {
      const response = await fetch('http://localhost:5000/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ prompt: prompt }),
      });

      if (response.status === 401) {
        // Unauthorized - token expired or invalid
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        navigate('/login');
        return;
      }

      const data = await response.json();

      if (data.error) {
        alert('Error: ' + data.error);
        return;
      }

      try {
        const parsedResult = JSON.parse(data.result);
        setHtmlCode(parsedResult.html);
        setCssCode(parsedResult.css);
      } catch (e) {
        console.error('Error parsing JSON:', e);
        alert('Error parsing the generated code. Please try again.');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Error connecting to the server. Please make sure the backend is running.');
    } finally {
      setIsLoading(false);
    }
  };

  const copyCode = () => {
    const codeToCopy = activeTab === 'html' ? htmlCode : cssCode;
    
    navigator.clipboard.writeText(codeToCopy)
      .then(() => {
        setCopyMessage('✓ Copied!');
        setTimeout(() => {
          setCopyMessage('Copy Code');
        }, 2000);
      })
      .catch(err => {
        console.error('Could not copy text: ', err);
        alert('Failed to copy to clipboard');
      });
  };

  return (
    <div className="container">
      <div className="main">
        <div className="input-section">
          <h2 className="section-title">Design Your Vision</h2>
          <p className="section-description">
            Describe the web element or page you want to create, and our AI will generate the code for you.
          </p>
          <textarea 
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g., Create a modern navigation bar with a logo, menu items, and a search box. Use a gradient blue color scheme with smooth hover effects."
          />
          <button 
            className="button-primary" 
            onClick={generateCode}
            disabled={isLoading}
          >
            {isLoading ? 'Generating...' : 'Generate Code'}
          </button>
          
          {isLoading && (
            <div className="loading">
              <div className="spinner"></div>
              <p>Working on your design...</p>
            </div>
          )}
        </div>
        
        <div className="output-section">
          <div className="code-display">
            <div className="tabs">
              <div 
                className={`tab ${activeTab === 'html' ? 'active' : ''}`}
                onClick={() => setActiveTab('html')}
              >
                HTML
              </div>
              <div 
                className={`tab ${activeTab === 'css' ? 'active' : ''}`}
                onClick={() => setActiveTab('css')}
              >
                CSS
              </div>
            </div>
            
            <pre style={{ display: activeTab === 'html' ? 'block' : 'none' }}>
              {htmlCode || 'Your generated HTML will appear here...'}
            </pre>
            <pre style={{ display: activeTab === 'css' ? 'block' : 'none' }}>
              {cssCode || 'Your generated CSS will appear here...'}
            </pre>
            
            <button 
              className="button-secondary" 
              onClick={copyCode}
              disabled={!(htmlCode || cssCode)}
            >
              {copyMessage}
            </button>
          </div>
          
          <div className="preview">
            <div className="preview-header">
              <h3>Live Preview</h3>
            </div>
            
            {(htmlCode || cssCode) ? (
              <iframe
                title="preview"
                srcDoc={`
                  <!DOCTYPE html>
                  <html>
                  <head>
                    <style>${cssCode}</style>
                  </head>
                  <body>
                    ${htmlCode}
                  </body>
                  </html>
                `}
                style={{ width: '100%', height: '300px', border: 'none' }}
              />
            ) : (
              <div style={{ textAlign: 'center', color: '#64748b', padding: '40px 0' }}>
                <p>Your design preview will appear here after generation</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Protected route component
const ProtectedRoute = ({ children }) => {
  const user = JSON.parse(localStorage.getItem('user'));
  return user ? children : <Navigate to="/login" />;
};

function App() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    // Check if user is logged in
    const loggedInUser = localStorage.getItem('user');
    if (loggedInUser) {
      setUser(JSON.parse(loggedInUser));
    }
  }, []);

  const handleLogin = (userData) => {
    setUser(userData);
  };

  const handleLogout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    setUser(null);
  };

  return (
    <Router>
      <div>
        <header>
          <h1>AI HTML/CSS Generator</h1>
          <p className="header-subtitle">Transform your ideas into beautiful code in seconds</p>
          {user && (
            <div className="user-menu">
              <span className="user-name">Welcome, {user.name}</span>
              <button onClick={handleLogout} className="button-secondary logout-button">Logout</button>
            </div>
          )}
        </header>
        
        <Routes>
          <Route 
            path="/" 
            element={
              user ? (
                <ProtectedRoute>
                  <Generator />
                </ProtectedRoute>
              ) : (
                <Navigate to="/login" />
              )
            } 
          />
          <Route path="/login" element={<Login onLogin={handleLogin} />} />
          <Route path="/register" element={<Register />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;