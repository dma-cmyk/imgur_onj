document.addEventListener('DOMContentLoaded', function () {
  const imageInput = document.getElementById('image-input');
  const pasteUploadButton = document.getElementById('paste-upload-button');
  const captureButton = document.getElementById('capture-button');
  const urlInput = document.getElementById('url-input');
  const urlUploadButton = document.getElementById('url-upload-button');
  const statusDiv = document.getElementById('status');
  const historyList = document.getElementById('history-list');
  const historyPlaceholder = document.getElementById('history-placeholder');
  
  const openOptionsButton = document.getElementById('open-options-button');
  const openHistoryButton = document.getElementById('open-history-button');
  const folderSelect = document.getElementById('folder-select');
  const dropArea = document.getElementById('drop-area');
  const uploadMethodSelect = document.getElementById('upload-method-select');
  const fileContent = document.getElementById('file-content');
  const clipboardContent = document.getElementById('clipboard-content');
  const screenshotContent = document.getElementById('screenshot-content');
  const urlContent = document.getElementById('url-content');

  // Handle upload method change
  uploadMethodSelect.addEventListener('change', () => {
    const selectedMethod = uploadMethodSelect.value;

    fileContent.style.display = 'none';
    clipboardContent.style.display = 'none';
    screenshotContent.style.display = 'none';
    urlContent.style.display = 'none';

    switch (selectedMethod) {
      case 'file':
        fileContent.style.display = 'block';
        break;
      case 'clipboard':
        clipboardContent.style.display = 'block';
        break;
      case 'screenshot':
        screenshotContent.style.display = 'block';
        break;
      case 'url':
        urlContent.style.display = 'block';
        break;
    }
  });

  // Set initial state
  fileContent.style.display = 'block';

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

      if (!folders.includes(currentFolder)) {
        currentFolder = '未分類';
      }
      
      renderFolderSelect();
      loadHistory();
    });
  });

  // Open options page
  openOptionsButton.addEventListener('click', () => {
    if (chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      window.open(chrome.runtime.getURL('options.html'));
    }
  });

  // Open history page
  openHistoryButton.addEventListener('click', () => {
    chrome.tabs.create({ url: 'history.html' });
  });

  // Folder select listener
  folderSelect.addEventListener('change', () => {
    currentFolder = folderSelect.value;
    chrome.storage.local.set({ 'currentFolder': currentFolder });
    loadHistory();
  });

  // Drag and drop listeners
  dropArea.addEventListener('dragover', (event) => {
    event.stopPropagation();
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    dropArea.classList.add('dragover');
  });

  dropArea.addEventListener('dragleave', (event) => {
    event.stopPropagation();
    event.preventDefault();
    dropArea.classList.remove('dragover');
  });

  dropArea.addEventListener('drop', (event) => {
    event.stopPropagation();
    event.preventDefault();
    dropArea.classList.remove('dragover');
    const files = event.dataTransfer.files;
    handleFiles(files);
  });

  // Upload from file input
  imageInput.addEventListener('change', () => {
    const files = imageInput.files;
    if (files.length > 0) {
        handleFiles(files);
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
      fetch(dataUrl)
        .then(res => res.blob())
        .then(blob => {
          const file = new File([blob], 'screenshot.png', { type: 'image/png' });
          handleUpload(file);
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

  

  async function handleFiles(files) {
    if (!clientId) {
        statusDiv.textContent = '最初にImgurのクライアントIDを保存してください。';
        return;
    }

    const imageFiles = Array.from(files).filter(file => file.type.startsWith('image/'));
    if (imageFiles.length === 0) {
        statusDiv.textContent = '画像ファイルが見つかりませんでした。';
        return;
    }

    const totalFiles = imageFiles.length;
    let uploadedCount = 0;
    let failedCount = 0;

    for (const file of imageFiles) {
        try {
            statusDiv.textContent = `アップロード中... (${uploadedCount + 1}/${totalFiles})`;
            await uploadImage(file, clientId);
            uploadedCount++;
        } catch (error) {
            console.error(`Failed to upload ${file.name}:`, error);
            failedCount++;
        }
    }

    if (failedCount > 0) {
        statusDiv.textContent = `${uploadedCount}個のアップロードが成功、${failedCount}個が失敗しました。`;
    } else {
        statusDiv.textContent = `${uploadedCount}個のファイルのアップロードが完了しました。`;
    }
  }

  async function handleUpload(source) {
    if (!clientId) {
      statusDiv.textContent = '最初にImgurのクライアントIDを保存してください。';
      return;
    }
    statusDiv.textContent = 'アップロード中...';
    try {
      await uploadImage(source, clientId);
      statusDiv.textContent = 'アップロード完了！';
    } catch (error) {
      // The error message is already set by uploadImage
    }
  }

  function uploadImage(source, currentClientId) {
    return new Promise((resolve, reject) => {
        const formData = new FormData();
        formData.append('image', source);

        fetch('https://api.imgur.com/3/image', {
            method: 'POST',
            headers: {
                'Authorization': `Client-ID ${currentClientId}`,
            },
            body: formData
        })
        .then(response => {
            if (!response.ok) {
                return response.json().then(errData => {
                    const errorMsg = errData?.data?.error || `HTTP error! status: ${response.status}`;
                    throw new Error(errorMsg);
                });
            }
            return response.json();
        })
        .then(data => {
            if (data.success) {
                const link = data.data.link;
                const deletehash = data.data.deletehash;
                saveToHistory({ link, deletehash });
                resolve(data.data);
            } else {
                throw new Error(data.data.error || 'Unknown error during upload.');
            }
        })
        .catch(error => {
            statusDiv.textContent = `エラー: ${error.message}`;
            console.error('Upload failed:', error);
            reject(error);
        });
    });
  }

  function saveToHistory(newUpload) {
    chrome.storage.local.get({ 'uploadHistory': [] }, (data) => {
      const history = data.uploadHistory;
      const uploadWithFolder = { ...newUpload, folder: currentFolder };
      history.unshift(uploadWithFolder);
      chrome.storage.local.set({ 'uploadHistory': history }, () => {
        loadHistory();
      });
    });
  }

  function loadHistory() {
    chrome.storage.local.get({ 'uploadHistory': [] }, (data) => {
      let history = data.uploadHistory;
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
          loadHistory();
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