AOS.init({ duration: 800, once: false, mirror: true });

particlesJS("particles-js", { particles: { number: { value: 60 }, color: { value: "#58a6ff" }, opacity: { value: 0.2 }, size: { value: 3 }, line_linked: { enable: true, color: "#58a6ff", opacity: 0.1 }, move: { enable: true, speed: 1.5 } } });

let editor;
let charts = {};

// Default templates for languages
const defaultCodes = {
    python: `# Write your Python code here...\nimport time\n\nstart = time.time()\nresult = sum([i*i for i in range(1000000)])\nprint(f"Result: {result}\\nTime: {time.time()-start:.2f}s")`,
    java: `// Write your Java code here... \n// Note: Class MUST be named 'Main'\npublic class Main {\n    public static void main(String[] args) {\n        long start = System.currentTimeMillis();\n        long sum = 0;\n        for(int i=0; i<1000000; i++) sum += (long)i*i;\n        System.out.println("Result: " + sum);\n        System.out.println("Time: " + (System.currentTimeMillis() - start) + "ms");\n    }\n}`,
    c: `// Write your C code here...\n#include <stdio.h>\n#include <time.h>\n\nint main() {\n    clock_t start = clock();\n    long long sum = 0;\n    for(long long i=0; i<1000000; i++) sum += i*i;\n    printf("Result: %lld\\n", sum);\n    printf("Time: %f s\\n", ((double)(clock() - start)) / CLOCKS_PER_SEC);\n    return 0;\n}`
};

// LOAD MONACO ONLY ON IDE PAGE
if(document.getElementById('monacoEditor')) {
    require.config({ paths: { 'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.36.1/min/vs' }});
    require(['vs/editor/editor.main'], function () {
        editor = monaco.editor.create(document.getElementById('monacoEditor'), {
            value: defaultCodes['python'],
            language: 'python', theme: 'vs-dark', automaticLayout: true, fontSize: 14, minimap: { enabled: false }
        });
    });
}

function changeLanguage() {
    const lang = document.getElementById('langSelect').value;
    if(editor) {
        monaco.editor.setModelLanguage(editor.getModel(), lang);
        editor.setValue(defaultCodes[lang]);
        
        let icon = lang === 'python' ? 'fab fa-python text-warning' : lang === 'java' ? 'fab fa-java text-danger' : 'fas fa-copyright text-info';
        let ext = lang === 'python' ? 'py' : lang === 'java' ? 'java' : 'c';
        document.getElementById('fileName').innerHTML = `<i class="${icon}"></i> main.${ext}`;
    }
}

// EXECUTE FUNCTION (Shows Output First, Then Redirects)
async function executeCode() {
    const code = editor.getValue();
    const lang = document.getElementById('langSelect').value;
    const concurrency = document.getElementById('concurrencySelect').value; // Multi-user simulator

    // ---> PUDHUSA ADD PANNUNA USERNAME LOGIC <---
    let currentUsername = localStorage.getItem("ide_username");
    if (!currentUsername) {
        currentUsername = prompt("Please enter your name for History tracking:");
        if (currentUsername) {
            localStorage.setItem("ide_username", currentUsername);
        } else {
            currentUsername = "Anonymous";
        }
    }
    // ---------------------------------------------

    Swal.fire({
        title: `Simulating ${concurrency} Users`,
        html: `Executing ${lang.toUpperCase()} workload...`,
        background: '#161b22', color: '#e6edf3', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); }
    });

    try {
        const response = await fetch('/api/execute', {
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            // INGA 'username' ADD PANNIRUKKEN:
            body: JSON.stringify({ code: code, language: lang, concurrency: concurrency, username: currentUsername })
        });
        const data = await response.json();
        
        if(data.status === "error") {
            Swal.fire('Error', data.message, 'error'); 
            return;
        }

        // 1. SHOW OUTPUT IN TERMINAL FIRST
        document.getElementById('terminalOutput').innerText = data.output;
        
        // 2. SAVE ANALYTICS DATA
        localStorage.setItem('cloudResult', JSON.stringify(data));
        
        // 3. SHOW SUCCESS AND ASK TO GO TO ANALYTICS
        Swal.fire({
            icon: 'success',
            title: 'Execution Complete!',
            text: 'Code ran successfully! Check terminal output below.',
            background: '#161b22', color: '#e6edf3',
            confirmButtonText: '<i class="fas fa-chart-bar"></i> View Performance Analytics',
            confirmButtonColor: '#2ea043'
        }).then((result) => {
            if (result.isConfirmed) {
                window.location.href = '/analytics'; // Redirects only when user clicks
            }
        });

    } catch (error) {
        Swal.fire('Error', 'Connection Failed. Is backend running?', 'error');
    }
}

// LOAD ANALYTICS ONLY ON ANALYTICS PAGE
if(window.location.pathname === '/analytics') {
    window.onload = function() {
        const savedData = localStorage.getItem('cloudResult');
        if(savedData) {
            document.getElementById('no-data-msg').style.display = 'none';
            document.getElementById('analytics-content').style.display = 'block';
            
            const data = JSON.parse(savedData);
            
            const today = new Date();
            document.getElementById('reportDate').innerText = today.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
            
            // SHOW WHICH LANGUAGE WAS USED
            document.getElementById('reportLang').innerText = data.language;

            document.getElementById('winnerName').innerText = data.winner;
            document.getElementById('winnerReason').innerText = data.reason;

            const memDiff = data.vm.memory - data.docker.memory;
            document.getElementById('memSavedPercent').innerText = ((memDiff / data.vm.memory) * 100).toFixed(1);

            const timeDiff = data.vm.time - data.docker.time;
            document.getElementById('timeSavedPercent').innerText = ((timeDiff / data.vm.time) * 100).toFixed(1);

            document.getElementById('vmTime').innerText = data.vm.time + "s";
            document.getElementById('vmMem').innerText = data.vm.memory + " MB";
            document.getElementById('vmCpu').innerText = data.vm.cpu + "%";

            document.getElementById('dockerTime').innerText = data.docker.time + "s";
            document.getElementById('dockerMem').innerText = data.docker.memory + " MB";
            document.getElementById('dockerCpu').innerText = data.docker.cpu + "%";

            renderChart('timeChart', 'Time (s)', data.vm.time, data.docker.time, '#f85149', '#2ea043');
            renderChart('memoryChart', 'Memory (MB)', data.vm.memory, data.docker.memory, '#da3633', '#238636');
            renderChart('cpuChart', 'CPU (%)', data.vm.cpu, data.docker.cpu, '#d29922', '#316dca');
            
            // Cost & CO2 Features
            document.getElementById('vmCost').innerText = data.vm.cost;
            document.getElementById('dockerCost').innerText = data.docker.cost;
            document.getElementById('costSavings').innerText = `Docker saves $${(data.vm.cost - data.docker.cost).toFixed(2)}`;

            document.getElementById('vmCo2').innerText = data.vm.co2;
            document.getElementById('dockerCo2').innerText = data.docker.co2;
            document.getElementById('co2Savings').innerText = `Docker reduces footprint by ${(data.vm.co2 - data.docker.co2).toFixed(2)}g CO2`;
        }
    }
}

function renderChart(id, label, vmVal, dockerVal, colorVM, colorDocker) {
    if (charts[id]) charts[id].destroy();
    const ctx = document.getElementById(id).getContext('2d');
    Chart.defaults.color = '#e6edf3';
    let vmGradient = ctx.createLinearGradient(0, 0, 0, 250); vmGradient.addColorStop(0, colorVM); vmGradient.addColorStop(1, 'rgba(0,0,0,0)');
    let dockerGradient = ctx.createLinearGradient(0, 0, 0, 250); dockerGradient.addColorStop(0, colorDocker); dockerGradient.addColorStop(1, 'rgba(0,0,0,0)');

    charts[id] = new Chart(ctx, {
        type: 'bar',
        data: { labels: ['Virtual Machine', 'Docker Container'], datasets: [{ label: label, data: [vmVal, dockerVal], backgroundColor: [vmGradient, dockerGradient], borderRadius: 5 }] },
        options: { responsive: true, animation: { duration: 1500 }, scales: { y: { beginAtZero: true } }, plugins: { legend: { display: false } } }
    });
}

function downloadPDF() {
    Swal.fire({ title: 'Generating PDF', background: '#161b22', color: '#e6edf3', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });
    const element = document.getElementById('pdf-container');
    html2pdf().from(element).set({
        margin: 0.2, filename: 'CloudVirt_Batch20_Report.pdf', image: { type: 'jpeg', quality: 1 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: '#161b22' },
        jsPDF: { unit: 'in', format: 'letter', orientation: 'landscape' }
    }).save().then(() => { Swal.close(); });
}

// ==========================================
// C. CSV DOWNLOAD LOGIC
// ==========================================
function downloadCSV() {
    const savedData = localStorage.getItem('cloudResult');
    if (!savedData) {
        Swal.fire('Error', 'No data to download!', 'error');
        return;
    }
    const data = JSON.parse(savedData);
    let csvContent = "data:text/csv;charset=utf-8,";
    
    // CSV Headers & Rows
    csvContent += "Metric,Virtual Machine,Docker Container\n";
    csvContent += `Startup Time (s),${data.vm.time},${data.docker.time}\n`;
    csvContent += `Memory (MB),${data.vm.memory},${data.docker.memory}\n`;
    csvContent += `CPU (%),${data.vm.cpu},${data.docker.cpu}\n`;
    csvContent += `Projected Cost ($),${data.vm.cost},${data.docker.cost}\n`;
    csvContent += `CO2 Emission (grams),${data.vm.co2},${data.docker.co2}\n`;

    // Download Logic
    var encodedUri = encodeURI(csvContent);
    var link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "CloudVirt_Analytics.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link); // Clean up
}
// ==========================================
// DATABASE HISTORY PAGE LOGIC
// ==========================================
if(window.location.pathname === '/history') {
    window.onload = async function() {
        try {
            const tbody = document.getElementById('historyTableBody');
            let currentUsername = localStorage.getItem("ide_username");
            
            // Oruvela peru illana, Professional SweetAlert Popup kaattuvom
            if (!currentUsername) {
                const { value: enteredName } = await Swal.fire({
                    title: 'Welcome to Cloud IDE!',
                    text: 'Please enter your professional name to view your workspace history.',
                    input: 'text',
                    inputPlaceholder: 'e.g., Karthik',
                    icon: 'info',
                    background: '#1e1e2d', // Dark theme background
                    color: '#ffffff', // White text
                    confirmButtonColor: '#3b82f6', // Nice blue button
                    confirmButtonText: 'Access History <i class="fas fa-arrow-right"></i>',
                    allowOutsideClick: false, // Veliya click panna close aagathu
                    inputValidator: (value) => {
                        if (!value) {
                            return 'Name is required to access the database!'
                        }
                    }
                });

                if (enteredName) {
                    currentUsername = enteredName;
                    localStorage.setItem("ide_username", currentUsername);
                    // Oru chinna success message
                    await Swal.fire({
                        title: 'Authenticated!',
                        text: `Welcome aboard, ${currentUsername}!`,
                        icon: 'success',
                        timer: 1500,
                        showConfirmButton: false,
                        background: '#1e1e2d',
                        color: '#ffffff'
                    });
                } else {
                    tbody.innerHTML = '<tr><td colspan="7" class="text-warning py-4">Name required to view history.</td></tr>';
                    return;
                }
            }

            // Backend-kku data anuppurom
            const response = await fetch(`/api/history?username=${encodeURIComponent(currentUsername)}`);
            const data = await response.json();
            
            tbody.innerHTML = ''; 
            
            if(data.length === 0) {
                tbody.innerHTML = `<tr><td colspan="7" class="text-muted py-4">No records found for user: <b class="text-info">${currentUsername}</b>. Go to IDE and run a workload first!</td></tr>`;
                return;
            }
            
            data.forEach(row => {
                let tr = document.createElement('tr');
                let winnerClass = row.winner.includes('Docker') ? 'text-success' : 'text-danger';
                
                tr.innerHTML = `
                    <td class="text-muted fw-bold">#${row.id}</td>
                    <td>${row.time}</td>
                    <td class="text-light fw-bold"><i class="fas fa-user text-primary"></i> ${row.username}</td>
                    <td><span class="badge bg-primary px-3 py-2"><i class="fas fa-code"></i> ${row.lang}</span></td>
                    <td class="text-warning fw-bold"><i class="fas fa-users"></i> ${row.users} Load</td>
                    <td class="text-info">${row.exec}s</td>
                    <td class="${winnerClass} fw-bold">${row.winner}</td>
                `;
                tbody.appendChild(tr);
            });
        } catch (error) {
            console.error("Error fetching history:", error);
            document.getElementById('historyTableBody').innerHTML = '<tr><td colspan="7" class="text-danger py-4"><i class="fas fa-exclamation-circle"></i> Error loading database records. Is backend running?</td></tr>';
        }
    }
}