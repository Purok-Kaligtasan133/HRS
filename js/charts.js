/* charts.js — updated to produce:
   - Barangay (people per barangay)
   - Age distribution (numeric buckets)
   - Stage distribution (separate)
   - PWD (Yes / No)
   - Status distribution
   - Assistance (combined horizontal bar)
*/

const API_URL = "https://script.google.com/macros/s/AKfycbymKmfbcn3uQmsljJlt8V-ziD_wf1H6Pm6ejMqEeRwxhqHB0vktP3My7OcXVCWVMvnhCg/exec"; // your deployment

let charts = {};

window.addEventListener('load', async () => {
  if (!localStorage.getItem("loggedIn")) {
    // if your app uses main.html or login page, adjust accordingly
    // location.href = "login.html";
  }

  document.getElementById("userName").innerText = localStorage.getItem("staffName") || "";

  document.getElementById("logoutBtn").addEventListener("click", () => {
    localStorage.clear();
    location.href = "login.html";
  });

  document.getElementById("btnPrint").addEventListener("click", () => window.print());
  document.getElementById("btnExportPDF").addEventListener("click", exportAllToPDF);
  document.getElementById("btnExportPNGs").addEventListener("click", exportAllPNGsZip);

  document.getElementById("loader").style.display = 'block';
  await loadAndRender();
  document.getElementById("loader").style.display = 'none';
});

async function loadAndRender(){
  try {
    // fetch records using your existing API
    const res = await fetch(API_URL + "?action=getRecords");
    const j = await res.json();
    if (!j || !j.success) {
      console.error("Failed to fetch records:", j);
      return;
    }
    const rows = j.rows || [];

    // Build stats
    const barangayCounts = {};
    const pwd = { Yes: 0, No: 0 };
    const statusCounts = {};
    const assistanceList = [
      "TUPAD",
      "Local 4Ps",
      "National 4Ps",
      "Local Social Pension",
      "National Social Pension",
      "Solo Parent Assistance",
      "Cash Subsidy",
      "Relief Goods",
      "AICS"
    ];
    const assistCounts = assistanceList.reduce((acc,k)=> (acc[k]=0,acc), {});
    // Age buckets: "<1" (infant months), "1-4", "5-12", "13-17", "18-59", "60+"
    const ageBuckets = {"<1":0, "1-4":0, "5-12":0, "13-17":0, "18-59":0, "60+":0};
    const stageCounts = {}; // use Stage field if present; fallback derive from birthdate/age

    // helper: parse age or birthdate
    function computeAgeFromValue(ageVal, birthVal){
      // prefer numeric ageVal if present and not empty
      const a = parseInt(ageVal,10);
      if (!isNaN(a)) return a;
      // try parse birthVal (could be DD/MM/YYYY or yyyy-mm-dd or Date object)
      if (!birthVal) return null;
      const s = String(birthVal).trim();
      // If sheet stored DD/MM/YYYY convert to yyyy-mm-dd
      if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)){
        const parts = s.split('/');
        const dd = parts[0], mm = parts[1], yy = parts[2];
        const dt = new Date(`${yy}-${mm}-${dd}T00:00:00`);
        if (!isNaN(dt)) return calcYears(dt);
      }
      // if stored ISO-like string
      if (/^\d{4}-\d{2}-\d{2}/.test(s)){
        const dt = new Date(s);
        if (!isNaN(dt)) return calcYears(dt);
      }
      // try Date parse fallback
      const dt2 = new Date(s);
      if (!isNaN(dt2)) return calcYears(dt2);
      return null;
    }
    function calcYears(d){
      const now = new Date();
      let years = now.getFullYear() - d.getFullYear();
      const m = now.getMonth() - d.getMonth();
      if (m < 0 || (m === 0 && now.getDate() < d.getDate())) years--;
      return years;
    }

    function deriveStageFromAgeOrField(ageNum, stageField){
      if (stageField && String(stageField).trim()) return String(stageField);
      if (ageNum === null || ageNum === undefined) return "";
      if (ageNum === 0) return "Infant";
      if (ageNum <= 12) return "Children";
      if (ageNum <= 17) return "School Children";
      if (ageNum >= 60) return "Elderly";
      return "Adult";
    }

    // iterate rows — each row corresponds to a person (head rows have blank "Name of Household Member/s" but still a person)
    for (const r of rows) {
      const barangay = String(r["Barangay"] || r["barangay"] || "Unknown").trim();
      barangayCounts[barangay] = (barangayCounts[barangay] || 0) + 1;

      // PWD
      const vpwd = String(r["Persons with Disability (PWD)"] || r["PWD"] || "").toLowerCase();
      if (vpwd === "yes" || vpwd === "y" || vpwd === "true") pwd.Yes++; else pwd.No++;

      // Status
      const st = String(r["Status"] || "").trim() || "Unspecified";
      statusCounts[st] = (statusCounts[st] || 0) + 1;

      // Assistance counts (check exact header names)
      assistanceList.forEach(k=>{
        const val = String(r[k] || r[k.replace(/ /g,'')] || "").toString().trim();
        if (!val) return;
        // For AICS, many entries might be text (Shelter Assistance etc.) — count non-empty as 1 per person per AICS
        if (k === "AICS") {
          if (val !== "") assistCounts[k] += 1;
        } else {
          // treat yes or "Yes" as count
          if (val.toLowerCase() === "yes" || val.toLowerCase() === "y" || val.toLowerCase() === "true") assistCounts[k] += 1;
        }
      });

      // Age
      const ageNum = computeAgeFromValue(r["Age"], r["Birthdate"] || r["Birth Date"] || r["birthdate"]);
      // bucket
      if (ageNum === null || isNaN(ageNum)) {
        // if we cannot compute age, try to inspect birthdate for months (<1)
        const b = r["Birthdate"] || r["birthdate"] || r["Birth Date"];
        if (b && /^\d{2}\/\d{2}\/\d{4}$/.test(String(b).trim())) {
          // compute months
          const parts = String(b).trim().split('/');
          const dt = new Date(`${parts[2]}-${parts[1]}-${parts[0]}T00:00:00`);
          if (!isNaN(dt)) {
            const months = monthDiff(dt, new Date());
            if (months < 12) { ageBuckets["<1"]++; }
            else {
              const yrs = Math.floor(months/12);
              bucketByYears(yrs);
            }
          }
        }
      } else {
        bucketByYears(ageNum);
      }

      // Stage
      const stageField = r["Stage"] || r["stage"] || "";
      const stage = deriveStageFromAgeOrField(ageNum, stageField);
      if (stage) stageCounts[stage] = (stageCounts[stage] || 0) + 1;
    }

    // helpers
    function monthDiff(d1, d2) {
      let months = (d2.getFullYear() - d1.getFullYear()) * 12;
      months += d2.getMonth() - d1.getMonth();
      if (d2.getDate() < d1.getDate()) months--;
      return months;
    }
    function bucketByYears(yrs){
      if (yrs < 1) ageBuckets["<1"]++;
      else if (yrs <= 4) ageBuckets["1-4"]++;
      else if (yrs <= 12) ageBuckets["5-12"]++;
      else if (yrs <= 17) ageBuckets["13-17"]++;
      else if (yrs <= 59) ageBuckets["18-59"]++;
      else ageBuckets["60+"]++;
    }

    // Draw charts
    drawBarangayChart(barangayCounts);
    drawBarChart('chartAge', ageBuckets, 'Age');
    drawPieChart('chartStage', stageCounts, 'Stage');
    drawPieChart('chartPWD', { Yes: pwd.Yes, No: pwd.No }, 'PWD');
    drawPieChart('chartStatus', statusCounts, 'Status');
    drawHorizontalBar('chartAssistance', assistCounts, 'Assistance Received (counts)');

  } catch (err) {
    console.error("loadAndRender error", err);
  }
}

/* ---------------- CHART DRAWING HELPERS ---------------- */

function drawBarangayChart(counts) {
  const labels = Object.keys(counts).sort();
  const data = labels.map(k => counts[k] || 0);

  const ctx = document.getElementById('chartBarangay').getContext('2d');
  if (charts.chartBarangay) charts.chartBarangay.destroy();

  charts.chartBarangay = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Persons',
        data,
        backgroundColor: labels.map(()=>'rgba(52,183,143,0.8)'),
        borderColor: labels.map(()=> '#0f7a4a'),
        borderWidth: 1
      }]
    },
    options: {
      responsive:true,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, ticks: { stepSize: 1 } },
        x: { ticks: { autoSkip: false } }
      }
    }
  });
}

function drawPieChart(canvasId, countsObj, title){
  const labels = Object.keys(countsObj).filter(k => countsObj[k] > 0);
  const data = labels.map(k => countsObj[k] || 0);
  const ctx = document.getElementById(canvasId).getContext('2d');
  if (charts[canvasId]) charts[canvasId].destroy();

  charts[canvasId] = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels, datasets: [{ data, backgroundColor: labels.map((_,i)=>`hsl(${(i*50)%360} 70% 50%)`), borderWidth:0 }]
    },
    options: { responsive:true, plugins:{ legend:{ position:'bottom' } } }
  });
}

function drawBarChart(canvasId, countsObj, title) {
  const labels = Object.keys(countsObj);
  const data = labels.map(k => countsObj[k] || 0);

  const ctx = document.getElementById(canvasId).getContext('2d');
  if (charts[canvasId]) charts[canvasId].destroy();

  charts[canvasId] = new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets: [{ label: title, data, backgroundColor: labels.map(()=> 'rgba(79,176,131,0.85)'), borderColor: labels.map(()=> '#0f7a4a'), borderWidth:1 }] },
    options: { responsive:true, plugins:{ legend:{ display:false } }, scales:{ y:{ beginAtZero:true, ticks:{ stepSize:1 } } } }
  });
}

function drawHorizontalBar(canvasId, countsObj, title){
  const labels = Object.keys(countsObj);
  const data = labels.map(k => countsObj[k] || 0);

  // Sort descending so largest assistance shows on top
  const combined = labels.map((l,i)=>({label:l, value:data[i]})).sort((a,b)=>b.value-a.value);
  const sortedLabels = combined.map(c=>c.label);
  const sortedData = combined.map(c=>c.value);

  const ctx = document.getElementById(canvasId).getContext('2d');
  if (charts[canvasId]) charts[canvasId].destroy();

  charts[canvasId] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: sortedLabels,
      datasets: [{ label: title, data: sortedData, backgroundColor: sortedLabels.map(()=> 'rgba(52,183,143,0.85)'), borderColor: sortedLabels.map(()=> '#0f7a4a'), borderWidth:1 }]
    },
    options: {
      indexAxis: 'y',
      responsive:true,
      plugins: { legend: { display:false } },
      scales: { x: { beginAtZero: true, ticks: { stepSize:1 } } }
    }
  });
}

/* ---------------- EXPORT / PRINT ---------------- */

async function exportAllToPDF() {
  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape' });
    const ids = ['chartBarangay','chartAge','chartStage','chartPWD','chartStatus','chartAssistance'];
    let page = 0;
    for (const id of ids){
      const canvas = document.getElementById(id);
      if (!canvas) continue;
      const img = canvas.toDataURL("image/jpeg", 0.95);
      if (page > 0) doc.addPage();
      const w = doc.internal.pageSize.getWidth();
      const h = doc.internal.pageSize.getHeight();
      const margin = 12;
      doc.addImage(img, 'JPEG', margin, margin, w - margin*2, h - margin*2);
      page++;
    }
    doc.save(`Charts_${new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')}.pdf`);
  } catch (err) {
    console.error("PDF export failed", err);
    alert("PDF export failed: " + (err.message||err));
  }
}

async function exportAllPNGsZip() {
  try {
    const zip = new JSZip();
    const ids = ['chartBarangay','chartAge','chartStage','chartPWD','chartStatus','chartAssistance'];
    for (const id of ids){
      const canvas = document.getElementById(id);
      if (!canvas) continue;
      const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/png", 1.0));
      if (blob) zip.file(`${id}.png`, blob);
    }
    const content = await zip.generateAsync({ type: "blob" });
    saveAs(content, `Charts_PNGs_${new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')}.zip`);
  } catch (err) {
    console.error("PNG ZIP export failed", err);
    alert("PNG ZIP export failed: " + (err.message||err));
  }
}
