const webServer = require('../isite')({ port: 55555, name: 'Private Proxy', apps: false, mongodb: { enabled: false }, require: { features: [] } });

var regex_hostport = /^([^:]+)(:([0-9]+))?$/;

var getHostPortFromString = function (hostString, defaultPort) {
  var host = hostString;
  var port = defaultPort;

  var result = regex_hostport.exec(hostString);
  if (result != null) {
    host = result[1];
    if (result[2] != null) {
      port = result[3];
    }
  }

  return [host, port];
};

webServer.on('ready', () => {
  webServer.server.addListener('connect', function (req, socket, bodyhead) {
    var hostPort = getHostPortFromString(req.url, 443);
    var hostDomain = hostPort[0];
    var port = parseInt(hostPort[1]);

    var proxySocket = new webServer.net.Socket();

    proxySocket.connect(port, hostDomain, function () {
      proxySocket.write(bodyhead);
      socket.write('HTTP/' + req.httpVersion + ' 200 Connection established\r\n\r\n');
    });

    proxySocket.on('connect', function () {
      // console.log('connected :: ' + hostDomain);
    });

    proxySocket.on('data', function (chunk) {
      socket.write(chunk);
    });

    proxySocket.on('end', function () {
      socket.end();
    });

    proxySocket.on('error', function () {
      socket.write('HTTP/' + req.httpVersion + ' 500 Connection error\r\n\r\n');
      socket.end();
    });

    socket.on('data', function (chunk) {
      proxySocket.write(chunk);
    });

    socket.on('end', function () {
      proxySocket.end();
    });

    socket.on('error', function () {
      proxySocket.end();
    });
  });
});

webServer.onGET('/trust', (req, res) => {
  console.log('trust : ' + req.url);
  res.end('Trusted ^_^');
});

let http_agent = new webServer.http.Agent({
  keepAlive: true,
});
let https_agent = new webServer.https.Agent({
  keepAlive: true,
});

webServer.onALL('*', (req, res) => {
  webServer
    .fetch(req.url, {
      method: req.method,
      headers: req.headers,
      body: req.method.like('*get*|*head*') ? null : req.bodyRaw,
      agent: function (_parsedURL) {
        if (_parsedURL.protocol == 'http:') {
          return http_agent;
        } else {
          return https_agent;
        }
      },
    })
    .then((response) => {
      response.body.pipe(res);
    })
    .catch((err) => console.log(err));
});
webServer.run();
