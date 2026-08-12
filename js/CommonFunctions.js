let songlistPath = 'json/songlist';      // 游戏解包全量曲目（版本更新时整体替换）
let constantsPath = 'json/constants.json'; // 唯一手维护文件：idx -> 各难度定数
let aiChanPath = 'json/AiChan.json'
// let difficultyPair = {'Past': 'PST', 'Present': 'PRS', 'Future': 'FTR', 'Beyond': 'BYD', 'Eternal': 'ETR'};
let aiChanList = [];
let difList = ['Past', 'Present', 'Future', 'Beyond', 'Eternal'];
let query = ''; // 运行时生成的SQL查询文本（由 initializeSongData 生成）
let songCatalog = {}; // songId -> {idx, title, artist, difficulties: {Difficulty: {title, illustration, constant}}}
let songlistDetail = {}; // songId -> songlist 原始条目（详情弹窗等用途）
let DATA_VERSION = 2; // localStorage 数据版本号，数据结构变更时+1
let songDataReady = false; // 曲目数据（songlist + constants.json）是否已加载完成
let dataVersion = ''; // 数据版本（读取自 constants.json 的 version 字段）
let dataUpdatedAt = ''; // 数据更新时间（读取自 constants.json 的 updatedAt 字段）

/**
 * 每条成绩存储为一个对象，所有对象存储在currentArray数组中
 * 属性按顺序为：曲名，曲目ID，难度，分数，perfect总数，大p数，far数，lost数，定数，单曲潜力值依次录入
 * 缺少的属性设置为0或1
 * 
 */
class PlayResult {
	/**
	 * @param {String} songName	曲名
	 * @param {String} songId	曲目ID
	 * @param {String} difficulty	难度
	 * @param {String} score	分数
	 * @param {Number} perfect	pure数
	 * @param {Number} criticalPerfect	大p数
	 * @param {Number} far	far数
	 * @param {Number} lost	lost数
	 * @param {Number} constant	定数
	 * @param {Number} playRating	单曲潜力值
	 * @param {Number} innerIndex	内部排序索引
   * --以下为可选参数-
	 * @param {Number} loseScore		失分数
	 * @param {Number} maxLoseScore		最大失分数
	 * @param {Number} objectAmount		物量
	 */
	loseScore = 0;
	constructor(songName, songId, difficulty, score,
		perfect, criticalPerfect, far, lost,
		constant, playRating, innerIndex,
		loseScore, maxLoseScore, objectAmount) {

		if (diffIllMapping) {
			const diffSongId = diffIllMapping[songId];
			if (diffSongId && diffSongId[difficulty]) {
				this.illustration = (songId + diffSongId[difficulty] + ".jpg");
			} else {
				// this.illustration = (illusPath + songId + ".jpg");
				this.illustration = (songId + ".jpg");
			}
		} else {
			this.illustration = ("sayonarahatsukoi.jpg");
		}
		if (diffSongNameMapping) {
			const diffSongId = diffSongNameMapping[songId];
			if (diffSongId && diffSongId[difficulty]) {
				this.songName = diffSongId[difficulty];
			} else {
				this.songName = songName;
			}
		} else {
			this.songName = "Sayounara Hatsukoi";
		}

		this.innerIndex = innerIndex;
		// this.percentage = 0;
		this.songId = songId;
		this.difficulty = difficulty;
		this.score = score ? score : 0;
		this.perfect = perfect ? perfect : 0;
		this.criticalPerfect = criticalPerfect ? criticalPerfect : 0;
		this.normalPerfect = this.perfect - this.criticalPerfect;
		this.criticalRate = this.perfect > 0 ? this.criticalPerfect / this.perfect : 0;
		this.far = far ? far : 0;
		this.lost = lost ? lost : 0;
		this.constant = constant;
		this.playRating = playRating ? playRating : calculateSingleRating(score, constant, 5);
		// this.loseScore = loseScore ? loseScore : 0;
		if (loseScore) {
			this.loseScore = loseScore;
			this.percentage = Math.abs(loseScore / maxLoseScore);
			this.percentage = (this.constant * 38 - this.loseScore) / (this.constant * 38) * 100;
		} else {
			this.loseScore = getLoseScore(constant, score, perfect + far + lost, criticalPerfect);
		}
		if (maxLoseScore) {
			this.percentage = (maxLoseScore - loseScore) / maxLoseScore * 100;
		} else {
			this.percentage = (this.constant * 38 - this.loseScore) / (this.constant * 38) * 100;
		}

		if (objectAmount) {
			this.objectAmount = objectAmount;
		} else {
			this.objectAmount = this.perfect + this.far + this.lost;
		}

		this.equivalentFar = this.far + this.lost * 2;


	};

	setEquivalentFar(eqFar) {
		this.equivalentFar = eqFar;
	}

	setAccuracy(acc) {
		this.criticalPerfect = acc;
	}
}

/**
 * 初始化Sqlite.js
 */
function initializeSqliteJs() {
	// 加载sqlite组件
	let config = {
		locateFile: () => sqlWasmPath,
	};

	// let myScatterChart;
	//初始化
	return initSqlJs(config).then(function (sqlModule) {
		SQL = sqlModule;
		console.log("sql.js initialized");
	});

}
/**
 * 初始化曲目数据：读取 songlist + constants.json，派生全谱面目录、差分映射并生成SQL文本
 * 应在页面加载早期调用一次，先于 st3 上传/渲染
 */
async function initializeSongData() {
	try {
		const [slResponse, cResponse] = await Promise.all([
			fetch(songlistPath),
			fetch(constantsPath)
		]);
		if (!slResponse.ok || !cResponse.ok) {
			throw new Error(`HTTP error! songlist: ${slResponse.status}, constants: ${cResponse.status}`);
		}
		const rawSonglist = (await slResponse.json()).songs;
		const constantsFile = await cResponse.json();
		const constantsByIdx = constantsFile.songConstants || {};
		dataVersion = constantsFile.version || '';
		dataUpdatedAt = constantsFile.updatedAt || '';

		// 派生全谱面目录与两张差分映射（曲名/曲绘覆盖全部来自 songlist 的难度级字段）
		diffSongNameMapping = {};
		diffIllMapping = {};
		songCatalog = {};
		songlist = {};
		songlistDetail = {};
		const DIF_BY_CLASS = { 0: 'Past', 1: 'Present', 2: 'Future', 3: 'Beyond', 4: 'Eternal' };
		const CONST_KEY_BY_DIF = { Past: 'PST', Present: 'PRS', Future: 'FTR', Beyond: 'BYD', Eternal: 'ETR' };
		rawSonglist.forEach(function (song) {
			const songId = song.id;
			const baseTitle = pickTitle(song);
			const cat = {
				idx: song.idx,
				title: baseTitle,
				artist: song.artist || '',
				set: song.set || '',
				version: song.version || '',
				difficulties: {}
			};
			songlist[song.idx] = songId;
			songlistDetail[song.id] = song;
			(song.difficulties || []).forEach(function (d) {
				const key = DIF_BY_CLASS[d.ratingClass];
				if (!key) return;
				const diffTitle = (d.title_localized && d.title_localized.en) ? d.title_localized.en : baseTitle;
				const illustration = d.jacketOverride ? songId + '_' + d.ratingClass + '.jpg' : songId + '.jpg';
				const constKey = CONST_KEY_BY_DIF[key];
				const rawConstant = constantsByIdx[String(song.idx)] ? constantsByIdx[String(song.idx)][constKey] : null;
				const constant = (rawConstant === undefined || rawConstant === null || rawConstant === '') ? null : rawConstant;
				cat.difficulties[key] = {
					title: diffTitle,
					illustration: illustration,
					constant: constant
				};
				if (diffTitle !== baseTitle) {
					if (!diffSongNameMapping[songId]) diffSongNameMapping[songId] = {};
					diffSongNameMapping[songId][key] = diffTitle;
				}
				if (d.jacketOverride) {
					if (!diffIllMapping[songId]) diffIllMapping[songId] = {};
					diffIllMapping[songId][key] = '_' + d.ratingClass;
				}
			});
			songCatalog[songId] = cat;
		});

		// 一致性检查：constants.json 的 idx 是否能全部命中当前 songlist
		const unknownIdx = [];
		Object.keys(constantsByIdx).forEach(function (idx) {
			if (!(idx in songlist)) unknownIdx.push(idx);
		});
		if (unknownIdx.length) {
			console.warn('[数据一致性] constants.json 中有 ' + unknownIdx.length +
				' 个 idx 在当前 songlist 中不存在（songlist 可能已过期）: ' + unknownIdx.join(', '));
		}
		if (dataVersion) {
			console.log('[曲目数据] 数据版本 ' + dataVersion +
				'，songlist 曲目 ' + rawSonglist.length +
				'，已登记定数曲目 ' + Object.keys(constantsByIdx).length);
		}

		// 生成SQL查询文本：allsongs 建表+INSERT 由定数表生成，查询模板与旧 query.sql 保持一致
		query = buildQuerySQL(constantsByIdx, rawSonglist);
		songDataReady = true;
		console.log('Query data generated');
		$('#load-db').text('[OK] Database data loaded').css('color', 'green');
		$('#load-db').hide("slow").css("height", "0");
		$('#load-sl').text('✅曲目列表文件已加载').css('color', 'green');
		$('#load-sl').hide('slow').css('height', '0');
		$('#load-il').text('✅曲绘信息已派生').css('color', 'green');
		$('#load-il').hide('slow').css('height', '0');
		$('#load-sn').text('✅曲名信息已派生').css('color', 'green');
		$('#load-sn').hide('slow').css('height', '0');
		return songCatalog;
	} catch (error) {
		console.error('Error initializing song data:', error);
		$('#load-db').text('[FAIL] Database data load error. Refresh page.').css('color', 'red');
		$('#load-sl').text('✖曲目列表文件加载失败').css('color', 'red');
		$('#load-il').text('✖曲绘信息派生失败').css('color', 'red');
		$('#load-sn').text('✖曲名信息派生失败').css('color', 'red');
		return null;
	}
}

/**
 * 从曲目标题中按优先级取显示名（en -> ja -> id）
 * songlist 中个别曲目标题异常（空/纯花体字符）时，用维护的兜底名
 */
const TITLE_FALLBACKS = { ii: 'II', particlearts: 'Particle Arts' };
function pickTitle(song) {
	const tl = song.title_localized || {};
	const t = tl.en || tl.ja || '';
	if (!/[A-Za-z0-9]/.test(t) && TITLE_FALLBACKS[song.id]) {
		return TITLE_FALLBACKS[song.id];
	}
	return t || song.id;
}

/**
 * 查询模板（与旧 json/query.sql 从 DROP VIEW 起的静态部分完全一致）
 */
const PTT2_SQL_TAIL = `
		DROP VIEW IF EXISTS PTT2;
		CREATE VIEW PTT2 AS
		SELECT
			allsongs.songname,
			allsongs.songId,
			CASE
			WHEN songDifficulty = 0 THEN "Past"
			WHEN songDifficulty = 1 THEN "Present"
			WHEN songDifficulty = 2 THEN "Future"
			WHEN songDifficulty = 3 THEN "Beyond"
			WHEN songDifficulty = 4 THEN "Eternal"
			END AS Difficulty,
			scores.score,
			scores.perfectCount AS Perfect,
			scores.shinyPerfectCount AS criticalPerfect,
			scores.nearCount AS Far,
			scores.missCount AS Lost,
			CASE
			WHEN songDifficulty = 0 THEN allsongs.PST
			WHEN songDifficulty = 1 THEN allsongs.PRS
			WHEN songDifficulty = 2 THEN allsongs.FTR
			WHEN songDifficulty = 3 THEN allsongs.BYD
			WHEN songDifficulty = 4 THEN allsongs.ETR
			END AS Constant,
			CASE
			WHEN score >= 10000000 THEN
			CASE
			WHEN songDifficulty = 0 THEN ROUND((allsongs.PST + 2.0), 6)
			WHEN songDifficulty = 1 THEN ROUND((allsongs.PRS + 2.0), 6)
			WHEN songDifficulty = 2 THEN ROUND((allsongs.FTR + 2.0), 6)
			WHEN songDifficulty = 3 THEN ROUND((allsongs.BYD + 2.0), 6)
			WHEN songDifficulty = 4 THEN ROUND((allsongs.ETR + 2.0), 6)
			END
			WHEN score >= 9800000 AND score < 10000000 THEN
			CASE
			WHEN songDifficulty = 0 THEN ROUND((allsongs.PST + 1.0 + CAST((score - 9800000) AS REAL) / 200000), 6)
			WHEN songDifficulty = 1 THEN ROUND((allsongs.PRS + 1.0 + CAST((score - 9800000) AS REAL) / 200000), 6)
			WHEN songDifficulty = 2 THEN ROUND((allsongs.FTR + 1.0 + CAST((score - 9800000) AS REAL) / 200000), 6)
			WHEN songDifficulty = 3 THEN ROUND((allsongs.BYD + 1.0 + CAST((score - 9800000) AS REAL) / 200000), 6)
			WHEN songDifficulty = 4 THEN ROUND((allsongs.ETR + 1.0 + CAST((score - 9800000) AS REAL) / 200000), 6)
			END
			ELSE
			CASE
			WHEN songDifficulty = 0 THEN
			CASE
			WHEN allsongs.PST + CAST((score - 9500000) AS REAL) / 300000 < 0 THEN 0
			ELSE ROUND((allsongs.PST + CAST((score - 9500000) AS REAL) / 300000), 6)
			END
			WHEN songDifficulty = 1 THEN
			CASE
			WHEN allsongs.PRS + CAST((score - 9500000) AS REAL) / 300000 < 0 THEN 0
			ELSE ROUND((allsongs.PRS + CAST((score - 9500000) AS REAL) / 300000), 6)
			END
			WHEN songDifficulty = 2 THEN
			CASE
			WHEN allsongs.FTR + CAST((score - 9500000) AS REAL) / 300000 < 0 THEN 0
			ELSE ROUND((allsongs.FTR + CAST((score - 9500000) AS REAL) / 300000), 6)
			END
			WHEN songDifficulty = 3 THEN
			CASE
			WHEN allsongs.BYD + CAST((score - 9500000) AS REAL) / 300000 < 0 THEN 0
			ELSE ROUND((allsongs.BYD + CAST((score - 9500000) AS REAL) / 300000), 6)
			END
			WHEN songDifficulty = 4 THEN
			CASE
			WHEN allsongs.ETR + CAST((score - 9500000) AS REAL) / 300000 < 0 THEN 0
			ELSE ROUND((allsongs.ETR + CAST((score - 9500000) AS REAL) / 300000), 6)
			END
			END
			END AS singlePTT
		FROM scores,allsongs
		WHERE
		/*(scores.songDifficulty = 2 OR scores.songDifficulty = 3)
			AND*/
			scores.songId = allsongs.songId
		ORDER BY singlePTT DESC;


		--SELECT * FROM PTT2;

		--输出新表
		DROP TABLE IF EXISTS PTT_DESC;
		--创建目标表， 如果尚未存在
		CREATE TABLE PTT_DESC(
			songname TEXT,
			songId TEXT,
			Difficulty TEXT,
			score INTEGER,
			Perfect INTEGER,
			criticalPerfect INTEGER,
			Far INTEGER,
			Lost INTEGER,
			Constant REAL,
			singlePTT REAL
		);

		--将视图查询结果插入到新表中
		INSERT INTO PTT_DESC
		SELECT * FROM PTT2;

		SELECT * FROM PTT_DESC;

--COMMIT TRANSACTION
`;

/**
 * 生成SQL：allsongs 建表 + INSERT（只含已登记定数的曲目）+ 原有查询模板
 * @param {Object} constantsByIdx idx -> {PST,PRS,FTR,BYD,ETR}
 * @param {Array} rawSonglist songlist.songs
 * @return {String} 完整SQL文本
 */
function buildQuerySQL(constantsByIdx, rawSonglist) {
	const DIFF_KEYS = ['PST', 'PRS', 'FTR', 'BYD', 'ETR'];
	const lines = [];
	lines.push('PRAGMA foreign_keys = off;');
	lines.push('BEGIN TRANSACTION;');
	lines.push('DROP TABLE IF EXISTS allsongs;');
	lines.push('CREATE TABLE allsongs(');
	lines.push('  songname TEXT,');
	lines.push('  songId TEXT,');
	lines.push('  PST,');
	lines.push('  PRS,');
	lines.push('  FTR,');
	lines.push('  BYD,');
	lines.push('  ETR');
	lines.push(');');
	rawSonglist.forEach(function (song) {
		const c = constantsByIdx[String(song.idx)];
		if (!c) return;
		const name = pickTitle(song).replace(/'/g, "''");
		const vals = DIFF_KEYS.map(function (k) {
			const v = c[k];
			return (v === undefined || v === null || v === '' || v === '-') ? "''" : String(v);
		});
		lines.push("INSERT INTO allsongs (songname, songId, PST, PRS, FTR, BYD, ETR) VALUES ('" + name +
			"', '" + song.id + "', " + vals.join(', ') + ");");
	});
	lines.push('COMMIT TRANSACTION;');
	lines.push('PRAGMA foreign_keys = on;');
	lines.push(PTT2_SQL_TAIL);
	return lines.join('\n');
}

/**
 * st3 查询后检查：有成绩但未登记定数的曲目提示（结果集行为不变，仍只显示有定数的行）
 * @param {Object} db sql.js数据库实例
 */
function logMissingConstants(db) {
	try {
		const rows = db.exec('SELECT DISTINCT songId FROM scores;');
		if (!rows || !rows.length) return;
		const played = rows[0].values.map(function (r) { return r[0]; });
		const known = {};
		Object.keys(songCatalog).forEach(function (id) { known[id] = true; });
		const missing = played.filter(function (id) { return !known[id]; });
		if (missing.length) {
			console.warn('[定数缺失] 以下曲目在 constants.json 中没有登记定数，本次查询未计入其成绩：' + missing.join(', '));
		}
	} catch (e) {
		console.warn('logMissingConstants error:', e);
	}
}
/**
 * AI-Chan文档初始化
 */
function initializeAiChan() {
	fetch(aiChanPath)
		.then(response => response.json())
		.then(data => {
			aiChanList = data.ai_chan;
			// AI-chan 文案加载完成后刷新一次首页推荐（若存在该区域）
			if (typeof rollAiRecommend === 'function') rollAiRecommend();
		})
		.catch(error => console.error('Error:', error));
}

/**
 * 随机返回一条AI-chan文档
 * @return {String} 一条随机的AI-Chan文档，带有需要被替换的标识
 */
function getRandomAiChan() {
	let randomIndex = Math.floor(Math.random() * aiChanList.length);
	let randomItem = aiChanList[randomIndex];
	return aiChanList[randomIndex];
}


/**
 * 不舍入的小数截断
 * @param {number} number 原数
 * @param {number} decimal 截断位数
 * @return {String} 不经舍入的decimal位小数
 */
function toFloor(number, decimal) {
	// console.log(number);
	let multiplier = Math.pow(10, decimal);
	return (Math.floor(number * multiplier) / multiplier).toFixed(decimal);
}


/**
 * 用于以对象的某一属性对对象进行排序
 * @param {object} a 对象a
 * @param {object} b 对象b
 * @param {string} attr 排序依据的属性
 * @param {number} order 升序/降序，降序为1，升序为-1
 */
function resultSort(a, b, attr, order) {
	if (a[attr] !== b[attr]) {
		return order * (b[attr] - a[attr]);
	}
	return 0;
}


/**
 * 用于规范输入的潜力值，防止溢出
 * @return {String} 返回留有两位小数的潜力值字符串
 */
function formatPotential(ptt) {
	let t = ptt + '000';
	return t.substring(0, t.indexOf('.') + 3);
}

/**
 * 计算单曲潜力值
 * @param score 分数
 * @param constant 定数
 * @param decimal 保留位数
 * @return 返回单曲潜力值
 */
function calculateSingleRating(score, constant, decimal) {
	if (score >= 10000000) {
		return constant + 2;
	} else if (score > 9800000) {
		return constant + 1 + (score - 9800000) / 200000;
	} else {
		let rt = constant + (score - 9500000) / 300000;
		return Math.max(rt, 0);
	}
}

/**
 * 计算best30，maxptt
 * @param array 传入游戏结果对象数组
 * @return {Number} maxptt、best30、recent10理论值组成的数组
 */
function calculateMax(array) {
	let sum = 0;
	let rbm = []; //best max recent
	for (i = 0; i < (array.length > 30 ? 30 : array.length); i++) {
		// console.log(array[i])
		sum += parseFloat(array[i].playRating);
		if (i == 9) {
			rbm.push(sum / 10); //recent10
		}
	}
	rbm.push(sum / 30); //best30
	for (i = 0; i < (array.length > 10 ? 10 : array.length); i++) {
		sum += parseFloat(array[i].playRating);
	}
	rbm.push(sum / 40); //maxptt
	console.table(rbm);
	return rbm;
}

/**
 * 按 RFC 4180 转义单个CSV字段（含逗号/引号/换行时加引号包裹、内部引号双写）
 * @param {*} value 字段值
 * @return {String} 可直接写入CSV的字段文本
 */
function csvEscapeField(value) {
	const s = (value === undefined || value === null) ? '' : String(value);
	return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

/**
 * 解析CSV文本（支持带引号字段与转义引号），返回二维字符串数组
 * @param {String} text CSV原文
 * @return {Array<Array<String>>} 行数组
 */
function csvToRows(text) {
	const src = String(text);
	const rows = [];
	let row = [];
	let field = '';
	let inQuotes = false;
	for (let i = 0; i < src.length; i++) {
		const ch = src[i];
		if (inQuotes) {
			if (ch === '"') {
				if (src[i + 1] === '"') {
					field += '"';
					i++;
				} else {
					inQuotes = false;
				}
			} else {
				field += ch;
			}
		} else if (ch === '"') {
			inQuotes = true;
		} else if (ch === ',') {
			row.push(field);
			field = '';
		} else if (ch === '\n' || ch === '\r') {
			if (ch === '\r' && src[i + 1] === '\n') i++;
			row.push(field);
			field = '';
			rows.push(row);
			row = [];
		} else {
			field += ch;
		}
	}
	if (field !== '' || row.length > 0) {
		row.push(field);
		rows.push(row);
	}
	return rows;
}

/* ===== 跨页面成绩文件导入 ===== */

/** 确保 sql.js 已初始化（返回 Promise，方便等待） */
function ensureSqlite() {
	if (SQL) return Promise.resolve(SQL);
	return initializeSqliteJs().then(function () { return SQL; });
}

/** 将 CSV 分数表文本转换为成绩记录数组（与各页面 runConvert 相同口径） */
function convertCsvTextToRecords(csvText) {
	const rows = csvToRows(csvText);
	const arr = [];
	for (let i = 1; i < rows.length; i++) {
		const row = rows[i];
		// 分数为空的行视为“未填写”，跳过（配合 scores 页“导出为CSV”的空行模板）
		const scoreText = (row[3] === undefined || row[3] === null) ? '' : String(row[3]).trim();
		if (scoreText === '') continue;
		arr.push(new PlayResult(row[0], row[1], row[2],
			parseFloat(row[3]), parseFloat(row[4]),
			parseFloat(row[5]), parseFloat(row[6]),
			parseFloat(row[7]), parseFloat(row[8]),
			parseFloat(row[9]), i - 1));
	}
	return arr;
}

/** 将 st3 数据库文件解析为成绩记录数组（需要 sql.js 与 query 就绪） */
async function convertSt3FileToRecords(file) {
	if (!query) await initializeSongData();
	await ensureSqlite();
	const buffer = await file.arrayBuffer();
	const db = new SQL.Database(new Uint8Array(buffer));
	const result = db.exec(query);
	if (!result || !result.length) return [];
	return result[0].values.map(function (row, i) {
		return new PlayResult(row[0], row[1], row[2], row[3], row[4], row[5], row[6], row[7], row[8], row[9], i);
	});
}

/**
 * 解析受支持的成绩文件，返回 {kind, records, constantOverrides}
 * kind: 'scores-json'（全曲成绩导出）/ 'csv'（分数表）/ 'st3'（游戏数据库）
 */
async function parseScoreFile(file) {
	const name = (file.name || '').toLowerCase();
	if (name.endsWith('.json')) {
		const text = await file.text();
		const data = JSON.parse(text);
		if (!data || data.app !== 'arcaea-scores') {
			throw new Error('不是有效的全曲成绩导出文件（缺少 app 标记）');
		}
		if (Number(data.version) !== Number(DATA_VERSION)) {
			throw new Error('文件版本不兼容（文件 v' + data.version + '，当前 v' + DATA_VERSION + '），请重新导出后再载入');
		}
		if (!Array.isArray(data.records)) {
			throw new Error('records 字段缺失或格式错误');
		}
		return {
			kind: 'scores-json',
			records: data.records,
			constantOverrides: (data.constantOverrides && typeof data.constantOverrides === 'object') ? data.constantOverrides : {}
		};
	}
	if (name.endsWith('.csv')) {
		const text = await file.text();
		return { kind: 'csv', records: convertCsvTextToRecords(text), constantOverrides: {} };
	}
	// 其余按 st3 数据库处理
	return { kind: 'st3', records: await convertSt3FileToRecords(file), constantOverrides: {} };
}

/** 将记录写入共享缓存：补齐/计算 playRating，按单曲PTT降序，同步 innerIndex，保存定数覆盖 */
function applyScoresToCache(records, constantOverrides) {
	const arr = (records || []).slice();
	arr.forEach(function (r) {
		const pr = parseFloat(r.playRating);
		if (isNaN(pr)) {
			const c = parseFloat(r.constant);
			r.playRating = isNaN(c) ? 0 : calculateSingleRating(parseFloat(r.score) || 0, c, 5);
		}
	});
	arr.sort(function (a, b) {
		const pa = (a.playRating === null || a.playRating === undefined) ? -Infinity : a.playRating;
		const pb = (b.playRating === null || b.playRating === undefined) ? -Infinity : b.playRating;
		return pb - pa;
	});
	arr.forEach(function (r, i) { r.innerIndex = i; });
	saveLocalStorage(arr);
	saveConstantOverrides(constantOverrides || {});
	return arr;
}

/**
 * 载入全曲成绩导出 / CSV分数表 / st3数据库并替换当前缓存，
 * 然后调用页面级钩子 onScoresLoaded(arr) 刷新（由各页面自行实现）
 */
async function loadScoresExportIntoCache(file) {
	try {
		const data = await parseScoreFile(file);
		const n = (data.records || []).length;
		if (!confirm('将载入 ' + n + ' 条成绩记录并替换当前缓存，是否继续？')) return;
		const arr = applyScoresToCache(data.records || [], data.constantOverrides || {});
		currentArray = arr;
		filteredArray = arr;
		if (typeof onScoresLoaded === 'function') onScoresLoaded(arr);
	} catch (e) {
		alert('载入失败：' + e.message + '（现有缓存未受影响）');
	}
}

/**
 * 检查localStorage缓存版本，版本不匹配时清除旧成绩缓存（避免结构变更后崩溃）
 * 应在读取缓存前调用
 */
function checkLocalStorageVersion() {
	if (localStorage.savedArrayData && localStorage.savedArrayDataVersion != String(DATA_VERSION)) {
		console.warn('[缓存] savedArrayData 版本过旧，已清除，请重新上传数据');
		localStorage.removeItem('savedArrayData');
		localStorage.removeItem('savedArrayDataVersion');
	}
}

/**
 * 读取页面级定数覆盖（localStorage 键 constantOverrides，键格式 "songId|Difficulty"）
 * @return {Object} 覆盖映射
 */
function loadConstantOverrides() {
	try {
		const raw = localStorage.getItem('constantOverrides');
		return raw ? JSON.parse(raw) : {};
	} catch (e) {
		console.warn('loadConstantOverrides error:', e);
		return {};
	}
}

/**
 * 保存页面级定数覆盖到 localStorage（不写入 constants.json）
 * @param {Object} map "songId|Difficulty" -> 数值
 */
function saveConstantOverrides(map) {
	try {
		localStorage.setItem('constantOverrides', JSON.stringify(map || {}));
	} catch (e) {
		console.warn('saveConstantOverrides error:', e);
	}
}

/**
 * 取某难度谱面的有效定数：页面覆盖值 ?? songlist/constants 目录定数
 * @param {String} songId 曲目ID
 * @param {String} difficulty 难度（Past/Present/Future/Beyond/Eternal）
 * @return {Number|null} 有效定数，无则返回 null
 */
function effectiveConstant(songId, difficulty) {
	try {
		const raw = localStorage.getItem('constantOverrides');
		if (raw) {
			const map = JSON.parse(raw);
			const v = map[songId + '|' + difficulty];
			if (v !== undefined && v !== null && v !== '') return parseFloat(v);
		}
	} catch (e) { /* 忽略，走目录定数 */ }
	const cat = songCatalog[songId];
	if (cat && cat.difficulties && cat.difficulties[difficulty]) {
		const c = cat.difficulties[difficulty].constant;
		if (c !== null && c !== undefined && c !== '') return parseFloat(c);
	}
	return null;
}
/**
 * 保存完整的成绩对象数组到浏览器缓存
 * @param {Array<PlayResult>} currentArray 
 */
function saveLocalStorage(array) {
	let strArray = JSON.stringify(array);
	localStorage.setItem("savedArrayData", strArray);
	localStorage.setItem("savedArrayDataVersion", String(DATA_VERSION));
}

/**
 * 从浏览器缓存读取保存的成绩对象数组
 * @return {Array<PlayResult>} currentArray
 */
function readLocalStorage() {
	if (localStorage.getItem("savedArrayDataVersion") != String(DATA_VERSION)) {
		localStorage.removeItem("savedArrayData");
		localStorage.removeItem("savedArrayDataVersion");
		return null;
	}
	if (localStorage.getItem("savedArrayData")) {
		let savedArray = JSON.parse(localStorage.getItem("savedArrayData"));
		if (savedArray) {
			return savedArray;
		} else {
			return null;
		}
	}
	return null;
}

/**
 * [已停用] 读取VHZek制作的万能查分表xls / xlsx文件并生成成绩对象数组
 * 万能查分表功能已于2026-08按用户要求整体停用，需要恢复时取消下方注释并恢复各页面调用
 */
/*
function readVHZek(file) {
	var reader = new FileReader();
	let tarray = [];
	reader.onload = function (e) {
		var data = e.target.result;
		var workbook = XLSX.read(data, {
			type: 'binary'
		});
		var sheetName = workbook.SheetNames[0]; // 获取第一个工作表的名称
		var sheet = workbook.Sheets[sheetName];
		let sheetMaxLength = 0;
		Object.keys(sheet).forEach(function (cell) {
			if (cell.startsWith("A") && parseInt(cell.substring(1)) > sheetMaxLength)
				sheetMaxLength = parseInt(cell.substring(1));
		})

		var columns = ['A', 'B', 'F', 'G', 'H', 'J', 'K'];
		let rows = [];

		columns.forEach(column => {
			var colArray = [];
			var col = column + '2';
			let index = 1;
			while (index <= sheetMaxLength) {
				index++;
				// console.log(sheet[col]);
				if (sheet[col] == undefined || sheet[col] == null) {
					colArray.push("");
				} else {
					colArray.push(sheet[col].v);
				}

				col = column + (index).toString();
			}
			rows[column] = colArray;
		});
		rows['A'].shift(); //idx
		rows['B'].shift(); //songName
		rows['F'].shift(); //difficulty
		rows['G'].shift(); //constant
		rows['H'].shift(); //score
		rows['J'].shift(); //objectAmount
		rows['K'].shift(); //accuracy
		for (i = 0; i < sheetMaxLength - 1; i++) {
			let loseScore = getLoseScoreByObjectAmoutAndAccuracy(parseInt(rows['H'][i]), parseFloat(rows['G'][i]),
				parseInt(rows['J'][i]), parseInt(rows['K'][i]));
			let eqFar, acc;
			if (rows['H'][i] != '') {
				[eqFar, acc] = calculateEquivalentFarAndAccuracy(parseInt(rows['H'][i]), parseInt(rows['J'][i]));
				let pr = new PlayResult(
					rows['B'][i],
					idx_constant[rows['A'][i]].songId,
					difList[rows['F'][i]],
					rows['H'][i] == -1 ? rows['J'][i] + 10000000 : rows['H'][i],
					0,
					parseInt(rows['K'][i]),
					0,
					0,
					parseFloat(rows['G'][i]),
					0,
					i,
					loseScore,
					rows['F'][i] * 38,
					parseInt(rows['J'][i]));
				pr.setEquivalentFar(eqFar);
				pr.setAccuracy(acc);
				tarray.push(pr);
			}
		}
		reloadContent(tarray)
		filteredArray = tarray;
		currentArray = filteredArray;

		saveLocalStorage(currentArray);
		generateCard(currentArray);
		generateTable(currentArray);

	}
	reader.readAsArrayBuffer(file);

}
*/

// 由分数、定数、物量、准度（大p数）计算失分数

function getLoseScoreByObjectAmoutAndAccuracy(score, constant, objectAmount, accuracy) {
	return (score == -1) ? 0 :
		Math.max(
			Math.min(28.5 * constant, (10000000 - score) / 10000000 * 100 * 28.5 * constant),
			0
		) + Math.max(
			Math.min(9.5 * constant, (0.995 * objectAmount - accuracy) / objectAmount * 100 * constant),
			0
		);
}



/**
 * 滚动到指定id元素并突出显示，
 * 滚动到页面顶端是通过定位到最顶端一个不可见的无宽高的元素实现的
 */
function scrollToElement(id) {
	window.scrollTo({
		top: $("#" + id).offset().top - 100,
		behavior: 'smooth'
	});
	setTimeout(function () {
		$('#' + id).addClass('stressed-unit');
	}, 300);
	setTimeout(function () {
		$('#' + id).removeClass('stressed-unit');
	}, 2000);
}



/**
 * 显示/隐藏指定的元素/窗口
 */
function displayWindow(windowId, force) {
	var $window = $('#' + windowId);
	var shouldShow = force === true || (force !== false && $window.is(":hidden"));
	if (shouldShow) {
		$window.removeAttr('hidden').css("display", "block");
		setTimeout(function () {
			$window.css("opacity", 1);
		}, 100);
	} else {
		$window.css("opacity", 0);
		setTimeout(function () {
			$window.attr('hidden', 'hidden').css("display", "none");
		}, 500);
	}
}

/**
 * 唤起修改成绩弹窗
 * @param {Number} idx 成绩在成绩对象数组中的下标
 * @param {Array<PlayResult>} array 默认是currentArray
 */
function modifyPlayResult(idx, array = currentArray) {
	console.table(array[idx]);
	displayWindow('modify-window', true);
	$('#modify-current-index').val(array[idx].innerIndex);
	$('#modify-window-title span').text('曲目成绩');
	$('#modify-illustration-container img').attr('src', illustrationPath + array[idx].illustration);
	$('#modify-song-name input').val(array[idx].songName);
	$('#modify-song-id input').val(array[idx].songId);
	$('#modify-song-score input').val(array[idx].score);
	$('#modify-pure').val(array[idx].perfect);
	$('#modify-critical-pure').val(array[idx].criticalPerfect);
	$('#modify-far').val(array[idx].far);
	$('#modify-lost').val(array[idx].lost);
	saveLocalStorage(array);
}
/**
 * 重置修改成绩弹窗内容
 */
function resetModifyWindowContent() {
	$('#modify-current-index').val('');
	$('#modify-window-title span').text('');
	// $('#modify-illustration-container img').attr('src', illustrationPath + currentRow.illustration);
	$('#modify-song-name input').val('');
	$('#modify-song-id input').val('');
	$('#modify-song-score input').val('');
	$('#modify-pure').val('');
	$('#modify-critical-pure').val('');
	$('#modify-far').val('');
	$('#modify-lost').val('');
}
/**
 * 接受修改内容
 * @param {Array<PlayResult>} array 默认是currentArray
 */
function acceptModifyResult(array) {
	let index = $('#modify-current-index').val();
	console.log("currentInnerIndex=" + index);
	array[index].songName = $('#modify-song-name input').val();
	array[index].songId = $('#modify-song-id input').val();
	array[index].score = $('#modify-song-score input').val();
	array[index].perfect = $('#modify-pure').val();
	array[index].criticalPerfect = $('#modify-critical-pure').val();
	array[index].normalPerfect = array[index].perfect - array[index].criticalPerfect;
	array[index].far = $('#modify-far').val();
	array[index].lost = $('#modify-lost').val();
	array[index].playRating = calculateSingleRating(array[index].score, array[index].constant, 6);
	saveLocalStorage(currentArray);
	displayWindow('modify-window', false);
	reloadContent(currentArray);
}
/**
 * 放弃成绩的修改
 */
function abortModifyResult() {
	resetModifyWindowContent();
	displayWindow('modify-window', false);
}
/**
 * 删除单条成绩
 */
function deleteResult() {
	if (confirm("确定要删除这条记录吗？")) {
		idx = $('#modify-current-index').val();
		currentArray.splice(idx, 1);
		saveLocalStorage();
		displayWindow('modify-window', false);
		reloadContent(currentArray);
	}

}
/**
 * 根据分数返回曲目评级
 * 借助far和lost可以细分出Full Recall
 */
function getSongRanking(score, far, lost) {
	if (far != 0 && lost == 0) {
		return "FR";
	}
	const ranges = [8599999, 8899999, 9199999, 9499999, 9799999, 9899999, 10000000,
		11000000
	];
	const rankLabels = ["D", "C", "B", "A", "AA", "EX", "EX+", "PM"];
	for (let i = 0; i < ranges.length; i++) {
		if (score < ranges[i]) {
			return (rankLabels[i]);
		}
	}
}

/**
 * AI-Chan推荐文本生成
 * 生成后自动滚动到对应曲目成绩单元
 * @param {Array<PlayResult>} array 默认是currentArray
 * @param {Number} viewMode 默认1，不加前缀，加't-'前缀表示目标单元为表格中的一行
 */
function aiChanRoll(array = currentArray, viewMode = 1) {
	let randomIndex = Math.floor(Math.random() * array.length);
	let randomSong = array[randomIndex];
	console.log(randomSong);
	let randomAiChan = getRandomAiChan();
	$('#ai-chan-content').text(randomAiChan.replace('songName', randomSong.songName)
		.replace('difficulty', randomSong.difficulty)
		.replace('constant', parseFloat(randomSong.constant).toFixed(1))
		.replace('你打了score分', randomSong.score >= 0 ? `你打了${randomSong.score}分` : '你没打过这个谱？'));
}
/**
 * 清空浏览器缓存数据
 */
function deleteLocalStorage() {
	if (confirm("确定要清空本地缓存吗？该操作不可撤销！")) {
		localStorage.clear();
		location.reload();
	}
}

/**
 * 修改潜力值显示，并同步计算新的recent10，替换新的潜力值星框
 * @param {string} ptt 潜力值
 */
function changePotential(ptt) {
	ptt = ptt ? ptt : '0.00';
	p = toFloor(ptt, 2);
	$('#potential-value').text(p);
	changePotentialFrame(getPotentialFrame(ptt));
	localStorage.setItem('potential', p);
	console.log('ptt=' + p);
	console.log(parseFloat(ptt));
	let t = parseFloat(ptt) * 4 - parseFloat($('#ptt-b30 span').text()) * 3;
	$('#ptt-r10 span').text(t >= 0 ? t.toFixed(4) : '0.0000');
}

/**
 * 更新选择的头像并保存到localStorage
 * @param {string} index 头像对应的文件序号
 */
function changeAvatar(index) {
	console.log(index);
	$('#icon img').attr('src', avatarPath + index + '_icon.webp');
	$('#avatar-display img').attr('src', avatarPath + index + '_icon.webp');
	localStorage.setItem('avatar', index);
	displayWindow('avatar-select', false);
	$('#use-custom-avatar').prop('checked', false);
}
/**
 * 更新选择的段位框并保存到localStorage
 * @param {string} index 段位框对应的文件序号
 */
function changeCourseDanFrame(index) {
	$('#user-course-dan').attr('src', userCourseDanPath + index + '.png');

	$('#id-course-dan').attr('src', userCourseDanPath + index + '.png');
	$('#user-course-dan-display').css('background-image', 'url("' + userCourseDanPath + index + '.png")');
	$('#user-course-dan-display').text(index + 'dan');
	displayWindow('user-course-dan-select', false);
	localStorage.setItem('courseDanFrame', index);
}
/**
 * 更新选择的背景图并保存到localStorage
 * @param {string} index 背景图对应的文件序号
 */
function changeBackgroundImage(index) {
	$('#background').css('background-image', `url(${backgoundImagePath}${index}.webp)`);
	$('#background-display').attr('src', backgoundImagePath + index + '.webp');
	displayWindow('background-select', false);
	localStorage.setItem('backgroundImage', index);
	$('#use-custom-background').prop('checked', false);
}

/**
 * 替换新的潜力值星框
 * @param {string} index 星框对应的图片序号
 */
function changePotentialFrame(index) {
	$('#potential-frame').attr('src', potentialFramePath + index + '.png');
	localStorage.setItem('potentialFrame', index);
}

/**
 * 切换为隐藏Mid *** *** ***
 */
function hideUID() {
	uidFlag = !uidFlag;
	if (uidFlag == true) {
		$('#user-id span').text(formatUserID(localStorage.getItem('userId')));
	} else {
		$('#user-id span').text('＊＊＊ ＊＊＊ ＊＊＊');

	}
}

/**
 * 依照当前访问的网址（github/gitee）初始化页面下方网址和二维码的显示
 */
async function initializeQRCode() {
	let url = window.location.href.substring(0, window.location.href.lastIndexOf('/'));
	if (url.indexOf("appassets") != -1){
		url = 'https://smartrte.github.io';
	}
	$('#copyright span:first').text(`Generated at ${url} @ `);
	// if (url == 'https://smartrte.github.io') {
	// 	$('#qrcode').attr('src', 'img/QRCODE-githubio.png');
	// }
	// else if(url == 'https://smartrte.github.io'){
	// 	$('#qrcode').attr('src', 'img/QRCODE-giteeio.png');
	// }
}
/**
 * 读取头像列表csv并生成头像选择部分
 */
async function initializeAvatarList() {
	try {
		const response = await fetch(avatarListPath);
		if (!response.ok) {
			throw new Error(`HTTP error! status: ${response.status}`);
		}
		const resp = await response.text();
		avatarList = resp.trim().replaceAll('\r\n', '\n').split('\n');
		avatarList.forEach(function (avt) {
			appendAvatarUnit(avt);
		});
	} catch (error) {
		console.error("Error fetching data:", error);
	}
}
/**
 * 生成背景图片列表
 * 我懒所以写死了
 */
async function initializeBackgroundList() {
	let l = [
		'1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', 's1', 's2', 's3', 's4', 's5', 's6',
		's7', 's8', 's9', 's10', 's11', 's12', 's13', 's14', 's15', 's16', 's17', 's18', 's19', 's20', 's21',
		's22', 's23', 's24', 's25', 's26'
	];
	let list = $('#background-list');
	l.forEach(function (li) {
		list.append(
			$(`<li class="background-option" onclick="changeBackgroundImage('${String(li)}')">`)
				.append($(`<img src='bgs/${li}.webp'>`))
		);
	});
}
/**
 * 生成段位背景列表
 * 我懒所以写死了
 */
async function initializeUserCourseDanList() {
	let l = [
		1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28
	];
	let list = $('#user-course-dan-list');
	l.forEach(function (li) {
		list.append(
			$(`<li class="user-course-dan-option" value="${li}" onclick="changeCourseDanFrame(${li})">`)
				.append($(`<img class="user-course-dan-image" src="img/course/${li}.png">`))
		);
	});
}

/**
 * 生成头像列表
 * 我懒所以写死了
 */
function appendAvatarUnit(avt) {
	let avtu = $('<li onclick="changeAvatar(' + "'" + avt + "'" + ')">').addClass('avatar-option');
	let aimg = $('<img>').attr('src', avatarPath + avt + '_icon.webp');
	avtu.append(aimg);
	$('#avatar-list').append(avtu);
}

/**
 * 使用canvas对上传的头像图片进行重新绘制，并将其裁剪成菱形
 * 否则 html2canvas不支持clip属性，会导致头像样式丢失，难看的一p
 */
function clipDiamond() {
	let tempImg = new Image();
	tempImg.src = $('#temp-avatar')[0].src;
	var canvas = document.createElement('canvas');
	var ctx = canvas.getContext('2d');
	canvas.width = tempImg.width || tempImg.naturalWidth;
	canvas.height = tempImg.height || tempImg.naturalHeight;
	canvas.height = Math.min(canvas.height, canvas.width);
	canvas.width = canvas.height;
	console.log(canvas.width, canvas.height);
	ctx.clearRect(0, 0, canvas.width, canvas.height);
	ctx.drawImage(tempImg, 0, 0, canvas.width, canvas.height);
	console.log(ctx);
	// 裁剪为菱形
	ctx.beginPath();
	ctx.moveTo(0, 0);
	ctx.lineTo(canvas.width / 2, 0);
	ctx.lineTo(0, canvas.height / 2);
	ctx.lineTo(canvas.width / 2, canvas.height);
	ctx.lineTo(canvas.width, canvas.height / 2);
	ctx.lineTo(canvas.width / 2, 0);
	ctx.lineTo(canvas.width, 0);
	ctx.lineTo(canvas.width, canvas.height);
	ctx.lineTo(0, canvas.height);
	ctx.closePath();
	ctx.clip();
	ctx.clearRect(0, 0, canvas.width, canvas.height);
	ctx.drawImage(tempImg, canvas.width / 2, 0, canvas.width, canvas.height / 2, canvas.width /
		2, canvas.height, 0, canvas.height / 2);

	// 将裁剪后的内容转换为data URL
	var dataUrl = canvas.toDataURL('image/png');
	// 显示在页面上
	// var resultDiv = document.getElementById('result');
	// resultDiv.innerHTML = '<img src="' + dataUrl + '" />';
	$('#custom-avatar img').attr('src', dataUrl);

	localStorage.setItem('customAvatar', dataUrl);
	if ($('#use-custom-avatar').is(':checked')) {
		$('#icon img').attr('src', dataUrl);
	}
};

/**
 * 获取统计信息
 * @param {Array<PlayResult>} array 传入统计的成绩对象数组
 * @return {Object} sts 包含按照分数段分类的字典对象，使用时基本只用得到length
 */

function getStatistics(array = currentArray) {
	let temp = array;
	let sts = {};
	temp.forEach(function (currentRow) {
		let ranking = getSongRanking(currentRow.score, currentRow.far, currentRow.lost);
		if (!sts[ranking]) {
			sts[ranking] = [];
		}
		sts[ranking].push(currentRow);
	});
	// console.log(sts)
	return sts;
}


/**
 * 计算单曲失分数
 * @param {Number} constant 定数
 * @param {Number} score 分数
 * @param {Number} amount 物量
 * @param {Number} criticalPerfect 大p数
 */
function getLoseScore(constant, score, amount, criticalPerfect) {
	// 物量为0或大P数缺失时无法计算精确度项，退化为纯分数项，避免产生NaN（NaN经JSON序列化会变成null并导致其他页面渲染崩溃）
	const amountNum = Number(amount);
	const cpNum = Number(criticalPerfect);
	const scoreBonus = Math.max(0, Math.min((Number(score) / 10000000 - 0.99), 0.01));
	if (!isFinite(amountNum) || amountNum <= 0 || !isFinite(cpNum)) {
		return constant * 38 - constant * 100 * (28.5 * scoreBonus);
	}
	return (constant * 38 - constant * 100 * (Math.max(0, Math.min((cpNum / amountNum - 0.9), 0.095)) + 28.5 * scoreBonus));
}


function findInArray(array, songId, difficulty) {
	let keysValues = [{
		key: 'songId',
		value: songId
	}, {
		key: 'difficulty',
		value: difficulty
	}]
	return array.findIndex(function (obj) {
		return keysValues.every(function (kv) {
			return obj[kv.key] === kv.value;
		});
	});
}

function findDifficulty(idx, constant, idx_constant) {
	// console.log(idx, constant, idx_constant)
	let i = idx_constant[idx].constant.indexOf(String(constant));
	if (i == '') {
		return '';
	}
	if (i <= 4) {
		return difList[i];
	}
	return '';
}

function findIndex(songId, songlist) {
	return Object.values(songlist).indexOf(songId);
}

/**
 * 根据分数和物量信息返回等数far和大p数
 */
function calculateEquivalentFarAndAccuracy(score, objectAmount) {
	let acc;
	let eqFar;
	if (score === -1 || score === objectAmount + 10000000) {
		return [0, objectAmount];
	} else if (score === 0) {
		return [objectAmount * 2, 0];
	} else {
		acc = Math.floor(score - Math.floor(score / 5000000 * objectAmount) * 5000000 / objectAmount, 1) +
			1 - Math.floor(score / 10000000) + (score === -1 ? objectAmount : 0);
		farScore = 10000000 / objectAmount / 2;
		eqFar = (10000000 + acc - score) / farScore;
		return [(eqFar).toFixed(0), acc];
	}
}

/* ===== Theme System ===== */
(function () {
    try {
        var saved = localStorage.getItem('theme');
        if (!saved || ['light','dark'].indexOf(saved) === -1) saved = 'light';
        document.documentElement.dataset.theme = saved;
    } catch (e) {}
})();

function toggleTheme() {
    var current = document.documentElement.dataset.theme || 'light';
    var next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('theme', next); } catch (e) {}
    updateThemeButton();
}

function getCurrentTheme() {
    return document.documentElement.dataset.theme || 'light';
}

function updateThemeButton() {
    var t = getCurrentTheme();
    document.querySelectorAll('.theme-toggle').forEach(function (el) {
        el.textContent = t === 'dark' ? '\u2600\uFE0F \u6D45\u8272' : '\uD83C\uDF19 \u6DF1\u8272';
        el.setAttribute('data-theme-label', t);
    });
}

document.addEventListener('DOMContentLoaded', function () {
    updateThemeButton();
});

/* ===== 浮动小工具系统（目前：单曲PTT计算器）=====
 * 页面在 body 末尾放置 <div id="tool-root" data-tool-label="按钮文字" data-tool-title="弹窗标题"></div> 即可启用，
 * 以后新增小工具时在弹窗结构内追加即可。
 */
function initToolWidgets() {
	const root = document.getElementById('tool-root');
	if (!root || document.getElementById('tool-fab')) return;

	const fabLabel = root.getAttribute('data-tool-label') || '小工具';
	const modalTitle = root.getAttribute('data-tool-title') || '单曲PTT计算器';
	const fabVariant = root.getAttribute('data-fab-variant') || 'pill';

	// 样式只注入一次
	const STYLE_ID = 'tool-widget-style';
	if (!document.getElementById(STYLE_ID)) {
		const styleEl = document.createElement('style');
		styleEl.id = STYLE_ID;
		styleEl.textContent = `
#tool-fab {
	position: fixed; right: 22px; bottom: 22px; z-index: 90;
	padding: 11px 18px; border-radius: 999px; border: 1px solid var(--border);
	background: linear-gradient(135deg, var(--accent), var(--accent-secondary));
	color: #fff; font-weight: 700; font-size: .92rem; letter-spacing: .02em;
	box-shadow: 0 6px 20px rgba(0,0,0,.25); cursor: pointer; user-select: none;
	transition: transform .2s ease, box-shadow .2s ease;
	font-family: "Exo", "L2", sans-serif;
}
#tool-fab:hover { transform: translateY(-2px); box-shadow: 0 10px 26px rgba(0,0,0,.3); }
#tool-fab:active { transform: translateY(0) scale(.97); }
/* 方形变体：与“回到顶部/生成图片”按钮同风格（b30gen/completion），位于生成图片按钮上方 */
#tool-fab[data-fab-variant="square"] {
	right: 1rem;
	bottom: 14rem;
	z-index: 80;
	display: flex;
	align-items: center;
	justify-content: center;
	width: 16vw;
	height: 16vw;
	max-width: 2.5rem;
	max-height: 2.5rem;
	padding: 0;
	box-sizing: content-box;
	border: 1px solid gray;
	border-radius: 7px;
	background-color: aliceblue;
	background-image: none;
	color: #333;
	font-size: 1rem;
	line-height: 1.25rem;
	text-align: center;
	box-shadow: 2px 2px 10px gray;
	opacity: 0.3;
	transition: opacity 0.3s, transform 0.3s;
}
#tool-fab[data-fab-variant="square"]:hover {
	transform: scale(1.1);
	opacity: 0.9;
}
#tool-fab[data-fab-variant="square"]:active {
	transform: scale(0.6);
}
@media screen and (max-width: 600px) {
	#tool-fab[data-fab-variant="square"] {
		right: 0.75rem;
	}
}
/* index 首页专用：与页面“返回顶部”按钮同风格 */
#tool-fab[data-fab-variant="index"] {
    right: 20px;
    bottom: 3rem;
    z-index: 80;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    padding: 0 4px;
    box-sizing: border-box;
    background: var(--surface);
    color: var(--text-muted);
    border: 1px solid var(--border);
    border-radius: 10px;
    font-size: 0.8rem;
    font-weight: 600;
    line-height: 1.15;
    text-align: center;
    opacity: 0.4;
    box-shadow: none;
    transition: opacity 0.2s ease, transform 0.2s ease;
    font-family: "Exo", "L2", sans-serif;
}
#tool-fab[data-fab-variant="index"]:hover {
	opacity: 1;
	color: var(--text-primary);
	transform: scale(1.1);
}
#tool-fab[data-fab-variant="index"]:active {
	transform: scale(0.85);
}
#tool-modal { position: fixed; inset: 0; z-index: 200; }
#tool-modal[hidden] { display: none; }
#tool-modal-bg { position: fixed; inset: 0; background: var(--overlay); z-index: 201; }
#tool-modal-box {
	position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
	z-index: 202; width: min(480px, calc(100vw - 32px));
	background: var(--modal-bg); backdrop-filter: blur(16px);
	border: 1px solid var(--border); border-radius: 14px;
	box-shadow: 0 8px 40px rgba(0,0,0,.3); padding: 20px 22px;
	box-sizing: border-box;
}
.tool-modal-header { display: flex; align-items: center; justify-content: space-between; padding-bottom: 12px; border-bottom: 1px solid var(--border); margin-bottom: 16px; }
.tool-modal-title { font-size: 1.1rem; font-weight: 700; color: var(--text-primary); font-family: "Exo", "L2", sans-serif; }
#tool-modal-close {
	width: 34px; height: 34px; border: none; background: none; cursor: pointer;
	color: var(--text-muted); font-size: 1.15rem; border-radius: 50%;
	transition: .2s; line-height: 34px; text-align: center; font-family: "Exo", "L2", sans-serif;
}
#tool-modal-close:hover { background: var(--surface-alt); color: var(--text-primary); transform: rotate(90deg); }
.tool-calc { display: flex; flex-direction: column; gap: 14px; }
.tool-calc label { display: flex; flex-direction: column; gap: 6px; font-size: .85rem; font-weight: 600; color: var(--text-secondary); }
.tool-calc input {
	padding: 10px 12px; border-radius: 8px; border: 1px solid var(--input-border);
	background: var(--input-bg); color: var(--input-text); font-size: 1rem; box-sizing: border-box;
	width: 100%; font-family: "Exo", "L2", sans-serif;
}
.tool-calc input:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-glow); }
.tool-calc-result {
	display: flex; align-items: center; justify-content: space-between; gap: 12px;
	padding: 13px 16px; border-radius: 10px; background: var(--surface-alt);
	border: 1px solid var(--border);
}
.tool-calc-result-label { font-size: .85rem; color: var(--text-secondary); font-weight: 600; }
.tool-calc-result-value { font-size: 1.4rem; font-weight: 800; color: var(--accent); font-variant-numeric: tabular-nums; }
.tool-calc-hint { font-size: .75rem; color: var(--text-muted); margin: 0; line-height: 1.5; }
.tool-calc-hint a { color: var(--link); }
.tool-tabs { display: flex; gap: 8px; margin-bottom: 14px; }
.tool-tab {
	flex: 1; padding: 8px 10px; border-radius: 8px; border: 1px solid var(--border);
	background: var(--surface-alt); color: var(--text-secondary); font-size: .85rem; font-weight: 700;
	cursor: pointer; transition: .2s; font-family: "Exo", "L2", sans-serif;
}
.tool-tab.active { background: var(--accent); color: #fff; border-color: var(--accent); }
.tool-tab:hover:not(.active) { color: var(--text-primary); }
.tool-panel { display: none; }
.tool-panel.active { display: block; }
.tool-push-refresh {
	align-self: center; padding: 7px 14px; border-radius: 8px; border: 1px solid var(--border);
	background: var(--surface-alt); color: var(--text-primary); font-size: .82rem; font-weight: 600; cursor: pointer;
	transition: .2s; font-family: "Exo", "L2", sans-serif;
}
.tool-push-refresh:hover { border-color: var(--accent); color: var(--accent); }
.tool-push-list { display: flex; flex-direction: column; gap: 8px; max-height: 46vh; overflow-y: auto; padding-right: 2px; }
.tool-push-summary { font-size: .78rem; color: var(--text-secondary); font-weight: 600; }
.tool-push-empty { font-size: .85rem; color: var(--text-muted); text-align: center; padding: 18px 8px; }
.tool-push-item {
	display: flex; align-items: center; gap: 10px; padding: 9px 10px; border-radius: 10px;
	background: var(--surface-alt); border: 1px solid var(--border);
}
.tool-push-rank {
	width: 22px; height: 22px; flex: 0 0 22px; border-radius: 50%;
	background: var(--accent); color: #fff; font-size: .72rem; font-weight: 800;
	display: flex; align-items: center; justify-content: center;
}
.tool-push-ill {
	width: 42px; height: 42px; flex: 0 0 42px;
	border-radius: 8px; object-fit: cover;
	background: var(--surface-alt); border: 1px solid var(--border);
}
.tool-push-diff-line { margin-top: 3px; }
.tool-push-main { flex: 1; min-width: 0; }
.tool-push-title { font-size: .86rem; font-weight: 700; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tool-push-diff {
	font-size: .68rem; font-weight: 700; padding: 1px 5px; border-radius: 5px; margin-left: 4px;
	background: var(--surface-alt); border: 1px solid var(--border); color: var(--text-secondary);
}
.tool-push-diff-past { background: #4a8fd4; border-color: #4a8fd4; color: #fff; }
.tool-push-diff-present { background: #46a86e; border-color: #46a86e; color: #fff; }
.tool-push-diff-future { background: #8a56c8; border-color: #8a56c8; color: #fff; }
.tool-push-diff-beyond { background: #c9453f; border-color: #c9453f; color: #fff; }
.tool-push-diff-eternal { background: #5b4a8a; border-color: #5b4a8a; color: #fff; }
.tool-push-meta { font-size: .72rem; color: var(--text-muted); margin-top: 2px; }
.tool-push-right { text-align: right; flex: 0 0 auto; }
.tool-push-delta { font-size: 1rem; font-weight: 800; color: var(--success); font-variant-numeric: tabular-nums; }
.tool-push-target { font-size: .68rem; color: var(--text-muted); margin-top: 2px; font-variant-numeric: tabular-nums; }
.tool-push-item-noplay { border-style: dashed; opacity: .85; }
.tool-push-toggle-row { display: flex; align-items: center; gap: 10px; justify-content: space-between; }
/* 需提高优先级：面板内的 label 会命中 .tool-calc label 的纵向布局规则 */
label.tool-push-toggle {
	display: flex; flex-direction: row; align-items: center; gap: 10px; cursor: pointer;
	font-size: .84rem; font-weight: 600; color: var(--text-secondary);
	user-select: none; font-family: "Exo", "L2", sans-serif;
	padding: 4px 0;
	flex: 0 0 auto;
}
/* 物量换算模式下，右侧换算说明独占一行，避免挤压左侧曲目信息列 */
.tool-push-note-mode .tool-push-item { flex-wrap: wrap; }
.tool-push-note-mode .tool-push-main { min-width: 150px; }
.tool-push-note-mode .tool-push-right { flex: 1 1 100%; text-align: left; }
.tool-switch { position: relative; display: inline-block; width: 42px; height: 24px; flex: 0 0 42px; }
.tool-switch input { position: absolute; opacity: 0; width: 0; height: 0; }
.tool-switch-slider {
	position: absolute; top: 50%; left: 0; right: 0; height: 53%;
	transform: translateY(-50%);
	box-sizing: border-box;
	border-radius: 999px;
	background: var(--input-bg); border: 1px solid var(--input-border);
	transition: background-color .2s ease, border-color .2s ease;
}
.tool-switch-slider::before {
	content: ""; position: absolute; top: 50%; left: 2px; width: 16px; height: 16px;
	transform: translateY(-50%);
	border-radius: 50%; background: var(--text-muted);
	transition: transform .2s ease, background-color .2s ease;
}
.tool-switch input:checked + .tool-switch-slider { background: var(--accent); border-color: var(--accent); }
.tool-switch input:checked + .tool-switch-slider::before { transform: translateY(-50%) translateX(20px); background: #fff; }
.tool-push-toggle:hover .tool-switch-slider { border-color: var(--accent); }
.tool-push-noplay {
	font-size: .68rem; font-weight: 700; color: var(--warning);
	border: 1px solid var(--warning); border-radius: 5px; padding: 1px 6px; white-space: nowrap;
}
`;
		document.head.appendChild(styleEl);
	}

	// 浮动按钮
	const fab = document.createElement('div');
	fab.id = 'tool-fab';
	fab.setAttribute('data-fab-variant', fabVariant);
	// 允许页面通过 data-fab-bottom 调整方形按钮的底部位置（避免遮挡其他固定按钮）
	const fabBottom = root.getAttribute('data-fab-bottom');
	if (fabBottom) fab.style.bottom = fabBottom;
	fab.innerHTML = (fabVariant === 'square' && fabLabel.length > 2)
		? fabLabel.slice(0, 1) + '<br>' + fabLabel.slice(1)
		: fabLabel;
	fab.title = modalTitle;

	// 弹窗
	const modal = document.createElement('div');
	modal.id = 'tool-modal';
	modal.hidden = true;
	modal.innerHTML =
		'<div id="tool-modal-bg"></div>' +
		'<div id="tool-modal-box">' +
		'	<div class="tool-modal-header">' +
		'		<span class="tool-modal-title"></span>' +
		'		<button type="button" id="tool-modal-close" aria-label="关闭">✕</button>' +
		'	</div>' +
		'	<div class="tool-tabs" role="tablist">' +
		'		<button type="button" class="tool-tab active" data-tool-panel="ptt-calc">单曲PTT计算器</button>' +
		'		<button type="button" class="tool-tab" data-tool-panel="ptt-push">推分推荐</button>' +
		'	</div>' +
		'	<div class="tool-panel active" data-tool-panel="ptt-calc">' +
		'		<div class="tool-calc">' +
		'			<label>谱面定数<input type="number" id="tool-calc-const" step="0.1" min="0" max="13.5" placeholder="如 9.8"></label>' +
		'			<label>游玩分数<input type="number" id="tool-calc-score" step="1" min="0" max="10000100" placeholder="如 9900000"></label>' +
		'			<div class="tool-calc-result"><span class="tool-calc-result-label">单曲潜力值</span><span class="tool-calc-result-value" id="tool-calc-result">—</span></div>' +
		'			<p class="tool-calc-hint">计算方法参考 <a href="https://wiki.arcaea.cn/%E6%BD%9C%E5%8A%9B%E5%80%BC" target="_blank" rel="noopener">Arcaea中文维基 · 潜力值</a></p>' +
		'		</div>' +
		'	</div>' +
		'	<div class="tool-panel" data-tool-panel="ptt-push">' +
		'		<div class="tool-calc">' +
		'			<div class="tool-push-toggle-row">' +
	'				<label class="tool-push-toggle">' +
	'					<span class="tool-switch"><input type="checkbox" id="tool-push-note-toggle"><span class="tool-switch-slider"></span></span>' +
	'					<span>按 Far/Pure/大P 换算</span>' +
	'				</label>' +
	'				<button type="button" id="tool-push-refresh" class="tool-push-refresh">重新计算</button>' +
	'			</div>' +
	'			<div id="tool-push-list" class="tool-push-list"></div>' +
		'		</div>' +
		'	</div>' +
		'</div>';
	modal.querySelector('.tool-modal-title').textContent = modalTitle;

	document.body.appendChild(fab);
	document.body.appendChild(modal);

	// 打开 / 关闭
	fab.addEventListener('click', function () {
		modal.hidden = false;
	});
	function closeModal() {
		modal.hidden = true;
	}
	modal.querySelector('#tool-modal-close').addEventListener('click', closeModal);
	modal.querySelector('#tool-modal-bg').addEventListener('click', closeModal);
	document.addEventListener('keydown', function (e) {
		if (e.key === 'Escape') closeModal();
	});

	// 实时计算单曲潜力值（公式与 calculateSingleRating 一致，参见 Arcaea中文维基“单曲潜力值计算”）
	const constInput = modal.querySelector('#tool-calc-const');
	const scoreInput = modal.querySelector('#tool-calc-score');
	const resultEl = modal.querySelector('#tool-calc-result');
	function recalc() {
		const c = parseFloat(constInput.value);
		const s = parseFloat(scoreInput.value);
		if (isNaN(c) || c <= 0 || isNaN(s) || s < 0) {
			resultEl.textContent = '—';
			return;
		}
		resultEl.textContent = toFloor(calculateSingleRating(s, c, 4), 4);
	}
	constInput.addEventListener('input', recalc);
	scoreInput.addEventListener('input', recalc);

	// 页签切换
	const toolTabs = Array.prototype.slice.call(modal.querySelectorAll('.tool-tab'));
	const toolPanels = Array.prototype.slice.call(modal.querySelectorAll('.tool-panel'));
	toolTabs.forEach(function (tab) {
		tab.addEventListener('click', function () {
			const panelId = tab.getAttribute('data-tool-panel');
			toolTabs.forEach(function (t) {
				t.classList.toggle('active', t === tab);
			});
			toolPanels.forEach(function (p) {
				p.classList.toggle('active', p.getAttribute('data-tool-panel') === panelId);
			});
			if (panelId === 'ptt-push') renderPttPush();
		});
	});
	const pushRefresh = modal.querySelector('#tool-push-refresh');
	if (pushRefresh) {
		pushRefresh.addEventListener('click', function () {
			renderPttPush();
		});
	}
	const noteToggle = modal.querySelector('#tool-push-note-toggle');
	if (noteToggle) {
		noteToggle.addEventListener('change', function () {
			renderPttPush();
		});
	}
}

/* ---------- 推分推荐：让整体PTT产生变化所需的最低加分 ---------- */
function toolEsc(s) {
	return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function (c) {
		return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
	});
}

function toolScoreFormat(n) {
	return Math.round(n).toLocaleString('zh-CN').replaceAll(',', "'");
}

/* 由目标单曲PTT反推所需最低分数 */
function scoreForPtt(targetPtt, constant) {
	let s;
	if (targetPtt >= constant + 1) {
		s = 9800000 + (targetPtt - constant - 1) * 200000;
	} else {
		s = 9500000 + (targetPtt - constant) * 300000;
	}
	return Math.max(0, s);
}

/* 计算推分推荐（取20条，按所需加分从低到高） */
function computePttPush() {
	const records = readLocalStorage() || [];
	const recByKey = {};
	records.forEach(function (r) {
		recByKey[r.songId + '|' + r.difficulty] = r;
	});

	const charts = [];
	Object.keys(songCatalog || {}).forEach(function (songId) {
		const cat = songCatalog[songId];
		Object.keys(cat.difficulties || {}).forEach(function (difficulty) {
			const d = cat.difficulties[difficulty];
			const constant = d.constant;
			if (constant === null || constant === undefined || constant === '') return;
			const rec = recByKey[songId + '|' + difficulty];
			const score = rec ? (Number(rec.score) || 0) : 0;
			charts.push({
				key: songId + '|' + difficulty,
				title: d.title,
				illustration: d.illustration,
				difficulty: difficulty,
				constant: constant,
				score: score,
				hasRecord: !!rec,
				rec: rec || null,
				ptt: calculateSingleRating(score, constant, 4)
			});
		});
	});

	// 按单曲PTT降序；整体PTT = (Best30总和 + Best10总和) / 40（求最小推分，Recent10 按 Best10 即前10名处理）
	charts.sort(function (a, b) { return b.ptt - a.ptt; });
	const top30 = charts.slice(0, 30);
	const best10 = {};
	top30.slice(0, 10).forEach(function (c) { best10[c.key] = true; });
	const inTop30 = {};
	top30.forEach(function (c) { inTop30[c.key] = true; });
	const border30 = top30.length ? top30[top30.length - 1].ptt : 0;
	const currentOverall = (top30.reduce(function (s, c) { return s + c.ptt; }, 0) +
		top30.slice(0, 10).reduce(function (s, c) { return s + c.ptt; }, 0)) / 40;

	// Arcaea 的 PTT 显示截断（不四舍五入）到小数点后2位：推分 = 让显示值 +0.01
	const displayedOverall = Math.floor(currentOverall * 100) / 100;
	const nextDisplay = displayedOverall + 0.01;
	// 使整体PTT显示+0.01所需的单曲PTT增量（规整到9位小数，避免浮点噪声导致推分差1分）
	const deltaBest10 = Math.round(20 * (nextDisplay - currentOverall) * 1e9) / 1e9; // 前10名同时计入Best30与Best10，杠杆2倍
	const deltaNormal = Math.round(40 * (nextDisplay - currentOverall) * 1e9) / 1e9; // 仅计入Best30
	const EPS = 1e-9;
	const results = [];
	charts.forEach(function (c) {
		const cap = c.constant + 2;
		let target;
		if (best10[c.key]) {
			target = c.ptt + deltaBest10;
		} else if (inTop30[c.key]) {
			target = c.ptt + deltaNormal;
		} else {
			target = Math.max(border30 + deltaNormal, c.ptt + deltaNormal);
		}
		if (target > cap + EPS) return; // 已达单曲PTT上限（Pure Memory），无法再提升
		const targetScore = Math.ceil(scoreForPtt(target, c.constant) - EPS);
		const delta = targetScore - c.score;
		if (!(delta > 0)) return;
		results.push({
			chart: c,
			delta: delta,
			targetScore: targetScore
		});
	});
	results.sort(function (a, b) { return a.delta - b.delta; });
	return {
		results: results.slice(0, 20),
		currentOverall: currentOverall,
		displayedOverall: displayedOverall,
		nextDisplay: nextDisplay,
		total: results.length
	};
}

/* 按物量换算推分：Far→Pure 每个 +5000000/N，Lost→Pure 每个 +10000000/N，Pure→大P 每个 +1 分 */
function toolPushNoteInfo(c, delta) {
	if (!c.rec) return null; // 无记录，无法换算
	const r = c.rec;
	const N = r.objectAmount || (Number(r.perfect) + Number(r.far) + Number(r.lost));
	if (!N || N <= 0) return { noNotes: true }; // 缺少物量信息
	const farGain = 5000000 / N;
	const lostGain = 10000000 / N;
	const farAvail = Number(r.far) || 0;
	const lostAvail = Number(r.lost) || 0;
	const bigAvail = Math.max(0, (Number(r.perfect) || 0) - (Number(r.criticalPerfect) || 0));
	const farCnt = Math.ceil(delta / farGain - 1e-9);
	const lostCnt = Math.ceil(delta / lostGain - 1e-9);
	const bigPCnt = Math.min(delta, N); // 大P数量不可能超过总物量，显示上限取N；每个大P +1分
	const bigPFeasible = delta <= bigAvail; // 需要恰好delta个可转换的普通Pure
	// 最少物量组合：Lost 收益最高优先，其次 Far，最后大P；受现有数量限制
	let rem = delta;
	let uLost = lostAvail > 0 ? Math.min(lostAvail, Math.ceil(rem / lostGain - 1e-9)) : 0;
	rem -= uLost * lostGain;
	let uFar = 0;
	if (rem > 1e-6 && farAvail > 0) {
		uFar = Math.min(farAvail, Math.ceil(rem / farGain - 1e-9));
		rem -= uFar * farGain;
	}
	let uBig = 0;
	if (rem > 1e-6 && bigAvail > 0) {
		uBig = Math.min(bigAvail, Math.ceil(rem));
		rem -= uBig;
	}
	return {
		farCnt: farCnt,
		lostCnt: lostCnt,
		bigPCnt: bigPCnt,
		bigPFeasible: bigPFeasible,
		farAvail: farAvail,
		lostAvail: lostAvail,
		bigAvail: bigAvail,
		uLost: uLost,
		uFar: uFar,
		uBig: uBig,
		comboShort: rem > 1e-6
	};
}

/* 渲染推分推荐列表 */
function renderPttPush() {
	const listEl = document.getElementById('tool-push-list');
	if (!listEl) return;
	if (!songDataReady) {
		listEl.innerHTML = '<div class="tool-push-empty">曲目数据加载中，请稍候…</div>';
		if (!renderPttPush._retrying) {
			renderPttPush._retrying = true;
			let tries = 0;
			const timer = setInterval(function () {
				if (songDataReady) {
					clearInterval(timer);
					renderPttPush._retrying = false;
					renderPttPush();
				} else if (++tries > 40) {
					clearInterval(timer);
					renderPttPush._retrying = false;
					listEl.innerHTML = '<div class="tool-push-empty">曲目数据加载失败，请刷新页面重试</div>';
				}
			}, 500);
		}
		return;
	}
	const noteToggleEl = document.getElementById('tool-push-note-toggle');
	const noteMode = !!(noteToggleEl && noteToggleEl.checked);
	listEl.classList.toggle('tool-push-note-mode', noteMode);
	const data = computePttPush();
	if (!data.results.length) {
		listEl.innerHTML = '<div class="tool-push-empty">暂无可行的推分推荐：要么没有载入任何成绩，要么全部成绩都已达到单曲PTT上限</div>';
		return;
	}
	const rows = data.results.map(function (r, i) {
		const c = r.chart;
		const noplay = !c.hasRecord;
		let rightHtml;
		if (noteMode) {
			const info = toolPushNoteInfo(c, r.delta);
			if (!info) {
				rightHtml = '<div class="tool-push-right">' +
					'	<div class="tool-push-delta">—</div>' +
					'	<div class="tool-push-target">无记录，无法换算物量</div>' +
					'</div>';
			} else if (info.noNotes) {
				rightHtml = '<div class="tool-push-right">' +
					'	<div class="tool-push-delta">—</div>' +
					'	<div class="tool-push-target">缺少物量信息（未填写P/F/L）</div>' +
					'</div>';
			} else {
				const parts = [];
				if (info.uLost > 0) parts.push('Lost×' + info.uLost);
				if (info.uFar > 0) parts.push('Far×' + info.uFar);
				if (info.uBig > 0) parts.push('大P×' + info.uBig);
				const combo = parts.join(' + ') || '—';
				const alt = '或 Far×' + info.farCnt + (info.farCnt > info.farAvail ? '(不足)' : '') +
					' / Lost×' + info.lostCnt + (info.lostCnt > info.lostAvail ? '(不足)' : '') +
					' / 大P×' + info.bigPCnt + (info.bigPFeasible ? '' : '(不足)');
				rightHtml = '<div class="tool-push-right">' +
					'	<div class="tool-push-delta">' + combo + (info.comboShort ? '（物量不足）' : '') + '</div>' +
					'	<div class="tool-push-target">' + alt + '<br>当前 Far ' + info.farAvail + ' / Lost ' + info.lostAvail + ' / 可大P ' + info.bigAvail + '</div>' +
					'</div>';
			}
		} else {
			rightHtml = '<div class="tool-push-right">' +
				'	<div class="tool-push-delta">+' + toolScoreFormat(r.delta) + '</div>' +
				'	<div class="tool-push-target">→ ' + toolScoreFormat(r.targetScore) + '</div>' +
				'</div>';
		}
		return '<div class="tool-push-item' + (noplay ? ' tool-push-item-noplay' : '') + '">' +
			'<span class="tool-push-rank">' + (i + 1) + '</span>' +
			'<img class="tool-push-ill" src="Processed_Illustration/' + toolEsc(c.illustration || (c.songId + '.jpg')) + '" loading="lazy" alt="" onerror="this.style.visibility=\'hidden\'">' +
			'<div class="tool-push-main">' +
			'	<div class="tool-push-title">' + toolEsc(c.title) + '</div>' +
			'	<div class="tool-push-diff-line"><span class="tool-push-diff tool-push-diff-' + toolEsc(c.difficulty.toLowerCase()) + '">' + toolEsc(c.difficulty) + '</span></div>' +
			'	<div class="tool-push-meta">定数 ' + toolEsc(c.constant) + ' · ' + (noplay
				? '<span class="tool-push-noplay">未游玩（无记录）</span>'
				: '当前 ' + toolScoreFormat(c.score)) + '</div>' +
			'</div>' +
			rightHtml +
			'</div>';
	}).join('');
	listEl.innerHTML =
		'<div class="tool-push-summary">当前整体PTT（显示）≈ ' + toFloor(data.displayedOverall, 2) +
		' · 共 ' + data.total + ' 条可行，以下为推分最少的20条（每项达标后整体PTT显示 ' + toFloor(data.nextDisplay, 2) + '，+0.01）</div>' + rows;
}

$(function () {
	initToolWidgets();
});
