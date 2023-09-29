let displayAmount = 39; //显示条目数量
let fetch_flag = 0; //是否上传了新csv
let default_csv_name = "sample/default.csv"; //初始的默认csv路径
let csv_name = null; //手动选择的新csv
let csv_data = null; //储存csv内容到内存
let flag = 0; //替换default.csv
let flag_switch_controller = 0; //控件初始值赋值block

let imageMapping = null; //图片路径映射
let titleMapping = null; //曲名映射

let statistic_full_recall = 0; //fr数
let statistic_pure_memory = 0; //pm数
let statistic_theory = 0; //理论数
let statistic_xing = 0; //1f/1l性数
let statistic_1xiao = 0; //1小p性数

let avatarFolderPath = "img/avatar/"; //头像文件路径

const R10Event = new Event("DOMContentLoaded");




//读取csv文件
async function fetchAndSaveCSV(csvName, csvdata) {
	try {
		if (fetch_flag == 0) {
			fetch_flag = 1;
			csvname = default_csv_name;
		}
		const response = await fetch(csvName);
		const data = await response.text();
		csvdata = data;
		//console.log('CSV数据已保存:', csvdata);
		resizeWidth(); //重设页面缩放
		clearStatistics();
		displayB30Data(csvdata);
		statisticBests();
		displayB30Value(csvdata, 0);
		displayPersonalPTT(csvdata);
	} catch (error) {
		console.error("Error loading CSV file:", error);
	}
}

//刷新数据显示
function refreshData(data) {
	const b30DataContainer = document.getElementById("b30Data");
	b30DataContainer.innerHTML = "";
	console.log("b30cleared");
	const pttDisplay = document.getElementById("PTTDisplay");
	pttDisplay.innerHTML = "";
	console.log("pttcleared");
	//数据统计初始化
	clearStatistics();
	console.log("statistics cleared");
	displayB30Data(data); //显示新的csv数据
	statisticBests();
	displayB30Value(data, 1);
	displayB30Value(data);
	displayPersonalPTT(data);
	console.log("refreshdata called");
	recalculateR10();
	resizeWidth(); //重设页面缩放
}

//显示统计信息
function statisticBests() {
	console.log("statisticBests called");
	const fr = document.getElementById("statistic_FR");
	const pm = document.getElementById("statistic_PM");
	const th = document.getElementById("statistic_TH");
	const xn = document.getElementById("statistic_XN");
	const ox = document.getElementById("statistic_1X");
	fr.value = "👍" + statistic_full_recall + "条" + "👍";
	pm.value = "🎉" + statistic_pure_memory + "条" + "🎉";
	th.value = "🎇" + statistic_theory + "条" + "🎇";
	xn.value = "😭" + statistic_xing + "条" + "😭";
	ox.value = "😱" + statistic_1xiao + "条" + "😱";
}

//清空统计信息
function clearStatistics() {
	statistic_full_recall = 0;
	statistic_pure_memory = 0;
	statistic_theory = 0;
	statistic_xing = 0;
	statistic_1xiao = 0;
}

//手动计算单曲ptt
function calculateSinglePTT() {
	console.log("ezptt called");
	const dif = document.getElementById("realDifficulty");
	const scr = document.getElementById("score");
	const spt = document.getElementById("singleptt");
	let s = 0;
	if (Number(scr.value) < 9800000) {
		s = Number(dif.value) + (Number(scr.value) - 9500000) / 300000;
	} else if (Number(scr.value) >= 9800000 && Number(scr.value) < 10000000) {
		s = Number(dif.value) + 1 + (Number(scr.value) - 9800000) / 200000;
	} else {
		s = Number(dif.value) + 2;
	}
	spt.value = "👉" + "[ " + ((s > 0) ? parseFloat(s).toFixed(4) : 0) + " ]";
}

//不四舍五入的小数取舍
function cutDecimal(a, pow) { //原数据，保留位数
	return (Math.floor(a * Math.pow(10, pow)) / Math.pow(10, pow)).toFixed(pow);
}

// //整数显示三位分割
// function formatScore(score, symble) {
// 	var formattedScore = String(Number(score).toLocaleString('en-US', {
// 		useGrouping: true
// 	}));
// 	if(formattedScore.length < 9){
// 		for(let i=0; i< 9-formattedScore.length; i++){
// 			formattedScore = "0"+formattedScore;
// 		}
// 	}
// 	return formattedScore.replace(/,/g, symble);
// }
function formatScore(score, symbol) {
	// 将score转换为字符串
	var scoreStr = String(score);

	// 确保id有至少9位字符, 否则补0

	if (symbol === " ") {
		while (scoreStr.length < 9) {
			scoreStr = "0" + scoreStr;
		}
		var formattedScore = scoreStr.replace(/(\d{3})(?=\d)/g, "$1" + symbol);
		return formattedScore;
	} else {
		var formattedScore = String(Number(score).toLocaleString('en-US', {
			useGrouping: true
		}));

		return formattedScore.replace(/,/g, symbol);
	}

	//添加分隔符symbol



}

//判定PTT边框
function judgeStars(personalPTT) {
	const thresholds = [0, 3.5, 7, 10, 11, 12, 12.5, 13, 15];
	const starRatings = ["0", "1", "2", "3", "4", "5", "6", "7"];
	for (let i = 0; i < thresholds.length; i++) {
		if (personalPTT < thresholds[i + 1]) {
			return starRatings[i];
		}
	}
	return starRatings[starRatings.length - 1];
}

//点击头像显示/隐藏控件
function switchController() {
	if (!flag_switch_controller) {
		const controller = document.getElementById("controller");
		const sheet = document.getElementById("sheet");
		controller.style.display = "block";
		sheet.style.display = "none";
	}
	flag_switch_controller = 1;
	if (controller.style.display === "" || controller.style.display === "none") {
		controller.style.display = "block";
		setTimeout(function () {
			controller.style.opacity = "100%";
			controller.style.left = "150px";
			controller.style.top = "300px";
		}, 350);

		console.log("display!");
	} else if (controller.style.display === "block") {
		controller.style.opacity = "0";
		controller.style.left = "0px";
		controller.style.top = "0px";
		setTimeout(function () {

			controller.style.display = "none";
		}, 350);
		console.log("hidden!");
	}
}
//判定曲目分级
function judgeLevel(singlePTTInfo) {
	let dig = Math.floor(singlePTTInfo);
	let isPlus = dig >= 9 && (singlePTTInfo - dig >= 0.7);
	return `${dig}${isPlus ? "+" : ""}`
}

//判定游玩等级
function judgeRank(score, far, lost) {
	if (Number(far) !== 0 && Number(lost) === 0) {
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

//计算显示b30
//flag指是否需要输出到网页div中，为0时直接return给潜力值显示
function displayB30Value(data, flag) {
	const lines = data.split("\n");
	const b30Data = lines.slice(1, 31);
	const b10Data = lines.slice(1, 11);

	let b30PTTTotal = 0;
	let maxPTTTotal = 0;

	b30Data.forEach(row => {
		const cells = row.split(",");
		const singlePTT = parseFloat(cells[9]);
		b30PTTTotal += singlePTT;
	});

	b10Data.forEach(row => {
		const cells = row.split(",");
		const singlePTT = parseFloat(cells[9]);
		maxPTTTotal += singlePTT;
	});

	const b30PTT = b30PTTTotal / 30;
	const maxPTT = (b30PTTTotal + maxPTTTotal) / 40;
	const r10PTT = (cutDecimal(maxPTT, 2) * 40 - b30PTT * 30) / 10;
	const disPTT = maxPTT;

	if (flag === 1) {
		return cutDecimal(r10PTT, 2);
	}
	//Max，B30，R10划分区块容器
	const maxPTTContainer = document.createElement("div");
	maxPTTContainer.id = "maxPTTContainer";
	maxPTTContainer.textContent = "Max :"
	document.getElementById("PTTDisplay").appendChild(maxPTTContainer);

	const Max = document.createElement("div");
	Max.id = "Max";
	Max.textContent = maxPTT.toFixed(4);
	document.getElementById("maxPTTContainer").appendChild(Max);

	const b30PTTContainer = document.createElement("div");
	b30PTTContainer.id = "b30PTTContainer";
	b30PTTContainer.textContent = "B30 :";
	document.getElementById("PTTDisplay").appendChild(b30PTTContainer);

	const B30 = document.createElement("div");
	B30.id = "B30";
	B30.textContent = b30PTT.toFixed(4);
	document.getElementById("b30PTTContainer").appendChild(B30);

	const r10PTTContainer = document.createElement("div");
	r10PTTContainer.id = "r10PTTContainer";
	r10PTTContainer.textContent = "R10 :";
	document.getElementById("PTTDisplay").appendChild(r10PTTContainer);

	const R10 = document.createElement("div");
	R10.id = "R10";
	R10.textContent = r10PTT.toFixed(4);
	document.getElementById("r10PTTContainer").appendChild(R10);

}
//显示头像旁2位小数的PTT（不四舍五入）
function displayPersonalPTT(data) {
	personalPTT = displayB30Value(data, 1);
	const starImage = document.getElementById("img");
	starImage.src = "img/rating/rating_" + judgeStars(personalPTT) + ".png";

	const b30PTTContainer = document.getElementById("div");
	b30PTTContainer.textContent = personalPTT;
};




// 获取曲绘映射
async function getImageMapping() {
	try {
		if (!imageMapping) {
			const response = await fetch('json/Different_Illustration.json');
			imageMapping = await response.json();
		}
		return imageMapping;
	} catch (error) {
		console.error('Error loading image mapping:', error);
		// 处理加载错误，使用默认图片路径
		return null;
	}
}

// 获取曲名映射
async function getTitleMapping() {
	try {
		if (!titleMapping) {
			const response = await fetch('json/Different_SongName.json');
			titleMapping = await response.json();
		}
		return titleMapping;
	} catch (error) {
		console.error('Error loading title mapping:', error);
		// 处理加载错误，使用默认曲名
		return null;
	}
}

//图片单元生成部分

function displayB30Data(data) {
	//console.log("displayAmount:" + displayAmount);
	const lines = data.split("\n");
	const b30Data = lines.slice(1, Number(displayAmount) + 1);
	var counter = 1;
	var spliter = 1;
	var rowCounter = 0;


	b30Data.forEach((row, index) => {
		const cells = row.split(",");
		const [songName, songId, Difficulty, score, perfect, criticalPerfect, far, lost,
			singlePTTInfo, singlePTT
		] = cells;
		rowCounter = rowCounter + 1;

		//b39 overflow分割线生成
		if (index === 30) {
			const spliterGen = document.createElement("img");
			spliterGen.src = "img/divider.png";
			spliterGen.className = "spliter";
			const overflow = document.createElement("img");
			overflow.src = "img/overflow.png";
			overflow.className = "besttext";
			overflow.id = "overflow";
			document.getElementById("b30Data").appendChild(spliterGen);
			document.getElementById("b30Data").appendChild(overflow);
		}

		const singlePTTContainer = document.createElement("div");
		singlePTTContainer.className = "singlePTT";
		singlePTTContainer.id = songId + "_" + Difficulty;

		singlePTTContainer.onclick = function () {
			// 在点击事件处理程序中获取被点击的div的id
			var id = singlePTTContainer.id;
			console.log("被点击的div的id是：" + id);
			console.log("songName=" + songName);
			console.log("songId=" + songId);
			console.log("Difficulty=" + Difficulty);
			console.log("score=" + score);
			console.log("perfect=" + perfect);
			console.log("criticalPerfect=" + criticalPerfect);
			console.log("far=" + far);
			console.log("lost=" + lost);
			console.log("singlePTTInfo=" + singlePTTInfo);
			console.log("singlePTT=" + singlePTT);
			// const url =
			// 	`clicktest.html?songName=${songName}&songId=${songId}&Difficulty=${Difficulty}&score=${score}&perfect=${perfect}&criticalPerfect=${criticalPerfect}&far=${far}&lost=${lost}&singlePTTInfo=${singlePTTInfo}&singlePTT=${singlePTT}`;
			// window.location.href = url;
		};

		// 曲绘
		const songImageDiv = document.createElement("div");
		songImageDiv.className = "songImageDiv";
		const songImage = document.createElement("img");
		songImage.className = "songImage";
		songImage.id = songId + "_" + Difficulty;
		// 获取差分曲绘
		getImageMapping().then(imageMapping => {
			if (imageMapping) {
				const diffSongId = imageMapping[songId];
				if (diffSongId && diffSongId[Difficulty]) {
					songImage.src = "Processed_Illustration/" + songId + diffSongId[Difficulty] +
						".jpg";
				} else {
					songImage.src = "Processed_Illustration/" + songId + ".jpg";
				}
			} else {
				songImage.src = "Processed_Illustration/sayonarahatsukoi.jpg";
			}

			singlePTTContainer.appendChild(songImageDiv);
			songImageDiv.appendChild(songImage);
		});

		//曲目信息
		const songInfoContainer = document.createElement("div");
		songInfoContainer.className = "songInformation";

		const realDiffInfo = document.createElement("div");
		realDiffInfo.className = "realDiffInfo";

		const sPTTDiv = document.createElement("div");
		sPTTDiv.className = "sPTT";
		const sPTTLinkValue = document.createElement("a");

		sPTTLinkValue.textContent = Difficulty + judgeLevel(singlePTTInfo) +
			" [" + parseFloat(singlePTTInfo).toFixed(1) + "]";
		sPTTDiv.appendChild(sPTTLinkValue);

		const singlePTTInfoDiv = document.createElement("div");
		singlePTTInfoDiv.className = "singlePTTInfo";
		const singlePTTInfoLink = document.createElement("a");
		singlePTTInfoLink.textContent = parseFloat(singlePTT).toFixed(4);
		singlePTTInfoDiv.appendChild(singlePTTInfoLink);

		switch (Difficulty) {
			case "Beyond": {
				singlePTTInfoDiv.style.backgroundColor = "rgba(191,41,65,1)";
				realDiffInfo.style.backgroundColor = "rgba(150,35,54,1)";
				break;
			}
			case "Future": {
				singlePTTInfoDiv.style.backgroundColor = "rgba(138,72,117,1)";
				realDiffInfo.style.backgroundColor = "rgba(110,58,96,1)";
				break;
			}
			case "Present": {
				singlePTTInfoDiv.style.backgroundColor = "rgba(0, 130, 0, 1.0)";
				realDiffInfo.style.backgroundColor = "rgba(0, 90, 0, 1.0)";
				break;
			}
			case "Past": {
				singlePTTInfoDiv.style.backgroundColor = "rgba(0, 133, 200, 1.0)";
				realDiffInfo.style.backgroundColor = "rgba(0, 66, 200, 1.0)";
				break;
			}
		}

		let newSongName;
		const songNameDiv = document.createElement("div");
		songNameDiv.className = "songName";

		const songNameHeader = document.createElement("h2");
		songNameHeader.className = "songNameHeader";

		// 获取差分曲名
		getTitleMapping().then(titleMapping => {
			if (titleMapping) {
				const diffSongId = titleMapping[songId];
				if (diffSongId && diffSongId[Difficulty]) {
					songNameHeader.textContent = diffSongId[Difficulty];
				} else {
					songNameHeader.textContent = songName;
				}
			} else {
				songNameHeader.textContent = "Sayounara Hatsukoi";
			}
			songNameDiv.appendChild(songNameHeader);
		});

		const scoreDiv = document.createElement("div");
		scoreDiv.className = "score";

		const scoreHeader = document.createElement("h3");
		scoreHeader.textContent = formatScore(score, "'");
		scoreDiv.appendChild(scoreHeader);

		const itemsDiv = document.createElement("div");
		itemsDiv.className = "items";

		const pureDiv = document.createElement("div");
		pureDiv.className = "pure";
		const pureHeader = document.createElement("h4");
		pureHeader.textContent = `P / ${perfect} (${criticalPerfect - perfect})`;
		pureDiv.appendChild(pureHeader);

		const farDiv = document.createElement("div");
		farDiv.className = "far";
		const farHeader = document.createElement("h4");
		farHeader.textContent = `F / ${far}`;
		farDiv.appendChild(farHeader);

		const lostDiv = document.createElement("div");
		lostDiv.className = "lost";
		const lostHeader = document.createElement("h4");
		lostHeader.textContent = `L / ${lost}`;
		lostDiv.appendChild(lostHeader);

		const rankDiv = document.createElement("div");
		rankDiv.className = "rank";
		const rankHeader = document.createElement("h4");
		rankHeader.textContent = "#" + counter;
		counter = counter + 1;

		const songRank = document.createElement("img");
		songRank.className = "songRank";
		songRank.src = "img/rank/" + judgeRank(score, far, lost) + ".png";


		const image = new Image();
		image.src = songImage.src;
		//理论值调整分数和sPTT颜色
		//并给对应的计数器累加
		if (Number(perfect) !== 0 && perfect === criticalPerfect && Number(far) === 0 && Number(lost) === 0) {
			scoreHeader.style.color = "rgba(0, 12, 48, 1.0)";
			scoreHeader.style.textShadow = "0px 0px 6px rgba(0, 210, 210, 1.0)";
			sPTTLinkValue.style.textShadow = "0px 0px 6px rgba(0, 210, 210, 1.0)";
			statistic_theory = statistic_theory + 1;
		}
		if (Number(perfect) !== 0 && Number(far) === 0 && Number(lost) === 0) {
			statistic_pure_memory = statistic_pure_memory + 1;
		}
		if (Number(perfect) !== 0 && Number(far) !== 0 && Number(lost) === 0) {
			statistic_full_recall = statistic_full_recall + 1;
		}
		if (Number(perfect) !== 0 && (Number(far) === 1 && Number(lost) === 0) || (Number(far) === 0 && Number(
			lost) === 1)) {
			statistic_xing = statistic_xing + 1;
		}
		if (Number(perfect) !== 0 && Number(perfect - 1) === Number(criticalPerfect) && Number(far) === 0 &&
			Number(lost) === 0) {
			statistic_1xiao = statistic_1xiao + 1;
		}
		if (index === 0) {
			rankHeader.style.backgroundColor = "rgba(255,202,1,1)";
		}
		if (index === 1) {
			rankHeader.style.backgroundColor = "rgba(175, 175, 175, 1.0)";
		}
		if (index === 2) {
			rankHeader.style.backgroundColor = "rgba(165,124,80,1)";
		}
		itemsDiv.appendChild(pureDiv);
		itemsDiv.appendChild(farDiv);
		itemsDiv.appendChild(lostDiv);
		rankDiv.appendChild(rankHeader);
		realDiffInfo.appendChild(singlePTTInfoDiv);
		realDiffInfo.appendChild(sPTTDiv);
		songInfoContainer.appendChild(realDiffInfo);
		songInfoContainer.appendChild(songNameDiv);
		songInfoContainer.appendChild(scoreDiv);
		scoreDiv.appendChild(songRank);
		songInfoContainer.appendChild(itemsDiv);
		songInfoContainer.appendChild(rankDiv);
		singlePTTContainer.appendChild(songInfoContainer);

		document.getElementById("b30Data").appendChild(singlePTTContainer);
		//console.log("fr:" + statistic_full_recall + ", pm:" + statistic_pure_memory + ", th:" +statistic_theory);
	});
}

//用html2canvas进行截图
document.addEventListener("DOMContentLoaded", function () {
	//清除刷新提示notice
	resizeWidth();
	document.getElementById("notice").textContent = "";

	async function savePageAsImage() {
		const body = document.body;
		const bg = document.getElementById("bgImg");
		const captureWidth = bg.width; //1700
		const captureHeight = bg.height; //3150
		const saveButton = document.getElementById("saveButton");
		switchController();
		saveButton.disabled = true;
		html2canvas(body, {
			useCORS: true,
			width: captureWidth,
			height: captureHeight,
			scale: 1.2,
		}).then(canvas => {
			const dataURL = canvas.toDataURL("image/png");
			const link = document.createElement("a");
			link.href = dataURL;
			let currentDateTime = new Date().toLocaleString();
			const username = document.getElementById("userName").textContent;
			link.download = "B30_" + username + "_" + currentDateTime + ".jpg";
			link.textContent = "Download Image";

			document.body.appendChild(link);
			link.click();

			document.body.removeChild(link);
			switchController();
			saveButton.disabled = false;
		});
	}
	document.getElementById("saveButton").addEventListener("click", savePageAsImage);

	//页脚显示copyright和当前时间
	var currentDateTime = new Date().toLocaleString();
	document.getElementById("copyright").textContent = "Designed by bs (lancelot Bot), Generated by RTE @ " +
		currentDateTime;

	// 页面加载时调用一次以显示初始内容
	refreshData((flag === 1) ? (csv_data) : (localStorage.saved_csv_data));
});
//重新设定背景图高度
function calculateBackgroundHeight(amount) {
	var fixed = 450;
	var height = 200.95 * (1 + Math.floor((amount - 1) / 3)) + fixed;
	if (amount <= 30) {
		return height;
	} else {
		return height + 95;
	}
}
//修改显示单元个数
function changeDisplayAmount() {
	const displayAmountInput = document.getElementById("displayAmount");
	const newDisplayAmount = parseInt(displayAmountInput.value);
	const bgImg = document.getElementById("bgImg");
	if (!isNaN(newDisplayAmount)) {
		displayAmount = newDisplayAmount;
		bgImg.style.height = String(calculateBackgroundHeight(newDisplayAmount)) + "px";
		refreshData((flag === 1) ? (csv_data) : (localStorage.saved_csv_data));
	}
};

//输入个人潜力值重新计算R10
function recalculateR10() {
	console.log("recalcR10 Called");
	const pPTTDiv = document.getElementById("personalPTT");
	const inputElement = document.getElementById("pPTTInput");
	const R10 = document.getElementById("R10");
	const starFrame = document.getElementById("starImg");
	const B30 = document.getElementById("B30");
	const newPTT = parseFloat(inputElement.value);
	localStorage.setItem('saved_ptt', newPTT);
	const calculatedR10 = calculateR10(newPTT, parseFloat(B30.textContent));
	if (isNaN(newPTT)) {
		newPTT = 0.00;
	} else if (newPTT > 13.08) {
		newPTT = "🤔";
		console.log("🤔");
	}
	pPTTDiv.textContent = newPTT.toFixed(2);
	R10.textContent = calculatedR10 <= 13.33 ? calculatedR10.toFixed(4) : "🤔";
	starFrame.src = "img/rating/rating_" + judgeStars(newPTT) + ".png";

	function calculateR10(newPTT, B30Value) {
		console.log("reR10 Called");
		const res = 4 * newPTT - 3 * B30Value;
		return res <= 0 ? 0 : res;
	}
}


//显示输入的玩家名
function refreshUsername() {
	const userNameDiv = document.getElementById("userName");
	const input1 = document.getElementById("nameInput");
	userNameDiv.textContent = input1.value;
	localStorage.setItem('saved_username', input1.value);
}
//显示输入的好友码
function refreshUID() {
	const uidDiv = document.getElementById("uid");
	const input2 = document.getElementById("uidInput");
	uidDiv.textContent = formatScore(input2.value, " ");
	localStorage.setItem('saved_uid', input2.value);
}
//上传使用的csv文件
document.addEventListener("DOMContentLoaded", function () {
	// 获取上传按钮和文件输入元素
	const uploadButton = document.getElementById("uploadButton");
	const fileInput = document.getElementById("fileInput");

	// 添加上传按钮的点击事件处理程序
	uploadButton.addEventListener("click", function () {
		// 触发文件选择对话框
		fileInput.click();
	});

	// 读取新csv文件逻辑
	fileInput.addEventListener("change", function (event) {
		const selectedFile = event.target.files[0];
		if (selectedFile) {
			const reader = new FileReader();
			reader.onload = function (event) {
				flag = 1;
				csv_data = event.target.result;
				csv_name = selectedFile.name; // 获取文件名

				localStorage.setItem('saved_csv_name', csv_name);
				localStorage.setItem('saved_csv_data', csv_data);

				console.log("new csv get");
				console.log(localStorage.saved_csv_data);

				default_csv_name = csv_name;
				refreshData(csv_data);
				recalculateR10();
				fileInput.dispatchEvent(R10Event);
			};
			reader.readAsText(selectedFile);
		}
	});

});

document.addEventListener("DOMContentLoaded", function () {
	if(localStorage.saved_bg){
		switchBg(0);
	}
});

//更换成选定的头像、id、好友码、ptt、背景图
document.addEventListener("DOMContentLoaded", function () {
	if (localStorage.saved_icon != null) {
		switchSelect(localStorage.saved_icon);
	} else {
		switchSelect("0");
	}
	if (localStorage.saved_ptt != null) {
		document.getElementById("pPTTInput").value = localStorage.saved_ptt;
		recalculateR10();
	}
	if (localStorage.saved_username != null) {
		document.getElementById("nameInput").value = localStorage.saved_username;
		refreshUsername();
	}
	if (localStorage.saved_uid != null) {
		document.getElementById("uidInput").value = localStorage.saved_uid;
		refreshUID();
	}
	if (localStorage.saved_csv_name && localStorage.saved_csv_data) {
		console.log("saved_bg:" + localStorage.saved_bg);
		console.log("try refilling b39 with localstorage");
		document.getElementById("b30Data").innerHTML = "";
		csv_data = localStorage.saved_csv_data;
		//console.log(localStorage.saved_csv_data);
		refreshData(localStorage.saved_csv_data);
		recalculateR10();
	} else {
		fetchAndSaveCSV(default_csv_name, csv_data); //显示一次默认b39
	}
	
});


function cln() {
	if (confirm("确定要清空本地缓存吗？该操作不可撤销！")) {
		localStorage.clear();
		location.reload();
	}

}


function showSelect() {
	if (flag_switch_controller === 1) {
		const sheet = document.getElementById("sheet");
		sheet.style.display = "none";
	}
	flag_switch_controller = 0;
	if (sheet.style.display === "" || sheet.style.display === "none") {
		sheet.style.display = "block";
		setTimeout(function () {
			sheet.style.opacity = "100%";
			sheet.style.left = "500px";
		}, 350);
		console.log("display!");
	} else if (sheet.style.display === "block") {
		sheet.style.opacity = "0%";
		sheet.style.left = "1100px";
		setTimeout(function () {
			sheet.style.display = "none";
		}, 350);

		console.log("hidden!");
	}
}

function switchSelect(path) {
	let icn = document.getElementById("icon");
	let icb = document.getElementById("iconblur");
	let img1; //icon
	let img2; //conblur
	icn.style.opacity = "0";
	icb.style.opacity = "0";
	setTimeout(function () {
		icn.innerHTML = "";
		icb.innerHTML = "";
		img1 = document.createElement("img");
		img2 = document.createElement("img");
		img1.src = "img/avatar/" + path + "_icon.png";
		img2.src = "img/avatar/" + path + "_icon.png";
		icn.appendChild(img1);
		icb.appendChild(img2);
		icn.style.opacity = "100%";
		icb.style.opacity = "100%";
	}, 320)
	localStorage.setItem('saved_icon', path);
	console.log("localstorage:saved_icon:" + localStorage.saved_icon);
}

//切换背景图
function switchBg(f){
	f = parseFloat(f);
	if(!localStorage.saved_bg){
		localStorage.setItem("saved_bg", 8);
		console.log("bg=" + localStorage.saved_bg);
	}
	const bg = document.getElementById("background");
	console.log("current bg:" + localStorage.saved_bg);
	localStorage.saved_bg = (parseFloat(localStorage.saved_bg) + parseFloat(f) + 9) % 9;
	bg.style.opacity = 0;
	setTimeout(function(){
		bg.innerHTML = "";
		let bgImg = document.createElement("img");
		bgImg.id = "bgImg";
		bgImg.src = "bgs/" + localStorage.saved_bg % 9 + ".webp";
		bg.appendChild(bgImg);
		bg.style.opacity = "100%";
	}, 250)
	
	changeDisplayAmount();
}


//自动调整页面缩放，打开网页时占满横向空间
function resizeWidth() {
	if (window.innerWidth < 1720) {
		document.body.style.zoom = (window.innerWidth / 1730);
	} else {
		document.body.style.zoom = 1;
	}
}