(async function () {
  const $ = (s) => document.querySelector(s);

  function norm(s) {
    return (s ?? "")
      .toString()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  function escapeHtml(str) {
    return (str ?? "")
      .toString()
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function splitCSVLine(line) {
    const out = [];
    let cur = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];

      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }

      if (ch === "," && !inQuotes) {
        out.push(cur);
        cur = "";
        continue;
      }

      cur += ch;
    }
    out.push(cur);
    return out;
  }

  function parseCSV(text) {
    const lines = text.replace(/\r/g, "").split("\n").filter((l) => l.trim().length);
    if (!lines.length) return [];
    const header = splitCSVLine(lines[0]).map((h) => h.trim());
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = splitCSVLine(lines[i]);
      const obj = {};
      header.forEach((h, idx) => (obj[h] = (cols[idx] ?? "").trim()));
      rows.push(obj);
    }
    return rows;
  }

  function renderTable(rows) {
    const tbody = $("#tbody");
    const empty = $("#empty");
    const count = $("#count");

    tbody.innerHTML = "";
    count.textContent = `${rows.length} resultados`;

    if (!rows.length) {
      empty.style.display = "block";
      return;
    }
    empty.style.display = "none";

    for (const r of rows) {
      const no = r["No"] ?? r["NO"] ?? "";
      const des = r["DISEÑADOR"] ?? r["Diseñador"] ?? "";
      const frag = r["NOMBRE DE LA FRAGANCIA"] ?? r["Fragancia"] ?? r["NOMBRE"] ?? "";

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td class="des">${escapeHtml(des)}</td>
        <td>${escapeHtml(frag)}</td>
        <td class="no">${escapeHtml(no)}</td>
      `;
      tbody.appendChild(tr);
    }
  }

  function showNotice(msg, isError = false) {
    const n = $("#notice");
    n.textContent = msg;
    n.classList.toggle("error", isError);
    n.style.display = "block";
  }

  function hideNotice() {
    const n = $("#notice");
    n.style.display = "none";
    n.classList.remove("error");
    n.textContent = "";
  }

  let TABS = [];
  try {
    const res = await fetch("/data/tabs.json", { cache: "no-store" });
    TABS = await res.json();
  } catch (e) {
    showNotice("No se pudo cargar /data/tabs.json", true);
    return;
  }

  if (!TABS.length) {
    showNotice("No hay categorías configuradas.", true);
    return;
  }

  const tabsWrap = $("#tabs");
  tabsWrap.innerHTML = "";
  TABS.forEach((t, i) => {
    const btn = document.createElement("button");
    btn.className = "tab" + (i === 0 ? " active" : "");
    btn.dataset.tab = t.id;
    btn.setAttribute("role", "tab");
    btn.setAttribute("aria-selected", i === 0 ? "true" : "false");
    btn.textContent = t.label;
    btn.addEventListener("click", () => setActive(t.id));
    tabsWrap.appendChild(btn);
  });

  let activeTab = TABS[0].id;
  let currentRows = [];

  async function loadTab(tabId) {
    const tab = TABS.find((t) => t.id === tabId);
    if (!tab) return;

    $("#sectionTitle").textContent = tab.label;
    $("#pillActive").textContent = `${tab.label}: ${tab.count ?? "…"} items`;

    hideNotice();
    $("#loading").style.display = "inline-flex";

    try {
      const res = await fetch(tab.file, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      currentRows = parseCSV(text);
      $("#pillLoaded").textContent = `Cargados: ${currentRows.length}`;
    } catch (e) {
      currentRows = [];
      showNotice(`No se pudo cargar ${tab.file}.`, true);
    } finally {
      $("#loading").style.display = "none";
    }

    applyFilter();
  }

  function applyFilter() {
    const q = norm($("#q").value.trim());
    if (!q) return renderTable(currentRows);

    const filtered = currentRows.filter((r) => {
      const no = r["No"] ?? r["NO"] ?? "";
      const des = r["DISEÑADOR"] ?? r["Diseñador"] ?? "";
      const frag = r["NOMBRE DE LA FRAGANCIA"] ?? r["Fragancia"] ?? r["NOMBRE"] ?? "";
      const blob = norm(`${no} ${des} ${frag}`);
      return blob.includes(q);
    });

    renderTable(filtered);
  }

  function setActive(tabId) {
    activeTab = tabId;
    document.querySelectorAll(".tab").forEach((b) => {
      const on = b.dataset.tab === tabId;
      b.classList.toggle("active", on);
      b.setAttribute("aria-selected", on ? "true" : "false");
    });
    loadTab(activeTab);
    $("#q").focus();
  }

  $("#q").addEventListener("input", applyFilter);

  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      $("#q").focus();
    }
  });

  setActive(activeTab);
})();
