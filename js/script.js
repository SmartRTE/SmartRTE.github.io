document.getElementById('upload-button').addEventListener('click', function() {
  var fileInput = document.getElementById('file-input');
  var selectedFile = fileInput.files[0];

  if (selectedFile) {
    var reader = new FileReader();

    reader.onload = function(event) {
      var dbContentArrayBuffer = event.target.result;
      // 在这里继续处理数据库内容
    };

    reader.readAsArrayBuffer(selectedFile);
  }
});
var db = new SQL.Database();
db = new SQL.Database(dbContentArrayBuffer);
var selectQuery = "SELECT * FROM users";
var result = db.exec(selectQuery);
console.log(result[0].values); // 打印查询结果
db.close();
