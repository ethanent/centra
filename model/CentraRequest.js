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
		this.headers = {
			'Host': this.url.host
		}
		this.streamEnabled = false
		this.timeoutTime = null

		return this
	}

	query (parameter, value) {
		this.url.searchParams.set(parameter, value)

		return this
	}

	path (path) {
		this.url.pathname = path

		return this
	}

	body (data, sendAs) {
		this.sendDataAs = typeof data === 'object' && !sendAs ? 'json' : (sendAs ? sendAs.toLowerCase() : 'raw')
		this.data = this.sendDataAs === 'form' ? qs.stringify(data) : (this.sendDataAs === 'json' ? JSON.stringify(data) : data)

		return this
	}

	header (header, value) {
		this.headers[header.toLowerCase()] = value

		return this
	}

	headers (headers) {
		Object.assign(this.headers, headers)

		return this
	}

	timeout (timeout) {
		this.timeoutTime = timeout

		return this
	}

	stream () {
		this.streamEnabled = true

		return this
	}

	send () {
		return new Promise((resolve, reject) => {
			if (this.data) {
				const lowerCaseHeaders = Object.keys(this.headers).map((headerName) => headerName.toLowerCase())

				if (this.sendDataAs === 'json' && !lowerCaseHeaders.includes('content-type')) {
					this.headers['Content-Type'] = 'application/json'
				}

				if (this.sendDataAs === 'form') {
					if (!lowerCaseHeaders.includes('content-type')) {
						this.headers['Content-Type'] = 'application/x-www-form-urlencoded'
					}

					if (!lowerCaseHeaders.includes('content-length')) {
						this.headers['Content-Length'] = Buffer.from(this.data).length
					}
				}
			}

			const options = {
				'protocol': this.url.protocol,
				'host': this.url.hostname,
				'port': this.url.port,
				'path': this.url.pathname + this.url.search,
				'method': this.method,
				'headers': this.headers,
				'setHost': false
			}

			if (this.localAddress) options.localAddress = this.localAddress

			const resHandler = (res) => {
				let centraRes

				if (this.streamEnabled) {
					centraRes = new CentraResponse(res, true)

					resolve(centraRes)

					res.on('data', (chunk) => {
						centraRes._addChunk(chunk)
					})

					res.on('error', (err) => {
						centraRes._error(err)
					})

					res.on('end', () => {
						centraRes._complete()
					})
				}
				else {
					centraRes = new CentraResponse(res, false)

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

				if (this.timeoutTime) {
					res.setTimeout(this.timeoutTime, () => {
						res.destroy()
						centraRes._timeoutReached()

						if (!this.streamEnabled) {
							reject(new Error('Timeout reached'))
						}
					})
				}
			}

			let req

			if (this.url.protocol === 'http:') {
				req = http.request(options, resHandler)
			}
			else if (this.url.protocol === 'https:') {
				req = https.request(options, resHandler)
			}
			else throw new Error('Bad URL protocol: ' + this.url.protocol)

			req.on('error', (err) => {
				reject(err)
			})

			if (this.data) req.write(this.data)

			req.end()
		})
	}
}