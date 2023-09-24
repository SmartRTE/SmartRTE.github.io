function savePageAsImage() {
  const container = document.getElementById("container"); // Replace with your container's ID
  const saveButton = document.getElementById("saveButton");

  // Disable the button while processing
  saveButton.disabled = true;

  html2canvas(container).then(canvas => {
    // Convert the canvas to a data URL
    const dataURL = canvas.toDataURL("image/png");

    // Create a link element and set its attributes
    const link = document.createElement("a");
    link.href = dataURL;
    link.download = "page_snapshot.png";
    link.textContent = "Download Image";

    // Append the link to the document and simulate a click
    document.body.appendChild(link);
    link.click();

    // Remove the link element
    document.body.removeChild(link);

    // Re-enable the button
    saveButton.disabled = false;
  });
}

document.getElementById("saveButton").addEventListener("click", savePageAsImage);
