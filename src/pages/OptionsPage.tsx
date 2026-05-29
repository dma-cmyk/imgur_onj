import { useState, useEffect } from 'react';
import { useChromeStorage } from '../hooks/useChromeStorage';
import { Plus, Save, RefreshCw, X, Download, Upload, Database, AlertTriangle } from 'lucide-react';
import { ConfirmModal } from '../components/ConfirmModal';
import { getAvailableModels } from '../lib/gemini';
import { DEFAULT_TAGS } from '../types';

export function OptionsPage() {
  const { 
    history,
    allTags, 
    clientId, 
    geminiApiKey,
    geminiModel,
    saveHistory,
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

  // Backup states
  const [includeSettings, setIncludeSettings] = useState(true);
  const [importMode, setImportMode] = useState<'merge' | 'overwrite'>('merge');
  const [restoreSettings, setRestoreSettings] = useState(true);

  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  useEffect(() => {
    setNewClientId(clientId);
    setNewGeminiKey(geminiApiKey || '');
    setNewGeminiModel(geminiModel || 'gemini-flash-latest');
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

  const handleExport = () => {
    const data: any = {
      uploadHistory: history,
      imgurTags: allTags,
    };
    if (includeSettings) {
      data.imgurClientId = clientId;
      data.geminiApiKey = geminiApiKey;
      data.geminiModel = geminiModel;
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `imgur_onj_backup_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setStatus('バックアップファイルを書き出しました！');
    setTimeout(() => setStatus(''), 3000);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string);
        if (!data || (!Array.isArray(data.uploadHistory) && !data.imgurClientId)) {
          alert('無効なバックアップファイルです。');
          return;
        }

        // 1. 履歴の復元
        if (Array.isArray(data.uploadHistory)) {
          let newHistory = [...history];
          if (importMode === 'merge') {
            const existingLinks = new Set(history.map(item => item.link));
            const uniqueIncoming = data.uploadHistory.filter((item: any) => item.link && !existingLinks.has(item.link));
            newHistory = [...uniqueIncoming, ...history];
          } else {
            newHistory = data.uploadHistory;
          }
          saveHistory(newHistory);
        }

        // 2. タグの復元
        if (Array.isArray(data.imgurTags)) {
          const mergedTags = Array.from(new Set([...allTags, ...data.imgurTags]));
          saveAllTags(mergedTags);
        }

        // 3. 設定の復元
        if (restoreSettings) {
          if (data.imgurClientId) saveClientId(data.imgurClientId);
          if (data.geminiApiKey) saveGeminiApiKey(data.geminiApiKey);
          if (data.geminiModel) saveGeminiModel(data.geminiModel);
        }

        setStatus('バックアップデータを復元しました！');
        setTimeout(() => setStatus(''), 3000);
      } catch (err) {
        alert('ファイルの読み込みに失敗しました。ファイルが破損しているか、JSON形式ではありません。');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
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
              <option value="gemini-flash-latest">gemini-flash-latest (デフォルト)</option>
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

      <div className="card ui-section">
        <h2 style={{ fontSize: '1rem', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Database size={18} color="var(--primary)" />
          データのバックアップと移行
        </h2>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
          アップロード履歴（削除キー含む）、タグ、APIキー設定などを他のブラウザ環境やデバイスへ移行できます。
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
          {/* エクスポート */}
          <div style={{ background: 'var(--bg-main)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)' }}>
            <h3 style={{ fontSize: '0.85rem', marginBottom: '8px', fontWeight: 600 }}>エクスポート (保存)</h3>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', marginBottom: '12px', cursor: 'pointer' }}>
              <input type="checkbox" checked={includeSettings} onChange={(e) => setIncludeSettings(e.target.checked)} />
              APIキー・設定値も含める
            </label>
            {includeSettings && (
              <div style={{ display: 'flex', gap: '4px', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '6px 8px', borderRadius: '4px', marginBottom: '12px', alignItems: 'flex-start' }}>
                <AlertTriangle size={12} color="var(--danger)" style={{ marginTop: '2px', flexShrink: 0 }} />
                <span style={{ fontSize: '0.65rem', color: 'var(--danger)' }}>
                  警告: 機密性の高いAPIキーが含まれます。
                </span>
              </div>
            )}
            <button onClick={handleExport} className="btn btn-secondary" style={{ width: '100%', fontSize: '0.8rem', padding: '8px', gap: '6px' }}>
              <Download size={14} /> バックアップを保存
            </button>
          </div>

          {/* インポート */}
          <div style={{ background: 'var(--bg-main)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)' }}>
            <h3 style={{ fontSize: '0.85rem', marginBottom: '8px', fontWeight: 600 }}>インポート (復元)</h3>
            
            <div style={{ marginBottom: '8px' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>履歴の取り込み方法:</span>
              <div style={{ display: 'flex', gap: '12px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', cursor: 'pointer' }}>
                  <input type="radio" name="importMode" checked={importMode === 'merge'} onChange={() => setImportMode('merge')} />
                  マージ (追加)
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', cursor: 'pointer' }}>
                  <input type="radio" name="importMode" checked={importMode === 'overwrite'} onChange={() => setImportMode('overwrite')} />
                  上書き (置換)
                </label>
              </div>
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', marginBottom: '12px', cursor: 'pointer' }}>
              <input type="checkbox" checked={restoreSettings} onChange={(e) => setRestoreSettings(e.target.checked)} />
              設定値も復元する
            </label>

            <button 
              className="btn btn-secondary" 
              style={{ width: '100%', fontSize: '0.8rem', padding: '8px', position: 'relative', overflow: 'hidden', gap: '6px' }}
              onClick={() => document.getElementById('import-file-input')?.click()}
            >
              <Upload size={14} /> バックアップを読込
              <input 
                id="import-file-input"
                type="file" 
                accept=".json" 
                onChange={handleImport} 
                style={{ display: 'none' }}
              />
            </button>
          </div>
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
