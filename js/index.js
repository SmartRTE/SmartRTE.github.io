let db; //以上两条为sql.js相关
let SQL; //以上两条为sql.js相关
let csvContent; //读取和生成csv文件时暂存在csvContent中
let isEdit; //是否为修改

let illustrationPath = 'Processed_Illustration/';
let queryFilePath = "json/query.sql"; //sql查询代码文件路径
let stickerPath = "img/stickers/"; //表情包路径
let query = '';
let columns = ['SongName', 'SongId', 'Difficulty',
	'Score', 'Perfect', 'Perfect+',
	'Far', 'Lost', 'Constant',
	'PlayRating'
]; //表头
let dif = ['Past', 'Present', 'Future', 'Beyond', 'Eternal'];
let shortenDif = {'Past':'pst', 'Present':'prs', 'Future':'ftr', 'Beyond':'byd', 'Eternal':'etr'};
let csv = '';

let currentArray = []; //当前的全部成绩对象数组
let tempArray = []; //转化csv时使用的中间数组
let filteredArray = []; //启用筛选时被筛选出的成绩对象数组
let rbm = []; //recent10 best30 maxptt
let idData = {};
// let tosongid = [];
// let tosongname = [];
let songNameAndDifficulty = {};
let songlist = {}; //idx - songId 键值对
let idx_constant = [];

// let illusPath = "IllustrationMin/"; //曲绘文件路径
let sqlWasmPath = "sql-wasm.wasm"; //sql.wasm路径

let diffSongNameMapping = null; //差分曲名映射
let diffIllMapping = null; //差分曲绘映射
// let title_id_mapping = null; //弃用 VHZek佬的万能查分表相关，用来以曲名对应songId
// let id_title_mapping = null; //弃用 VHZek佬的万能查分表相关，用来以songId和difficulty对应曲名
let currentVersionMaxPotential = 13.12; //现版本最高理论潜力值
let viewMode = 0; //成绩显示状态，0=table 1=card
// let currentB30;//当前best30

let rangeUpperBound = 12.0; //筛选中的最高定数边界
let rangeLowerBound = 1.0; //筛选中的最低定数边界

let fakeCounter = 0; //嘻嘻

$(document).ready(function() {
	displayWindow('filter-window');
	displayWindow('modify-window');
	//初始化sqlite.js
	initializeSqliteJs();
	//读取查询语句文件
	initializeQuery();
	//添加文件上传监听
	initializeUploadListener();
	//初始化随机曲目推荐
	initializeAiChan();
	//初始化曲名映射
	diffSongNameMapping = getTitleMapping();
	//初始化曲绘映射
	diffIllMapping = getImageMapping();
	//初始化ptt监听
	songlist = initializeSonglist();
	initializeVHZEK();
	// initializePotentialListener();
	//初始化定数边界变更监听
	initailizeConstantRangeListener();
	//初始化排序方式监听
	initializeSortListener();
	//初始化查询结果选择监听
	initailizeSearchResultListener();

	initializeSticker();
	$('#sticker').click(function() {
		fakeCounter++;
		if (fakeCounter == 100) {
			window.open('fakeResult.html');
			fakeCounter = 0;
		}
	})
	
	// switchItemLoseScore();
});



/**
 * 查询结果点击跳转监听,用全局变量viewMode控制跳转位置（表格/卡片）
 */
function initailizeSearchResultListener() {
	$('#search-result').change(function() {
		let songId = $('#search-result').val();
		let difficulty = $('#search-difficulty').val();
		let mode = '';
		if (viewMode == 0) {
			mode = 't-'
		}
		let unit = mode + songId + '-' + difficulty
		// console.log(unit)
		scrollToElement(unit);

	})
}
/**
 * 初始化排序方式监听
 */
function initializeSortListener() {
	$('#sort-mode').change(function() {
		// console.log($('#sort-mode').val() + '  ' + $('#sort-order').val())
		filterResult(filteredArray, $('#sort-mode').val(), $('#sort-order').val());
	})
	$('#sort-order').change(function() {
		// console.log($('#sort-mode').val() + '  ' + $('#sort-order').val())
		filterResult(filteredArray, $('#sort-mode').val(), $('#sort-order').val());
	})
}
/**
 * 初始化定数范围监听
 */
function initailizeConstantRangeListener() {
	$('#range-lower-bound').on('input', function() {
		let num = $('#range-lower-bound').val();
		if (parseInt(num) > 12.0) {
			$('#range-lower-bound').val("12.0");
		} else if (parseInt(num) < 1.0) {
			$('#range-lower-bound').val("1.0");
		}
		console.log("0-2:" + parseFloat(num.slice(0, 2)));
		if (parseFloat(num.slice(0, 2)) < 10 && num.length > 3) {
			$('#range-lower-bound').val(num.slice(0, 3));
		} else if (parseFloat(num.slice(0, 2)) >= 10 && num.length > 4) {
			$('#range-lower-bound').val(num.slice(0, 4));

		}
		console.log('range-lower-bound:' + $('#range-lower-bound').val())
		filterByConstant();
	});
	$('#range-upper-bound').on('input', function() {
		let num = $('#range-upper-bound').val();
		if (parseInt(num) > 12.0) {
			$('#range-upper-bound').val("12.0");
		} else if (parseInt(num) < 1.0) {
			$('#range-upper-bound').val("1.0");
		}
		console.log("0-2:" + parseFloat(num.slice(0, 2)));
		if (parseFloat(num.slice(0, 2)) < 10 && num.length > 3) {
			$('#range-upper-bound').val(num.slice(0, 3));
		} else if (parseFloat(num.slice(0, 2)) >= 10 && num.length > 4) {
			$('#range-upper-bound').val(num.slice(0, 4));
		}
		filterByConstant();

	});
}
/**
 * 根据选定的定数范围筛选显示的曲目成绩
 */
function filterByConstant() {
	rangeUpperBound = parseFloat($('#range-upper-bound').val());
	rangeLowerBound = parseFloat($('#range-lower-bound').val());
	if (rangeUpperBound < rangeLowerBound) {
		[rangeUpperBound, rangeLowerBound] = [rangeLowerBound, rangeUpperBound];
	}
	console.log(rangeUpperBound, rangeLowerBound);
	filteredArray = [];
	currentArray.forEach(function(currentRow, index) {
		if (currentRow.constant >= rangeLowerBound && currentRow.constant <= rangeUpperBound) {
			filteredArray.push(currentRow)
		}
	});
	// console.log(filteredArray)
	generateCard(filteredArray);
	generateTable(filteredArray);

}

/**
 * 触发上传
 */
function inputFile() {
	$('#file-input').click();
}
/**
 * 初始化监听上传文件
 */
function initializeUploadListener() {
	//监听上传文件事件
	$('#file-input').change(function() {
		console.log("file-input active");
		let selectedFile = this.files[0];
		if (selectedFile) {
			let fileName = selectedFile.name;
			console.log("selectedFileName:" + fileName);
			if (fileName.endsWith(".csv")) {
				let reader = new FileReader();
				reader.onload = function(e) {
					csvContent = reader.result;
					console.log("CSV Content:" + "success");
					runConvert(csvContent);
				};
				reader.readAsText(selectedFile);
			} else if (fileName.endsWith(".xls") || fileName.endsWith(".xlsx")) {
				console.log("VHZek");
				readVHZek(selectedFile);
			} else {
				runQuery(selectedFile);
				console.log("Not a .csv file");
			}
		}
		$('#file-input').val('');
	});
	$("#uploadExcel").on("change", function(e) {
		let file = e.target.files[0];
		if (!file) return;
		let reader = new FileReader();
		let finalOutputScore = [];
		reader.onload = function(e) {
			let data = e.target.result;
			let workbook = XLSX.read(data, {
				type: 'binary'
			});
			let sheetName = workbook.SheetNames[0]; // 获取第一个工作表的名称
			let sheet = workbook.Sheets[sheetName];
			let columns = ['A', 'F']
			let idDate = {};
			
			columns.forEach(function(column){
				let colArray = [];
				let col = column + 2;
				while (sheet[col]) {
					colArray.push(sheet[col].v);
					col = column + (colArray.length + 1).toString();
				}
				idData[column] = colArray;
			});
			idData['A'].shift(); //index
			idData['F'].shift(); //difficulty
			tempArray = currentArray;
			idData['A'].forEach(function(cell, index){
				if(cell == 127){
					//Particle Arts T T
				}
				let i = findInArray(currentArray, idx_constant[cell].songId, difList[idData['F'][index]]);
				finalOutputScore.push(i == -1 ? null : currentArray[i].score);
			})
			// 填充score
			let rowIndex = 2;
			let maxRow = Object.keys(sheet).length;
			while (rowIndex <= maxRow) {
				let cellRef = XLSX.utils.encode_cell({
					r: rowIndex - 1,
					c: 7
				});
				sheet[cellRef] = {
					v: finalOutputScore[rowIndex - 2]
				};
				rowIndex++;
			}
			// 准备下载
			XLSX.writeFile(workbook, "万能查分表xlsx格式（已填充）.xlsx", {
				compression: true
			});

		};
		reader.readAsArrayBuffer(file);

	});
}
/**
 * 运行查询
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
	let result = db.exec(query);
	if (result.length > 0) {
		saveQueryResult(result[0]);
	} else {
		alert("上传的数据库是空的！你是不是忘记把存档同步到本地辣？");
	}
}


/**
 * 通过sql查询结果生成表格/卡片
 */
function saveQueryResult(result) {
	// //保存表头
	// columns = result.columns;
	let temp = result.values;
	//置空
	currentArray = [];
	temp.forEach((singleResult, index) => {
		let single = new PlayResult(singleResult[0], singleResult[1], singleResult[2], singleResult[3],
			singleResult[4], singleResult[5], singleResult[6], singleResult[7], singleResult[8],
			singleResult[9], index);
		currentArray.push(single);
	});
	filteredArray = currentArray;
	displayB30(currentArray);
	generateCard(currentArray);
	generateTable(currentArray);
	saveLocalStorage(currentArray);
}
/**
 * 通过上传的csv文件生成表格/卡片
 */
function runConvert(csv) {
	file = csv.trim();
	const rows = file.split('\n');
	tempArray = [];
	for (i = 1; i < rows.length; i++) {
		const row = rows[i].split(',');
		if (row[3] != '') {
			single = new PlayResult(row[0], row[1], row[2],
				parseFloat(row[3]), parseFloat(row[4]),
				parseFloat(row[5]), parseFloat(row[6]),
				parseFloat(row[7]), parseFloat(row[8]),
				parseFloat(row[9]), i - 1);
			tempArray.push(single);
		}
	}
	console.log(tempArray)
	tempArray.sort(function(a, b) {
		return resultSort(a, b, 'playRating', 1)
	})
	reloadContent(tempArray)
	filteredArray = tempArray;
	currentArray = filteredArray;

	saveLocalStorage(currentArray);
	displayB30(currentArray);
	generateCard(currentArray);
	generateTable(currentArray);
}
/**
 * 读取本地缓存并生成
 */

function readSavedScore() {
	currentArray = readLocalStorage();
	if (currentArray == null) {
		alert("缓存内似乎没有数据哦，可能是第一次使用或者被清除了！")
	} else {
		filteredArray = currentArray;
		displayB30(currentArray);
		generateCard(currentArray);
		generateTable(currentArray);
	}
}

/**
 * 使用分数对象数组计算并显示maxptt，b30和r10
 */
function displayB30(array) {
	$('#select-file').text("重新选择文件")
	$('#notice').slideUp("slow");
	$('#save-csv-btn-container').show("slow");
	$('#result-table').show("slow");
	$('#result-quantity').text(array.length);
	rbm = calculateMax(array);
	localStorage.setItem('rbm', rbm);
	$('#disp-b30 span').text(rbm[1].toFixed(4));
	$('#disp-max span').text(rbm[2].toFixed(4));
	$("#disp-ptt").val(toFloor(rbm[2], 2));
	$('#disp-r10 span').text(rbm[0].toFixed(4));
}
/**
 * 转换为表格行
 */
function convertToTable(currentRow, index) {
	let difColor = shortenDif[currentRow.difficulty];
	let $trElem = $('<tr id="t-' + currentRow.songId + "-" + currentRow.difficulty + '" class="' + difColor + '">')
		.addClass('single-tr-' + currentRow.difficulty.toLowerCase());
	$trElem.append($('<td>').text(index));
	$trElem.append($('<td>').append($('<img onclick="modifyPlayResult(' + currentRow.innerIndex + ')">').addClass(
		"table-ill").attr('src', illustrationPath + currentRow.illustration)));
	$trElem.append($('<td>').addClass('t-song-name').text(currentRow.songName));
	$trElem.append($('<td>').addClass('t-score').text(currentRow.score));
	$trElem.append($('<td>').addClass('t-perfect').text(currentRow.perfect));
	$trElem.append($('<td>').addClass('t-critical-perfect').text(currentRow.criticalPerfect));
	$trElem.append($('<td>').addClass('t-normal-perfect').text(currentRow.normalPerfect));
	$trElem.append($('<td>').addClass('t-far').text(currentRow.far));
	$trElem.append($('<td>').addClass('t-lost').text(currentRow.lost));
	$trElem.append($('<td>').addClass('t-constant').text(currentRow.constant.toFixed(1)));
	let linearGradient = "";
	if (currentRow.percentage == 100 || currentRow.loseScore == 0) {
		linearGradient = "linear-gradient(90deg, #55aaff 0%, #55aaff 100%)";
	} else {
		linearGradient = "linear-gradient(90deg, #42c800 " + currentRow.percentage + "%, #c80064 " +
			currentRow.percentage + "%)";
	}
	let rt = 0;
	if ((String(currentRow.playRating).length - String(currentRow.playRating).indexOf('.') - 1) < 4) {
		rt = currentRow.playRating.toFixed(4);
	} else {
		rt = toFloor(currentRow.playRating, 4)
	}
	$trElem.append($('<td>').addClass('t-play-rating').css("background", linearGradient)
		.text(rt + "(" + currentRow.loseScore.toFixed(2) * (-1) + ")"));
	if (currentRow.normalPerfect == 0 && currentRow.far == 0 && currentRow.lost == 0 && currentRow.perfect != 0) {
		$trElem.addClass("theoretical");
	}
	return $trElem;
}
/**
 * 转换为卡片单元
 */
function convertToCard(currentRow, index) {
	let $cardElem = $('<div id="' + currentRow.songId + "-" + currentRow.difficulty + '">').addClass('single-card ' +
		currentRow
		.difficulty.toLowerCase());

	$cardElem.append($('<div>').addClass('card-rank').text('#' + index));

	let $illContainer = $('<div onclick="modifyPlayResult(' + currentRow.innerIndex + ')">').addClass(
		'card-ill-container');
	$illContainer.append($('<img>').addClass('card-ill').attr('src', illustrationPath + currentRow.illustration));
	$cardElem.append($illContainer);
	$cardElem.append($('<div>').addClass('song-name').text(currentRow.songName));
	$cardElem.append($('<div>').addClass('song-score').text(currentRow.score));
	let rt = 0;
	if ((String(currentRow.playRating).length - String(currentRow.playRating).indexOf('.') - 1) < 4) {
		rt = currentRow.playRating.toFixed(4);
	} else {
		rt = toFloor(currentRow.playRating, 4)
	}
	$cardElem.append($('<div>').addClass('song-rating').text(currentRow.constant.toFixed(1) + "→" + rt));
	let linearGradient;
	if ((currentRow.far != null && currentRow.lost != null) && (currentRow.far == 0 && currentRow.lost == 0)) {
		linearGradient = "linear-gradient(90deg, #55aaff " + (currentRow.percentage - 100) * 100 + "%, #55ff00 " +
			(currentRow.percentage - 100) * 100 + "%)";
	} else {
		linearGradient = "linear-gradient(90deg, #55ff00 " + currentRow.percentage +
			"%, rgba(255, 0, 127, 1.0) " +
			currentRow.percentage + "%)";
	}

	$cardElem.append($('<div>').addClass('song-percentage')
		.css("background", linearGradient)
		.text("(" + toFloor(currentRow.percentage, 2) + "%)"));
	if (currentRow.normalPerfect == 0 && currentRow.far == 0 && currentRow.lost == 0 && currentRow.perfect != 0) {
		$cardElem.addClass("theoretical");
	}
	return $cardElem;
}

/**
 * 生成卡片单元
 */
function generateCard(array, number = 40) {
	console.log("generateCard");
	$("#result-card").html('');
	for (i = 0; i < array.length; i++) {
		$("#result-card").append(convertToCard(array[i], i + 1));
	}
}
/**
 * 生成表格行
 */
function generateTable(array, number = 40) {
	console.log("generateTable");
	$('#result tbody').html('');
	noItemFlag = false;
	for (i = 0; i < array.length; i++) {
		if (array[i].perfect == 0 && array[i].far == 0 && array[i].lost == 0) {
			noItemFlag = true;
		}
		$('#result tbody').append(convertToTable(array[i], i + 1));
	}
	if (noItemFlag == true) {
		$(".t-perfect").addClass("hidden");
		$(".t-normal-perfect").addClass("hidden");
		$(".t-critical-perfect").addClass("hidden");
		$(".t-far").addClass("hidden");
		$(".t-lost").addClass("hidden");
	} else {
		$(".t-perfect").removeClass("hidden");
		$(".t-normal-perfect").removeClass("hidden");
		$(".t-critical-perfect").removeClass("hidden");
		$(".t-far").removeClass("hidden");
		$(".t-lost").removeClass("hidden");
	}
	
}
/**
 * 计算recent10
 * ptt为输入的潜力值
 */
function calculateR10() {
	const ptt = $('#disp-ptt').val();
	$('#disp-r10 a').text("逆推得到recent10约为");
	console.log(ptt);
	console.table(rbm)
	let r10 = toFloor((ptt * 40 - rbm[1] * 30) / 10, 4);
	$('#disp-r10 span').text(r10 >= 0 ? r10 : "🤨");
}

/**
 * 用于在卡片模式和表格模式之间切换
 * 本质是两个div的显示/隐藏切换
 */
function switchView() {
	//0=card 1=table
	if (viewMode == 1) {
		viewMode = 0;
		$('#result-card').slideUp("slow");
		$('#result-table').show("slow");
		$('#switch-view').text("显示为卡片");
	} else {
		viewMode = 1;
		$('#result-table').slideUp("slow");
		$('#result-card').show("slow");
		$('#switch-view').text("显示为表格");
	}
}
/**
 * 下载分数表csv文件
 * 由于字符集限制只好用utf-8和全英文
 */
function saveTableCSV() {
	let temp = currentArray;
	let csv = [columns.join(",")];
	temp.forEach(function(row) {
		let r = [row.songName, row.songId, row.difficulty, row.score, row.perfect, row.criticalPerfect, row.far,
			row.lost, row.constant, row.playRating
		].join(",");
		csv.push(r);
	});

	const blob = new Blob([csv.join("\n")], {
		type: 'text/csv;charset=utf-8'
	});

	const link = document.createElement('a');
	link.href = URL.createObjectURL(blob);
	let currentDateTime = new Date().toLocaleString();
	link.download = 'B30_' + currentDateTime + '.csv';

	document.body.appendChild(link);
	link.click();

	document.body.removeChild(link);
}


/**
 * 用于筛选出符合筛选条件的成绩存入一个临时数组中，以这个数组显示卡片和表格
 */
function filterResult(array, attr, order) {
	tempArray = array;
	tempArray.sort(function(a, b) {
		return resultSort(a, b, attr, order);
	})
	generateCard(tempArray);
	generateTable(tempArray);
}

function reloadContent(array) {
	array.sort(function(a, b) {
		return resultSort(a, b, 'playRating', 1);
	})
	array.forEach(function(currentRow, index) {
		currentRow.innerIndex = index;
	})
	saveLocalStorage(array);
	displayB30(array);
	filterByConstant();
}

function saveChange(array) {
	currentArray = array;
	saveLocalStorage(currentArray);
}

function searchSong() {
	let str = $('#search-song').val().toLowerCase();
	let difficulty = $('#search-difficulty').val();
	let optionList = generateOptionList(str, difficulty);
	console.table(optionList);
	let select = $('#search-result');
	select.html('');
	if (optionList.length == 0) {
		select.html('<option selected="selected">无结果</option>')
	} else {
		select.append($('<option selected="selected">').addClass('search-option').val("0").text("共有" + optionList
			.length + "条结果"));
		optionList.forEach(function(song, index) {
			select.append($("<option>")
				.addClass("search-result-option")
				.val(song.songId)
				.text(song.songName)
				.css({
					background: "url(\'../IllustrationMin/ii.jpg\')"
				}));

		})
	}
}

function handleScroll(unitid, index) {
	// console.log(unitid)
	scrollToElement(unitid);
}

function generateOptionList(str, difficulty) {
	let searchResult = [];
	let pair = {};
	filteredArray.forEach(function(currentRow, index) {
		if (currentRow.difficulty === difficulty) {
			// console.log("currentRow:" + currentRow.songId + "-" + currentRow.difficulty);
			if (currentRow.songName.toLowerCase().indexOf(str) !== -1) {
				pair = {
					songName: currentRow.songName,
					songId: currentRow.songId
				}
				searchResult.push(pair);
			}
		}
	})
	return searchResult;
}

function showStatistics(array = currentArray) {
	sts = getStatistics();
	let list = ['PM', 'FR', 'EX+', 'EX', 'AA', 'A', 'B', 'C', 'D'];
	let s = [];
	let str = '';
	let c = 0;
	console.log(sts)
	list.forEach(function(l) {
		let n = sts[l] ? sts[l].length : 0;
		c += n;
		str += `${l}: ${n}\n`
		console.log(n)
		s.push(n);
	})
	str = '在所有' + c + '条结果中，有: \n' + str;
	console.log(str)
	alert(str)
}



function saveVHZEK() {
	msg = "！注意！\n" +
		"请你自备一份'Arcaea 万能查分表.xls'文档，（可以不为空但数据会被替换）在稍后弹出的文件选择界面选择它\n" +
		"手动复制分数列然后粘贴到原有的工作表中，不用重新排序\n" +
		"如果没有，请到首页下载一份。不用担心，目前的数据都已经被缓存\n" +
		"新的表格xslx文件会丢失**全部的**单元格样式，推荐只是把这个功能当成快速填入数据的工具，'\n\n'" +
		"如果你不知道我在说什么，请关闭这个对话框\n\n" +
		"感谢表格作者V.H.Zek";
	if (confirm(msg)) {
		let temp = currentArray;
		console.log(temp)
		let csv = [columns.join(",")];
		temp.forEach(function(row) {
			let r = [row.songName, row.songId, row.difficulty, row.score, row.perfect, row.criticalPerfect, row
				.far,
				row.lost, row.constant, row.playRating
			].join(",");
			csv.push(r);
		});
		csv = csv.join("\n");

		$("#uploadExcel").click();
	} else {
		//T T
	}
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
		
		$('#load-sl').text("✔曲目列表文件已加载").css("color", "green");
		$('#load-sl').hide("slow").css("height", "0");
	} catch (error) {
		console.error('There was a problem loading the CSV file:', error);
	}
}

function initializeSticker() {
	let randomIndex = Math.floor(Math.random() * 12);
	$('#sticker').css('background-image', 'url(' + stickerPath + randomIndex + '.webp');
	$('#sticker').css('background-size', 'contain');

}