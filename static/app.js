// 快捷指令對照表（可擴充）
const SHORTCUTS = {
    '---': { action: 'insert', value: '\n---\n' },
    'pic': { action: 'upload_image' },
    'todo': { action: 'insert', value: '- [ ] ' },
    '#': { action: 'linePrefix', value: '# ' },
    '##': { action: 'linePrefix', value: '## ' },
    '>': { action: 'linePrefix', value: '> ' },
    '```': { action: 'insert', value: '\n```\ncode\n```\n' },
    'date': { action: 'insert', value: new Date().toLocaleDateString() },
    'time': { action: 'insert', value: new Date().toLocaleTimeString() },
    'link': { action: 'prompt_link' },
    'table': { action: 'insert', value: '\n| 項目 | 值 |\n|---|---|\n| | |\n' },
    'math': { action: 'insert', value: '$$math$$' }
}

const editor = document.getElementById('editor');
const preview = document.getElementById('preview');

function renderPreview() {
    const md = editor.value;
    // 使用 marked.js 轉換 markdown -> html
    preview.innerHTML = marked.parse(md);
}

editor.addEventListener('input', renderPreview);

// 在按下 Enter 時處理快捷指令
editor.addEventListener('keydown', async (e) => {
    // Ctrl/Cmd+S 儲存（觸發表單送出）
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

    // 檢查整行是否為某個快捷指令
    if (SHORTCUTS[line]) {
        e.preventDefault();
        const sc = SHORTCUTS[line];
        if (sc.action === 'insert') {
            // 把該行替換成要插入的內容
            const before = editor.value.slice(0, lineStart);
            const after = editor.value.slice(pos);
            const insert = sc.value;
            editor.value = before + insert + after;
            const newPos = before.length + insert.length;
            editor.setSelectionRange(newPos, newPos);
            renderPreview();
        } else if (sc.action === 'linePrefix') {
            // 在該行前面加入前綴
            const before = editor.value.slice(0, lineStart);
            const rest = editor.value.slice(lineStart);
            editor.value = before + sc.value + rest;
            const newPos = pos + sc.value.length;
            editor.setSelectionRange(newPos, newPos);
            renderPreview();
        } else if (sc.action === 'upload_image') {
            // 觸發檔案輸入
            document.getElementById('imageInput').click();
        } else if (sc.action === 'prompt_link') {
            const url = prompt('請輸入網址：');
            if (url) {
                const md = `[連結](${url})`;
                const before = editor.value.slice(0, lineStart);
                const after = editor.value.slice(pos);
                editor.value = before + md + '\n' + after;
                renderPreview();
            }
        }
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