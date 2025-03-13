let diffIllPath = 'json/Different_Illustration.json';
let diffSongNamePath = 'json/Different_SongName.json';
let aiChanPath = 'json/AiChan.json'
// let difficultyPair = {'Past': 'PST', 'Present': 'PRS', 'Future': 'FTR', 'Beyond': 'BYD', 'Eternal': 'ETR'};
let aiChanList = [];
let difList = ['Past', 'Present', 'Future', 'Beyond', 'Eternal'];

/**
 * 每条成绩存为一个对象，所有对象存在 currentArray 数组中
 * 属性按顺序为 曲名，曲目id，难度，分数，perfect总数，大p数，far数，lost数，定数，单曲潜力值依次录入
 * 缺失的属性设置为0或-1
 * 
 */
class PlayResult {
	/**
	 * @param {String} songName	曲名
	 * @param {String} songId	曲目ID
	 * @param {String} difficulty	难度
	 * @param {String} score	分数
	 * @param {Number} perfect	pure数
	 * @param {Number} criticalPerfect	大P数
	 * @param {Number} far	far数
	 * @param {Number} lost	lost数
	 * @param {Number} constant	定数
	 * @param {Number} playRating	单曲潜力值
	 * @param {Number} innerIndex	内部排序索引
	 * --下为可选参数--
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
		this.criticalRate = this.criticalPerfect / this.perfect;
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
	initSqlJs(config).then(function (sqlModule) {
		SQL = sqlModule;
		console.log("sql.js initialized");
	});

}
/**
 * 数据库查询初始化
 */
async function initializeQuery() {
	try {
		const response = await fetch(queryFilePath);
		if (!response.ok) {
			throw new Error(`HTTP error! status: ${response.status}`);
		}
		query = await response.text();
		console.log("Query data loaded");
		$('#load-db').text("✔数据库数据文件已加载").css("color", "green");
		$('#load-db').hide("slow").css("height", "0");
	} catch (error) {
		console.error("Error fetching data:", error);
		$('#load-db').text("XX数据库数据文件加载失败！请尝试刷新页面").css("color", "red");
	}
}
/**
 * AI-Chan文案初始化
 */
function initializeAiChan() {
	fetch(aiChanPath)
		.then(response => response.json())
		.then(data => {
			aiChanList = data.ai_chan;
		})
		.catch(error => console.error('Error:', error));
}

/**
 * 随机返回一条AI-chan文案
 * @return {String} 一条随机的AI-Chan文案，带有需要被替换的标识
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
 * @return {String} 不经舍入的 decimal 位小数
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
 * @param array 传入游玩结果对象数组
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
 * 获取曲绘映射，应在页面加载初始阶段进行
 */
async function getImageMapping() {
	try {
		if (!diffIllMapping) {
			const response = await fetch(diffIllPath);
			diffIllMapping = await response.json();
		}
		$('#load-il').text("✔曲绘差分文件已加载").css("color", "green");
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

/**
 * 获取曲名映射，应在页面加载初始阶段进行
 */
async function getTitleMapping() {
	try {
		if (!diffSongNameMapping) {
			const response = await fetch(diffSongNamePath);
			diffSongNameMapping = await response.json();
		}
		$('#load-sn').text("✔曲名差分文件已加载").css("color", "green");
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
 * 保存完整的成绩对象数组到浏览器缓存
 * @param {Array<PlayResult>} currentArray 
 */
function saveLocalStorage(array) {
	let strArray = JSON.stringify(array);
	localStorage.setItem("savedArrayData", strArray);
}

/**
 * 从浏览器缓存读取保存的成绩对象数组
 * @return {Array<PlayResult>} currentArray
 */
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
 * 读取VHZek制作的万能查分表xls / xlsx文件并生成成绩对象数组
 */
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

// 由分数、定数、物量、准度(大P数)计算失分数

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
function displayWindow(windowId) {
	if ($('#' + windowId).is(":hidden")) {
		// console.log("window'shidden");
		$('#' + windowId).css("display", "block");
		setTimeout(function () {
			$('#' + windowId).css("opacity", 1);
		}, 100);
	} else {
		// console.log("window'sshown");
		// $('#filter-window').fadeOut(800);
		$('#' + windowId).css("opacity", 0);
		setTimeout(function () {
			$('#' + windowId).css("display", "none");
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
/**
 * 重置修改成绩弹窗内容
 */
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
	displayWindow('modify-window');
	reloadContent(currentArray);
}
/**
 * 放弃成绩的修改
 */
function abortModifyResult() {
	resetModifyWindowContent();
	displayWindow('modify-window');
}
/**
 * 删除单条成绩
 */
function deleteResult() {
	if (confirm("确定要删除这条记录吗？")) {
		idx = $('#modify-current-index').val();
		currentArray.splice(idx, 1);
		saveLocalStorage();
		displayWindow('modify-window');
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
 * @param {Number} viewMode 默认为1，不加前缀，加't-'前缀表示目标单元为表格中的一行
 */
function aiChanRoll(array = currentArray, viewMode = 1) {
	let randomIndex = Math.floor(Math.random() * array.length);
	let randomSong = array[randomIndex];
	console.log(randomSong);
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
	// console.log(unitid,randomSong.innerIndex);
	handleScroll(unitid, randomSong.innerIndex);
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
 * 更换选择的头像并保存到localStorage
 * @param {string} index 头像对应的文件序号
 */
function changeAvatar(index) {
	console.log(index);
	$('#icon img').attr('src', avatarPath + index + '_icon.webp');
	$('#avatar-display img').attr('src', avatarPath + index + '_icon.webp');
	localStorage.setItem('avatar', index);
	displayWindow('avatar-select');
	$('#use-custom-avatar').prop('checked', false);
}
/**
 * 更换选择的段位框并保存到localStorage
 * @param {string} index 段位框对应的文件序号
 */
function changeCourseDanFrame(index) {
	$('#user-course-dan').attr('src', userCourseDanPath + index + '.png');

	$('#id-course-dan').attr('src', userCourseDanPath + index + '.png');
	$('#user-course-dan-display').css('background-image', 'url("' + userCourseDanPath + index + '.png")');
	$('#user-course-dan-display').text(index + 'dan');
	displayWindow('user-course-dan-select');
	localStorage.setItem('courseDanFrame', index);
}
/**
 * 更换选择的背景图并保存到localStorage
 * @param {string} index 背景图对应的文件序号
 */
function changeBackgroundImage(index) {
	$('#background').css('background-image', `url(${backgoundImagePath}${index}.webp)`);
	$('#background-display').attr('src', backgoundImagePath + index + '.webp');
	displayWindow('background-select');
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
 * 切换为隐藏uid *** *** ***
 */
function hideUID() {
	uidFlag = !uidFlag;
	if (uidFlag == true) {
		$('#user-id span').text(formatUserID(localStorage.userId));
	} else {
		$('#user-id span').text('✱✱✱ ✱✱✱ ✱✱✱');

	}
}

/**
 * 依照当前访问的网址（github/gitee）初始化页面下方网址和二维码的显示
 */
async function initializeQRCode() {
	let url = window.location.href.substring(0, window.location.href.lastIndexOf('/'));
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
		1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23
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
 * @return {Object} sts 包含按照分数段分类的字典对象，使用时基本只用到length
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
 * @param {Number} criticalPerfect 大P数
 */
function getLoseScore(constant, score, amount, criticalPerfect) {
	return (constant * 38 - constant * 100 * (Math.max(0, Math.min((criticalPerfect / amount - 0.9), 0.095)) + 28.5 * (
		Math.max(0, Math.min((score / 10000000 - 0.99), 0.01)))));
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

async function initializeSonglist() {
	/**
	 * 新版更新了index，直接用吧
	 */
	try {
		const response = await fetch('json/simplified_songlist.json');
		if (!response.ok) {
			throw new Error(`HTTP error! status: ${response.status}`);
		}
		songlist = await response.json();
		return songlist;
	} catch (error) {
		console.error('There was a problem loading the JSON file:', error);
		alert("出现了预料之外的错误！万能查分表可能无法使用！")
		return NULL;
	}

}
/**
 * 根据分数和物量信息返回等效far和大p数
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