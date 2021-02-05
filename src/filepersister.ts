const fs = require('fs')

function writeJsonFile(directory, blockIdx, data) {
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

export default writeJsonFile
