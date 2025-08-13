document.addEventListener('DOMContentLoaded', function () {
  // --- Variable Declarations ---
  const historyList = document.getElementById('history-list');
  const historyPlaceholder = document.getElementById('history-placeholder');
  const clearHistoryButton = document.getElementById('clear-history-button');
  const folderSelect = document.getElementById('folder-select');
  const sizeSlider = document.getElementById('size-slider');

  const modal = document.getElementById('myModal');
  const modalImage = document.getElementById('modalImage');
  const modalVideo = document.getElementById('modalVideo');
  const prevButton = document.getElementById('prevButton');
  const nextButton = document.getElementById('nextButton');

  const selectAllCheckbox = document.getElementById('select-all-checkbox');
  const deleteSelectedButton = document.getElementById('delete-selected-button');
  const moveSelectedButton = document.getElementById('move-selected-button');

  const messageModal = document.getElementById('messageModal');
  const messageModalTitle = document.getElementById('messageModalTitle');
  const messageModalBody = document.getElementById('messageModalBody');
  const messageModalConfirm = document.getElementById('messageModalConfirm');
  const messageModalCancel = document.getElementById('messageModalCancel');
  const messageModalClose = document.getElementById('messageModalClose');

  const folderSelectionModal = document.getElementById('folderSelectionModal');
  const closeFolderModalButton = document.getElementsByClassName('close-folder-modal')[0];
  const folderListElement = document.getElementById('folder-list');

  let clientId = '';
  let currentFolder = '未分類';
  let folders = ['未分類'];
  let historyData = [];
  let filteredHistory = [];
  let currentModalItemIndex = -1;
  let selectedItems = new Set();

  console.log('Initial folders:', folders); // Debugging line

  // --- Function Definitions ---

  function showConfirmModal(message, onConfirm, onCancel = null) {
    messageModalTitle.textContent = '確認';
    messageModalBody.textContent = message;
    messageModalConfirm.style.display = 'inline-block';
    messageModalCancel.style.display = 'inline-block';
    messageModalClose.style.display = 'none';

    messageModalConfirm.onclick = () => {
      messageModal.style.display = 'none';
      if (onConfirm) onConfirm();
    };
    messageModalCancel.onclick = () => {
      messageModal.style.display = 'none';
      if (onCancel) onCancel();
    };
    messageModal.style.display = 'block';
  }

  function showMessageModal(title, message, onClose = null) {
    messageModalTitle.textContent = title;
    messageModalBody.textContent = message;
    messageModalConfirm.style.display = 'none';
    messageModalCancel.style.display = 'none';
    messageModalClose.style.display = 'inline-block';

    messageModalClose.onclick = () => {
      messageModal.style.display = 'none';
      if (onClose) onClose();
    };
    messageModal.style.display = 'block';
  }

  function updateThumbnailSize(size) {
    historyList.style.setProperty('--thumbnail-size', `${size}px`);
  }

  function displayModalItem(index) {
    if (index < 0 || index >= filteredHistory.length) {
      return; // Out of bounds
    }

    const item = filteredHistory[index];
    currentModalItemIndex = index; // Update the global index

    // Update modal content
    if (item.link.endsWith('.mp4') || item.link.endsWith('.webm') || item.link.endsWith('.gifv')) {
      modalImage.style.display = 'none';
      modalVideo.style.display = 'block';
      modalVideo.src = item.link;
      modalVideo.load();
      modalVideo.play();
    } else {
      modalImage.style.display = 'block';
      modalVideo.style.display = 'none';
      modalImage.src = item.link;
      if (!modalVideo.paused) {
        modalVideo.pause();
      }
    }

    // Update button visibility
    prevButton.style.display = (currentModalItemIndex > 0) ? 'block' : 'none';
    nextButton.style.display = (currentModalItemIndex < filteredHistory.length - 1) ? 'block' : 'none';
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

  function createButton(icon, title, onClick) {
      const button = document.createElement('button');
      button.innerHTML = `<i class="material-icons">${icon}</i>`;
      button.className = 'btn btn-secondary btn-small';
      button.title = title;
      button.addEventListener('click', (e) => {
          e.stopPropagation();
          onClick();
      });
      return button;
  }

  function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = 'show';
    setTimeout(function(){ toast.className = toast.className.replace('show', ''); }, 3000);
  }

  function updateSelectAllCheckboxState() {
    const checkboxes = document.querySelectorAll('.history-item-checkbox');
    const allChecked = Array.from(checkboxes).every(cb => cb.checked);
    const anyChecked = Array.from(checkboxes).some(cb => cb.checked);

    if (checkboxes.length === 0) {
      selectAllCheckbox.checked = false;
      selectAllCheckbox.indeterminate = false;
    } else if (allChecked) {
      selectAllCheckbox.checked = true;
      selectAllCheckbox.indeterminate = false;
    } else if (anyChecked) {
      selectAllCheckbox.checked = false;
      selectAllCheckbox.indeterminate = true;
    } else {
      selectAllCheckbox.checked = false;
      selectAllCheckbox.indeterminate = false;
    }
  }

  function updateDeleteSelectedButtonState() {
    deleteSelectedButton.disabled = selectedItems.size === 0;
  }

  function saveHistory() {
      chrome.storage.local.set({ 'uploadHistory': historyData });
  }

  async function deleteImage(deletehash, folder, noConfirm = false) {
    if (!clientId) {
        console.log('Client ID not set, cannot delete image.');
        return false;
    }

    if (!noConfirm) {
      const confirmed = await new Promise(resolve => {
        showConfirmModal('この画像を削除してもよろしいですか？', () => resolve(true), () => resolve(false));
      });
      if (!confirmed) {
        return false;
      }
    }

    try {
      const response = await fetch(`https://api.imgur.com/3/image/${deletehash}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Client-ID ${clientId}` }
      });
      const data = await response.json();

      if (data.success) {
          historyData = historyData.filter(item => !(item.deletehash === deletehash && item.folder === folder));
          // saveHistory() and renderHistory() will be called after all deletions in bulk delete
          if (!noConfirm) {
            saveHistory();
            renderHistory();
          }
          return true;
      } else {
          console.error(`Failed to delete: ${data.data.error}`);
          return false;
      }
    } catch (error) {
      console.error(`Error: ${error.message}`);
      return false;
    }
  }

  function moveImage(link, oldFolder, newFolder) {
    const itemIndex = historyData.findIndex(item => item.link === link && item.folder === oldFolder);
    if (itemIndex !== -1) {
      historyData[itemIndex].folder = newFolder;
      saveHistory();
      renderHistory();
    }
  }

  let draggedItem = null; // Drag and Drop Handlers

  function handleDragStart(e) {
      draggedItem = this;
      setTimeout(() => {
          this.classList.add('dragging');
      }, 0);
  }

  function handleDragOver(e) {
      e.preventDefault();
  }

  function handleDrop(e) {
      e.preventDefault();
      if (this !== draggedItem) {
          const draggedIndex = Array.from(historyList.children).indexOf(draggedItem);
          const targetIndex = Array.from(historyList.children).indexOf(this);

          const draggedLink = draggedItem.dataset.link;
          const targetLink = this.dataset.link;

          const historyInFolder = historyData.filter(item => item.folder === currentFolder);
          const otherHistory = historyData.filter(item => item.folder !== currentFolder);

          const draggedHistoryItem = historyInFolder.find(item => item.link === draggedLink);
          const reorderedHistory = historyInFolder.filter(item => item.link !== draggedLink);

          const targetHistoryIndex = reorderedHistory.findIndex(item => item.link === targetLink);

          if (draggedIndex > targetIndex) {
              reorderedHistory.splice(targetHistoryIndex, 0, draggedHistoryItem);
          } else {
              reorderedHistory.splice(targetHistoryIndex + 1, 0, draggedHistoryItem);
          }

          historyData = [...otherHistory, ...reorderedHistory];
          saveHistory();
          renderHistory();
      }
  }

  function handleDragEnd() {
      this.classList.remove('dragging');
      draggedItem = null;
  }

  function addDragAndDropHandlers() {
      const items = historyList.querySelectorAll('.history-item');
      items.forEach(item => {
          item.addEventListener('dragstart', handleDragStart);
          item.addEventListener('dragover', handleDragOver);
          item.addEventListener('drop', handleDrop);
          item.addEventListener('dragend', handleDragEnd);
      });
  }

  function openFolderSelectionModal(imageLink, currentImageFolder, availableFolders, onFolderSelectedCallback = null) {
    folderListElement.innerHTML = '';
    availableFolders.forEach(folder => {
      const li = document.createElement('li');
      li.textContent = folder;
      if (folder === currentImageFolder) {
        li.classList.add('current-folder');
      }
      li.addEventListener('click', () => {
        if (onFolderSelectedCallback) {
          onFolderSelectedCallback(folder);
        } else {
          moveImage(imageLink, currentImageFolder, folder);
        }
        folderSelectionModal.style.display = "none";
      });
      folderListElement.appendChild(li);
    });
    folderSelectionModal.style.display = "block";
  }

  function renderHistory() {
    historyList.innerHTML = '';
    filteredHistory = historyData.filter(item => item.folder === currentFolder);

    if (filteredHistory.length === 0) {
      historyPlaceholder.style.display = 'block';
      historyList.style.display = 'none';
    } else {
      historyPlaceholder.style.display = 'none';
      historyList.style.display = 'grid';
    }

    filteredHistory.forEach((item, index) => {
      const li = document.createElement('li');
      li.className = 'history-item';
      li.draggable = true;
      li.dataset.link = item.link;

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'history-item-checkbox';
      checkbox.dataset.deletehash = item.deletehash;
      checkbox.dataset.folder = item.folder;
      checkbox.checked = selectedItems.has(JSON.stringify({ deletehash: item.deletehash, folder: item.folder }));
      checkbox.addEventListener('change', (event) => {
        const deletehash = event.target.dataset.deletehash;
        const folder = event.target.dataset.folder;
        if (event.target.checked) {
          selectedItems.add(JSON.stringify({ deletehash, folder }));
        } else {
          selectedItems.delete(JSON.stringify({ deletehash, folder }));
        }
        updateSelectAllCheckboxState();
        updateDeleteSelectedButtonState();
      });

      const thumbnailUrl = item.link.replace(/(\.[^.]+)$/, 'l$1');
      const thumbnail = document.createElement('img');
      thumbnail.src = thumbnailUrl;
      thumbnail.className = 'thumbnail';

      thumbnail.addEventListener('click', () => {
        modal.style.display = "block";
        displayModalItem(index);
      });

      const actions = document.createElement('div');
      actions.className = 'history-item-actions';

      const copyButton = createButton('content_copy', 'コピー', () => {
        navigator.clipboard.writeText(item.link).then(() => {
          showToast('コピーしました！');
        });
      });
      const deleteButton = createButton('delete', '削除', () => {
          deleteImage(item.deletehash, item.folder);
      });
      const moveButton = createButton('folder_move', '移動', () => openFolderSelectionModal(item.link, item.folder, folders));

      actions.appendChild(copyButton);
      actions.appendChild(deleteButton);
      actions.appendChild(moveButton);

      li.appendChild(checkbox);
      li.appendChild(thumbnail);
      li.appendChild(actions);
      historyList.appendChild(li);
    });

    addDragAndDropHandlers();
  }

  function loadHistory() {
    chrome.storage.local.get({ 'uploadHistory': [] }, (data) => {
      historyData = data.uploadHistory.map(item => item.folder === undefined ? { ...item, folder: '未分類' } : item);
      renderHistory();
    });
  }

  // Override renderHistory to update checkbox states
  const originalRenderHistory = renderHistory;
  renderHistory = () => {
    originalRenderHistory();
    updateSelectAllCheckboxState();
    updateDeleteSelectedButtonState();
  };

  // --- Event Listeners ---

  closeFolderModalButton.addEventListener('click', () => {
    folderSelectionModal.style.display = "none";
  });

  window.onclick = function(event) {
    if (event.target == modal) {
      modal.style.display = "none";
      if (!modalVideo.paused) {
        modalVideo.pause();
      }
    }
    if (event.target == folderSelectionModal) {
      folderSelectionModal.style.display = "none";
    }
  }

  document.addEventListener('keydown', (event) => {
    if (modal.style.display === 'block') { // Only navigate if modal is open
      if (event.key === 'ArrowLeft') {
        currentModalItemIndex--;
        displayModalItem(currentModalItemIndex);
      } else if (event.key === 'ArrowRight') {
        currentModalItemIndex++;
        displayModalItem(currentModalItemIndex);
      }
    }
  });

  prevButton.addEventListener('click', () => {
    currentModalItemIndex--;
    displayModalItem(currentModalItemIndex);
  });

  nextButton.addEventListener('click', () => {
    currentModalItemIndex++;
    displayModalItem(currentModalItemIndex);
  });

  folderSelect.addEventListener('change', () => {
    currentFolder = folderSelect.value;
    chrome.storage.local.set({ 'currentFolder': currentFolder });
    selectedItems.clear(); // ★追加: フォルダ切り替え時に選択をクリア
    renderHistory();
  });

  sizeSlider.addEventListener('input', () => {
    const newSize = sizeSlider.value;
    updateThumbnailSize(newSize);
  });

  sizeSlider.addEventListener('change', () => {
    const newSize = sizeSlider.value;
    chrome.storage.local.set({ 'thumbnailSize': newSize });
  });

  clearHistoryButton.addEventListener('click', () => {
    showConfirmModal(`フォルダ「${currentFolder}」の履歴を本当に消去しますか？`, () => {
      historyData = historyData.filter(item => item.folder !== currentFolder);
      saveHistory();
      renderHistory();
    });
  });

  selectAllCheckbox.addEventListener('change', (event) => {
    const isChecked = event.target.checked;
    const checkboxes = document.querySelectorAll('.history-item-checkbox');
    selectedItems.clear();
    checkboxes.forEach(checkbox => {
      checkbox.checked = isChecked;
      const deletehash = checkbox.dataset.deletehash;
      const folder = checkbox.dataset.folder;
      if (isChecked) {
        selectedItems.add(JSON.stringify({ deletehash, folder }));
      }
    });
    updateDeleteSelectedButtonState();
  });

  deleteSelectedButton.addEventListener('click', () => {
    if (selectedItems.size === 0) {
      showToast('削除する項目が選択されていません。');
      return;
    }

    const itemsToDeleteInCurrentFolder = Array.from(selectedItems)
      .map(item => JSON.parse(item))
      .filter(item => item.folder === currentFolder);

    if (itemsToDeleteInCurrentFolder.length === 0) {
      showToast('現在のフォルダで削除する項目が選択されていません。');
      return;
    }

    showConfirmModal(`選択された ${itemsToDeleteInCurrentFolder.length} 件の項目を本当に削除しますか？`, async () => {
      let successfulDeletions = 0;

      for (const item of itemsToDeleteInCurrentFolder) {
        const success = await deleteImage(item.deletehash, item.folder, true);
        if (success) {
          successfulDeletions++;
        }
      }

      selectedItems.clear();

      saveHistory();
      renderHistory();
      showToast(`${successfulDeletions} 件の項目を削除しました。`);
    });
  });

  moveSelectedButton.addEventListener('click', () => {
    if (selectedItems.size === 0) {
      showToast('移動する項目が選択されていません。');
      return;
    }

    // フォルダ選択モーダルを表示し、選択されたフォルダを処理する
    openFolderSelectionModalForBulkMove();
  });

  function openFolderSelectionModalForBulkMove() {
    folderListElement.innerHTML = '';
    folders.forEach(folder => {
      const li = document.createElement('li');
      li.textContent = folder;
      li.addEventListener('click', () => {
        // 選択されたフォルダに移動する処理
        moveSelectedItemsToFolder(folder);
        folderSelectionModal.style.display = "none";
      });
      folderListElement.appendChild(li);
    });
    folderSelectionModal.style.display = "block";
  }

  function moveSelectedItemsToFolder(newFolder) {
    let movedCount = 0;
    selectedItems.forEach(itemJson => {
      const item = JSON.parse(itemJson);
      const index = historyData.findIndex(h => h.deletehash === item.deletehash && h.folder === item.folder);
      if (index !== -1) {
        historyData[index].folder = newFolder;
        movedCount++;
      }
    });
    selectedItems.clear(); // 選択をクリア
    saveHistory();
    renderHistory();
    showToast(`${movedCount} 件の項目を「${newFolder}」に移動しました。`);
  }

  // --- Initial Settings Load ---
  chrome.storage.sync.get('imgurClientId', (syncData) => {
    if (syncData.imgurClientId) {
      clientId = syncData.imgurClientId;
    }
  });

  chrome.storage.local.get({
    'imgurFolders': ['未分類'],
    'currentFolder': '未分類',
    'thumbnailSize': 250
  }, (localData) => {
    folders = localData.imgurFolders;
    currentFolder = localData.currentFolder;
    sizeSlider.value = localData.thumbnailSize;
    updateThumbnailSize(localData.thumbnailSize);

    if (!folders.includes(currentFolder)) {
      currentFolder = '未分類';
    }

    renderFolderSelect();
    loadHistory();
  });

  // Listen for messages from background script to refresh history
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'refreshHistory') {
      loadHistory();
    }
  });

  // Listen for changes in storage to update folders in real-time
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.imgurFolders) {
      folders = changes.imgurFolders.newValue;
      renderFolderSelect();
      loadHistory(); // Reload history to update folder lists for move actions
    }
  });
});