import { useState, useMemo } from 'react';
import { useChromeStorage } from '../hooks/useChromeStorage';
import { deleteFromImgur } from '../lib/imgur';
import { pasteToOpen2ch } from '../lib/onj';
import { ConfirmModal } from '../components/ConfirmModal';
import { 
  Trash2, 
  Copy, 
  ExternalLink, 
  Search,
  CheckSquare,
  Square,
  Maximize2,
  Minimize2,
  X,
  Loader2,
  MessageSquarePlus,
  Play,
  Info,
  Tag as TagIcon
} from 'lucide-react';
import type { UploadItem } from '../types';

export function HistoryPage() {
  const { 
    history, 
    allTags, 
    clientId, 
    loading,
    saveHistory,
    deleteItem,
    removeTagFromItem
  } = useChromeStorage();

  const [filterTag, setFilterTag] = useState<string>('すべて');
  const [selectedLinks, setSelectedLinks] = useState<Set<string>>(new Set());
  const [thumbnailSize, setThumbnailSize] = useState(200);
  const [searchQuery, setSearchQuery] = useState('');
  const [modalItem, setModalItem] = useState<UploadItem | null>(null);

  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    variant: 'danger' | 'primary';
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    variant: 'primary'
  });

  const filteredHistory = useMemo(() => {
    return history.filter(item => {
      const matchesTag = filterTag === 'すべて' || item.tags.includes(filterTag);
      const q = searchQuery.toLowerCase();
      const matchesSearch = !q || (
        item.link.toLowerCase().includes(q) || 
        item.title?.toLowerCase().includes(q) ||
        item.aiDescription?.toLowerCase().includes(q) ||
        item.tags.some(t => t.toLowerCase().includes(q))
      );
      return matchesTag && matchesSearch;
    });
  }, [history, filterTag, searchQuery]);

  const toggleSelect = (link: string) => {
    const newSelected = new Set(selectedLinks);
    if (newSelected.has(link)) newSelected.delete(link);
    else newSelected.add(link);
    setSelectedLinks(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedLinks.size === filteredHistory.length) setSelectedLinks(new Set());
    else setSelectedLinks(new Set(filteredHistory.map(i => i.link)));
  };

  const handleDelete = (items: UploadItem[]) => {
    setConfirmState({
      isOpen: true,
      title: '項目の削除',
      message: `${items.length} 件の画像を削除しますか？\n(Imgurサーバーからも削除を試みます)`,
      variant: 'danger',
      onConfirm: async () => {
        try {
          for (const item of items) {
            if (item.deletehash && clientId) await deleteFromImgur(item.deletehash, clientId).catch(() => {});
            deleteItem(item.link);
          }
          setSelectedLinks(new Set());
          setModalItem(null);
        } catch (err) {
          alert('削除中にエラーが発生しました。');
        }
        setConfirmState(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleAddTag = (items: UploadItem[]) => {
    const newTag = window.prompt(`追加するタグ名を入力してください\n既存: ${allTags.join(', ')}`);
    if (!newTag) return;

    const linksToUpdate = items.map(i => i.link);
    const newHistory = history.map(item => {
      if (linksToUpdate.includes(item.link)) {
        const tags = item.tags.includes(newTag) ? item.tags : [...item.tags, newTag];
        return { ...item, tags };
      }
      return item;
    });
    saveHistory(newHistory);
    setSelectedLinks(new Set());
  };

  const handlePasteToOnJ = async (link: string) => {
    const result = await pasteToOpen2ch(link);
    if (!result.success) alert(result.message);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const getMediaUrl = (link: string) => link.endsWith('.gifv') ? link.replace('.gifv', '.mp4') : link;
  const isVideo = (link: string) => link.endsWith('.mp4') || link.endsWith('.webm') || link.endsWith('.gifv');

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Loader2 className="animate-spin" size={48} color="var(--primary)" />
      </div>
    );
  }

  return (
    <div className="container" style={{ maxWidth: '1200px' }}>
      <header className="header">
        <h1>アップロード履歴</h1>
        <div style={{ display: 'flex', gap: '8px' }}>
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input type="text" className="styled-input" placeholder="タイトル、タグ、説明で検索..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={{ paddingLeft: '36px', marginBottom: 0, width: '300px' }} />
          </div>
          <select className="styled-select" style={{ width: 'auto', marginBottom: 0 }} value={filterTag} onChange={(e) => setFilterTag(e.target.value)}>
            <option value="すべて">すべてのタグ</option>
            {allTags.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </header>

      <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <button onClick={toggleSelectAll} className="btn btn-ghost" title="すべて選択">
            {selectedLinks.size === filteredHistory.length && filteredHistory.length > 0 ? <CheckSquare size={20} color="var(--primary)" /> : <Square size={20} />}
          </button>
          <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{selectedLinks.size} 件選択中</span>
        </div>
        
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button disabled={selectedLinks.size === 0} onClick={() => handleDelete(history.filter(i => selectedLinks.has(i.link)))} className="btn btn-secondary" style={{ color: 'var(--danger)' }}><Trash2 size={16} /> 削除</button>
          <button disabled={selectedLinks.size === 0} onClick={() => handleAddTag(history.filter(i => selectedLinks.has(i.link)))} className="btn btn-secondary"><TagIcon size={16} /> タグ追加</button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '16px' }}>
            <Minimize2 size={16} color="var(--text-muted)" />
            <input type="range" min="120" max="400" value={thumbnailSize} onChange={(e) => setThumbnailSize(parseInt(e.target.value))} style={{ width: '100px' }} />
            <Maximize2 size={16} color="var(--text-muted)" />
          </div>
        </div>
      </div>

      <div className="history-grid" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${thumbnailSize}px, 1fr))` }}>
        {filteredHistory.map((item) => (
          <div key={item.link} className={`img-card ${selectedLinks.has(item.link) ? 'selected' : ''}`} onClick={() => setModalItem(item)} style={{ cursor: 'zoom-in', outline: selectedLinks.has(item.link) ? '4px solid var(--primary)' : 'none' }}>
            <img src={item.link.replace('.mp4', '.png').replace('.gifv', '.png')} alt={item.title} loading="lazy" />
            {isVideo(item.link) && <div style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.6)', borderRadius: 4, padding: 4, zIndex: 5 }}><Play size={14} color="white" fill="white" /></div>}
            {item.title && <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.7)', color: 'white', fontSize: '0.75rem', padding: '4px 8px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.title}</div>}
            <div className="img-overlay">
              <button onClick={(e) => { e.stopPropagation(); toggleSelect(item.link); }} className="btn btn-ghost" style={{ background: 'white' }}>{selectedLinks.has(item.link) ? <CheckSquare size={16} color="var(--primary)" /> : <Square size={16} />}</button>
              <button onClick={(e) => { e.stopPropagation(); handlePasteToOnJ(item.link); }} className="btn btn-ghost" style={{ background: 'var(--primary)', color: 'white' }}><MessageSquarePlus size={16} /></button>
              <button onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(item.link); alert('コピーしました'); }} className="btn btn-ghost" style={{ background: 'white' }}><Copy size={16} /></button>
            </div>
          </div>
        ))}
      </div>

      {modalItem && (
        <div className="custom-modal-overlay" onClick={() => setModalItem(null)}>
          <div className="custom-modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '95%', padding: '16px' }}>
            <button className="btn btn-ghost" onClick={() => setModalItem(null)} style={{ position: 'absolute', top: 8, right: 8, zIndex: 10, background: 'rgba(0,0,0,0.5)', color: 'white' }}><X size={20} /></button>
            <div style={{ background: '#000', borderRadius: '12px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '200px' }}>
              {isVideo(modalItem.link) ? <video src={getMediaUrl(modalItem.link)} controls autoPlay loop muted style={{ width: '100%', maxHeight: '75vh' }} /> : <img src={modalItem.link} alt="" style={{ width: '100%', maxHeight: '75vh', objectFit: 'contain' }} />}
            </div>

            <div style={{ marginTop: 12, background: 'var(--bg-main)', padding: '16px', borderRadius: '12px', textAlign: 'left' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}><Info size={18} color="var(--primary)" /><strong style={{ fontSize: '1.1rem' }}>{modalItem.title || '無題'}</strong></div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
                {modalItem.tags.map(t => (
                  <span key={t} style={{ fontSize: '0.7rem', background: 'var(--border)', padding: '2px 10px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <TagIcon size={10} />
                    {t}
                    {t !== '未分類' && (
                      <X size={10} style={{ cursor: 'pointer', color: 'var(--text-muted)' }} onClick={() => { removeTagFromItem(modalItem.link, t); setModalItem({ ...modalItem, tags: modalItem.tags.filter(tag => tag !== t) }); }} />
                    )}
                  </span>
                ))}
              </div>
              {modalItem.aiDescription && <p style={{ fontSize: '0.95rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border)', paddingTop: '10px' }}>{modalItem.aiDescription}</p>}
            </div>

            <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'center', gap: '12px', width: '100%' }}>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => { handlePasteToOnJ(modalItem.link); setModalItem(null); }}><MessageSquarePlus size={20} /> おんJへ貼り付け</button>
              <button className="btn btn-secondary" onClick={() => chrome.tabs.create({ url: modalItem.link })}><ExternalLink size={20} /></button>
              <button className="btn btn-secondary" onClick={() => { copyToClipboard(modalItem.link); alert('コピーしました'); }}><Copy size={20} /></button>
              <button className="btn btn-secondary" style={{ color: 'var(--danger)' }} onClick={() => handleDelete([modalItem])}><Trash2 size={20} /></button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal isOpen={confirmState.isOpen} title={confirmState.title} message={confirmState.message} variant={confirmState.variant} onConfirm={confirmState.onConfirm} onCancel={() => setConfirmState(prev => ({ ...prev, isOpen: false }))} />
    </div>
  );
}
