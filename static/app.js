const SHORTCUTS = {
  '---': { action: 'insert', value: '\n---\n' },
  'pic': { action: 'upload_image' },
  'todo': { action: 'insert', value: '- [ ] ' },
  '#': { action: 'linePrefix', value: '# ' },
  '##': { action: 'linePrefix', value: '## ' },
  '###': { action: 'linePrefix', value: '### ' },
  '>': { action: 'linePrefix', value: '> ' },
  '```': { action: 'insert', value: '\n```\ncode\n```\n' },
  'date': { action: 'insert', value: () => new Date().toLocaleDateString() },
  'time': { action: 'insert', value: () => new Date().toLocaleTimeString() },
  'link': { action: 'prompt_link' },
  'table': { action: 'insert', value: '\n| 項目 | 值 |\n|---|---|\n| | |\n' },
  'math': { action: 'insert', value: '$$math$$' },
  'bold': { action: 'wrap', value: '**' },
  'italic': { action: 'wrap', value: '_' },
  'list': { action: 'linePrefix', value: '- ' },
  'strike': { action: 'wrap', value: '~~' },
  'code': { action: 'wrap', value: '`' },
  'mark': { action: 'wrap', value: '==' },
  'ol': { action: 'linePrefix', value: '1. ' },
  'done': { action: 'insert', value: '- [x] ' },
  'now': { action: 'insert', value: () => new Date().toLocaleString() },
  'uuid': { action: 'insert', value: () => crypto.randomUUID() },
  'lorem': { action: 'insert', value: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.' },
  'meeting': {
    action: 'insert',
    value: () => `# 會議記錄\n\n**日期:** ${new Date().toLocaleDateString()}\n**與會者:** \n\n## 議程\n\n- \n\n## 決議事項\n\n- \n\n## 待辦事項\n\n- [ ] \n`
  },
  'jsdoc': {
    action: 'insert',
    value: '\n/**\n * @param {type} name - description\n */\n'
  }
};

// DOM elements - with null checks
const editor = document.getElementById('editor');
const preview = document.getElementById('preview');
const imageInput = document.getElementById('imageInput');
const autosaveStatus = document.getElementById('autosave-status');

// Early exit if not on editor page
if (!editor || !preview) {
  console.log('Not on editor page, skipping editor initialization');
} else {
  console.log('Editor page detected');
  
  // 如果預覽還沒有內容，嘗試初始化
  if (!preview.innerHTML || preview.innerHTML.trim() === '') {
    setTimeout(() => {
      if (window.renderPreview && typeof window.renderPreview === 'function') {
        window.renderPreview();
      }
    }, 100);
  }
}

// Autosave status display
function showAutosaveStatus(message, isError = false) {
  autosaveStatus.textContent = message;
  autosaveStatus.style.color = isError ? '#dc3545' : '#28a745';
  setTimeout(() => { autosaveStatus.textContent = ''; }, 3000);
}

// Fallback simple markdown parser
function simpleMarkdownParse(text) {
  return text
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    .replace(/^\> (.*$)/gim, '<blockquote>$1</blockquote>')
    .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
    .replace(/\*(.*)\*/gim, '<em>$1</em>')
    .replace(/^\- (.*$)/gim, '<li>$1</li>')
    .replace(/^\d+\. (.*$)/gim, '<li>$1</li>')
    .replace(/`([^`]+)`/gim, '<code>$1</code>')
    .replace(/\n/gim, '<br>');
}

// Render markdown preview
function renderPreview() {
  if (!preview || !editor) return;
  
  try {
    const md = editor.value.trim();
    
    if (!md) {
      preview.innerHTML = '<p style="color: #888;">請輸入內容以查看預覽</p>';
      return;
    }
    
    let html;
    
    // Try to use marked.js first
    if (window.marked) {
      try {
        // Configure marked.js with highlight.js
        if (window.marked.setOptions) {
          marked.setOptions({
            highlight: (code, lang) => {
              if (window.hljs && lang && hljs.getLanguage && hljs.getLanguage(lang)) {
                try {
                  return hljs.highlight(code, { language: lang }).value;
                } catch (e) {
                  console.warn(`Highlight.js failed for language ${lang}:`, e);
                  return code;
                }
              }
              return code;
            }
          });
        }
        
        // Parse markdown - handle both old and new API
        if (typeof marked.parse === 'function') {
          html = marked.parse(md);
        } else if (typeof marked === 'function') {
          html = marked(md);
        } else {
          throw new Error('marked API not recognized');
        }
      } catch (err) {
        console.warn('marked.js failed, using fallback parser:', err);
        html = simpleMarkdownParse(md);
      }
    } else {
      // Use fallback parser
      console.log('Using fallback markdown parser');
      html = simpleMarkdownParse(md);
      
      // Try to load marked.js again
      if (!window.markedLoadAttempted) {
        window.markedLoadAttempted = true;
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/marked@9.1.6/marked.min.js';
        script.onload = () => {
          console.log('marked.js loaded successfully');
          renderPreview(); // Re-render with proper parser
        };
        document.head.appendChild(script);
      }
    }
    
    preview.innerHTML = html;
    
    // Render math with KaTeX if available
    if (window.renderMathInElement) {
      renderMathInElement(preview, {
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '\\[', right: '\\]', display: true },
          { left: '$', right: '$', display: false },
          { left: '\\(', right: '\\)', display: false }
        ],
        throwOnError: false
      });
    }
  } catch (err) {
    console.error('Preview rendering error:', err);
    preview.innerHTML = '<p style="color: red;">預覽渲染失敗：' + err.message + '</p>';
  }
}

// Handle shortcut actions
async function handleShortcut(sc, lineStart, pos) {
  const before = editor.value.slice(0, lineStart);
  const after = editor.value.slice(pos);
  if (sc.action === 'insert') {
    const value = typeof sc.value === 'function' ? sc.value() : sc.value;
    editor.value = before + value + after;
    editor.setSelectionRange(before.length + value.length, before.length + value.length);
  } else if (sc.action === 'linePrefix') {
    const rest = editor.value.slice(lineStart);
    editor.value = before + sc.value + rest;
    editor.setSelectionRange(pos + sc.value.length, pos + sc.value.length);
  } else if (sc.action === 'upload_image') {
    imageInput.click();
  } else if (sc.action === 'prompt_link') {
    const url = prompt('請輸入網址：');
    if (url) {
      const md = `[連結](${url})`;
      editor.value = before + md + '\n' + after;
      renderPreview();
    }
  } else if (sc.action === 'wrap') {
    const selection = editor.value.slice(editor.selectionStart, editor.selectionEnd);
    const wrap = sc.value;
    if (selection) {
      const wrapped = `${wrap}${selection}${wrap}`;
      editor.value = editor.value.slice(0, editor.selectionStart) + wrapped + editor.value.slice(editor.selectionEnd);
      editor.setSelectionRange(editor.selectionStart + wrapped.length, editor.selectionStart + wrapped.length);
    } else {
      editor.value = before + wrap + wrap + after;
      editor.setSelectionRange(before.length + wrap.length, before.length + wrap.length);
    }
  }
  renderPreview();
}

// Keydown event listener
editor.addEventListener('keydown', async (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
    e.preventDefault();
    document.getElementById('noteForm').requestSubmit();
    return;
  }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'h') {
    e.preventDefault();
    showShortcutHelp();
    return;
  }
  if (e.key === 'Enter') {
    const pos = editor.selectionStart;
    const textBefore = editor.value.slice(0, pos);
    const lineStart = textBefore.lastIndexOf('\n') + 1;
    const line = textBefore.slice(lineStart).trim();
    if (SHORTCUTS[line]) {
      e.preventDefault();
      await handleShortcut(SHORTCUTS[line], lineStart, pos);
    }
  }
});

// Image upload handling
imageInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const form = new FormData();
  form.append('image', file);
  try {
    const res = await fetch(window.APP_INIT.uploadUrl, { method: 'POST', body: form });
    const j = await res.json();
    if (j.url) {
      const pos = editor.selectionStart;
      const before = editor.value.slice(0, pos);
      const after = editor.value.slice(pos);
      const mdImg = `![](${j.url})`;
      editor.value = before + mdImg + after;
      editor.setSelectionRange(before.length + mdImg.length, before.length + mdImg.length);
      renderPreview();
    } else {
      alert('上傳失敗');
    }
  } catch (err) {
    alert('上傳錯誤：' + err.message);
  }
  imageInput.value = '';
});

// Drag-and-drop image support
editor.addEventListener('dragover', (e) => {
  e.preventDefault();
  editor.classList.add('dragover');
});
editor.addEventListener('dragleave', () => {
  editor.classList.remove('dragover');
});
editor.addEventListener('drop', async (e) => {
  e.preventDefault();
  editor.classList.remove('dragover');
  const file = e.dataTransfer.files[0];
  if (file && file.type.startsWith('image/')) {
    const form = new FormData();
    form.append('image', file);
    try {
      const res = await fetch(window.APP_INIT.uploadUrl, { method: 'POST', body: form });
      const j = await res.json();
      if (j.url) {
        const pos = editor.selectionStart;
        const before = editor.value.slice(0, pos);
        const after = editor.value.slice(pos);
        const mdImg = `![](${j.url})`;
        editor.value = before + mdImg + after;
        editor.setSelectionRange(before.length + mdImg.length, before.length + mdImg.length);
        renderPreview();
      } else {
        alert('圖片上傳失敗');
      }
    } catch (err) {
      alert('上傳錯誤：' + err.message);
    }
  } else {
    alert('請拖放圖片檔案');
  }
});

// Delete button handling
const delBtn = document.getElementById('delBtn');
if (delBtn) {
  delBtn.addEventListener('click', async () => {
    const idField = document.querySelector('input[name="id"]');
    const noteId = idField?.value;
    if (!noteId) {
      if (confirm('是否確認要放棄該筆記？')) {
        window.location.href = '/';
      }
      return;
    }
    if (confirm('確定要刪除此筆記嗎？')) {
      try {
        const res = await fetch(`/note/${noteId}/delete`, { method: 'POST' });
        if (res.ok) {
          alert('筆記已刪除');
          window.location.href = '/';
        } else {
          alert('刪除失敗');
        }
      } catch (err) {
        alert('刪除錯誤：' + err.message);
      }
    }
  });
}

// Download HTML handling
const downloadBtn = document.getElementById('downloadBtn');
if (downloadBtn) {
  downloadBtn.addEventListener('click', (e) => {
    e.preventDefault();
    downloadAsHTML();
  });
}

// Autosave handling - only if editor exists
if (editor) {
  let lastContent = editor.value;
  setInterval(async () => {
    if (editor.value !== lastContent) {
      lastContent = editor.value;
      try {
        const form = document.getElementById('noteForm');
        const formData = new FormData(form);
        const res = await fetch(form.action, { method: 'POST', body: formData });
        if (res.ok) {
          showAutosaveStatus('自動儲存成功');
        } else {
          showAutosaveStatus('自動儲存失敗', true);
        }
      } catch (err) {
        showAutosaveStatus('自動儲存錯誤', true);
      }
    }
  }, 30000);
}

// Note: Preview initialization is now handled in edit.html directly

// Download as HTML with embedded dependencies
function downloadAsHTML() {
  const title = document.querySelector('input[name="title"]').value || '未命名筆記';
  const content = editor.value;
  const renderedHTML = marked.parse(content);
  const fullHTML = `
<!DOCTYPE html>
<html lang="zh-Hant">
<head>
<meta charset="UTF-8">
<title>${title}</title>
<style>
body { font-family: 'Microsoft JhengHei', sans-serif; margin: 40px; background: #fafafa; }
pre code { background: #f4f4f4; padding: 8px; border-radius: 5px; display: block; }
hr { border: none; border-top: 1px solid #ccc; margin: 20px 0; }
img { max-width: 100%; border-radius: 5px; }
blockquote { color: #555; border-left: 4px solid #ccc; margin-left: 0; padding-left: 10px; }
.katex { font-size: 1.1em; }
pre, code { background-color: #f5f5f5; border-radius: 4px; padding: 2px 4px; }
pre { padding: 10px; overflow-x: auto; }
</style>
</head>
<body>
<h1>${title}</h1>
${renderedHTML}
<script><!-- Embed marked.js, katex.js, and highlight.js code here in production --></script>
<script>
document.addEventListener('DOMContentLoaded', () => {
  if (window.renderMathInElement) {
    renderMathInElement(document.body, {
      delimiters: [
        { left: '$$', right: '$$', display: true },
        { left: '$', right: '$', display: false }
      ]
    });
  }
});
</script>
</body>
</html>`;
  const blob = new Blob([fullHTML], { type: 'text/html' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${title}.html`;
  a.click();
  URL.revokeObjectURL(a.href);
}

// Shortcut help modal
function showShortcutHelp() {
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-content">
      <h2>快捷鍵列表</h2>
      <table>
        <thead><tr><th>快捷鍵</th><th>功能</th></tr></thead>
        <tbody>
          ${Object.entries(SHORTCUTS).map(([key, sc]) => `
            <tr>
              <td><code>${key}</code></td>
              <td>${{
                '---': '插入分隔線',
                'pic': '上傳圖片',
                'todo': '插入待辦事項',
                '#': '插入一級標題',
                '##': '插入二級標題',
                '###': '插入三級標題',
                '>': '插入引言',
                '```': '插入程式碼區塊',
                'date': '插入當前日期',
                'time': '插入當前時間',
                'link': '插入超連結',
                'table': '插入表格',
                'math': '插入數學公式',
                'bold': '加粗文字',
                'italic': '斜體文字',
                'list': '插入無序清單',
                'strike': '刪除線文字',
                'code': '行內程式碼',
                'mark': '高亮文字',
                'ol': '插入有序清單',
                'done': '插入已完成待辦',
                'now': '插入當前日期與時間',
                'uuid': '插入唯一識別碼',
                'lorem': '插入Lorem Ipsum文本',
                'meeting': '插入會議記錄範本',
                'jsdoc': '插入JSDoc註解'
              }[key]}</td>
            </tr>
          `).join('')}
          <tr><td><code>Ctrl+S</code></td><td>儲存筆記</td></tr>
          <tr><td><code>Ctrl+H</code></td><td>顯示此幫助</td></tr>
        </tbody>
      </table>
      <button class="btn modal-close">關閉</button>
    </div>
  `;
  document.body.appendChild(modal);
  modal.querySelector('.modal-close').addEventListener('click', () => modal.remove());
}

// Preview toggle
const previewToggle = document.createElement('button');
previewToggle.className = 'btn';
previewToggle.textContent = '隱藏預覽';
previewToggle.style.marginLeft = '10px';
document.querySelector('.form-actions').appendChild(previewToggle);
previewToggle.addEventListener('click', (event) => {
  event.preventDefault();
  const previewSection = document.querySelector('.preview-section');
  previewSection.style.display = previewSection.style.display === 'none' ? 'block' : 'none';
  previewToggle.textContent = previewSection.style.display === 'none' ? '顯示預覽' : '隱藏預覽';
});

// Dark mode toggle
const darkModeToggle = document.createElement('button');
darkModeToggle.className = 'btn';
darkModeToggle.textContent = '切換深色模式';
darkModeToggle.style.marginLeft = '10px';
document.querySelector('.form-actions').appendChild(darkModeToggle);
darkModeToggle.addEventListener('click', (event) => {
  event.preventDefault();
  document.body.classList.toggle('dark-mode');
  localStorage.setItem('darkMode', document.body.classList.contains('dark-mode') ? 'true' : 'false');
});
if (localStorage.getItem('darkMode') === 'true') {
  document.body.classList.add('dark-mode');
}

// Export markdown
const exportBtn = document.createElement('button');
exportBtn.className = 'btn';
exportBtn.textContent = '匯出筆記';
exportBtn.style.marginLeft = '10px';
document.querySelector('.form-actions').appendChild(exportBtn);
exportBtn.addEventListener('click', () => {
  const title = document.querySelector('input[name="title"]').value || '無標題';
  const content = editor.value;
  const blob = new Blob([content], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${title}.md`;
  a.click();
  URL.revokeObjectURL(url);
});

// Import markdown
const importInput = document.createElement('input');
importInput.type = 'file';
importInput.accept = '.md,.txt';
importInput.style.display = 'none';
document.body.appendChild(importInput);
const importBtn = document.createElement('button');
importBtn.className = 'btn';
importBtn.textContent = '匯入筆記';
importBtn.style.marginLeft = '10px';
document.querySelector('.form-actions').appendChild(importBtn);
importBtn.addEventListener('click', () => importInput.click());
importInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = (event) => {
      editor.value = event.target.result;
      renderPreview();
      importInput.value = '';
    };
    reader.readAsText(file);
  }
});