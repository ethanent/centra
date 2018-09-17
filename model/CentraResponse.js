const EventEmitter = require('events')

module.exports = class CentraResponse extends EventEmitter {
	/*
	* Create a CentraResponse
	* @param {http.ServerResponse} res
	* @param {boolean} res
	* @private
	* @constructor
	*/
	constructor (res, stream) {
		super()

		this.res = res
		this.body = Buffer.alloc(0)

		this.headers = res.headers
		this.statusCode = res.statusCode

		this.stream = stream
	}

	/*
	* Append data to a CentraResponse
	* @param {Buffer} chunk
	* @private
	*/
	_addChunk (chunk) {
		this.body = Buffer.concat([this.body, chunk])

		if (this.stream) {
			this.emit('data', chunk)
		}
	}

	/*
	* Instruct a CentraResponse that its request's timeout has been reached
	* @private
	*/
	_timeoutReached () {
		if (this.stream) {
			this.emit('error', new Error('Timeout reached'))
		}
	}

	/*
	* Instruct CentraResponse that an error has occurred
	* @param {Error} error
	* @private
	*/
	_error (err) {
		if (this.stream) {
			this.emit('error', err)
		}
	}

	/*
	* Instruct CentraResponse that its request has completed
	* @param {Error} error
	* @private
	*/
	_complete () {
		if (this.stream) {
			this.emit('end')
		}
	}

	/*
	* Parse a response body as JSON
	* @async
	* @return {Promise<Object>}
	*/
	async json () {
		return JSON.parse(this.body)
	}

	/*
	* Parse a response body as text
	* @async
	* @return {String}
	*/
	async text () {
		return this.body.toString()
	}
}