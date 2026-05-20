document.addEventListener('DOMContentLoaded', function () {
  const clientIdInput = document.getElementById('client-id');
  const saveButton = document.getElementById('save-button');
  const saveStatusDiv = document.getElementById('save-status');

  const newFolderNameInput = document.getElementById('new-folder-name');
  const createFolderButton = document.getElementById('create-folder-button');
  const folderListDiv = document.getElementById('folder-list');

  let clientId = '';
  let folders = ['未分類']; // フォルダのリスト

  // クライアントIDの読み込み
  chrome.storage.sync.get('imgurClientId', (data) => {
    if (data.imgurClientId) {
      clientIdInput.value = data.imgurClientId;
      clientId = data.imgurClientId;
    }
  });

  // クライアントIDの保存
  saveButton.addEventListener('click', () => {
    const newClientId = clientIdInput.value;
    console.log('Attempting to save client ID:', newClientId);
    if (newClientId) {
      clientId = newClientId;
      chrome.storage.sync.set({ 'imgurClientId': clientId }, () => {
        if (chrome.runtime.lastError) {
          console.error('Error saving client ID:', chrome.runtime.lastError.message);
          saveStatusDiv.textContent = `保存に失敗しました: ${chrome.runtime.lastError.message}`;
        } else {
          saveStatusDiv.textContent = '保存しました！';
          setTimeout(() => {
            saveStatusDiv.textContent = '';
          }, 2000);
        }
      });
    } else {
      saveStatusDiv.textContent = 'クライアントIDを入力してください。';
    }
  });

  // フォルダ関連の処理
  loadFolders();

  // フォルダを保存する関数
  function saveFolders() {
    chrome.storage.local.set({ 'imgurFolders': folders });
    renderFolders();
  }

  // フォルダを読み込む関数
  function loadFolders() {
    chrome.storage.local.get({ 'imgurFolders': ['未分類'] }, (data) => {
      folders = data.imgurFolders;
      renderFolders();
    });
  }

  // フォルダを表示する関数
  function renderFolders() {
    folderListDiv.innerHTML = '';
    folders.forEach(folder => {
      const folderDiv = document.createElement('div');
      folderDiv.className = 'folder-item';

      const folderNameSpan = document.createElement('span');
      folderNameSpan.textContent = folder;
      folderDiv.appendChild(folderNameSpan);

      if (folder !== '未分類') { // '未分類' フォルダは削除・リネーム不可
        const renameButton = document.createElement('button');
        renameButton.textContent = 'リネーム';
        renameButton.className = 'btn btn-secondary btn-small folder-action-btn';
        renameButton.addEventListener('click', (e) => {
          e.stopPropagation();
          const newName = prompt(`フォルダ「${folder}」の新しい名前を入力してください:`);
          if (newName && newName.trim() !== '' && newName !== folder && !folders.includes(newName)) {
            renameFolder(folder, newName.trim());
          }
        });
        folderDiv.appendChild(renameButton);

        const deleteFolderButton = document.createElement('button');
        deleteFolderButton.textContent = '削除';
        deleteFolderButton.className = 'btn btn-danger btn-small folder-action-btn';
        deleteFolderButton.addEventListener('click', (e) => {
          e.stopPropagation();
          if (confirm(`フォルダ「${folder}」を削除しますか？このフォルダ内の画像は「未分類」に移動されます。`)) {
            deleteFolder(folder);
          }
        });
        folderDiv.appendChild(deleteFolderButton);

        
      }
      folderListDiv.appendChild(folderDiv);
    });
  }

  // 新しいフォルダを作成
  createFolderButton.addEventListener('click', () => {
    const newFolderName = newFolderNameInput.value.trim();
    if (newFolderName && !folders.includes(newFolderName)) {
      folders.push(newFolderName);
      saveFolders();
      newFolderNameInput.value = '';
    }
  });

  // フォルダをリネームする関数
  function renameFolder(oldName, newName) {
    chrome.storage.local.get({ 'uploadHistory': [] }, (data) => {
      let history = data.uploadHistory;
      history = history.map(item => {
        if (item.folder === oldName) {
          return { ...item, folder: newName };
        }
        return item;
      });
      chrome.storage.local.set({ 'uploadHistory': history }, () => {
        const index = folders.indexOf(oldName);
        if (index > -1) {
          folders[index] = newName;
          saveFolders();
        }
      });
    });
  }

  // フォルダを削除する関数
  function deleteFolder(folderToDelete) {
    chrome.storage.local.get({ 'uploadHistory': [] }, (data) => {
      let history = data.uploadHistory;
      history = history.map(item => {
        if (item.folder === folderToDelete) {
          return { ...item, folder: '未分類' }; // 削除されたフォルダの画像を「未分類」に移動
        }
        return item;
      });
      chrome.storage.local.set({ 'uploadHistory': history }, () => {
        folders = folders.filter(folder => folder !== folderToDelete);
        saveFolders();
      });
    });
  }
});