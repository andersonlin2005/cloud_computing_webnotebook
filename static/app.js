// 快捷指令對照表
const SHORTCUTS = {
    '---': { action: 'insert', value: '\n---\n' },
    'pic': { action: 'upload_image' },
    'todo': { action: 'insert', value: '- [ ] ' },
    '#': { action: 'linePrefix', value: '# ' },
    '##': { action: 'linePrefix', value: '## ' },
    '###': { action: 'linePrefix', value: '### ' }, // New: Level 3 heading
    '>': { action: 'linePrefix', value: '> ' },
    '```': { action: 'insert', value: '\n```\ncode\n```\n' },
    'date': { action: 'insert', value: () => new Date().toLocaleDateString() }, // Dynamic value
    'time': { action: 'insert', value: () => new Date().toLocaleTimeString() }, // Dynamic value
    'link': { action: 'prompt_link' },
    'table': { action: 'insert', value: '\n| 項目 | 值 |\n|---|---|\n| | |\n' },
    'math': { action: 'insert', value: '$$math$$' },
    'bold': { action: 'wrap', value: '**' }, // New: Bold text
    'italic': { action: 'wrap', value: '_' }, // New: Italic text
    'list': { action: 'linePrefix', value: '- ' } // New: Unordered list
};

// Handle shortcuts in a more modular way
async function handleShortcut(sc, lineStart, pos) {
    const before = editor.value.slice(0, lineStart);
    const after = editor.value.slice(pos);
    
    if (sc.action === 'insert') {
        const value = typeof sc.value === 'function' ? sc.value() : sc.value;
        editor.value = before + value + after;
        const newPos = before.length + value.length;
        editor.setSelectionRange(newPos, newPos);
    } else if (sc.action === 'linePrefix') {
        const rest = editor.value.slice(lineStart);
        editor.value = before + sc.value + rest;
        const newPos = pos + sc.value.length;
        editor.setSelectionRange(newPos, newPos);
    } else if (sc.action === 'upload_image') {
        document.getElementById('imageInput').click();
    } else if (sc.action === 'prompt_link') {
        const url = prompt('請輸入網址：');
        if (url) {
            const md = `[連結](${url})`;
            editor.value = before + md + '\n' + after;
            renderPreview();
        }
    } else if (sc.action === 'wrap') {
        const selection = editor.value.slice(editor.selectionStart, editor.selectionEnd);
        if (selection) {
            const wrapped = `${sc.value}${selection}${sc.value}`;
            editor.value = editor.value.slice(0, editor.selectionStart) + wrapped + editor.value.slice(editor.selectionEnd);
            const newPos = editor.selectionStart + wrapped.length;
            editor.setSelectionRange(newPos, newPos);
        } else {
            const value = sc.value + sc.value;
            editor.value = before + value + after;
            const newPos = before.length + sc.value.length;
            editor.setSelectionRange(newPos, newPos);
        }
    }
    renderPreview();
}

// Update keydown event listener
editor.addEventListener('keydown', async (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        document.getElementById('noteForm').requestSubmit();
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

// 圖片檔上傳並插入 markdown 圖片連結
const imageInput = document.getElementById('imageInput');
imageInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const form = new FormData();
    form.append('image', file);
    const res = await fetch(window.APP_INIT.uploadUrl, { method: 'POST', body: form });
    const j = await res.json();
    if (j.url) {
        const pos = editor.selectionStart;
        const before = editor.value.slice(0, pos);
        const after = editor.value.slice(pos);
        const mdImg = `![](${j.url})`;
        editor.value = before + mdImg + after;
        const newPos = before.length + mdImg.length;
        editor.setSelectionRange(newPos, newPos);
        renderPreview();
    } else {
        alert('上傳失敗');
    }
    imageInput.value = '';
});


// 支援拖放圖片到 textar
// Drag-and-drop image support
editor.addEventListener('dragover', (e) => {
    e.preventDefault(); // Prevent default to allow drop
    editor.classList.add('dragover'); // Optional: Add visual feedback
});

editor.addEventListener('dragleave', () => {
    editor.classList.remove('dragover'); // Remove visual feedback
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
                const newPos = before.length + mdImg.length;
                editor.setSelectionRange(newPos, newPos);
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

// Handle delete button
const delBtn = document.getElementById('delBtn');
if (delBtn) {
    delBtn.addEventListener('click', async () => {
        if (confirm('確定要刪除此筆記？')) {
            const noteId = document.querySelector('input[name="id"]').value;
            try {
                const res = await fetch(`/note/${noteId}/delete`, { method: 'POST' });
                if (res.status === 204) {
                    window.location.href = '/'; // Redirect to index after deletion
                } else {
                    alert('刪除失敗');
                }
            } catch (err) {
                alert('刪除錯誤：' + err.message);
            }
        }
    });
}

function renderPreview() {
    const md = editor.value;
    // Configure marked.js with highlight.js
    marked.setOptions({
        highlight: function (code, lang) {
            if (lang && hljs.getLanguage(lang)) {
                return hljs.highlight(code, { language: lang }).value;
            }
            return code;
        }
    });
    const html = marked.parse(md);
    preview.innerHTML = html;
    // Render math with KaTeX
    renderMathInElement(preview, {
        delimiters: [
            { left: "$$", right: "$$", display: true },
            { left: "\\[", right: "\\]", display: true },
            { left: "$", right: "$", display: false },
            { left: "\\(", right: "\\)", display: false }
        ],
        throwOnError: false
    });
}

// Autosave every 30 seconds
let lastContent = editor.value;
setInterval(async () => {
    if (editor.value !== lastContent) {
        lastContent = editor.value;
        try {
            const form = document.getElementById('noteForm');
            const formData = new FormData(form);
            await fetch(form.action, {
                method: 'POST',
                body: formData
            });
            console.log('Autosaved');
        } catch (err) {
            console.error('Autosave failed:', err);
        }
    }
}, 30000);

// 即時預覽功能 - 監聽輸入事件
editor.addEventListener('input', renderPreview);

// 初始化時渲染預覽
document.addEventListener('DOMContentLoaded', () => {
    renderPreview();
});