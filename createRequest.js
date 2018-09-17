const path = require('path')

const CentraRequest = require(path.join(__dirname, 'model', 'CentraRequest.js'))

module.exports = (url, method) => {
	return new CentraRequest(url, method)
}