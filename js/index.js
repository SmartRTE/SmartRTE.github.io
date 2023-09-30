let db;
let SQL;
let csvContent;	//用于保存生成的csv文件，便于传入localStorage
// 加载sqlite组件
let config = {
	locateFile: () => "sql-wasm.wasm",
};
//组件初始化
initSqlJs(config).then(function(sqlModule) {
	SQL = sqlModule;
	resizeWidth();
	console.log("sql.js initialized 🎉");
});
//异步加载db文件
async function openDatabase(file) {
	const buffer = await file.arrayBuffer();
	const uInt8Array = new Uint8Array(buffer);
	db = new SQL.Database(uInt8Array);
	console.log('Database opened successfully.');

	//执行sql.json里的SQL语句
	const queryFilePath = 'json/sql.json';
	const queryResponse = await fetch(queryFilePath);
	const query = await queryResponse.text();
	executeQuery(query);
}

function executeQuery(query) {
	if (!db) {
		console.error('Database not opened.');
		alert("st3文件选取有误，请重试！");
		return;
	}
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
	try {
		const result = db.exec(query);
		if (result.length > 0 && result[0].values) {
			const columns = result[0].columns;
			const values = result[0].values;


			// 创建表头
			const headerRow = table.querySelector('thead tr');
			headerRow.innerHTML = '';
			columns.forEach(column => {
				const th = document.createElement('th');
				th.textContent = column;
				headerRow.appendChild(th);
			});

			// 创建表格内容
			const tbody = table.querySelector('tbody');
			tbody.innerHTML = '';
			values.forEach(valueRow => {
				const tr = document.createElement('tr');
				valueRow.forEach(value => {
					const td = document.createElement('td');
					td.textContent = value;
					tr.appendChild(td);

					// 根据值设置背景颜色
					if (value === 'Past') {
						tr.style.backgroundColor = 'rgba(0,0,255,0.35)';
					} else if (value === 'Present') {
						tr.style.backgroundColor = 'rgba(0,255,0,0.35)';
					} else if (value === 'Future') {
						tr.style.backgroundColor = 'rgba(128,0,128,0.35)';
					} else if (value === 'Beyond') {
						tr.style.backgroundColor = 'rgba(255,0,0,0.35)';
					}
				});
				tbody.appendChild(tr);
			});
			
			//加载完表格显示csv下载按钮
			const uploadButton = document.getElementById("uploadButton");
			uploadButton.style.width = "300px";
			uploadButton.style.backgroundPosition = "center";
			uploadButton.textContent = "重新上传";
			const downloadButton = document.getElementById("download");
			downloadButton.style.display = "inline-block";
			const sendButton = document.getElementById("sendToB30");
			sendButton.style.display = "inline-block";
			
			//转换成csv保存到内存
			convertCSV();
			
			resultArea.value = '查询执行成功！';
		} else {
			resultArea.value = '查询结果为空！';
		}
	} catch (error) {
		resultArea.value = error.message;
	}
}

document.addEventListener("DOMContentLoaded", function() {
	const dbFileInput = document.getElementById('dbFileInput');
	dbFileInput.addEventListener("change", () => {
		const file = dbFileInput.files[0];
		if (file) {
			openDatabase(file);
		}
	})

	const uploadButton = document.getElementById("uploadButton");
	const fileInput = document.getElementById("dbFileInput");

	// 添加上传按钮的点击事件处理程序
	uploadButton.addEventListener("click", function() {
		// 触发文件选择对话框
		fileInput.click();
	});
});

function convertCSV(){
	// 获取表格元素
	const table = document.getElementById('queryTable');
	
	// 准备存储数据的数组
	const data = [];
	
	// 处理表格的标题行
	const headerRow = table.querySelector('thead tr');
	const headerData = [];
	const headerCells = headerRow.querySelectorAll('th');
	headerCells.forEach(cell => {
		headerData.push(cell.textContent);
	});
	data.push(headerData);
	
	// 遍历表格行和列，提取数据
	const rows = table.querySelectorAll('tbody tr');
	rows.forEach(row => {
		const rowData = [];
		const cells = row.querySelectorAll('td');
		cells.forEach(cell => {
			rowData.push(cell.textContent);
		});
		data.push(rowData);
	});
	
	// 将数据转换为CSV格式
	csvContent = data.map(row => row.map(value => `${value}`).join(',')).join('\n');
}


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

function sendToB30(){
	let currentDateTime = new Date().toLocaleString();
	localStorage.setItem("saved_csv_name", 'B30_' + currentDateTime + '.csv')
	localStorage.setItem("saved_csv_data", csvContent);
	window.location.href = "b30gen.html";
}

//展开收起notices
function switchNotices() {
	console.log("notices flag = " + localStorage.saved_notices_flag)
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
});


function resizeWidth() {
	if (window.innerWidth < 1000) {
		document.body.style.zoom = (window.innerWidth / 1010);
	} else {
		document.body.style.zoom = 1;
	}
}