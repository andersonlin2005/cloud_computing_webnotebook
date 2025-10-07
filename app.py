from flask import Flask, g, render_template, request, redirect, url_for, jsonify, send_from_directory, abort
import sqlite3
import os
from datetime import datetime
from werkzeug.utils import secure_filename

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, 'notes.db')
UPLOAD_FOLDER = os.path.join(BASE_DIR, 'static', 'uploads')
ALLOWED_EXT = {'png', 'jpg', 'jpeg', 'gif', 'webp'}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB limit

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = MAX_FILE_SIZE
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# DB helpers
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
  with app.app_context():
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

# Routes
@app.route('/')
def index():
  db = get_db()
  query = request.args.get('q', '').strip()
  tag = request.args.get('tag', '').strip()
  sql = 'SELECT id, title, updated_at FROM notes WHERE 1=1'
  params = []
  if query:
    sql += ' AND title LIKE ?'
    params.append(f'%{query}%')
  if tag:
    sql += ' AND tags LIKE ?'
    params.append(f'%{tag}%')
  sql += ' ORDER BY updated_at DESC'
  cur = db.execute(sql, params)
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
    abort(404)
  return render_template('edit.html', note=note)

@app.route('/note/save', methods=['POST'])
def save_note():
  data = request.form
  title = data.get('title', '').strip()[:200] or '無標題'
  content = data.get('content', '')[:1000000]
  tags = data.get('tags', '')[:500]
  now = datetime.utcnow().isoformat()
  db = get_db()
  note_id = data.get('id')
  try:
    # 只保留一個 note，無論有無 id 都覆蓋第一筆（或新增一筆）
    cur = db.execute('SELECT id FROM notes ORDER BY id LIMIT 1')
    row = cur.fetchone()
    if row:
      db.execute('UPDATE notes SET title=?, content=?, tags=?, updated_at=? WHERE id=?',
                (title, content, tags, now, row['id']))
    else:
      db.execute('INSERT INTO notes (title, content, tags, created_at, updated_at) VALUES (?,?,?,?,?)',
                (title, content, tags, now, now))
    db.commit()
  except sqlite3.Error as e:
    return jsonify({'error': '資料庫錯誤'}), 500
  return redirect(url_for('index'))

@app.route('/note/<int:note_id>/delete', methods=['POST'])
def delete_note(note_id):
  db = get_db()
  try:
    cur = db.execute('SELECT id FROM notes WHERE id=?', (note_id,))
    if not cur.fetchone():
      abort(404)
    db.execute('DELETE FROM notes WHERE id=?', (note_id,))
    db.commit()
  except sqlite3.Error as e:
    return jsonify({'error': '資料庫錯誤'}), 500
  return ('', 204)

@app.route('/upload-image', methods=['POST'])
def upload_image():
  if 'image' not in request.files:
    return jsonify({'error': '無檔案'}), 400
  f = request.files['image']
  if f.filename == '':
    return jsonify({'error': '檔案名稱為空'}), 400
  name = secure_filename(f.filename)
  ext = name.rsplit('.', 1)[-1].lower() if '.' in name else ''
  if ext not in ALLOWED_EXT:
    return jsonify({'error': '不支援的檔案格式'}), 400
  try:
    timestamp = datetime.utcnow().strftime('%Y%m%d%H%M%S%f')
    save_name = f"{timestamp}_{name}"
    save_path = os.path.join(app.config['UPLOAD_FOLDER'], save_name)
    f.save(save_path)
    url = url_for('static', filename=f'uploads/{save_name}')
    return jsonify({'url': url})
  except Exception as e:
    return jsonify({'error': '上傳失敗'}), 500

@app.route('/tags')
def get_tags():
  db = get_db()
  cur = db.execute('SELECT tags FROM notes WHERE tags != ""')
  tags = set()
  for row in cur.fetchall():
    if row['tags']:
      tags.update(tag.strip() for tag in row['tags'].split(','))
  return jsonify(list(tags))

@app.errorhandler(404)
def not_found(error):
  return render_template('error.html', message='頁面不存在'), 404

@app.errorhandler(413)
def file_too_large(error):
  return jsonify({'error': '檔案過大，最大限制為5MB'}), 413

if __name__ == '__main__':
  init_db()
  app.run(debug=True)