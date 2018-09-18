<p align="center" style="text-align: center;"><img src="https://github.com/ethanent/centra/blob/master/media/centraLogo.png?raw=true" width="400"/></p>

> The powerful and awesome HTTP client for Node

[GitHub](https://github.com/ethanent/centra) | [NPM](https://npmjs.com/package/centra)

## Install

```shell
npm i centra
```

## Use centra!

First, require the library.

```js
const c = require('centra')
```

Then let's make a request in an async function!

```js
;(async () => {
	const res = await c('https://ethanent.me').send()

	console.log(await res.text())
})()
```

## More advanced usage

### Send data in a JSON body

```js
c('https://example.com/nonexistentJSONAPI', 'POST').body({
	'name': 'Ethan'
}, 'json').send().then((res) => {
	/*...*/
})
```

### Send data in a form body

```js
c('https://example.com/nonexistentJSONAPI', 'POST').body({
	'name': 'Ethan'
}, 'form').send().then((res) => {
	/*...*/
})
```

### Set query string parameters

```js
c('https://example.com/user').query('id', 'u1817760').send().then((res) => {
	/*...*/
})
```

### Set a request timeout

```js
c('https://ethanent.me').timeout(2000).send().then((res) => {
	// Success!
}).catch((err) => {
	// Has the request timed out?
})
```

### Stream a request's response

In this example, the [stream](https://nodejs.org/api/stream.html) is piped to a file:

```js
// require the fs module beforehand

c('https://ethanent.me/images/mainLogo.png').stream().send().then((stream) => stream.pipe(fs.createWriteStream(path.join(__dirname, 'logo.png'))))
```

### Switch paths on the fly

```js
c('https://ethanent.me/test').path('/hello').send()

// This will make a request to https://ethanent.me/test/hello
```

### Specify request headers

One at a time:

```js
c('https://ethanent.me').header('Content-Type', 'application/json').send()
```

Many at a time:

```js
c('https://ethanent.me').headers({
	'Content-Type': 'application/json'
}).send()
```

### Modify core HTTP request options

See [http.request](https://nodejs.org/dist/latest-v10.x/docs/api/http.html#http_http_request_url_options_callback)'s options for more information about core HTTP request options.
Let's change our localAddress as an example.

```js
c('https://ethanent.me').option('localAddress', '127.0.0.2').send()
```