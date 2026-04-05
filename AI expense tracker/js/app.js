const CATEGORIES = [
  { id: "food", label: "Food & dining", color: "#fbbf24" },
  { id: "transport", label: "Transport", color: "#60a5fa" },
  { id: "shopping", label: "Shopping", color: "#c084fc" },
  { id: "bills", label: "Bills & housing", color: "#f472b6" },
  { id: "entertainment", label: "Entertainment", color: "#fb923c" },
  { id: "health", label: "Health", color: "#4ade80" },
  { id: "other", label: "Other", color: "#94a3b8" },
];

const KEYWORDS = {
  food: [
    "restaurant", "cafe", "coffee", "starbucks", "lunch", "dinner", "breakfast",
    "uber eats", "doordash", "grubhub", "grocery", "whole foods", "trader",
    "pizza", "burger", "sushi", "food", "meal", "bakery", "bar", "pub",
  ],
  transport: [
    "uber", "lyft", "taxi", "cab", "gas", "fuel", "parking", "metro", "bus",
    "train", "flight", "airline", "car", "toll", "transit", "commute",
  ],
  shopping: [
    "amazon", "target", "walmart", "mall", "store", "clothes", "shoes",
    "electronics", "purchase", "online", "retail",
  ],
  bills: [
    "rent", "mortgage", "electric", "water", "internet", "wifi", "phone",
    "insurance", "subscription", "netflix", "spotify", "utility", "hoa",
  ],
  entertainment: [
    "movie", "cinema", "theater", "concert", "game", "streaming", "hobby",
    "sports ticket", "event", "music",
  ],
  health: [
    "pharmacy", "doctor", "hospital", "dental", "gym", "fitness", "medical",
    "clinic", "prescription", "vitamin", "therapy",
  ],
};

function normalizeCategorizeText(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function scoreCategory(catId, normalized) {
  const words = KEYWORDS[catId];
  if (!words) return 0;
  let score = 0;
  for (const kw of words) {
    const k = kw.toLowerCase();
    if (normalized === k) {
      score += 5;
      continue;
    }
    if (normalized.includes(k)) {
      const boundary = new RegExp(`\\b${escapeRe(k)}\\b`);
      score += boundary.test(normalized) ? 4 : 2;
    }
  }
  return score;
}

function categorizeExpense(description) {
  const n = normalizeCategorizeText(description);
  if (!n) return { categoryId: "other", confidence: "low" };

  let best = "other";
  let bestScore = 0;
  for (const cat of Object.keys(KEYWORDS)) {
    const s = scoreCategory(cat, n);
    if (s > bestScore) {
      bestScore = s;
      best = cat;
    }
  }
  let confidence = "low";
  if (bestScore >= 5) confidence = "high";
  else if (bestScore >= 2) confidence = "medium";
  return { categoryId: best, confidence };
}

function categoryLabel(id) {
  const c = CATEGORIES.find((x) => x.id === id);
  return c ? c.label : "Other";
}

function categoryColor(id) {
  const c = CATEGORIES.find((x) => x.id === id);
  return c ? c.color : "#94a3b8";
}

const STORAGE_KEY = "ai-expense-tracker-v1";
const BUDGET_KEY = "ai-expense-tracker-budgets-v1";
const CURRENCY_KEY = "ai-expense-tracker-currency-v1";

/** ISO 4217 codes — amounts are still numbers; only the symbol/format changes. */
const CURRENCY_CHOICES = [
  "USD", "EUR", "GBP", "INR", "NGN", "GHS", "XOF", "XAF", "CAD", "AUD", "JPY", "CHF", "CNY",
  "MXN", "BRL", "ZAR", "KES", "AED", "SAR", "HKD", "SGD", "NZD",
  "SEK", "NOK", "DKK", "PLN", "TRY", "PHP", "IDR", "MYR", "THB",
];

/** Shown as native tooltips on the currency control and each option (hover). */
const CURRENCY_NAMES = {
  USD: "United States dollar",
  EUR: "Euro",
  GBP: "Pound sterling",
  INR: "Indian rupee",
  NGN: "Nigerian naira",
  GHS: "Ghanaian cedi",
  XOF: "West African CFA franc",
  XAF: "Central African CFA franc",
  CAD: "Canadian dollar",
  AUD: "Australian dollar",
  JPY: "Japanese yen",
  CHF: "Swiss franc",
  CNY: "Chinese yuan",
  MXN: "Mexican peso",
  BRL: "Brazilian real",
  ZAR: "South African rand",
  KES: "Kenyan shilling",
  AED: "United Arab Emirates dirham",
  SAR: "Saudi riyal",
  HKD: "Hong Kong dollar",
  SGD: "Singapore dollar",
  NZD: "New Zealand dollar",
  SEK: "Swedish krona",
  NOK: "Norwegian krone",
  DKK: "Danish krone",
  PLN: "Polish złoty",
  TRY: "Turkish lira",
  PHP: "Philippine peso",
  IDR: "Indonesian rupiah",
  MYR: "Malaysian ringgit",
  THB: "Thai baht",
};

function currencyFullName(code) {
  const u = String(code || "").toUpperCase();
  return CURRENCY_NAMES[u] || u;
}

function updateCurrencySelectTitle(sel) {
  if (!sel) return;
  sel.title = currencyFullName(sel.value || currencyCode);
}

/** @type {{ id: string, amount: number, description: string, date: string, categoryId: string }[]} */
let expenses = [];
/** @type {Record<string, number>} */
let budgets = {};
/** @type {string} */
let currencyCode = "USD";

let pieChart = null;

function loadCurrency() {
  try {
    const c = localStorage.getItem(CURRENCY_KEY);
    if (c && /^[A-Z]{3}$/i.test(c)) currencyCode = c.toUpperCase();
  } catch {
    currencyCode = "USD";
  }
  if (!/^[A-Z]{3}$/.test(currencyCode)) currencyCode = "USD";
}

function persistCurrency() {
  localStorage.setItem(CURRENCY_KEY, currencyCode);
}

function ensureCurrencyOption(select, code) {
  if (!code || !/^[A-Z]{3}$/.test(code)) return;
  if (Array.from(select.options).some((o) => o.value === code)) return;
  const o = document.createElement("option");
  o.value = code;
  o.textContent = code;
  o.title = currencyFullName(code);
  select.appendChild(o);
}

function setupCurrency() {
  const sel = document.getElementById("currency-select");
  sel.innerHTML = "";
  for (const code of CURRENCY_CHOICES) {
    const o = document.createElement("option");
    o.value = code;
    o.textContent = code;
    o.title = currencyFullName(code);
    sel.appendChild(o);
  }
  ensureCurrencyOption(sel, currencyCode);
  sel.value = currencyCode;
  if (sel.value !== currencyCode) {
    currencyCode = "USD";
    sel.value = "USD";
  }
  updateCurrencySelectTitle(sel);
  sel.addEventListener("change", () => {
    currencyCode = (sel.value || "USD").toUpperCase();
    if (!/^[A-Z]{3}$/.test(currencyCode)) currencyCode = "USD";
    updateCurrencySelectTitle(sel);
    persistCurrency();
    render();
  });
}

function applyCurrencyFromImport(code) {
  if (!code || typeof code !== "string") return;
  const c = code.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(c)) return;
  currencyCode = c;
  persistCurrency();
  const sel = document.getElementById("currency-select");
  if (sel) {
    ensureCurrencyOption(sel, currencyCode);
    sel.value = currencyCode;
    updateCurrencySelectTitle(sel);
  }
}

function load() {
  loadCurrency();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) expenses = JSON.parse(raw);
  } catch {
    expenses = [];
  }
  try {
    const br = localStorage.getItem(BUDGET_KEY);
    if (br) budgets = JSON.parse(br);
  } catch {
    budgets = {};
  }
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(expenses));
  localStorage.setItem(BUDGET_KEY, JSON.stringify(budgets));
}

function uid() {
  return crypto.randomUUID ? crypto.randomUUID() : `e-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function monthKey(isoDate) {
  return isoDate.slice(0, 7);
}

function currentMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function fillCategorySelects() {
  const sel = document.getElementById("category-select");
  const filter = document.getElementById("filter-category");
  sel.innerHTML = "";
  filter.innerHTML = '<option value="">All</option>';
  for (const c of CATEGORIES) {
    const o = document.createElement("option");
    o.value = c.id;
    o.textContent = c.label;
    sel.appendChild(o.cloneNode(true));
    filter.appendChild(o);
  }
}

function setupForm() {
  const form = document.getElementById("expense-form");
  const dateInput = form.querySelector('[name="date"]');
  const descInput = form.querySelector('[name="description"]');
  const catSelect = document.getElementById("category-select");
  const hint = document.getElementById("ai-hint");

  dateInput.valueAsDate = new Date();

  function updateHint() {
    const { categoryId, confidence } = categorizeExpense(descInput.value);
    catSelect.value = categoryId;
    const label = categoryLabel(categoryId);
    if (!descInput.value.trim()) {
      hint.textContent = "";
      return;
    }
    const confText =
      confidence === "high" ? "Strong match" : confidence === "medium" ? "Likely" : "Best guess";
    hint.textContent = `${confText}: ${label}`;
  }

  descInput.addEventListener("input", updateHint);
  descInput.addEventListener("blur", updateHint);

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const amount = parseFloat(fd.get("amount"));
    const description = String(fd.get("description") || "").trim();
    const date = fd.get("date") || new Date().toISOString().slice(0, 10);
    let categoryId = fd.get("category") || categorizeExpense(description).categoryId;

    if (!description || !Number.isFinite(amount) || amount <= 0) return;

    expenses.unshift({
      id: uid(),
      amount,
      description,
      date,
      categoryId,
    });
    save();
    form.reset();
    dateInput.valueAsDate = new Date();
    hint.textContent = "";
    updateHint();
    render();
  });
}

function setupFilters() {
  document.getElementById("filter-month").value = currentMonthKey();
  document.getElementById("filter-month").addEventListener("change", render);
  document.getElementById("filter-category").addEventListener("change", render);
}

function filteredExpenses() {
  const month = document.getElementById("filter-month").value || currentMonthKey();
  const cat = document.getElementById("filter-category").value;
  return expenses.filter((e) => {
    if (monthKey(e.date) !== month) return false;
    if (cat && e.categoryId !== cat) return false;
    return true;
  });
}

function monthTotalForKey(month) {
  return expenses
    .filter((e) => monthKey(e.date) === month)
    .reduce((s, e) => s + e.amount, 0);
}

function totalsByCategory(month) {
  const map = {};
  for (const c of CATEGORIES) map[c.id] = 0;
  for (const e of expenses) {
    if (monthKey(e.date) !== month) continue;
    const id = e.categoryId in map ? e.categoryId : "other";
    map[id] += e.amount;
  }
  return map;
}

function renderStats(month) {
  const total = monthTotalForKey(month);
  document.getElementById("stat-month-total").textContent = formatMoney(total);

  const monthBudget = CATEGORIES.reduce((s, c) => s + (budgets[c.id] || 0), 0);
  const left = monthBudget - total;
  const el = document.getElementById("stat-budget-left");
  el.textContent = formatMoney(left);
  el.style.color = left < 0 ? "var(--danger)" : "var(--accent)";

  const byCat = totalsByCategory(month);
  let top = null;
  let topVal = 0;
  for (const [id, v] of Object.entries(byCat)) {
    if (v > topVal) {
      topVal = v;
      top = id;
    }
  }
  document.getElementById("stat-top-cat").textContent =
    top && topVal > 0 ? categoryLabel(top) : "—";
}

function formatMoney(n) {
  const code = currencyCode || "USD";
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: code,
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 2,
    }).format(n);
  }
}

function renderBudgetGrid() {
  const grid = document.getElementById("budget-grid");
  grid.innerHTML = "";
  for (const c of CATEGORIES) {
    if (c.id === "other") continue;
    const wrap = document.createElement("div");
    wrap.className = "budget-grid__item";
    const lab = document.createElement("label");
    lab.textContent = c.label;
    const input = document.createElement("input");
    input.type = "number";
    input.min = "0";
    input.step = "1";
    input.placeholder = "0";
    input.value = budgets[c.id] != null ? String(budgets[c.id]) : "";
    input.dataset.cat = c.id;
    input.addEventListener("change", () => {
      const v = parseFloat(input.value);
      if (Number.isFinite(v) && v >= 0) budgets[c.id] = v;
      else delete budgets[c.id];
      save();
      render();
    });
    wrap.appendChild(lab);
    wrap.appendChild(input);
    grid.appendChild(wrap);
  }
}

function renderBudgetBars(month) {
  const container = document.getElementById("budget-bars");
  container.innerHTML = "";
  const spent = totalsByCategory(month);

  for (const c of CATEGORIES) {
    if (c.id === "other" && !(budgets.other > 0) && !spent.other) continue;
    const cap = budgets[c.id] || 0;
    const s = spent[c.id] || 0;
    if (cap <= 0 && s <= 0) continue;

    const row = document.createElement("div");
    row.className = "budget-bar__row";

    const name = document.createElement("span");
    name.className = "budget-bar__name";
    name.textContent = c.label;
    name.title = c.label;

    const track = document.createElement("div");
    track.className = "budget-bar__track";
    const fill = document.createElement("div");
    fill.className = "budget-bar__fill";
    const pct = cap > 0 ? Math.min(100, (s / cap) * 100) : s > 0 ? 100 : 0;
    fill.style.width = `${pct}%`;
    fill.classList.add(cap > 0 && s > cap ? "budget-bar__fill--over" : "budget-bar__fill--ok");
    fill.style.background =
      cap > 0 && s > cap
        ? undefined
        : `linear-gradient(90deg, ${categoryColor(c.id)}aa, ${categoryColor(c.id)})`;
    track.appendChild(fill);

    const nums = document.createElement("span");
    nums.className = "budget-bar__nums";
    nums.textContent =
      cap > 0 ? `${formatMoney(s)} / ${formatMoney(cap)}` : formatMoney(s);

    row.appendChild(name);
    row.appendChild(track);
    row.appendChild(nums);
    container.appendChild(row);
  }

  if (!container.children.length) {
    const p = document.createElement("p");
    p.className = "empty-state";
    p.style.padding = "1rem";
    p.textContent = "Set budgets above to compare spending.";
    container.appendChild(p);
  }
}

function renderPie(month) {
  const spent = totalsByCategory(month);
  const labels = [];
  const data = [];
  const colors = [];
  for (const c of CATEGORIES) {
    const v = spent[c.id] || 0;
    if (v > 0) {
      labels.push(c.label);
      data.push(v);
      colors.push(c.color);
    }
  }

  const ctx = document.getElementById("chart-pie");
  if (pieChart) {
    pieChart.destroy();
    pieChart = null;
  }

  if (!data.length) {
    const parent = ctx.parentElement;
    let empty = parent.querySelector(".chart-empty");
    if (!empty) {
      empty = document.createElement("p");
      empty.className = "chart-empty empty-state";
      empty.style.padding = "2rem 0";
      empty.textContent = "No spending this month.";
      parent.appendChild(empty);
    }
    return;
  }
  const parent = ctx.parentElement;
  const empty = parent.querySelector(".chart-empty");
  if (empty) empty.remove();

  pieChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels,
      datasets: [
        {
          data,
          backgroundColor: colors,
          borderWidth: 0,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          position: "bottom",
          labels: { color: "#8b93a7", boxWidth: 12, padding: 12 },
        },
      },
    },
  });
}

function renderTable(list) {
  const tbody = document.getElementById("expense-tbody");
  const empty = document.getElementById("empty-state");
  tbody.innerHTML = "";

  if (!list.length) {
    empty.classList.remove("hidden");
    return;
  }
  empty.classList.add("hidden");

  for (const e of list) {
    const tr = document.createElement("tr");
    const cat = categoryLabel(e.categoryId);
    const col = categoryColor(e.categoryId);
    tr.innerHTML = `
      <td>${escapeHtml(e.date)}</td>
      <td>${escapeHtml(e.description)}</td>
      <td><span class="cat-pill" style="background:${col}22;color:${col}">${escapeHtml(cat)}</span></td>
      <td class="table__num">${formatMoney(e.amount)}</td>
      <td><button type="button" class="btn btn--danger" data-del="${escapeHtml(e.id)}">Remove</button></td>
    `;
    tbody.appendChild(tr);
  }

  tbody.querySelectorAll("[data-del]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-del");
      expenses = expenses.filter((x) => x.id !== id);
      save();
      render();
    });
  });
}

function escapeHtml(s) {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

function render() {
  const month =
    document.getElementById("filter-month").value || currentMonthKey();
  renderStats(month);
  renderBudgetGrid();
  renderBudgetBars(month);
  renderPie(month);
  renderTable(filteredExpenses());
}

function setupImportExport() {
  document.getElementById("btn-export").addEventListener("click", () => {
    const blob = new Blob(
      [
        JSON.stringify(
          {
            expenses,
            budgets,
            currency: currencyCode,
            exportedAt: new Date().toISOString(),
          },
          null,
          2
        ),
      ],
      { type: "application/json" }
    );
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `expense-backup-${currentMonthKey()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  });

  document.getElementById("import-file").addEventListener("change", (ev) => {
    const file = ev.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result));
        if (Array.isArray(data)) expenses = data;
        else if (Array.isArray(data.expenses)) expenses = data.expenses;
        if (data && typeof data === "object" && !Array.isArray(data) && data.budgets && typeof data.budgets === "object")
          budgets = data.budgets;
        if (data && typeof data === "object" && !Array.isArray(data) && data.currency) applyCurrencyFromImport(data.currency);
        save();
        render();
      } catch {
        alert("Could not read that file.");
      }
      ev.target.value = "";
    };
    reader.readAsText(file);
  });
}

load();
fillCategorySelects();
setupCurrency();
setupForm();
setupFilters();
setupImportExport();
render();
