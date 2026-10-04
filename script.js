// ========================================================
// おかいもの予算メモ
// ・現在のお買い物の保存
// ・過去のお買い物履歴
// ・履歴詳細表示
// ・CSVダウンロード
// ========================================================


// --------------------------------------------------------
// 保存に使う名前
// --------------------------------------------------------

// 現在進行中のお買い物
const STORAGE_KEY = "okaimono-yosan-memo-v1";

// 完了したお買い物の履歴
const HISTORY_STORAGE_KEY = "okaimono-shopping-history-v1";


// --------------------------------------------------------
// アプリの状態
// --------------------------------------------------------

const state = loadState();

let editingId = null;
let toastTimer;

// 履歴画面を開く前にどの画面にいたか
let screenBeforeHistory =
  state.screen === "history" ? "budget" : state.screen;


// --------------------------------------------------------
// 画面
// --------------------------------------------------------

const screens = {
  budget: document.querySelector("#budget-screen"),
  shopping: document.querySelector("#shopping-screen"),
  result: document.querySelector("#result-screen"),
  history: document.querySelector("#history-screen")
};


const budgetInput = document.querySelector("#budget-input");
const purchaseDisplay = document.querySelector("#purchase-display");
const memoInput = document.querySelector("#memo-input");
const memoCount = document.querySelector("#memo-count");

memoInput.value = state.memo;
updateMemo();

function updateMemo() {
  // maxlengthと同じUTF-16の文字数で、音声入力にも上限を適用します。
  memoInput.value = memoInput.value.slice(0, 200);
  state.memo = memoInput.value;
  memoCount.textContent = `${state.memo.length} / 200`;
}

memoInput.addEventListener("input", () => {
  updateMemo();
  saveState();
});


// ========================================================
// 現在のお買い物データ
// ========================================================

function loadState() {

  try {

    const saved = JSON.parse(
      localStorage.getItem(STORAGE_KEY)
    );

    if (
      saved &&
      Number.isFinite(saved.budget) &&
      Array.isArray(saved.purchases)
    ) {

      return {

        budget: saved.budget,
        memo: typeof saved.memo === "string" ? saved.memo.slice(0, 200) : "",

        purchases: saved.purchases.filter(
          item =>
            Number.isFinite(item.amount) &&
            item.amount > 0
        ),

        screen:
          ["budget", "shopping", "result", "history"]
            .includes(saved.screen)
            ? saved.screen
            : "budget",

        // 今回のお買い物が保存された履歴ID
        currentHistoryId:
          saved.currentHistoryId ?? null
      };
    }

  } catch (error) {

    console.warn(
      "保存データを読み込めませんでした。",
      error
    );
  }


  return {
    budget: 0,
    memo: "",
    purchases: [],
    screen: "budget",
    currentHistoryId: null
  };
}


function saveState() {

  try {

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(state)
    );

  } catch (error) {

    showToast(
      "このブラウザーではデータを保存できませんでした"
    );
  }
}


// ========================================================
// 過去のお買い物履歴
// ========================================================

function loadShoppingHistory() {

  try {

    const saved = JSON.parse(
      localStorage.getItem(HISTORY_STORAGE_KEY)
    );

    if (!Array.isArray(saved)) {
      return [];
    }

    return saved.filter(history => {

      return (
        history &&
        typeof history === "object" &&
        !Array.isArray(history)
      );

    }).map(history => {
      const purchases = Array.isArray(history.purchases)
        ? history.purchases.filter(item => item && typeof item === "object") : [];
      const budget = Number.isFinite(history.budget) ? history.budget : 0;
      const spent = Number.isFinite(history.spent) ? history.spent
        : purchases.reduce((sum, item) => sum + (Number.isFinite(item.amount) ? item.amount : 0), 0);
      return { ...history, budget, purchases, spent,
        remaining: Number.isFinite(history.remaining) ? history.remaining : budget - spent };
    });

  } catch (error) {

    console.warn(
      "お買い物履歴を読み込めませんでした。",
      error
    );

    return [];
  }
}


function saveShoppingHistory(histories) {

  try {

    localStorage.setItem(
      HISTORY_STORAGE_KEY,
      JSON.stringify(histories)
    );
    return true;

  } catch (error) {

    showToast(
      "お買い物履歴を保存できませんでした"
    );
    return false;
  }
}


// ========================================================
// 金額計算
// ========================================================

function totalSpent() {

  return state.purchases.reduce(
    (sum, item) => sum + item.amount,
    0
  );
}


function yen(amount) {

  return `${Math.round(amount)
    .toLocaleString("ja-JP")}円`;
}


// ========================================================
// 画面切り替え
// ========================================================

function showScreen(name) {

  const targetScreen = screens[name];

  if (!targetScreen) {

    console.warn(
      `${name} 画面がHTMLにありません。`
    );

    return;
  }


  state.screen = name;


  Object.entries(screens)
    .forEach(([key, screen]) => {

      if (!screen) return;

      screen.hidden = key !== name;

    });


  // 上部の「1 予算 → 2 お買い物 → 3 結果」
  const normalSteps = [
    "budget",
    "shopping",
    "result"
  ];


  document.querySelectorAll(".step")
    .forEach(step => {

      if (name === "history") {

        step.classList.remove("is-current");
        step.classList.remove("is-done");

        return;
      }


      const currentIndex =
        normalSteps.indexOf(name);

      const stepIndex =
        normalSteps.indexOf(
          step.dataset.step
        );


      step.classList.toggle(
        "is-current",
        step.dataset.step === name
      );


      step.classList.toggle(
        "is-done",
        stepIndex < currentIndex
      );

    });


  saveState();


  if (name === "shopping") {
    renderShopping();
  }


  if (name === "result") {
    renderResult();
  }


  if (name === "history") {
    renderHistory();
  }


  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}


// ========================================================
// お買い物画面
// ========================================================

function renderShopping() {

  const spent = totalSpent();

  const remaining =
    state.budget - spent;


  document.querySelector(
    "#shopping-budget"
  ).textContent =
    yen(state.budget);


  document.querySelector(
    "#shopping-spent"
  ).textContent =
    yen(spent);


  document.querySelector(
    "#shopping-remaining"
  ).textContent =
    yen(remaining);


  const percent =
    state.budget > 0
      ? Math.min(
          100,
          Math.max(
            0,
            spent / state.budget * 100
          )
        )
      : 0;


  document.querySelector(
    "#budget-progress"
  ).style.width =
    `${percent}%`;


  document.querySelector(
    ".progress-track"
  ).setAttribute(
    "aria-valuenow",
    String(Math.round(percent))
  );


  const list =
    document.querySelector(
      "#purchase-list"
    );


  list.replaceChildren();


  document.querySelector(
    "#purchase-count-label"
  ).textContent =
    `${state.purchases.length}件`;


  document.querySelector(
    "#empty-history"
  ).hidden =
    state.purchases.length > 0;


  state.purchases.forEach(
    (purchase, index) => {

      const item =
        document.createElement("li");

      item.className =
        "purchase-item";


      const main =
        document.createElement("div");

      main.className =
        "purchase-item-main";


      const number =
        document.createElement("span");

      number.className =
        "purchase-index";

      number.textContent =
        `${index + 1}`.padStart(
          2,
          "0"
        );


      const amount =
        document.createElement("strong");

      amount.className =
        "purchase-price";

      amount.textContent =
        yen(purchase.amount);


      main.append(
        number,
        amount
      );


      const controls =
        document.createElement("div");

      controls.className =
        "purchase-controls";


      const edit =
        document.createElement("button");

      edit.type = "button";

      edit.className =
        "small-button";

      edit.textContent =
        "編集";

      edit.setAttribute(
        "aria-label",
        `${yen(purchase.amount)}を編集`
      );

      edit.addEventListener(
        "click",
        () => beginEdit(purchase.id)
      );


      const remove =
        document.createElement("button");

      remove.type = "button";

      remove.className =
        "small-button delete";

      remove.textContent =
        "削除";

      remove.setAttribute(
        "aria-label",
        `${yen(purchase.amount)}を削除`
      );

      remove.addEventListener(
        "click",
        () => deletePurchase(
          purchase.id
        )
      );


      controls.append(
        edit,
        remove
      );


      item.append(
        main,
        controls
      );


      list.append(item);
    }
  );
}


// ========================================================
// 結果画面
// ========================================================

function renderResult() {

  const spent =
    totalSpent();

  const remaining =
    state.budget - spent;


  document.querySelector(
    "#result-budget"
  ).textContent =
    yen(state.budget);


  document.querySelector(
    "#result-spent"
  ).textContent =
    yen(spent);


  document.querySelector(
    "#result-remaining"
  ).textContent =
    yen(remaining);


  document.querySelector(
    "#result-count"
  ).textContent =
    `${state.purchases.length}回`;


  const message =
    remaining < 0

      ? `予算を${yen(
          Math.abs(remaining)
        )}オーバーしました。次のお買い物の目安にしてみましょう。`

      : remaining === 0

        ? "予算ぴったり！上手にお買い物できました。"

        : "予算内でお買い物できました。おつかれさまでした！";


  document.querySelector(
    "#result-message"
  ).textContent =
    message;
}


// ========================================================
// ① 買い物終了時に履歴として保存
// ========================================================

function saveCurrentShoppingToHistory() {

  if (state.budget <= 0) {
    return;
  }


  const histories =
    loadShoppingHistory();


  const spent =
    totalSpent();

  const remaining =
    state.budget - spent;


  const now =
    new Date();


  const dateText =
    new Intl.DateTimeFormat(
      "ja-JP",
      {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit"
      }
    ).format(now);


  // すでに一度保存されている場合
  // 同じ履歴を更新します
  const existingIndex =
    histories.findIndex(
      history =>
        history.id ===
        state.currentHistoryId
    );


  const historyData = {

    id:
      state.currentHistoryId ??
      createId(),

    date:
      existingIndex >= 0
        ? histories[
            existingIndex
          ].date
        : dateText,

    updatedAt:
      now.toISOString(),

    budget:
      state.budget,

    purchases:
      state.purchases.map(
        purchase => ({
          id: purchase.id,
          amount: purchase.amount,
          ...(typeof purchase.name === "string" ? { name: purchase.name } : {})
        })
      ),

    spent,

    remaining,
    memo: state.memo
  };


  // すでに履歴がある場合は更新
  if (existingIndex >= 0) {

    histories[
      existingIndex
    ] = historyData;

  } else {

    // 新しい履歴として追加
    histories.push(
      historyData
    );

  }


  state.currentHistoryId =
    historyData.id;


  saveShoppingHistory(
    histories
  );

  saveState();
}


// ========================================================
// ② 過去履歴表示
// ========================================================

function renderHistory() {

  const histories =
    loadShoppingHistory()
      .slice()
      .reverse();


  const list =
    document.querySelector(
      "#saved-history-list"
    );


  const empty =
    document.querySelector(
      "#empty-saved-history"
    );


  const count =
    document.querySelector(
      "#saved-history-count"
    );


  if (!list) {
    return;
  }


  list.replaceChildren();


  if (count) {

    count.textContent =
      `${histories.length}件`;
  }


  if (empty) {

    empty.hidden =
      histories.length > 0;
  }


  histories.forEach(
    (history, displayIndex) => {

      const card =
        document.createElement(
          "article"
        );


      // 既存の結果カードのデザインも利用します
      card.className =
        "result-card history-card";


      // 日付
      const title =
        document.createElement(
          "h3"
        );

      title.textContent =
        history.date;


      // 予算
      const budgetRow =
        createHistoryRow(
          "今回の予算",
          yen(history.budget)
        );


      // 使用金額
      const spentRow =
        createHistoryRow(
          "使った金額",
          yen(history.spent)
        );


      // 残額
      const remainingRow =
        createHistoryRow(
          "残った金額",
          yen(history.remaining)
        );


      // 購入回数
      const countRow =
        createHistoryRow(
          "購入回数",
          `${history.purchases.length}回`
        );


      card.append(
        title,
        budgetRow,
        spentRow,
        remainingRow,
        countRow
      );


      // --------------------------------
      // ③ 詳細表示
      // --------------------------------

      if (typeof history.memo === "string" && history.memo.trim()) {
        const memo = document.createElement("div");
        memo.className = "history-memo";
        const label = document.createElement("strong");
        label.textContent = "メモ";
        const text = document.createElement("p");
        text.textContent = history.memo;
        memo.append(label, text);
        card.append(memo);
      }

      const details =
        document.createElement(
          "details"
        );


      details.className =
        "history-details";


      const summary =
        document.createElement(
          "summary"
        );

      summary.textContent =
        "購入の詳細を見る";


      details.append(
        summary
      );


      if (
        history.purchases.length === 0
      ) {

        const text =
          document.createElement("p");

        text.textContent =
          "購入記録はありません。";

        details.append(text);

      } else {

        const purchaseList =
          document.createElement(
            "ul"
          );

        purchaseList.className =
          "purchase-list";


        history.purchases.forEach(
          (purchase, index) => {

            const item =
              document.createElement(
                "li"
              );

            item.className =
              "purchase-item";


            const number =
              document.createElement(
                "span"
              );

            number.className =
              "purchase-index";

            number.textContent =
              `${index + 1}`.padStart(
                2,
                "0"
              );


            const amount =
              document.createElement(
                "strong"
              );

            amount.className =
              "purchase-price";

            amount.textContent =
              yen(purchase.amount);


            item.append(
              number,
              amount
            );
            if (typeof purchase.name === "string" && purchase.name) {
              const name = document.createElement("span");
              name.className = "history-purchase-name";
              name.textContent = purchase.name;
              item.append(name);
            }


            purchaseList.append(
              item
            );
          }
        );


        details.append(
          purchaseList
        );
      }


      card.append(details);

      const actions = document.createElement("div");
      actions.className = "history-actions";
      const historyIndex = histories.length - 1 - displayIndex;
      actions.append(
        historyAction("編集", () => editShoppingHistory(card, history, historyIndex)),
        historyAction("削除", () => {
          if (!window.confirm("この買い物履歴を削除しますか？")) return;
          if (updateShoppingHistory(historyIndex, history, null)) {
            renderHistory();
            showToast("買い物履歴を削除しました");
          }
        }, "small-button delete")
      );
      card.append(actions);

      list.append(card);
    }
  );
}


function historyAction(text, action, className = "small-button") {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  button.textContent = text;
  button.addEventListener("click", action);
  return button;
}

// 元の配列の位置で更新し、IDがない古い履歴も個別に扱います。
function updateShoppingHistory(index, original, updated) {
  try {
    const records = JSON.parse(localStorage.getItem(HISTORY_STORAGE_KEY));
    const positions = Array.isArray(records) ? records.flatMap((item, position) =>
      item && typeof item === "object" && !Array.isArray(item) ? [position] : []) : [];
    const current = loadShoppingHistory()[index];
    if (!current || JSON.stringify(current) !== JSON.stringify(original)) {
      showToast("履歴が変更されています。開き直してお試しください");
      return false;
    }
    const position = positions[index];
    if (updated) records[position] = { ...records[position], ...updated };
    else records.splice(position, 1);
    if (!saveShoppingHistory(records)) return false;

    // 今回の履歴を再度「買い物を終える」で上書きしないよう同期します。
    if (original.id != null && original.id === state.currentHistoryId) {
      if (updated) {
        state.budget = updated.budget;
        state.purchases = updated.purchases.map(item => ({ ...item }));
        memoInput.value = updated.memo;
        updateMemo();
        setEditing(null);
      } else {
        state.currentHistoryId = null;
      }
      saveState();
    }
    return true;
  } catch (error) {
    showToast("お買い物履歴を更新できませんでした");
    return false;
  }
}

function editShoppingHistory(card, history, index) {
  const form = document.createElement("form");
  form.className = "history-editor";
  form.noValidate = true;
  const title = document.createElement("h3");
  title.textContent = `${history.date ?? ""} の編集`;
  form.append(title);

  function field(labelText, type, value, parent = form) {
    const label = document.createElement("label");
    label.className = "field-label";
    const caption = document.createElement("span");
    caption.textContent = labelText;
    const input = document.createElement(type === "textarea" ? "textarea" : "input");
    if (type !== "textarea") input.type = type;
    input.value = value;
    if (type === "number") {
      input.min = "1";
      input.step = "1";
      input.inputMode = "numeric";
    }
    label.append(caption, input);
    parent.append(label);
    return input;
  }

  const budget = field("予算（円）", "number", history.budget);
  const purchaseList = document.createElement("div");
  form.append(purchaseList);
  const rows = [];
  const totals = document.createElement("p");
  totals.className = "history-edit-totals";
  const error = document.createElement("p");
  error.className = "error-message";
  error.setAttribute("role", "alert");

  function recalculate() {
    const spent = rows.reduce((sum, row) => sum + (Number(row.amount.value) || 0), 0);
    totals.textContent = `使った金額：${yen(spent)} ／ 残った金額：${yen(Number(budget.value) - spent)} ／ 購入回数：${rows.length}回`;
  }

  function addRow(purchase = {}) {
    const container = document.createElement("div");
    container.className = "history-edit-purchase";
    const name = field("購入内容（任意）", "text", purchase.name ?? "", container);
    const amount = field("購入金額（円）", "number", purchase.amount ?? "", container);
    const row = { container, name, amount, original: { ...purchase } };
    rows.push(row);
    amount.addEventListener("input", recalculate);
    container.append(historyAction("この明細を削除", () => {
      rows.splice(rows.indexOf(row), 1);
      container.remove();
      recalculate();
    }, "small-button delete"));
    purchaseList.append(container);
    recalculate();
  }

  history.purchases.forEach(addRow);
  form.append(historyAction("購入明細を追加", () => addRow()));
  const memo = field("メモ（200文字以内）", "textarea", typeof history.memo === "string" ? history.memo : "");
  memo.maxLength = 200;
  memo.rows = 4;
  const counter = document.createElement("p");
  counter.className = "memo-count";
  function countMemo() { counter.textContent = `${memo.value.length} / 200`; }
  memo.addEventListener("input", countMemo);
  countMemo();
  budget.addEventListener("input", recalculate);
  recalculate();
  form.append(counter, totals, error);
  const actions = document.createElement("div");
  actions.className = "history-actions";
  const save = document.createElement("button");
  save.type = "submit";
  save.className = "button button-primary";
  save.textContent = "保存";
  actions.append(save, historyAction("キャンセル", renderHistory, "button button-quiet"));
  form.append(actions);
  form.addEventListener("submit", event => {
    event.preventDefault();
    const nextBudget = Number(budget.value);
    const purchases = rows.map(row => {
      const item = { ...row.original, id: row.original.id ?? createId(), amount: Number(row.amount.value) };
      if (row.name.value || Object.hasOwn(row.original, "name")) item.name = row.name.value;
      return item;
    });
    const spent = purchases.reduce((sum, item) => sum + item.amount, 0);
    if (!Number.isSafeInteger(nextBudget) || nextBudget <= 0 ||
        purchases.some(item => !Number.isSafeInteger(item.amount) || item.amount <= 0) ||
        !Number.isSafeInteger(spent)) {
      error.textContent = "予算と購入金額は1円以上の整数で入力してください。";
      return;
    }
    if (memo.value.length > 200) {
      error.textContent = "メモは200文字以内で入力してください。";
      return;
    }
    const updated = { ...history, budget: nextBudget, purchases, spent,
      remaining: nextBudget - spent, memo: memo.value, updatedAt: new Date().toISOString() };
    if (updateShoppingHistory(index, history, updated)) {
      renderHistory();
      showToast("買い物履歴を更新しました");
    }
  });
  card.replaceChildren(form);
  budget.focus();
}

function createHistoryRow(
  label,
  value
) {

  const row =
    document.createElement(
      "div"
    );

  row.className =
    "result-row";


  const labelElement =
    document.createElement(
      "span"
    );

  labelElement.textContent =
    label;


  const valueElement =
    document.createElement(
      "strong"
    );

  valueElement.textContent =
    value;


  row.append(
    labelElement,
    valueElement
  );


  return row;
}


// ========================================================
// ④ CSVダウンロード
// ========================================================

async function downloadHistoryCSV() {

  const histories = loadShoppingHistory();

  console.log("保存されている履歴:", histories);

  if (histories.length === 0) {
    showToast("保存された買い物履歴がありません");
    return;
  }


  const rows = [
    [
      "日付",
      "予算",
      "購入番号",
      "購入金額",
      "使用金額合計",
      "残額",
      "メモ"
    ]
  ];


  histories.forEach(history => {

    if (!history.purchases || history.purchases.length === 0) {

      rows.push([
        history.date,
        history.budget,
        "",
        "",
        history.spent,
        history.remaining,
        history.memo ?? ""
      ]);

      return;
    }


    history.purchases.forEach((purchase, index) => {

      rows.push([
        history.date,
        history.budget,
        index + 1,
        purchase.amount,
        history.spent,
        history.remaining,
        history.memo ?? ""
      ]);

    });

  });


  const csvText = rows
    .map(row =>
      row
        .map(value =>
          `"${String(value ?? "").replace(/"/g, '""')}"`
        )
        .join(",")
    )
    .join("\r\n");


  const csvData = "\uFEFF" + csvText;


  // ------------------------------------------------
  // Chrome / Edge
  // 「名前を付けて保存」を表示
  // ------------------------------------------------

  if ("showSaveFilePicker" in window) {

    try {

      const fileHandle =
        await window.showSaveFilePicker({

          suggestedName: "お買い物履歴.csv",

          types: [
            {
              description: "CSVファイル",

              accept: {
                "text/csv": [".csv"]
              }
            }
          ]

        });


      const writable =
        await fileHandle.createWritable();


      await writable.write(csvData);

      await writable.close();


      showToast("CSVを保存しました");

      return;

    } catch (error) {

      // ユーザーがキャンセルした場合
      if (error.name === "AbortError") {

        showToast("CSV保存をキャンセルしました");

        return;
      }


      console.error(
        "CSV保存エラー:",
        error
      );
    }
  }


  // ------------------------------------------------
  // showSaveFilePicker非対応ブラウザー用
  // 従来方式
  // ------------------------------------------------

  const blob =
    new Blob(
      [csvData],
      {
        type: "text/csv;charset=utf-8"
      }
    );


  const url =
    URL.createObjectURL(blob);


  const link =
    document.createElement("a");


  link.href = url;

  link.download =
    "お買い物履歴.csv";


  document.body.appendChild(link);

  link.click();

  link.remove();


  setTimeout(() => {

    URL.revokeObjectURL(url);

  }, 3000);


  showToast("CSVをダウンロードしました");
}

// ========================================================
// 予算を決めて買い物スタート
// ========================================================

function startShopping() {

  const value =
    Number(
      budgetInput.value
    );


  const error =
    document.querySelector(
      "#budget-error"
    );


  if (
    !Number.isSafeInteger(value) ||
    value <= 0
  ) {

    error.textContent =
      "1円以上の予算を入力してください。";

    budgetInput.focus();

    return;
  }


  error.textContent = "";


  state.budget =
    value;


  state.purchases =
    [];


  // 新しい買い物なので、
  // 前回の履歴IDを解除
  state.currentHistoryId =
    null;


  purchaseDisplay.value =
    "";


  setEditing(null);


  showScreen(
    "shopping"
  );
}


// ========================================================
// 購入登録
// ========================================================

function addPurchase() {

  const amount =
    Number(
      purchaseDisplay.value
    );


  const error =
    document.querySelector(
      "#purchase-error"
    );


  if (
    !Number.isSafeInteger(amount) ||
    amount <= 0
  ) {

    error.textContent =
      "1円以上の金額を入力してください。";

    return;
  }


  error.textContent =
    "";


  if (
    editingId !== null
  ) {

    const purchase =
      state.purchases.find(
        item =>
          item.id === editingId
      );


    if (purchase) {

      purchase.amount =
        amount;
    }


    showToast(
      "購入金額を更新しました"
    );

  } else {

    state.purchases.push({

      id: createId(),

      amount

    });


    showToast(
      "購入を登録しました"
    );
  }


  purchaseDisplay.value =
    "";


  setEditing(null);


  saveState();


  renderShopping();
}


// ========================================================
// 購入編集
// ========================================================

function beginEdit(id) {

  const purchase =
    state.purchases.find(
      item =>
        item.id === id
    );


  if (!purchase) {
    return;
  }


  purchaseDisplay.value =
    String(
      purchase.amount
    );


  setEditing(id);


  document.querySelector(
    "#purchase-error"
  ).textContent =
    "金額を直してから「更新する」を押してください。";


  document.querySelector(
    ".calculator-card"
  ).scrollIntoView({

    behavior:
      "smooth",

    block:
      "center"

  });


  purchaseDisplay.focus({
    preventScroll: true
  });
}


function setEditing(id) {

  editingId = id;


  document.querySelector(
    "#add-purchase"
  ).textContent =
    id === null
      ? "購入を登録する"
      : "更新する";


  document.querySelector(
    "#cancel-edit"
  ).hidden =
    id === null;


  if (id === null) {

    document.querySelector(
      "#purchase-error"
    ).textContent =
      "";
  }
}


// ========================================================
// 購入削除
// ========================================================

function deletePurchase(id) {

  state.purchases =
    state.purchases.filter(
      item =>
        item.id !== id
    );


  if (
    editingId === id
  ) {

    purchaseDisplay.value =
      "";

    setEditing(null);
  }


  saveState();


  renderShopping();


  showToast(
    "購入履歴を削除しました"
  );
}


// ========================================================
// 買い物終了
// ========================================================

function finishShopping() {

  // 完成した買い物を履歴へ保存
  saveCurrentShoppingToHistory();


  showScreen(
    "result"
  );


  showToast(
    "今回のお買い物を保存しました"
  );
}


// ========================================================
// 新しい買い物
// ========================================================

function startNewShopping() {

  memoInput.value = "";
  updateMemo();

  state.budget =
    0;


  state.purchases =
    [];


  state.currentHistoryId =
    null;


  budgetInput.value =
    "";


  purchaseDisplay.value =
    "";


  document.querySelectorAll(
    ".preset-button"
  ).forEach(
    button =>
      button.classList.remove(
        "is-selected"
      )
  );


  showScreen(
    "budget"
  );
}


// ========================================================
// 履歴画面を開く
// ========================================================

function openHistory() {

  if (
    !screens.history
  ) {

    showToast(
      "履歴画面がHTMLにありません"
    );

    return;
  }


  if (
    state.screen !== "history"
  ) {

    screenBeforeHistory =
      state.screen;
  }


  showScreen(
    "history"
  );
}


// ========================================================
// ID作成
// ========================================================

function createId() {

  return (
    globalThis.crypto
      ?.randomUUID?.()
    ??
    `${Date.now()}-${Math.random()
      .toString(16)
      .slice(2)}`
  );
}


// ========================================================
// トーストメッセージ
// ========================================================

function showToast(message) {

  const toast =
    document.querySelector(
      "#toast"
    );


  toast.textContent =
    message;


  toast.classList.add(
    "is-visible"
  );


  clearTimeout(
    toastTimer
  );


  toastTimer =
    setTimeout(
      () =>
        toast.classList.remove(
          "is-visible"
        ),
      1900
    );
}


// ========================================================
// 音声入力
// ========================================================

// 認識した数字や
// 「三千円」のような日本語の数を整数にします
function parseSpokenAmount(text) {

  const normalized =
    text
      .replace(
        /[ ,，、]/g,
        ""
      )
      .replace(
        /円|えん/g,
        ""
      )
      .trim();


  const digitMatch =
    normalized.match(
      /[0-9０-９]+/
    );


  if (digitMatch) {

    return Number(

      digitMatch[0]
        .replace(
          /[０-９]/g,
          digit =>
            String.fromCharCode(
              digit.charCodeAt(0)
              - 0xfee0
            )
        )

    );
  }


  const digits = {

    零: 0,
    〇: 0,
    一: 1,
    二: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9,

    ぜろ: 0,
    れい: 0,
    いち: 1,
    に: 2,
    さん: 3,
    よん: 4,
    し: 4,
    ご: 5,
    ろく: 6,
    なな: 7,
    しち: 7,
    はち: 8,
    きゅう: 9,
    く: 9
  };


  let total = 0;

  let section = 0;

  let current = 0;

  let matched = false;


  const kanjiUnits = {

    十: 10,
    百: 100,
    千: 1000

  };


  for (
    const char of normalized
  ) {

    if (
      Object.hasOwn(
        kanjiUnits,
        char
      )
    ) {

      section +=
        (current || 1)
        * kanjiUnits[char];

      current = 0;

      matched = true;

    } else if (
      char === "万"
    ) {

      total +=
        (section + current || 1)
        * 10000;

      section = 0;

      current = 0;

      matched = true;

    } else if (
      Object.hasOwn(
        digits,
        char
      )
    ) {

      current =
        digits[char];

      matched = true;

    } else {

      return null;
    }
  }


  const result =
    total +
    section +
    current;


  return (
    matched &&
    Number.isSafeInteger(
      result
    )
  )
    ? result
    : null;
}


// --------------------------------------------------------

function startVoiceInput(target) {

  const SpeechRecognition =
    window.SpeechRecognition ||
    window.webkitSpeechRecognition;


  if (!SpeechRecognition) {

    showToast(
      "音声入力はこのブラウザーに対応していません"
    );

    return;
  }


  const recognition =
    new SpeechRecognition();


  recognition.lang =
    "ja-JP";

  recognition.interimResults =
    false;
  
  recognition.continuous =
    false;

  recognition.maxAlternatives =
    1;


  recognition.onstart =
    () =>
      showToast(
        target === "memo" ? "メモをお話しください" : "金額をお話しください"
      );


  recognition.onerror =
    event => {

      const message =
        event.error === "not-allowed"

          ? "マイクの使用を許可してください"

          : "音声を認識できませんでした。もう一度お試しください";


      showToast(message);
    };


  // 重複防止は今回の音声入力中だけ有効にします。
  let lastMemoTranscript = "";
  const processedMemoResults = new Set();

  recognition.onresult =
    event => {

      const result = event.results[event.resultIndex];
      if (!result || !result.isFinal) return;

      const spoken =
        result[0].transcript.trim();
      if (!spoken) return;

      if (target === "memo") {
        if (processedMemoResults.has(event.resultIndex)) return;
        processedMemoResults.add(event.resultIndex);
        if (spoken === lastMemoTranscript) return;
        lastMemoTranscript = spoken;

        const available = 200 - memoInput.value.length;
        // サロゲートペアの途中で音声の文章を切らないようにします。
        let addition = "";
        for (const character of spoken) {
          if (addition.length + character.length > available) break;
          addition += character;
        }
        memoInput.value += addition;
        updateMemo();
        saveState();
        showToast(addition.length < spoken.length
          ? "メモは200文字以内です。入る分だけ追加しました"
          : "メモに音声入力を追加しました");
        return;
      }


      const amount =
        parseSpokenAmount(
          spoken
        );


      if (
        !Number.isSafeInteger(amount) ||
        amount <= 0
      ) {

        showToast(
          `金額を読み取れませんでした（${spoken}）`
        );

        return;
      }


      if (
        target === "budget"
      ) {

        budgetInput.value =
          String(amount);


        document.querySelector(
          "#budget-error"
        ).textContent =
          "";

      } else {

        purchaseDisplay.value =
          String(amount);


        document.querySelector(
          "#purchase-error"
        ).textContent =
          "";
      }


      showToast(
        `${yen(amount)}と認識しました`
      );
    };


  try {

    recognition.start();

  } catch (error) {

    showToast(
      "音声入力を開始できませんでした"
    );
  }
}


// ========================================================
// イベント
// ========================================================

const budgetUndoStack = [];
const budgetUndoButton = document.createElement("button");

budgetUndoButton.type = "button";
budgetUndoButton.className = "button button-quiet button-full button-budget-undo";
budgetUndoButton.textContent = "直前の追加を取り消す";
budgetUndoButton.disabled = true;

document.querySelector(
  ".preset-grid"
).insertAdjacentElement(
  "afterend",
  budgetUndoButton
);


function updateBudgetPresetSelection() {

  document.querySelectorAll(
    ".preset-button"
  ).forEach(
    button =>
      button.classList.toggle(
        "is-selected",
        button.dataset.budget === budgetInput.value
      )
  );
}


// 予算候補
document.querySelectorAll(
  ".preset-button"
).forEach(
  button => {

    button.addEventListener(
      "click",
      () => {

        const currentBudget =
          budgetInput.value === ""
            ? 0
            : Number(budgetInput.value);

        const addedBudget =
          Number(button.dataset.budget);

        const nextBudget =
          currentBudget + addedBudget;

        if (
          !Number.isSafeInteger(currentBudget) ||
          currentBudget < 0 ||
          !Number.isSafeInteger(addedBudget) ||
          !Number.isSafeInteger(nextBudget)
        ) {

          document.querySelector(
            "#budget-error"
          ).textContent =
            "予算は1円以上の整数で入力してください。";

          return;
        }


        budgetUndoStack.push(
          budgetInput.value
        );

        budgetInput.value =
          String(nextBudget);


        budgetUndoButton.disabled =
          false;


        document.querySelector(
          "#budget-error"
        ).textContent =
          "";


        updateBudgetPresetSelection();
      }
    );
  }
);


budgetUndoButton.addEventListener(
  "click",
  () => {

    if (budgetUndoStack.length === 0) {
      return;
    }


    budgetInput.value =
      budgetUndoStack.pop();


    budgetUndoButton.disabled =
      budgetUndoStack.length === 0;


    document.querySelector(
      "#budget-error"
    ).textContent =
      "";


    updateBudgetPresetSelection();
  }
);


// 音声入力
document.querySelectorAll(
  "[data-voice-target]"
).forEach(
  button =>
    button.addEventListener(
      "click",
      () =>
        startVoiceInput(
          button.dataset.voiceTarget
        )
    )
);


// 電卓
document.querySelectorAll(
  "[data-key]"
).forEach(
  button => {

    button.addEventListener(
      "click",
      () => {

        const key =
          button.dataset.key;


        if (
          key === "clear"
        ) {

          purchaseDisplay.value =
            "";

        } else if (
          key === "backspace"
        ) {

          purchaseDisplay.value =
            purchaseDisplay.value.slice(
              0,
              -1
            );

        } else if (
          purchaseDisplay.value.length <
          9
        ) {

          purchaseDisplay.value +=
            key;
        }


        document.querySelector(
          "#purchase-error"
        ).textContent =
          "";
      }
    );
  }
);


// 購入金額直接入力
purchaseDisplay.addEventListener(
  "input",
  () => {

    purchaseDisplay.value =
      purchaseDisplay.value
        .replace(
          /\D/g,
          ""
        )
        .slice(
          0,
          9
        );


    document.querySelector(
      "#purchase-error"
    ).textContent =
      "";
  }
);


// 予算直接入力
budgetInput.addEventListener(
  "input",
  () => {

    document.querySelector(
      "#budget-error"
    ).textContent =
      "";

    budgetUndoStack.length = 0;

    budgetUndoButton.disabled =
      true;


    updateBudgetPresetSelection();
  }
);


// 買い物スタート
document.querySelector(
  "#start-shopping"
).addEventListener(
  "click",
  startShopping
);


// 購入
document.querySelector(
  "#add-purchase"
).addEventListener(
  "click",
  addPurchase
);


// 編集キャンセル
document.querySelector(
  "#cancel-edit"
).addEventListener(
  "click",
  () => {

    purchaseDisplay.value =
      "";

    setEditing(null);
  }
);


// 買い物終了
document.querySelector(
  "#finish-shopping"
).addEventListener(
  "click",
  finishShopping
);


// 予算変更
document.querySelector(
  "#change-budget"
).addEventListener(
  "click",
  () => {

    budgetInput.value =
      String(
        state.budget || ""
      );

    budgetUndoStack.length = 0;

    budgetUndoButton.disabled =
      true;


    updateBudgetPresetSelection();


    showScreen(
      "budget"
    );
  }
);


// 新しい買い物
document.querySelector(
  "#new-shopping"
).addEventListener(
  "click",
  startNewShopping
);


// 今回の履歴に戻る
document.querySelector(
  "#back-to-shopping"
).addEventListener(
  "click",
  () =>
    showScreen(
      "shopping"
    )
);


// ========================================================
// 過去履歴関係
// ========================================================


// 予算画面から履歴
document.querySelector(
  "#open-history"
)?.addEventListener(
  "click",
  openHistory
);


// 結果画面から履歴
document.querySelector(
  "#open-history-result"
)?.addEventListener(
  "click",
  openHistory
);


// CSV
document.querySelector(
  "#download-history"
)?.addEventListener(
  "click",
  downloadHistoryCSV
);


// 履歴画面から新規買い物
document.querySelector(
  "#history-new-shopping"
)?.addEventListener(
  "click",
  startNewShopping
);


// 履歴画面から戻る
document.querySelector(
  "#history-back"
)?.addEventListener(
  "click",
  () => {

    const destination =
      screens[
        screenBeforeHistory
      ]
        ? screenBeforeHistory
        : "budget";


    showScreen(
      destination
    );
  }
);


// Enterキー
budgetInput.addEventListener(
  "keydown",
  event => {

    if (
      event.key === "Enter"
    ) {

      startShopping();
    }
  }
);


purchaseDisplay.addEventListener(
  "keydown",
  event => {

    if (
      event.key === "Enter"
    ) {

      addPurchase();
    }
  }
);


// ========================================================
// アプリ開始
// ========================================================

// 前回の画面と入力内容を復元
if (
  state.budget > 0 &&
  state.screen !== "budget" &&
  state.screen !== "history"
) {

  budgetInput.value =
    String(
      state.budget
    );


  showScreen(
    state.screen
  );

} else if (
  state.screen === "history" &&
  screens.history
) {

  showScreen(
    "history"
  );

} else {

  showScreen(
    "budget"
  );
}


if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("./service-worker.js")
      .then(() => {
        console.log("Service Worker registered");
      })
      .catch(error => {
        console.error("Service Worker registration failed:", error);
      });
  });
}