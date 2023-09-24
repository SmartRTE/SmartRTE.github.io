let db;
    let SQL;

    // Load sql.js WebAssembly file
    let config = {
      locateFile: () => "sql-wasm.wasm",
    };

    initSqlJs(config).then(function (sqlModule) {
      SQL = sqlModule;
      console.log("sql.js initialized 🎉");
    });

    async function openDatabase(file) {
      const buffer = await file.arrayBuffer();
      const uInt8Array = new Uint8Array(buffer);
      db = new SQL.Database(uInt8Array);
      console.log('Database opened successfully.');

      // Auto-execute query from sql.txt
      const queryFilePath = 'sql.json'; // Replace with the actual file path
      const queryResponse = await fetch(queryFilePath);
      const query = await queryResponse.text();
      executeQuery(query);
    }

    function executeQuery(query) {
      if (!db) {
        console.error('Database not opened.');
        return;
      }

      const table = document.getElementById('queryTable');
      const resultArea = document.getElementById('queryResult');
      resultArea.value = ''; // Clear the text area

      try {
        const result = db.exec(query);
        if (result.length > 0 && result[0].values) {
          const columns = result[0].columns;
          const values = result[0].values;

          // Create table header
          const headerRow = table.querySelector('thead tr');
          headerRow.innerHTML = '';
          columns.forEach(column => {
            const th = document.createElement('th');
            th.textContent = column;
            headerRow.appendChild(th);
          });

          // Populate table body
          const tbody = table.querySelector('tbody');
          tbody.innerHTML = '';
          values.forEach(valueRow => {
            const tr = document.createElement('tr');
            valueRow.forEach(value => {
              const td = document.createElement('td');
              td.textContent = value;
              tr.appendChild(td);
            });
            tbody.appendChild(tr);
          });

          resultArea.value = 'Query executed successfully.';
        } else {
          resultArea.value = 'Query returned no results.';
        }
      } catch (error) {
        resultArea.value = error.message;
      }
    }

    const dbFileInput = document.getElementById('dbFileInput');
    dbFileInput.addEventListener('change', () => {
      const file = dbFileInput.files[0];
      if (file) {
        openDatabase(file);
      }
    });
	
	function exportCSV(){
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
		const csvContent = data.map(row => row.map(value => `${value}`).join(',')).join('\n');
		
		// 创建Blob对象，用于创建文件
		const blob = new Blob([csvContent], { type: 'text/csv' });
		
		// 创建一个下载链接
		const link = document.createElement('a');
		link.href = URL.createObjectURL(blob);
		link.download = 'table_data.csv'; // 下载文件的文件名
		
		// 添加链接到DOM中并触发点击以下载
		document.body.appendChild(link);
		link.click();
		
		// 清理链接对象
		document.body.removeChild(link);
	}
	
	