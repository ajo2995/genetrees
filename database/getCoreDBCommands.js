#!/usr/bin/env node
var argv = require('minimist')(process.argv.slice(2));

var host = argv.h;
var user = argv.u;
var grm = argv.g;
var ens = argv.e;
var port = argv.t || 3306;
var pass = argv.p ? `-p ${argv.p}` : '';
var script = argv.s ? argv.s : 'loadInterpro.js';

// connect to mysql database
var mysql = require('mysql');
var connection = mysql.createConnection({
  host: host,
  user: user,
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
console.error("sql",sql);
connection.query(sql, function(err, rows, fields) {
  if (err) throw err;
  var cores = [];
  rows.forEach(function(row) {
    cores.push({
      host: host,
      port: port,
      user: user,
      password: pass,
      database: row.SCHEMA_NAME
    });
    console.log(`echo "${row.SCHEMA_NAME}"`);
    console.log(`node --max-old-space-size=8192 ${script} -h ${host} -u ${user} ${pass} -d ${row.SCHEMA_NAME} -t ${port} | redis-cli --pipe`);
  });
  connection.end();
});
