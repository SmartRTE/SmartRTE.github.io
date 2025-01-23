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
let unitQuantity = 39;
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
let queryFilePath = "json/query.sql"; //sql查询代码文件路径
let diffSongNameMapping = null; //差分曲名映射
let diffIllMapping = null; //差分曲绘映射

$(document).ready(function() {
	//首次加载保证transition生效
	displayWindow('modify-window');
	displayWindow('setting-window');
	displayWindow('ptt-p30');
	displayWindow('ai-chan-dialog');
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
	//初始化曲名映射
	diffSongNameMapping = getTitleMapping();
	//初始化曲绘映射
	diffIllMapping = getImageMapping();
	
	songlist = initializeSonglist();
	//初始化二维码
	initializeQRCode();
	//初始化数据列表
	initializeDataArray();
	//初始化AI-chan推荐
	switchLoseScore(loseScoreFlag);
	initializeAiChan();
	
	initializeVHZEK();
	filteredArray = currentArray;
	$(window).on('resize', function() {
		resizeWidth(1);
	});
	resizeWidth(1);
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
	if (localStorage.saved_csv_data) {
		runConvert(localStorage.saved_csv_data);
		localStorage.removeItem('saved_csv_data');
	} else if (localStorage.savedArrayData) {
		currentArray = getResultArray();
		// console.log(currentArray);
		unitQuantity = localStorage.unitQuantity;
		unitQuantity = 39;
		generateUnits(currentArray, unitQuantity);
	} else {
		let tempCSV = '';
		fetch(defaultCSVPath)
			.then(response => response.text())
			.then(data => {
				// console.log(data);
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
			displayWindow('avatar-select');
			localStorage.useCustomAvatar = false;
		} else {
			if (localStorage.customAvatar) {
				localStorage.useCustomAvatar = true;
				$('#icon img').attr('src', localStorage.customAvatar);
				$('#temp-avatar').attr('src', localStorage.customAvatar);
			} else {
				alert('还没有上传过自定义头像！\n点击右边可以手动上传~');
				$('#use-custom-avatar').prop("checked", false);
			}
		}
	});

	$('#use-custom-background').on('change', function() {
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
				$('#custom-background img').attr('src', localStorage.customBackground);
			} else {
				alert('还没有上传过自定义背景！\n点击右边可以手动上传~');
				$('#use-custom-background').prop("checked", false);
			}
		}
	});
	
	$('#switch-losescore').on('change', function(){
		switchLoseScore($('#switch-losescore').val());
		localStorage.loseScoreFlag = $('#switch-losescore').val();
		loseScoreFlag = $('#switch-losescore').val();
	})
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
    $('#ptt-max span').text(toFloor(parseFloat(rbm[2]), 4));
    $('#ptt-b30 span').text(toFloor(parseFloat(rbm[1]), 4));
    $('#ptt-r10 span').text(toFloor(parseFloat(rbm[0]), 4));
    $('#potential-input').val(localStorage.potential);
    $('#potential-value').text(toFloor(parseFloat(localStorage.potential), 2));
	if(localStorage.loseScoreFlag == undefined){
		localStorage.loseScoreFlag = 0;
	}
	if(localStorage.customAvatar){
		$('#custom-avatar img').attr('src', localStorage.customAvatar);
	}
	if(localStorage.customBackground){
		$('#custom-background img').attr('src', localStorage.customBackground);
	}
	$('#switch-losescore').val(localStorage.loseScoreFlag);
	loseScoreFlag = localStorage.loseScoreFlag;
    changePotential(localStorage.potential);
    changePotentialFrame(localStorage.potentialFrame);
    changeAvatar(localStorage.avatar);
    changeCourseDanFrame(localStorage.courseDanFrame);
    changeBackgroundImage(localStorage.backgroundImage);
	
    // 处理自定义头像和背景
    if (localStorage.useCustomAvatar == 'true') {
        $('#use-custom-avatar').prop("checked", true);
        $('#icon img').attr('src', localStorage.customAvatar || '');
    }
    if (localStorage.useCustomBackground == 'true') {
        $('#use-custom-background').prop("checked", true);
        $('#background').css('background-image', `url(${localStorage.customBackground || ''})`);
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
			let fileName = selectedFile.name;
			console.log("selectedFileName:" + fileName);
			if (fileName.endsWith(".csv")) {
				let reader = new FileReader();
				reader.onload = function(e) {
					csvContent = reader.result;
					console.log("CSV Content:" + "success");
					// console.log("CSV Content:" + csvContent);
					runConvert(csvContent);
				};
				reader.readAsText(selectedFile);
			} else if(fileName.endsWith(".xls") || fileName.endsWith(".xlsx")){
				console.log("VHZek");
				readVHZek(selectedFile);
			} else {
				runQuery(selectedFile);
				console.log("Not a .csv file");
			}
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
	switchLoseScore();
	// displayB30(filteredArray);
	switchP30(0);
}

/**
 * 将csv格式的分数表转换成为成绩对象数组
 * @param csv 待转换的csv文件，必须是旧版或新版页面能生成和读取的对应格式
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
	filteredArray = tempArray;
	currentArray = filteredArray;
	saveLocalStorage(filteredArray);
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
	rbm = calculateMax(array);
	localStorage.rbm = rbm;
	// generateUnits(array, unitQuantity);
	$('#ptt-max span').text(toFloor(parseFloat(rbm[2]), 4));
	$('#ptt-b30 span').text(toFloor(parseFloat(rbm[1]), 4));
	$('#ptt-r10 span').text(toFloor(parseFloat(rbm[0]) > 0 ? parseFloat(rbm[0]) : 0, 4));
}

function displayAccuratePtt() {
	alert(`精确数值（大概）：\n不推分可获得的最高PTT:${rbm[2]}\nBest30平均值：${rbm[1]}\n逆推得到的Recent10平均值：${rbm[0]}`);
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
		if (index == 30) {
			appendOverflowSpliter();
		}
		appendSongUnit(ary[index], index + 1);
	}
	$('body').css('height', getCaptureHeight());
	$('#background').css('height', getCaptureHeight());
	$('#background-image').css('height', getCaptureHeight());
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
	
	si.append($('<div>').addClass('item-losescore').addClass('item-hidden').text('Lose Score : ' + currentRow.loseScore.toFixed(4)));

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
function changeUnitQuantity() {
	let q = $('#unit-quantity').val();
	unitQuantity = q;
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

/**
 * 切换Pure30/Sex30/Best30时，将符合条件的对象压入filteredArray中
 * @param {Array<PlayResult>} 要筛选的分数对象数组
 * @param {number} type 0 = PM 1 = PM-1
 */
function filterP30S30(array, type) {
	filteredArray = [];
	if (type == 0) {
		array.forEach(function(currentRow, index) {
			if (currentRow.score >= 10000000) {
				filteredArray.push(currentRow);
			}
		});
	} else {
		currentArray.forEach(function(currentRow, index) {
			if ((currentRow.far == 1 && currentRow.lost == 0) ||
				(currentRow.far == 0 && currentRow.lost == 1)) {
				filteredArray.push(currentRow);
			}
		});
	}
	return filteredArray;

}
/**
 * 在best30/pure30/sex30之间循环切换，为了复用这段垃圾代码，使用一个变量add控制
 * @param {number} add add=1时正常循环，add=0时只使用对应段落的代码重新生成页面内容，不进行切换
 */
function switchP30(add = 1) {
	console.log(`currentP30Flag=${p30Flag},add=${add}`);
	console.log(currentArray.length);
	if (p30Flag + add - 1 == 0) { //b->p
		$('#spliter-text-best30').attr('src', 'img/perfect30.png').css('left', '30.15rem');
		let f = filterP30S30(currentArray, 0);
		generateUnits(f, unitQuantity);
		$('#ptt-p30').html("P30 : " + '<span>' + toFloor(calculateMax(f)[1], 4) + '</span>');
		$('#switch-p30').text('看看S30');
	} else if (p30Flag + add - 1 == 1) { //p->s
		$('#spliter-text-best30').attr('src', 'img/sex30.png').css('left', '30.15rem');
		let f = filterP30S30(currentArray, 1);
		generateUnits(filteredArray, unitQuantity);
		$('#ptt-p30').html("S30 : " + '<span>' + toFloor(calculateMax(f)[1], 4) + '</span>');
		$('#switch-p30').text('回到B30');
	} else if (p30Flag + add - 1 == 2 || (add == 0 && p30Flag == 0)) { //s->b
		$('#spliter-text-best30').attr('src', 'img/best30.png').css('left', '31.25rem');
		displayB30(currentArray);
		filteredArray = currentArray;
		generateUnits(currentArray, unitQuantity);
		$('#switch-p30').text('看看P30');
	}

	if (add != 0 && (p30Flag == 0 || p30Flag == 2)) {
		displayWindow('ptt-max');
		displayWindow('ptt-b30');
		displayWindow('ptt-r10');
		displayWindow('ptt-p30');
	}
	p30Flag = (p30Flag + add) % 3;
	
	switchLoseScore();
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

async function initializeVHZEK() {
	try {
		const response = await fetch('sample/constantChart.csv');
		if (!response.ok) {
			throw new Error(`HTTP error! status: ${response.status}`);
		}
		let file = await response.text();
		let temp = file.trim();
		// console.log(temp)
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
		// console.log(tempArray)
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
	if(!selection){
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