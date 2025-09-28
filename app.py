from flask import Flask, g, render_template, request, redirect, url_for, jsonify, send_from_directory
import sqlite3
import os
from datetime import datetime
from werkzeug.utils import secure_filename

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, 'notes.db')
UPLOAD_FOLDER = os.path.join(BASE_DIR, 'static', 'uploads')
ALLOWED_EXT = {'png','jpg','jpeg','gif','webp'}

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# --- DB helpers ---
def get_db():
    db = getattr(g, '_database', None)
    if db is None:
        db = g._database = sqlite3.connect(DB_PATH)
        db.row_factory = sqlite3.Row
    return db

@app.teardown_appcontext
def close_connection(exception):
    db = getattr(g, '_database', None)
    if db is not None:
        db.close()

def init_db():
    with app.app_context():  # 建立 Application Context
        db = get_db()
        db.execute('''
            CREATE TABLE IF NOT EXISTS notes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT,
                content TEXT,
                tags TEXT,
                created_at TEXT,
                updated_at TEXT
            )
        ''')
        db.commit() 

init_db()

# --- Routes ---

@app.route('/')
def index():
    db = get_db()
    cur = db.execute('SELECT id, title, substr(content,1,200) as preview, updated_at FROM notes ORDER BY updated_at DESC')
    notes = cur.fetchall()
    return render_template('index.html', notes=notes)

@app.route('/note/new')
def new_note():
    return render_template('edit.html', note=None)

@app.route('/note/<int:note_id>/edit')
def edit_note(note_id):
    db = get_db()
    cur = db.execute('SELECT * FROM notes WHERE id=?', (note_id,))
    note = cur.fetchone()
    if not note:
        return redirect(url_for('index'))
    return render_template('edit.html', note=note)

@app.route('/note/save', methods=['POST'])
def save_note():
    data = request.form
    title = data.get('title', '').strip() or '無標題'
    content = data.get('content','')
    tags = data.get('tags','')
    now = datetime.utcnow().isoformat()
    db = get_db()
    note_id = data.get('id')
    if note_id:
        db.execute('UPDATE notes SET title=?, content=?, tags=?, updated_at=? WHERE id=?', (title, content, tags, now, note_id))
    else:
        db.execute('INSERT INTO notes (title, content, tags, created_at, updated_at) VALUES (?,?,?,?,?)', (title, content, tags, now, now))
    db.commit()
    return redirect(url_for('index'))

@app.route('/note/<int:note_id>/delete', methods=['POST'])
def delete_note(note_id):
    db = get_db()
    db.execute('DELETE FROM notes WHERE id=?', (note_id,))
    db.commit()
    return ('',204)

# Image upload endpoint used by the "pic" shortcut
@app.route('/upload-image', methods=['POST'])
def upload_image():
    if 'image' not in request.files:
        return jsonify({'error':'no file'}), 400
    f = request.files['image']
    if f.filename == '':
        return jsonify({'error':'empty filename'}), 400
    name = secure_filename(f.filename)
    ext = name.rsplit('.',1)[-1].lower()
    if ext not in ALLOWED_EXT:
        return jsonify({'error':'invalid ext'}), 400
    timestamp = datetime.utcnow().strftime('%Y%m%d%H%M%S%f')
    save_name = f"{timestamp}_{name}"
    save_path = os.path.join(app.config['UPLOAD_FOLDER'], save_name)
    f.save(save_path)
    url = url_for('static', filename=f'uploads/{save_name}')
    return jsonify({'url': url})
    
if __name__ == '__main__':
    init_db()
    app.run(debug=True)