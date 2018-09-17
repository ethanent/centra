const V = require('vaxic')
const w = require('whew')
const centra = require('./')
const qs = require('querystring')

const app = new V()

app.add('GET', '/simpleGet', (req, res) => {
	res.writeHead(200)
	res.end('Hey')
})

app.add('POST', '/testJSON', (req, res) => {
	let parsed

	try {
		parsed = JSON.parse(req.body)
	}
	catch (err) {
		res.writeHead(400)
		res.end('Bad request body')
		return
	}

	if (parsed.hey === 'hi') {
		res.writeHead(200)
		res.end('Done')
	}
	else {
		res.writeHead(400)
		res.end('Bad content')
	}
})

app.add('POST', '/testForm', (req, res) => {
	const parsed = qs.parse(req.body.toString())

	if (parsed.hey === 'hi') {
		res.writeHead(200)
		res.end()
	}
	else {
		res.writeHead(400)
		res.end('Missing form data.')
	}
})

app.add('GET', '/doNotResolve', (req, res) => {
	
})

app.add('GET', '/updates', (req, res) => {
	if (req.url.path === '/updates?hey=hello' && req.headers['hey'] === 'hello' && req.headers['test'] === 'testing') {
		res.writeHead(200)
		res.end()
	}
	else {
		res.writeHead(400)
		res.end()
	}
})

app.add((req, res) => {
	res.writeHead(404)
	res.end('404: Not found!')
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
	const res = await centra('http://localhost:8081').path('/updates').query('hey', 'hello').header('hey', 'hello').headers({
		'test': 'testing'
	}).send()

	if (res.statusCode === 200) {
		result(true)
	}
	else result(false, res.statusCode)
})

app.listen(8081, w.test)