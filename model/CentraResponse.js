const EventEmitter = require('events')

module.exports = class CentraResponse extends EventEmitter {
	constructor (res, stream) {
		super()

		this.res = res
		this.body = Buffer.alloc(0)

		this.headers = res.headers
		this.statusCode = res.statusCode

		this.stream = stream
	}

	_addChunk (chunk) {
		this.body = Buffer.concat([this.body, chunk])

		if (this.stream) {
			this.emit('data', chunk)
		}
	}

	_timeoutReached () {
		if (this.stream) {
			this.emit('error', new Error('Timeout reached'))
		}
	}

	_error (err) {
		if (this.stream) {
			this.emit('error', err)
		}
	}

	_complete () {
		if (this.stream) {
			this.emit('end')
		}
	}

	async json () {
		return JSON.parse(this.body)
	}

	async text () {
		return this.body.toString()
	}
}