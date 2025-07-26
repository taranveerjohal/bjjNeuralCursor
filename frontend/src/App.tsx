import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import LiveDetection from './components/LiveDetection';
import PoseTraining from './components/PoseTraining';
import PoseTesting from './components/PoseTesting';
import './App.css';

function App() {
  return (
    <Router>
      <div className="App">
        <header className="App-header">
          <h1>BJJ Pose Detection</h1>
          <nav className="nav-tabs">
            <Link to="/" className="nav-tab">Live Detection</Link>
            <Link to="/training" className="nav-tab">Pose Training</Link>
            <Link to="/testing" className="nav-tab">Pose Testing</Link>
          </nav>
        </header>
        
        <main className="App-main">
          <Routes>
            <Route path="/" element={<LiveDetection />} />
            <Route path="/training" element={<PoseTraining />} />
            <Route path="/testing" element={<PoseTesting />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App; 