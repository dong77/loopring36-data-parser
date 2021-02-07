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

async function writeTxtFile(directory, blockIdx, str) {
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory)
  }

  fs.writeFile(directory + '/' + blockIdx + '.txt', str, function (err) {
    if (err) {
      console.log(err)
    }
  })
}

export { writeTxtFile, writeJsonFile }
