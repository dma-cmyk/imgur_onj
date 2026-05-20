import { useState, useRef, useEffect } from 'react';
import { useChromeStorage } from '../hooks/useChromeStorage';
import { uploadToImgur, deleteFromImgur } from '../lib/imgur';
import { pasteToOpen2ch } from '../lib/onj';
import { analyzeImage, redactImage } from '../lib/gemini';
import type { AIAnalysisResult } from '../lib/gemini';
import { ConfirmModal } from '../components/ConfirmModal';
import { 
  Camera, 
  Clipboard, 
  FileUp, 
  Settings, 
  Video, 
  PanelLeftClose, 
  Copy,
  Trash2,
  Loader2,
  ArrowUpRight,
  MessageSquarePlus,
  Play,
  X,
  ExternalLink,
  Sparkles,
  ShieldCheck,
  Search,
  AlertTriangle,
  Info,
  ChevronRight,
  Tag as TagIcon
} from 'lucide-react';

export function PopupPage() {
  const { 
    history, 
    allTags, 
    currentFilterTag, 
    clientId, 
    geminiApiKey,
    geminiModel,
    saveHistory, 
    saveCurrentFilterTag,
    deleteItem,
    removeTagFromItem
  } = useChromeStorage();

  const [uploadMethod, setUploadMethod] = useState<'file' | 'clipboard' | 'screenshot' | 'video' | 'url'>('file');
  const [status, setStatus] = useState<{ text: string, type: 'success' | 'error' | 'info' | 'warning' | null }>({ text: '', type: null });
  const [urlInput, setUrlInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [useAI, setUseAI] = useState(true);
  const [isSidePanel, setIsSidePanel] = useState(false);
  
  const [confirmDelete, setConfirmDelete] = useState<any | null>(null);
  const [previewItem, setPreviewItem] = useState<any | null>(null);
  const [aiPendingItem, setAiPendingItem] = useState<{ file: File | Blob, analysis: AIAnalysisResult } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    const checkView = () => {
      const narrow = window.innerWidth < 450;
      if (narrow) {
        document.body.classList.add('is-popup');
        setIsSidePanel(false);
      } else {
        document.body.classList.remove('is-popup');
        setIsSidePanel(true);
      }
    };
    checkView();
    window.addEventListener('resize', checkView);
    return () => window.removeEventListener('resize', checkView);
  }, []);

  const updateStatus = (text: string, type: 'success' | 'error' | 'info' | 'warning' | null = 'info') => {
    setStatus({ text, type });
    if (type === 'success' || type === 'error' || type === 'warning') {
      setTimeout(() => setStatus(prev => prev.text === text ? { text: '', type: null } : prev), 6000);
    }
  };

  const executeUpload = async (source: File | Blob | string, tags: string[], title: string, description: string) => {
    setIsUploading(true);
    updateStatus('アップロード中...', 'info');
    try {
      const result = await uploadToImgur(source, clientId, title, description);
      saveHistory([{ ...result, tags, title, aiDescription: description }, ...history]);
      updateStatus('完了しました！', 'success');
      setUrlInput('');
    } catch (error: any) {
      updateStatus(`エラー: ${error.message}`, 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const handleAiConfirm = async (redact: boolean) => {
    if (!aiPendingItem) return;
    const { file, analysis } = aiPendingItem;
    setAiPendingItem(null);
    let finalFile = file;
    if (redact) {
      updateStatus('保護処理中...', 'info');
      finalFile = await redactImage(file, analysis.sensitiveAreas);
    }
    await executeUpload(finalFile, analysis.suggestedTags, analysis.title, analysis.description);
  };

  const processAndUpload = async (source: File | Blob | string) => {
    if (!clientId) return updateStatus('ClientIDを設定してください', 'error');

    let finalSource = source;
    let aiTitle = "";
    let aiDesc = "";
    let suggestedTags: string[] = currentFilterTag === 'すべて' ? ['未分類'] : [currentFilterTag];

    if (useAI && typeof source !== 'string') {
      if (!geminiApiKey) {
        updateStatus('APIキーを設定してください', 'warning');
      } else {
        setIsUploading(true);
        updateStatus(`分析中 (${geminiModel})...`, 'info');
        try {
          const analysis = await analyzeImage(source, geminiApiKey, geminiModel, allTags);
          if (analysis.sensitiveAreas.length > 0) {
            setAiPendingItem({ file: source, analysis });
            setIsUploading(false);
            return;
          }
          aiTitle = analysis.title;
          aiDesc = analysis.description;
          suggestedTags = analysis.suggestedTags;
          updateStatus(`AI分析完了: ${aiTitle}`, 'info');
        } catch (err: any) {
          updateStatus(`分析失敗。通常送信します`, 'warning');
        }
      }
    }

    await executeUpload(finalSource, suggestedTags, aiTitle, aiDesc);
  };

  const captureScreenshot = () => {
    updateStatus('撮影中...', 'info');
    // @ts-ignore
    chrome.tabs.captureVisibleTab(null, { format: 'png' }, (dataUrl) => {
      if (chrome.runtime.lastError) return updateStatus('失敗', 'error');
      fetch(dataUrl).then(res => res.blob()).then(blob => {
        processAndUpload(new File([blob], 'screenshot.png', { type: 'image/png' }));
      });
    });
  };

  const openSidebar = () => {
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      if (tab?.id) {
        chrome.runtime.sendMessage({ action: 'openSidePanel', tabId: tab.id });
        window.close();
      }
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    updateStatus('コピーしました！', 'success');
  };

  const handlePasteToOnJ = async (link: string) => {
    const result = await pasteToOpen2ch(link);
    if (result.success) updateStatus('貼り付け完了！', 'success');
    else updateStatus(result.message || '失敗', 'error');
  };

  const performDelete = async () => {
    if (!confirmDelete) return;
    const item = confirmDelete;
    setConfirmDelete(null);
    try {
      if (item.deletehash && clientId) await deleteFromImgur(item.deletehash, clientId).catch(() => {});
      deleteItem(item.link);
      updateStatus('削除しました', 'success');
    } catch (err) {
      updateStatus('削除失敗', 'error');
    }
  };

  const filteredHistory = history.filter(item => {
    const matchesTag = currentFilterTag === 'すべて' || item.tags.includes(currentFilterTag);
    const q = searchQuery.toLowerCase();
    const matchesSearch = !q || (
      item.link.toLowerCase().includes(q) || 
      item.title?.toLowerCase().includes(q) ||
      item.aiDescription?.toLowerCase().includes(q) ||
      item.tags.some(t => t.toLowerCase().includes(q))
    );
    return matchesTag && matchesSearch;
  });

  const getMediaUrl = (link: string) => link.endsWith('.gifv') ? link.replace('.gifv', '.mp4') : link;
  const isVideo = (link: string) => link.endsWith('.mp4') || link.endsWith('.webm') || link.endsWith('.gifv');

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>Imgur ONJ</h1>
        <div style={{ display: 'flex', gap: '4px' }}>
          <button 
            onClick={() => {
              if (!geminiApiKey) updateStatus('APIキーを設定してください', 'warning');
              else { setUseAI(!useAI); updateStatus(!useAI ? 'AI: ON' : 'AI: OFF', 'info'); }
            }} 
            className={`btn btn-ghost ${useAI && geminiApiKey ? 'status-info' : ''}`}
          >
            <Sparkles size={18} color={useAI && geminiApiKey ? "var(--primary)" : "var(--text-muted)"} />
          </button>
          {!isSidePanel && <button onClick={openSidebar} className="btn btn-ghost"><PanelLeftClose size={18} /></button>}
          <button onClick={() => chrome.tabs.create({ url: 'options.html' })} className="btn btn-ghost"><Settings size={18} /></button>
        </div>
      </header>

      <main className="app-main">
        <section className="ui-section">
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <select className="styled-select" value={uploadMethod} onChange={(e) => setUploadMethod(e.target.value as any)}>
              <option value="file">ファイル</option>
              <option value="clipboard">クリップ</option>
              <option value="screenshot">スクショ</option>
              <option value="video">録画</option>
              <option value="url">URL</option>
            </select>
            <select className="styled-select" value={currentFilterTag} onChange={(e) => saveCurrentFilterTag(e.target.value)}>
              <option value="すべて">すべて</option>
              {allTags.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div className="upload-container">
            {isUploading ? (
              <div className="upload-dropzone"><Loader2 className="animate-spin" size={32} /><p>処理中...</p></div>
            ) : (
              <>
                {uploadMethod === 'file' && <div className="upload-dropzone" onClick={() => fileInputRef.current?.click()}><FileUp size={32} /><p>アップロード</p><input type="file" ref={fileInputRef} onChange={(e) => e.target.files && Array.from(e.target.files).forEach(processAndUpload)} multiple accept="image/*" style={{ display: 'none' }} /></div>}
                {uploadMethod === 'clipboard' && <button onClick={async () => { const items = await navigator.clipboard.read(); for (const item of items) { const type = item.types.find(t => t.startsWith('image/')); if (type) return processAndUpload(new File([await item.getType(type)], 'clip.png', { type })); } }} className="btn btn-primary" style={{ width: '100%', height: '100px' }}><Clipboard size={24} /> 貼り付け</button>}
                {uploadMethod === 'screenshot' && <button onClick={captureScreenshot} className="btn btn-primary" style={{ width: '100%', height: '100px' }}><Camera size={24} /> スクショ</button>}
                {uploadMethod === 'video' && <button onClick={isRecording ? () => mediaRecorderRef.current?.stop() : () => { chrome.desktopCapture.chooseDesktopMedia(['screen', 'window', 'tab'], (id) => { if (!id) return; navigator.mediaDevices.getUserMedia({ video: { mandatory: { chromeMediaSource: 'desktop', chromeMediaSourceId: id } } } as any).then(s => { streamRef.current = s; const r = new MediaRecorder(s); mediaRecorderRef.current = r; const c: Blob[] = []; r.ondataavailable = e => c.push(e.data); r.onstop = () => { executeUpload(new File(c, 'rec.webm', { type: 'video/webm' }), [currentFilterTag === 'すべて' ? '未分類' : currentFilterTag], "動画キャプチャ", "Imgur ONJ"); s.getTracks().forEach(t => t.stop()); setIsRecording(false); }; r.start(); setIsRecording(true); }); }); }} className={`btn ${isRecording ? 'btn-danger' : 'btn-primary'}`} style={{ width: '100%', height: '100px' }}><Video size={24} /> {isRecording ? '停止' : '録画'}</button>}
                {uploadMethod === 'url' && <div style={{ display: 'flex', gap: '4px' }}><input type="text" className="styled-input" placeholder="URL" value={urlInput} onChange={(e) => setUrlInput(e.target.value)} /><button onClick={() => executeUpload(urlInput, [currentFilterTag === 'すべて' ? '未分類' : currentFilterTag], "", "")} className="btn btn-primary"><ArrowUpRight size={20} /></button></div>}
              </>
            )}
          </div>
          {status.text && (
            <div className={`status-toast ${status.type}`} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {status.type === 'warning' && <AlertTriangle size={16} />}
              {status.text}
            </div>
          )}
        </section>

        <section className="ui-section">
          <div className="ui-section-title">
            <span>履歴</span>
            <button className="btn btn-ghost" onClick={() => chrome.tabs.create({ url: 'history.html' })}>すべて見る <ChevronRight size={14} /></button>
          </div>
          <div style={{ position: 'relative', marginBottom: '12px' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input type="text" className="styled-input" placeholder="検索..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={{ paddingLeft: 32, paddingBottom: 8, paddingTop: 8, fontSize: '0.75rem', marginBottom: 0 }} />
          </div>

          <div className="history-grid" style={{ gridTemplateColumns: isSidePanel ? 'repeat(auto-fill, minmax(100px, 1fr))' : 'repeat(3, 1fr)' }}>
            {filteredHistory.slice(0, 15).map((item) => (
              <div key={item.link} className="img-card shadow-sm" onClick={() => setPreviewItem(item)}>
                <img src={item.link.replace('.mp4', '.png').replace('.gifv', '.png')} alt="" loading="lazy" />
                {isVideo(item.link) && <div style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,0.6)', borderRadius: 4, padding: 2 }}><Play size={10} color="white" fill="white" /></div>}
                {item.title && <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.6)', color: 'white', fontSize: '0.6rem', padding: '2px 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</div>}
                <div className="img-overlay">
                  <button className="btn btn-ghost" style={{ background: 'var(--primary)', color: 'white', padding: 6 }} onClick={(e) => { e.stopPropagation(); handlePasteToOnJ(item.link); }}><MessageSquarePlus size={14} /></button>
                  <button className="btn btn-ghost" style={{ background: 'white', color: 'black', padding: 6 }} onClick={(e) => { e.stopPropagation(); copyToClipboard(item.link); }}><Copy size={14} /></button>
                  <button className="btn btn-ghost" style={{ background: 'var(--danger)', color: 'white', padding: 6 }} onClick={(e) => { e.stopPropagation(); setConfirmDelete(item); }}><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      {aiPendingItem && (
        <div className="custom-modal-overlay">
          <div className="custom-modal-content" style={{ maxWidth: '300px' }}>
            <div className="custom-modal-icon primary"><ShieldCheck size={28} /></div>
            <h2 className="custom-modal-title">プライバシー保護</h2>
            <p className="custom-modal-message">
              個人情報（{aiPendingItem.analysis.sensitiveAreas.map(a => a.label).join(", ")}）を検出しました。モザイクをかけますか？
            </p>
            <div className="custom-modal-actions">
              <button className="modal-btn cancel" onClick={() => handleAiConfirm(false)}>そのまま</button>
              <button className="modal-btn confirm primary" onClick={() => handleAiConfirm(true)}>保護する</button>
            </div>
          </div>
        </div>
      )}

      {previewItem && (
        <div className="custom-modal-overlay" onClick={() => setPreviewItem(null)}>
          <div className="custom-modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '95%', padding: '12px' }}>
            <button className="btn btn-ghost" onClick={() => setPreviewItem(null)} style={{ position: 'absolute', top: 8, right: 8, zIndex: 10, background: 'rgba(0,0,0,0.5)', color: 'white' }}><X size={18} /></button>
            <div style={{ background: '#000', borderRadius: 8, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 100 }}>
              {isVideo(previewItem.link) ? <video src={getMediaUrl(previewItem.link)} controls autoPlay loop muted style={{ width: '100%', maxHeight: '60vh' }} /> : <img src={previewItem.link} alt="" style={{ width: '100%', maxHeight: '60vh', objectFit: 'contain' }} />}
            </div>
            <div style={{ marginTop: 12, background: 'var(--bg-main)', padding: '12px', borderRadius: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}><Info size={14} color="var(--primary)" /><strong>{previewItem.title || '無題'}</strong></div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '8px' }}>
                {previewItem.tags.map((t: string) => (
                  <span key={t} style={{ fontSize: '0.65rem', background: 'var(--border)', padding: '2px 8px', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <TagIcon size={10} />
                    {t}
                    {t !== '未分類' && (
                      <X size={10} style={{ cursor: 'pointer', color: 'var(--text-muted)' }} onClick={() => removeTagFromItem(previewItem.link, t)} />
                    )}
                  </span>
                ))}
              </div>
              {previewItem.aiDescription && <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border)', paddingTop: '8px' }}>{previewItem.aiDescription}</p>}
            </div>
            <div style={{ marginTop: 16, display: 'flex', gap: 8, width: '100%' }}>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => { handlePasteToOnJ(previewItem.link); setPreviewItem(null); }}><MessageSquarePlus size={16} /> 貼り付け</button>
              <button className="btn btn-secondary" onClick={() => chrome.tabs.create({ url: previewItem.link })}><ExternalLink size={16} /></button>
              <button className="btn btn-secondary" onClick={() => copyToClipboard(previewItem.link)}><Copy size={16} /></button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal isOpen={!!confirmDelete} title="削除確認" message="削除しますか？" variant="danger" onConfirm={performDelete} onCancel={() => setConfirmDelete(null)} />
    </div>
  );
}
