import { useState, useEffect, useCallback } from 'react';
import type { UploadItem } from '../types';
import { DEFAULT_TAGS } from '../types';

export function useChromeStorage() {
  const [history, setHistory] = useState<UploadItem[]>([]);
  const [allTags, setAllTags] = useState<string[]>(DEFAULT_TAGS);
  const [currentFilterTag, setCurrentFilterTag] = useState<string>('すべて');
  const [clientId, setClientId] = useState<string>('');
  const [geminiApiKey, setGeminiApiKey] = useState<string>('');
  const [geminiModel, setGeminiModel] = useState<string>('gemini-1.5-flash');
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(() => {
    chrome.storage.sync.get(['imgurClientId', 'geminiApiKey', 'geminiModel'], (syncData) => {
      if (syncData.imgurClientId) setClientId(syncData.imgurClientId as string);
      if (syncData.geminiApiKey) setGeminiApiKey(syncData.geminiApiKey as string);
      if (syncData.geminiModel) setGeminiModel(syncData.geminiModel as string);
      
      chrome.storage.local.get({
        'uploadHistory': [],
        'imgurTags': DEFAULT_TAGS,
        'currentFilterTag': 'すべて'
      }, (localData) => {
        const rawHistory = (localData.uploadHistory || []) as any[];
        const normalizedHistory: UploadItem[] = rawHistory.map(item => {
          if (!Array.isArray(item.tags)) {
            const folder = item.folder || '未分類';
            return { ...item, tags: [folder] } as UploadItem;
          }
          return item as UploadItem;
        });

        setHistory(normalizedHistory);
        setAllTags(localData.imgurTags as string[]);
        setCurrentFilterTag(localData.currentFilterTag as string);
        setLoading(false);
      });
    });
  }, []);

  useEffect(() => {
    loadData();
    const listener = () => loadData();
    chrome.storage.onChanged.addListener(listener);
    const messageListener = (message: any) => {
      if (message.action === 'refreshHistory') loadData();
    };
    chrome.runtime.onMessage.addListener(messageListener);
    return () => {
      chrome.storage.onChanged.removeListener(listener);
      chrome.runtime.onMessage.removeListener(messageListener);
    };
  }, [loadData]);

  const saveHistory = (newHistory: UploadItem[]) => {
    // Collect all unique tags from history to update global tag list
    const tagsInHistory = new Set<string>();
    newHistory.forEach(item => item.tags.forEach(t => tagsInHistory.add(t)));
    const updatedGlobalTags = Array.from(new Set([...DEFAULT_TAGS, ...Array.from(tagsInHistory)]));

    chrome.storage.local.set({ 
      uploadHistory: newHistory,
      imgurTags: updatedGlobalTags
    }, () => {
      setHistory(newHistory);
      setAllTags(updatedGlobalTags);
      chrome.runtime.sendMessage({ action: 'historyUpdated' });
    });
  };

  const deleteItem = (link: string) => {
    saveHistory(history.filter(item => item.link !== link));
  };

  const removeTagFromItem = (link: string, tagToRemove: string) => {
    const newHistory = history.map(item => {
      if (item.link === link) {
        const newTags = item.tags.filter(t => t !== tagToRemove);
        return { ...item, tags: newTags.length > 0 ? newTags : ['未分類'] };
      }
      return item;
    });
    saveHistory(newHistory);
  };

  const saveAllTags = (newTags: string[]) => {
    chrome.storage.local.set({ imgurTags: newTags }, () => setAllTags(newTags));
  };

  const saveCurrentFilterTag = (tag: string) => {
    chrome.storage.local.set({ currentFilterTag: tag }, () => setCurrentFilterTag(tag));
  };

  const saveClientId = (newId: string) => {
    chrome.storage.sync.set({ imgurClientId: newId }, () => setClientId(newId));
  };

  const saveGeminiApiKey = (newKey: string) => {
    chrome.storage.sync.set({ geminiApiKey: newKey }, () => setGeminiApiKey(newKey));
  };

  const saveGeminiModel = (newModel: string) => {
    chrome.storage.sync.set({ geminiModel: newModel }, () => setGeminiModel(newModel));
  };

  return {
    history,
    allTags,
    currentFilterTag,
    clientId,
    geminiApiKey,
    geminiModel,
    loading,
    saveHistory,
    deleteItem,
    removeTagFromItem,
    saveAllTags,
    saveCurrentFilterTag,
    saveClientId,
    saveGeminiApiKey,
    saveGeminiModel,
    refresh: loadData
  };
}
