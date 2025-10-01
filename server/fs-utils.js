const fs = require('fs');
const path = require('path');

function ensureDirSync(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function saveBufferToFileSync(buffer, filePath) {
  ensureDirSync(path.dirname(filePath));
  fs.writeFileSync(filePath, buffer);
}

module.exports = {
  ensureDirSync,
  saveBufferToFileSync,
};
