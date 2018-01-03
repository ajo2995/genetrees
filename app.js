'use strict';

var SwaggerExpress = require('swagger-express-mw');
var pathToSwaggerUi = require('swagger-ui-dist').absolutePath();
var express = require('express');
var apicache = require('apicache');
var redis = require('redis');

var app = express();
var cache = apicache.options({redisClient: redis.createClient()}).middleware;
app.use(cache('1 hour'));

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
    res.redirect(basePath+'/docs?url='+basePath+'/swagger');
  });

  app.use(basePath+'/docs', express.static(pathToSwaggerUi));
  app.use(basePath+'/d3', express.static(__dirname + '/d3'));

  // install middleware
  swaggerExpress.register(app);

  var port = process.env.PORT || 10010;
  var server = app.listen(port);
  if (server) {
    console.log('tree service is listening on port '+port);
  }
});
