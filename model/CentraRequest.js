const path = require('path')
const http = require('http')
const https = require('https')
const qs = require('querystring')
const {URL} = require('url')

const CentraResponse = require(path.join(__dirname, 'CentraResponse.js'))

module.exports = class CentraRequest {
	/*
	* Create a CentraRequest
	* @param url
	* @param [method=GET]
	* @constructor
	*/
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

	/*
	* Set a querystring property in the request
	* @param parameter
	* @param value
	*/
	query (parameter, value) {
		this.url.searchParams.set(parameter, value)

		return this
	}

	/*
	* Set the request path
	* @param {String} path
	*/
	path (path) {
		this.url.pathname = path

		return this
	}

	/*
	* Set the request body and sending medium
	* @param {Buffer|String|Object} data
	* @param {String} sendAs - 'json', 'raw' are valid options
	*/
	body (data, sendAs) {
		this.data = data
		this.sendDataAs = typeof data === 'object' && !sendAs ? 'json' : (sendAs ? sendAs.toLowerCase() : 'raw')

		return this
	}

	/*
	* Set a single header
	* @param {String} header
	* @param {String} value
	*/
	header (header, value) {
		this.headers[header] = value

		return this
	}

	/*
	* Update request headers
	* @param {Object} headers
	*/
	headers (headers) {
		Object.assign(this.headers, headers)

		return this
	}

	/*
	* Set a timeout time for the request
	*/
	timeout (timeout) {
		this.timeoutTime = timeout

		return this
	}

	/*
	* Enable streaming of response. Causes the CentraResponse provided after sending to emit 'data', 'error', and 'end' events appropriately
	*/
	stream () {
		this.streamEnabled = true

		return this
	}

	/*
	* Make the request with all defined settings
	* @async
	* @return {Promise<CentraResponse>}
	*/
	send () {
		return new Promise((resolve, reject) => {
			const options = {
				'protocol': this.url.protocol,
				'host': this.url.host,
				'port': this.url.port,
				'path': this.url.pathname + this.url.search,
				'method': this.method,
				'headers': this.headers,
				'setHost': false
			}

			console.log(options)

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

			if (this.data) {
				if (this.sendDataAs === 'raw') {
					req.write(this.data)
				}
				else if (this.sendDataAs === 'json') {
					req.write(JSON.stringify(this.data))
				}
				else if (this.sendDataAs === 'form') {
					req.write(qs.stringify(this.data))
				}
			}

			req.end()
		})
	}
}