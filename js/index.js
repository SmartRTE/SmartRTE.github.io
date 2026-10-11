"use strict";

let db, SQL;
let csvContent;
let isEdit;

// const ILL_PATH = "Processed_Illustration/";
let illustrationPath = 'Processed_Illustration/';
let sqlWasmPath = 'sql-wasm.wasm';
const ILL_PATH = "Processed_Illustration/";
const STICKER_PATH = "img/stickers/";
const DIF = ["Past", "Present", "Future", "Beyond", "Inscribed", "Eternal"];
const SHORTEN_DIF = { Past: "pst", Present: "prs", Future: "ftr", Beyond: "byd", Inscribed: "ins", Eternal: "etr" };
const TABLE_COLUMNS = ["SongName", "SongId", "Difficulty", "Score", "Perfect", "Perfect+", "Far", "Lost", "Constant", "PlayRating"];

let currentArray = [];
let tempArray = [];
let filteredArray = [];
let rbm = [0, 0, 0];
let idData = {};
let songNameAndDifficulty = {};
let songlist = {};
let idx_constant = [];
let diffSongNameMapping = null;
let diffIllMapping = null;
let currentVersionMaxPotential = 13.12;
/* 0 = 表格（列表），1 = 卡片。
   2026-10-11：**全端统一默认表格视图**。此前窄屏（<=768px）默认走卡片，
   但用户更习惯列表，已撤销该分支 —— 窄屏下表格藏掉 5 列判定数、首列 NO. 吸附，
   横向滚动即可看全，不再需要「默认卡片」这层特殊处理。 */
let viewMode = 0;
let rangeUpperBound = 12.0;
let rangeLowerBound = 1.0;
let fakeCounter = 0;
let listView = 'default';
let selectedDifficulties = new Set(['Past', 'Present', 'Future', 'Beyond', 'Inscribed', 'Eternal']);
let searchText = '';
let sortReversed = false;
let packsById = {};
let packOrder = [];

// ─── 确认对话框 Promise 封装 ───
let _confirmResolver = null;

function showConfirm(message) {
    return new Promise((resolve) => {
        $("#confirm-dialog-content").text(message);
        $("#confirm-dialog").removeAttr("hidden").css({ display: "block", opacity: 0 });
        setTimeout(() => $("#confirm-dialog").css("opacity", 1), 20);
        _confirmResolver = resolve;
    });
}

$(document).ready(function () {
    try {
        initializeSqliteJs();
        initializeUploadListener();
        initializeAiChan();

        // 曲目数据初始化（songlist + constants.json 派生并生成SQL）
        initializeSongData().then(renderDataVersion).catch(function (e) { console.warn("initializeSongData failed", e); });

        initializeSortListener();
        buildIndexDifficultyFilter();
        initIndexFilterControls();
        initializePacklist();
        initializeSticker();

        $("#sticker").click(function () {
            fakeCounter++;
            if (fakeCounter >= 500) {
                window.open("fakeResult.html");
                fakeCounter = 0;
            }
            rollAiRecommend();
        });

        /* 侧栏开关。
           2026-10-09 改版：窄屏下侧栏从「max-height 半高面板」变成左侧抽屉，
           状态类由 .collapsed 改为 .open（语义相反：open = 抽屉拉出来）。
           抽屉打开时给 body 加 .sidebar-locked 锁滚动，并显示遮罩 #sidebar-scrim。
           桌面端（>768px）本按钮display:none，整段逻辑不会被触发。 */
        const SIDEBAR_BP = window.matchMedia("(max-width: 768px)");
        function setSidebarOpen(open) {
            const $sb = $("#sidebar");
            const $tg = $("#sidebar-toggle");
            if (!SIDEBAR_BP.matches) return;      // 桌面端不受控
            $sb.toggleClass("open", open);
            $tg.toggleClass("open", open);
            $tg.attr("aria-expanded", String(open));
            document.body.classList.toggle("sidebar-locked", open);
            let scrim = document.getElementById("sidebar-scrim");
            if (!scrim) {
                scrim = document.createElement("div");
                scrim.id = "sidebar-scrim";
                scrim.addEventListener("click", function () { setSidebarOpen(false); });
                document.body.appendChild(scrim);
            }
            scrim.classList.toggle("show", open);
        }
        window.setSidebarOpen = setSidebarOpen;   // 供遮罩 / Esc 调用

        $("#sidebar-toggle").click(function () {
            setSidebarOpen(!$("#sidebar").hasClass("open"));
        });

        /* 窄屏下用 Esc 关闭抽屉；桌面端无副作用 */
        $(document).on("keydown", function (e) {
            if (e.key === "Escape" && SIDEBAR_BP.matches && $("#sidebar").hasClass("open")) {
                setSidebarOpen(false);
            }
        });

        /* 从窄屏旋转/放大到桌面端时，抽屉状态必须清掉，
           否则会留下一个遮罩挡住整个页面 */
        (function () {
            const mq = SIDEBAR_BP;
            const onChange = function (e) {
                if (!e.matches) {
                    $("#sidebar").removeClass("open");
                    $("#sidebar-toggle").removeClass("open");
                    document.body.classList.remove("sidebar-locked");
                    const scrim = document.getElementById("sidebar-scrim");
                    if (scrim) scrim.classList.remove("show");
                }
            };
            if (mq.addEventListener) mq.addEventListener("change", onChange);
            else if (mq.addListener) mq.addListener(onChange);   // 旧 Safari
        })();

        // 初始抽选：缓存里有成绩才显示推荐
        rollAiRecommend();

        // 确认对话框事件绑定
        $("#confirm-dialog-accept").on("click", function () {
            $("#confirm-dialog").css("opacity", 0);
            setTimeout(() => {
                $("#confirm-dialog").attr("hidden", "").css("display", "none");
                if (_confirmResolver) _confirmResolver(true);
            }, 300);
        });
        $("#confirm-dialog-refuse").on("click", function () {
            $("#confirm-dialog").css("opacity", 0);
            setTimeout(() => {
                $("#confirm-dialog").attr("hidden", "").css("display", "none");
                if (_confirmResolver) _confirmResolver(false);
            }, 300);
        });
        $("#dialog-background").on("click", function () {
            $("#confirm-dialog").css("opacity", 0);
            setTimeout(() => {
                $("#confirm-dialog").attr("hidden", "").css("display", "none");
                if (_confirmResolver) _confirmResolver(false);
            }, 300);
        });

    } catch (err) {
        console.error("init error:", err);
    }
});

// ─── index 筛选/视图（scores 风格） ───
function esc(s) {
    return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
}

function initializePacklist() {
    fetch('json/packlist').then(function (r) { return r.json(); }).then(function (d) {
        packsById = {};
        packOrder = [];
        (d.packs || []).forEach(function (p) {
            packsById[p.id] = p;
            packOrder.push(p.id);
        });
        renderIndexList();
    }).catch(function () { /* 忽略：曲包名回退为 id */ });
}

function packDisplayName(setId) {
    const p = packsById[setId];
    if (p) {
        const nl = p.name_localized || {};
        return nl['zh-Hans'] || nl.en || p.id;
    }
    return setId || '记忆档案馆';
}

function buildIndexDifficultyFilter() {
    const html = ['Past', 'Present', 'Future', 'Beyond', 'Inscribed', 'Eternal'].map(function (dif) {
        return '<label class="dif-check"><input type="checkbox" data-dif="' + dif + '"'
            + (selectedDifficulties.has(dif) ? ' checked' : '') + '> ' + dif + '</label>';
    }).join('');
    $('#index-difficulty-filters').html(html);
}

function initIndexFilterControls() {
    $('#index-view-select').on('change', function () {
        listView = this.value;
        renderIndexList();
    });
    $('#index-difficulty-filters').on('change', 'input[type=checkbox]', function () {
        const dif = $(this).data('dif');
        if (this.checked) selectedDifficulties.add(dif);
        else selectedDifficulties.delete(dif);
        renderIndexList();
    });
    $('#index-search').on('input', function () {
        searchText = this.value;
        renderIndexList();
    });
    $('#index-sort-reversed').on('change', function () {
        sortReversed = this.checked;
        renderIndexList();
    });
}

function versionCmp(a, b) {
    if (a === b) return 0;
    if (a === '未知') return 1;
    if (b === '未知') return -1;
    const pa = String(a).split('.').map(Number);
    const pb = String(b).split('.').map(Number);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
        const x = i < pa.length ? pa[i] : 0;
        const y = i < pb.length ? pb[i] : 0;
        if (x !== y) return x - y;
    }
    return 0;
}

function difRankCmp(a, b) {
    const order = ['Eternal', 'Inscribed', 'Beyond', 'Future', 'Present', 'Past'];
    return order.indexOf(a.difficulty) - order.indexOf(b.difficulty);
}

function groupIndexRows(arr, kind) {
    const groups = [];
    const map = {};
    arr.forEach(function (r) {
        let key, title;
        if (kind === 'pack') {
            const setId = (songCatalog[r.songId] && songCatalog[r.songId].set) || 'single';
            key = setId;
            title = packDisplayName(setId);
        } else {
            const ver = (songCatalog[r.songId] && songCatalog[r.songId].version) || '未知';
            key = ver;
            title = '版本 ' + ver;
        }
        if (!map[key]) {
            map[key] = { key: key, title: title, rows: [] };
            groups.push(map[key]);
        }
        map[key].rows.push(r);
    });
    if (kind === 'version') {
        groups.sort(function (a, b) {
            return sortReversed ? -versionCmp(a.key, b.key) : versionCmp(a.key, b.key);
        });
    } else {
        groups.sort(function (a, b) {
            let ia = packOrder.indexOf(a.key);
            let ib = packOrder.indexOf(b.key);
            if (ia === -1) ia = 999;
            if (ib === -1) ib = 999;
            return sortReversed ? ib - ia : ia - ib;
        });
    }
    return groups;
}

function renderIndexList() {
    // 1) 筛选：难度 + 搜索
    let arr = (currentArray || []).filter(function (r) {
        if (!selectedDifficulties.has(r.difficulty)) return false;
        if (searchText) {
            const q = searchText.toLowerCase();
            if ((r.songName || '').toLowerCase().indexOf(q) === -1 && (r.songId || '').toLowerCase().indexOf(q) === -1) return false;
        }
        return true;
    });
    // 2) 基础排序：排序方式
    const attr = $('#sort-mode').val() || 'playRating';
    const order = parseInt($('#sort-order').val(), 10) || 1;
    arr = arr.slice().sort(function (a, b) { return resultSort(a, b, attr, order); });
    // 3) 视图
    const rev = sortReversed ? -1 : 1;
    let groups;
    if (listView === 'name') {
        arr.sort(function (a, b) {
            return rev * ((a.songName || '').localeCompare(b.songName || '', undefined, { numeric: true }) || difRankCmp(a, b));
        });
        groups = [{ title: null, rows: arr }];
    } else if (listView === 'constant') {
        arr.sort(function (a, b) {
            return rev * (resultSort(a, b, 'constant', 1) || difRankCmp(a, b));
        });
        groups = [{ title: null, rows: arr }];
    } else if (listView === 'pack' || listView === 'version') {
        groups = groupIndexRows(arr, listView);
    } else {
        if (sortReversed) arr = arr.slice().reverse();
        groups = [{ title: null, rows: arr }];
    }
    filteredArray = arr;
    renderIndexGroups(groups);
}

/* 最近一次算出的分组（表格/卡片共用），以及「各视图是按哪一版分组建的」。
   搜索框每敲一个字都会走 renderIndexList，以前会把表格和卡片两套 DOM 都重建一遍，
   现在只建当前显示的那一套；切视图时再按需补建另一套，内容没变就跳过。 */
let indexGroups = null;
let indexGroupsSeq = 0;
const indexBuiltSeq = { table: -1, card: -1 };

function renderIndexGroups(groups) {
    indexGroups = groups;
    indexGroupsSeq++;
    renderActiveView();
}

/** 只渲染当前视图（viewMode：0 = 表格，1 = 卡片） */
function renderActiveView() {
    if (viewMode === 1) renderCardView();
    else renderTableView();
}

function renderTableView() {
    if (!indexGroups || indexBuiltSeq.table === indexGroupsSeq) return;
    indexBuiltSeq.table = indexGroupsSeq;
    // 有些数据源（比如不含判定数的分数表）会让这几列全是 0，那就整列藏掉
    const hasEmptyItems = (filteredArray || []).some(function (r) {
        return r.perfect === 0 && r.far === 0 && r.lost === 0;
    });
    $('.t-perfect, .t-normal-perfect, .t-critical-perfect, .t-far, .t-lost')[hasEmptyItems ? 'addClass' : 'removeClass']('hidden');
    const tbody = document.querySelector('#result tbody');
    tbody.innerHTML = '';
    /* 2026-10-09 性能：原先在循环里逐条 $body.append()。
       一次导入动辄上千行，逐条 append 会让 jQuery 反复走包装/合并路径，
       且中间态一直在 DOM 里，浏览器多次做布局。
       改为先攒进 DocumentFragment，最后一次性插入 —— 只触发一次插入。
       注意：convertToTable 返回的 jQuery 对象上绑着 .on('click')（点曲绘改成绩），
       这里 append 的是它内部的 DOM 节点，事件监听器随节点一起搬过去，不受影响。 */
    const frag = document.createDocumentFragment();
    let rank = 0;
    indexGroups.forEach(function (g) {
        if (g.title !== null) {
            const tr = document.createElement('tr');
            tr.className = 'index-group-header';
            const td = document.createElement('td');
            td.colSpan = 11;
            td.textContent = g.title;
            tr.appendChild(td);
            frag.appendChild(tr);
        }
        g.rows.forEach(function (r) {
            rank++;
            frag.appendChild(convertToTable(r, rank)[0]);
        });
    });
    tbody.appendChild(frag);
}

function renderCardView() {
    if (!indexGroups || indexBuiltSeq.card === indexGroupsSeq) return;
    indexBuiltSeq.card = indexGroupsSeq;
    const host = document.getElementById('result-card');
    host.innerHTML = '';
    /* 同 renderTableView：攒进 fragment 一次性插入（事件随节点搬过去） */
    const frag = document.createDocumentFragment();
    let rank = 0;
    indexGroups.forEach(function (g) {
        if (g.title !== null) {
            const d = document.createElement('div');
            d.className = 'index-card-group-header';
            d.textContent = g.title;
            frag.appendChild(d);
        }
        g.rows.forEach(function (r) {
            rank++;
            frag.appendChild(convertToCard(r, rank)[0]);
        });
    });
    host.appendChild(frag);
}

// ─── 数据版本显示（读取自 constants.json）───
function renderDataVersion() {
    const vEl = document.getElementById("version-value");
    const uEl = document.getElementById("version-updated");
    if (vEl) vEl.textContent = dataVersion || "未知";
    if (uEl) uEl.textContent = dataUpdatedAt || "未知";
}

// ─── 排序监听 ───
function initializeSortListener() {
    $("#sort-mode, #sort-order").on("change", function () {
        try {
            renderIndexList();
        } catch (err) { console.warn("sort error:", err); }
    });
}

// ─── 触发文件上传 ───
function inputFile() { $("#file-input").click(); }

// ─── 上传监听 ───
function initializeUploadListener() {
    $("#file-input").on("change", function () {
        try {
            let file = this.files[0];
            if (!file) return;
            // 统一上传入口：st3 / CSV / score.json / 带缓存的图片
            handleScoreFileUpload(file);
        } catch (err) { alert("文件读取失败: " + err.message); }
        $(this).val("");
    });

    // 万能查分表回填功能（VHZek）已停用：原 #uploadExcel 事件绑定已移除
}

// 全曲成绩导出载入后的页面刷新钩子
function onScoresLoaded(arr) {
    displayB30(arr);
    renderIndexList();
}

// ─── SQLite 查询 ───
async function runQuery(file) {
    try {
        // 确保曲目数据（含生成的SQL）已就绪
        if (!query) {
            await initializeSongData();
        }
        let buffer = await file.arrayBuffer();
        let uInt8Array = new Uint8Array(buffer);
        db = new SQL.Database(uInt8Array);
        if (!db) {
            alert("st3 文件选取有误，请重试");
            return;
        }
        // 提示有成绩但未登记定数的曲目
        logMissingConstants(db);
        let result = db.exec(query);
        if (result.length > 0) {
            saveQueryResult(result[0]);
        } else {
            alert("上传的数据库是空的！你是不是忘记把存档同步到本地了？");
        }
    } catch (err) {
        console.error("runQuery error:", err);
        alert("数据库解析错误: " + err.message);
    }
}

// ─── SQL 结果保存 ───
function saveQueryResult(result) {
    try {
        let temp = result.values;
        currentArray = [];
        temp.forEach(function (row, i) {
            let pr = new PlayResult(row[0], row[1], row[2], row[3], row[4], row[5], row[6], row[7], row[8], row[9], i);
            currentArray.push(pr);
        });
        filteredArray = currentArray;
        displayB30(currentArray);
        renderIndexList();
        saveLocalStorage(currentArray);
        rollAiRecommend();
    } catch (err) { console.error("saveQueryResult error:", err); }
}

// ─── CSV 转换 ───
function runConvert(csv) {
    try {
        const rows = csvToRows(csv);
        let temp = [];
        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            if (row[3] !== "") {
                let pr = new PlayResult(
                    row[0], row[1], row[2],
                    parseFloat(row[3]), parseFloat(row[4]),
                    parseFloat(row[5]), parseFloat(row[6]),
                    parseFloat(row[7]), parseFloat(row[8]),
                    parseFloat(row[9]), i - 1
                );
                temp.push(pr);
            }
        }
        temp.sort(function (a, b) { return resultSort(a, b, "playRating", 1); });
        reloadContent(temp);
        filteredArray = temp;
        currentArray = filteredArray;
        saveLocalStorage(currentArray);
        displayB30(currentArray);
        renderIndexList();
        rollAiRecommend();
    } catch (err) {
        console.error("runConvert error:", err);
        alert("CSV 解析出错: " + err.message);
    }
}

// ─── 读取缓存 ───
function readSavedScore() {
    try {
        let data = readLocalStorage();
        if (!data) {
            alert("缓存内似乎没有数据哦，可能是第一次使用或者被清除了！");
            return;
        }
        currentArray = data;
        filteredArray = currentArray;
        displayB30(currentArray);
        renderIndexList();
        rollAiRecommend();
    } catch (err) {
        console.error("readSavedScore error:", err);
        alert("缓存数据读取失败，可能已损坏，请重新上传文件");
    }
}

// ─── AI酱推荐（sticker 下方区域，与 AI-chan 窗口同功能） ───
function rollAiRecommend() {
    const $area = $("#ai-recommend");
    if (!$area.length) return;
    const pool = ((currentArray && currentArray.length ? currentArray : readLocalStorage()) || []).filter(function (r) {
        return r && r.songId && Number(r.score) > 0;
    });
    if (!pool.length) {
        $area.attr("hidden", true);
        return;
    }
    const song = pool[Math.floor(Math.random() * pool.length)];
    let line;
    if (aiChanList && aiChanList.length) {
        line = getRandomAiChan()
            .replace("songName", song.songName || song.songId)
            .replace("difficulty", song.difficulty)
            .replace("constant", parseFloat(song.constant).toFixed(1))
            .replace("你打了score分", "你打了" + song.score + "分");
    } else {
        line = "AI酱推荐：试试「" + (song.songName || song.songId) + "」"
            + song.difficulty + "，定数 " + parseFloat(song.constant).toFixed(1)
            + "，当前 " + song.score + " 分！";
    }
    const $text = $("#ai-recommend-text");
    const $body = $("#ai-recommend-body");
    // 动效：旧文本淡出后换新文本淡入
    $body.addClass("ai-fade");
    setTimeout(function () {
        $("#ai-recommend-ill").css("visibility", "visible").attr("src", "Processed_Illustration/" + (song.illustration || song.songId + ".jpg"));
        $("#ai-recommend-songname").text(song.songName || song.songId);
        $("#ai-recommend-diff").text(song.difficulty).attr("class", "ai-recommend-diff ai-recommend-diff-" + String(song.difficulty).toLowerCase());
        $("#ai-recommend-meta").text("定数 " + parseFloat(song.constant).toFixed(1) + " · 当前 " + song.score + " 分");
        $text.text(line);
        $area.removeAttr("hidden");
        $body.removeClass("ai-fade");
    }, 180);
}

// ─── 空状态 → 有数据 ───
/* 页面默认隐藏统计面板 / 筛选控件 / 清除缓存按钮及它们的分割线（#sidebar 的 no-data 类，见 css/index.css）。
   所有「真正拿到成绩」的路径最后都会落到 displayB30()，所以在这里统一去掉那个类。 */
function revealDataPanels() {
    const el = document.getElementById("sidebar");
    if (el) el.classList.remove("no-data");
}

// ─── UI: 显示 B30/PTT 信息 ───
function displayB30(array) {
    try {
        revealDataPanels();
        $("#select-file").text("重新选择文件");
        // 2026-10-09：notice / 按钮容器 / 结果区的慢动作换成 reveal/hide 类（见 switchView 上方说明）
        hideSection("#notice");
        revealSection("#save-csv-btn-container");
        // 只露出当前视图：否则在卡片视图下再导一次数据，表格会被这里 show 出来、两套叠在一起
        if (viewMode === 1) {
            revealSection("#result-card");
            $("#result-table").hide();
        } else {
            revealSection("#result-table");
            $("#result-card").hide();
        }
        $("#result-quantity").text(array.length);
        rbm = calculateMax(array);
        localStorage.setItem("rbm", rbm);
        $("#disp-b30").text((rbm[1] || 0).toFixed(4));
        $("#disp-max").text((rbm[2] || 0).toFixed(4));
        $("#disp-r10 span").text((rbm[0] || 0).toFixed(4));
        const rbm50 = calculateMax50(array);
        // 当前 PTT 输入框（已隐藏）直接读取最高潜力值 max50
        $("#disp-ptt").val(toFloor(rbm50[2] || 0, 2));
        $("#disp-b50").text(toFloor(rbm50[1] || 0, 4));
        $("#disp-max50").text(toFloor(rbm50[2] || 0, 4));
        $("#disp-b10").text(toFloor(rbm50[0] || 0, 4));
    } catch (err) { console.error("displayB30 error:", err); }
}

// ─── 曲绘图片元素（懒加载 + 失败隐藏）───
/* loading="lazy"：一次导入动辄上千行，不加的话首屏会同时发起上千个曲绘请求。
   失败藏图用 onerror 属性而不是 .on('error')：元素还没插进 DOM 就可能已经加载失败，
   那时候事件早错过了，绑上去也收不到。写法与 scores.js / 工具窗保持一致。 */
function makeIllImg(cls, src) {
    return $("<img>").addClass(cls).attr({
        src: src,
        loading: "lazy",
        onerror: "this.style.visibility='hidden'"
    });
}

// ─── 表格行转换 ───
function convertToTable(currentRow, index) {
    try {
        let difColor = SHORTEN_DIF[currentRow.difficulty] || "";
        let $tr = $("<tr>").attr("id", "t-" + currentRow.songId + "-" + currentRow.difficulty).addClass(difColor);

        $tr.append($("<td>").text(index));
        $tr.append($("<td>").append(
            makeIllImg("table-ill", ILL_PATH + currentRow.illustration)
                .on("click", function () { modifyPlayResult(currentRow.innerIndex); })
        ));
        $tr.append($("<td>").addClass("t-song-name").text(currentRow.songName));
        $tr.append($("<td>").addClass("t-score").text(currentRow.score));
        $tr.append($("<td>").addClass("t-perfect").text(currentRow.perfect));
        $tr.append($("<td>").addClass("t-critical-perfect").text(currentRow.criticalPerfect));
        $tr.append($("<td>").addClass("t-normal-perfect").text(currentRow.normalPerfect));
        $tr.append($("<td>").addClass("t-far").text(currentRow.far));
        $tr.append($("<td>").addClass("t-lost").text(currentRow.lost));
        $tr.append($("<td>").addClass("t-constant").text((currentRow.constant || 0).toFixed(1)));

        let pct = currentRow.percentage || 0;
        // PM = far=0 且 lost=0（只有 Pure），与卡片视图一致；0 失分 ≠ PM，不能拿 loseScore 判
        const isPm = pct >= 100 || (currentRow.far === 0 && currentRow.lost === 0);

        let rt = (String(currentRow.playRating).length - String(currentRow.playRating).indexOf(".") - 1) < 4
            ? (currentRow.playRating || 0).toFixed(4)
            : toFloor(currentRow.playRating || 0, 4);
        $tr.append($("<td>").addClass("t-play-rating" + (isPm ? " is-pm" : "")).css("--pct", pct + "%")
            .text(rt + "(" + (-(currentRow.loseScore || 0).toFixed(2)) + ")"));

        if (currentRow.normalPerfect === 0 && currentRow.far === 0 && currentRow.lost === 0 && currentRow.perfect !== 0) {
            $tr.addClass("theoretical");
        }
        return $tr;
    } catch (err) { console.warn("convertToTable error:", err); return $("<tr>"); }
}

// ─── 卡片转换 ───
function convertToCard(currentRow, index) {
    try {
        let $card = $("<div>").attr("id", currentRow.songId + "-" + currentRow.difficulty)
            .addClass("single-card " + (currentRow.difficulty || "").toLowerCase());

        $card.append($("<div>").addClass("card-rank").text("#" + index));

        let $ill = $("<div>").addClass("card-ill-container").on("click", function () { modifyPlayResult(currentRow.innerIndex); });
        $ill.append(makeIllImg("card-ill", ILL_PATH + currentRow.illustration));
        $card.append($ill);

        $card.append($("<div>").addClass("song-name").text(currentRow.songName));
        $card.append($("<div>").addClass("song-score").text(currentRow.score));

        let rt = (String(currentRow.playRating).length - String(currentRow.playRating).indexOf(".") - 1) < 4
            ? (currentRow.playRating || 0).toFixed(4)
            : toFloor(currentRow.playRating || 0, 4);
        $card.append($("<div>").addClass("song-rating").text((currentRow.constant || 0).toFixed(1) + " → " + rt));

        let pct = currentRow.percentage || 0;
        const isPm = currentRow.far === 0 && currentRow.lost === 0;
        $card.append($("<div>").addClass("song-percentage" + (isPm ? " is-pm" : "")).css("--pct", pct + "%")
            .text("(" + toFloor(pct, 2) + "%)"));

        if (currentRow.normalPerfect === 0 && currentRow.far === 0 && currentRow.lost === 0 && currentRow.perfect !== 0) {
            $card.addClass("theoretical");
        }
        return $card;
    } catch (err) { console.warn("convertToCard error:", err); return $("<div>"); }
}

// ─── 生成卡片 ───
function generateCard(array) {
    try {
        $("#result-card").empty();
        for (let i = 0; i < array.length; i++) {
            $("#result-card").append(convertToCard(array[i], i + 1));
        }
    } catch (err) { console.warn("generateCard error:", err); }
}

// ─── 生成表格 ───
function generateTable(array) {
    try {
        let $body = $("#result tbody").empty();
        let hasEmptyItems = false;
        for (let i = 0; i < array.length; i++) {
            let row = array[i];
            if (row.perfect === 0 && row.far === 0 && row.lost === 0) hasEmptyItems = true;
            $body.append(convertToTable(row, i + 1));
        }
        let cls = hasEmptyItems ? "addClass" : "removeClass";
        $(".t-perfect, .t-normal-perfect, .t-critical-perfect, .t-far, .t-lost")[cls]("hidden");
    } catch (err) { console.warn("generateTable error:", err); }
}

// ─── 计算 R10 ───
function calculateR10() {
    try {
        let ptt = parseFloat($("#disp-ptt").val());
        if (isNaN(ptt)) return;
        let b30 = parseFloat(rbm[1]) || 0;
        let r10 = (ptt * 40 - b30 * 30) / 10;
        $("#disp-r10 a").text("逆推得到 recent10 约为");
        $("#disp-r10 span").text(r10 >= 0 ? r10.toFixed(4) : "❓");
        $("#disp-r10").html("逆推得到 recent10 约为 <span>" + (r10 >= 0 ? r10.toFixed(4) : "❓") + "</span>");
    } catch (err) { console.warn("calculateR10 error:", err); }
}

// ─── 切换视图 ───
/* 2026-10-09：原先用 jQuery 的 .show("slow") / .slideUp("slow", cb)。
   slow 是 600ms 线性缓动，观感上明显「慢半拍」，而 jQuery 动画期间还在
   逐帧读 offsetHeight 触发布局，上千行表格时开销不小。
   换成 css 的 reveal/hide 两组类（只用 opacity + transform，走合成层），
   回调仍保留在动画结束后，用来清空切走的那一套 DOM。
   prefers-reduced-motion 下 css/theme.css 会把过渡压到 0.01ms，回调立刻触发。 */
const VIEW_ANIM_MS = 250;

/*淡入并确保处于「可见的布局状态」。
   .css("display","") 会回落到 css 里声明的 display（#result-card 是 grid、
   #result-table 是 block、#save-csv-btn-container 是 flex），不能写死。 */
function revealSection(sel) {
    const $el = $(sel);
    if (!$el.length) return;
    $el.css("display", "")
       .removeClass("hide-anim")
       .addClass("reveal");
    // 强制一次 reflow，保证从透明态真的过渡过来
    void $el[0].offsetWidth;
    $el.removeClass("reveal").addClass("reveal-active");
}

/* 淡出，并在动画结束后真正 display:none —— 必须真的移出布局流，
   否则表格和卡片会同时占位、上下叠在一起（这正是原show/hide 对做的事）。
   done 回调在隐藏之后才跑，用于清空切走的那一套 DOM。 */
function hideSection(sel, done) {
    const $el = $(sel);
    if (!$el.length) { if (done) done(); return; }
    $el.removeClass("reveal-active").addClass("hide-anim");
    setTimeout(function () {
        // 期间用户可能已切回来，此时不要隐藏、也不必跑清理
        if (!$el.hasClass("hide-anim")) { if (done) done(); return; }
        $el.css("display", "none").removeClass("hide-anim");
        if (done) done();
    }, VIEW_ANIM_MS);
}

function switchView() {
    try {
        if (viewMode === 1) {
            viewMode = 0;
            renderActiveView();
            hideSection("#result-card", function () {
                if (viewMode !== 0) return;
                $("#result-card").empty();
                indexBuiltSeq.card = -1;
            });
            revealSection("#result-table");
            $("#switch-view").text("显示为卡片");
        } else {
            viewMode = 1;
            renderActiveView();
            hideSection("#result-table", function () {
                if (viewMode !== 1) return;
                $("#result tbody").empty();
                indexBuiltSeq.table = -1;
            });
            revealSection("#result-card");
            $("#switch-view").text("显示为列表");
        }
    } catch (err) { console.warn("switchView error:", err); }
}

// ─── 保存 CSV ───
function saveTableCSV() {
    try {
        let lines = [TABLE_COLUMNS.map(csvEscapeField).join(",")];
        currentArray.forEach(function (row) {
            lines.push([row.songName, row.songId, row.difficulty, row.score, row.perfect, row.criticalPerfect, row.far, row.lost, row.constant, row.playRating].map(csvEscapeField).join(","));
        });
        let blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
        let link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = "B30_" + new Date().toLocaleString() + ".csv";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
    } catch (err) { alert("保存失败: " + err.message); }
}

// ─── 筛选排序结果 ───
function filterResult(array, attr, order) {
    try {
        let sorted = array.slice().sort(function (a, b) { return resultSort(a, b, attr, order); });
        generateCard(sorted);
        generateTable(sorted);
    } catch (err) { console.warn("filterResult error:", err); }
}

// ─── 重载内容（排序+重建） ───
function reloadContent(array) {
    try {
        array.sort(function (a, b) { return resultSort(a, b, "playRating", 1); });
        array.forEach(function (row, i) { row.innerIndex = i; });
        saveLocalStorage(array);
        displayB30(array);
        filteredArray = array;
        currentArray = array;
        renderIndexList();
    } catch (err) { console.error("reloadContent error:", err); }
}

// ─── 搜索曲目 ───
function searchSong() {
    try {
        let str = $("#search-song").val().toLowerCase();
        let difficulty = $("#search-difficulty").val();
        let results = [];
        let seen = new Set();
        filteredArray.forEach(function (row) {
            if (row.difficulty === difficulty && row.songName.toLowerCase().indexOf(str) !== -1 && !seen.has(row.songId)) {
                seen.add(row.songId);
                results.push({ songName: row.songName, songId: row.songId });
            }
        });
        let $sel = $("#search-result").empty();
        if (results.length === 0) {
            $sel.append($("<option selected disabled>").text("无结果"));
        } else {
            $sel.append($("<option selected disabled>").text("共有 " + results.length + " 条结果"));
            results.forEach(function (s) {
                $sel.append($("<option>").val(s.songId).text(s.songName));
            });
        }
    } catch (err) { console.warn("searchSong error:", err); }
}

// ─── 搜索曲目（filter-window 版本） ───
function filterSearchSong() {
    try {
        let str = $("#filter-search-song").val().toLowerCase();
        let difficulty = $("#filter-search-difficulty").val();
        let results = [];
        let seen = new Set();
        filteredArray.forEach(function (row) {
            if (row.difficulty === difficulty && row.songName.toLowerCase().indexOf(str) !== -1 && !seen.has(row.songId)) {
                seen.add(row.songId);
                results.push({ songName: row.songName, songId: row.songId });
            }
        });
        let $sel = $("#filter-search-result").empty();
        if (results.length === 0) {
            $sel.append($("<option disabled>").text("无结果"));
        } else {
            $sel.append($("<option disabled>").text("共有 " + results.length + " 条结果"));
            results.forEach(function (s) {
                $sel.append($("<option>").val(s.songId).text(s.songName));
            });
        }
    } catch (err) { console.warn("filterSearchSong error:", err); }
}

// ─── handleScroll（供 aiChanRoll 内部调用） ───
function handleScroll(unitid, index) {
    scrollToElement(unitid);
}

// ─── 统计 ───
function showStatistics(array) {
    // 与工具箱“全局统计”合并：直接打开工具箱的全局统计页签
    if (window.openToolPanel) {
        window.openToolPanel('global-stats');
    }
}

// ─── 保存 VH 版万能查分表（已停用，功能暂不使用）───
// function saveVHZEK() { ... }

// ─── 贴纸初始化 ───
function initializeSticker() {
    try {
        let idx = Math.floor(Math.random() * 12);
        $("#sticker").css({
            "background-image": "url(" + STICKER_PATH + idx + ".webp)",
            "background-size": "contain",
            "background-repeat": "no-repeat",
            "background-position": "center"
        });
    } catch (err) { console.warn("sticker error:", err); }
}






/* ===== 定数表/曲目列表加载（VHZEK，已停用） ===== */
// 定数表现由 json/constants.json + json/songlist 在 initializeSongData 中派生


/* ===== 识图工具窗：覆盖成绩后 → 重新读缓存 + 刷新显示单元 ===== */
registerOcrAppliedHandler(function () {
	const arr = readLocalStorage();
	if (!arr || !arr.length) return;
	currentArray = arr;
	filteredArray = currentArray;
	displayB30(currentArray);
	renderIndexList();
});
