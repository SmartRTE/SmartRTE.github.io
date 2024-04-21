let diffIllPath = 'json/Different_Illustration.json';
let diffSongNamePath = 'json/Different_SongName.json';
let aiChanPath = 'json/AiChan.json'

let aiChanList = [];
/**
 * 每条成绩存为一个对象，所有对象存在 currentArray 数组中
 * 属性按顺序为 曲名，曲目id，难度，分数，perfect总数，大p数，far数，lost数，定数，单曲潜力值
 * 
 */
class PlayResult {
	/**
	 * @param {String} songName
	 * @param {String} songId
	 * @param {String} difficulty
	 * @param {String} score
	 * @param {Number} perfect	
	 * @param {Number} criticalPerfect
	 * @param {Number} far
	 * @param {Number} lost
	 * @param {Number} constant
	 * @param {Number} playRating
	 * @param {Number} innerIndex
	 */
	constructor(songName, songId, difficulty, score,
		perfect, criticalPerfect, far, lost,
		constant, playRating, innerIndex) {
			// console.log(arguments)
		// console.log(difficulty)
		if (diffIllMapping) {
			const diffSongId = diffIllMapping[songId];
			if (diffSongId && diffSongId[difficulty]) {
				console.log(diffSongId[difficulty])
				// this.illustration = (illusPath + songId + diffSongId[difficulty] + ".jpg");
				this.illustration = (songId + diffSongId[difficulty] + ".jpg");
			} else {
				// this.illustration = (illusPath + songId + ".jpg");
				this.illustration = (songId + ".jpg");
			}
		} else {
			// this.illustration = (illusPath + "sayonarahatsukoi.jpg");
			this.illustration = ("sayonarahatsukoi.jpg");
		}
		if (diffSongNameMapping) {
			const diffSongId = diffSongNameMapping[songId];
			if (diffSongId && diffSongId[difficulty]) {
				this.songName = diffSongId[difficulty];
				console.log(songId)
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
		this.score = score?score:0;
		this.perfect = perfect?perfect:0;
		this.criticalPerfect = criticalPerfect?criticalPerfect:0;
		this.normalPerfect = this.perfect - this.criticalPerfect;
		this.criticalRate = this.criticalPerfect / this.perfect;
		this.far = far?far:0;
		this.lost = lost?lost:0;
		this.constant = constant;
		this.playRating = playRating?playRating:calculateSingleRating(score,constant,5);
		
		if (score >= 10000000) {
			// console.log(toFloor(this.criticalPerfect / this.perfect))
			this.percentage = 100 + parseFloat(toFloor(this.criticalPerfect / this.perfect, 2));
		} else {
			this.percentage = 100 * parseFloat(toFloor(this.playRating / (this.constant + 2), 4));
		}
		
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
	initSqlJs(config).then(function(sqlModule) {
		SQL = sqlModule;
		console.log("sql.js initialized");
	});

}
/**
 * 数据库查询初始化
 */
function initializeQuery() {
	$.ajax({
		url: queryFilePath,
		dataType: "text",
		success: function(resp) {
			query = resp;
			// console.log("Query data:", query);
			console.log("Query data loaded");
			$('#load-db').text("√数据库数据文件已加载").css("color", "green");
			$('#load-db').hide("slow").css("height", "0");
		},
		error: function(xhr, status, error) {
			console.error("Error fetching data:", error);
			$('#load-db').text("XX数据库数据文件加载失败！请尝试刷新页面").css("color", "red");
		}
	});
}

function initializeAiChan() {
	fetch(aiChanPath)
		.then(response => response.json())
		.then(data => {
			aiChanList = data.ai_chan;
		})
		.catch(error => console.error('Error:', error));
}

function getRandomAiChan() {
	let randomIndex = Math.floor(Math.random() * aiChanList.length);
	let randomItem = aiChanList[randomIndex];
	return aiChanList[randomIndex];
}


/**
 * 不舍入的小数截断
 * @param number 原数
 * @param decimal 截断位数
 * @return {string} 不经舍入的 decimal 位小数
 */
function toFloor(number, decimal) {
	// console.log(number);
	let multiplier = Math.pow(10, decimal);
	return (Math.floor(number * multiplier) / multiplier).toFixed(decimal);
}

// /**
//  * 不舍入的小数截断
//  * @param number 原数
//  * @param {number} decimal 截断位数
//  * @return {string} 不经舍入的 decimal 位小数的字符串
//  */
// function toFloor(number, decimal) {
//     let rs = number.toString();
//     let hasDecimal = rs.indexOf(".") !== -1;

//     if (!hasDecimal) {
// 		console.log("donthavedecimal")
//         rs += '.';
//     }else{
// 		console.log("havedecimal");
// 	}

//     // 获取或计算小数点后的位数
//     let m = rs.length - rs.indexOf(".") - 1;

//     // 当小数位不足时，用零填充
//     while (m < (decimal - 1)) {
//         rs += '0';
//         m++;
//     }

//     return rs;
// }
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
 * @param array 传入游玩结果对象数组
 * @returns {Number} maxptt、best30、recent10理论值组成的数组
 */
function calculateMax(array) {
	let sum = 0;
	let rbm = []; //best max recent
	for (i = 0; i < (array.length > 30 ? 30 : array.length); i++) {
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

// 获取曲绘映射
async function getImageMapping() {
	try {
		if (!diffIllMapping) {
			const response = await fetch(diffIllPath);
			diffIllMapping = await response.json();
		}
		$('#load-il').text("√曲绘差分文件已加载").css("color", "green");
		$('#load-il').hide("slow").css("height", "0");
		console.log("image mapping loaded");
		return diffIllMapping;
	} catch (error) {
		// 处理加载错误，使用默认图片路径
		console.error('Error loading image mapping:', error);
		$('#load-il').text("XX曲绘差分文件加载失败！请尝试刷新页面").css("color", "red");
		return null;
	}
}

// 获取曲名映射
async function getTitleMapping() {
	try {
		if (!diffSongNameMapping) {
			const response = await fetch(diffSongNamePath);
			diffSongNameMapping = await response.json();
		}
		$('#load-sn').text("√曲名差分文件已加载").css("color", "green");
		$('#load-sn').hide("slow").css("height", "0");
		console.log("songname mapping loaded");
		return diffSongNameMapping;
	} catch (error) {
		// 处理加载错误，使用默认曲名
		console.error('Error loading title mapping:', error);
		$('#load-sn').text("XX曲名差分文件加载失败！请尝试刷新页面").css("color", "red");
		return null;
	}
}
/**
 * 保存到浏览器缓存
 */
function saveLocalStorage(currentArray) {
	let strArray = JSON.stringify(currentArray);
	localStorage.setItem("savedArrayData", strArray);
}

function readLocalStorage() {
	if (localStorage.getItem("savedArrayData")) {
		let savedArray = JSON.parse(localStorage.getItem("savedArrayData"));
		if (savedArray) {
			return savedArray;
		} else {
			return null;
		}
	}
}


/**
 * 滚动到指定id元素
 */
function scrollToElement(id) {
	window.scrollTo({
		top: $("#" + id).offset().top - 100,
		behavior: 'smooth'
	});
	setTimeout(function() {
		$('#' + id).addClass('stressed-unit');
	}, 300)
	setTimeout(function() {
		$('#' + id).removeClass('stressed-unit');
	}, 2000)
}



/**
 * 显示/隐藏筛选选项窗口
 */
function displayWindow(windowId) {
	if ($('#' + windowId).is(":hidden")) {
		// console.log("window'shidden")
		$('#' + windowId).css("display", "block");
		setTimeout(function() {
			$('#' + windowId).css("opacity", 1);
		}, 100);
	} else {
		// console.log("window'sshown")
		// $('#filter-window').fadeOut(800);
		$('#' + windowId).css("opacity", 0);
		setTimeout(function() {
			$('#' + windowId).css("display", "none");
		}, 500);
	}
}


function modifyPlayResult(idx, array = currentArray) {
	console.table(array[idx]);
	displayWindow('modify-window');
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

function resetModifyWindowContent() {
	displayWindow('modify-window');
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
	displayWindow('modify-window');
	reloadContent(currentArray);
}

function abortModifyResult() {
	resetModifyWindowContent();
	displayWindow('modify-window');
}

function deleteResult() {
	if (confirm("确定要删除这条记录吗？")) {
		idx = $('#modify-current-index').val();
		currentArray.splice(idx, 1);
		saveLocalStorage();
		displayWindow('modify-window');
		reloadContent(currentArray);
	}

}

function getSongRanking(score, far, lost) {
	if (far != 0 && lost == 0) {
		return "FR";
	}
	const ranges = [8599999, 8899999, 9199999, 9499999, 9799999, 9899999, 10000000,
		10002222
	];
	const rankLabels = ["D", "C", "B", "A", "AA", "EX", "EX+", "PM"];
	for (let i = 0; i < ranges.length; i++) {
		if (score < ranges[i]) {
			return (rankLabels[i]);
		}
	}
}


function aiChanRoll(array = currentArray, viewMode = 1) {
	let randomIndex = Math.floor(Math.random() * array.length);
	let randomSong = array[randomIndex];
	console.log(randomSong)
	let randomAiChan = getRandomAiChan();
	$('#ai-chan-content').text(randomAiChan.replace('songName', randomSong.songName)
		.replace('difficulty', randomSong.difficulty)
		.replace('constant', parseFloat(randomSong.constant).toFixed(1))
		.replace('你打了score分', randomSong.score >= 0 ? `你打了${randomSong.score}分` : '你没打过这个谱'));
	let mode = '';
	if (viewMode == 0) {
		mode = 't-'
	}
	let unitid = mode + randomSong.songId + '-' + randomSong.difficulty;
	// console.log(unitid,randomSong.innerIndex)
	handleScroll(unitid, randomSong.innerIndex);
}

function deleteLocalStorage() {
	if (confirm("确定要清空本地缓存吗？该操作不可撤销！")) {
		localStorage.clear();
		location.reload();
	}
}