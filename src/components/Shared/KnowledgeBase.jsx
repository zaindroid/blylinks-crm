import React, { useState } from 'react';
import { BookOpen, Copy, Check, Search, FileText, Shield } from 'lucide-react';

export default function KnowledgeBase({ articles }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedId, setCopiedId] = useState(null);

  const filteredArticles = articles.filter(a => 
    a.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
    a.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.content.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCopy = (id, text) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="knowledge-base-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Knowledge Base & BPO Sales Script Center</h1>
          <p className="page-subtitle">Access standardized sales calling scripts, objection handling frameworks, and compliance guidelines.</p>
        </div>
      </div>

      <div className="card margin-bottom">
        <div className="search-box" style={{ width: '100%' }}>
          <Search size={16} className="search-icon" />
          <input 
            type="text" 
            placeholder="Search calling scripts, objection rebuttals or TCPA compliance rules..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="form-input"
          />
        </div>
      </div>

      <div className="grid-2">
        {filteredArticles.map(art => (
          <div key={art.id} className="card">
            <div className="card-header">
              <span className="card-title"><FileText size={18} className="text-cyan" /> {art.title}</span>
              <span className="badge badge-info">{art.category}</span>
            </div>

            <p className="text-muted text-sm margin-bottom">{art.summary}</p>

            <div className="script-content-box">
              <pre>{art.content}</pre>
            </div>

            <div className="margin-top flex-between">
              <span className="text-xs text-subtle">Updated for Q3 Operations</span>
              <button className="btn btn-secondary btn-sm" onClick={() => handleCopy(art.id, art.content)}>
                {copiedId === art.id ? <Check size={14} className="text-success" /> : <Copy size={14} />}
                {copiedId === art.id ? 'Copied Script!' : 'Copy Script Text'}
              </button>
            </div>
          </div>
        ))}
      </div>

      <style>{`
        .script-content-box {
          background: var(--bg-primary);
          border: 1px solid var(--border-color);
          padding: 1rem;
          border-radius: var(--radius-sm);
          font-family: var(--font-body);
          font-size: 0.825rem;
          color: var(--text-main);
          white-space: pre-wrap;
          line-height: 1.6;
        }
      `}</style>
    </div>
  );
}
