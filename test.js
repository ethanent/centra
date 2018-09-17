const centra = require('./')

;(async () => {
	let res = await centra('https://jsonplaceholder.typicode.com', 'GET').path('/posts/42').query('hey', 'hi there').stream().send()

	console.log('Got res')

	res.on('end', () => {
		console.log('Stream done. ' + res.text())
	})
})()