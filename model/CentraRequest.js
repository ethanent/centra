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

	query (a1, a2) {
		if (typeof a1 === 'object') {
			Object.keys(a1).forEach((queryKey) => {
				this.url.searchParams.set(queryKey, a1[queryKey])
			})
		}
		else this.url.searchParams.set(a1, a2)

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

	header (a1, a2) {
		if (typeof a1 === 'object') {
			Object.keys(a1).forEach((headerName) => {
				this.reqHeaders[headerName.toLowerCase()] = a1[headerName]
			})
		}
		else this.reqHeaders[a1.toLowerCase()] = a2

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
				if (this.sendDataAs === 'json' && !this.reqHeaders.hasOwnProperty('content-type')) {
					this.reqHeaders['Content-Type'] = 'application/json'
				}

				if (this.sendDataAs === 'form') {
					if (!this.reqHeaders.hasOwnProperty('content-type')) {
						this.reqHeaders['Content-Type'] = 'application/x-www-form-urlencoded'
					}

					if (!this.reqHeaders.hasOwnProperty('content-length')) {
						this.reqHeaders['Content-Length'] = Buffer.byteLength(this.data)
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