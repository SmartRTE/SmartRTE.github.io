let songlist = null;
let quickSelectionGenerationFlag = false;
let difficultyTextColor = ['#004d95', '#005215', '#62184b', '#8a0000', '#463858'];
let difficultyTextShadowPattern = '0 0 3.5px COLOR, 0 3.5px 2px COLOR, 2px 2px 2px COLOR, 3.5px 0 2px COLOR, 2px -2px 2px COLOR, 0 -3.5px 2px COLOR, -2px -2px 2px COLOR, -3.5px 0 2px COLOR, -2px 2px 2px COLOR, 3px 3px COLOR, -3px 3px COLOR, 3px -3px COLOR, -3px -3px COLOR'
let difficultyShadowColor = ['#004d95', '#096700', '#3e003e', '#600000', '#5a437c'];
let diffSongIllusMapper = null;
$(document).ready(function() {
	console.log("ready");
	// console.log(getAllValues());
	showSettingValues(readLocalStorage() ? readLocalStorage() : getAllValues());
	// console.log(readLocalStorage())
	$('#input-difficulty').val(4);
	applySettings(readLocalStorage() ? readLocalStorage() : getSettingValues());
	readSongList();
	getImageMapping().then(data=>{
		console.log(data);
		diffSongIllusMapper = data;
	});
	// console.log(diffSongIllusMapper);

	let ls = JSON.parse(localStorage.fakeResult)
	console.log(ls)
	$('#character').css('top', ls.characterPosition[0] + 'px');
	$('#character').css('left', ls.characterPosition[1] + 'px');
	$('#current-selected-song img').attr('src', `Processed_Illustration/${ls.illustration}.jpg`);
	$('#current-selected-song span').text(ls.songname);
	$('#track-lost').change(function() {
		if ($(this).is(":checked")) {
			$('#clear-type').attr('src', 'img/clearType/clear_' + 'fail' + '.png');
			adjustClearType('fail');
		} else {
			let clearType = getClearType(getAllValues());
			$('#clear-type').attr('src', 'img/clearType/clear_' + clearType + '.png');
			adjustClearType(clearType);
		}
	});
	$('#hash').change(function() {
		if ($(this).is(":checked")) {
			adjustPotentialPosition(true);
		} else {
			adjustPotentialPosition(false);
		}
	});
	$('#input-difficulty').change(function(){
		// console.log('change')
		applyQuickSelection(songlist, $('#current-selected-id').text());
	})
})

function getSettingValues() {
	let settingValues = {};
	/*用户名*/
	settingValues['username'] = $('#input-username').val();
	/*ID框*/
	settingValues['frame'] = $('#input-frame').val();
	/*潜力值*/
	settingValues['potential'] = parseFloat($('#input-potential').val()).toFixed(2);
	/*残片数*/
	settingValues['fragment'] = parseInt($('#input-fragment').val());
	/*源点数*/
	settingValues['memory'] = parseInt($('#input-memory').val());
	/*曲名*/
	settingValues['songname'] = $('#input-songname').val();
	/*曲师*/
	settingValues['artist'] = $('#input-artist').val();
	/*难度*/
	settingValues['difficulty'] = $('#input-difficulty').val();
	/*定数*/
	settingValues['constant'] = parseFloat($('#input-constant').val());
	/*连击数*/
	settingValues['maxrecall'] = parseInt($('#input-maxrecall').val());
	/*结算等级*/
	// let ct = $('#clear-type').attr('src');
	// settingValues['clearType'] = ct.substring(ct.lastIndexOf('/') + 1, ct.indexOf('.png'));
	/*血量*/
	settingValues['hp'] = parseInt($('#input-hp').val());
	/*分数*/
	settingValues['currentScore'] = parseInt($('#input-current-score').val());
	/*最高分*/
	settingValues['bestScore'] = parseInt($('#input-best-score').val());
	/*分数变动*/
	// settingValues['scoreChange'] = settingValues['currentScore'] - settingValues['bestScore'];
	/*曲绘*/
	// let il = $('#illustration').attr("src")
	// settingValues['illustration'] = il.substring(il.lastIndexOf('/') + 1, il.indexOf('.jpg'));
	settingValues['illustration'] = $('#input-illustration').val();
	// settingValues['hpBar'] //血条样式搁置
	/*pure数*/
	settingValues['pure'] = parseInt($('#input-pure-count').val());
	/*大P数*/
	settingValues['criticalPure'] = parseInt($('#input-critical-pure-count').val());
	// let pl = $('#far-detail').text();
	/*小P-late*/
	settingValues['pureLate'] = parseInt($('#input-pure-late').val());
	/*小P-early*/
	settingValues['pureEarly'] = parseInt($('#input-pure-early').val());
	/*far数*/
	settingValues['far'] = parseInt($('#input-far-count').val());
	/*far-late数*/
	settingValues['farLate'] = parseInt($('#input-far-late').val());
	/*far-early数*/
	settingValues['farEarly'] = parseInt($('#input-far-early').val());
	/*lost数*/
	settingValues['lost'] = parseInt($('#input-lost-count').val());
	/*结合物量判断FR*/
	// settingValues['grade'] = getGrade(settingValues['currentScore']);
	// let ch = $('#character').attr('src');
	/*搭档大图*/
	settingValues['character'] = $('#input-character').val();
	settingValues['clearType'] = getClearType(settingValues);
	settingValues['isRanked'] = $('#hash').is(":checked") ? 1 : 0;
	settingValues['rank'] = $('#world-rank').val();
	settingValues['isTrackLost'] = $('#track-lost').is(':checked') ? 1 : 0;
	if(localStorage.fakeResult!=undefined){
		settingValues['characterPosition'] = readLocalStorage().characterPosition;
	} else {
		settingValues['characterPosition'] = [30, 1330]
	}
	return settingValues;
}

function getAllValues() {
	let currentValues = {};
	/*用户名*/
	currentValues['username'] = $('#username-text').text();
	/*ID框*/
	let cb = $('#course-banner').attr('src')
	currentValues['frame'] = cb.substring(cb.lastIndexOf('/') + 1, cb.indexOf('.'));
	/*潜力值*/
	currentValues['potential'] = parseInt($('#potential-value-left').text()) + (parseInt($("#potential-value-right")
		.text()) * 0.01);
	/*残片数*/
	currentValues['fragment'] = parseInt($("#fragment-value").text());
	/*源点数*/
	currentValues['memory'] = parseInt($("#memory-value").text());
	/*曲名*/
	currentValues['songname'] = $('#song-name').text();
	/*曲师*/
	currentValues['artist'] = $('#artist').text();
	/*难度*/
	currentValues['difficulty'] = $("#difficulty").text();
	/*定数*/
	currentValues['constant'] = $('#plus-mark').css('display') != "none" ? ($("#constant").text() + '.9') : $(
		"#constant").text();
	/*连击数*/
	currentValues['maxrecall'] = parseInt($('#maxrecall').text());
	/*分数*/
	currentValues['currentScore'] = deformatScore($("#score-current").text());
	/*最高分*/
	currentValues['bestScore'] = deformatScore($("#score-personal-best").text());
	/*分数变动*/
	currentValues['scoreChange'] = currentValues['currentScore'] - currentValues['bestScore'];
	/*曲绘*/
	let il = $('#illustration').css("background-image");
	currentValues['illustration'] = il.substring(il.lastIndexOf('/') + 1, il.indexOf('.jpg'));
	// currentValues['hpBar'] //血条样式搁置
	/*pure数*/
	currentValues['pure'] = parseInt($('#pure-count').text());
	/*大P数*/
	currentValues['criticalPure'] = parseInt($('#c-pure-count').text());
	let pl = $('#far-detail').text();
	/*小P-late*/
	currentValues['pureLate'] = parseInt(pl.substring(pl.indexOf("(P") + 2, pl.indexOf(')')));
	/*小P-early*/
	currentValues['pureEarly'] = parseInt(pl.substring(pl.lastIndexOf("(P") + 2, pl.lastIndexOf(')')));
	/*far数*/
	currentValues['far'] = parseInt($('#far-count').text());
	/*far-late数*/
	currentValues['farLate'] = parseInt(pl.substring(pl.indexOf("L") + 1, pl.indexOf('(')));
	/*far-early数*/
	currentValues['farEarly'] = parseInt(pl.substring(pl.indexOf("E") + 1, pl.lastIndexOf('(')));
	/*lost数*/
	currentValues['lost'] = parseInt($('#lost-count').text());
	/*结合物量判断FR*/
	currentValues['grade'] = getGrade(currentValues['currentScore']);
	let ch = $('#character').attr('src');
	/*搭档大图*/
	currentValues['character'] = ch.substring(ch.lastIndexOf('/') + 1, ch.indexOf('.png'));
	/*血量*/
	currentValues['hp'] = parseInt($('#hp-value').text());
	/*结算等级*/
	let ct = $('#clear-type').attr('src');
	currentValues['clearType'] = ct.substring(ct.lastIndexOf('/') + 1, ct.indexOf('.png'));
	// console.log(currentValues)
	if(localStorage.fakeResult!=undefined){
		currentValues['characterPosition'] = readLocalStorage().characterPosition;
	} else {
		currentValues['characterPosition'] = [30, 1330]
	}
	return currentValues;
}

function getGrade(currentValues) {
	let score = currentValues['currentScore'];
	let pure = currentValues['pure']
	let far = currentValues['far'];
	let lost = currentValues['lost'];
	let grade = ['D', 'C', 'B', 'A', 'AA', 'EX', 'EX+', 'PM'];
	let s = [0, 8600000, 9200000, 9500000, 9800000, 9900000, 10000000, 20000000];
	for (i = 0; i < s.length; i++) {
		if (score < s[i]) {
			return grade[i];
		}
	}
	return "D";
}

function getClearType(values) {
	if (values['pure'] != 0 && values['far'] != 0 && values['lost'] == 0) {
		$('#score-current').css("text-shadow", "7px 7px 3px black");
		return "full";
	}
	if (values['pure'] != 0 && values['far'] == 0 && values['lost'] == 0 && values['hp'] != 0) {
		// console.log(values['pure'], values['criticalPure'])
		if(values['pure'] == values['criticalPure']){
			$('#score-current').css("text-shadow", "7px 7px 3px rgb(0 160 206 / 88%)");
			// console.log("max score")
		}
		return 'pure';
	}
	$('#score-current').css("text-shadow", "7px 7px 3px black");
	return 'normal';
}

function deformatScore(fscore) {
	return parseInt(fscore.replaceAll("'", ''));
}

function formatScore(score) {
	let fscore = ('00000000' + score);
	fscore = fscore.substring(fscore.length - 8);
	fscore = fscore.substring(0, 2) + "'" + fscore.substring(2, 5) + "'" + fscore.substring(5, 8);
	return fscore;
}

function switchDisplay(element) {
	let d = $(element).css("display");
	$(element).css("display", d == 'block' ? 'none' : 'block')
}

function applySettings(values) {
	// console.log(values)
	$('#username-text').text(values['username']);
	$('#course-banner').attr('src', "img/banner/" + values['frame'] + ".png")

	$('#potential-value-left').text(values['potential'].substring(0, values['potential'].indexOf('.') + 1));
	$('#potential-value-right').text(values['potential'].substring(values['potential'].indexOf('.') + 1, values[
			'potential']
		.length));
	/* console.log(values['potential'].substring(values['potential'].indexOf('.') + 1, values[
			'potential']
		.length)) */
	$('#fragment-value').text(values['fragment']);
	$('#memory-value').text(values['memory']);
	$('#song-name').text(values['songname']);
	$('#artist').text(values['artist']);
	// $('#difficulty').text(values['difficulty']);
	
	let difficultyText = $('#input-difficulty option').filter(function() {
		return $(this).val() == values['difficulty'];
	  }).text();
	  // console.log(values['difficulty'], difficultyText, difficultyTextColor[values['difficulty']])
	$('#difficulty').text(difficultyText).css('color', difficultyTextColor[values['difficulty']]);
	$('#constant').css('text-shadow', difficultyTextShadowPattern.replaceAll('COLOR', difficultyShadowColor[values['difficulty']]));
	$('#plus-mark').css('text-shadow', difficultyTextShadowPattern.replaceAll('COLOR', difficultyShadowColor[values['difficulty']]));
	$('#maxrecall-background').attr('src', 'img/layout/max-recall-' + difficultyText.toLowerCase() + '.png');
	$('#constant').text(parseInt(values['constant']));
	$('#plus-mark').css('display', (values['constant'] % 1).toFixed(1) >= 0.7 ? 'block' : 'none');
	$('#maxrecall').text(values['maxrecall']);
	$('#score-current').text(formatScore(values['currentScore']));
	$('#score-personal-best').text(formatScore(values['bestScore']));
	$('#score-differnce').text((((values['currentScore'] - values['bestScore']) >= 0 ? '+' : '-') + formatScore(Math
		.abs(values['currentScore'] - values['bestScore']))));
	if(values['currentScore'] - values['bestScore'] > 0){
		$('#score-panel-background').attr('src', 'img/layout/res_scoresection_high.png');
	} else if(values['currentScore'] - values['bestScore'] <= 0){
		$('#score-panel-background').attr('src', 'img/layout/res_scoresection.png');
	}
	$('#grade').attr('src', "img/grade/" + (getGrade(values) == 'PM' ? 'EX+' : getGrade(values)) + ".png");
	$('#pure-count').text(values['pure']);
	$('#far-count').text(values['far']);
	$('#lost-count').text(values['lost']);
	$('#pure-count').text(values['pure']);
	$('#c-pure-count').text(('+' + values['criticalPure']));
	$('#far-detail').text(
		`L${values['farLate']}(P${values['pureLate']}) E${values['farEarly']}(P${values['pureEarly']})`);
	$("#avatar-icon").attr('src', "img/avatar/" + values['character'] + "_icon.webp");
	$('#character').attr('src', "img/character/" + values['character'] + ".png");
	$('#illustration').css({
	    'background': `url(illustration/${values['illustration']}.jpg) center center / cover`
	});
	let clearType = getClearType(values);
	$('#clear-type').attr('src', 'img/clearType/clear_' + clearType + '.png');
	$('#hash-number').text(parseInt(values['rank']));
	if(values['isRanked'] && !$('#hash').is(":checked")){
		$('#rank').click();
	}
	$('#rank').val(values['rank']);
	if(values['isTrackLost'] && !$('#track-lost').is(":checked")){
		$('#track-lost').click();
	}
	adjustClearType(clearType);
	changePotentialFrame(parseFloat(values['potential']));
	adjustFragment(parseInt(values['fragment']));
	// adjustPotentialPosition();
	if(localStorage.fakeResult!=undefined){
		values['characterPosition'] = readLocalStorage().characterPosition;
	} else {
		values['characterPosition'] = [30, 1330]
	}
	saveLocalStorage(values);
}

function adjustFragment(fragment) {
	let stack = fragment / 10000 | 0;
	stack = stack > 2 ? 2 : stack;
	let overflow = fragment % 10000;
	$('#fragment-value').text(overflow)
	if (stack == 0 && overflow < 9999) {
		$('#fragment-background').attr('src', 'img/layout/frag_diamond_top.png')
		$('#fragment-overflow').attr('src', 'img/layout/white-trans.png')
	} else if (stack == 0 && overflow == 9999) {
		$('#fragment-background').attr('src', 'img/layout/frag_diamond_topplus.png')
		$('#fragment-overflow').attr('src', 'img/layout/white-trans.png')
	} else if (stack == 1 && overflow < 9999) {
		$('#fragment-background').attr('src', 'img/layout/frag_diamond_top.png')
		$('#fragment-overflow').attr('src', 'img/layout/fragstack-single.png')
	} else if (stack == 1 && overflow == 9999) {
		$('#fragment-background').attr('src', 'img/layout/frag_diamond_topplus.png')
		$('#fragment-overflow').attr('src', 'img/layout/fragstack-singleplus.png')
	} else if (stack == 2 && overflow < 9999) {
		$('#fragment-background').attr('src', 'img/layout/frag_diamond_top.png')
		$('#fragment-overflow').attr('src', 'img/layout/fragstack-double.png')
	} else if (stack == 2 && overflow == 9999) {
		$('#fragment-background').attr('src', 'img/layout/frag_diamond_topplus.png')
		$('#fragment-overflow').attr('src', 'img/layout/fragstack-doubleplus.png')
	}
}

function changePotentialFrame(potential) {
	const ranges = [3.49, 6.99, 9.99, 10.99, 11.99, 12.49, 12.99, 13.5];
	const frames = [0, 1, 2, 3, 4, 5, 6, 8];
	let idx = 0;
	// console.log(potential)
	for (let i = 0; i < ranges.length; i++) {
		if (potential <= ranges[i]) {
			idx = $('#potential-border').attr('src', 'img/rating/rating_' + frames[i] + '.png');
			break;
		}
	}
}

function adjustClearType(clearType) {
	if (clearType == "normal" || clearType == "fail") {
		$('#clear-type').css({
			"height": "135px",
			"top": "590px"
		})
	} else if (clearType == "pure" || clearType == "full") {
		$('#clear-type').css({
			"height": "180px",
			"top": "570px"
		})
	}
};

function showSettingValues(values) {
	$('#input-username').val(values['username']);
	$('#input-frame').val(values['frame']);
	$('#input-potential').val(values['potential']);
	$('#input-character').val(values['character']);
	$('#input-fragment').val(values['fragment']);
	$('#input-memory').val(values['memory']);
	$('#input-songname').val(values['songname']);
	$('#input-artist').val(values['artist']);
	$('#input-difficulty').val(values['difficulty']);
	$('#input-constant').val(values['constant']);
	$('#input-maxrecall').val(values['maxrecall']);
	$('#input-illustration').val(values['illustration']);
	$('#input-hp').val(values['hp']);
	$('#input-current-score').val(values['currentScore']);
	$('#input-best-score').val(values['bestScore']);
	$('#input-pure-count').val(values['pure']);
	$('#input-critical-pure-count').val(values['criticalPure']);
	$('#input-far-count').val(values['far']);
	$('#input-lost-count').val(values['lost']);
	$('#input-pure-late').val(values['pureLate']);
	$('#input-pure-early').val(values['pureEarly']);
	$('#input-far-late').val(values['farLate']);
	$('#input-far-early').val(values['farEarly']);
	if(values['isRanked'] && !$('#hash').is(":checked")){
		$('#rank').click();
	}
	$('#world-rank').val(values['rank']);
	if(values['isTrackLost'] && !$('#track-lost').is(":checked")){
		$('#track-lost').click();
	}
}

function adjustCharacterPosition(d) {
	let left = parseFloat(($('#character').css("left")).substring(0, ($('#character').css("left")).indexOf('px')));
	let top = parseFloat(($('#character').css("top")).substring(0, ($('#character').css("top")).indexOf('px')));
	if (d == 0) {
		$('#character').css("left", left - 10 + "px");
	} else if (d == 1) {
		$('#character').css("left", left + 10 + "px");
	} else if (d == 2) {
		$('#character').css("top", top - 10 + "px");
	} else if (d == 3) {
		$('#character').css("top", top + 10 + "px");
	}
	if(!localStorage.fakeResult){
		localStorage.setItem(fakeResult)
	}
	let ls = JSON.parse(localStorage.fakeResult);
	ls.characterPosition = [parseInt($('#character').css("top")), parseInt($('#character').css("left"))]
	saveLocalStorage(ls);
}


function adjustPotentialPosition(hashFlag){
	if(!hashFlag){
		$('#hash-mark').css("display", 'none');
		$('#hash-number').css("display", 'none');
		$("#fragment-text").css("display", 'block');
		$('#avatar-border').attr("src", 'img/topbar/char_icon_border.png').removeClass('character-border-hash').addClass('character-border');
		$('#potential-change').css("left", "50%");
	} else{
		$('#hash-mark').css("display", 'block');
		$('#hash-number').css("display", 'block');
		$("#fragment-text").css("display", 'none');
		$('#avatar-border').attr("src", 'img/topbar/usercell_shape_bg.png').removeClass('character-border').addClass('character-border-hash');
		$('#potential-change').css("left", "51.5%");
	}
}


async function compressImage(dataURL, quality) {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.onload = function() {
			const canvas = document.createElement('canvas');
			const ctx = canvas.getContext('2d');

			canvas.width = img.width;
			canvas.height = img.height;

			ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

			const compressedDataURL = canvas.toDataURL('image/jpeg', quality);

			resolve(compressedDataURL);
		};
		img.onerror = reject;
		img.src = dataURL;
	});
}


async function saveAsImage(captureId) {
	// resizeWidth(0);
	switchDisplay('#setting');
	const id = document.getElementById(captureId);
	const captureWidth = 3200;
	const captureHeight = 2000;
	html2canvas(id, {
		useCORS: true,
		width: captureWidth,
		height: captureHeight,
		scale: 1.2
	}).then(async canvas => {
		const dataURL = canvas.toDataURL('image/jpg');
		const compressedDataURL = await compressImage(dataURL, 0.6);
		// const compressedDataURL = dataURL;
		const link = document.createElement('a');
		link.href = compressedDataURL;
		link.download = 'FakeResult.jpg';
		const img = document.createElement('img');
		img.src = compressedDataURL;

		const newTab = window.open();
		newTab.document.body.appendChild(img);

		img.style.width = '100%';
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
		// resizeWidth(1);
		switchDisplay('#setting');
	});
}

// function insert(string) {
// 	let s = [];
// 	s = string.split('\t');
// 	$('#input-songname').val(s[0]);
// 	$('#input-artist').val(s[1]);
// 	$('#input-current-score').val(s[2]);
// 	$('#input-pure-count').val(s[3]);
// 	$('#input-critical-pure-count').val(s[4]);
// 	$('#input-far-count').val(s[5]);
// 	$('#input-lost-count').val(s[6]);
// 	$('#input-illustration').val(s[7]);
// 	$('#input-constant').val(s[8]);
// 	$('#input-maxrecall').val(parseInt(s[3]) + parseInt(s[5]));
// 	$('#input-best-score').val(parseInt(s[3]) + parseInt(s[5]) + parseInt(s[6]) + 10000000);
// 	$('#input-pure-early').val(parseInt(s[3]) - parseInt(s[4]));
// }

function saveLocalStorage(values) {
	let vls = JSON.stringify(values);
	localStorage.setItem("fakeResult", vls);
}

function readLocalStorage() {
	if (localStorage.getItem("fakeResult")) {
		let savedArray = JSON.parse(localStorage.getItem("fakeResult"));
		if (savedArray) {
			return savedArray;
		} else {
			return null;
		}
	}
}

async function readSongList(){
	try{
		const sl = await fetch('json/songlist');
		let slst = await sl.json();
		console.log(slst);
		songlist = slst.songs.sort(function(a,b){
			return resultSort(a, b, 'idx', -1)
		});
	} catch(error){
		console.log("failed loading songlist")
	}
}

function resultSort(a, b, attr, order) {
	if (a[attr] !== b[attr]) {
		return order * (b[attr] - a[attr]);
	}
	return 0;
}

async function generateSongListSelection(songlist){
	switchDisplay('#quick-select-options');
	if(quickSelectionGenerationFlag){
		return ;
	}
	let sls = $('#quick-select-options');
	songlist.forEach(function(song, index){
		if(index != 127){
			// console.log(song);
			let opt = $(`<li id="${song.id}" onclick="applyQuickSelection(songlist, ${index})">`).append($('<img>').attr('src', `Illustration/${song.id}.jpg`)).append($('<span>').text(Object.values(song.title_localized)[0]));
			sls.append(opt);
		}
	});
	quickSelectionGenerationFlag = true;
}

function applyQuickSelection(songlist, idx){
	let song = songlist[idx];
	$('#input-songname').val(songlist[idx].title_localized['en']);
	$('#input-artist').val(songlist[idx].artist);
	let difficulty = $('#input-difficulty').val();
	let difficultyText = $('#input-difficulty option').filter(function() {
		return $(this).val() == difficulty;
	  }).text();
	// difficultyText.toString();
	let constant = 9.9;
	song['difficulties'].forEach(function(dif){
		if(dif.ratingClass == difficulty){
			constant = dif.ratingPlus ? `${dif.rating + 0.7}` : dif.rating;
			if(dif.title_localized){
				$('#input-songname').val(dif.title_localized['en']);
			}
		}
	});
	// console.log(difficulty, difficultyText)
	$('#input-constant').val(constant);
	// let illustrationId = diffSongIllusMapper[song.id][difficultyText] != undefined ? song.id + diffSongIllusMapper[song.id][difficultyText] : song.id;
	let illustrationId = song.id;
	if (diffSongIllusMapper[song.id] && [song.id][difficultyText]){
		illustrationId = illustrationId + diffSongIllusMapper[song.id][difficultyText];
	}
	$('#input-illustration').val(illustrationId);
	applySettings(getSettingValues());
	$('#quick-select button').click();
	$('#current-selected-song img').attr('src', `Processed_Illustration/${illustrationId}.jpg`);
	$('#current-selected-song span').text(song.title_localized['en']);
	$('#current-selected-id').text(idx);
}


async function getImageMapping() {
	try {
		if (!diffSongIllusMapper) {
			const response = await fetch('json/Different_Illustration.json');
			diffSongIllusMapper = await response.json();
		}
		return diffSongIllusMapper;
	} catch (error) {
		console.error('Error loading image mapping:', error);
	}
}