document.addEventListener('DOMContentLoaded', function () {
  const imageInput = document.getElementById('image-input');
  const pasteUploadButton = document.getElementById('paste-upload-button');
  const captureButton = document.getElementById('capture-button');
  const urlInput = document.getElementById('url-input');
  const urlUploadButton = document.getElementById('url-upload-button');
  const statusDiv = document.getElementById('status');
  const historyList = document.getElementById('history-list');
  const historyPlaceholder = document.getElementById('history-placeholder');
  const clearHistoryButton = document.getElementById('clear-history-button');
  const openOptionsButton = document.getElementById('open-options-button');
  const folderSelect = document.getElementById('folder-select');

  let clientId = '';
  let currentFolder = '未分類'; // 現在選択されているフォルダ
  let folders = ['未分類']; // フォルダのリスト

  // Load saved client ID and folders
  chrome.storage.sync.get('imgurClientId', (syncData) => {
    if (syncData.imgurClientId) {
      clientId = syncData.imgurClientId;
    }
    chrome.storage.local.get({ 'imgurFolders': ['未分類'], 'currentFolder': '未分類' }, (localData) => {
      folders = localData.imgurFolders;
      currentFolder = localData.currentFolder;

      // 最後に選択したフォルダが削除されていた場合、「未分類」にフォールバック
      if (!folders.includes(currentFolder)) {
        currentFolder = '未分類';
      }
      
      renderFolderSelect();
      loadHistory();
    });
  });

  // オプションページを開く
  openOptionsButton.addEventListener('click', () => {
    if (chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      window.open(chrome.runtime.getURL('options.html'));
    }
  });

  // フォルダ選択のイベントリスナー
  folderSelect.addEventListener('change', () => {
    currentFolder = folderSelect.value;
    chrome.storage.local.set({ 'currentFolder': currentFolder });
    loadHistory();
  });

  // Upload from file
  imageInput.addEventListener('change', () => {
    const file = imageInput.files[0];
    if (file) {
      handleUpload(file);
    }
  });

  // Upload from clipboard
  pasteUploadButton.addEventListener('click', async () => {
    try {
      const clipboardItems = await navigator.clipboard.read();
      for (const item of clipboardItems) {
        for (const type of item.types) {
          if (type.startsWith('image/')) {
            const blob = await item.getType(type);
            const file = new File([blob], 'clipboard-image.png', { type: blob.type });
            handleUpload(file);
            return;
          }
        }
      }
      statusDiv.textContent = 'クリップボードに画像が見つかりませんでした。';
    } catch (error) {
      console.error('Clipboard API error:', error);
      statusDiv.textContent = 'クリップボードの読み取りに失敗しました。';
    }
  });

  // Capture visible tab
  captureButton.addEventListener('click', () => {
    if (!clientId) {
      statusDiv.textContent = '最初にImgurのクライアントIDを保存してください。';
      return;
    }
    statusDiv.textContent = 'スクリーンショットを撮影中...';
    chrome.tabs.captureVisibleTab(null, { format: "png" }, (dataUrl) => {
      if (chrome.runtime.lastError) {
        statusDiv.textContent = `スクリーンショットの撮影に失敗しました: ${chrome.runtime.lastError.message}`;
        return;
      }
      // dataUrlをBlobに変換してアップロード
      fetch(dataUrl)
        .then(res => res.blob())
        .then(blob => {
          const file = new File([blob], 'screenshot.png', { type: 'image/png' });
          handleUpload(file);
        })
        .catch(error => {
          statusDiv.textContent = `エラー: ${error.message}`;
        });
    });
  });

  // Upload from URL
  urlUploadButton.addEventListener('click', () => {
    const imageUrl = urlInput.value.trim();
    if (imageUrl) {
      handleUpload(imageUrl);
    }
  });

  // Clear History Button
  clearHistoryButton.addEventListener('click', () => {
    if (confirm(`フォルダ「${currentFolder}」の履歴を本当に消去しますか？`)) {
      chrome.storage.local.get({ 'uploadHistory': [] }, (data) => {
        let history = data.uploadHistory;
        // 現在のフォルダに属していないアイテムのみを残す
        const newHistory = history.filter(item => item.folder !== currentFolder);
        chrome.storage.local.set({ 'uploadHistory': newHistory }, () => {
          loadHistory();
        });
      });
    }
  });

  function handleUpload(source) {
    console.log('handleUpload called with source:', source);
    if (!clientId) {
      statusDiv.textContent = '最初にImgurのクライアントIDを保存してください。';
      console.warn('Client ID is not set.');
      return;
    }
    uploadImage(source, clientId);
  }

  function uploadImage(source, currentClientId) {
    console.log('uploadImage called with source:', source, 'and client ID:', currentClientId);
    const formData = new FormData();
    formData.append('image', source);

    statusDiv.textContent = 'アップロード中...';
    console.log('Sending upload request to Imgur API...');

    fetch('https://api.imgur.com/3/image', {
      method: 'POST',
      headers: {
        'Authorization': `Client-ID ${currentClientId}`,
      },
      body: formData
    })
    .then(response => {
      console.log('Imgur API response received:', response);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      console.log('Imgur API data:', data);
      if (data.success) {
        const link = data.data.link;
        const deletehash = data.data.deletehash;
        statusDiv.textContent = `アップロード完了！`;
        saveToHistory({ link, deletehash });
      } else {
        statusDiv.textContent = `アップロードに失敗しました: ${data.data.error}`;
        console.error('Imgur API error:', data.data.error);
      }
    })
    .catch(error => {
      statusDiv.textContent = `エラー: ${error.message}`;
      console.error('Upload failed:', error);
    });
  }

  function saveToHistory(newUpload) {
    chrome.storage.local.get({ 'uploadHistory': [] }, (data) => {
      const history = data.uploadHistory;
      // 新しいアップロードに現在のフォルダ情報を追加
      const uploadWithFolder = { ...newUpload, folder: currentFolder };
      history.unshift(uploadWithFolder);
      chrome.storage.local.set({ 'uploadHistory': history }, () => {
        loadHistory(); // 履歴を再読み込みして表示を更新
      });
    });
  }

  function loadHistory() {
    chrome.storage.local.get({ 'uploadHistory': [] }, (data) => {
      let history = data.uploadHistory;

      // 既存の履歴データにfolderプロパティがない場合の移行処理
      let needsUpdate = false;
      history = history.map(item => {
        if (item.folder === undefined) {
          needsUpdate = true;
          return { ...item, folder: '未分類' };
        }
        return item;
      });

      if (needsUpdate) {
        chrome.storage.local.set({ 'uploadHistory': history }, () => {
          renderHistory(history);
        });
      } else {
        renderHistory(history);
      }
    });
  }

  function renderFolderSelect() {
    folderSelect.innerHTML = '';
    folders.forEach(folder => {
      const option = document.createElement('option');
      option.value = folder;
      option.textContent = folder;
      if (folder === currentFolder) {
        option.selected = true;
      }
      folderSelect.appendChild(option);
    });
  }

  function renderHistory(history) {
    historyList.innerHTML = '';
    const filteredHistory = history.filter(item => item.folder === currentFolder);

    if (filteredHistory.length === 0) {
      historyPlaceholder.style.display = 'block';
      historyList.style.display = 'none';
    } else {
      historyPlaceholder.style.display = 'none';
      historyList.style.display = 'block';
    }

    let dragSrcEl = null;

    function handleDragStart(e) {
      this.classList.add('dragging');
      dragSrcEl = this;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/html', this.innerHTML);
    }

    function handleDragOver(e) {
      if (e.preventDefault) {
        e.preventDefault();
      }
      e.dataTransfer.dropEffect = 'move';
      return false;
    }

    function handleDrop(e) {
      if (e.stopPropagation) {
        e.stopPropagation();
      }
      if (dragSrcEl !== this) {
        const srcIndex = parseInt(dragSrcEl.dataset.index, 10);
        const destIndex = parseInt(this.dataset.index, 10);
        updateHistoryOrder(srcIndex, destIndex);
      }
      return false;
    }

    function handleDragEnd() {
      this.classList.remove('dragging');
    }

    filteredHistory.forEach((item, index) => {
      const li = document.createElement('li');
      li.setAttribute('draggable', true);
      li.dataset.index = index;

      li.addEventListener('dragstart', handleDragStart, false);
      li.addEventListener('dragover', handleDragOver, false);
      li.addEventListener('drop', handleDrop, false);
      li.addEventListener('dragend', handleDragEnd, false);

      const thumbnailUrl = item.link.replace(/(\.[^.]+)$/, 's$1');
      const thumbnail = document.createElement('img');
      thumbnail.src = thumbnailUrl;
      thumbnail.className = 'thumbnail';

      const itemDetails = document.createElement('div');
      itemDetails.className = 'history-item-details';

      const a = document.createElement('a');
      a.href = item.link;
      a.textContent = item.link;
      a.target = '_blank';

      const actions = document.createElement('div');
      actions.className = 'history-item-actions';

      const copyButton = document.createElement('button');
      copyButton.textContent = 'コピー';
      copyButton.className = 'btn btn-secondary btn-small';
      copyButton.addEventListener('click', () => {
        navigator.clipboard.writeText(item.link);
      });

      const pasteButton = document.createElement('button');
      pasteButton.textContent = 'スレに貼る';
      pasteButton.className = 'btn btn-secondary btn-small';
      pasteButton.addEventListener('click', () => {
        pasteToOpen2ch(item.link);
      });

      const deleteButton = document.createElement('button');
      deleteButton.textContent = '削除';
      deleteButton.className = 'btn btn-danger btn-small';
      deleteButton.addEventListener('click', () => {
        deleteImage(item.deletehash, item.folder);
      });

      const moveFolderSelect = document.createElement('select');
      moveFolderSelect.className = 'move-folder-select';
      folders.forEach(folder => {
        const option = document.createElement('option');
        option.value = folder;
        option.textContent = folder;
        if (folder === item.folder) {
          option.selected = true;
        }
        moveFolderSelect.appendChild(option);
      });
      moveFolderSelect.addEventListener('change', (event) => {
        moveImageToFolder(item.link, item.deletehash, item.folder, event.target.value);
      });

      actions.appendChild(copyButton);
      actions.appendChild(pasteButton);
      actions.appendChild(deleteButton);
      actions.appendChild(moveFolderSelect);

      itemDetails.appendChild(a);
      itemDetails.appendChild(actions);

      li.appendChild(thumbnail);
      li.appendChild(itemDetails);

      historyList.appendChild(li);
    });
  }

  function updateHistoryOrder(srcIndex, destIndex) {
    chrome.storage.local.get({ 'uploadHistory': [] }, (data) => {
      let history = data.uploadHistory;
      const filtered = history.filter(item => item.folder === currentFolder);
      const other = history.filter(item => item.folder !== currentFolder);

      const [removed] = filtered.splice(srcIndex, 1);
      filtered.splice(destIndex, 0, removed);

      const newHistory = other.concat(filtered);
      chrome.storage.local.set({ 'uploadHistory': newHistory }, () => {
        loadHistory();
      });
    });
  }

  function moveImageToFolder(link, deletehash, oldFolder, newFolder) {
    chrome.storage.local.get({ 'uploadHistory': [] }, (data) => {
      let history = data.uploadHistory;
      const itemIndex = history.findIndex(item => item.link === link && item.deletehash === deletehash && item.folder === oldFolder);
      if (itemIndex !== -1) {
        history[itemIndex].folder = newFolder;
        chrome.storage.local.set({ 'uploadHistory': history }, () => {
          loadHistory(); // 履歴を再読み込みして表示を更新
        });
      }
    });
  }

  function pasteToOpen2ch(link) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (tab.url && tab.url.includes('open2ch.net')) {
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: (imageUrl) => {
            const textarea = document.querySelector('textarea[name="MESSAGE"]');
            if (textarea) {
              textarea.value += imageUrl;
            }
          },
          args: [link]
        });
      } else {
        statusDiv.textContent = 'おーぷん2chのページを開いてから使用してください。';
      }
    });
  }

  function deleteImage(deletehash, folder) {
    if (!clientId) {
        statusDiv.textContent = '画像を削除するにはクライアントIDを設定してください。';
        return;
    }

    fetch(`https://api.imgur.com/3/image/${deletehash}`, {
        method: 'DELETE',
        headers: {
            'Authorization': `Client-ID ${clientId}`,
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            chrome.storage.local.get({ 'uploadHistory': [] }, (result) => {
                let history = result.uploadHistory;
                // deletehashとfolderが一致するものを削除
                history = history.filter(item => !(item.deletehash === deletehash && item.folder === folder));
                chrome.storage.local.set({ 'uploadHistory': history }, () => {
                    loadHistory();
                });
            });
        } else {
            statusDiv.textContent = `削除に失敗しました: ${data.data.error}`;
        }
    })
    .catch(error => {
        statusDiv.textContent = `エラー: ${error.message}`;
    });
  }
});