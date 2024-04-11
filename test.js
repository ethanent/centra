const express = require('express')
const bodyParser = require('body-parser')
const { describe, test, before, after, afterEach } = require('node:test')
const assert = require('node:assert/strict')
const zlib = require('zlib')
const fs = require('fs')
const centra = require('./')

const app = express()

app.use(bodyParser.raw())
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({extended: false}))

app.get('/redirectRequireCookie', (req, res) => {
	if (req.header('Cookie') !== 'a=b') {
		res.status(401)
		res.send('Missing Cookie')
		return
	}
	res.redirect('http://localhost:8082/simpleGet')
})

app.get('/redirect2', (req, res) => {
	res.redirect('/redirect')
})

app.get('/redirect', (req, res) => {
	res.redirect('http://localhost:8082/simpleGet')
})

app.get('/simpleGet', (req, res) => {
	if (req.header("Cookie")) {
		res.status(401)
		res.send('Cookie header included')
		return
	}
	res.status(200)
	res.send('Hey')
})

app.post('/testJSON', (req, res) => {
	if (req.body.hey === 'hi' && req.header('content-type') === 'application/json') {
		res.status(200)
		res.send('Done')
	}
	else {
		res.status(400)
		res.send('Bad content ' + JSON.stringify(req.body))
	}
})

app.get('/json204', (req, res) => {
	res.status(204)
	res.end()
})

app.get('/stream', (req, res) => {
	res.sendFile(__filename)
})

app.get('/forever', (req, res) => {
	res.status(200)
	setInterval(() => {
		res.write('a')
	}, 1)
})

app.get('/compressed', (req, res) => {
	const encoding = req.query['encoding']

	if (encoding === 'gzip') {
		res.status(200)
		res.header('content-encoding', 'gzip')
		res.send(zlib.gzipSync(fs.readFileSync(__filename)))
	}
	else if (encoding === 'deflate') {
		res.status(200)
		res.header('content-encoding', 'deflate')
		res.send(zlib.deflateSync(fs.readFileSync(__filename)))
	}
	else if (encoding === 'br') {
		res.status(200)
		res.header('content-encoding', 'br')
		res.send(zlib.brotliCompressSync(fs.readFileSync(__filename)))
	}
})

app.post('/testForm', (req, res) => {
	if (req.body.hey === 'hi' && req.header('content-type') === 'application/x-www-form-urlencoded') {
		res.status(200)
		res.end()
		return
	}
	else {
		res.status(400)
		res.send('Missing form data. ' + JSON.stringify(req.body))
	}
})

app.get('/doNotResolve', (req, res) => {})

app.get('/updates', (req, res) => {
	if (req.query['hey'] === 'hello' && req.headers['hey'] === 'hello' && req.headers['test'] === 'testing') {
		res.status(200)
		res.end()
	}
	else {
		res.status(400)
		res.end()
	}
})

app.get('/testOptionChange', (req, res) => {
	res.status(200).end()
})

app.get('/abort', (req, res) => {
	res.write('partial')
	res.socket.destroy()
})

let servers = []

let failed = false

describe('Centra', () => {
	before(() => {
		servers.push(app.listen(8081, () => {
			servers.push(app.listen(8082))
		}))
	})

	after(() => {
		console.log('Closing servers...')
		servers.forEach((s) => {
			s.closeAllConnections()
			s.close()
		})
		console.log('Exit', process.exitCode)
		process.exit()
	})

	test('Simple GET', async (t) => {
		if (await (await centra('http://localhost:8081/simpleGet').send()).text() === 'Hey') {
			return
		}
		throw new Error('fail')
	})

	test('GET redirect', async (t) => {
		if (await (await centra('http://localhost:8081/redirect').followRedirects(5).send()).text() === 'Hey') {
			return
		}
		throw new Error('fail')
	})

	test('GET too many redirects', async (t) => {
		try {
			await centra('http://localhost:8081/redirect2').followRedirects(1).send()
		}
		catch (err) {
			t.diagnostic('Got error: ' + err)
			return
		}
		throw new Error('Missing error')
	})

	test('GET no redirect', async (t) => {
		const status = (await centra('http://localhost:8081/redirect').send()).statusCode
		if (status === 302) {
			return
		}
		throw new Error(status)
	})

	test('GET redirect with Cookie', async (t) => {
		const status = (await centra('http://localhost:8081/redirectRequireCookie').header('Cookie', 'a=b').header('hi', 'ok').followRedirects(2).send()).statusCode
		if (status === 200) {
			return
		}
		throw new Error(status)
	})

	test('Simple JSON POST', async (t) => {
		const res = await centra('http://localhost:8081/testJSON', 'POST').body({
			'hey': 'hi'
		}, 'json').send()

		if (res.statusCode === 200) {
			return
		}
		throw new Error(await res.text())
	})

	test('Simple form POST', async (t) => {
		const res = await centra('http://localhost:8081/testForm', 'POST').body({
			'hey': 'hi'
		}, 'form').send()

		if (res.statusCode === 200) {
			return
		}
		throw new Error(await res.text())
	})

	test('Request timeout', async (t) => {
		try {
			await centra('http://localhost:8081/doNotResolve').timeout(100).send()
		}
		catch (err) {
			t.diagnostic('Timeout error, as expected. ' + err)
			return
		}
		throw new Error('fail')
	})

	test('Update request info on the fly', async (t) => {
		const res = await centra('http://localhost:8081/test').path('../updates').query('hey', 'hello').header('hey', 'hello').header({
			'test': 'testing'
		}).send()

		if (res.statusCode === 200) {
			return
		}
		throw new Error(res.statusCode)
	})

	test('Multiple query and multiple header', async (t) => {
		const res = await centra('http://localhost:8081/updates').query({
			'hey': 'hello'
		}).header({
			'hey': 'hello',
			'test': 'testing'
		}).send()

		if (res.statusCode === 200) {
			return
		}
		throw new Error(res.statusCode)
	})

	test('Stream a response', async (t) => {
		const res = await centra('http://localhost:8081/stream').stream().send()

		return new Promise((resolve, reject) => {
			res.once('data', () => {
				resolve('Got data!')
			})
			res.on('error', (err) => {
				reject(err)
			})
		})
	})

	test('Edit core HTTP option', async (t) => {
		const res = await centra('http://localhost:8081').option('path', '/testOptionChange').send()

		if (res.statusCode === 200) {
			return
		}
		throw new Error(res.statusCode)
	})

	test('Brotli compression', async (t) => {
		const res = await centra('http://localhost:8081/compressed').query('encoding', 'br').compress().send()

		if ((await res.text()).includes('hj988SXACXhzxbh89899') && res.headers['content-encoding'] === 'br') {
			t.diagnostic('Processed ' + res.headers['content-encoding'] + ' compression.')
			return
		}
		throw new Error('fail')
	})

	test('Gzip compression', async (t) => {
		const res = await centra('http://localhost:8081/compressed').query('encoding', 'gzip').compress().send()

		if ((await res.text()).includes('hj9889ASXhzxbh89899') && res.headers['content-encoding'] === 'gzip') {
			t.diagnostic('Processed ' + res.headers['content-encoding'] + ' compression.')
			return
		}
		throw new Error('fail')
	})

	test('Deflate compression', async (t) => {
		const res = await centra('http://localhost:8081/compressed').query('encoding', 'deflate').compress().send()

		if ((await res.text()).includes('hj988SXACXhzxbh89899') && res.headers['content-encoding'] === 'deflate') {
			t.diagnostic('Processed ' + res.headers['content-encoding'] + ' compression.')
			return
		}
		throw new Error('fail')
	})

	test('Buffer data', async (t) => {
		const res = await centra('http://localhost:8081/testJSON', 'POST').header("Content-Type", "application/json").body(Buffer.from(JSON.stringify({
			'hey': 'hi'
		}))).send()

		if (res.statusCode === 200) {
			return
		}
		throw new Error(await res.text())
	})

	test('Error when too much data buffered', async (t) => {
		try {
			const req = centra('http://localhost:8081/forever')

			req.resOptions.maxBuffer = 100

			await req.send()
		}
		catch (err) {
			return
		}

		throw new Error('fail')
	})

	test('Empty JSON data parses to null', async (t) => {
		const res = await centra('http://localhost:8081/json204').body(Buffer.from(JSON.stringify({
			'hey': 'hi'
		}))).send()

		const parsed = await res.json()

		assert.equal(parsed, null)
	})
})
