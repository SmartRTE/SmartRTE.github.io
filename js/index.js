let db;
let SQL;
let csvContent; //用于保存生成的csv文件，便于传入localStorage
let edit_flag = 0;
// 加载sqlite组件
let config = {
	locateFile: () => "sql-wasm.wasm",
};

let myScatterChart;

//组件初始化
initSqlJs(config).then(function(sqlModule) {
	SQL = sqlModule;
	// resizeWidth();
	console.log("sql.js initialized 🎉");
});

function isEdit() {
	const urlParams = new URLSearchParams(window.location.search);
	if (urlParams.has("edit")) {
		edit_flag = urlParams.get("edit");
		// console.log("edit=" + urlParams.get("edit"));
		if (edit_flag === "1") {
			showCSV(localStorage.saved_csv_data);
		}
	}
}

window.onload = function() {
	isEdit();
}

function showEdit() {
	const btn = document.getElementById("edit");
	btn.style.display = "none";
	showCSV(localStorage.saved_csv_data);
}

//异步加载db文件
async function openDatabase(file) {
	const buffer = await file.arrayBuffer();
	const uInt8Array = new Uint8Array(buffer);
	db = new SQL.Database(uInt8Array);
	// console.log('Database opened successfully.');

	//执行sql.json里的SQL语句
	const queryFilePath = 'json/sql.json';
	const queryResponse = await fetch(queryFilePath);
	const query = await queryResponse.text();
	executeQuery(query);
}

//修改表格事件监听
addEventListener("DOMContentLoaded", function() {
	let table = document.getElementById("queryTable");
	// 添加删除行和添加行事件监听器
	table.addEventListener("click", function(e) {
		var target = e.target;

		// 检查点击的是否是删除行按钮
		if (target.classList.contains("deleteRow")) {
			var row = target.closest("tr");
			if (row) {
				row.remove(); // 删除当前行
			}
			convertCSV();
		}
	});

	table.addEventListener("click", function(e) {
		var target = e.target;
		// 检查点击的是否是添加行按钮
		if (target.classList.contains("addRow")) {
			var row = target.closest("tr");
			if (row) {
				var newRow = row.cloneNode(true); // 复制当前行
				// newRow.textContent = '';
				row.parentNode.insertBefore(newRow, row.nextSibling); // 在当前行的下一行插入新行
			}
			convertCSV();

		}
	});

	table.addEventListener("click", function(e) {
		var target = e.target;
		// 检查点击的是否是表格单元格
		if (target.tagName === "TD") {
			// console.log("td clicked");
			var rowIndex = target.parentNode.rowIndex; // 获取行索引
			var cellIndex = target.cellIndex; // 获取列索引
			var currentValue = target.textContent;
			var input = document.createElement("input");
			input.value = currentValue;

			// 替换单元格内容为输入框
			target.innerHTML = "";
			target.appendChild(input);

			// 添加失去焦点事件监听器
			input.addEventListener("blur", function() {
				// 当输入框失去焦点时，更新单元格内容为输入框的值
				target.textContent = input.value;
				if (cellIndex === 4 || cellIndex === 9) {
					// console.log("score selected,current singlePTT=" + target.closest("tr")
					// .cells[10].textContent);
					target.closest("tr").cells[10].textContent = calculateSinglePTT(target
						.closest("tr").cells[4].textContent, target.closest("tr").cells[9]
						.textContent);
				}

				// console.log("td changed." + target.textContent);
				sortTable(); // 调用函数来进行排序
				convertCSV();
				generateScatterChart('queryTable', 'chart', 9, 4, [1]);
			});

			// 使输入框获得焦点
			input.focus();
			convertCSV();

		}

	});

});

//表格按ptt排序
function sortTable() {
	var table = document.getElementById("queryTable");
	var tbody = table.querySelector("tbody");
	var rows = Array.from(tbody.rows);

	rows.sort(function(a, b) {
		var aValue = parseFloat(a.cells[10].textContent); // 第11列的值，这里假设是数值
		var bValue = parseFloat(b.cells[10].textContent);
		return bValue - aValue; // 降序排序
	});

	// 清空tbody内容
	while (tbody.rows.length > 0) {
		tbody.deleteRow(0);
	}

	// 重新插入排序后的行
	rows.forEach(function(row) {
		tbody.appendChild(row);
	});
}

function executeQuery(query) {
	if (!db) {
		console.error('Database not opened.');
		alert("st3文件选取有误，请重试！");
		return;
	}
	const querytabel = document.getElementById("queryTable");
	// querytabel.innerHTML = '';
	//表格绘制
	const table = document.getElementById('queryTable');
	const resultArea = document.getElementById('queryResult');
	resultArea.value = ''; //清除区域内容
	if (localStorage.saved_notices_flag == "1") {
		notices.style.opacity = "0";
		setTimeout(function() {
			notices.style.display = "none";
		}, 300)
		localStorage.setItem("saved_notices_flag", "0");
	}

	const result = db.exec(query);
	// console.log(result);
	let tempCSVData;
	if (result.length > 0) {
		const rows = result[0].values;
		const columns = result[0].columns;
		tempCSVData = [columns.join(',')].concat(rows.map(row => row.join(','))).join('\n');
		// console.log(tempCSVData);
		showCSV(tempCSVData);
		convertCSV();
	} else {
		alert("上传的数据库是空的！你是不是忘记把存档同步到本地辣？")
	}
}


//监听上传
document.addEventListener("DOMContentLoaded", function() {
	const dbFileInput = document.getElementById('dbFileInput');
	const uploadButton = document.getElementById("uploadButton");
	const fileInput = document.getElementById("dbFileInput");

	dbFileInput.addEventListener("change", () => {
		const file = dbFileInput.files[0];
		if (file) {
			if (file.name.endsWith(".csv")) {
				const reader = new FileReader();

				reader.onload = function(event) {
					const csvContent = event.target.result;
					showCSV(csvContent);
				}

				reader.readAsText(file);
			} else {
				openDatabase(file);
			}
		}
	});

	// 添加上传按钮的点击事件处理程序
	uploadButton.addEventListener("click", function() {
		// 触发文件选择对话框
		fileInput.click();
	});
});


//显示csv，绘制表格
function showCSV(file) {
	if (localStorage.saved_notices_flag == "1") {
		notices.style.opacity = "0";
		setTimeout(function() {
			notices.style.display = "none";
		}, 300)
		localStorage.setItem("saved_notices_flag", "0");
	}
	file = file.trim(); //删除文件最后多余的回车
	const rows = file.split('\n'); // 按行拆分CSV数据
	const table = document.getElementById("queryTable");
	table.innerHTML = ''; // 清空表格内容

	// 创建表头
	const thead = document.createElement('thead');
	const headerRow = document.createElement('tr');
	const columns = rows[0].split(',');

	// 添加操作列
	headerRow.innerHTML = '<th>操作</th>';

	columns.forEach(column => {
		const th = document.createElement('th');
		th.textContent = column;
		headerRow.appendChild(th);
	});

	thead.appendChild(headerRow);
	table.appendChild(thead);

	// 创建表格内容
	const tbody = document.createElement('tbody');
	tbody.id = "tbody";
	for (let i = 1; i < rows.length; i++) {
		const row = rows[i].split(',');

		// 添加条件检查：如果第四列为空，跳过该行
		if (row.length >= 4 && row[3].trim() === '') {
			continue;
		}
		row[9] = calculateSinglePTT(row[3], row[8]);
		// console.log(row[3] + "," + row[8]);
		// console.log(row[9].trim());
		const tr = document.createElement('tr');

		// 添加操作列
		const actButtons = document.createElement('td');
		actButtons.className = "rowActions";
		tr.appendChild(actButtons);
		const deleteRow = document.createElement("button");
		deleteRow.className = "deleteRow";
		deleteRow.textContent = "删除本行";
		const addRow = document.createElement("button");
		addRow.className = "addRow";
		addRow.textContent = "新增一行";
		actButtons.appendChild(deleteRow);
		actButtons.appendChild(addRow);

		row.forEach(value => {
			const td = document.createElement('td');
			td.textContent = value;

			tr.appendChild(td);
			if (value === 'Future') {
				tr.style.backgroundColor = 'rgba(128,0,128,0.35)';
			} else if (value === 'Beyond') {
				tr.style.backgroundColor = 'rgba(255,0,0,0.35)';
			} else if (value === 'Past') {
				tr.style.backgroundColor = 'rgba(0,0,255,0.35)';
			} else if (value === 'Present') {
				tr.style.backgroundColor = 'rgba(0,255,0,0.35)';
			}
		});

		tbody.appendChild(tr);
	}

	table.appendChild(tbody);

	//加载完表格显示csv下载按钮
	const uploadButton = document.getElementById("uploadButton");
	uploadButton.style.backgroundPosition = "center";
	uploadButton.textContent = "重新上传文件";
	const downloadButton = document.getElementById("download");
	downloadButton.style.display = "inline-block";
	const sendButton = document.getElementById("sendToB30");
	sendButton.style.display = "inline-block";
	sortTable();
	convertCSV();

	generateScatterChart('queryTable', 'chart', 9, 4, [1]);
}


//表格转csv
function convertCSV() {
	// 获取表格元素
	const table = document.getElementById('queryTable');

	// 准备存储数据的数组
	const data = [];

	// 处理表格的标题行
	const headerRow = table.querySelector('thead tr');
	const headerData = [];
	const headerCells = headerRow.querySelectorAll('th');
	let headskip = true;
	headerCells.forEach(cell => {
		if (headskip) {
			// 跳过第一列
			headskip = false;
		} else {
			headerData.push(cell.textContent);
		}
		// headerData.push(cell.textContent);
	});
	data.push(headerData);

	// 遍历表格行和列，提取数据
	const rows = table.querySelectorAll('tbody tr');
	rows.forEach(row => {
		const rowData = [];
		const cells = row.querySelectorAll('td');
		//用于跳过第一列
		let rowskip = true;

		cells.forEach(cell => {
			if (rowskip) {
				// 跳过第一列
				rowskip = false;
			} else {
				rowData.push(cell.textContent);
			}
		});

		data.push(rowData);
	});


	// 将数据转换为CSV格式
	csvContent = data.map(row => row.map(value => `${value}`).join(',')).join('\n');
}

//输出csv开始下载
function exportCSV() {
	// 创建Blob对象，用于创建文件
	const blob = new Blob([csvContent], {
		type: 'text/csv;charset=utf-8'
	});

	// 创建一个下载链接
	const link = document.createElement('a');
	link.href = URL.createObjectURL(blob);
	let currentDateTime = new Date().toLocaleString();
	link.download = 'B30_' + currentDateTime + '.csv'; // 下载文件的文件名

	// 添加链接到DOM中并触发点击以下载
	document.body.appendChild(link);
	link.click();

	// 清理链接对象
	document.body.removeChild(link);
}

//数据直接发送到生图页
function sendToB30() {
	let currentDateTime = new Date().toLocaleString();
	localStorage.setItem("saved_csv_name", 'B30_' + currentDateTime + '.csv')
	localStorage.setItem("saved_csv_data", csvContent);
	window.open("b30gen.html", "_blank");
}

//展开收起notices
function switchNotices() {
	// console.log("notices flag = " + localStorage.saved_notices_flag)
	const notices = document.getElementById("notices");
	if (localStorage.saved_notices_flag == "1") {
		notices.style.opacity = "0";
		setTimeout(function() {
			notices.style.display = "none";
		}, 300)
		localStorage.setItem("saved_notices_flag", "0");
	} else if (localStorage.saved_notices_flag == undefined || localStorage.saved_notices_flag == "0") {
		notices.style.display = "block";
		setTimeout(function() {
			notices.style.opacity = "100%";
		}, 300)
		localStorage.setItem("saved_notices_flag", "1");
	}
}

//显示注意事项
document.addEventListener("DOMContentLoaded", function() {
	if (localStorage.saved_notices_flag == undefined) {
		notices.style.display = "block";
		notices.style.opacity = "1";
		localStorage.setItem("saved_notices_flag", "1");
	} else if (localStorage.saved_notices_flag == "0") {
		notices.style.display = "none";
		notices.style.opacity = "0";
		localStorage.setItem("saved_notices_flag", "0");
	}
	document.getElementById("chartContainer").style.display = "none";
});


function calculateSinglePTT(score, constant) {
	// console.log("ezptt called");
	let s = 0;
	if (Number(score) < 9800000) {
		s = Number(constant) + (Number(score) - 9500000) / 300000;
		s = s >= 0 ? s : 0;
	} else if (Number(score) >= 9800000 && Number(score) < 10000000) {
		s = Number(constant) + 1 + (Number(score) - 9800000) / 200000;
	} else {
		s = Number(constant) + 2;
	}
	return s.toFixed(6);
}

//定数-分数图表生成
function generateScatterChart(tableId, canvasId, xColumnIndex, yColumnIndex, tooltipColumns) {
	var table = document.getElementById(tableId);
	var canvas = document.getElementById(canvasId);
	var ctx = canvas.getContext('2d');
	let tbody = document.getElementById("tbody");
	let cst = getMinMaxValues("tbody", 9, 39);
	let highx = cst.max;
	let lowx = cst.min;
	let scr = getMinMaxValues("tbody", 4, 39);
	let highy = scr.max;
	let lowy = scr.min;
	document.getElementById("chartContainer").style.display = "block";
	// if (window.scatterChart) {
	// 	window.scatterChart.destroy();
	// }

	var tableData = [];
	for (var i = 1; i < table.rows.length; i++) {
		var row = table.rows[i];
		var xValue = parseFloat(row.cells[xColumnIndex].textContent);
		var yValue = parseInt(row.cells[yColumnIndex].textContent);

		var dataObject = {
			x: xValue,
			y: yValue,
			rowIndex: i
		};
		tooltipColumns.forEach(function(columnIndex) {
			dataObject[`column${columnIndex}`] = row.cells[columnIndex].textContent;
		});

		tableData.push(dataObject);
	}
	if (!myScatterChart) {
		myScatterChart = new Chart(ctx, {
			type: 'scatter',
			data: {
				datasets: [{
					label: '定数-分数分布图',
					data: tableData,
					backgroundColor: 'rgba(6, 218, 165, 1.0)',
					radius: 8,
					hoverRadius: 13,
					borderWidth: 5,
				}]
			},
			options: {
				scales: {
					x: {
						type: 'linear',
						position: 'bottom',
						min: lowx - 0.5,
						max: highx > 11.5 ? 12.1 : highx + 0.5,
						step: 0.1,
					},
					y: {
						min: parseInt(lowy / 10000) * 10000 - 10000,
						max: parseInt(highy / 10000) * 10000 + 10000,
						step: 50000,
					}
				},
				plugins: {
					tooltip: {
						callbacks: {
							label: function(context) {
								var data = context.dataset.data[context.dataIndex];
								var tooltipText = '';
								tooltipColumns.forEach(function(columnIndex) {
									tooltipText +=
										`best${data.rowIndex}:${data[`column${columnIndex}`]}:[${data.x}]:(${data.y})`;
								});
								return tooltipText;
							}
						}
					}
				}
			}
		});
	} else {
		// 如果已经存在，则直接更新数据
		myScatterChart.data.datasets[0].data = tableData;
		myScatterChart.update();
	}
}


function getMinMaxValues(tableId, columnIndex, rowCount) {
	var table = document.getElementById(tableId);

	var maxValue = Number.MIN_VALUE;
	var minValue = Number.MAX_VALUE;

	for (var i = 1; i <= rowCount && i < table.rows.length; i++) {
		var cellValue = parseFloat(table.rows[i].cells[columnIndex].textContent);

		if (!isNaN(cellValue)) {
			maxValue = Math.max(maxValue, cellValue);
			minValue = Math.min(minValue, cellValue);
		}
	}

	return {
		min: minValue,
		max: maxValue
	};
}


//调整页面缩放
// function resizeWidth() {

// 	document.body.style = "-moz-transform: scale(" + (document.documentElement.clientWidth / 1500) +
// 		"); -moz-transform-origin: 0 0; -moz-";
// 	document.body.style.zoom = (document.documentElement.clientWidth / 1500);

// }

// window.addEventListener('resize', resizeWidth);