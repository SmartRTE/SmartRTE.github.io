let illustrationPath = 'Processed_Illustration/';
let currentArray = [];

$(document).ready(function(){
	currentArray = readLocalStorage();
})

function appendUnit(currentRow, index){
	let unit = $(`<div class="cell-unit">`);
	let ui = $(`<div class="unit-ill">`).append($(`<img>`).attr('src', `${illustrationPath}${currentRow.illustration}`))
	let ur = $(`<img class="unit-ranking">`).attr('src', getSongRanking(currentRow.score, currentRow.far, currentRow.lost))
	let un = $(`<div class="unit-name">`).text(currentRow.songName)
	let us = $(`<div class="unit-score">`).text(currentRow.score)
	unit.append(ui)
	unit.append(ur)
	unit.append(un)
	unit.append(us);
	// return unit;
	console.log(`#cells-${index}`)
	console.log($(`#cells-${index}`))
	console.log(unit)
	$('#cells-'+index).append(unit);
}
