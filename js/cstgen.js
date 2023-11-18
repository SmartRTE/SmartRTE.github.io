class SongData {
  constructor(songname, songid, difficulty, constant) {
    this.songname = songname;
    this.songid = songid;
    this.difficulty = difficulty;
    this.constant = constant;
  }
}

let processedData = [];

function fetchFileContent() {
  fetch('sample/模板.csv')
    .then(response => response.text())
    .then(content => {
      processedData = processData(content);
      processConstants();
      processDifficulties();
	  sortProcessedData();
      console.log(processedData);
    })
    .catch(error => console.error('Error fetching file:', error));
}

function sortProcessedData() {
  processedData.sort((a, b) => {
    // 先按constant降序
    if (b.constant - a.constant !== 0) {
      return b.constant - a.constant;
    }

    // 若constant相同，再按difficulty降序
    if (b.difficulty - a.difficulty !== 0) {
      return b.difficulty - a.difficulty;
    }

    // 若constant和difficulty都相同，按songname升序
    return a.songname.localeCompare(b.songname);
  });
}

function processData(csvContent) {
  const lines = csvContent.split('\n');
  const songDataArray = [];

  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(',');

    if (parts.length === 10) {
      const songname = parts[0];
      const songid = parts[1];
      const difficulty = parts[2];
      const constant = parseFloat(parts[8]).toFixed(1);

      const songData = new SongData(songname, songid, difficulty, constant);
      songDataArray.push(songData);
    } else {
      console.warn(`Invalid CSV row at line ${i + 1}`);
    }
  }

  return songDataArray;
}

function processConstants() {
  processedData.forEach(data => {
    data.constant = parseFloat(data.constant);
  });
}

function processDifficulties() {
  processedData.forEach(data => {
    switch (data.difficulty) {
      case "Beyond":
        data.difficulty = 3;
        break;
      case "Future":
        data.difficulty = 2;
        break;
      case "Present":
        data.difficulty = 1;
        break;
      case "Past":
        data.difficulty = 0;
        break;
    }
  });
}

fetchFileContent();

//console.log(processedData)

//生成
function generateSheet(){
	
}

