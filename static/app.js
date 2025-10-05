// --- 快捷指令對照表 ---
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
    'list': { action: 'linePrefix', value: '- ' }
};

const editor = document.getElementById('editor');
const preview = document.getElementById('preview');
const imageInput = document.getElementById('imageInput');

// --- 處理快捷指令 ---
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

// --- 綁定快捷鍵與下載 ---
editor.addEventListener('keydown', async (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        downloadAsHTML();
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

// --- 圖片上傳 ---
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
        editor.setSelectionRange(before.length + mdImg.length, before.length + mdImg.length);
        renderPreview();
    } else {
        alert('上傳失敗');
    }
    imageInput.value = '';
});

// --- 拖放圖片支援 ---
editor.addEventListener('dragover', (e) => {
    e.preventDefault();
    editor.classList.add('dragover');
});
editor.addEventListener('dragleave', () => editor.classList.remove('dragover'));
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
            } else alert('圖片上傳失敗');
        } catch (err) {
            alert('上傳錯誤：' + err.message);
        }
    } else alert('請拖放圖片檔案');
});

// --- renderPreview() ---
function renderPreview() {
    if (!preview) return;

    // ✨ 修正：去掉開頭空白或換行
    const md = editor.value.trimStart();

    marked.setOptions({
        highlight: (code, lang) => {
            if (lang && hljs.getLanguage(lang)) return hljs.highlight(code, { language: lang }).value;
            return code;
        }
    });

    const html = marked.parse(md);
    preview.innerHTML = html;

    renderMathInElement(preview, {
        delimiters: [
            { left: "$$", right: "$$", display: true },
            { left: "$", right: "$", display: false }
        ],
        throwOnError: false
    });
}

// --- 自動儲存 ---
let lastContent = editor.value;
setInterval(async () => {
    if (editor.value !== lastContent) {
        lastContent = editor.value;
        try {
            const form = document.getElementById('noteForm');
            const formData = new FormData(form);
            await fetch(form.action, { method: 'POST', body: formData });
            console.log('Autosaved');
        } catch (err) {
            console.error('Autosave failed:', err);
        }
    }
}, 30000);

editor.addEventListener('input', renderPreview);
document.addEventListener('DOMContentLoaded', renderPreview);

// --- 下載 HTML ---
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
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/highlight.js@11.9.0/styles/github.min.css">
<style>
body { font-family: 'Microsoft JhengHei', sans-serif; margin: 40px; background: #fafafa; }
pre code { background: #f4f4f4; padding: 8px; border-radius: 5px; display: block; }
hr { border: none; border-top: 1px solid #ccc; margin: 20px 0; }
img { max-width: 100%; border-radius: 5px; }
blockquote { color: #555; border-left: 4px solid #ccc; margin-left: 0; padding-left: 10px; }
</style>
</head>
<body>
<h1>${title}</h1>
${renderedHTML}
<script src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js"></script>
<script>
document.addEventListener('DOMContentLoaded', () => {
    renderMathInElement(document.body, {
        delimiters: [
            { left: "$$", right: "$$", display: true },
            { left: "$", right: "$", display: false }
        ]
    });
});
</script>
</body>
</html>`;
    const blob = new Blob([fullHTML], { type: 'text/html' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${title}.html`;
    a.click();
}

// // 快捷指令對照表
// const SHORTCUTS = {
//     '---': { action: 'insert', value: '\n---\n' },
//     'pic': { action: 'upload_image' },
//     'todo': { action: 'insert', value: '- [ ] ' },
//     '#': { action: 'linePrefix', value: '# ' },
//     '##': { action: 'linePrefix', value: '## ' },
//     '###': { action: 'linePrefix', value: '### ' }, // New: Level 3 heading
//     '>': { action: 'linePrefix', value: '> ' },
//     '```': { action: 'insert', value: '\n```\ncode\n```\n' },
//     'date': { action: 'insert', value: () => new Date().toLocaleDateString() }, // Dynamic value
//     'time': { action: 'insert', value: () => new Date().toLocaleTimeString() }, // Dynamic value
//     'link': { action: 'prompt_link' },
//     'table': { action: 'insert', value: '\n| 項目 | 值 |\n|---|---|\n| | |\n' },
//     'math': { action: 'insert', value: '$$math$$' },
//     'bold': { action: 'wrap', value: '**' }, // New: Bold text
//     'italic': { action: 'wrap', value: '_' }, // New: Italic text
//     'list': { action: 'linePrefix', value: '- ' } // New: Unordered list
// };

// // Handle shortcuts in a more modular way
// async function handleShortcut(sc, lineStart, pos) {
//     const before = editor.value.slice(0, lineStart);
//     const after = editor.value.slice(pos);
    
//     if (sc.action === 'insert') {
//         const value = typeof sc.value === 'function' ? sc.value() : sc.value;
//         editor.value = before + value + after;
//         const newPos = before.length + value.length;
//         editor.setSelectionRange(newPos, newPos);
//     } else if (sc.action === 'linePrefix') {
//         const rest = editor.value.slice(lineStart);
//         editor.value = before + sc.value + rest;
//         const newPos = pos + sc.value.length;
//         editor.setSelectionRange(newPos, newPos);
//     } else if (sc.action === 'upload_image') {
//         document.getElementById('imageInput').click();
//     } else if (sc.action === 'prompt_link') {
//         const url = prompt('請輸入網址：');
//         if (url) {
//             const md = `[連結](${url})`;
//             editor.value = before + md + '\n' + after;
//             renderPreview();
//         }
//     } else if (sc.action === 'wrap') {
//         const selection = editor.value.slice(editor.selectionStart, editor.selectionEnd);
//         if (selection) {
//             const wrapped = `${sc.value}${selection}${sc.value}`;
//             editor.value = editor.value.slice(0, editor.selectionStart) + wrapped + editor.value.slice(editor.selectionEnd);
//             const newPos = editor.selectionStart + wrapped.length;
//             editor.setSelectionRange(newPos, newPos);
//         } else {
//             const value = sc.value + sc.value;
//             editor.value = before + value + after;
//             const newPos = before.length + sc.value.length;
//             editor.setSelectionRange(newPos, newPos);
//         }
//     }
//     renderPreview();
// }

// // Update keydown event listener
// editor.addEventListener('keydown', async (e) => {
//     if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
//     e.preventDefault(); // 阻止瀏覽器預設儲存行為
//     downloadAsHTML();   // 改成下載 HTML
//     return;
// }


//     if (e.key === 'Enter') {
//         const pos = editor.selectionStart;
//         const textBefore = editor.value.slice(0, pos);
//         const lineStart = textBefore.lastIndexOf('\n') + 1;
//         const line = textBefore.slice(lineStart).trim();

//         if (SHORTCUTS[line]) {
//             e.preventDefault();
//             await handleShortcut(SHORTCUTS[line], lineStart, pos);
//         }
//     }
// });

// // 圖片檔上傳並插入 markdown 圖片連結
// const imageInput = document.getElementById('imageInput');
// imageInput.addEventListener('change', async (e) => {
//     const file = e.target.files[0];
//     if (!file) return;
//     const form = new FormData();
//     form.append('image', file);
//     const res = await fetch(window.APP_INIT.uploadUrl, { method: 'POST', body: form });
//     const j = await res.json();
//     if (j.url) {
//         const pos = editor.selectionStart;
//         const before = editor.value.slice(0, pos);
//         const after = editor.value.slice(pos);
//         const mdImg = `![](${j.url})`;
//         editor.value = before + mdImg + after;
//         const newPos = before.length + mdImg.length;
//         editor.setSelectionRange(newPos, newPos);
//         renderPreview();
//     } else {
//         alert('上傳失敗');
//     }
//     imageInput.value = '';
// });


// // 支援拖放圖片到 textar
// // Drag-and-drop image support
// editor.addEventListener('dragover', (e) => {
//     e.preventDefault(); // Prevent default to allow drop
//     editor.classList.add('dragover'); // Optional: Add visual feedback
// });

// editor.addEventListener('dragleave', () => {
//     editor.classList.remove('dragover'); // Remove visual feedback
// });

// editor.addEventListener('drop', async (e) => {
//     e.preventDefault();
//     editor.classList.remove('dragover');
//     const file = e.dataTransfer.files[0];
//     if (file && file.type.startsWith('image/')) {
//         const form = new FormData();
//         form.append('image', file);
//         try {
//             const res = await fetch(window.APP_INIT.uploadUrl, { method: 'POST', body: form });
//             const j = await res.json();
//             if (j.url) {
//                 const pos = editor.selectionStart;
//                 const before = editor.value.slice(0, pos);
//                 const after = editor.value.slice(pos);
//                 const mdImg = `![](${j.url})`;
//                 editor.value = before + mdImg + after;
//                 const newPos = before.length + mdImg.length;
//                 editor.setSelectionRange(newPos, newPos);
//                 renderPreview();
//             } else {
//                 alert('圖片上傳失敗');
//             }
//         } catch (err) {
//             alert('上傳錯誤：' + err.message);
//         }
//     } else {
//         alert('請拖放圖片檔案');
//     }
// });

// // Handle delete button
// const delBtn = document.getElementById('delBtn');
// if (delBtn) {
//     delBtn.addEventListener('click', async () => {
//         if (confirm('確定要刪除此筆記？')) {
//             const noteId = document.querySelector('input[name="id"]').value;
//             try {
//                 const res = await fetch(`/note/${noteId}/delete`, { method: 'POST' });
//                 if (res.status === 204) {
//                     window.location.href = '/'; // Redirect to index after deletion
//                 } else {
//                     alert('刪除失敗');
//                 }
//             } catch (err) {
//                 alert('刪除錯誤：' + err.message);
//             }
//         }
//     });
// }

// function renderPreview() {
//     const md = editor.value;
//     // Configure marked.js with highlight.js
//     marked.setOptions({
//         highlight: function (code, lang) {
//             if (lang && hljs.getLanguage(lang)) {
//                 return hljs.highlight(code, { language: lang }).value;
//             }
//             return code;
//         }
//     });
//     const html = marked.parse(md);
//     preview.innerHTML = html;
//     // Render math with KaTeX
//     renderMathInElement(preview, {
//         delimiters: [
//             { left: "$$", right: "$$", display: true },
//             { left: "\\[", right: "\\]", display: true },
//             { left: "$", right: "$", display: false },
//             { left: "\\(", right: "\\)", display: false }
//         ],
//         throwOnError: false
//     });
// }

// // Autosave every 30 seconds
// let lastContent = editor.value;
// setInterval(async () => {
//     if (editor.value !== lastContent) {
//         lastContent = editor.value;
//         try {
//             const form = document.getElementById('noteForm');
//             const formData = new FormData(form);
//             await fetch(form.action, {
//                 method: 'POST',
//                 body: formData
//             });
//             console.log('Autosaved');
//         } catch (err) {
//             console.error('Autosave failed:', err);
//         }
//     }
// }, 30000);

// // 即時預覽功能 - 監聽輸入事件
// editor.addEventListener('input', renderPreview);

// // 初始化時渲染預覽
// document.addEventListener('DOMContentLoaded', () => {
//     renderPreview();
// });

// // --- 點擊「下載 HTML」按鈕 ---
// const downloadBtn = document.getElementById('downloadBtn');
// if (downloadBtn) {
//     downloadBtn.addEventListener('click', () => {
//         downloadAsHTML();
//     });
// }

// // --- 將筆記內容轉成 HTML 並下載 ---
// function downloadAsHTML() {
//     const title = document.querySelector('input[name="title"]').value || '未命名筆記';
//     const content = document.getElementById('editor').value;

//     // 這裡用 marked + highlight.js + KaTeX 來處理 markdown、程式碼與公式
//     const renderedHTML = marked.parse(content);
//     const fullHTML = `
// <!DOCTYPE html>
// <html lang="zh-Hant">
// <head>
// <meta charset="UTF-8">
// <title>${title}</title>
// <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
// <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/highlight.js@11.9.0/styles/github.min.css">
// <style>
// body { font-family: 'Microsoft JhengHei', sans-serif; margin: 40px; background: #fafafa; }
// pre code { background: #f4f4f4; padding: 8px; border-radius: 5px; display: block; }
// hr { border: none; border-top: 1px solid #ccc; margin: 20px 0; }
// img { max-width: 100%; border-radius: 5px; }
// blockquote { color: #555; border-left: 4px solid #ccc; margin-left: 0; padding-left: 10px; }
// </style>
// </head>
// <body>
// <h1>${title}</h1>
// ${renderedHTML}
// <script src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js"></script>
// <script src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js"></script>
// <script>
// document.addEventListener('DOMContentLoaded', () => {
//     renderMathInElement(document.body, {
//         delimiters: [
//             { left: "$$", right: "$$", display: true },
//             { left: "$", right: "$", display: false }
//         ]
//     });
// });
// </script>
// </body>
// </html>
// `;

//     // 建立 blob 並觸發下載
//     const blob = new Blob([fullHTML], { type: 'text/html' });
//     const a = document.createElement('a');
//     a.href = URL.createObjectURL(blob);
//     a.download = `${title}.html`;
//     a.click();
// }
