#!/usr/bin/env node
// script to extract gene structure from an ensembl core db and shove it into a redis key value store
// the key is the gene id, value is JSON that looks like this:
/*
{
  "location" : {
    "region" : "chr2",
    "start" : 12345,
    "end" : 14245,
    "strand" : 1
  },
  "exons" : [
    {
      "id" : "exon1",
      "start" : 1,
      "end": 500
    },
    {
      "id" : "exon2",
      "start" : 600,
      "end": 1200
    },
    {
      "id" : "exon3",
      "start" : 1400,
      "end": 1900
    }
  ],
  "canonical_transcript" : "transcript2",
  "transcripts" : [
    {
      "id" : "transcript1",
      "exons" : [ "exon1", "exon3" ],
      "cds" : {
        "start" : 10,
        "end" : 700
      },
      "protein_id" : "protein1"
    },
    {
      "id" : "transcript2",
      "exons" : [ "exon1", "exon2", "exon3" ],
      "cds" : {
        "start" : 10,
        "end" : 1300
      },
      "protein_id" : "protein2"
    }
  ]
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

var sql = {
  genes: 'select g.gene_id, g.stable_id, g.canonical_transcript_id,'
   + ' sr.name as region, g.seq_region_start as start, g.seq_region_end as end, g.seq_region_strand as strand'
   + ' from gene g inner join seq_region sr on g.seq_region_id = sr.seq_region_id'
   + ' where g.is_current = 1',
  transcripts: 'select * from transcript',
  exons: 'select * from exon',
  e2t: 'select * from exon_transcript order by transcript_id, rank',
  translations: 'select * from translation'
};
function getCDS(translation, exons) {
  var cds = {
    start: 0,
    end: 0
  };
  var tpos = 0;
  exons.forEach(function(exon) {
    if (cds.start === 0 && exon.id === translation.start_exon_id) {
      cds.start = tpos + translation.seq_start;
    }
    if (cds.end === 0 && exon.id === translation.end_exon_id) {
      cds.end = tpos + translation.seq_end;
    }
    tpos += exon.end - exon.start + 1;
  });
  return cds;
}
connection.query(sql.exons, function(err, exons) {
  if (err) {
    throw(err);
  }
  var exon = {};
  exons.forEach(function(row) {
    exon[row.exon_id] = {
      id: row.exon_id,
      stable_id: row.stable_id,
      start: row.seq_region_start,
      end: row.seq_region_end
    };
  });
  connection.query(sql.e2t, function(err, e2t) {
    var et = {};
    e2t.forEach(function(row) {
      if (!et.hasOwnProperty(row.transcript_id)) {
        et[row.transcript_id] = [];
      }
      et[row.transcript_id].push(exon[row.exon_id])
    });
    connection.query(sql.translations, function(err, translations) {
      var translation = {};
      translations.forEach(function(row) {
        translation[row.transcript_id] = {
          stable_id: row.stable_id,
          cds: getCDS(row,et[row.transcript_id])
        }
      });
      connection.query(sql.transcripts, function(err, transcripts) {
        var geneExons = {};
        var geneTranscripts = {};
        var stable_id = {};
        transcripts.forEach(function(row) {
          if (!geneExons.hasOwnProperty(row.gene_id)) {
            geneExons[row.gene_id] = {};
          }
          et[row.transcript_id].forEach(function(e) {
            if (!geneExons[row.gene_id].hasOwnProperty(e.id)) {
              geneExons[row.gene_id][e.id] = e;
            }
          });

          if (!geneTranscripts.hasOwnProperty(row.gene_id)) {
            geneTranscripts[row.gene_id] = [];
          }
          stable_id[row.transcript_id] = row.stable_id;
          var tr = {
            id: row.stable_id,
            exons: et[row.transcript_id].map(function(e) {
              return e.stable_id
            })
          };
          if (translation[row.transcript_id]) {
            var tl = translation[row.transcript_id];
            tr.protein_id = tl.stable_id;
            tr.cds = tl.cds;
          }
          geneTranscripts[row.gene_id].push(tr);
        });
        console.log(redisify('SELECT','4'));
        connection.query(sql.genes, function(err, genes) {
          genes.forEach(function(gene) {
            var key = gene.stable_id;
            var gene_structure = {
              location: {
                region: gene.region,
                start: gene.start,
                end: gene.end,
                strand: gene.strand
              },
              exons: Object.values(geneExons[gene.gene_id]).map(function(e) {
                return {
                  id: e.stable_id,
                  start: gene.strand === 1 ? e.start - gene.start + 1 : gene.end - e.end + 1,
                  end: gene.strand === 1 ? e.end - gene.start + 1 : gene.end - e.start + 1
                }
              }),
              canonical_transcript: stable_id[gene.canonical_transcript_id],
              transcripts: geneTranscripts[gene.gene_id]
            };
            console.log(redisify('SET',key,JSON.stringify(gene_structure)));
          });
          connection.end(function() {
            console.error('closed mysql connection');
          })
        })
      })
    })
  })
});
