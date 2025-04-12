import React, { useState } from 'react';
import './App.css';

function App() {
  const [prompt, setPrompt] = useState('');
  const [htmlCode, setHtmlCode] = useState('');
  const [cssCode, setCssCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeCodeTab, setActiveCodeTab] = useState('html');
  const [activeView, setActiveView] = useState('code');
  const [copyMessage, setCopyMessage] = useState('Copy Code');

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
        },
        body: JSON.stringify({ prompt: prompt }),
      });

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
    const codeToCopy = activeCodeTab === 'html' ? htmlCode : cssCode;
    navigator.clipboard.writeText(codeToCopy)
      .then(() => {
        setCopyMessage('Copied!');
        setTimeout(() => setCopyMessage('Copy Code'), 2000);
      })
      .catch(err => console.error('Copy failed:', err));
  };

  return (
    <div className="container">
      <header>
        <h1>AI HTML/CSS Generator</h1>
        <p className="header-subtitle">Transform your ideas into beautiful code in seconds</p>
      </header>
      
      <div className="main">
        <div className="input-section">
          <h2 className="section-title">Design Your Vision</h2>
          <p className="section-description">
            Describe the web element or page you want to create, and our AI will generate the code for you.
          </p>
          <textarea 
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g., Create a modern navigation bar with a logo, menu items, and a search box..."
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
          <div className="output-header">
            <h2>Output</h2>
            <div className="output-tabs">
              <div 
                className={`output-tab ${activeView === 'code' ? 'active' : ''}`}
                onClick={() => setActiveView('code')}
              >
                Code View
              </div>
              <div 
                className={`output-tab ${activeView === 'preview' ? 'active' : ''}`}
                onClick={() => setActiveView('preview')}
              >
                Preview
              </div>
            </div>
          </div>

          <div className={`code-display ${activeView === 'code' ? 'active' : ''}`}>
            <div className="code-tabs">
              <div 
                className={`code-tab ${activeCodeTab === 'html' ? 'active' : ''}`}
                onClick={() => setActiveCodeTab('html')}
              >
                HTML
              </div>
              <div 
                className={`code-tab ${activeCodeTab === 'css' ? 'active' : ''}`}
                onClick={() => setActiveCodeTab('css')}
              >
                CSS
              </div>
            </div>
            
            <pre style={{ display: activeCodeTab === 'html' ? 'block' : 'none' }}>
              {htmlCode || '// Generated HTML will appear here...'}
            </pre>
            <pre style={{ display: activeCodeTab === 'css' ? 'block' : 'none' }}>
              {cssCode || '// Generated CSS will appear here...'}
            </pre>
            
            <button 
              className={`button-secondary ${copyMessage === 'Copied!' ? 'copied' : ''}`}
              onClick={copyCode}
              disabled={!(htmlCode || cssCode)}
            >
              {copyMessage}
            </button>
          </div>

          <div className={`preview ${activeView === 'preview' ? 'active' : ''}`}>
            <div className="preview-header">
              <h3>Live Preview</h3>
            </div>
            {(htmlCode || cssCode) ? (
              <iframe
                title="preview"
                srcDoc={`<html><head><style>${cssCode}</style></head><body>${htmlCode}</body></html>`}
              />
            ) : (
              <div className="preview-placeholder">
                <p>Your design preview will appear here</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;