let displayAmount = 10; //显示条目数量,弃用
let lowDifficulty = 10.0; //最低显示定数
let highDifficulty = 10.6; //最高显示定数
let fetch_flag = 0; //是否上传了新csv
let default_csv_name = "default.csv"; //初始的默认csv路径
let csv_name = null; //手动选择的新csv
let csv_data = null; //储存csv内容到内存

let flag = 0; //替换default.csv
let flag_switch_controller = 0; //控件初始值赋值block
let flag_uid = 1; //显示/隐藏uid
let flag_constant = -1;

let rowCounter = 0;
let imageMapping = null; //图片路径映射
let titleMapping = null; //曲名映射

let statistic_full_recall = 0; //fr数
let statistic_pure_memory = 0; //pm数
let statistic_theory = 0; //理论数
let statistic_xing = 0; //1f/1l性数
let statistic_1xiao = 0; //1小p性数

let future_only = 0; //只要FTR和BYD难度

function getConstant() {
	const urlParams = new URLSearchParams(window.location.search);
	if (urlParams.has("singlePTTInfo")) {
		flag_constant = urlParams.get("singlePTTInfo");
	}
}

function switchFTR(){
	const f = document.getElementById("ftrOnly");
	future_only = future_only === 1 ? 0 : 1;
	f.style.backgroundColor = future_only === 1 ? "lightpink" : "cornflowerblue";
	f.textContent = future_only === 1 ? "全部显示" : "只要FTR和BYD"; 
	refreshData(csv_data);
}

window.onload = function() {
	getConstant();
	setDifficulty();
}
console.log("Constant = " + flag_constant);
console.log("flag_constant = " + flag_constant);



const R10Event = new Event("DOMContentLoaded");


function isInteger(obj) {
	return obj % 1 === 0
}

function swap(a, b) {
	let t;
	t = a;
	a = b;
	b = t;
}
//清除统计信息
function clearStatistics() {
	statistic_full_recall = 0;
	statistic_pure_memory = 0;
	statistic_theory = 0;
	statistic_xing = 0;
	statistic_1xiao = 0;
}
//读取一次文件
// fetchAndSaveCSV(default_csv_name, csv_data); //显示一次默认b39


//更换成选定的头像、id、好友码、ptt、背景图
document.addEventListener("DOMContentLoaded", function() {
	resizeWidth();
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
		// console.log("saved_bg:" + localStorage.saved_bg);
		// console.log("try refilling b39 with localstorage");
		document.getElementById("b30Data").innerHTML = "";
		csv_data = localStorage.saved_csv_data;
		//console.log(localStorage.saved_csv_data);
		refreshData(localStorage.saved_csv_data);
		recalculateR10();
	} else {
		fetchAndSaveCSV(default_csv_name, csv_data); //显示一次默认b39
		setItem("saved_csv_name", default_csv_name);
		setItem("saved_csv_data", csv_data);
	}
});


document.addEventListener("DOMContentLoaded", function() {
	if (localStorage.saved_bg) {
		switchBg(0);
	}
});



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
		clearStatistics();
		displayB30Data(csvdata);
		displayB30Value(csvdata, 0);
		resetBackgroundHeight();
		displayPersonalPTT(csvdata);
	} catch (error) {
		console.error("Error loading CSV file:", error);
	}
}

//刷新数据显示
function refreshData(data) {
	const b30DataContainer = document.getElementById("b30Data");
	b30DataContainer.innerHTML = "";
	// console.log("b30cleared");
	const pttDisplay = document.getElementById("PTTDisplay");
	const statisticsDisplay = document.getElementById("statisticsDisplay");
	pttDisplay.innerHTML = "";
	statisticsDisplay.innerHTML = "";

	// console.log("pttcleared");
	//数据统计初始化
	rowCounter = 0;
	// console.log("rowCounter cleared," + rowCounter);
	clearStatistics();
	// console.log("statistics cleared");
	displayB30Data(data); //显示新的csv数据
	resetBackgroundHeight(); //重新计算显示背景高度
	// console.log("B30Over");
	displayB30Value(data, 1);
	// displayB30Value(data);
	displayPersonalPTT(data);

}
//重新设定背景图高度
function resetBackgroundHeight() {
	// console.log("Height called, amount=" + rowCounter);
	const bgImg = document.getElementById("bgImg");
	const mainCapture = document.getElementById("mainCapture");
	let fixed = 300;
	let height = 211 * (1 + Math.floor((rowCounter - 1) / 2)) + fixed;
	// console.log("result = " + height);
	h = String(height + 100) + "px";
	bgImg.style.height = h;
	mainCapture.style.height = h;
	document.body.style.height = h;

}
//不四舍五入的小数取舍
function cutDecimal(a, pow) { //原数据，保留位数
	return (Math.floor(a * Math.pow(10, pow)) / Math.pow(10, pow)).toFixed(pow);
}

//长数字三位分割
function formatScore(score, symbol) {
	var scoreStr = String(score);
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
		setTimeout(function() {
			controller.style.opacity = "100%";
			controller.style.left = "150px";
			controller.style.top = "300px";
		}, 350);

		// console.log("display!");
	} else if (controller.style.display === "block") {
		controller.style.opacity = "0";
		controller.style.left = "0px";
		controller.style.top = "0px";
		setTimeout(function() {

			controller.style.display = "none";
		}, 350);
		// console.log("hidden!");
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
		return "img/rank/FR.png";
	}
	const ranges = [8599999, 8899999, 9199999, 9499999, 9799999, 9899999, 10000000,
		10002222
	];
	const rankLabels = ["D", "C", "B", "A", "AA", "EX", "EX+", "PM"];
	for (let i = 0; i < ranges.length; i++) {
		if (score < ranges[i]) {
			return ("img/rank/" + rankLabels[i] + ".png");
		}
	}
}

//夺舍了，显示目前筛选信息
function displayB30Value(data, flag) {
	const statisticsContainer = document.createElement("div");
	statisticsContainer.id = "statisticsContainer";
	document.getElementById("statisticsDisplay").appendChild(statisticsContainer);
	const statisticsTitle = document.createElement("div");
	statisticsTitle.id = "statisticsTitle";
	statisticsTitle.textContent = "In " + rowCounter + " results:";
	document.getElementById("statisticsContainer").appendChild(statisticsTitle);

	const statisticsTheory = document.createElement("div");
	statisticsTheory.id = "statisticsTheory";
	statisticsTheory.textContent = "MaxPM : " + statistic_theory;
	document.getElementById("statisticsContainer").appendChild(statisticsTheory);

	const statisticsPMFR = document.createElement("div");
	statisticsPMFR.id = "statisticsPMFR";
	statisticsPMFR.textContent = "PM : " + statistic_pure_memory + " | FR : " + statistic_full_recall;
	document.getElementById("statisticsContainer").appendChild(statisticsPMFR);

	const statistics1Xiao = document.createElement("div");
	statistics1Xiao.id = "statistics1Xiao";
	statistics1Xiao.textContent = "Max-1 : " + statistic_1xiao;
	document.getElementById("statisticsContainer").appendChild(statistics1Xiao);

	const statisticsXing = document.createElement("div");
	statisticsXing.id = "statisticsXing";
	statisticsXing.textContent = "1F/1L : " + statistic_xing;
	document.getElementById("statisticsContainer").appendChild(statisticsXing);
	// Max，B30，R10划分区块容器

	const maxPTTContainer = document.createElement("div");
	maxPTTContainer.id = "maxPTTContainer";
	maxPTTContainer.textContent = "Difficulty"
	document.getElementById("PTTDisplay").appendChild(maxPTTContainer);

	const b30PTTContainer = document.createElement("div");
	b30PTTContainer.id = "b30PTTContainer";
	b30PTTContainer.textContent = "From：" + document.getElementById("lowDifficulty").value;
	document.getElementById("PTTDisplay").appendChild(b30PTTContainer);

	const r10PTTContainer = document.createElement("div");
	r10PTTContainer.id = "r10PTTContainer";
	r10PTTContainer.textContent = "To：" + document.getElementById("highDifficulty").value;
	document.getElementById("PTTDisplay").appendChild(r10PTTContainer);
}
//显示头像旁2位小数的PTT（不四舍五入）
function displayPersonalPTT(data) {
	personalPTT = document.getElementById("pPTTInput").value;
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
	const b30Data = lines.slice(1, );
	var counter = 1;
	var spliter = 1;

	b30Data.forEach((row, index) => {
		const cells = row.split(",");
		const [songName, songId, Difficulty, score, perfect, criticalPerfect, far, lost,
			singlePTTInfo, singlePTT
		] = cells;
		if (parseFloat(singlePTTInfo) >= parseFloat(lowDifficulty) && parseFloat(singlePTTInfo) <= parseFloat(
				highDifficulty)) {
			if (future_only === 1 && (Difficulty === "Past" || Difficulty === "Present")) {
				//🤔
			} else {
				rowCounter = rowCounter + 1;
				//console.log("rouCounter = " + rowCounter + songName + singlePTTInfo);
				const singlePTTContainer = document.createElement("div");
				singlePTTContainer.className = "singlePTT";
				singlePTTContainer.id = songId + "_" + Difficulty;

				singlePTTContainer.onclick = function() {
					// 在点击事件处理程序中获取被点击的div的id
					var id = singlePTTContainer.id;
					// console.log("被点击的div的id是：" + id);
					// console.log("songName=" + songName);
					// console.log("songId=" + songId);
					// console.log("Difficulty=" + Difficulty);
					// console.log("score=" + score);
					// console.log("perfect=" + perfect);
					// console.log("criticalPerfect=" + criticalPerfect);
					// console.log("far=" + far);
					// console.log("lost=" + lost);
					// console.log("singlePTTInfo=" + singlePTTInfo);
					// console.log("singlePTT=" + singlePTT);
					// const url =
					// 	`clicktest.html?songName=${songName}&songId=${songId}&Difficulty=${Difficulty}&score=${score}&perfect=${perfect}&criticalPerfect=${criticalPerfect}&far=${far}&lost=${lost}&singlePTTInfo=${singlePTTInfo}&singlePTT=${singlePTT}`;
					// window.location.href = url;
					const url = `divgen.html?singlePTTInfo=${singlePTTInfo}`;
					window.location.href = url;
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
							songImage.src = "Processed_Illustration/" + songId + diffSongId[
								Difficulty] +
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
						songNameHeader.textContent = "sayonarahatsukoi";
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
				songRank.src = judgeRank(score, far, lost);


				const image = new Image();
				image.src = songImage.src;
				//理论值调整分数和sPTT颜色
				//并给对应的计数器累加
				if (Number(perfect) !== 0 && perfect === criticalPerfect && Number(far) === 0 && Number(
					lost) ===
					0) {
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
				if (Number(perfect) !== 0 && (Number(far) === 1 && Number(lost) === 0) || (Number(far) === 0 &&
						Number(
							lost) === 1)) {
					statistic_xing = statistic_xing + 1;
				}
				if (Number(perfect) !== 0 && Number(perfect - 1) === Number(criticalPerfect) && Number(far) ===
					0 &&
					Number(lost) === 0) {
					statistic_1xiao = statistic_1xiao + 1;
				}
				if (rowCounter === 1) {
					rankHeader.style.backgroundColor = "rgba(255,202,1,1)";
				}
				if (rowCounter === 2) {
					rankHeader.style.backgroundColor = "rgba(175, 175, 175, 1.0)";
				}
				if (rowCounter === 3) {
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
				songInfoContainer.appendChild(itemsDiv);
				songInfoContainer.appendChild(rankDiv);
				singlePTTContainer.appendChild(songInfoContainer);
				singlePTTContainer.appendChild(songRank);
				document.getElementById("b30Data").appendChild(singlePTTContainer);
			}
			//console.log("fr:" + statistic_full_recall + ", pm:" + statistic_pure_memory + ", th:" +statistic_theory);

		}

	});
	// console.log("B30Over");
}
//用html2canvas进行截图
document.addEventListener("DOMContentLoaded", function() {
	//清除刷新提示notice
	document.getElementById("notice").textContent = "";

	async function savePageAsImage() {
		const body = document.getElementById("mainCapture");
		const bg = document.getElementById("bgImg");
		const captureWidth = bg.width; //1700
		const captureHeight = bg.height; //3150
		const saveButton = document.getElementById("saveButton");
		const cover = document.getElementById("mainCover");
		let vw = document.documentElement.clientWidth;
		document.getElementById("loadingGif").style.left = vw / 2 - 32 + "px";
		document.getElementById("loadingNotice").style.left = vw / 2 - 300 + "px";

		switchController();
		cover.style.display = "block";
		setTimeout(function() {
			cover.style.opacity = "1";
		}, 50);
		document.body.style.zoom = 1;
		document.body.style = "-moz-transform: scale(" + document.body.style.zoom +
			"); -moz-transform-origin: 0 0;";
		saveButton.disabled = true;
		html2canvas(body, {
			useCORS: true,
			width: captureWidth,
			height: captureHeight,
			scale: 1.2,
		}).then(canvas => {
			const dataURL = canvas.toDataURL("image/jpg");
			const link = document.createElement("a");
			link.href = dataURL;
			let currentDateTime = new Date().toLocaleString();
			const username = document.getElementById("userName").textContent;
			link.download = "B30_" + username + "_" + currentDateTime + ".jpg";
			link.textContent = "Download Image";

			document.body.appendChild(link);
			link.click();

			document.body.removeChild(link);
			resizeWidth();

			cover.style.opacity = "0";
			setTimeout(function() {
				cover.style.display = "none";
			}, 800);

			saveButton.disabled = false;
			setTimeout(function() {
				switchController();
			}, 800);

		});
	}
	saveButton.addEventListener("click", savePageAsImage);

	//页脚显示copyright和当前时间
	var currentDateTime = new Date().toLocaleString();
	document.getElementById("copyright").textContent = "Generated by RTE at http://SmartRTE.github.io @ " +
		currentDateTime;

	// 页面加载时调用一次以显示初始内容
	// refreshData((flag === 1) ? (csv_data) : (localStorage.saved_csv_data));
});

//显示潜力值和星框
function recalculateR10() {
	// console.log("recalcR10 Called");
	// const pPTTDiv = document.getElementById("personalPTT");
	const inputElement = document.getElementById("pPTTInput");
	//const starFrame = document.getElementById("starImg");
	const starFrame = document.getElementById("b30Value"); //清空后重新append一个图img和文字div
	const B30 = document.getElementById("B30");
	const newPTT = parseFloat(inputElement.value);
	localStorage.setItem('saved_ptt', newPTT);
	if (isNaN(newPTT)) {
		newPTT = 0.00;
	} else if (newPTT >= 13.11) {
		newPTT = "🤔";
		// console.log("🤔");
	}
	starFrame.style.opacity = "0%";
	starFrame.innerHTML = "";

	setTimeout(function() {
		const starImg = document.createElement("img");
		starImg.id = "starImg";
		starImg.src = "img/rating/rating_" + judgeStars(newPTT) + ".png";
		starFrame.appendChild(starImg);
		starFrame.style.opacity = "100%"
		const pPTTDiv = document.createElement("div");
		pPTTDiv.id = "personalPTT";
		pPTTDiv.textContent = newPTT.toFixed(2);
		starFrame.appendChild(pPTTDiv);
	}, 120);

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
	if (flag_uid) {
		const uidDiv = document.getElementById("uid");
		const input2 = document.getElementById("uidInput");
		uidDiv.textContent = formatScore(input2.value, " ");
		localStorage.setItem('saved_uid', input2.value);
	}
}

//上传使用的csv文件
document.addEventListener("DOMContentLoaded", function() {
	// 获取上传按钮和文件输入元素
	const uploadButton = document.getElementById("uploadButton");
	const fileInput = document.getElementById("fileInput");

	// 添加上传按钮的点击事件处理程序
	uploadButton.addEventListener("click", function() {
		// 触发文件选择对话框
		fileInput.click();
	});

	// 读取新csv文件逻辑
	fileInput.addEventListener("change", function(event) {
		const selectedFile = event.target.files[0];
		if (selectedFile) {
			const reader = new FileReader();
			reader.onload = function(event) {
				flag = 1;
				csv_data = event.target.result;
				csv_name = selectedFile.name; // 获取文件名
				default_csv_name = csv_name;
				refreshData(csv_data);
				fileInput.dispatchEvent(R10Event);
			};
			reader.readAsText(selectedFile);
		}
	});

});

//设置显示的上下界
function setDifficulty() {

	const low = document.getElementById("lowDifficulty");
	const high = document.getElementById("highDifficulty");

	if (parseFloat(flag_constant) !== -1) {
		low.value = flag_constant;
		high.value = flag_constant;
		console.log("low.value = " + low.value + ", high.value = " + high.value);
		flag_constant = -1;
	} else {}
	lowDifficulty = isInteger(low.value) ? low.value | 0 : parseFloat(low.value).toFixed(1);
	highDifficulty = isInteger(high.value) ? high.value | 0 : parseFloat(high.value).toFixed(1);
	if (highDifficulty < lowDifficulty) {
		swap(highDifficulty, lowDifficulty);
	}
	// lowDifficulty = low.value < high.value ? low.value : high.value;
	// highDifficulty = low.value > high.value ? low.value : high.value;
	if (parseFloat(lowDifficulty) === parseFloat(highDifficulty)) {
		document.getElementById("b30PTTContainer").textContent = "";
		document.getElementById("r10PTTContainer").textContent = highDifficulty;
	}

	refreshData(csv_data);
}


//显示头像选取框
function showSelect() {
	if (flag_switch_controller === 1) {
		const sheet = document.getElementById("sheet");
		sheet.style.display = "none";
	}
	flag_switch_controller = 0;
	if (sheet.style.display === "" || sheet.style.display === "none") {
		sheet.style.display = "inline-block";
		setTimeout(function() {
			sheet.style.opacity = "100%";
			// sheet.style.left = "-480px";
		}, 350);
		// console.log("display!");
	} else if (sheet.style.display === "inline-block") {
		sheet.style.opacity = "0%";
		// sheet.style.left = "0px";
		setTimeout(function() {
			sheet.style.display = "none";
		}, 350);

		// console.log("hidden!");
	}
}
//头像切换
function switchSelect(path) {
	let icn = document.getElementById("icon");
	let icb = document.getElementById("iconblur");
	let img1; //icon
	let img2; //conblur
	icn.style.opacity = "0";
	icb.style.opacity = "0";
	setTimeout(function() {
		icn.innerHTML = "";
		icb.innerHTML = "";
		img1 = document.createElement("img");
		img2 = document.createElement("img");
		img1.src = "img/avatar/" + path + "_icon.webp";
		img2.src = "img/avatar/" + path + "_icon.webp";
		icn.appendChild(img1);
		icb.appendChild(img2);
		icn.style.opacity = "100%";
		icb.style.opacity = "100%";
	}, 320)
	localStorage.setItem('saved_icon', path);
	// console.log("localstorage:saved_icon:" + localStorage.saved_icon);
}

function cln() {
	if (confirm("确定要清空本地缓存吗？该操作不可撤销！")) {
		localStorage.clear();
		location.reload();
	}

}

//切换背景图
function switchBg(f) {
	f = parseFloat(f);
	if (!localStorage.saved_bg) {
		localStorage.setItem("saved_bg", 8);
		// console.log("bg=" + localStorage.saved_bg);
	}
	const bg = document.getElementById("background");
	// console.log("current bg:" + localStorage.saved_bg);
	localStorage.saved_bg = (parseFloat(localStorage.saved_bg) + parseFloat(f) + 9) % 9;
	bg.style.opacity = 0;
	setTimeout(function() {
		bg.innerHTML = "";
		let bgImg = document.createElement("img");
		bgImg.id = "bgImg";
		bgImg.src = "bgs/" + localStorage.saved_bg % 9 + ".webp";
		// console.log("displayAmount = " + displayAmount);
		bg.appendChild(bgImg);
		resetBackgroundHeight();
		bg.style.opacity = "100%";

	}, 250)
	//显示当前序号
	const index = document.getElementById("currentBgIndex");
	index.textContent = parseFloat(localStorage.saved_bg) + 1 + "/9";
	//changeDisplayAmount();


}
//显示隐藏ID
function hideUid() {
	const f = document.getElementById("hideUID");
	const uid = document.getElementById("uid");
	if (f.value == 1) {
		f.value = 0;
		f.style.backgroundColor = "lightpink";
		f.textContent = "显示";
		uid.style.letterSpacing = "-3px";
		uid.textContent = "✱✱✱ ✱✱✱ ✱✱✱";
		flag_uid = 0;
	} else {
		f.value = 1;
		f.style.backgroundColor = "cornflowerblue";
		f.textContent = "隐藏";
		uid.style.letterSpacing = "2px";
		flag_uid = 1;
		refreshUID();
	}
}




//调整页面缩放
function resizeWidth() {

	document.body.style = "-moz-transform: scale(" + (document.documentElement.clientWidth / 1700) +
		"); -moz-transform-origin: 0 0; -moz-";
	document.body.style.zoom = (document.documentElement.clientWidth / 1700);

}

window.addEventListener('resize', resizeWidth);