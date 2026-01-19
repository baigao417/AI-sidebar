// js/prompt-manager.js

(function() {
  const panel = document.getElementById('promptManagerPanel');
  const closeBtn = panel.querySelector('.prompt-close-btn');
  const listEl = document.getElementById('promptList');
  const searchInput = document.getElementById('promptSearchInput');
  const modeBtn = document.getElementById('promptModeBtn');
  const modeLabel = document.getElementById('currentModeLabel');
  const modeDropdown = document.getElementById('promptModeDropdown');
  const newModeInput = document.getElementById('newModeInput');
  const addModeBtn = document.getElementById('addModeBtn');
  const modeList = document.getElementById('modeList');
  const fab = document.getElementById('addPromptFab');
  
  // Modal
  const modal = document.getElementById('editPromptModal');
  // const editTitle = document.getElementById('editPromptTitle'); // Removed
  const editContent = document.getElementById('editPromptContent');
  const saveBtn = document.getElementById('saveEditPrompt');
  const cancelBtn = document.getElementById('cancelEditPrompt');
  
  let currentMode = 'All'; // 'All' or specific category
  let searchQuery = '';
  let allPrompts = [];
  let editingId = null; // null = new
  
  // Initialize global API
  window.PromptManager = {
    open: async (initialMode = null) => {
      // Safety check: if already open, don't call enterOverlay again (prevents depth mismatch)
      const alreadyOpen = panel.classList.contains('active');
      
      // 1. Notify Electron to enter overlay mode (detach BrowserView)
      // Only call if not already open to prevent overlayDepth mismatch
      if (!alreadyOpen) {
        try {
          if (window.electronAPI && window.electronAPI.enterOverlay) {
            console.log('[PromptManager] Calling enterOverlay()');
            window.electronAPI.enterOverlay();
          } else {
            console.warn('[PromptManager] electronAPI.enterOverlay not available');
          }
        } catch (e) { console.error('[PromptManager] enterOverlay error:', e); }
      } else {
        console.log('[PromptManager] Already open, skipping enterOverlay()');
      }

      await loadPrompts();
      if (initialMode && typeof initialMode === 'string') {
        currentMode = initialMode;
      }
      renderModes();
      updateModeUI();
      renderList();
      // Use 'active' class for slide-in animation (like history panel)
      panel.classList.add('active');
      searchInput.focus();
    },
    close: () => {
      // Safety check: if already hidden, don't double-call exitOverlay
      if (!panel.classList.contains('active')) return;
      
      // Use 'active' class for slide-out animation
      panel.classList.remove('active');
      
      // 2. Notify Electron to exit overlay mode (attach BrowserView)
      // Check if any other overlay panels are still open
      const settingsOpen = document.getElementById('settingsModal')?.classList.contains('active');
      const favoritesOpen = document.getElementById('favoritesPanel')?.classList.contains('active');
      const anyOtherPanelOpen = settingsOpen || favoritesOpen;
      
      try {
        if (window.electronAPI) {
          if (!anyOtherPanelOpen && window.electronAPI.resetOverlay) {
            // No other panels open - use reset to ensure clean state
            console.log('[PromptManager] Calling resetOverlay() (no other panels open)');
            window.electronAPI.resetOverlay();
          } else if (window.electronAPI.exitOverlay) {
            // Other panels still open - use normal exit
            console.log('[PromptManager] Calling exitOverlay()');
            window.electronAPI.exitOverlay();
          }
        } else {
          console.warn('[PromptManager] electronAPI not available');
        }
      } catch (e) { console.error('[PromptManager] exitOverlay error:', e); }
    },
    toggle: () => {
      if (!panel.classList.contains('active')) window.PromptManager.open();
      else window.PromptManager.close();
    }
  };

  // Event Listeners
  if (closeBtn) closeBtn.addEventListener('click', window.PromptManager.close);
  
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value.toLowerCase();
      renderList();
    });
  }
  
  // Mode Dropdown
  if (modeBtn) {
    modeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      modeDropdown.style.display = modeDropdown.style.display === 'none' ? 'block' : 'none';
      renderModes();
    });
  }
  
  document.addEventListener('click', (e) => {
    if (modeDropdown && !modeDropdown.contains(e.target) && e.target !== modeBtn) {
      modeDropdown.style.display = 'none';
    }
  });

  if (addModeBtn) {
    addModeBtn.addEventListener('click', async () => {
      const name = newModeInput.value.trim();
      if (!name) return;
      if (name.length > 10) return alert('Max 10 chars');
      currentMode = name;
      updateModeUI();
      newModeInput.value = '';
      modeDropdown.style.display = 'none';
      renderList(); // likely empty if new
    });
  }

  // FAB - Add Prompt
  if (fab) {
    fab.addEventListener('click', () => {
      openEditModal();
    });
  }

  // Click outside modal backdrop closes it
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.style.display = 'none';
      }
    });
  }
  
  if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
      // Parse batch format from single textarea
      const raw = editContent.value.trim().replace(/\r\n/g, '\n');
      if (!raw) return alert('Content required');
      
      const blocks = raw.split(/\n\s*\n/);
      const parsedPrompts = blocks.map(block => {
        const lines = block.trim().split('\n');
        if (lines.length === 0) return null;
        
        let title = 'Untitled';
        let content = '';
        
        if (lines.length === 1) {
          content = lines[0].trim();
        } else {
          title = lines[0].trim();
          content = lines.slice(1).join('\n').trim();
        }
        
        if (!content) return null;
        
        return {
          title,
          content,
          category: (currentMode === 'All') ? 'General' : currentMode
        };
      }).filter(Boolean);
      
      if (parsedPrompts.length === 0) return;
      
      if (editingId && parsedPrompts.length > 0) {
        // Update the original item with the first block
        const first = parsedPrompts.shift();
        await window.PromptDB.update({ ...first, id: editingId });
        
        // Add remaining as new items if any
        if (parsedPrompts.length > 0) {
           await window.PromptDB.bulkAdd(parsedPrompts);
        }
      } else {
        // New batch addition
        await window.PromptDB.bulkAdd(parsedPrompts);
      }
      
      modal.style.display = 'none';
      await loadPrompts();
      renderList();
    });
  }
  
  // Import/Export
  const expBtn = document.getElementById('promptExportBtn');
  if (expBtn) expBtn.addEventListener('click', async () => {
    await exportPrompts();
  });
  
  const impBtn = document.getElementById('promptImportBtn');
  if (impBtn) impBtn.addEventListener('click', async () => {
    await importPromptsFromClipboard();
  });

  // Functions
  async function loadPrompts() {
    if (window.PromptDB) {
      allPrompts = await window.PromptDB.getAll();
    }
  }

  function updateModeUI() {
    if (modeLabel) modeLabel.textContent = currentMode;
  }
  
  async function renderModes() {
    if (!window.PromptDB) return;
    const modes = await window.PromptDB.getModes(); // returns array of strings
    // Add "All"
    if (!modes.includes('All')) modes.unshift('All');
    
    if (modeList) {
      modeList.innerHTML = '';
      modes.forEach(m => {
        const li = document.createElement('li');
        li.className = (m === currentMode) ? 'active' : '';
        
        const leftDiv = document.createElement('div');
        leftDiv.textContent = m;
        leftDiv.style.flex = '1';
        leftDiv.onclick = () => {
          currentMode = m;
          updateModeUI();
          modeDropdown.style.display = 'none';
          renderList();
        };
        
        li.appendChild(leftDiv);
        
        if (m !== 'All') {
          const count = allPrompts.filter(p => p.category === m).length;
          
          const rightDiv = document.createElement('div');
          rightDiv.style.display = 'flex';
          rightDiv.style.alignItems = 'center';
          
          const countBadge = document.createElement('span');
          countBadge.className = 'mode-count';
          countBadge.textContent = count;
          rightDiv.appendChild(countBadge);
          
          const delBtn = document.createElement('span');
          delBtn.className = 'mode-del-btn';
          delBtn.innerHTML = '×';
          delBtn.title = 'Delete Mode & All Prompts';
          delBtn.onclick = async (e) => {
            e.stopPropagation();
            if (confirm(`Delete mode "${m}" and all ${count} prompts in it?`)) {
              const toDelete = allPrompts.filter(p => p.category === m);
              for (const p of toDelete) {
                await window.PromptDB.remove(p.id);
              }
              if (currentMode === m) {
                currentMode = 'All';
                updateModeUI();
              }
              await loadPrompts();
              renderModes();
              renderList();
            }
          };
          rightDiv.appendChild(delBtn);
          li.appendChild(rightDiv);
        }
        
        modeList.appendChild(li);
      });
    }
  }

  function renderList() {
    if (!listEl) return;
    listEl.innerHTML = '';
    
    let filtered = allPrompts;
    if (currentMode !== 'All') {
      filtered = filtered.filter(p => p.category === currentMode);
    }
    
    if (searchQuery) {
      filtered = filtered.filter(p => 
        (p.title && p.title.toLowerCase().includes(searchQuery)) || 
        (p.content && p.content.toLowerCase().includes(searchQuery))
      );
    }
    
    // Sort by recent (updatedAt desc)
    filtered.sort((a,b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    
    if (filtered.length === 0) {
      listEl.innerHTML = '<div style="color:#999;text-align:center;margin-top:20px;font-size:13px;">No prompts found</div>';
      return;
    }
    
    filtered.forEach(p => {
      const div = document.createElement('div');
      div.className = 'prompt-item';
      div.innerHTML = `
        <div class="prompt-item-title">${escapeHtml(p.title || 'Untitled')}</div>
        <div class="prompt-item-preview">${escapeHtml(p.content)}</div>
        <div class="prompt-item-actions">
          <button class="prompt-action-btn edit-btn">Edit</button>
          <button class="prompt-action-btn delete delete-btn">Del</button>
        </div>
      `;
      
      // Insert on click
      div.addEventListener('click', (e) => {
        if (e.target.closest('.prompt-action-btn')) return;
        insertPrompt(p.content);
      });
      
      const editB = div.querySelector('.edit-btn');
      if (editB) editB.addEventListener('click', (e) => {
        e.stopPropagation();
        openEditModal(p);
      });
      
      const delB = div.querySelector('.delete-btn');
      if (delB) delB.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (confirm('Delete prompt?')) {
          await window.PromptDB.remove(p.id);
          await loadPrompts();
          renderList();
        }
      });
      
      listEl.appendChild(div);
    });
  }
  
  function openEditModal(prompt = null) {
    if (prompt) {
      editingId = prompt.id;
      // Combine title and content for editing
      const title = prompt.title || 'Untitled';
      const content = prompt.content || '';
      editContent.value = `${title}\n${content}`;
    } else {
      editingId = null;
      editContent.value = '';
    }
    modal.style.display = 'flex';
    editContent.focus();
  }
  
  function insertPrompt(text) {
    if (window.electronAPI && window.electronAPI.insertText) {
      window.electronAPI.insertText(text);
      // Auto-close panel after inserting prompt
      window.PromptManager.close();
    } else {
        console.log('Mock insert:', text);
    }
  }

  function escapeHtml(text) {
    if (!text) return '';
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  async function exportPrompts() {
    let toExport = allPrompts;
    if (currentMode !== 'All') {
      toExport = toExport.filter(p => p.category === currentMode);
    }
    
    // Sort by recent
    toExport.sort((a,b) => (b.updatedAt || 0) - (a.updatedAt || 0));

    const parts = toExport.map(p => {
      const title = (p.title || 'Untitled').replace(/[\r\n]+/g, ' ').trim();
      const content = (p.content || '').trim();
      return `${title}\n${content}`;
    });
    
    const text = parts.join('\n\n');
    
    try {
      if (window.electronAPI?.savePromptsTxt) {
        // Pass string directly; preload wraps it in { content }
        const res = await window.electronAPI.savePromptsTxt(text);
        if (!res || res.canceled || res.ok === false) return;
        alert(`Exported ${toExport.length} prompts to TXT.`);
      } else {
        await navigator.clipboard.writeText(text);
        alert(`Exported ${toExport.length} prompts to clipboard!`);
      }
    } catch (err) {
      console.error('Export failed:', err);
      alert('Failed to export prompts');
    }
  }

  async function importPromptsFromClipboard() {
    try {
      let text = '';
      if (window.electronAPI?.openPromptsTxt) {
        const res = await window.electronAPI.openPromptsTxt();
        if (!res || res.canceled || res.ok === false) return;
        text = String(res.content || '');
      } else {
        text = await navigator.clipboard.readText();
      }
      
      if (!text.trim()) return alert('TXT is empty');
      
      // Normalize CRLF to LF
      const raw = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      
      // Split by one or more blank lines (2+ newlines)
      const blocks = raw.split(/\n\s*\n+/);
      
      const newPrompts = [];
      const timestamp = Date.now();
      
      blocks.forEach(block => {
        const cleanBlock = block.trim();
        if (!cleanBlock) return;
        
        const lines = cleanBlock.split('\n');
        if (lines.length < 1) return;
        
        const title = lines[0].trim();
        // Content is the rest
        const content = lines.slice(1).join('\n').trim();
        
        if (title && content) {
          newPrompts.push({
            title,
            content,
            category: (currentMode === 'All') ? 'General' : currentMode,
            createdAt: timestamp,
            updatedAt: timestamp
          });
        }
      });
      
      if (newPrompts.length === 0) return alert('No valid prompts found.\nFormat:\nTitle\nContent\n\nTitle\nContent');
      
      await window.PromptDB.bulkAdd(newPrompts);
      await loadPrompts();
      renderList();
      alert(`Imported ${newPrompts.length} prompts!`);
      
    } catch (err) {
      console.error('Import failed:', err);
      alert('Failed to import prompts');
    }
  }

})();
