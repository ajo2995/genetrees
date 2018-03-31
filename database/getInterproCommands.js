#!/usr/bin/env node
var argv = require('minimist')(process.argv.slice(2));

var grm = argv.g;
var ens = argv.e;
var port = argv.t || 3306;
var pass = argv.p ? `-p ${argv.p}` : '';

// connect to mysql database
var mysql = require('mysql');
var connection = mysql.createConnection({
  host: argv.h,
  user: argv.u,
  password: argv.p || '',
  port: port,
  database: 'information_schema'
});

if (!connection) throw "error";
connection.connect();

var sql = 'select SCHEMA_NAME from SCHEMATA where SCHEMA_NAME like "%_core_';
if (grm) {
  sql += `${grm}_`;
}
if (ens) {
  sql += `${ens}_`;
}
sql += '%"';
connection.query(sql, function(err, rows, fields) {
  if (err) throw err;
  var cores = [];
  rows.forEach(function(row) {
    cores.push({
      host: argv.h,
      port: port,
      user: argv.u,
      password: pass,
      database: row.SCHEMA_NAME
    });
    console.log(`echo "${row.SCHEMA_NAME}"`);
    console.log(`node --max-old-space-size=8192 loadInterpro.js -h ${argv.h} -u ${argv.u} ${pass} -d ${row.SCHEMA_NAME} -t ${port} | redis-cli --pipe`);
  });
  // console.log(JSON.stringify(cores, null, ' '));
  connection.end();
});
