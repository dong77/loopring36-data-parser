const fs = require('fs')

async function writeJsonFile(directory, blockIdx, data) {
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory)
  }

  const str = JSON.stringify(data, null, 4)

  fs.writeFile(directory + '/' + blockIdx + '.json', str, function (err) {
    if (err) {
      console.log(err)
    }
  })
}

async function writeTxtFile(directory, filename, str) {
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory)
  }

  fs.writeFile(directory + '/' + filename, str, function (err) {
    if (err) {
      console.log(err)
    }
  })
}

export { writeTxtFile, writeJsonFile }
