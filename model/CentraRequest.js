const path = require('path')
const http = require('http')
const https = require('https')
const qs = require('querystring')
const {URL} = require('url')

const CentraResponse = require(path.join(__dirname, 'CentraResponse.js'))

module.exports = class CentraRequest {
	constructor (url, method = 'GET') {
		this.url = typeof url === 'string' ? new URL(url) : url
		this.method = method
		this.data = null
		this.sendDataAs = null
		this.reqHeaders = {}
		this.streamEnabled = false
		this.timeoutTime = null
		this.coreOptions = {}

		return this
	}

	query (parameter, value) {
		this.url.searchParams.set(parameter, value)

		return this
	}

	path (relativePath) {
		this.url.pathname = path.join(this.url.pathname, relativePath)

		return this
	}

	body (data, sendAs) {
		this.sendDataAs = typeof data === 'object' && !sendAs ? 'json' : (sendAs ? sendAs.toLowerCase() : 'raw')
		this.data = this.sendDataAs === 'form' ? qs.stringify(data) : (this.sendDataAs === 'json' ? JSON.stringify(data) : data)

		return this
	}

	header (header, value) {
		if (typeof header === 'object') throw new Error('Got object instead of header name. Maybe you\'re after CentraRequest.headers(name, value).')

		this.reqHeaders[header.toLowerCase()] = value

		return this
	}

	headers (headers) {
		Object.assign(this.reqHeaders, headers)

		return this
	}

	timeout (timeout) {
		this.timeoutTime = 100

		return this
	}

	option (name, value) {
		this.coreOptions[name] = value

		return this
	}

	stream () {
		this.streamEnabled = true

		return this
	}

	send () {
		return new Promise((resolve, reject) => {
			if (this.data) {
				const lowerCaseHeaders = Object.keys(this.reqHeaders).map((headerName) => headerName.toLowerCase())

				if (this.sendDataAs === 'json' && !lowerCaseHeaders.includes('content-type')) {
					this.reqHeaders['Content-Type'] = 'application/json'
				}

				if (this.sendDataAs === 'form') {
					if (!lowerCaseHeaders.includes('content-type')) {
						this.reqHeaders['Content-Type'] = 'application/x-www-form-urlencoded'
					}

					if (!lowerCaseHeaders.includes('content-length')) {
						this.reqHeaders['Content-Length'] = Buffer.from(this.data).length
					}
				}
			}

			const options = Object.assign({
				'protocol': this.url.protocol,
				'host': this.url.hostname,
				'port': this.url.port,
				'path': this.url.pathname + this.url.search,
				'method': this.method,
				'headers': this.reqHeaders,
				'setHost': true
			}, this.coreOptions)

			let req

			const resHandler = (res) => {
				let centraRes

				if (this.streamEnabled) {
					resolve(res)
				}
				else {
					centraRes = new CentraResponse(res)

					res.on('data', (chunk) => {
						centraRes._addChunk(chunk)
					})

					res.on('error', (err) => {
						reject(err)
					})

					res.on('end', () => {
						resolve(centraRes)
					})
				}
			}

			if (this.url.protocol === 'http:') {
				req = http.request(options, resHandler)
			}
			else if (this.url.protocol === 'https:') {
				req = https.request(options, resHandler)
			}
			else throw new Error('Bad URL protocol: ' + this.url.protocol)

			if (this.timeoutTime) {
				req.setTimeout(this.timeoutTime, () => {
					req.abort()

					if (!this.streamEnabled) {
						reject(new Error('Timeout reached'))
					}
				})
			}

			req.on('error', (err) => {
				reject(err)
			})

			if (this.data) req.write(this.data)

			req.end()
		})
	}
}