/* ===== 全曲成绩管理 ===== */

let SQL; // sql.js 模块（st3 数据库解析用）
let sqlWasmPath = 'sql-wasm.wasm';

let currentArray = []; // 与 savedArrayData 共用的缓存记录数组
let overrides = {}; // 页面级定数覆盖 "songId|Difficulty" -> 数值
let chartRows = []; // 全量谱面行 {songId, difficulty, title, illustration, constant, idx, packId}
let rowsByKey = {}; // "songId|Difficulty" -> chartRow
let recordsByKey = {}; // "songId|Difficulty" -> 缓存记录
let packs = []; // packlist
let packsById = {}; // packlist id -> pack
let sectionPacks = {}; // section -> [pack]

const DIF_ASC = ['Past', 'Present', 'Future', 'Beyond', 'Inscribed', 'Eternal'];
const DIF_DESC = ['Eternal', 'Inscribed', 'Beyond', 'Future', 'Present', 'Past'];
const SECTION_ORDER = ['mainstory', 'mainstory2', 'sidestory', 'arcaea', 'collab', 'variety', 'single'];
const SECTION_NAMES = {
	mainstory: '主线',
	mainstory2: '主线二',
	sidestory: '支线',
	arcaea: 'Arcaea',
	collab: '联动',
	variety: '综合',
	single: '记忆档案馆'
};

/* 可切换的 title_localized 语言（songlist 中实际出现的四种，缺省回退 en） */
const TITLE_LANGS = ['en', 'zh-Hant', 'zh-Hans', 'ko'];
/* 谱面评级由低到高的分组顺序（含 getSongRanking 会返回的 C） */
const GRADE_ORDER = ['无', 'D', 'C', 'B', 'A', 'AA', 'EX', 'EX+', 'FR', 'PM'];
/* ratingClass -> 难度名（Inscribed 与 Beyond 共用 3，靠 ratingClassAlias 区分） */
const DIF_BY_CLASS = { 0: 'Past', 1: 'Present', 2: 'Future', 3: 'Beyond', 4: 'Eternal' };

/* 视图 / 分组 / 语言的可选值（恢复偏好时用来校验，避免旧版本存下的值把页面搞崩） */
const VIEW_OPTIONS = ['default', 'title', 'constant', 'date', 'artist', 'grade'];
const GROUP_OPTIONS = ['none', 'pack', 'version', 'level', 'grade'];
const LANG_OPTIONS = TITLE_LANGS;
const DEFAULT_DIFFICULTIES = ['Future', 'Beyond', 'Inscribed', 'Eternal'];
const PREFS_KEY = 'arcaea-scores-view-v1';

let viewMode = 'default'; // 排序方式：default(曲目序) | title(按标题) | constant(按定数)
let groupMode = 'none'; // 分组方式：none | pack(按曲包) | version(按游戏版本) | level(按等级) | grade(按评级)
let langMode = 'en'; // 显示语言：TITLE_LANGS 之一
let selectedDifficulties = new Set(DEFAULT_DIFFICULTIES);
let searchText = '';
let onlyUnrecorded = false;
let onlyRecorded = false;
let sortReversed = false;
let collapsedGroups = new Set(); // 已折叠的分组 id（如 "pack:base"、"cst:11.1"）

$(document).ready(async function () {
	// 版本不匹配时清除旧缓存
	checkLocalStorageVersion();
	currentArray = readLocalStorage() || [];
	overrides = loadConstantOverrides();
	initializeSqliteJs();

	await Promise.all([initializeSongData(), loadPacks()]);
	buildChartRows();
	buildSectionPacks();
	rebuildRecordsMap();
	restorePrefs(); // 先恢复上次的视图/分组/语言/筛选，再据此渲染难度勾选框
	buildDifficultyFilter();
	bindEvents();
	updateStats();
	render();
});

/* ---------- 数据准备 ---------- */

async function loadPacks() {
	try {
		const response = await fetch('json/packlist');
		if (!response.ok) throw new Error('HTTP ' + response.status);
		packs = (await response.json()).packs || [];
	} catch (e) {
		console.error('packlist load error:', e);
		packs = [];
	}
	packsById = {};
	packs.forEach(function (p) { packsById[p.id] = p; });
}

/* songlist 原始难度条目：难度名 -> 原始对象（取 rating / ratingPlus / title_localized 用） */
function rawDifficultiesOf(song) {
	const map = {};
	((song && song.difficulties) || []).forEach(function (d) {
		const key = (d.ratingClassAlias === 1) ? 'Inscribed' : DIF_BY_CLASS[d.ratingClass];
		if (key) map[key] = d;
	});
	return map;
}

/**
 * 谱面标题的四种语言文本：难度级 title_localized -> 曲目级 title_localized -> en
 * ⚠️ en 用 songlist 的**原始**英文名，不要套 `TITLE_FALLBACKS` 兜底名：
 * 原版游戏里 `ii` 显示/排序用的就是它的花体原名（`title_localized.en`），
 * 写进缓存的 songName 口径也以原始 en 为准（与 `ocr.html` 的 `recordTitle` 一致）。
 * 只有整首歌一条 en 都没有时（particlearts）才退回目录兜底名。
 */
function buildRowTitles(song, rawDiff, enFallback) {
	const songTl = (song && song.title_localized) || {};
	const diffTl = (rawDiff && rawDiff.title_localized) || {};
	const out = { en: diffTl.en || songTl.en || enFallback || '' };
	TITLE_LANGS.forEach(function (lang) {
		if (lang === 'en') return;
		const v = diffTl[lang] || songTl[lang];
		out[lang] = (v === undefined || v === null || v === '') ? out.en : String(v);
	});
	return out;
}

/* 当前显示语言下的曲名 */
function shownTitle(row) {
	return row.titles[langMode] || row.titles.en || row.title;
}

/* 取第一个「有值」的字段：难度级优先，回落歌曲级（空串 / null / undefined 都算没有） */
function pickField(primary, fallback) {
	const v = (primary === undefined || primary === null || primary === '') ? fallback : primary;
	return (v === undefined || v === null) ? '' : v;
}

/* 转 unix 时间戳（秒）；无法解析返回 null */
function toTimestamp(v) {
	if (v === undefined || v === null || v === '') return null;
	const n = Number(v);
	return isFinite(n) ? n : null;
}

function buildChartRows() {
	chartRows = [];
	rowsByKey = {};
	Object.keys(songCatalog).forEach(function (songId) {
		const cat = songCatalog[songId];
		const song = songlistDetail[songId] || {};
		const rawDiffs = rawDifficultiesOf(song);
		Object.keys(cat.difficulties).forEach(function (difficulty) {
			const d = cat.difficulties[difficulty];
			// 定数未收录的谱面直接隐藏（定数表由人工完整维护，不会出现不匹配）
			if (d.constant === null || d.constant === undefined || d.constant === '') return;
			const raw = rawDiffs[difficulty] || {};
			const rawRating = raw.rating;
			const titles = buildRowTitles(song, raw, d.title);
			const row = {
				songId: songId,
				difficulty: difficulty,
				// 存进缓存的 songName 与显示/排序统一用原始英文名
				title: titles.en,
				titles: titles,
				illustration: d.illustration,
				constant: d.constant,
				// 等级（rating + ratingPlus，10+ 视为 10.5）
				rating: (rawRating === undefined || rawRating === null || rawRating === '') ? null : Number(rawRating),
				ratingPlus: raw.ratingPlus === true,
				// 曲师：难度级优先（6 张谱面换了曲师，如 Ignotus 的 BYD），否则用歌曲级
				artist: pickField(raw.artist, song.artist),
				// 收录时间（unix 秒）：难度级优先（50 张谱面自带 date，晚于歌曲本体发行），否则用歌曲级
				date: toTimestamp(pickField(raw.date, song.date)),
				idx: cat.idx,
				version: cat.version,
				packId: cat.set || 'single'
			};
			chartRows.push(row);
			rowsByKey[songId + '|' + difficulty] = row;
		});
	});
}

function buildSectionPacks() {
	sectionPacks = {};
	SECTION_ORDER.forEach(function (sec) { sectionPacks[sec] = []; });
	packs.forEach(function (p) {
		const sec = SECTION_ORDER.indexOf(p.section) !== -1 ? p.section : 'variety';
		sectionPacks[sec].push(p);
	});
	const hasSingle = chartRows.some(function (r) { return r.packId === 'single'; });
	if (hasSingle) {
		sectionPacks['single'].push({
			id: 'single',
			name_localized: { en: 'Memory Archive', 'zh-Hans': '记忆档案馆' },
			section: 'single'
		});
	}
}

function rebuildRecordsMap() {
	recordsByKey = {};
	currentArray.forEach(function (r) {
		recordsByKey[r.songId + '|' + r.difficulty] = r;
	});
}

function packName(p) {
	if (!p) return '';
	const nl = p.name_localized || {};
	let name = nl['zh-Hans'] || nl.en || p.id;
	// 附属曲包显示名前面加上父曲包名称（子包名已含父包名时不再重复）
	if (p.pack_parent && packsById[p.pack_parent]) {
		const pnl = packsById[p.pack_parent].name_localized || {};
		const parentName = pnl['zh-Hans'] || pnl.en || packsById[p.pack_parent].id;
		if (parentName && name.toLowerCase().indexOf(parentName.toLowerCase()) !== 0) {
			name = parentName + ' · ' + name;
		}
	}
	return name;
}

/* ---------- 筛选 ---------- */

/* 搜索命中：曲目ID、en 曲名、曲师、以及四种语言的标题都参与匹配（显示英文时也能用中文搜到） */
function rowMatchesSearch(row, q) {
	if (!q) return true;
	if (row.songId.toLowerCase().indexOf(q) !== -1) return true;
	if (row.title.toLowerCase().indexOf(q) !== -1) return true;
	if (String(row.artist || '').toLowerCase().indexOf(q) !== -1) return true;
	return TITLE_LANGS.some(function (lang) {
		return String(row.titles[lang] || '').toLowerCase().indexOf(q) !== -1;
	});
}

function getVisibleRows() {
	const q = searchText.toLowerCase().trim();
	return chartRows.filter(function (r) {
		if (!selectedDifficulties.has(r.difficulty)) return false;
		if (!rowMatchesSearch(r, q)) return false;
		if (onlyUnrecorded && recordsByKey[r.songId + '|' + r.difficulty]) return false;
		if (onlyRecorded && !recordsByKey[r.songId + '|' + r.difficulty]) return false;
		return true;
	});
}

function buildDifficultyFilter() {
	const html = DIF_ASC.map(function (dif) {
		return '<label class="dif-check"><input type="checkbox" data-dif="' + dif + '"'
			+ (selectedDifficulties.has(dif) ? ' checked' : '') + '> ' + dif + '</label>';
	}).join('');
	$('#difficulty-filters').html(html);
}

/* ---------- 排序比较器 ---------- */

function effConst(row) {
	return effectiveConstant(row.songId, row.difficulty);
}

/**
 * 按标题排序固定使用 title_localized 的 en 文本，与当前显示语言无关。
 * ⚠️ 比较方式是「转小写后按码元序」，**不是 `localeCompare`** —— 这是为了对齐原版游戏：
 * 只筛选 Future 时 `ii` 第 1（原名以空格开头，0x20 最小）、`[X]` 第 10
 * （`#`=0x23 < `+`=0x2B < 数字 < `[`=0x5B < 小写字母=0x61，忽略大小写后 `[X]` 正好落在数字与字母之间）。
 * 用 localeCompare 会把标点按 ICU 变体权重排到最前（`[X]` 变第 1），且 `ii` 会被并进字母 I 里。
 */
function titleCmpKey(row) {
	return String((row.titles && row.titles.en) || row.title || '').toLowerCase();
}

function cmpTitle(a, b) {
	const ta = titleCmpKey(a);
	const tb = titleCmpKey(b);
	if (ta === tb) return 0;
	return ta < tb ? -1 : 1;
}

function cmpConst(a, b) {
	const ca = effConst(a);
	const cb = effConst(b);
	if (ca === null && cb === null) return 0;
	if (ca === null) return 1;
	if (cb === null) return -1;
	return cb - ca;
}

/* 按日期：新的在前（与「按全曲定数」同为降序，勾「逆向排序」即转成从旧到新） */
function cmpDate(a, b) {
	const da = a.date;
	const db = b.date;
	if (da === null && db === null) return 0;
	if (da === null) return 1; // 没有收录时间的排最后
	if (db === null) return -1;
	return db - da;
}

/* 按作曲家：忽略大小写码元序升序（与「按标题」同口径），同一曲师的曲子自然聚在一起 */
function cmpArtist(a, b) {
	const aa = String(a.artist || '').toLowerCase();
	const ab = String(b.artist || '').toLowerCase();
	if (aa === ab) return 0;
	return aa < ab ? -1 : 1;
}

/* 按评级：好的在前（PM → 无），同评级内按分数从高到低 */
function cmpGrade(a, b) {
	const ra = gradeRank(gradeOf(a));
	const rb = gradeRank(gradeOf(b));
	if (ra !== rb) return rb - ra;
	const sa = rowScore(a);
	const sb = rowScore(b);
	if (sa === null && sb === null) return 0;
	if (sa === null) return 1;
	if (sb === null) return -1;
	return sb - sa;
}

/* 当前排序方向：正序为 1，逆向为 -1 */
function sortDir() {
	return sortReversed ? -1 : 1;
}

/* 同曲目不同难度的正序：ETR -> BYD -> FTR -> PRS -> PST */
function difAsc(a, b) {
	return DIF_DESC.indexOf(a.difficulty) - DIF_DESC.indexOf(b.difficulty);
}

/**
 * 按当前视图（排序方式）对一组谱面排序。
 * 分组视图下是「组内排序」，无分组时是整体排序；末尾都用 idx 兜底保证顺序稳定。
 */
function sortRows(rows) {
	const dir = sortDir();
	const arr = rows.slice();
	if (viewMode === 'title') {
		arr.sort(function (a, b) { return dir * (cmpTitle(a, b) || difAsc(a, b) || (a.idx - b.idx)); });
	} else if (viewMode === 'constant') {
		arr.sort(function (a, b) { return dir * (cmpConst(a, b) || difAsc(a, b) || (a.idx - b.idx)); });
	} else if (viewMode === 'date') {
		arr.sort(function (a, b) { return dir * (cmpDate(a, b) || difAsc(a, b) || (a.idx - b.idx)); });
	} else if (viewMode === 'artist') {
		arr.sort(function (a, b) { return dir * (cmpArtist(a, b) || cmpTitle(a, b) || difAsc(a, b) || (a.idx - b.idx)); });
	} else if (viewMode === 'grade') {
		arr.sort(function (a, b) { return dir * (cmpGrade(a, b) || difAsc(a, b) || (a.idx - b.idx)); });
	} else {
		arr.sort(function (a, b) { return dir * ((a.idx - b.idx) || difAsc(a, b)); });
	}
	return arr;
}

/* ---------- 分组键：等级 / 评级 ---------- */

/* 等级数值：rating + ratingPlus 视为 rating + 0.5（10+ 即 10.5），用于升序排列 */
function levelValue(row) {
	if (row.rating === null) return null;
	return row.rating + (row.ratingPlus ? 0.5 : 0);
}

/* 等级显示文本：9 / 9+ / 10 / 10+ */
function levelLabel(row) {
	if (row.rating === null) return '未知';
	return String(row.rating) + (row.ratingPlus ? '+' : '');
}

/* 该谱面在缓存里的成绩记录（没有则 null） */
function recordOf(row) {
	return recordsByKey[row.songId + '|' + row.difficulty];
}

/* 该谱面的分数（无记录 / 非法值返回 null） */
function rowScore(row) {
	const rec = recordOf(row);
	if (!rec) return null;
	const s = Number(rec.score);
	return isFinite(s) ? s : null;
}

/* 评级：无成绩记录记作「无」，否则用 CommonFunctions.getSongRanking 判定（FR 需要 far>0 且 lost=0） */
function gradeOf(row) {
	const rec = recordOf(row);
	const score = rowScore(row);
	if (!rec || score === null || score < 0) return '无';
	return getSongRanking(score, Number(rec.far) || 0, Number(rec.lost) || 0) || '无';
}

function gradeRank(g) {
	const i = GRADE_ORDER.indexOf(g);
	return i === -1 ? GRADE_ORDER.length : i;
}

/* ---------- 渲染 ---------- */

function esc(s) {
	return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function (c) {
		return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
	});
}

function groupHeaderHtml(cls, title, count) {
	return '<div class="' + cls + ' group-header">'
		+ '<span class="collapse-arrow">▾</span>'
		+ '<span class="group-title">' + title + '</span>'
		+ '<span class="pack-count">' + count + ' 谱面</span>'
		+ '</div>';
}

function groupRowsHtml(rows) {
	return '<div class="group-rows">' + rows.map(rowHtml).join('') + '</div>';
}

function applyCollapsed($list) {
	collapsedGroups.forEach(function (gid) {
		$list.find('[data-group="' + gid + '"]').addClass('collapsed');
	});
}

function rowHtml(r) {
	const key = r.songId + '|' + r.difficulty;
	const rec = recordsByKey[key];
	const c = effConst(r);
	const scoreVal = rec ? rec.score : '';
	const pVal = rec ? rec.perfect : '';
	const cpVal = rec ? rec.criticalPerfect : '';
	const fVal = rec ? rec.far : '';
	const lVal = rec ? rec.lost : '';
	let ptt = '—';
	if (scoreVal !== '' && c !== null) {
		ptt = toFloor(calculateSingleRating(parseFloat(scoreVal), c, 4), 4);
	}
	const constHtml = c !== null
		? '<span class="row-const">定数 ' + c + '</span>'
		: '<span class="row-const missing">定数未收录</span>'
			+ '<input class="inp-const" type="number" step="0.1" min="1" max="12.5" placeholder="填定数" value="'
			+ esc(overrides[key] === undefined ? '' : overrides[key]) + '">';
	return '<div class="score-row" data-key="' + esc(key) + '">'
		+ '<img class="row-ill" src="Processed_Illustration/' + esc(r.illustration)
		+ '" loading="lazy" onerror="this.style.visibility=\'hidden\'">'
		+ '<div class="row-info">'
		+ '<div class="row-title">' + esc(shownTitle(r)) + '</div>'
		+ '<div class="row-meta"><span class="diff-badge diff-' + r.difficulty.toLowerCase() + '">' + r.difficulty + '</span>' + constHtml
		+ (r.artist ? '<span class="row-artist" title="' + esc(r.artist) + '">' + esc(r.artist) + '</span>' : '') + '</div>'
		+ '</div>'
		+ '<div class="row-inputs">'
		+ '<label class="inp-score-wrap">分数<input class="inp-score" type="number" inputmode="numeric" min="0" max="10000100" placeholder="—" value="' + esc(scoreVal) + '"></label>'
		+ '<label>P<input class="inp-p" type="number" min="0" placeholder="—" value="' + esc(pVal) + '"></label>'
		+ '<label>P+<input class="inp-cp" type="number" min="0" placeholder="—" value="' + esc(cpVal) + '"></label>'
		+ '<label>F<input class="inp-f" type="number" min="0" placeholder="—" value="' + esc(fVal) + '"></label>'
		+ '<label>L<input class="inp-l" type="number" min="0" placeholder="—" value="' + esc(lVal) + '"></label>'
		+ '</div>'
		+ '<div class="row-ptt"><span class="ptt-value">' + ptt + '</span><small>单曲PTT</small></div>'
		+ '<div class="row-actions">'
		+ '<button class="btn-small save-row" type="button">保存</button>'
		+ '<button class="btn-small clear-row" type="button">清空</button>'
		+ '</div>'
		+ '</div>';
}

/**
 * 渲染入口：先按当前分组方式把筛选结果分组，再在每组内按视图（排序方式）排序；
 * 分组为「无」时不分块，直接整体排序输出。
 */
function render() {
	const rows = getVisibleRows();
	updateStats(rows);
	savePrefs(); // 所有改动视图设置的入口最后都会走到这里，单点保存不会漏
	$('#collapse-actions').attr('hidden', groupMode === 'none');
	const $list = $('#chart-list').empty();
	if (!rows.length) {
		$list.append('<div class="empty-tip">没有符合筛选条件的谱面</div>');
		return;
	}
	if (groupMode === 'none') {
		$list.html(sortRows(rows).map(rowHtml).join(''));
		return;
	}
	let html;
	if (groupMode === 'pack') html = packGroupHtml(rows);
	else if (groupMode === 'version') html = flatGroupHtml(buildVersionGroups(rows), 'ver');
	else if (groupMode === 'level') html = flatGroupHtml(buildLevelGroups(rows), 'lvl');
	else html = flatGroupHtml(buildGradeGroups(rows), 'gr');
	$list.html(html);
	applyCollapsed($list);
}

/* 扁平分组（版本 / 等级 / 评级）的统一输出：组标题右侧带组内谱面数（外观复用 ver-block/ver-header） */
function flatGroupHtml(groups, prefix) {
	return groups.map(function (g) {
		return '<div class="ver-block group-block" data-group="' + prefix + ':' + esc(g.id) + '">'
			+ groupHeaderHtml('ver-header', esc(g.title), g.rows.length)
			+ groupRowsHtml(sortRows(g.rows))
			+ '</div>';
	}).join('');
}

/* 按游戏版本分组：版本号数值升序（无法解析的排最后），组内按视图排序 */
function versionCompare(a, b) {
	if (a === b) return 0;
	if (a === '' || a === '未知') return 1;
	if (b === '' || b === '未知') return -1;
	const pa = String(a).split('.').map(Number);
	const pb = String(b).split('.').map(Number);
	const len = Math.max(pa.length, pb.length);
	for (let i = 0; i < len; i++) {
		const x = i < pa.length ? pa[i] : 0;
		const y = i < pb.length ? pb[i] : 0;
		if (x !== y) return x - y;
	}
	return 0;
}

function buildVersionGroups(rows) {
	const byVer = {};
	rows.forEach(function (r) {
		const key = r.version || '未知';
		(byVer[key] = byVer[key] || []).push(r);
	});
	const keys = Object.keys(byVer).sort(function (a, b) {
		return sortDir() * versionCompare(a, b);
	});
	return keys.map(function (v) {
		return {
			id: v,
			title: v === '未知' ? '未知版本' : '版本 ' + v,
			rows: byVer[v]
		};
	});
}

/* 按等级分组：rating + ratingPlus 视为 rating + 0.5，升序（9 -> 9+ -> 10 -> 10+） */
function buildLevelGroups(rows) {
	const byLvl = {};
	rows.forEach(function (r) {
		const v = levelValue(r);
		const key = v === null ? '未知' : String(v);
		(byLvl[key] = byLvl[key] || []).push(r);
	});
	const keys = Object.keys(byLvl).sort(function (a, b) {
		if (a === '未知') return 1;
		if (b === '未知') return -1;
		return sortDir() * (parseFloat(a) - parseFloat(b));
	});
	return keys.map(function (k) {
		return {
			id: k,
			title: k === '未知' ? '未知等级' : '等级 ' + levelLabel(byLvl[k][0]),
			rows: byLvl[k]
		};
	});
}

/* 按评级分组：无 -> D -> C -> B -> A -> AA -> EX -> EX+ -> FR -> PM */
function buildGradeGroups(rows) {
	const byGrade = {};
	rows.forEach(function (r) {
		const g = gradeOf(r);
		(byGrade[g] = byGrade[g] || []).push(r);
	});
	const keys = Object.keys(byGrade).sort(function (a, b) {
		return sortDir() * (gradeRank(a) - gradeRank(b));
	});
	return keys.map(function (g) {
		// 评级的谱面数量（过滤后）
		return { id: g, title: '评级 ' + g, rows: byGrade[g] };
	});
}

/* 按曲包分组：沿用「章节 -> 曲包 -> 谱面」两级结构，谱面按视图排序 */
function packGroupHtml(rows) {
	const byPack = {};
	rows.forEach(function (r) {
		(byPack[r.packId] = byPack[r.packId] || []).push(r);
	});
	const html = [];
	const secOrder = sortReversed ? SECTION_ORDER.slice().reverse() : SECTION_ORDER;
	secOrder.forEach(function (sec) {
		let secPacks = (sectionPacks[sec] || []).filter(function (p) {
			return byPack[p.id] && byPack[p.id].length;
		});
		if (!secPacks.length) return;
		if (sortReversed) secPacks = secPacks.slice().reverse();
		const packsHtml = secPacks.map(function (p) {
			return '<div class="pack-block group-block" data-group="pack:' + p.id + '">'
				+ groupHeaderHtml('pack-header', esc(packName(p)), byPack[p.id].length)
				+ groupRowsHtml(sortRows(byPack[p.id]))
				+ '</div>';
		}).join('');
		const secCount = secPacks.reduce(function (n, p) { return n + byPack[p.id].length; }, 0);
		html.push('<div class="section-block group-block" data-group="sec:' + sec + '">'
			+ groupHeaderHtml('section-header', esc(SECTION_NAMES[sec] || sec), secCount)
			+ '<div class="group-rows">' + packsHtml + '</div>'
			+ '</div>');
	});
	return html.join('');
}

/* ---------- 统计 ---------- */

/* rows 为当前筛选结果；省略时自行计算（保存/清空等编辑器入口调用） */
function updateStats(rows) {
	const packCount = new Set(chartRows.map(function (r) { return r.packId; })).size;
	const songCount = new Set(chartRows.map(function (r) { return r.songId; })).size;
	let recorded = 0;
	chartRows.forEach(function (r) {
		if (recordsByKey[r.songId + '|' + r.difficulty]) recorded++;
	});
	const visible = (rows || getVisibleRows()).length;
	$('#stats-bar').html(
		'曲包 <strong>' + packCount + '</strong> · 曲目 <strong>' + songCount + '</strong> · 谱面 <strong>' + chartRows.length + '</strong>'
		+ ' · 已记录 <strong class="stat-ok">' + recorded + '</strong> · 未记录 <strong class="stat-warn">' + (chartRows.length - recorded) + '</strong>'
		+ ' · 当前显示 <strong>' + visible + '</strong> 行'
	);
}

/* ---------- 编辑 ---------- */

/**
 * 按单曲潜力值（playRating）从高到低重排缓存并写回，同时同步 innerIndex，
 * 保证 index / b30gen 等按数组顺序展示的页面能直观反映最新成绩
 */
function sortAndPersistScores() {
	currentArray.sort(function (a, b) {
		const pa = (a.playRating === null || a.playRating === undefined) ? -Infinity : a.playRating;
		const pb = (b.playRating === null || b.playRating === undefined) ? -Infinity : b.playRating;
		return pb - pa;
	});
	currentArray.forEach(function (r, i) {
		r.innerIndex = i;
	});
	rebuildRecordsMap();
	saveLocalStorage(currentArray);
}

function rowElToKey(el) {
	const rowEl = $(el).closest('.score-row')[0];
	return rowEl ? rowEl.getAttribute('data-key') : null;
}

function saveRowByEl(el) {
	const key = rowElToKey(el);
	if (!key) return;
	const rowEl = $(el).closest('.score-row');
	const row = rowsByKey[key];
	if (!row) return;
	const scoreVal = parseFloat(rowEl.find('.inp-score').val());
	if (isNaN(scoreVal) || scoreVal < 0) {
		showToast('请输入有效的分数');
		return;
	}
	const readOpt = function (sel, fallback) {
		const v = rowEl.find(sel).val();
		return v === '' || v === null || v === undefined ? fallback : parseFloat(v);
	};
	const old = recordsByKey[key];
	const constant = effConst(row);
	if (constant === null) {
		showToast('该谱面定数未收录，请先填写定数');
		return;
	}
	const perfect = readOpt('.inp-p', old ? old.perfect : 0);
	const criticalPerfect = readOpt('.inp-cp', old ? old.criticalPerfect : 0);
	const far = readOpt('.inp-f', old ? old.far : 0);
	const lost = readOpt('.inp-l', old ? old.lost : 0);
	// 同一谱面可能存在多条重复记录（如旧版本地缓存），保存时对全部同名记录统一生效，避免其他页面仍读到旧值
	const mkRecord = function (i) {
		return new PlayResult(row.title, row.songId, row.difficulty, scoreVal,
			perfect, criticalPerfect, far, lost, constant, 0, i);
	};
	if (currentArray.some(function (r) { return r.songId === row.songId && r.difficulty === row.difficulty; })) {
		currentArray = currentArray.map(function (r, i) {
			return (r.songId === row.songId && r.difficulty === row.difficulty) ? mkRecord(i) : r;
		});
	} else {
		currentArray.push(mkRecord(currentArray.length));
	}
	sortAndPersistScores();
	updateStats();
	render();
	showToast('已保存：' + row.title + ' ' + row.difficulty);
}

function clearRowByEl(el) {
	const key = rowElToKey(el);
	if (!key) return;
	const row = rowsByKey[key];
	const old = recordsByKey[key];
	if (!old) {
		showToast('该谱面本来就没有记录');
		return;
	}
	if (!confirm('确定清空 ' + row.title + ' ' + row.difficulty + ' 的成绩记录吗？')) return;
	currentArray = currentArray.filter(function (r) {
		return !(r.songId === row.songId && r.difficulty === row.difficulty);
	});
	sortAndPersistScores();
	updateStats();
	render();
	showToast('已清空：' + row.title + ' ' + row.difficulty);
}

function saveConstOverrideByEl(el) {
	const key = rowElToKey(el);
	if (!key) return;
	const v = parseFloat($(el).val());
	if (isNaN(v) || v <= 0) {
		delete overrides[key];
	} else {
		overrides[key] = Math.round(v * 100) / 100;
	}
	saveConstantOverrides(overrides);
	// 同步已存在记录的定数字段
	const old = recordsByKey[key];
	if (old) {
		const c = overrides[key] !== undefined ? overrides[key] : effectiveConstant(key.split('|')[0], key.split('|')[1]);
		currentArray = currentArray.map(function (r, i) {
			if (r.songId === old.songId && r.difficulty === old.difficulty) {
				return new PlayResult(r.songName, r.songId, r.difficulty, r.score,
					r.perfect, r.criticalPerfect, r.far, r.lost, c, 0, i);
			}
			return r;
		});
		sortAndPersistScores();
	}
	const row = rowsByKey[key];
	updateStats();
	render();
	showToast('定数已更新：' + row.title + ' ' + row.difficulty + ' → ' + (overrides[key] !== undefined ? overrides[key] : '未收录'));
}

function updatePttPreview(el) {
	const key = rowElToKey(el);
	if (!key) return;
	const row = rowsByKey[key];
	const rowEl = $(el).closest('.score-row');
	const scoreVal = parseFloat(rowEl.find('.inp-score').val());
	const c = effConst(row);
	const $ptt = rowEl.find('.ptt-value');
	if (isNaN(scoreVal) || c === null) {
		$ptt.text('—');
	} else {
		$ptt.text(toFloor(calculateSingleRating(scoreVal, c, 4), 4));
	}
}

/* ---------- 导出 / 载入 ---------- */

function exportScores() {
	const now = new Date();
	const dateStr = now.getFullYear()
		+ ('00' + (now.getMonth() + 1)).slice(-2)
		+ ('00' + now.getDate()).slice(-2);
	const data = {
		app: 'arcaea-scores',
		version: Number(DATA_VERSION),
		exportedAt: now.toISOString(),
		records: currentArray,
		constantOverrides: overrides
	};
	const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = 'ArcaeaScores_' + dateStr + '.json';
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	URL.revokeObjectURL(url);
	showToast('已导出 ' + currentArray.length + ' 条记录');
}

/**
 * 导出为 CSV：包含全部谱面（含无成绩的空行，方便填写后导入）。
 * 列与全站 CSV 分数表口径一致；score 为空的行导入时会被跳过，不会产生 0 分记录。
 */
function exportScoresCsv() {
	const now = new Date();
	const dateStr = now.getFullYear()
		+ ('00' + (now.getMonth() + 1)).slice(-2)
		+ ('00' + now.getDate()).slice(-2);
	const header = ['songname', 'songId', 'Difficulty', 'score', 'Perfect', 'criticalPerfect', 'Far', 'Lost', 'realDifficulty', 'singlePTT'];
	const lines = [header.join(',')];
	chartRows.forEach(function (row) {
		const rec = recordsByKey[row.songId + '|' + row.difficulty];
		let singlePtt = '';
		if (rec) {
			// 按分数+定数重新计算，避免存量 playRating 缺失/为 0 导致导出为空
			singlePtt = Math.round(calculateSingleRating(rec.score, row.constant, 4) * 10000) / 10000;
		}
		const fields = [
			csvEscapeField(row.title),
			row.songId,
			row.difficulty,
			rec ? rec.score : '',
			rec ? rec.perfect : '',
			rec ? rec.criticalPerfect : '',
			rec ? rec.far : '',
			rec ? rec.lost : '',
			row.constant,
			singlePtt
		];
		lines.push(fields.join(','));
	});
	const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = 'ArcaeaScores_' + dateStr + '.csv';
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	URL.revokeObjectURL(url);
	showToast('已导出 ' + chartRows.length + ' 行谱面（含未记录）');
}

// 统一成绩文件上传：st3 / CSV / score.json / 带缓存的图片
function onScoresLoaded(arr) {
	rebuildRecordsMap();
	updateStats();
	render();
}

/* ---------- 偏好设置持久化（视图 / 分组 / 语言 / 筛选条件） ---------- */

/**
 * 存下当前的视图设置，下次打开本页时接续（localStorage 键 arcaea-scores-view-v1）。
 * 只在 render() 里调用 —— 所有会改这些设置的入口最后都会走 render()，单点保存不会漏。
 * 搜索框内容与分组折叠状态属于「临时查询/浏览状态」，不持久化。
 */
function savePrefs() {
	try {
		localStorage.setItem(PREFS_KEY, JSON.stringify({
			v: 1,
			view: viewMode,
			group: groupMode,
			lang: langMode,
			difficulties: DIF_ASC.filter(function (d) { return selectedDifficulties.has(d); }),
			onlyUnrecorded: onlyUnrecorded,
			onlyRecorded: onlyRecorded,
			sortReversed: sortReversed,
			toolbarCollapsed: $('#toolbar').hasClass('collapsed')
		}));
	} catch (e) {
		console.warn('savePrefs error:', e);
	}
}

function loadPrefs() {
	try {
		const raw = localStorage.getItem(PREFS_KEY);
		return raw ? JSON.parse(raw) : null;
	} catch (e) {
		console.warn('loadPrefs error:', e);
		return null;
	}
}

/**
 * 恢复上次的视图设置。
 * **任何字段非法都退回默认值**（版本升级后选项被改名、手改过存储、数据损坏都不能把页面搞崩），
 * 恢复完顺手把控件显示同步好，这样 `buildDifficultyFilter()` 与首次 `render()` 直接是对的。
 */
function restorePrefs() {
	const p = loadPrefs();
	if (!p || typeof p !== 'object') return;
	if (VIEW_OPTIONS.indexOf(p.view) !== -1) viewMode = p.view;
	if (GROUP_OPTIONS.indexOf(p.group) !== -1) groupMode = p.group;
	if (LANG_OPTIONS.indexOf(p.lang) !== -1) langMode = p.lang;
	if (Array.isArray(p.difficulties)) {
		const valid = p.difficulties.filter(function (d) { return DIF_ASC.indexOf(d) !== -1; });
		// 存下来的值一个都不认识（选项改名/数据损坏）时保留默认，别直接筛成空列表；
		// 存的就是空数组（用户主动全不勾）则照实恢复
		if (valid.length || !p.difficulties.length) selectedDifficulties = new Set(valid);
	}
	onlyUnrecorded = p.onlyUnrecorded === true;
	onlyRecorded = p.onlyRecorded === true && !onlyUnrecorded; // 两者互斥，非法组合只保留一个
	sortReversed = p.sortReversed === true;

	$('#view-select').val(viewMode);
	$('#group-select').val(groupMode);
	$('#lang-select').val(langMode);
	$('#only-unrecorded').prop('checked', onlyUnrecorded);
	$('#only-recorded').prop('checked', onlyRecorded);
	$('#sort-reversed').prop('checked', sortReversed);
	if (p.toolbarCollapsed === true) {
		$('#toolbar').addClass('collapsed');
		$('#toolbar-toggle').attr('aria-expanded', 'false');
	}
}

async function importScoresFile(file) {
	const n = await handleScoreFileUpload(file);
	if (n) showToast('成功导入 ' + n + ' 条记录');
}

/* ---------- 提示 ---------- */

let toastTimer = null;
function showToast(msg) {
	const $t = $('#toast');
	$t.text(msg).attr('hidden', false).addClass('show');
	if (toastTimer) clearTimeout(toastTimer);
	toastTimer = setTimeout(function () {
		$t.removeClass('show').attr('hidden', true);
	}, 1800);
}

/* ---------- 事件绑定 ---------- */

function bindEvents() {
	$('#view-select').on('change', function () {
		viewMode = this.value;
		render();
	});
	$('#group-select').on('change', function () {
		groupMode = this.value;
		render();
	});
	$('#lang-select').on('change', function () {
		langMode = this.value;
		render();
	});
	$('#difficulty-filters').on('change', 'input[type=checkbox]', function () {
		const dif = $(this).data('dif');
		if (this.checked) selectedDifficulties.add(dif);
		else selectedDifficulties.delete(dif);
		render();
	});
	$('#search-input').on('input', function () {
		searchText = this.value;
		render();
	});
	$('#only-unrecorded').on('change', function () {
		onlyUnrecorded = this.checked;
		if (onlyUnrecorded) {
			onlyRecorded = false;
			$('#only-recorded').prop('checked', false);
		}
		render();
	});
	$('#only-recorded').on('change', function () {
		onlyRecorded = this.checked;
		if (onlyRecorded) {
			onlyUnrecorded = false;
			$('#only-unrecorded').prop('checked', false);
		}
		render();
	});
	$('#sort-reversed').on('change', function () {
		sortReversed = this.checked;
		render();
	});
	$('#toolbar-toggle').on('click', function () {
		const collapsed = $('#toolbar').toggleClass('collapsed').hasClass('collapsed');
		$(this).attr('aria-expanded', String(!collapsed));
		savePrefs(); // 工具栏收起状态也只在这里变，render() 覆盖不到
	});
	$('#export-btn').on('click', exportScores);
	$('#export-csv-btn').on('click', exportScoresCsv);
	$('#import-btn').on('click', function () { $('#import-file').trigger('click'); });
	$('#import-file').on('change', function () {
		const file = this.files[0];
		if (file) importScoresFile(file);
		this.value = '';
	});
	$('#collapse-all-btn').on('click', function () {
		$('#chart-list .group-block').each(function () {
			const gid = this.getAttribute('data-group');
			if (gid) collapsedGroups.add(gid);
		});
		$('#chart-list .group-block').addClass('collapsed');
	});
	$('#expand-all-btn').on('click', function () {
		collapsedGroups.clear();
		$('#chart-list .group-block').removeClass('collapsed');
	});

	$('#chart-list')
		.on('click', '.group-header', function () {
			const block = $(this).closest('.group-block');
			const gid = block.attr('data-group');
			block.toggleClass('collapsed');
			if (gid) {
				if (block.hasClass('collapsed')) collapsedGroups.add(gid);
				else collapsedGroups.delete(gid);
			}
		})
		.on('click', '.row-ill', function () { showSongDetail(this); })
		.on('click', '.save-row', function () { saveRowByEl(this); })
		.on('click', '.clear-row', function () { clearRowByEl(this); })
		.on('change', '.inp-const', function () { saveConstOverrideByEl(this); })
		.on('input', '.inp-score', function () { updatePttPreview(this); })
		.on('keydown', '.inp-score', function (e) {
			if (e.key === 'Enter') saveRowByEl(this);
		});

	$('#song-detail-close').on('click', closeSongDetail);
	$('#song-detail-bg').on('click', closeSongDetail);
	$(document).on('keydown', function (e) {
		if (e.key === 'Escape') closeSongDetail();
	});
}

/* ---------- 曲目详情（点击曲绘） ---------- */

const SONG_DETAIL_DIF = {
	0: { short: 'PST', long: 'Past' },
	1: { short: 'PRS', long: 'Present' },
	2: { short: 'FTR', long: 'Future' },
	3: { short: 'BYD', long: 'Beyond' },
	4: { short: 'ETR', long: 'Eternal' }
};

function showSongDetail(el) {
	const key = rowElToKey(el);
	if (!key) return;
	const row = rowsByKey[key];
	if (!row) return;
	const song = songlistDetail[row.songId];
	const cat = songCatalog[row.songId];
	if (!song || !cat) {
		showToast('未找到曲目信息');
		return;
	}
	let packNameStr = cat.set || '记忆档案馆';
	if (cat.set && packsById[cat.set]) packNameStr = packName(packsById[cat.set]);
	const sideMap = { 0: '光侧', 1: '纷争侧' };
	const sideStr = sideMap[song.side] !== undefined ? sideMap[song.side] : String(song.side);
	let dateStr = '';
	if (song.date) {
		const dt = new Date(song.date * 1000);
		dateStr = dt.getFullYear() + '/' + ('0' + (dt.getMonth() + 1)).slice(-2) + '/' + ('0' + dt.getDate()).slice(-2);
	}
	const infoRow = function (label, value) {
		return '<div class="info-row"><span class="info-label">' + label + '</span><span class="info-value">' + esc(value) + '</span></div>';
	};
	let html = infoRow('曲名', cat.title);
	const tl = song.title_localized || {};
	const aliases = Object.keys(tl).filter(function (k) { return tl[k] && tl[k] !== cat.title; })
		.map(function (k) { return tl[k]; });
	if (aliases.length) {
		html += '<div class="info-row"><span class="info-label">别名</span><span class="info-value">'
			+ aliases.map(esc).join('<br>') + '</span></div>';
	}
	html += infoRow('曲目ID', song.id);
	if (song.artist) html += infoRow('曲师', song.artist);
	if (song.bpm) html += infoRow('BPM', song.bpm);
	html += infoRow('所属曲包', packNameStr);
	if (song.version) html += infoRow('版本', song.version);
	html += infoRow('主题', sideStr);
	if (dateStr) html += infoRow('收录时间', dateStr);
	html += '<div class="song-detail-diffs">';
	(song.difficulties || []).forEach(function (d) {
		// Inscribed 与 Beyond 共用 ratingClass=3，靠 ratingClassAlias=1 区分
		const m = (d.ratingClassAlias === 1)
			? { short: 'INS', long: 'Inscribed' }
			: SONG_DETAIL_DIF[d.ratingClass];
		const shortName = m ? m.short : ('难度' + d.ratingClass);
		const longName = m ? m.long : shortName;
		const diffCat = cat.difficulties[longName];
		const constant = (diffCat && diffCat.constant !== null && diffCat.constant !== undefined) ? diffCat.constant : '—';
		const active = m && row.difficulty === m.long ? ' diff-line-active' : '';
		html += '<div class="diff-line' + active + '">'
			+ '<span class="diff-badge diff-' + shortName.toLowerCase() + '">' + shortName + '</span>'
			+ '<span>定数 ' + constant + '</span>'
			+ (d.chartDesigner ? '<span class="diff-designer">谱师</span><span class="diff-designer-name">' + esc(d.chartDesigner) + '</span>' : '')
			+ (d.jacketDesigner ? '<span class="diff-designer">曲绘</span><span class="diff-designer-name">' + esc(d.jacketDesigner) + '</span>' : '')
			+ '</div>';
	});
	html += '</div>';

	$('#song-detail-title').text(cat.title);
	$('#song-detail-ill').css('visibility', 'visible').attr('src', 'Processed_Illustration/' + (row.illustration || row.songId + '.jpg'));
	$('#song-detail-info').html(html);
	$('#song-detail-modal').removeAttr('hidden');
}

function closeSongDetail() {
	$('#song-detail-modal').attr('hidden', true);
}


/* ===== 识图工具窗：覆盖成绩后 → 重新读缓存 + 刷新显示单元 ===== */
registerOcrAppliedHandler(function () {
	currentArray = readLocalStorage() || [];
	rebuildRecordsMap();
	updateStats();
	render();
});
