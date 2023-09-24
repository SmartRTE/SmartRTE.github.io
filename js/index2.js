function displayB30Data(data) {
    const lines = data.split("\n");
    const b30Data = lines.slice(1, 31);

    b30Data.forEach(row => {
        const cells = row.split(",");
        const [songName, songId, Difficulty, score, perfect, criticalPerfect, far, lost, realDifficulty, singlePTT] = cells;

        function judgeRank(score) {
            const ranges = [8599999, 8899999, 9199999, 9499999, 9799999, 9899999, 10000000];
            const rankLabels = ["[D]", "[C]", "[B]", "[A]", "[AA]", "[EX]", "[EX+]", "[PM]"];
            for (let i = 0; i < ranges.length; i++) {
                if (score < ranges[i]) {
                    return rankLabels[i];
                }
            }
        }

        const singlePTTContainer = document.createElement("div");
        singlePTTContainer.className = "singlePTT";

        const songImage = document.createElement("img");
        songImage.src = `Processed_Illustration/${songId}.jpg`;
        songImage.className = "songImage";

        const songInfoContainer = document.createElement("div");
        songInfoContainer.className = "songInformation";

        const difficultyColor = document.createElement("div");
        difficultyColor.className = "difficultyColor";

        const realDifficultyDiv = document.createElement("div");
        realDifficultyDiv.className = "realDifficulty";
        const realDifficultyLink = document.createElement("a");
        realDifficultyLink.textContent = parseFloat(realDifficulty).toFixed(1);
        realDifficultyDiv.appendChild(realDifficultyLink);
        if (Difficulty == "Future") {
        	realDifficultyDiv.style.backgroundColor = "rgba(110,68,106,0.85)";
        } else if (Difficulty == "Beyond") {
        	realDifficultyDiv.style.backgroundColor = "rgba(200,36,54,0.95)";
        }
        const sPTTDiv = document.createElement("div");
        sPTTDiv.className = "sPTT";
        const sPTTLinkArrow = document.createElement("a");
        sPTTLinkArrow.textContent = "→";
        const sPTTLinkValue = document.createElement("a");
        sPTTLinkValue.textContent = parseFloat(singlePTT).toFixed(3);
        sPTTDiv.appendChild(sPTTLinkArrow);
        sPTTDiv.appendChild(sPTTLinkValue);

        const songNameDiv = document.createElement("div");
        songNameDiv.className = "songName";
        const songNameHeader = document.createElement("h2");
        songNameHeader.textContent = songName;
        songNameDiv.appendChild(songNameHeader);

        const scoreDiv = document.createElement("div");
        scoreDiv.className = "score";
        const scoreHeader = document.createElement("h3");
        scoreHeader.textContent = `${score} ${judgeRank(score)}`;
        scoreDiv.appendChild(scoreHeader);

        const pureDiv = document.createElement("div");
        pureDiv.className = "pure";
        const pureHeader = document.createElement("h4");
        pureHeader.textContent = "P: " + perfect + "(" + (criticalPerfect - perfect) + ")";
        pureDiv.appendChild(pureHeader);
        pureHeader.style.backgroundColor = "rgba(110,68,106,0.6)";
        
        const farDiv = document.createElement("div");
        farDiv.className = "far";
        const farHeader = document.createElement("h4");
        farHeader.textContent = "F: " + far;
        farDiv.appendChild(farHeader);
        farHeader.style.backgroundColor = "rgba(255,197,35,0.5)";
        
        const lostDiv = document.createElement("div");
        lostDiv.className = "lost";
        const lostHeader = document.createElement("h4");
        lostHeader.textContent = "L: " + lost;
        lostDiv.appendChild(lostHeader);
        lostHeader.style.backgroundColor = "rgba(200,36,54,0.6)"
        
        //位次
        const rankDiv = document.createElement("div");
        rankDiv.className = "rank";
        const rankHeader = document.createElement("h4");
        rankHeader.textContent = "#" + counter;
        counter = counter + 1;
        rankDiv.appendChild(rankHeader);

        // Determine font color based on image brightness
        const image = new Image();
        image.src = songImage.src;
        image.onload = function() {
        	const canvas = document.createElement("canvas");
        	const context = canvas.getContext("2d");
        	canvas.width = image.width;
        	canvas.height = image.height;
        	context.drawImage(image, 0, 0, image.width, image.height);
        
        	let totalBrightness = 0;
        
        	const imageData = context.getImageData(0, 0, image.width, image.height);
        	for (let i = 0; i < imageData.data.length; i += 4) {
        		const r = imageData.data[i];
        		const g = imageData.data[i + 1];
        		const b = imageData.data[i + 2];
        
        		const brightness = (r + g + b) / 3;
        		totalBrightness += brightness;
        	}
        
        	const averageBrightness = totalBrightness / (imageData.data.length / 4);
        
        	// 根据曲绘色调改变字体颜色
        	if (averageBrightness < 158) {
        		songNameHeader.style.color = "white";
        		realDifficultyDiv.style.color = "white";
        		sPTTLinkArrow.style.color = "white";
        		sPTTLinkValue.style.color = "white";
        		scoreHeader.style.color = "white";
        		pureHeader.style.color = "white";
        		farHeader.style.color = "white";
        		lostHeader.style.color = "white";
        
        	}
        	//PM调整分数和sPTT颜色
        	if (parseFloat(singlePTT - 2).toFixed(9) == parseFloat(realDifficulty)) {
        		sPTTLinkValue.style.color = "rgba(100,255,255,0.8)";
        	}
        	if (score >= 10000000) {
        		scoreHeader.style.color = "rgba(0,255,255,0.8)";
        	}
        };
        difficultyColor.appendChild(realDifficultyDiv);
        difficultyColor.appendChild(sPTTDiv);
        songInfoContainer.appendChild(difficultyColor);
        songInfoContainer.appendChild(songNameDiv);
        songInfoContainer.appendChild(scoreDiv);
        songInfoContainer.appendChild(pureDiv);
        songInfoContainer.appendChild(farDiv);
        songInfoContainer.appendChild(lostDiv);
        songInfoContainer.appendChild(rankDiv);
        singlePTTContainer.appendChild(songImage);
        singlePTTContainer.appendChild(songInfoContainer);

        document.getElementById("container").appendChild(singlePTTContainer);
    });
} 