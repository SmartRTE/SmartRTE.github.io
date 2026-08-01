"use strict";

let db, SQL;
let csvContent;
let isEdit;

// const ILL_PATH = "Processed_Illustration/";
let illustrationPath = 'Processed_Illustration/';
let sqlWasmPath = 'sql-wasm.wasm';
const ILL_PATH = "Processed_Illustration/";
const STICKER_PATH = "img/stickers/";
const DIF = ["Past", "Present", "Future", "Beyond", "Eternal"];
const SHORTEN_DIF = { Past: "pst", Present: "prs", Future: "ftr", Beyond: "byd", Eternal: "etr" };
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
let viewMode = 0;
let rangeUpperBound = 12.0;
let rangeLowerBound = 1.0;
let fakeCounter = 0;

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

        initailizeConstantRangeListener();
        initializeSortListener();
        initailizeSearchResultListener();
        initializeSticker();

        $("#sticker").click(function () {
            fakeCounter++;
            if (fakeCounter >= 500) {
                window.open("fakeResult.html");
                fakeCounter = 0;
            }
            rollAiRecommend();
        });

        $("#sidebar-toggle").click(function () {
            const collapsed = $("#sidebar").toggleClass("collapsed").hasClass("collapsed");
            $(this).toggleClass("collapsed", collapsed);
            $(this).attr("aria-expanded", String(!collapsed));
            if (!collapsed) {
                // 展开时回到顶部，方便直接看到侧边栏
                window.scrollTo({ top: 0, behavior: "smooth" });
            }
        });

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

        // 快捷键：绑定 filter-window 的搜索
        $("#search-song").on("keydown", function (e) {
            if (e.key === "Enter") searchSong();
        });

    } catch (err) {
        console.error("init error:", err);
    }
});

// ─── 搜索结果点击跳转 ───
function initailizeSearchResultListener() {
    $("#search-result").on("change", function () {
        try {
            let songId = $(this).val();
            if (!songId) return;
            let difficulty = $("#search-difficulty").val();
            let prefix = viewMode === 0 ? "t-" : "";
            let unit = prefix + songId + "-" + difficulty;
            scrollToElement(unit);
        } catch (err) { console.warn("search-jump error:", err); }
    });
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
            filterResult(filteredArray, $("#sort-mode").val(), $("#sort-order").val());
        } catch (err) { console.warn("sort error:", err); }
    });
}

// ─── 定数范围监听 ───
function initailizeConstantRangeListener() {
    const clampInput = function (sel, min, max) {
        let v = parseFloat($(sel).val());
        if (isNaN(v)) v = min;
        v = Math.min(max, Math.max(min, v));
        $(sel).val(v.toFixed(1));
        filterByConstant();
    };
    $("#range-lower-bound").on("input", function () {
        let v = parseFloat($(this).val());
        if (isNaN(v)) return;
        if (v < 1.0) $(this).val("1.0");
        if (v > 12.0) $(this).val("12.0");
        filterByConstant();
    });
    $("#range-upper-bound").on("input", function () {
        let v = parseFloat($(this).val());
        if (isNaN(v)) return;
        if (v < 1.0) $(this).val("1.0");
        if (v > 12.0) $(this).val("12.0");
        filterByConstant();
    });
}

// ─── 定数范围筛选 ───
function filterByConstant() {
    try {
        rangeUpperBound = parseFloat($("#range-upper-bound").val()) || 12.0;
        rangeLowerBound = parseFloat($("#range-lower-bound").val()) || 1.0;
        if (rangeUpperBound < rangeLowerBound) {
            [rangeUpperBound, rangeLowerBound] = [rangeLowerBound, rangeUpperBound];
        }
        filteredArray = currentArray.filter(function (row) {
            return row.constant >= rangeLowerBound && row.constant <= rangeUpperBound;
        }).slice();
        generateCard(filteredArray);
        generateTable(filteredArray);
    } catch (err) { console.warn("filterByConstant error:", err); }
}

// ─── 触发文件上传 ───
function inputFile() { $("#file-input").click(); }

// ─── 上传监听 ───
function initializeUploadListener() {
    $("#file-input").on("change", function () {
        try {
            let file = this.files[0];
            if (!file) return;
            let name = file.name;
            if (name.endsWith(".json")) {
                // 全曲成绩页导出的 JSON 文件
                loadScoresExportIntoCache(file);
            } else if (name.endsWith(".csv")) {
                let reader = new FileReader();
                reader.onload = function () {
                    try {
                        csvContent = reader.result;
                        runConvert(csvContent);
                    } catch (e) { alert("CSV 解析出错: " + e.message); }
                };
                reader.readAsText(file);
            } else if (name.endsWith(".xls") || name.endsWith(".xlsx")) {
                // 万能查分表（VHZek）功能已停用
                alert("万能查分表（xls/xlsx）上传功能已停用，请使用st3或CSV文件");
            } else {
                runQuery(file);
            }
        } catch (err) { alert("文件读取失败: " + err.message); }
        $(this).val("");
    });

    // 万能查分表回填功能（VHZek）已停用：原 #uploadExcel 事件绑定已移除
}

// 全曲成绩导出载入后的页面刷新钩子
function onScoresLoaded(arr) {
    displayB30(arr);
    generateCard(arr);
    generateTable(arr);
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
        generateCard(currentArray);
        generateTable(currentArray);
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
        generateCard(currentArray);
        generateTable(currentArray);
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
        generateCard(currentArray);
        generateTable(currentArray);
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

// ─── UI: 显示 B30/PTT 信息 ───
function displayB30(array) {
    try {
        $("#select-file").text("重新选择文件");
        $("#notice").slideUp("slow");
        $("#save-csv-btn-container").show("slow");
        $("#result-table").show("slow");
        $("#result-quantity").text(array.length);
        rbm = calculateMax(array);
        localStorage.setItem("rbm", rbm);
        $("#disp-b30").text((rbm[1] || 0).toFixed(4));
        $("#disp-max").text((rbm[2] || 0).toFixed(4));
        $("#disp-ptt").val(toFloor(rbm[2] || 0, 2));
        $("#disp-r10 span").text((rbm[0] || 0).toFixed(4));
    } catch (err) { console.error("displayB30 error:", err); }
}

// ─── 表格行转换 ───
function convertToTable(currentRow, index) {
    try {
        let difColor = SHORTEN_DIF[currentRow.difficulty] || "";
        let $tr = $("<tr>").attr("id", "t-" + currentRow.songId + "-" + currentRow.difficulty).addClass(difColor);

        $tr.append($("<td>").text(index));
        $tr.append($("<td>").append(
            $("<img>").addClass("table-ill")
                .attr("src", ILL_PATH + currentRow.illustration)
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
        const isPm = pct >= 100 || currentRow.loseScore === 0;

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
        $ill.append($("<img>").addClass("card-ill").attr("src", ILL_PATH + currentRow.illustration));
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
function switchView() {
    try {
        if (viewMode === 1) {
            viewMode = 0;
            $("#result-card").slideUp("slow");
            $("#result-table").show("slow");
            $("#switch-view").text("显示为卡片");
        } else {
            viewMode = 1;
            $("#result-table").slideUp("slow");
            $("#result-card").show("slow");
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
        filterByConstant();
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
    try {
        if (!array) array = currentArray;
        let sts = getStatistics(array);
        let order = ["PM", "FR", "EX+", "EX", "AA", "A", "B", "C", "D"];
        let total = 0;
        order.forEach(function (l) {
            let n = sts[l] ? sts[l].length : 0;
            total += n;
            $("#sts-" + l).text(n);
        });
        $("#sts-total").text(total);
        // Show modal
        $("#stats-window").removeAttr("hidden").css({ display: "block", opacity: 0 });
        setTimeout(function () { $("#stats-window").css("opacity", 1); }, 20);
    } catch (err) { console.warn("showStatistics error:", err); }
}

function closeStatsModal() {
    $("#stats-window").css("opacity", 0);
    setTimeout(function () { $("#stats-window").attr("hidden", "").css("display", "none"); }, 300);
    try {
        alert("在所有 " + total + " 条结果中，有: \n" + lines.join("\n"));
    } catch (err) { console.warn("showStatistics error:", err); }
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
