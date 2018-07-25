#!/usr/bin/env node
var argv = require('minimist')(process.argv.slice(2));
var Q = require('q');

function getRedis(db) {
  var deferred = Q.defer();
  var client = require('redis').createClient();
  client.select(db, function(err) {
    if (err) throw err;
    console.error('redis connection established');
    deferred.resolve(client);
  });
  return deferred.promise;
}
var redisPromise = getRedis(2);

mysql = require('mysql');
connection = mysql.createConnection({
  database: argv.d,
  user: argv.u,
  password: argv.p,
  host: argv.h,
  port: argv.t
});
if (!connection) throw "error connecting to database";
connection.connect();

function redisify() {
  var red = [];
  red.push('*'+arguments.length);
  Array.prototype.slice.call(arguments).forEach(function(a) {
    red.push('$'+a.length,a);
  });
  return red.join("\r\n") + "\r";
}

var sql = 'select g.stable_id, x.dbprimary_acc'
 + ' from gene g, object_xref ox, xref x, external_db ed'
 + ' where ed.db_name = "EntrezGene"'
 + ' and ed.external_db_id = x.external_db_id'
 + ' and x.xref_id = ox.xref_id'
 + ' and ox.ensembl_object_type = "Gene"'
 + ' and ox.ensembl_id = g.gene_id';

connection.query(sql, function(err, rows) {
  if (err) {
    throw err;
  }
  console.log(redisify('SELECT','3'));
  // another script (geneRIFs.js) loads the geneRIFs into redis
  redisPromise.then(function(client) {
    var todo = rows.length;
    if (todo === 0) {
      client.quit();
    }
    rows.forEach(function(row) {
      var ensemblGene = row.stable_id;
      var entrezGene = row.dbprimary_acc;
      client.get(entrezGene, function (err, geneRIF) {
        todo--;
        if (err) {
          throw err;
        }
        if (geneRIF) {
          console.log(redisify('SET',ensemblGene,geneRIF));
        }
        if (todo === 0) {
          client.quit();
        }
      });
    });
  });
  connection.end(function() {
    console.error('closed mysql connection');
  });
});
