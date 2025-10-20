const http = require("http");

const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/html" });
  res.end("<h1>Hello World!</h1>Dies ist ein Beispiel!");
});

const port = 8006; // Bitte bei anderen Webanwendungen hochzählen.
server.listen(port, () => {
  console.log(`Server läuft auf http://localhost:${port}/`);
});
