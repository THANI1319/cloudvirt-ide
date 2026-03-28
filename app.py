from flask import Flask, render_template, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
import psutil
import subprocess
import time
import os
import shutil
from datetime import datetime
import tempfile

app = Flask(__name__)
CORS(app)

BASE_DIR = os.path.abspath(os.path.dirname(__file__))

# CLOUD DATABASE URL
app.config['SQLALCHEMY_DATABASE_URI'] = 'postgresql://neondb_owner:npg_D5W3ivsJOUjb@ep-damp-cake-a1u58fta-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

# DATABASE MODEL
class ExecutionHistory(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    language = db.Column(db.String(50))
    username = db.Column(db.String(100), default="Anonymous")
    winner = db.Column(db.String(100))
    exec_time = db.Column(db.Float)
    users = db.Column(db.Integer)

with app.app_context():
    db.create_all()

@app.route('/')
def home(): return render_template('index.html')
@app.route('/concepts')
def concepts(): return render_template('concepts.html')
@app.route('/ide')
def ide(): return render_template('ide.html')
@app.route('/analytics')
def analytics(): return render_template('analytics.html')
@app.route('/about')
def about(): return render_template('about.html')
@app.route('/history')
def history(): return render_template('history.html')

# HISTORY ROUTE
@app.route('/api/history', methods=['GET'])
def get_history():
    username = request.args.get('username')
    if username:
        records = ExecutionHistory.query.filter_by(username=username).order_by(ExecutionHistory.timestamp.desc()).limit(20).all()
    else:
        records = []
    data = [{"id": r.id, "time": r.timestamp.strftime("%Y-%m-%d %H:%M:%S"), "lang": r.language, "username": r.username, "winner": r.winner, "exec": r.exec_time, "users": r.users} for r in records]
    return jsonify(data)

# EXECUTE ROUTE
@app.route('/api/execute', methods=['POST'])
def execute_code():
    data = request.get_json()
    user_code = data.get('code', '')
    language = data.get('language', 'python')
    concurrency = int(data.get('concurrency', 1))
    username = data.get('username', 'Anonymous')

    start_time = time.time()
    terminal_output = ""
    real_mem, real_cpu = 0, 0

    try:
        if language == 'python':
            fd, temp_path = tempfile.mkstemp(suffix=".py")
            with os.fdopen(fd, 'w') as f: f.write(user_code)
            process = subprocess.run(['python', temp_path], capture_output=True, text=True, timeout=10)
            terminal_output = process.stdout if process.returncode == 0 else process.stderr
            os.remove(temp_path)
        elif language == 'java':
            temp_dir = tempfile.mkdtemp()
            file_path = os.path.join(temp_dir, "Main.java")
            with open(file_path, 'w') as f: f.write(user_code)
            compile_proc = subprocess.run(['javac', file_path], capture_output=True, text=True, timeout=10)
            if compile_proc.returncode != 0: terminal_output = compile_proc.stderr
            else:
                run_proc = subprocess.run(['java', '-cp', temp_dir, 'Main'], capture_output=True, text=True, timeout=10)
                terminal_output = run_proc.stdout if run_proc.returncode == 0 else run_proc.stderr
            shutil.rmtree(temp_dir, ignore_errors=True)
        elif language == 'c':
            fd, temp_path = tempfile.mkstemp(suffix=".c")
            exe_path = temp_path[:-2] + (".exe" if os.name == 'nt' else ".out")
            with os.fdopen(fd, 'w') as f: f.write(user_code)
            compile_proc = subprocess.run(['gcc', temp_path, '-o', exe_path], capture_output=True, text=True, timeout=10)
            if compile_proc.returncode != 0: terminal_output = compile_proc.stderr
            else:
                run_proc = subprocess.run([exe_path], capture_output=True, text=True, timeout=10)
                terminal_output = run_proc.stdout if run_proc.returncode == 0 else run_proc.stderr
                if os.path.exists(exe_path): os.remove(exe_path)
            os.remove(temp_path)

        process_stats = psutil.Process(os.getpid())
        real_mem = process_stats.memory_info().rss / (1024 * 1024)
        real_cpu = psutil.cpu_percent(interval=0.1)

    except Exception as e:
        terminal_output = f"Execution Error: {str(e)}"

    end_time = time.time()
    real_time = end_time - start_time

    lang_mod = {"python": 1.0, "java": 1.8, "c": 0.6}.get(language, 1.0)
    
    vm_time = round(((real_time + 2.8) * lang_mod) * (1 + (concurrency * 0.05)), 4) 
    vm_memory = round(((real_mem + 120.5) * lang_mod) * (1 + (concurrency * 0.1)), 2) 
    vm_cpu = min(round((real_cpu + 18.0) * (1 + (concurrency * 0.05)), 2), 100.0)

    docker_time = round(((real_time + 0.15) * lang_mod) * (1 + (concurrency * 0.01)), 4) 
    docker_memory = round(((real_mem + 12.0) * lang_mod) * (1 + (concurrency * 0.02)), 2) 
    docker_cpu = min(round((real_cpu + 2.5) * (1 + (concurrency * 0.02)), 2), 100.0)

    vm_cost = round(vm_time * 0.05 * concurrency, 2)
    docker_cost = round(docker_time * 0.01 * concurrency, 2)
    
    vm_co2 = round(vm_time * 1.5 * concurrency, 2)
    docker_co2 = round(docker_time * 0.3 * concurrency, 2)

    winner = "Docker Container" if docker_time < vm_time else "Virtual Machine"
    reason = f"Simulating {concurrency} users, Docker saved ${round(vm_cost - docker_cost, 2)} and reduced carbon footprint by {round(vm_co2 - docker_co2, 2)}g CO2."

    new_record = ExecutionHistory(
        language=language.upper(), 
        username=username, 
        winner=winner, 
        exec_time=round(real_time, 4), 
        users=concurrency
    )
    db.session.add(new_record)
    db.session.commit()

    return jsonify({
        "status": "success", "output": terminal_output or "Executed successfully.",
        "language": language.upper(), "winner": winner, "reason": reason, "concurrency": concurrency,
        "vm": {"time": vm_time, "memory": vm_memory, "cpu": vm_cpu, "cost": vm_cost, "co2": vm_co2},
        "docker": {"time": docker_time, "memory": docker_memory, "cpu": docker_cpu, "cost": docker_cost, "co2": docker_co2}
    })

# FILE ANALYSIS ROUTE (Corrected position)
@app.route('/api/analyze-file', methods=['POST'])
def analyze_file():
    data = request.json
    filename = data.get('fileName')
    filesize_kb = data.get('fileSize') # In KB
    file_type = data.get('fileType')

    vm_boot_time = 25.5
    docker_boot_time = 0.4
    vm_speed = 45 
    docker_speed = 95 
    
    transfer_time_docker = (filesize_kb / 1024) / docker_speed
    transfer_time_vm = (filesize_kb / 1024) / vm_speed
    
    vm_overhead = 20 * 1024 
    docker_overhead = 0.1 * 1024 

    return jsonify({
        "status": "success",
        "analysis": {
            "fileName": filename,
            "type": file_type,
            "vm": {
                "totalTime": round(vm_boot_time + transfer_time_vm, 2),
                "storage": f"{round((filesize_kb + vm_overhead)/1024, 2)} GB",
                "co2": round((vm_boot_time + transfer_time_vm) * 1.2, 2)
            },
            "docker": {
                "totalTime": round(docker_boot_time + transfer_time_docker, 2),
                "storage": f"{round((filesize_kb + docker_overhead)/1024, 2)} MB",
                "co2": round((docker_boot_time + transfer_time_docker) * 0.2, 2)
            }
        }
    })

@app.route('/initdb')
def init_db():
    with app.app_context():
        db.create_all()
    return "Database tables created successfully! 🚀 You can now use the app."

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)