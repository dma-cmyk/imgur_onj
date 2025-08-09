document.addEventListener('DOMContentLoaded', function () {
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

  let clientId = '';
  let currentFolder = '未分類';
  let folders = ['未分類'];
  let historyData = [];
  let filteredHistory = []; // Declare filteredHistory here
  let currentModalItemIndex = -1; // To keep track of the currently displayed item in modal

  // Load initial settings
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

  // Event Listeners
  window.onclick = function(event) {
    if (event.target == modal) {
      modal.style.display = "none";
      if (!modalVideo.paused) {
        modalVideo.pause();
      }
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
    if (confirm(`フォルダ「${currentFolder}」の履歴を本当に消去しますか？`)) {
      historyData = historyData.filter(item => item.folder !== currentFolder);
      saveHistory();
      renderHistory();
    }
  });

  function updateThumbnailSize(size) {
    historyList.style.setProperty('--thumbnail-size', `${size}px`);
  }

  function loadHistory() {
    chrome.storage.local.get({ 'uploadHistory': [] }, (data) => {
      historyData = data.uploadHistory.map(item => item.folder === undefined ? { ...item, folder: '未分類' } : item);
      renderHistory();
    });
  }

  function saveHistory() {
      chrome.storage.local.set({ 'uploadHistory': historyData });
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
          if (confirm('この画像を削除してもよろしいですか？')) {
              deleteImage(item.deletehash, item.folder);
          }
      });
      const moveButton = createButton('folder_move', '移動', () => openFolderSelectionModal(item.link, item.folder, folders));

      actions.appendChild(copyButton);
      actions.appendChild(deleteButton);
      actions.appendChild(moveButton);

      li.appendChild(thumbnail);
      li.appendChild(actions);
      historyList.appendChild(li);
    });

    addDragAndDropHandlers();
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

  function deleteImage(deletehash, folder) {
    if (!clientId) {
        console.log('Client ID not set, cannot delete image.');
        return;
    }

    fetch(`https://api.imgur.com/3/image/${deletehash}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Client-ID ${clientId}` }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            historyData = historyData.filter(item => !(item.deletehash === deletehash && item.folder === folder));
            saveHistory();
            renderHistory();
        } else {
            console.error(`Failed to delete: ${data.data.error}`);
        }
    })
    .catch(error => console.error(`Error: ${error.message}`));
  }

  function moveImage(link, oldFolder, newFolder) {
    const itemIndex = historyData.findIndex(item => item.link === link && item.folder === oldFolder);
    if (itemIndex !== -1) {
      historyData[itemIndex].folder = newFolder;
      saveHistory();
      renderHistory();
    }
  }

  // Drag and Drop Handlers
  let draggedItem = null;

  function addDragAndDropHandlers() {
      const items = historyList.querySelectorAll('.history-item');
      items.forEach(item => {
          item.addEventListener('dragstart', handleDragStart);
          item.addEventListener('dragover', handleDragOver);
          item.addEventListener('drop', handleDrop);
          item.addEventListener('dragend', handleDragEnd);
      });
  }

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

  // Modal functions remain the same
  const folderSelectionModal = document.getElementById('folderSelectionModal');
  const closeFolderModalButton = document.getElementsByClassName('close-folder-modal')[0];
  const folderListElement = document.getElementById('folder-list');

  closeFolderModalButton.onclick = function() {
    folderSelectionModal.style.display = "none";
  }

  window.addEventListener('click', function(event) {
    if (event.target == folderSelectionModal) {
      folderSelectionModal.style.display = "none";
    }
  });

  function openFolderSelectionModal(imageLink, currentImageFolder, availableFolders) {
    folderListElement.innerHTML = '';
    availableFolders.forEach(folder => {
      const li = document.createElement('li');
      li.textContent = folder;
      if (folder === currentImageFolder) {
        li.classList.add('current-folder');
      }
      li.addEventListener('click', () => {
        moveImage(imageLink, currentImageFolder, folder);
        folderSelectionModal.style.display = "none";
      });
      folderListElement.appendChild(li);
    });
    folderSelectionModal.style.display = "block";
  }
});