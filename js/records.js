/* ============================================================
   CONFIG
============================================================ */
const SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbwGFL1xNeJ4E78CVpnaQKMdx_RFYDm0jVMbVJ-KnWTE2NbNrhin6bIgr5_R8sEgC4ZGeA/exec";

/* ============================================================
   STATE
============================================================ */
let rawRows = [];
let grouped = {};
let header = [];
let currentPage = 1;
const rowsPerPage = 25;
let selectedIds = new Set();
let groupsArr = [];

/* ============================================================
   UTILITIES
============================================================ */
function showLoading(show) {
  document.getElementById("loading").style.display = show ? "flex" : "none";
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;",
    '"': "&quot;", "'": "&#39;"
  })[c]);
}

function computeKeywordRegex(q) {
  if (!q) return null;
  const esc = q.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
  return new RegExp(esc, "gi");
}

function highlightText(text, q) {
  if (!q) return escapeHtml(text);
  const re = computeKeywordRegex(q);
  return escapeHtml(text).replace(re, m => `<span class="hl">${m}</span>`);
}

/* ============================================================
   JSONP LOADER (for GAS)
============================================================ */
function jsonpGet(params, cb) {
  const ts = Date.now();
  const cbName = "cb_" + ts + "_" + Math.floor(Math.random() * 1000);

  window[cbName] = function (resp) {
    cb(null, resp);
    delete window[cbName];
  };

  const query =
    `action=getRecords` +
    `&filterBarangay=${encodeURIComponent(params.filterBarangay || "")}` +
    `&filterStage=` +
    `&q=${encodeURIComponent(params.q || "")}` +
    `&callback=${cbName}`;

  const script = document.createElement("script");
  script.src = `${SCRIPT_URL}?${query}`;
  script.onerror = () => cb(new Error("JSONP failed"));
  script.onload = () => script.remove();
  document.body.appendChild(script);
}

/* ============================================================
   LOAD + GROUP
============================================================ */
function loadRecords() {
  showLoading(true);

  const filterBarangay = document.getElementById("filterBarangay").value || "";
  const q = document.getElementById("searchInput").value || "";

  jsonpGet({ filterBarangay, q }, (err, resp) => {
    showLoading(false);

    if (err || !resp || !resp.success) {
      alert("Failed to load records");
      console.error(err);
      return;
    }

    header = resp.header || [];
    rawRows = resp.rows || [];

    grouped = {};
    rawRows.forEach(r => {
      const id = String(r["Data ID"] || "");
      if (!id) return;

      if (!grouped[id]) grouped[id] = { dataID: id, head: null, members: [] };

      const isHead = !r["Name of Household Member/s"];
      if (isHead && !grouped[id].head) grouped[id].head = r;
      else grouped[id].members.push(r);
    });

    // fallback: make 1st member the head if missing
    Object.keys(grouped).forEach(id => {
      if (!grouped[id].head && grouped[id].members.length > 0)
        grouped[id].head = grouped[id].members.shift();
    });

    const keys = Object.keys(grouped).sort((a, b) => Number(a) - Number(b));
    groupsArr = keys.map(id => grouped[id]);

    currentPage = 1;
    selectedIds.clear();

    renderPage();
    renderPagination();
    updateCounts();
  });
}

/* ============================================================
   RENDER PAGE
============================================================ */
function renderPage() {
  const tbody = document.getElementById("tableBody");
  const thead = document.getElementById("tableHead");
  tbody.innerHTML = "";
  thead.innerHTML = "";

  // ---- HEADER ----
  let headRow = "<tr>";
  headRow += `<th class="select-col"><input id="selectAll" type="checkbox"></th>`;
  header.forEach(col => headRow += `<th>${escapeHtml(col)}</th>`);
  headRow += `<th class="actions-col">Members</th>`;
  headRow += `<th class="actions-col">Actions</th>`;
  headRow += "</tr>";
  thead.innerHTML = headRow;

  const start = (currentPage - 1) * rowsPerPage;
  const slice = groupsArr.slice(start, start + rowsPerPage);
  const keyword = (document.getElementById("searchInput").value || "").trim();

  slice.forEach(group => {
    const head = group.head || {};
    const members = group.members || [];
    const memCount = members.length;

    const cls =
      memCount <= 1 ? "mem-small" :
      memCount <= 4 ? "mem-normal" :
      memCount <= 7 ? "mem-large" : "mem-critical";

    const tr = document.createElement("tr");
    tr.className = cls;

    // checkbox
    const tdSel = document.createElement("td");
    tdSel.className = "select-col";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.dataset.dataId = group.dataID;
    cb.className = "row-select";
    cb.checked = selectedIds.has(group.dataID);
    cb.addEventListener("change", onRowSelect);
    tdSel.appendChild(cb);
    tr.appendChild(tdSel);

    // columns
    header.forEach(col => {
      const td = document.createElement("td");
      let txt = head[col] ?? "";
      if (col === "No. of Household Member/s") {
        txt = `${txt} (+${memCount})`;
      }
      td.innerHTML = highlightText(txt, keyword);
      tr.appendChild(td);
    });

    // Members toggle
    const tdMem = document.createElement("td");
    tdMem.className = "actions-col";
    tdMem.innerHTML =
      `<button class="icon-btn" onclick="toggleMembers('${group.dataID}')">
         ▸ ${memCount} members
       </button>`;
    tr.appendChild(tdMem);

    // Actions
    const tdAct = document.createElement("td");
    tdAct.className = "actions-col";
    tdAct.innerHTML =
      `<button class="icon-btn" onclick="editRecord('${group.dataID}')">✏️</button>
       <button class="icon-btn" onclick="deleteRecord('${group.dataID}')">🗑️</button>`;
    tr.appendChild(tdAct);

    tbody.appendChild(tr);

    // ---- MEMBER ROWS ----
    members.forEach(m => {
      const mr = document.createElement("tr");
      mr.className = "member-row hidden";
      mr.dataset.parent = group.dataID;

      mr.appendChild(document.createElement("td")); // blank for select column

      header.forEach(col => {
        const td = document.createElement("td");
        td.innerHTML = highlightText(m[col] || "", keyword);
        mr.appendChild(td);
      });

      mr.appendChild(document.createElement("td"));
      mr.appendChild(document.createElement("td"));

      tbody.appendChild(mr);
    });
  });

  /* SELECT ALL */
  const selectAll = document.getElementById("selectAll");
  selectAll.checked = slice.every(g => selectedIds.has(g.dataID));
  selectAll.addEventListener("change", () => {
    slice.forEach(g => {
      if (selectAll.checked) selectedIds.add(g.dataID);
      else selectedIds.delete(g.dataID);
    });
    renderPage();
  });

  updateCounts();
}

/* ============================================================
   TOGGLE MEMBER ROWS
============================================================ */
function toggleMembers(id) {
  document.querySelectorAll(`tr.member-row[data-parent="${id}"]`)
    .forEach(r => r.classList.toggle("hidden"));
}

/* ============================================================
   PAGINATION
============================================================ */
function renderPagination() {
  const div = document.getElementById("paginationArea");
  const total = Math.max(1, Math.ceil(groupsArr.length / rowsPerPage));
  if (total <= 1) {
    div.innerHTML = "";
    return;
  }

  let html = `<button class="page-btn" onclick="changePage(${currentPage - 1})">⬅ Prev</button>`;
  for (let i = 1; i <= total; i++) {
    html += `<button class="page-btn ${i === currentPage ? "active" : ""}" onclick="changePage(${i})">${i}</button>`;
  }
  html += `<button class="page-btn" onclick="changePage(${currentPage + 1})">Next ➡</button>`;
  div.innerHTML = html;
}

function changePage(p) {
  const total = Math.ceil(groupsArr.length / rowsPerPage);
  if (p < 1 || p > total) return;
  currentPage = p;
  renderPage();
  renderPagination();
}

/* ============================================================
   COUNTERS
============================================================ */
function updateCounts() {
  document.getElementById("rowCount").innerText = groupsArr.length;
  document.getElementById("matchCount").innerText = groupsArr.length;
  document.getElementById("selectedCount").innerText = selectedIds.size;
}

function onRowSelect(e) {
  const id = e.target.dataset.dataId;
  if (e.target.checked) selectedIds.add(id);
  else selectedIds.delete(id);
  updateCounts();
}

/* ============================================================
   EDIT / DELETE
============================================================ */
function editRecord(id) {
  localStorage.setItem("edit_dataID", id);
  window.location.href = "edit.html";
}

async function deleteRecord(id) {
  if (!confirm("Delete household " + id + "?")) return;

  try {
    const res = await fetch(SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "deleteHousehold", dataID: id })
    });

    const data = JSON.parse(await res.text());
    alert(data.message || "Deleted");
    loadRecords();

  } catch (err) {
    alert("Delete failed");
  }
}

/* ============================================================
   EXPORT FUNCTIONS
============================================================ */
function groupsToCSV(groups) {
  const cols = header.slice();
  const csv = [];

  csv.push(cols.map(c => `"${c.replace(/"/g, '""')}"`).join(","));

  groups.forEach(g => {
    const h = g.head || {};
    csv.push(cols.map(c => `"${String(h[c] || "").replace(/"/g, '""')}"`).join(","));

    g.members.forEach(m => {
      csv.push(cols.map(c => `"${String(m[c] || "").replace(/"/g, '""')}"`).join(","));
    });
  });

  return csv.join("\r\n");
}

function downloadCSV(name, content) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();

  setTimeout(() => URL.revokeObjectURL(url), 500);
}

function exportAll() {
  if (!groupsArr.length) return alert("Nothing to export.");
  downloadCSV("mdrrmo_records_all.csv", groupsToCSV(groupsArr));
}

function exportSelected() {
  const selected = groupsArr.filter(g => selectedIds.has(g.dataID));
  if (!selected.length) return alert("No selected households.");
  downloadCSV("mdrrmo_records_selected.csv", groupsToCSV(selected));
}

/* ============================================================
   UI EVENTS
============================================================ */
document.getElementById("refreshBtn").onclick = loadRecords;

document.getElementById("filterBarangay").onchange = loadRecords;

let typingTimer;
document.getElementById("searchInput").addEventListener("input", () => {
  clearTimeout(typingTimer);
  typingTimer = setTimeout(loadRecords, 300);
});

/* EXPORT MENU */
const menuBtn = document.getElementById("exportMenuBtn");
const dropdown = document.getElementById("exportDropdown");

menuBtn.onclick = () => dropdown.classList.toggle("hidden");

document.addEventListener("click", e => {
  if (!menuBtn.contains(e.target) && !dropdown.contains(e.target)) {
    dropdown.classList.add("hidden");
  }
});

/* ============================================================
   INIT
============================================================ */
window.addEventListener("DOMContentLoaded", () => {
  document.getElementById("userName").innerText =
    localStorage.getItem("staffName") || "";

  loadRecords();
});
