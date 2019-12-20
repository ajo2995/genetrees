#!/usr/bin/env node
// script to extract genome assembly info from an ensembl core db and shove it into a redis key value store
// the key is the the assembly id, value is JSON that looks like this:
/*
{
  "system_name": "arabidopsis_thaliana",
  "num_genes": 32833,
  "length": 119667750,
  "regions": {
    "names": [ "1", "2", "3", "4", "5", "Mt", "Pt" ],
    "lengths": [
      30427671,
      19698289,
      23459830,
      18585056,
      26975502,
      366924,
      154478
    ]
  }
}
*/
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

console.log(redisify('SELECT','5'));

connection.query('select species_id,meta_key,meta_value from meta where species_id IS NOT NULL', function(err, rows, fields) {
  if (err) throw err;
  let meta = {};
  rows.forEach(r => {
    if (!meta.hasOwnProperty(r.species_id)) {
      meta[r.species_id] = {};
    }
    meta[r.species_id][r.meta_key] = r.meta_value;
  });
  let running = 0;
  Object.keys(meta).forEach(function(species_id) {
    running++;
    let map = {
      system_name: meta[species_id]['species.production_name'],
      length: 0,
      regions: {
        names: [],
        lengths: []
      }
    };
    connection.query('SELECT sr.seq_region_id, sr.name, sr.length, sr.coord_system_id, sra.value '
    + 'FROM seq_region sr, seq_region_attrib sra, attrib_type at, coord_system cs '
    + 'WHERE at.code = "karyotype_rank" '
    + 'AND at.attrib_type_id = sra.attrib_type_id '
    + 'AND sra.seq_region_id = sr.seq_region_id '
    + 'AND sr.coord_system_id = cs.coord_system_id '
    + 'AND cs.species_id = ' + species_id, function(err, rows, fields) {
      if (err) throw err;
      rows.forEach(r => r.value = +r.value);
      rows.sort((a, b) => a - b);
      rows.forEach(r => {
        map.regions.names.push(r.name);
        map.regions.lengths.push(r.length);
        map.length += r.length;
      });
      connection.query('SELECT SUM(sr.length) as sum '
        + 'FROM seq_region sr, seq_region_attrib sra, attrib_type at, coord_system cs '
        + 'WHERE at.code = "toplevel"  '
        + 'AND at.attrib_type_id = sra.attrib_type_id '
        + 'AND sra.seq_region_id = sr.seq_region_id '
        + 'AND sr.coord_system_id = cs.coord_system_id  '
        + 'AND cs.species_id = ' + species_id, function (err, rows, fields) {
        if (err) throw err;
        var unanchored = rows[0].sum - map.length;
        if (!!unanchored) {
          map.regions.names.push('UNANCHORED');
          map.regions.lengths.push(unanchored);
        }
        connection.query('SELECT COUNT(*) as num_genes '
          + 'FROM gene g, seq_region sr, coord_system cs '
          + 'WHERE g.is_current=1 '
          + 'AND g.seq_region_id = sr.seq_region_id '
          + 'AND sr.coord_system_id = cs.coord_system_id '
          + 'AND cs.species_id = ' + species_id, function (err, rows, fields) {
          if (err) throw err;
          map.num_genes = rows[0].num_genes;
          running--;
          console.log(redisify('SET', meta[species_id]['assembly.default'], JSON.stringify(map)));
        })
      })
    })
  });
  function poll() {
    if (running) {
      setTimeout(poll, 500)
    }
    else {
      connection.end();
    }
  }
  poll();
});
