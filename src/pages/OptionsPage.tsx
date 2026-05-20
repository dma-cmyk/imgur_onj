import { useState, useEffect } from 'react';
import { useChromeStorage } from '../hooks/useChromeStorage';
import { Plus, Save, RefreshCw, X } from 'lucide-react';
import { ConfirmModal } from '../components/ConfirmModal';
import { getAvailableModels } from '../lib/gemini';
import { DEFAULT_TAGS } from '../types';

export function OptionsPage() {
  const { 
    allTags, 
    clientId, 
    geminiApiKey,
    geminiModel,
    saveAllTags, 
    saveClientId,
    saveGeminiApiKey,
    saveGeminiModel
  } = useChromeStorage();

  const [newClientId, setNewClientId] = useState(clientId);
  const [newGeminiKey, setNewGeminiKey] = useState(geminiApiKey);
  const [newGeminiModel, setNewGeminiModel] = useState(geminiModel);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [newTagName, setNewTagName] = useState('');
  const [status, setStatus] = useState('');
  const [loadingModels, setLoadingModels] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  useEffect(() => {
    setNewClientId(clientId);
    setNewGeminiKey(geminiApiKey || '');
    setNewGeminiModel(geminiModel || 'gemini-1.5-flash');
  }, [clientId, geminiApiKey, geminiModel]);

  const fetchModels = async (key: string) => {
    if (!key) return;
    setLoadingModels(true);
    try {
      const models = await getAvailableModels(key);
      setAvailableModels(models);
    } catch (err) {
      console.error('Failed to fetch models', err);
    } finally {
      setLoadingModels(false);
    }
  };

  useEffect(() => {
    if (geminiApiKey) fetchModels(geminiApiKey);
  }, [geminiApiKey]);

  const handleSaveConfig = () => {
    saveClientId(newClientId);
    saveGeminiApiKey(newGeminiKey);
    saveGeminiModel(newGeminiModel);
    setStatus('設定を保存しました！');
    setTimeout(() => setStatus(''), 3000);
  };

  const handleAddTag = () => {
    if (newTagName && !allTags.includes(newTagName)) {
      saveAllTags([...allTags, newTagName]);
      setNewTagName('');
    }
  };

  const performDeleteTag = () => {
    if (!confirmDelete) return;
    saveAllTags(allTags.filter(t => t !== confirmDelete));
    setConfirmDelete(null);
  };

  return (
    <div className="container" style={{ maxWidth: '600px' }}>
      <header className="header">
        <h1>設定</h1>
      </header>

      <div className="card ui-section">
        <h2 style={{ fontSize: '1rem', marginBottom: '12px' }}>APIキー・モデル設定</h2>
        
        <div style={{ marginBottom: '20px' }}>
          <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Imgur Client ID</label>
          <input type="text" className="styled-input" value={newClientId} onChange={(e) => setNewClientId(e.target.value)} style={{ marginBottom: 0 }} />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Gemini API キー</label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input type="password" className="styled-input" value={newGeminiKey} onChange={(e) => setNewGeminiKey(e.target.value)} style={{ marginBottom: 0 }} />
            <button onClick={() => fetchModels(newGeminiKey)} className="btn btn-secondary" title="モデルリストを更新">
              <RefreshCw size={18} className={loadingModels ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>AI モデルの選択</label>
          <select className="styled-select" value={newGeminiModel} onChange={(e) => setNewGeminiModel(e.target.value)} style={{ marginBottom: 0 }}>
            {availableModels.length > 0 ? (
              availableModels.map(m => <option key={m} value={m}>{m}</option>)
            ) : (
              <option value="gemini-1.5-flash">gemini-1.5-flash (デフォルト)</option>
            )}
          </select>
        </div>

        <button onClick={handleSaveConfig} className="btn btn-primary" style={{ width: '100%' }}>
          <Save size={18} /> 設定をすべて保存
        </button>
        {status && <div className="status-toast success" style={{ marginTop: '12px' }}>{status}</div>}
      </div>

      <div className="card ui-section">
        <h2 style={{ fontSize: '1rem', marginBottom: '12px' }}>タグ管理</h2>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
          <input type="text" className="styled-input" placeholder="新しいタグ名" value={newTagName} onChange={(e) => setNewTagName(e.target.value)} style={{ marginBottom: 0 }} />
          <button onClick={handleAddTag} className="btn btn-secondary"><Plus size={18} /> 追加</button>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {allTags.map((tag) => (
            <div key={tag} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', background: 'var(--bg-main)', borderRadius: '20px', border: '1px solid var(--border)' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>{tag}</span>
              {tag !== DEFAULT_TAGS[0] && (
                <button onClick={() => setConfirmDelete(tag)} className="btn btn-ghost" style={{ padding: '2px', color: 'var(--danger)' }}><X size={14} /></button>
              )}
            </div>
          ))}
        </div>
      </div>

      <ConfirmModal 
        isOpen={!!confirmDelete} 
        title="タグの削除" 
        message={`タグ "${confirmDelete}" を削除しますか？\n(既に画像に付いているタグは消えません)`} 
        variant="danger" 
        onConfirm={performDeleteTag} 
        onCancel={() => setConfirmDelete(null)} 
      />
    </div>
  );
}
