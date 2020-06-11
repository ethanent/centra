const R = require('retra')
const w = require('whew')
const zlib = require('zlib')
const fs = require('fs')
const centra = require('./')
const qs = require('querystring')

const app = new R()

app.add('GET', '/simpleGet', (req, res) => {
	res.status(200).body('Hey').end()
})

app.add('POST', '/testJSON', (req, res) => {
	let parsed

	try {
		parsed = JSON.parse(req.body)
	}
	catch (err) {
		res.status(400).body('Bad request body').end()
		return
	}

	if (parsed.hey === 'hi') {
		res.status(200).body('Done').end()
	}
	else {
		res.status(400).body('Bad content').end()
	}
})

app.add('GET', '/json204', (req, res) => {
	res.status(204).end()
})

app.add('GET', '/stream', (req, res) => {
	fs.createReadStream(__filename).pipe(res.coreRes)
})

app.add('GET', '/forever', (req, res) => {
	res.res.writeHead(200)

	let sentBytes = 0
	const bigBuf = Buffer.from('HELLO THERE!'.repeat(100))

	setInterval(() => {
		res.res.write(bigBuf)
		sentBytes += bigBuf.length
	}, 1)
})

app.add('GET', '/compressed', (req, res) => {
	const encoding = req.query('encoding')

	if (encoding === 'gzip') {
		res.status(200).header('content-encoding', 'gzip').body(zlib.gzipSync(fs.readFileSync(__filename))).end()
	}
	else if (encoding === 'deflate') {
		res.status(200).header('content-encoding', 'deflate').body(zlib.deflateSync(fs.readFileSync(__filename))).end()
	}
})

app.add('POST', '/testForm', (req, res) => {
	const parsed = qs.parse(req.body.toString())

	if (parsed.hey === 'hi') {
		res.status(200).end()
	}
	else {
		res.status(400).body('Missing form data.').end()
	}
})

app.add('GET', '/doNotResolve', (req, res) => {})

app.add('GET', '/updates', (req, res) => {
	if (req.query('hey') === 'hello' && req.headers['hey'] === 'hello' && req.headers['test'] === 'testing') {
		res.status(200).end()
	}
	else {
		res.status(400).end()
	}
})

app.add('GET', '/testOptionChange', (req, res) => {
	res.status(200).end()
})

app.add((req, res) => {
	res.status(404).end('404: Not found!')
})

w.add('Simple GET', async (result) => {
	if (await (await centra('http://localhost:8081/simpleGet').send()).text() === 'Hey') {
		result(true)
	}
	else result(false)
})

w.add('Simple JSON POST', async (result) => {
	const res = await centra('http://localhost:8081/testJSON', 'POST').body({
		'hey': 'hi'
	}, 'json').send()

	if (res.statusCode === 200) {
		result(true)
	}
	else result(false, await res.text())
})

w.add('Simple form POST', async (result) => {
	const res = await centra('http://localhost:8081/testForm', 'POST').body({
		'hey': 'hi'
	}, 'form').send()

	if (res.statusCode === 200) {
		result(true)
	}
	else result(false, await res.text())
})

w.add('Request timeout', async (result) => {
	try {
		await centra('http://localhost:8081/doNotResolve').timeout(100).send()
	}
	catch (err) {
		result(true, 'Timeout error, as expected. ' + err)
	}
})

w.add('Update request info on the fly', async (result) => {
	const res = await centra('http://localhost:8081/test').path('../updates').query('hey', 'hello').header('hey', 'hello').header({
		'test': 'testing'
	}).send()

	if (res.statusCode === 200) {
		result(true)
	}
	else result(false, res.statusCode)
})

w.add('Multiple query and multiple header', async (result) => {
	const res = await centra('http://localhost:8081/updates').query({
		'hey': 'hello'
	}).header({
		'hey': 'hello',
		'test': 'testing'
	}).send()

	if (res.statusCode === 200) {
		result(true)
	}
	else result(false, res.statusCode)
})

w.add('Stream a response', async (result) => {
	const res = await centra('http://localhost:8081/stream').stream().send()

	res.once('data', () => {
		result(true, 'Got data!')
	})

	res.on('error', (err) => {
		result(false, err)
	})
})

w.add('Edit core HTTP option', async (result) => {
	const res = await centra('http://localhost:8081').option('path', '/testOptionChange').send()

	if (res.statusCode === 200) {
		result(true)
	}
	else result(false, res.statusCode)
})

w.add('Gzip compression', async (result) => {
	const res = await centra('http://localhost:8081/compressed').query('encoding', 'gzip').compress().send()

	if ((await res.text()).includes('hj9889ASXhzxbh89899') && res.headers['content-encoding'] === 'gzip') {
		result(true, 'Processed ' + res.headers['content-encoding'] + ' compression.')
	}
	else result(false)
})

w.add('Deflate compression', async (result) => {
	const res = await centra('http://localhost:8081/compressed').query('encoding', 'deflate').compress().send()

	if ((await res.text()).includes('hj988SXACXhzxbh89899') && res.headers['content-encoding'] === 'deflate') {
		result(true, 'Processed ' + res.headers['content-encoding'] + ' compression.')
	}
	else result(false)
})

w.add('Buffer data', async (result) => {
	const res = await centra('http://localhost:8081/testJSON', 'POST').body(Buffer.from(JSON.stringify({
		'hey': 'hi'
	}))).send()

	if (res.statusCode === 200) {
		result(true)
	}
	else result(false, await res.text())
})

w.add('Error when too much data buffered', async (result) => {
	try {
		const req = centra('http://localhost:8081/forever')

		req.resOptions.maxBuffer = 5000

		await req.send()
	}
	catch (err) {
		result(true)

		return
	}

	result(false)
})

w.add('Empty JSON data parses to null', async (result) => {
	const res = await centra('http://localhost:8081/json204').body(Buffer.from(JSON.stringify({
		'hey': 'hi'
	}))).send()

	const parsed = await res.json()

	if (parsed === null) {
		result(true)
	}
	else {
		result(false, 'Did not parse to null')
	}
})

app.listen(8081, w.test)