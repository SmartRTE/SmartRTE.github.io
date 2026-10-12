let db; //以上两条为sql.js相关
let SQL; //以上两条为sql.js相关

let filteredArray = [];
let currentArray = [];
let rbm = [];
let avatarList = [];
let idx_constant = [];
let finalOutputScore = [];
let songlist = {}; //idx - songId 键值对
let idData = {};
// 各模式的默认显示单元数
const DEFAULT_UNIT_QUANTITY = { b: 80, p: 80, s: 80 };
// 各模式当前使用的显示单元数（手动调节后按模式分别记住）
let unitQuantityByMode = Object.assign({}, DEFAULT_UNIT_QUANTITY);
let unitQuantity = DEFAULT_UNIT_QUANTITY.b; // 当前模式（p30Flag 对应模式）的显示单元数
let uidFlag = true;
let loseScoreFlag = 0;
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
let diffSongNameMapping = null; //差分曲名映射
let diffIllMapping = null; //差分曲绘映射
// B50 预览的双指缩放/平移状态（仅影响页面预览，#mainCapture 的布局不变，
// 生成图片前会复位，因此不影响 html2canvas）
let b50Pinch = { z: 1, tx: 0, ty: 0 };
let b50PinchGesture = null;
let b50PanStart = null;
const B50_PINCH_MAX = 6;

$(document).ready(async function() {
	// #ptt-p30 在 b50gen.html 里默认带 hidden，切换到 P50/S50 时由 switchP30() 显示
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
	//初始化曲目数据（songlist + constants.json 派生并生成SQL）
	await initializeSongData();
	//初始化上传文件监听
	initializeUploadListener();
	//初始化二维码
	initializeQRCode();
	//初始化数据列表
	initializeDataArray();
	//初始化AI-chan推荐
	switchLoseScore(loseScoreFlag);
	initializeAiChan();
	
	filteredArray = currentArray;
	$(window).on('resize', function() {
		resetB50PinchZoom(true);
	});
	resizeWidth(1);
	initB50PinchZoom();
	// $('#main-capture').css('height', );
	// switchLoseScore();
	// 页面加载显示时间
	showTime();
	// 每秒更新时间显示
	setInterval(showTime, 1000);
});

/**
 * 初始化数据列表
 * 当缓存内没有savedArrayData时，拉取默认default.csv生成数据
 * 当缓存内有旧的saved_csv_data时，启动转换并删除旧数据
 * 当缓存内有savedArrayData时，直接生成
 */
function initializeDataArray() {
	// 版本不匹配时清除旧缓存，避免结构变更后崩溃
	checkLocalStorageVersion();
	if (localStorage.saved_csv_data) {
		runConvert(localStorage.saved_csv_data);
		localStorage.removeItem('saved_csv_data');
	} else if (localStorage.savedArrayData) {
		currentArray = getResultArray();
		// console.log(currentArray);
		unitQuantity = unitQuantityByMode[modeKeyOf(p30Flag)];
		$('#unit-quantity').val(unitQuantity);
		generateUnits(currentArray, unitQuantity);
		displayB30(currentArray);
	} else {
		let tempCSV = '';
		fetch(defaultCSVPath)
			.then(response => response.text())
			.then(data => {
				// console.log(data);
				runConvert(data, false);
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
	$('#user-name-input').on('input', function() {
		var val = $('#user-name-input').val();
		$('#user-name').text(val);
		localStorage.setItem('userName', val);
	});
	$('#user-id-input').on('input', function() {
		var val = $('#user-id-input').val();
		$('#user-id span').text(formatUserID(val));
		localStorage.setItem('userId', val);
	});
	$('#potential-input').on('input', function() {
		var val = $('#potential-input').val();
		$('#potential-value').text(val);
		changePotential(parseFloat(val));
	});

	$('#use-custom-avatar').on('change', function() {
		let isChecked = $('#use-custom-avatar').is(':checked');
		console.log(isChecked);
		if (!isChecked) {
			changeAvatar(localStorage.avatar);
			localStorage.useCustomAvatar = false;
			$('#avatar-display').addClass('is-selected');
			$('#custom-avatar').removeClass('is-selected');
		} else {
			if (localStorage.customAvatar) {
				localStorage.useCustomAvatar = true;
				$('#icon img').attr('src', localStorage.customAvatar);
				$('#temp-avatar').attr('src', localStorage.customAvatar);
				$('#avatar-display').removeClass('is-selected');
				$('#custom-avatar').addClass('is-selected');
			} else {
				alert('还没有上传过自定义头像！\n请先点击“手动上传”上传一张。');
				$('#use-custom-avatar').prop("checked", false);
			}
		}
	});

	$('#use-custom-background').on('change', function() {
		let isChecked = $('#use-custom-background').is(':checked');
		console.log(isChecked);
		if (!isChecked) {
			changeBackgroundImage(localStorage.backgroundImage);
			localStorage.useCustomBackground = false;
			$('#background-display').addClass('is-selected');
			$('#custom-background').removeClass('is-selected');
		} else {
			if (localStorage.customBackground) {
				$('#background').css('background-image', `url(${localStorage.customBackground})`);
				localStorage.useCustomBackground = true;
				$('#custom-background img').attr('src', localStorage.customBackground);
				$('#background-display').removeClass('is-selected');
				$('#custom-background').addClass('is-selected');
			} else {
				alert('还没有上传过自定义背景！\n请先点击“手动上传”上传一张。');
				$('#use-custom-background').prop("checked", false);
			}
		}
	});
	
	$('#switch-losescore').on('change', function(){
		switchLoseScore($('#switch-losescore').val());
		localStorage.loseScoreFlag = $('#switch-losescore').val();
		loseScoreFlag = $('#switch-losescore').val();
	})

	$(document).on('click', '#avatar-list .avatar-option', function() {
		localStorage.useCustomAvatar = false;
		$('#use-custom-avatar').prop('checked', false);
		$('#avatar-display').addClass('is-selected');
		$('#custom-avatar').removeClass('is-selected');
	});

	$(document).on('click', '#background-list .background-option', function() {
		localStorage.useCustomBackground = false;
		$('#use-custom-background').prop('checked', false);
		$('#background-display').addClass('is-selected');
		$('#custom-background').removeClass('is-selected');
	});
}

/**
 * 页面加载时将缓存数据内的设置部分替换到页面内
 */
function initializeSettings() {
    // 设置默认值
    const defaultValues = {
        userName: 'Hikari',
        userId: '100000001',
        backgroundImage: '8',
        courseDanFrame: "1",
        potential: 6.16,
        rbm: [6.16, 6.16, 6.16],
        potentialFrame: 1,
        avatar: '34u'
    };

    // 从localStorage获取设置并设置默认值
    for (const key in defaultValues) {
        if (localStorage[`saved_${key}`]) {
            localStorage[key] = localStorage[`saved_${key}`];
            localStorage.removeItem(`saved_${key}`);
        }
        if (!localStorage[key]) {
            localStorage[key] = defaultValues[key];
        }
    }

    // 更新UI
    $('#user-name-input').val(localStorage.userName);
    $('#user-name').text(localStorage.userName);
    $('#user-id-input').val(localStorage.userId);
    $('#user-id span').text(formatUserID(localStorage.userId));
    rbm = localStorage.rbm.split(',');
    $('#ptt-max span').text(toFloor(parseFloat(rbm[2]), 5));
    $('#ptt-b30 span').text(toFloor(parseFloat(rbm[1]), 5));
    $('#ptt-r10 span').text(toFloor(parseFloat(rbm[0]), 5));
    // 个人潜力值直接取最高潜力值（三位小数，截断），不再手动输入
    $('#potential-value').text(toFloor(parseFloat(rbm[2]), 3));
	if(localStorage.loseScoreFlag == undefined){
		localStorage.loseScoreFlag = 0;
	}
	if(localStorage.customAvatar){
		$('#custom-avatar img').attr('src', localStorage.customAvatar);
	}
	if(localStorage.customBackground){
		$('#custom-background img').attr('src', localStorage.customBackground);
	}
	$('#avatar-display').toggleClass('is-selected', localStorage.useCustomAvatar != 'true');
	$('#custom-avatar').toggleClass('is-selected', localStorage.useCustomAvatar == 'true');
	$('#background-display').toggleClass('is-selected', localStorage.useCustomBackground != 'true');
	$('#custom-background').toggleClass('is-selected', localStorage.useCustomBackground == 'true');
	$('#switch-losescore').val(localStorage.loseScoreFlag);
	loseScoreFlag = localStorage.loseScoreFlag;
    var useCustomAvatar = localStorage.useCustomAvatar == 'true';
    var useCustomBackground = localStorage.useCustomBackground == 'true';
    changePotentialFrame(getPotentialFrame(rbm[2]));
    changeAvatar(localStorage.avatar);
    changeCourseDanFrame(localStorage.courseDanFrame);
    changeBackgroundImage(localStorage.backgroundImage);

    // 处理自定义头像和背景
    if (useCustomAvatar) {
        $('#use-custom-avatar').prop("checked", true);
        $('#icon img').attr('src', localStorage.customAvatar || '');
        localStorage.useCustomAvatar = true;
        $('#avatar-display').removeClass('is-selected');
        $('#custom-avatar').addClass('is-selected');
    } else {
        $('#use-custom-avatar').prop("checked", false);
        localStorage.useCustomAvatar = false;
        $('#avatar-display').addClass('is-selected');
        $('#custom-avatar').removeClass('is-selected');
    }
    if (useCustomBackground) {
        $('#use-custom-background').prop("checked", true);
        $('#background').css('background-image', `url(${localStorage.customBackground || ''})`);
        localStorage.useCustomBackground = true;
        $('#background-display').removeClass('is-selected');
        $('#custom-background').addClass('is-selected');
    } else {
        $('#use-custom-background').prop("checked", false);
        localStorage.useCustomBackground = false;
        $('#background-display').addClass('is-selected');
        $('#custom-background').removeClass('is-selected');
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
	$('#file-input').change(function() {
		console.log("file-input active");
		let selectedFile = this.files[0];
		// console.log(selectedFile);
		if (selectedFile) {
			// 统一上传入口：st3 / CSV / score.json / 带缓存的图片
			handleScoreFileUpload(selectedFile);
		}
		$('#file-input').val('');
	});
	//监听自定义头像上传事件
	$('#custom-avatar-input').on('change', function(event) {
		const file = event.target.files[0];
		const reader = new FileReader();
		if (file.size > 1048576) {
			console.log("over 1MB");
			alert("图片大小超过1MB，请尝试换一张或压缩质量后再试");
			return;
		} else {
			reader.readAsDataURL(file);
			reader.onload = function() {
				const base64Image = reader.result;
				$('#temp-avatar').attr('src', base64Image);
				// displayCachedImage(base64Image);
				$('#temp-avatar').ready(function() {
					clipDiamond();
					// console.log(base64Image);

				});
			};
		}
	});
	//监听自定义背景图上传事件
	$('#custom-background-input').on('change', function(event) {
		const file = event.target.files[0];
		const reader = new FileReader();
		if (file.size > 3145728) {
			console.log("over 3MB");
			alert("图片大小超过3MB，请尝试换一张或压缩质量后再试");
			return;
		} else {

			reader.readAsDataURL(file);
			reader.onload = function() {
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
	// 确保曲目数据（含生成的SQL）已就绪
	if (!query) {
		await initializeSongData();
	}
	let buffer = await file.arrayBuffer();
	let uInt8Array = new Uint8Array(buffer);
	db = new SQL.Database(uInt8Array);

	if (!db) {
		console.error('Database not opened.');
		alert("st3文件选取有误，请重试！");
		return;
	}
	// 提示有成绩但未登记定数的曲目
	logMissingConstants(db);
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
	switchLoseScore();
	// displayB30(filteredArray);
	switchP30(0);
}

/**
 * 将csv格式的分数表转换成为成绩对象数组
 * @param csv 待转换的csv文件，必须是旧版或新版页面能生成和读取的对应格式
 */
function runConvert(csv, persist = true) {
	const rows = csvToRows(csv);
	tempArray = [];
	for (i = 1; i < rows.length; i++) {
		const row = rows[i];
		// 分数为空的行视为“未填写”，跳过
		const scoreText = (row[3] === undefined || row[3] === null) ? '' : String(row[3]).trim();
		if (scoreText === '') continue;
		single = new PlayResult(row[0], row[1], row[2],
			parseFloat(row[3]), parseFloat(row[4]),
			parseFloat(row[5]), parseFloat(row[6]),
			parseFloat(row[7]), parseFloat(row[8]),
			parseFloat(row[9]), i - 1);
		tempArray.push(single);
	}
	filteredArray = tempArray;
	currentArray = filteredArray;
	// 默认示例数据仅用于预览，不写入共享缓存（否则会污染成绩页/其他页面的数据）
	if (persist !== false) saveLocalStorage(filteredArray);
	switchLoseScore();
	// displayB30(filteredArray);
	// generateCard(filteredArray);
	// generateTable(filteredArray);
	// console.log(currentArray);
	// displayB30(filteredArray);
	switchP30(0);
}

/**
 * 计算显示B30数据
 * @param array 成绩对象数组
 */
function displayB30(array) {
	rbm = calculateMax50(array);
	localStorage.rbm = rbm;
	// generateUnits(array, unitQuantity);
	$('#ptt-max span').text(toFloor(parseFloat(rbm[2]), 5));
	$('#ptt-b30 span').text(toFloor(parseFloat(rbm[1]), 5));
	$('#ptt-r10 span').text(toFloor(parseFloat(rbm[0]) > 0 ? parseFloat(rbm[0]) : 0, 5));
	// 个人潜力值：直接取最高潜力值（三位小数，截断）
	$('#potential-value').text(toFloor(parseFloat(rbm[2]), 3));
	changePotentialFrame(getPotentialFrame(rbm[2]));
}

function displayAccuratePtt() {
	alert(`精确数值（大概）：\n不推分可获得的最高PTT:${rbm[2]}\nBest50平均值：${rbm[1]}\nBest10平均值：${rbm[0]}`);
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
		39; //固定margin
	return captureHeight;
}

/**
 * 生成游玩结果单元，生成结束后重新调整页面宽度和高度
 * @param {Array<PlayResult>} array 待生成单元的成绩数组
 * @param {number} unitQuantity 待生成单元的个数
 */
async function generateUnits(array, unitQuantity) {
	console.log('generateUnits called');
	let ary = array;
	$('#b30-data').html('');
	for (index = 0; index < ary.length; index++) {

		if (index == unitQuantity) {
			break;
		}
		// 第50个数据之下显示 OVERFLOW 分隔线，剩余数据继续显示（不足50个时不显示）
		if (index == 50) {
			appendOverflowSpliter();
		}
		appendSongUnit(ary[index], index + 1);
	}
	$('body').css('height', getCaptureHeight());
	$('#background').css('height', getCaptureHeight());
	$('#background-image').css('height', getCaptureHeight());
	// 数据变化后回到初始视图（不改变上面设置的真实高度，只是去掉预览手势）
	resetB50PinchZoom(false);
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
// async function loadDefaultCSV() {

// };
// async function loadLocalStorage() {

// };


/**
 * 生成单个游玩成绩单元，由各种元素拼合而成
 * @param {PlayResult} currentRow 从成绩对象数组中传入的一个成绩对象
 * @param {number} index 该条成绩在数组中的下标，用来显示排名
 * 
 */
function appendSongUnit(currentRow, index) {
	let currentUnit = $('<div class="song-result-unit" id="' +
		currentRow.songId + '-' + currentRow.difficulty +
		'">').addClass(currentRow.difficulty.toLowerCase());
	if (index <= 10) {
		currentUnit.addClass('top10');
	}
	let ill = $('<div onclick="modifyPlayResult(' + currentRow.innerIndex + ')">').addClass(
		'song-illustration-container');
	ill.append($('<img>').addClass('song-illustration').attr('src', illustrationPath + currentRow.illustration));

	let info = $('<div>').addClass('song-information');
	info.append($('<div>').addClass('song-playrating')
		.text(toFloor(currentRow.playRating, 4)));
	let z = String(currentRow.constant).split('.');
	// console.log(z);
	info.append($('<div>').addClass('song-constant')
		.text(currentRow.difficulty + z[0] + (z[1] >= 7 ? '+ ' : ' ') + '[' + currentRow.constant.toFixed(1) + ']'));
	info.append($('<div>').addClass('song-rank').text('#' + index));
	let sn = $('<div>').addClass('song-name').text(currentRow.songName);
	let ss = $('<div>').addClass('song-score').text(scoreFormat(parseInt(currentRow.score)));
	let si = $('<div>').addClass('song-items');
	si.append($('<div>').addClass('item-pure').text('P/' + currentRow.perfect + '(-' +
		Math.abs(currentRow.normalPerfect) + ')'));
	si.append($('<div>').addClass('item-far').text('F/' + currentRow.far));
	si.append($('<div>').addClass('item-lost').text('L/' + currentRow.lost));
	
	si.append($('<div>').addClass('item-losescore').addClass('item-hidden').text('Lose Score : ' + (currentRow.loseScore || 0).toFixed(4)));

	si.append($('<div>').addClass('item-acc').addClass('item-hidden').text(`P/(${-1 * (currentRow.objectAmount - currentRow.criticalPerfect)})\tEquivalent Far : ${currentRow.equivalentFar}`))
	let rk = getSongRanking(currentRow.score, currentRow.far, currentRow.lost);
	let ri = $('<img>').addClass('song-ranking-image').attr('src', songRankingPath + rk + '.png');

	if (rk == 'PM' && (currentRow.perfect != 0) && (currentRow.criticalPerfect == currentRow.perfect)) {
		currentUnit.addClass('theoretical');
	}
	currentUnit.append(ill);
	currentUnit.append(info);
	currentUnit.append(sn);
	currentUnit.append(ss);
	currentUnit.append(si);
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
 * 生成overflow的分隔线和分割文字图片
 */
function appendOverflowSpliter() {
	let overflow = $('<div id="spliter-overflow">').addClass('spliter');
	overflow.append($('<img id="spliter-image-overflow">').addClass('spliter-image').attr('src', 'img/divider.png'));
	overflow.append($('<img id="spliter-text-overflow">').attr('src', 'img/overflow.png'));
	$('#b30-data').append(overflow);
	// console.log("spliter append");
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
		img.onload = function() {
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
		const compressedDataURL = await compressImage(dataURL, 0.833);
		// const compressedDataURL = dataURL;
		// 把当前缓存嵌入图片文件尾部，之后可用“从图片恢复缓存”还原
		const embeddedBlob = await embedCacheIntoImage(compressedDataURL);
		const embeddedURL = URL.createObjectURL(embeddedBlob);
		const link = document.createElement('a');
		link.href = embeddedURL;
		link.download = 'B50_' + localStorage.userName +
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
		URL.revokeObjectURL(embeddedURL);
		resizeWidth(1);
		$('#mainCover').css({
			'display': 'none',
		});
	});
}

/**
 * 更改显示单元数（只影响当前模式，切换模式后各自的数值会被记住）
 */
function changeUnitQuantity() {
	const q = parseInt($('#unit-quantity').val(), 10);
	if (isNaN(q) || q <= 0) return;
	unitQuantity = q;
	unitQuantityByMode[modeKeyOf(p30Flag)] = q;
	generateUnits(filteredArray, unitQuantity);
}

/**
 * 修改分数内容后重新计算分数、重新加载显示单元
 * @param {Array<PlayResult>} array 要填入的分数对象数组
 * 
 */
function reloadContent(array) {
	array.sort(function(a, b) {
		return resultSort(a, b, 'playRating', 1);
	});
	array.forEach(function(currentRow, index) {
		currentRow.innerIndex = index;
	});

	saveLocalStorage(array);
	rbm = calculateMax(currentArray);
	localStorage.rbm = rbm;
	switchP30(0);
}

/**
 * 调整页面缩放
 * @param {Number} flag 1=计算缩放 0=重置缩放到100%
 */

function resizeWidth(flag = 1) {
	var scaleValue;
	if (flag == 1) {
		scaleValue = document.documentElement.clientWidth / 1700;
	} else {
		scaleValue = 1;
		// 生成图片前复位双指缩放的平移/倍率（见 saveAsImage）
		b50Pinch.z = 1;
		b50Pinch.tx = 0;
		b50Pinch.ty = 0;
	}
	// console.log("resized" + document.documentElement.clientWidth + scaleValue);
	b50SyncTouchAction();
	b50ClampPan();
	var pinchTransform = b50BuildZoomTransform(scaleValue);
	$('#mainCapture').css({
		'-moz-transform-origin': '0 0',
		'-webkit-transform-origin': '0 0',
		'-ms-transform-origin': '0 0',
		'transform-origin': '0 0',
		'-moz-transform': pinchTransform,
		'-webkit-transform': pinchTransform,
		'-ms-transform': pinchTransform,
		'transform': pinchTransform,
		'height': getCaptureHeight() * scaleValue + 'px',
		// 'zoom': scaleValue
	});
	$('body').css({
		'height': getCaptureHeight() * scaleValue + 'px',
		'width': 1700 * scaleValue + 'px'
	});
	scaleValue = document.documentElement.clientWidth / 1700;
	// 加载遮罩保持原有按屏幕宽度缩放即可，不跟随预览的双指缩放
	var coverTransform = 'scale(' + scaleValue + ')';
	$('#mainCover').css({
		'-moz-transform-origin': '0 0',
		'-webkit-transform-origin': '0 0',
		'-ms-transform-origin': '0 0',
		'transform-origin': '0 0',
		'-moz-transform': coverTransform,
		'-webkit-transform': coverTransform,
		'-ms-transform': coverTransform,
		'transform': coverTransform,
		'height': `calc(100vh/${scaleValue})`,
		// 'zoom': scaleValue
	});
}

/* ===== B50 预览：手机端双指缩放/平移（不改变捕获布局） ===== */
function b50BaseScale() {
	return document.documentElement.clientWidth / 1700;
}

function b50BuildZoomTransform(baseScale) {
	return 'translate(' + b50Pinch.tx + 'px,' + b50Pinch.ty +
		'px) scale(' + b50Pinch.z + ') scale(' + baseScale + ')';
}

function b50ClampPan() {
	if (!document.getElementById('mainCapture')) return;
	const z = Math.max(1, b50Pinch.z);
	const s = b50BaseScale();
	const contentW = z * s * 1700;
	const contentH = z * s * getCaptureHeight();
	const viewW = Math.max(document.documentElement.clientWidth || 0, 1);
	const bodyH = document.body ? document.body.offsetHeight : 0;
	const viewH = Math.max(document.documentElement.clientHeight || 0, bodyH || 0);

	let minTx = Math.min(0, viewW - contentW);
	let maxTx = Math.max(0, viewW - contentW);
	if (maxTx < minTx) maxTx = minTx;
	b50Pinch.tx = Math.max(minTx, Math.min(maxTx, b50Pinch.tx));

	let minTy = Math.min(0, viewH - contentH);
	let maxTy = Math.max(0, viewH - contentH);
	if (maxTy < minTy) maxTy = minTy;
	b50Pinch.ty = Math.max(minTy, Math.min(maxTy, b50Pinch.ty));
}

function resetB50PinchZoom(apply) {
	b50Pinch.z = 1;
	b50Pinch.tx = 0;
	b50Pinch.ty = 0;
	b50PinchGesture = null;
	b50PanStart = null;
	b50SyncTouchAction();
	if (apply !== false) resizeWidth(1);
}

function b50SyncTouchAction() {
	const cap = document.getElementById('mainCapture');
	if (!cap) return;
	// 放大时禁止浏览器原生滚动/双指页面缩放，平移完全交给自定义手势；
	// 未放大时恢复为 pan-x pan-y，保证整页仍可正常纵向滚动
	cap.style.touchAction = b50Pinch.z > 1.01 ? 'none' : '';
}

function b50DocPoint(touch) {
	return {
		x: touch.clientX + (window.scrollX || 0),
		y: touch.clientY + (window.scrollY || 0)
	};
}

function b50FingerDistance(a, b) {
	const dx = a.x - b.x;
	const dy = a.y - b.y;
	return Math.sqrt(dx * dx + dy * dy);
}

function b50BeginPinch(touches) {
	const p1 = b50DocPoint(touches[0]);
	const p2 = b50DocPoint(touches[1]);
	b50PinchGesture = {
		dist0: Math.max(b50FingerDistance(p1, p2), 1),
		z0: b50Pinch.z,
		tx0: b50Pinch.tx,
		ty0: b50Pinch.ty,
		cx: (p1.x + p2.x) / 2,
		cy: (p1.y + p2.y) / 2
	};
	b50PanStart = null;
}

function b50PinchTouchStart(e) {
	if (!e.touches) return;
	const cap = document.getElementById('mainCapture');
	if (!cap || !cap.contains(e.target)) return;
	if (e.touches.length === 2) {
		b50BeginPinch(e.touches);
		if (e.cancelable) e.preventDefault();
	} else if (e.touches.length === 1 && b50Pinch.z > 1.01) {
		b50PanStart = b50DocPoint(e.touches[0]);
	}
}

function b50PinchTouchMove(e) {
	if (!e.touches) return;
	if (b50PinchGesture && e.touches.length >= 2) {
		const p1 = b50DocPoint(e.touches[0]);
		const p2 = b50DocPoint(e.touches[1]);
		const dist = Math.max(b50FingerDistance(p1, p2), 1);
		const rawZ = b50PinchGesture.z0 * dist / b50PinchGesture.dist0;
		const z = Math.max(1, Math.min(B50_PINCH_MAX, rawZ));
		const k = z / b50PinchGesture.z0;
		b50Pinch.z = z;
		b50Pinch.tx = (1 - k) * b50PinchGesture.cx + k * b50PinchGesture.tx0;
		b50Pinch.ty = (1 - k) * b50PinchGesture.cy + k * b50PinchGesture.ty0;
		b50SyncTouchAction();
		b50ClampPan();
		resizeWidth(1);
		if (e.cancelable) e.preventDefault();
	} else if (b50PanStart && e.touches.length === 1 && b50Pinch.z > 1.01) {
		const p = b50DocPoint(e.touches[0]);
		const dx = p.x - b50PanStart.x;
		const dy = p.y - b50PanStart.y;
		if (Math.abs(dx) + Math.abs(dy) > 4 && e.cancelable) e.preventDefault();
		b50Pinch.tx += dx;
		b50Pinch.ty += dy;
		b50PanStart = p;
		b50ClampPan();
		resizeWidth(1);
	}
}

function b50PinchTouchEnd(e) {
	if (!e.touches) return;
	if (e.touches.length >= 2) {
		b50BeginPinch(e.touches);
	} else {
		b50PinchGesture = null;
		if (e.touches.length === 1 && b50Pinch.z > 1.01) {
			b50PanStart = b50DocPoint(e.touches[0]);
		} else {
			b50PanStart = null;
		}
	}
}

function initB50PinchZoom() {
	const cap = document.getElementById('mainCapture');
	if (!cap) return;
	cap.addEventListener('touchstart', b50PinchTouchStart, { passive: false });
	cap.addEventListener('touchmove', b50PinchTouchMove, { passive: false });
	cap.addEventListener('touchend', b50PinchTouchEnd, { passive: false });
	cap.addEventListener('touchcancel', b50PinchTouchEnd, { passive: false });
	// 触屏设备提示一次（元素在 #mainCapture 之外，不会进入生成的图片）
	const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
	const touchCapable = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
	if (coarse && touchCapable && !sessionStorage.getItem('b50-pinch-hint-shown')) {
		try { sessionStorage.setItem('b50-pinch-hint-shown', '1'); } catch (err) { /* 忽略 */ }
		const hint = document.createElement('div');
		hint.className = 'b50-pinch-hint';
		hint.textContent = '🔍 双指可缩放预览';
		document.body.appendChild(hint);
		setTimeout(function () {
			if (hint.parentNode) hint.parentNode.removeChild(hint);
		}, 3600);
	}
}

/**
 * 切换 P50 / S50 时，将符合条件的成绩对象压入 filteredArray 中
 * 传入数组需已按单曲潜力值降序排列，筛选后保持原顺序（即显示排名的顺序）
 * @param {Array<PlayResult>} array 要筛选的分数对象数组
 * @param {number} type 0 = P50（PM 满分）1 = S50（PM-1，只差一个物量就 PM）
 * @return {Array<PlayResult>} 筛选后的数组（同时赋值给全局 filteredArray）
 */
function filterP30S30(array, type) {
	filteredArray = [];
	if (type == 0) {
		// P50：满分 PM（10,000,000）
		array.forEach(function(currentRow, index) {
			if (currentRow.score >= 10000000) {
				filteredArray.push(currentRow);
			}
		});
	} else {
		// S50：只差一个物量就 PM 的三种情况
		//   1. 0FAR 0LOST 且 Pure 与大 P 差 1（即仅有 1 个小 PURE）
		//   2. 1FAR 0LOST
		//   3. 0FAR 1LOST
		array.forEach(function(currentRow, index) {
			const onlyOneNormalPerfect = currentRow.far == 0 && currentRow.lost == 0 &&
				(parseInt(currentRow.perfect) - parseInt(currentRow.criticalPerfect)) == 1;
			if (onlyOneNormalPerfect ||
				(currentRow.far == 1 && currentRow.lost == 0) ||
				(currentRow.far == 0 && currentRow.lost == 1)) {
				filteredArray.push(currentRow);
			}
		});
	}
	return filteredArray;
}

/**
 * 取数组前 n 条（已按单曲潜力值降序）的平均单曲潜力值，用于 P50 / S50 的数值显示
 * 不足 n 条时按实际条数平均，避免筛选结果数量不足时被低估
 * @param {Array<PlayResult>} array 已按 playRating 降序排列的成绩数组
 * @param {number} n 取前多少条
 * @return {number} 平均单曲潜力值
 */
function averageTopPlayRating(array, n) {
	const count = Math.min(array.length, n);
	if (count <= 0) return 0;
	let sum = 0;
	for (let i = 0; i < count; i++) {
		sum += parseFloat(array[i].playRating) || 0;
	}
	return sum / count;
}

/**
 * 把 p30Flag 换算成“各模式显示单元数”表的键
 * @param {number} flag 0 = B50，1 = P50，2 = S50
 * @return {string} 'b' | 'p' | 's'
 */
function modeKeyOf(flag) {
	return flag == 1 ? 'p' : (flag == 2 ? 's' : 'b');
}

/**
 * 在 B50 / P50 / S50 之间循环切换
 *   B50：全部成绩（默认）
 *   P50：只显示 PM（10,000,000）的成绩
 *   S50：只显示“只差一个物量就 PM”的成绩
 * 三种模式都按各自的显示单元数渲染（默认 B50 = 80、P50/S50 = 70，不足不补），
 * 第 51 条之前由 generateUnits 插入 OVERFLOW 分隔线。
 * @param {number} add add=1 时正常循环切换；add=0 时按当前状态重新生成页面内容，不改变状态
 */
function switchP30(add = 1) {
	// 先记住当前模式手动调过的条数，再取出目标模式的条数
	unitQuantityByMode[modeKeyOf(p30Flag)] = unitQuantity;
	const nextFlag = (p30Flag + add) % 3;
	unitQuantity = unitQuantityByMode[modeKeyOf(nextFlag)];
	$('#unit-quantity').val(unitQuantity);

	if (p30Flag + add - 1 == 0) { // b -> p
		const f = filterP30S30(currentArray, 0);
		generateUnits(f, unitQuantity);
		$('#ptt-p30').html('P50 : <span>' + toFloor(averageTopPlayRating(f, 50), 5) + '</span>');
		$('#switch-p30').text('看看S50');
		$('#spliter-text-best30').attr('src', 'img/pure50.png');
		showP50S50PttLine(true);
	} else if (p30Flag + add - 1 == 1) { // p -> s
		const f = filterP30S30(currentArray, 1);
		generateUnits(f, unitQuantity);
		$('#ptt-p30').html('S50 : <span>' + toFloor(averageTopPlayRating(f, 50), 5) + '</span>');
		$('#switch-p30').text('回到B50');
		$('#spliter-text-best30').attr('src', 'img/sex50.png');
		showP50S50PttLine(true);
	} else if (p30Flag + add - 1 == 2 || (add == 0 && p30Flag == 0)) { // s -> b
		displayB30(currentArray);
		filteredArray = currentArray;
		generateUnits(currentArray, unitQuantity);
		$('#switch-p30').text('看看P50');
		$('#spliter-text-best30').attr('src', 'img/best50.png');
		// 初始状态（p30Flag==0）时 Max/B50/B10 本来就显示、P50 行本来就隐藏，不必再切换
		if (p30Flag != 0) {
			showP50S50PttLine(false);
		}
	}
	p30Flag = nextFlag;

	switchLoseScore();
}

/**
 * 切换个人潜力值区域的显示内容：
 *   B50 模式依次显示 Max / B50 / B10（#ptt-p30 隐藏）
 *   P50 / S50 模式只显示 P50 / S50 那一行
 * 必须和 B30 页的 P30/S30 一样“替换”而不是“追加”，否则这一行会落到成绩网格下方被盖住。
 * @param {boolean} showP50S50 true = 只显示 P50/S50 行；false = 显示 Max/B50/B10
 */
function showP50S50PttLine(showP50S50) {
	displayWindow('ptt-max', !showP50S50);
	displayWindow('ptt-b30', !showP50S50);
	displayWindow('ptt-r10', !showP50S50);
	displayWindow('ptt-p30', showP50S50);
}
/**
 * 生成OverFlow的分隔线和分割文字图片
 */
function appendOverflowSpliter() {
	let overflow = $('<div id="spliter-overflow">').addClass('spliter');
	overflow.append($('<img id="spliter-image-overflow">').addClass('spliter-image').attr('src', 'img/divider.png'));
	overflow.append($('<img id="spliter-text-overflow">').attr('src', 'img/overflow.png'));
	$('#b30-data').append(overflow);
}

function handleScroll(unitid, index) {
	if (index > unitQuantity) {
		$('#unit-quantity').val(3 * parseInt((index + 3) / 3));
		changeUnitQuantity();
	}
	$('#ai-chan-content').html(`<img id="ai-chan-ill" src="${illustrationPath+filteredArray[index].illustration}" />` +
		$('#ai-chan-content').text());
	scrollToElement(unitid);
}

function generateCard(array){
	//
	generateUnits(array, unitQuantity)
}

function generateTable(array){
	//
	switchLoseScore();
	displayB30(array);
}

function switchLoseScore(selection){
	if(!selection && currentArray && currentArray.length > 0){
		if((currentArray[0].far == 0 && currentArray[0].perfect == 0 && currentArray[0].lost == 0)
		&& (currentArray[parseInt(currentArray.length / 2)].far == 0 && currentArray[parseInt(currentArray.length / 2)].perfect == 0 && currentArray[parseInt(currentArray.length / 2)].lost == 0)
		&& (currentArray[parseInt(currentArray.length / 2) - 1].far == 0 && currentArray[parseInt(currentArray.length / 2) - 1].perfect == 0 && currentArray[parseInt(currentArray.length / 2) - 1].lost == 0)){
			// vconsole.log("switchLoseScore");
			switchLoseScore(2);
		}
	}
	if(selection == 0){				//显示物量信息， 默认
		$('.item-pure').removeClass("item-hidden");
		$('.item-far').removeClass("item-hidden");
		$('.item-lost').removeClass("item-hidden");
		$('.item-losescore').addClass("item-hidden");
		$('.item-acc').addClass("item-hidden");
	}else if(selection == 1){		//显示失分数
		$('.item-pure').addClass("item-hidden");
		$('.item-far').addClass("item-hidden");
		$('.item-lost').addClass("item-hidden");
		$('.item-losescore').removeClass("item-hidden");
		$('.item-acc').addClass("item-hidden");
	}else if(selection == 2){		//显示小p数和等效far
		$('.item-pure').addClass("item-hidden");
		$('.item-far').addClass("item-hidden");
		$('.item-lost').addClass("item-hidden");
		$('.item-losescore').addClass("item-hidden");
		$('.item-acc').removeClass("item-hidden");
	}
	loseScoreFlag = selection;
	localStorage.loseScoreFlag = selection;
	console.log("loseScore"+loseScoreFlag);
	$('#switch-losescore').val(loseScoreFlag);
	console.log("loseScore"+$('#switch-losescore').val());
}

// 全曲成绩导出载入后的页面刷新钩子
function onScoresLoaded(arr) {
	switchLoseScore();
	switchP30(0);
}
/**
 * 关闭设置窗口及其子选择弹出窗
 */
function closeSettings() {
    displayWindow('setting-window', false);
    var subWindows = ['avatar-select', 'background-select', 'user-course-dan-select'];
    subWindows.forEach(function(id) {
        var $el = $('#' + id);
        if (!$el.is(':hidden')) {
            displayWindow(id, false);
        }
    });
}


/* ===== 识图工具窗：覆盖成绩后 → 重新读缓存 + 刷新显示单元 ===== */
registerOcrAppliedHandler(function () {
	const arr = readLocalStorage();
	if (!arr || !arr.length) return;
	currentArray = arr;
	// 排序 + 存回 + 重算 rbm + switchP30(0)（重新生成成绩单元并刷新潜在值显示）
	reloadContent(currentArray);
});
