#!/usr/bin/env node
var argv = require('minimist')(process.argv.slice(2));

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

var sql = 'select tl.stable_id, pf.seq_start, pf.seq_end, pf.hit_start, pf.hit_end, pf.hit_name, a.logic_name,ipr.interpro_ac'
 + ' from interpro ipr, protein_feature pf, translation tl, analysis a'
 + ' where ipr.id = pf.hit_name and pf.translation_id = tl.translation_id and a.analysis_id = pf.analysis_id'
 + ' order by tl.stable_id, ipr.interpro_ac;';

connection.query(sql, function(err, rows) {
  var annotations = {};
  rows.forEach(function(row) {
    var key = row.stable_id;
    var hit = {
      id: row.interpro_ac,
      hitName: row.hit_name,
      hitDb: row.logic_name,
      start: row.seq_start,
      end: row.seq_end,
    }
    if (!annotations.hasOwnProperty(key)) {
      annotations[key] = [];
    }
    annotations[key].push(hit);
  });
  connection.end(function() {
    console.error('closed mysql connection');
  });
  console.log(redisify('SELECT','1'));
  for (var id in annotations) {
    console.log(redisify('SET',id,JSON.stringify(annotations[id])));
  }
});
