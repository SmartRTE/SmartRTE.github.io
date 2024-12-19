let db; //以上两条为sql.js相关
let SQL; //以上两条为sql.js相关

let difficultyList = ['Past', 'Present', 'Future', 'Beyond', 'Eternal'];
let filteredArray = [];
let currentArray = [];
let rbm = [];
let avatarList = [];
let idx_constant = [];
let finalOutputScore = [];
let songlist = {}; //idx - songId 键值对
let idData = {};
let unitQuantity = 39;
let uidFlag = true;
let p30Flag = 0; //0=b 1=p 2=s
let userCourseDanPath = 'img/course/';
let illustrationPath = 'Processed_Illustration/';
let defaultCSVPath = 'sample/default.csv'
let songRankingPath = 'img/rank/';
let backgoundImagePath = 'bgs/';
let avatarPath = 'img/avatar/'
let defaultCSV = '';
let avatarListPath = 'sample/avatar.csv';
let potentialFramePath = 'img/rating/rating_';
let sqlWasmPath = "sql-wasm.wasm"; //sql.wasm路径
let queryFilePath = "json/query.sql"; //sql查询代码文件路径
let diffSongNameMapping = null; //差分曲名映射
let diffIllMapping = null; //差分曲绘映射

let testDataArray = [];

let constant = []; //定数表
let constConstant = [];
let baseArray = []; //用于详情和Aichan推荐的固定组
let tempcstArray = [];
let completionTable = {}; //完成表
let rangeUpperBound = 11.0; //筛选中的最高定数边界
let rangeLowerBound = 10.0; //筛选中的最低定数边界

$(document).ready(function () {
	//首次加载保证transition生效
	displayWindow('modify-window');
	displayWindow('setting-window');
	displayWindow('ptt-p30');
	displayWindow('ai-chan-dialog');
	//初始化曲名映射
	diffSongNameMapping = getTitleMapping();
	//初始化曲绘映射
	diffIllMapping = getImageMapping();
	// displayWindow('ai-chan');
	songlist = initializeSonglist();
	// readConstantChart();
	initializeVHZEK();
	initializeBound();
	changeBound();
	getConstantSheet();
	//初始化设置监听
	initializeSettingListener();
	//初始化缓存设置
	initializeSettings();
	//初始化头像列表
	initializeAvatarList();
	//初始化背景图片列表
	initializeBackgroundList();
	//初始化段位边框列表
	initializeUserCourseDanList();
	//初始化sqlite.js
	initializeSqliteJs();
	//读取查询语句文件
	initializeQuery();
	//初始化上传文件监听
	initializeUploadListener();
	//初始化二维码
	initializeQRCode();
	//初始化AI-chan推荐
	initializeAiChan();
	filteredArray = currentArray;
	$(window).on('resize', function () {
		resizeWidth(1);
	});
	resizeWidth(1);

	// 页面加载显示时间
	showTime();
	// 每秒更新时间显示
	setInterval(showTime, 1000);
});

function initializeBound() {
	rangeUpperBound = localStorage.rangeUpperBound ? localStorage.rangeUpperBound : 12.0;
	rangeLowerBound = localStorage.rangeLowerBound ? localStorage.rangeLowerBound : 9.0;
	$('#range-upper-bound').val(rangeUpperBound);
	$('#range-lower-bound').val(rangeLowerBound);
}
/**
 * 初始化数据列表
 * 当缓存内没有savedArrayData时，拉取默认default.csv生成数据
 * 当缓存内有旧的saved_csv_data时，启动转换并删除旧数据
 * 当缓存内有savedArrayData时，直接生成
 */
function initializeDataArray() {
	if (localStorage.saved_csv_data) {
		runConvert(localStorage.saved_csv_data);
		localStorage.removeItem('saved_csv_data');
	} else if (localStorage.savedArrayData) {
		currentArray = getResultArray();
		unitQuantity = localStorage.unitQuantity;
		unitQuantity = 39;
		refillCurrentArray(currentArray);

	} else {
		let tempCSV = '';
		fetch(defaultCSVPath)
			.then(response => response.text())
			.then(data => {
				runConvert(data);
			})
			.catch(error => console.error('Error:', error));
	}
}

/**
 * 从localStorage中读取缓存的成绩信息，赋值给currentArray并返回一份
 * @return {Array<PlayResult>} 缓存的分数数组
 */
function getResultArray() {
	let tary = readLocalStorage();
	// console.table(tary);
	currentArray = tary;
	return tary;
}

/**
 * 为设置面板的：
 * -玩家名
 * -好友码
 * -潜力值
 * -自定义头像是否选用
 * -自定义背景是否选用
 * 设置监听
 */
function initializeSettingListener() {
	$('#user-name-input').on('input', function () {
		var val = $('#user-name-input').val();
		$('#user-name').text(val);
		localStorage.setItem('userName', val);
	});
	$('#user-id-input').on('input', function () {
		var val = $('#user-id-input').val();
		$('#user-id span').text(formatUserID(val));
		localStorage.setItem('userId', val);
	});
	$('#potential-input').on('input', function () {
		var val = $('#potential-input').val();
		$('#potential-value').text(val);
		changePotential(parseFloat(val));
	});

	$('#use-custom-avatar').on('change', function () {
		let isChecked = $('#use-custom-avatar').is(':checked');
		console.log(isChecked);
		if (!isChecked) {
			changeAvatar(localStorage.avatar);
			displayWindow('avatar-select');
			localStorage.useCustomAvatar = false;
		} else {
			if (localStorage.customAvatar) {
				localStorage.useCustomAvatar = true;
				$('#icon img').attr('src', localStorage.customAvatar);
			} else {
				alert('还没有上传过自定义头像！\n点击右边可以手动上传~');
				$('#use-custom-avatar').prop("checked", false);
			}
		}
	});

	$('#use-custom-background').on('change', function () {
		let isChecked = $('#use-custom-background').is(':checked');
		console.log(isChecked);
		if (!isChecked) {
			changeBackgroundImage(localStorage.backgroundImage);
			displayWindow('background-select');
			localStorage.useCustomBackground = false;
		} else {
			if (localStorage.customBackground) {
				$('#background').css('background-image', `url(${localStorage.customBackground})`);
				localStorage.useCustomBackground = true;
			} else {
				alert('还没有上传过自定义背景！\n点击右边可以手动上传~');
				$('#use-custom-background').prop("checked", false);
			}
		}
	});

}



/**
 * 页面加载时将缓存数据内的设置部分替换到页面内
 */
function initializeSettings() {
	// let r10,b30,max;
	if (localStorage.saved_username) {
		localStorage.userName = localStorage.saved_username;
		localStorage.removeItem('saved_username');
	}
	if (!localStorage.userName) {
		localStorage.userName = 'Hikari';
	}
	if (localStorage.saved_user_id) {
		localStorage.userId = localStorage.saved_uid;
		localStorage.removeItem('saved_uid');
	}
	if (!localStorage.userId) {
		localStorage.userId = '100000001';
	}
	if (localStorage.saved_bg) {
		localStorage.backgroundImage = localStorage.saved_bg;
		localStorage.removeItem('saved_bg');
	}
	if (!localStorage.backgroundImage) {
		localStorage.backgroundImage = '8';
	}
	if (!localStorage.courseDanFrame) {
		localStorage.courseDanFrame = "1";
	}
	if (localStorage.saved_ptt) {
		localStorage.potential = localStorage.saved_ptt;
		localStorage.removeItem('saved_ptt');
	}
	if (!localStorage.potential) {
		localStorage.potential = 6.16;
	}
	if (!localStorage.rbm) {
		localStorage.rbm = [6.16, 6.16, 6.16];
	}
	if (!localStorage.potentialFrame) {
		localStorage.potentialFrame = 1;
	}
	if (localStorage.saved_icon) {
		localStorage.avatar = localStorage.saved_icon;
		localStorage.removeItem('saved_icon');
	}
	if (!localStorage.avatar) {
		localStorage.avatar = '34u';
	}
	if (localStorage.customAvatar) {
		$('#custom-avatar img').attr('src', localStorage.customAvatar);
	}

	if (localStorage.customBackground) {
		$('#custom-background img').attr('src', localStorage.customBackground);
	}

	$('#user-name-input').val(localStorage.userName);
	$('#user-name').text(localStorage.userName);
	$('#user-id-input').val(localStorage.userId);
	$('#user-id span').text(formatUserID(localStorage.userId));
	let t = localStorage.rbm.split(',');
	rbm = t;
	$('#ptt-max span').text(toFloor(parseFloat(t[2]), 4));
	$('#ptt-b30 span').text(toFloor(parseFloat(t[1]), 4));
	$('#ptt-r10 span').text(toFloor(parseFloat(t[0]), 4));
	$('#potential-input').val(localStorage.potential);
	$('#potential-value').text(toFloor(parseFloat(localStorage.potential), 2));
	changePotential(localStorage.potential);
	changePotentialFrame(localStorage.potentialFrame);
	changeAvatar(localStorage.avatar);
	changeCourseDanFrame(localStorage.courseDanFrame);
	changeBackgroundImage(localStorage.backgroundImage);

	if (localStorage.useCustomAvatar == 'true') {
		$('#use-custom-avatar').prop("checked", true);
		$('#icon img').attr('src', localStorage.customAvatar);
	}

	if (localStorage.useCustomBackground == 'true') {
		$('#use-custom-background').prop("checked", true);
		$('#background').css('background-image', `url(${localStorage.customBackground})`);;
	}
}


/**
 * 通过button触发input的上传
 */
function inputFile(id) {
	$(`#${id}`).click();
}


/**
 * 初始化监听上传文件
 */
function initializeUploadListener() {
	//监听上传st3或csv文件事件
	$('#file-input').change(function () {
		console.log("file-input active");
		let selectedFile = this.files[0];
		// console.log(selectedFile);
		if (selectedFile) {
			let fileName = selectedFile.name;
			console.log("selectedFileName:" + fileName);
			if (fileName.endsWith(".csv")) {
				let reader = new FileReader();
				reader.onload = function (e) {
					csvContent = reader.result;
					console.log("CSV Content:" + "success");
					// console.log("CSV Content:" + csvContent);
					runConvert(csvContent);
				};
				reader.readAsText(selectedFile);
			} else if (fileName.endsWith(".xls") || fileName.endsWith(".xlsx")) {
				console.log("VHZek");
				readVHZek(selectedFile);
				
				location.reload()
			} else {
				runQuery(selectedFile);
				console.log("Not a .csv file");
			}
		}
		$('#file-input').val('');
	});
	//监听自定义头像上传事件
	$('#custom-avatar-input').on('change', function (event) {
		const file = event.target.files[0];
		const reader = new FileReader();
		if (file.size > 1048576) {
			console.log("over 1MB");
			alert("图片大小超过1MB，请尝试换一张或压缩质量后再试");
		} else {
			reader.readAsDataURL(file);
			reader.onload = function () {
				const base64Image = reader.result;
				$('#temp-avatar').attr('src', base64Image);
				// displayCachedImage(base64Image);
				$('#temp-avatar').ready(function () {
					clipDiamond();
					// console.log(base64Image);

				});
			};
		}
	});
	//监听自定义背景图上传事件
	$('#custom-background-input').on('change', function (event) {
		const file = event.target.files[0];
		const reader = new FileReader();
		if (file.size > 3145728) {
			console.log("over 3MB");
			alert("图片大小超过3MB，请尝试换一张或压缩质量后再试");
		} else {

			reader.readAsDataURL(file);
			reader.onload = function () {
				const base64Image = reader.result;
				$('#custom-background img').attr('src', base64Image);
				localStorage.setItem('customBackground', base64Image);
				if ($('#use-custom-background').is(':checked')) {
					$('#background').css('background-image', `url(${base64Image})`);;
					// $('#use-custom-background').prop('checked', false);
				}
			};
		}
	});

}
/**
 * 运行查询语句
 */
async function runQuery(file) {
	let buffer = await file.arrayBuffer();
	let uInt8Array = new Uint8Array(buffer);
	db = new SQL.Database(uInt8Array);

	if (!db) {
		console.error('Database not opened.');
		alert("st3文件选取有误，请重试！");
		return;
	}
	// console.log(query);
	let result = db.exec(query);
	if (result.length > 0) {
		// console.log(result[0]);
		saveQueryResult(result[0]);
	} else {
		alert("上传的数据库是空的！你是不是忘记把存档同步到本地辣？");
	}
}


/**
 * 通过sql查询结果生成成绩对象数组并生成新的页面内容，包括各种数值的计算和成绩单元生成
 * @param result sql查询结果
 */
function saveQueryResult(result) {
	// //保存表头
	// columns = result.columns;
	let temp = result.values;
	// console.log(temp);
	//置空
	currentArray = [];
	temp.forEach((singleResult, index) => {
		// console.log(singleResult);
		let single = new PlayResult(singleResult[0], singleResult[1], singleResult[2], singleResult[3],
			singleResult[4], singleResult[5], singleResult[6], singleResult[7], singleResult[8],
			singleResult[9], index);
		currentArray.push(single);
	});
	filteredArray = currentArray;
	// displayB30(currentArray);
	// generateCard(currentArray);
	// generateTable(currentArray);
	// console.table(currentArray);
	saveLocalStorage(currentArray);
	refillCurrentArray(currentArray);
	displayB30(currentArray);
	location.reload();
	// switchP30(0);
}

/**
 * 将csv格式的分数表转换成为成绩对象数组
 * @param csv 待转化的csv文件，必须是旧版或新版页面能生成和读取的对应格式
 */
function runConvert(csv) {
	file = csv.trim();
	const rows = file.split('\n');
	tempArray = [];
	for (i = 1; i < rows.length; i++) {
		const row = rows[i].split(',');
		single = new PlayResult(row[0], row[1], row[2],
			parseFloat(row[3]), parseFloat(row[4]),
			parseFloat(row[5]), parseFloat(row[6]),
			parseFloat(row[7]), parseFloat(row[8]),
			parseFloat(row[9]), i - 1);
		tempArray.push(single);
	}
	currentArray = tempArray;
	console.log("runconvert over");
	saveLocalStorage(currentArray);
	displayB30(currentArray);
	refillCurrentArray(currentArray);
	location.reload();
}

function refillCurrentArray(array) {
	let ary = array;
	let cst = constConstant;
	//按照定数递减-songId递减-
	//difficulty按Present-Past-Future-Eternal-Beyond
	ary.sort(function (a, b) {
		return stringSort(a, b, -1);
	});
	ary.sort(function (a, b) {
		return resultSort(a, b, 'constant', 1);
	});
	for (i = 0; i < ary.length; i++) {
		for (j = 0; j < cst.length; j++) {
			;
			if ((ary[i].songId == cst[j].songId) && (ary[i].difficulty == cst[j].difficulty)) {
				cst[j] = ary[i];
				break;
			}
		}
	}
	baseArray = cst;
	console.log(baseArray);
	cst.sort(function (a, b) {
		return resultSort(a, b, 'playRating', 1);
	});

	cst.sort(function (a, b) {
		return resultSort(a, b, 'innerIndex', -1);
	});

	cst.sort(function (a, b) {
		return resultSort(a, b, 'constant', 1);
	});

	generateUnits(cst, constant.length);
	baseArray.sort(function (a, b) {
		return resultSort(a, b, 'innerIndex', -1);
	});

}

function stringSort(a, b, order) {
	if (a['songId'] !== b['songId']) {
		// 使用字符串比较代替数值减法
		// console.log(a[attr].localeCompare(b[attr]));
		return order * (a['songId'].localeCompare(b['songId'])); // 注意这里使用 localeCompare 方法
	}
	return order * (a['difficulty'].localeCompare(b['difficulty']));
}


/**
 * 计算显示B30数据
 * @param array 成绩对象数组
 */
function displayB30(array) {
	let ary = array;
	ary.sort(function (a, b) {
		return resultSort(a, b, 'playRating', 1);
	});
	console.log(ary);
	rbm = calculateMax(ary);
	localStorage.rbm = rbm;
	// generateUnits(array, unitQuantity);
	$('#ptt-max span').text(toFloor(parseFloat(rbm[2]), 4));
	$('#ptt-b30 span').text(toFloor(parseFloat(rbm[1]), 4));
	$('#ptt-r10 span').text(toFloor(parseFloat(rbm[0]), 4));
}

function displayAccuratePtt() {
	alert(`精确数值（大概）：\n不推分可获得的最高PTT:${rbm[2]}\nBest30平均值：${rbm[1]}\nRecent10平均值：${rbm[0]}`);
}

/**
 * 用于对输入的好友码自动规范化，每三位数用一位空格分隔，前补0补满9位数
 * @param {string} id
 * @return {string} 规范化后的好友码字符串
 */
function formatUserID(id) {
	let t = ('000000000' + id).slice(-9);
	let strArr = [];
	for (i = 0; i < 9; i += 3) {
		strArr.push(t.slice(i, i + 3));
	}
	let newID = strArr.join(' ');
	return newID;
}

/**
 * 计算并返回页面的高度，用于限制调整页面缩放前后以及生成图片时的高度表现
 * @return 计算后的精确高度
 */
function getCaptureHeight() {
	captureHeight = document.getElementById('container').offsetHeight +
		document.getElementById('b30-data').offsetHeight +
		document.getElementById('copyright').offsetHeight +
		39 - 80; //固定margin
	return captureHeight;
}

/**
 * 生成游玩结果单元，生成结束后重新调整页面宽度和高度
 * @param {Array<PlayResult>} array 待生成单元的成绩数组
 * @param {number} unitQuantity 待生成单元的个数
 */
async function generateUnits(array, unitQuantity) {
	let breaker = {
		"11": 1,
		"11.1": 1,
		"11.2": 1,
		"11.4": 1,
		"11.5": 1,
		"11.6": 1,
		"11.7": 1,
		"11.8": 1,
		"11.9": 1
	}
	// console.log('generateUnits called');
	let ary = array;
	$('#b30-data').html('');
	let index = 0;
	let indexSlicer = [0, 0];
	let cst = -1;
	let spliterCounter = 0;
	// console.log(index)
	for (index; index < ary.length; index++) {
		if (parseFloat(ary[index].constant) <= rangeUpperBound) {
			// console.log(index);
			break;
		}
	}
	// console.log(breaker);
	for (index; index < ary.length; index++) {
		if (ary[index].constant < rangeLowerBound) {
			break;
		}
		if (cst != ary[index].constant) {
			if (String(ary[index].constant) in breaker) {
				cst = ary[index].constant;
				// console.log(cst);
			} else {
				indexSlicer.shift();
				indexSlicer.push(index);
				// console.log(indexSlicer)
				let slicedArray = ary.slice(indexSlicer[0], indexSlicer[1]);
				cst = ary[index].constant;
				// console.log('cst:', cst)
				appendSpliter(cst, spliterCounter);
				appendStatistics(spliterCounter - 1, slicedArray, indexSlicer[1] - indexSlicer[0]);
				spliterCounter++;
			}
		}
		// console.log(ary[index]);
		appendSongUnit(ary[index], index + 1);
	}
	let i = indexSlicer[1];
	for (i; (parseFloat(ary[i].constant) >= rangeLowerBound && (i < ary.length - 1)); i++) { }

	appendStatistics(spliterCounter - 1, ary.slice(indexSlicer[1], i), i - indexSlicer[1]);
	resizeWidth();
}
/**
 * 补齐时间显示部分的两位数字
 * @param {string} value 原始数值
 * @return {string} 补充过后的字符串
 */
function fillZero(value) {
	return ('0' + value).slice(-2);
}
/**
 * 自动更改页面底部显示的时间，频率为1s/次
 */
async function showTime() {
	var now = new Date();
	var year = now.getFullYear();
	var month = fillZero(now.getMonth() + 1);
	var day = fillZero(now.getDate());
	var hours = fillZero(now.getHours());
	var minutes = fillZero(now.getMinutes());
	var seconds = fillZero(now.getSeconds());

	var formattedTime = year + "/" + month + "/" + day + "\t" + hours + ":" + minutes + ":" + seconds;

	$('#copyright span:last').text(formattedTime);
}

/**
 * 生成单个游玩成绩单元，由各种元素拼合而成
 * @param {PlayResult} currentRow 从成绩对象数组中传入的一个成绩对象
 * @param {number} index 该条成绩在数组中的下标，用来显示排名
 * 
 */
function appendSongUnit(currentRow, index) {
	// console.log(currentRow.songName)
	let currentUnit = $('<div class="song-result-unit" id="' +
		currentRow.songId + '-' + currentRow.difficulty +
		'">').addClass(currentRow.difficulty.toLowerCase());
	if (currentRow.score == -1) {
		currentUnit.addClass('no-record');
	}
	let ill;
	if (currentRow.innerIndex > 90000) {
		ill = $('<div>').addClass('song-illustration-container');
	} else {
		ill = $('<div onclick="modifyPlayResult(' + currentRow.innerIndex + ', baseArray)">').addClass(
			'song-illustration-container');
	}
	ill.append($('<img>').addClass('song-illustration').attr('src', illustrationPath + currentRow.illustration));

	let info = $('<div>').addClass('song-information');
	info.append($('<div>').addClass('song-playrating')
		.text(currentRow.playRating ? toFloor(currentRow.playRating, 4) : ':D'));
	// let z = String(currentRow.constant).split('.');
	// console.log(z);
	// info.append($('<div>').addClass('song-constant');
	// 	.text(currentRow.difficulty + z[0] + (z[1] >= 7 ? '+ ' : ' ') + '[' + currentRow.constant + ']'));
	// info.append($('<div>').addClass('song-rank').text('#' + index));
	// let sn = $('<div>').addClass('song-name').text(currentRow.songName);
	let ss = $('<div>').addClass('song-score').text(currentRow.score > 0 ? scoreFormat(parseInt(currentRow.score)) :
		'NO-RECORD');
	// let si = $('<div>').addClass('song-items');
	// si.append($('<div>').addClass('item-pure').text('P/' + currentRow.perfect + '(-' + currentRow
	// 	.normalPerfect + ')'));
	// si.append($('<div>').addClass('item-far').text('F/' + currentRow.far));
	// si.append($('<div>').addClass('item-lost').text('L/' + currentRow.lost));

	let rk = getSongRanking(currentRow.score, currentRow.far, currentRow.lost);
	let ri = $('<img>').addClass('song-ranking-image').attr('src', songRankingPath + rk + '.png');

	if (rk == 'PM' && (currentRow.perfect != 0) && (currentRow.criticalPerfect == currentRow.perfect)) {
		currentUnit.addClass('theoretical');
	}
	currentUnit.append(ill);
	currentUnit.append(info);
	// currentUnit.append(sn);
	currentUnit.append(ss);
	// currentUnit.append(si);
	currentUnit.append(ri);
	$('#b30-data').append(currentUnit);
}


/**
 * 通过潜力值返回对应的潜力值星框
 * @param {number} max （最大）潜力值
 * @return {number} 对应的潜力值星框对应的图片序号
 */
function getPotentialFrame(max) {
	const ranges = [3.49, 6.99, 9.99, 10.99, 11.99, 12.49, 12.99, 13.5];
	const frames = [0, 1, 2, 3, 4, 5, 6, 7];
	for (let i = 0; i < ranges.length; i++) {
		if (max <= ranges[i]) {
			return frames[i];
		}
	}
}


/**
 * 生成overflow的分隔线和分割文字图片，以及统计信息小字
 * @param {Number} cst 分割线下对应的曲目定数
 * @param {Number} cst 目前生成的是第几条分割线
 */
function appendSpliter(cst, spliterCounter) {
	let overflow = $(`<div class="spliter-overflow" id="spliter${spliterCounter}">`).addClass('spliter');
	overflow.append($('<img class="spliter-image-overflow">').addClass('spliter-image').attr('src', 'img/divider.png'));
	overflow.append($('<img class="spliter-text-overflow">').attr('src',
		`img/constant/${parseFloat(cst).toFixed(1)}.png`));
	$('#b30-data').append(overflow);

}

function appendStatistics(spliterCounter, slicedArray, count) {
	// console.log(spliterCounter)
	let spliter = $(`#spliter${spliterCounter}`);
	// console.log(spliter.length > 0 ? true : false)
	let ranks = ['PM', 'FR', 'EX+', 'EX', 'AA', 'A', 'B', 'C', 'D'];
	let area = $(`<div class="spliter-statistics-area">`);

	let temp = slicedArray;
	let sts = getStatistics(temp);
	// console.log(`cst:${cst},sts:${sts}`)
	ranks.forEach(function (rank) {
		area.append(
			$(`<div class="spliter-statistics-unit">`)
				.append(
					$(`<img class="spliter-statistics-image" src="img/rank/${rank}.png">`)
				)
				.append(
					$(`<p class=spliter-statistics-number>`).text((sts[rank] ? sts[rank].length : 0) + '/' +
						count)
				)
		);
	});
	spliter.append(area);
}

/**
 * 对分数进行规范化，每3位以角标'分隔
 * @return {string} 加入了分隔符号后的分数字符串
 */
function scoreFormat(score) {
	return score.toLocaleString().replaceAll(',', "'");
}


/**
 * 对html2canvas生成的图片进行二次压缩减小体积
 * @param {string} dataURL 压缩前图片对应的dataURL
 * @param {number} quality 图片质量（0~1.0） 
 * @return {string} 压缩后图片对应的dataURL
 */
async function compressImage(dataURL, quality) {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.onload = function () {
			const canvas = document.createElement('canvas');
			const ctx = canvas.getContext('2d');

			canvas.width = img.width;
			canvas.height = img.height;

			ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

			const compressedDataURL = canvas.toDataURL('image/jpeg', quality);

			resolve(compressedDataURL);
		};
		img.onerror = reject;
		img.src = dataURL;
	});
}

/**
 * 使用html2canvas库，将页面主体部分捕获转换为canvas，再进一步转换成为图片保存
 * @param {string} captureId 将捕获的容器元素的id，这个id的元素及子元素都会被捕获
 * 
 */
async function saveAsImage(captureId) {
	resizeWidth(0);
	$('#mainCover').css({
		'display': 'flex',
	});
	const id = document.getElementById(captureId);
	const captureWidth = document.getElementById('mainCapture').offsetWidth;
	const captureHeight = getCaptureHeight();
	html2canvas(id, {
		useCORS: true,
		width: captureWidth,
		height: captureHeight,
		scale: 1.2
	}).then(async canvas => {
		const dataURL = canvas.toDataURL('image/jpg');
		const compressedDataURL = await compressImage(dataURL, 0.6);
		// const compressedDataURL = dataURL;
		const link = document.createElement('a');
		link.href = compressedDataURL;
		link.download = 'B30_' + localStorage.userName +
			"_" + $('#copyright span').text().replace('\t', '-') +
			'.jpg';
		const img = document.createElement('img');
		img.src = compressedDataURL;

		const newTab = window.open();
		newTab.document.body.appendChild(img);

		img.style.width = '100%';
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
		resizeWidth(1);
		$('#mainCover').css({
			'display': 'none',
		});
	});
}

/**
 * 更改显示单元数
 */
function changeBound() {
	let u = $('#range-upper-bound').val();
	let l = $('#range-lower-bound').val();
	rangeUpperBound = Math.max(u, l);
	rangeLowerBound = Math.min(u, l);
	if (rangeUpperBound <= 12.0 && rangeUpperBound >= 11.4) {
		rangeUpperBound = 12.0
	} else if (rangeUpperBound <= 11.3 && rangeUpperBound >= 11.0) {
		rangeUpperBound = 11.3
	}

	if (rangeLowerBound <= 12.0 && rangeLowerBound >= 11.4) {
		rangeLowerBound = 11.4
	} else if (rangeLowerBound <= 11.3 && rangeLowerBound >= 11.0) {
		rangeLowerBound = 11.0
	}
	$('#range-upper-bound').val((rangeUpperBound).toFixed(1));

	$('#range-lower-bound').val((rangeLowerBound).toFixed(1));
	localStorage.rangeLowerBound = rangeLowerBound;
	localStorage.rangeUpperBound = rangeUpperBound;
	refillCurrentArray(currentArray);
}

function displayNoRecord() {
	if (!$('#no-record-hidden').is(':hidden')) {
		$('#no-record-hidden').hide();
		$('.no-record').hide();
		$('#no-record-button').text('显示没有记录的成绩');
	} else {
		$('#no-record-hidden').show();
		$('.no-record').show();
		$('#no-record-button').text('隐藏没有记录的成绩');
	}
	resizeWidth();
}

/**
 * 修改分数内容后重新计算分数、重新加载显示单元
 * @param {Array<PlayResult>} array 要填入的分数对象数组
 * 
 */
function reloadContent(array) {
	array.sort(function (a, b) {
		return resultSort(a, b, 'playRating', 1);
	});
	array.forEach(function (currentRow, index) {
		currentRow.innerIndex = index;
	});

	saveLocalStorage(array);
	rbm = calculateMax(currentArray);
	localStorage.rbm = rbm;
	// switchP30(0);
}

/**
 * 调整页面缩放
 * @param {number} flag 1=计算缩放 0=重置缩放到100%
 */

function resizeWidth(flag = 1) {
	var scaleValue;
	if (flag == 1) {
		scaleValue = document.documentElement.clientWidth / 1700;
	} else {
		scaleValue = 1;
	}
	// console.log("resized" + document.documentElement.clientWidth + scaleValue);
	$('#mainCapture').css({
		'-moz-transform-origin': '0 0',
		'-webkit-transform-origin': '0 0',
		'-ms-transform-origin': '0 0',
		'transform-origin': '0 0',
		'-moz-transform': 'scale(' + scaleValue + ')',
		'-webkit-transform': 'scale(' + scaleValue + ')',
		'-ms-transform': 'scale(' + scaleValue + ')',
		'transform': 'scale(' + scaleValue + ')',
		'height': getCaptureHeight() * scaleValue + 'px',
		// 'zoom': scaleValue
	});
	$('body').css({
		'height': getCaptureHeight() * scaleValue + 'px',
		'width': 1700 * scaleValue + 'px'
	});
	$('#background').css({
		'height': getCaptureHeight() + 'px'
	});
	$('#background-image').css({
		'height': getCaptureHeight() + 'px'
	});
	scaleValue = document.documentElement.clientWidth / 1700;
	$('#mainCover').css({
		'-moz-transform-origin': '0 0',
		'-webkit-transform-origin': '0 0',
		'-ms-transform-origin': '0 0',
		'transform-origin': '0 0',
		'-moz-transform': 'scale(' + scaleValue + ')',
		'-webkit-transform': 'scale(' + scaleValue + ')',
		'-ms-transform': 'scale(' + scaleValue + ')',
		'transform': 'scale(' + scaleValue + ')',
		'height': `calc(100vh/${scaleValue})`,
		// 'zoom': scaleValue
	});
}



function handleScroll(unitid, index) {
	// if (index > unitQuantity) {
	// 	$('#unit-quantity').val(3 * parseInt((index + 3) / 3));
	// 	changeUnitQuantity();
	// }
	if (baseArray[index].constant > rangeUpperBound) {
		$('#range-upper-bound').val(baseArray[index].constant);
		changeBound();
	} else if (baseArray[index].constant < rangeLowerBound) {
		$('#range-lower-bound').val(baseArray[index].constant);
		changeBound();
	}

	$('#ai-chan-content').html(`<img id="ai-chan-ill" src="${illustrationPath + baseArray[index].illustration}" />` +
		$('#ai-chan-content').text());
	scrollToElement(unitid);
}

async function initializeVHZEK() {
	try {
		const response = await fetch('sample/constantChart.csv');
		if (!response.ok) {
			throw new Error(`HTTP error! status: ${response.status}`);
		}
		let file = await response.text();
		let temp = file.trim();
		let rows = temp.replaceAll('\r\n', "\n").split("\n");
		// console.log(rows)
		let single;
		tempArray = [];
		for (i = 1; i < rows.length; i++) {
			single = {};
			const row = rows[i].split(',');
			single = {
				idx: findIndex(row[1], songlist),
				songId: row[1],
				constant: [row[2], row[3], row[4], row[5], row[6]]
			}
			tempArray.push(single);
		}
		idx_constant = tempArray;
		idx_constant.push({
			idx: 283,
			songId: 'lasteternity',
			constant: ['', '', '', '9.7', '']
		});
		idx_constant.push({
			idx: 421,
			songId: 'dualdoom',
			constant: ['3.5', '6.5', '8.9', '', '10.3']
		})
		idx_constant = idx_constant.sort(function(a, b) {
			return resultSort(a, b, 'idx', -1);
		})
		
		idx_constant.shift();
		console.log('idx_constant:')
		console.log(idx_constant)
		// return idx_constant;
	} catch (error) {
		console.error('There was a problem loading the CSV file:', error);
	}
}

function generateCard(array) {
	//
	generateUnits(array, unitQuantity)
}

function generateTable(array) {
	//
	displayB30(array);
}

// async function readConstantChart() {
async function getConstantSheet() {
	try {
		const csvText = await (await fetch('sample/constantChart.csv')).text();
		const rows = csvText.trim().replaceAll('\r\n', '\n').split('\n');
		const tempArray = rows.flatMap(row => {
			const columns = row.split(',');
			return columns.slice(2, 7).map((value, index) => {
				if (value) return [columns[1], difficultyList[index], parseFloat(value)];
			}).filter(Boolean);
		});
		const songIdMap = await (await fetch('json/simplified_songlist.json')).json();
		const idx2songId = Object.fromEntries(
			Object.entries(songIdMap).map(([index, songId]) => [songId, parseInt(index, 10)])
		);
		tempArray.sort((a, b) => idx2songId[a[0]] - idx2songId[b[0]]);
		tempArray.sort((a, b) => b[2] - a[2]);
		testDataArray = tempArray;

		const constant = tempArray.map(([songId, difficulty, constantValue], index) =>
			new PlayResult('', songId, difficulty, -1, 0, 0, 0, 0, constantValue, 0, 99999 - index)
		);
		constant.sort(stringSort).sort((a, b) => resultSort(a, b, 'constant'));
		constConstant = constant;
		initializeDataArray();

	} catch (error) {
		console.error('Error fetching files:', error);
	}
}
