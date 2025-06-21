from flask import Flask, request, send_file, jsonify, abort, Response, redirect, url_for
import os
import shutil
import zipfile
import logging
import mimetypes
from werkzeug.utils import secure_filename

app = Flask(__name__)
UPLOAD_PATH = "/mnt/file"
os.makedirs(UPLOAD_PATH, exist_ok=True)

# Set up logging to file
logging.basicConfig(
    filename='/tmp/app.log',  # Changed to /tmp for OpenShift
    level=logging.INFO,
    format='%(asctime)s %(levelname)s %(message)s'
)

@app.before_request
def log_request_info():
    logging.info(f"Request: {request.method} {request.path} - Body: {request.get_data(as_text=True)}")

@app.errorhandler(Exception)
def handle_exception(e):
    logging.error(f"Exception: {str(e)}", exc_info=True)
    return jsonify({'error': 'Internal server error', 'details': str(e)}), 500

def get_abs_path(rel_path):
    """Get absolute path and ensure it's within UPLOAD_PATH"""
    abs_path = os.path.abspath(os.path.join(UPLOAD_PATH, rel_path.strip('/')))
    if not abs_path.startswith(os.path.abspath(UPLOAD_PATH)):
        abort(403)  # Forbidden - path traversal attempt
    return abs_path

@app.route('/files/<path:subpath>')
def serve_static_file(subpath):
    abs_path = get_abs_path(subpath)
    if not os.path.exists(abs_path):
        abort(404)
    if os.path.isdir(abs_path):
        return jsonify({'error': 'Path is a directory'}), 400
    
    # Add proper content-type
    mimetype = mimetypes.guess_type(abs_path)[0]
    return send_file(abs_path, mimetype=mimetype)

@app.route('/list', methods=['GET'])
def list_files():
    path = request.args.get('path', '')
    abs_path = get_abs_path(path)
    if not os.path.exists(abs_path):
        return jsonify({'error': 'Path not found'}), 404

    if os.path.isdir(abs_path):
        entries = []
        for item in os.listdir(abs_path):
            item_path = os.path.join(abs_path, item)
            try:
                stat = os.stat(item_path)
                entries.append({
                    'name': item,
                    'type': 'folder' if os.path.isdir(item_path) else 'file',
                    'path': os.path.join(path, item).replace("\\", "/"),
                    'size': stat.st_size if os.path.isfile(item_path) else 0,
                    'sizeFormatted': format_size(stat.st_size) if os.path.isfile(item_path) else '-',
                    'modified': stat.st_mtime,
                    'extension': os.path.splitext(item)[1].lower()
                })
            except:
                continue
        return jsonify({'entries': entries, 'path': path})

def format_size(size):
    """Format file size in human readable format"""
    for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
        if size < 1024.0:
            return f"{size:.1f} {unit}"
        size /= 1024.0
    return f"{size:.1f} PB"

@app.route('/delete', methods=['POST', 'DELETE'])
def delete():
    if request.method == 'POST':
        data = request.get_json()
        paths = data.get('paths', [])
        errors = []
        deleted = []
        
        for path in paths:
            abs_path = get_abs_path(path)
            logging.info(f"Trying to delete: {abs_path}")
            if not os.path.exists(abs_path):
                logging.warning(f"Path not found: {abs_path}")
                errors.append({'path': path, 'error': 'File not found'})
                continue
            try:
                if os.path.isdir(abs_path):
                    shutil.rmtree(abs_path)
                    logging.info(f"Deleted folder: {abs_path}")
                elif os.path.isfile(abs_path):
                    os.remove(abs_path)
                    logging.info(f"Deleted file: {abs_path}")
                deleted.append(path)
            except Exception as e:
                logging.error(f"Failed to delete {abs_path}: {str(e)}")
                errors.append({'path': path, 'error': str(e)})
        
        return jsonify({'deleted': deleted, 'errors': errors}), 200
    else:
        # Legacy DELETE method support
        path = request.args.get('path')
        abs_path = get_abs_path(path)
        if not os.path.exists(abs_path):
            return jsonify({"error": "File not found"}), 404
        if os.path.isdir(abs_path):
            shutil.rmtree(abs_path)
        elif os.path.isfile(abs_path):
            os.remove(abs_path)
        return jsonify({"status": "deleted"}), 200

@app.route('/download')
def download():
    path = request.args.get('path', '')
    abs_path = get_abs_path(path)
    if os.path.exists(abs_path):
        if os.path.isdir(abs_path):
            # Create zip for directory
            zip_filename = secure_filename(os.path.basename(abs_path) + '.zip')
            zip_path = os.path.join('/tmp', zip_filename)
            
            with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
                for root, dirs, files in os.walk(abs_path):
                    for file in files:
                        full_path = os.path.join(root, file)
                        rel_path = os.path.relpath(full_path, abs_path)
                        zipf.write(full_path, arcname=rel_path)
            
            return send_file(zip_path, as_attachment=True, download_name=zip_filename)
        else:
            return send_file(abs_path, as_attachment=True)
    return 'Not Found', 404

@app.route('/upload', methods=['POST'])
def upload():
    path = request.form.get('path', '')
    abs_path = get_abs_path(path)
    os.makedirs(abs_path, exist_ok=True)
    
    uploaded = []
    errors = []
    
    for f in request.files.getlist('files'):
        if f.filename:
            try:
                filename = secure_filename(f.filename)
                if not filename:
                    filename = f.filename.replace('/', '_').replace('\\', '_')
                
                filepath = os.path.join(abs_path, filename)
                
                # Handle duplicates
                if os.path.exists(filepath):
                    base, ext = os.path.splitext(filename)
                    counter = 1
                    while os.path.exists(filepath):
                        filename = f"{base}_{counter}{ext}"
                        filepath = os.path.join(abs_path, filename)
                        counter += 1
                
                f.save(filepath)
                uploaded.append(filename)
            except Exception as e:
                errors.append({'file': f.filename, 'error': str(e)})
    
    return jsonify({'uploaded': uploaded, 'errors': errors}), 200

@app.route('/create-folder', methods=['POST'])
def create_folder():
    data = request.get_json()
    folder_name = secure_filename(data.get('name', '').strip())
    path = data.get('path', '')
    
    if not folder_name:
        return jsonify({'error': 'Invalid folder name'}), 400
    
    abs_path = get_abs_path(os.path.join(path, folder_name))
    
    if os.path.exists(abs_path):
        return jsonify({'error': 'Folder already exists'}), 409
    
    try:
        os.makedirs(abs_path, exist_ok=True)
        return jsonify({'status': 'created'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/rename', methods=['POST'])
def rename():
    data = request.get_json()
    old_path = data.get('oldPath', data.get('old_path', ''))
    new_name = secure_filename(data.get('newName', data.get('new_name', '')).strip())
    
    if not old_path or not new_name:
        return jsonify({'error': 'Invalid parameters'}), 400
    
    abs_old_path = get_abs_path(old_path)
    
    if not os.path.exists(abs_old_path):
        return jsonify({'error': 'Path not found'}), 404
    
    parent_dir = os.path.dirname(old_path)
    new_path = os.path.join(parent_dir, new_name)
    abs_new_path = get_abs_path(new_path)
    
    if os.path.exists(abs_new_path):
        return jsonify({'error': 'Destination already exists'}), 409
    
    try:
        os.rename(abs_old_path, abs_new_path)
        return jsonify({'status': 'renamed', 'newPath': new_path}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/download-zip')
def download_zip():
    path = request.args.get('path', '')
    abs_path = get_abs_path(path)
    if not os.path.exists(abs_path):
        return 'Not Found', 404

    zip_filename = secure_filename(os.path.basename(abs_path) + '.zip')
    zip_path = os.path.join('/tmp', zip_filename)
    
    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk(abs_path):
            for file in files:
                full_path = os.path.join(root, file)
                rel_path = os.path.relpath(full_path, abs_path)
                zipf.write(full_path, arcname=rel_path)

    return send_file(zip_path, as_attachment=True, download_name=zip_filename)

@app.route('/search')
def search():
    query = request.args.get('q', '').lower()
    path = request.args.get('path', '')
    abs_path = get_abs_path(path)

    if not os.path.exists(abs_path):
        return jsonify({'error': 'Path not found'}), 404

    matches = []
    try:
        for root, dirs, files in os.walk(abs_path):
            # Limit results
            if len(matches) >= 100:
                break
                
            for name in dirs + files:
                if query in name.lower():
                    full_path = os.path.join(root, name)
                    rel_path = os.path.relpath(full_path, UPLOAD_PATH).replace("\\", "/")
                    stat = os.stat(full_path)
                    matches.append({
                        'name': name,
                        'type': 'folder' if os.path.isdir(full_path) else 'file',
                        'path': rel_path,
                        'size': stat.st_size if os.path.isfile(full_path) else 0,
                        'sizeFormatted': format_size(stat.st_size) if os.path.isfile(full_path) else '-',
                        'modified': stat.st_mtime,
                        'extension': os.path.splitext(name)[1].lower()
                    })
        return jsonify({'results': matches})
    except Exception as e:
        logging.error(f"Search failed: {str(e)}", exc_info=True)
        return jsonify({'error': 'Search failed', 'details': str(e)}), 500

# Updated logout route for redirect to login page
@app.route('/logout', methods=['POST'])
def logout():
    return redirect('/login')

@app.route('/get-url')
def get_url():
    path = request.args.get('path', '')
    abs_path = get_abs_path(path)

    if not os.path.exists(abs_path):
        return jsonify({'error': 'Path not found'}), 404

    if os.path.isdir(abs_path):
        return jsonify({'error': 'Path is a directory'}), 400

    base_url = request.host_url.rstrip('/')
    url = f"{base_url}/files/{path.strip('/')}"
    return jsonify({'url': url})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=False)