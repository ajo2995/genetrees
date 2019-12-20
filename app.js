'use strict';

var SwaggerExpress = require('swagger-express-mw');
var pathToSwaggerUi = require('swagger-ui-dist').absolutePath();
var express = require('express');
var apicache = require('apicache');
var redis = require('redis');
var cors = require('cors');
var fs = require('fs');
var https = require('https');

//var privateKey = fs.readFileSync( '/etc/ssl/private/apache-selfsigned.key' );
//var certificate = fs.readFileSync( '/etc/ssl/certs/apache-selfsigned.crt' );

//var sslOptions = {
//    key: privateKey,
//    cert: certificate
//};

var app = express();
var cache = apicache.options({redisClient: redis.createClient()}).middleware;
app.use(cache('1 hour'));
app.use(cors());

module.exports = app; // for testing

var config = {
  appRoot: __dirname // required config
};

SwaggerExpress.create(config, function(err, swaggerExpress) {
  if (err) { throw err; }

  var basePath = swaggerExpress.runner.swagger.basePath;

  app.get('/', function(req, res) {
    res.redirect(basePath)
  });

  app.get(basePath, function(req, res) {
    res.redirect(basePath+'/docs?url=https://www.genetrees.org'+basePath+'/swagger');
  });

  app.use(basePath+'/docs', express.static(pathToSwaggerUi));
  app.use(basePath+'/d3', express.static(__dirname + '/d3'));

  // install middleware
  swaggerExpress.register(app);

  var port = process.env.PORT || 10010;
  var server = app.listen(port);
  if (server) {
    console.log('tree service is listening on port '+port);
//    port++;
//    var sslServer = https.createServer(sslOptions, app).listen(port, function() {
//      console.log("ssl erver listening on port " + port);
//    });
  }
});
