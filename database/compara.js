var _ = require('lodash');
var through2 = require('through2');
var JSONStream = require('JSONStream');
var duplexer = require('duplexer');
var request = require('request');
var mysql = require('mysql');
var argv = require('minimist')(process.argv.slice(2));

var comparaDb = mysql.createConnection({
  host: argv.h,
  user: argv.u,
  password: argv.p,
  database: argv.d,
  multipleStatements: true
});

var solrUrl = argv.s;

var geneOrderQuery = 'SELECT gene_member_id from gene_member order by genome_db_id, dnafrag_id, dnafrag_start';

var internalNodeQuery = 'SELECT\n' +
  ' gtr.stable_id as treeId,\n' +
  ' gtn.node_id as nodeId,\n' +
  ' gtn.parent_id as parentId,\n' +
  ' gtn.root_id as rootId,\n' +
  ' gtn.distance_to_parent as distanceToParent,\n' +
  ' gtna.node_type as nodeType,\n' +
  ' gtna.bootstrap as bootstrap,\n' +
  ' gtna.duplication_confidence_score as duplicationConfidenceScore,\n' +
  ' stn.taxon_id as taxonId\n' +
  'FROM\n' +
  ' gene_tree_node gtn,\n' +
  ' gene_tree_node_attr gtna,\n' +
  ' gene_tree_root gtr,\n' +
  ' species_tree_node stn\n' +
  'WHERE\n' +
  ' gtr.stable_id IS NOT NULL and\n' +
  ' gtn.root_id = gtr.root_id and\n' +
  ' gtn.node_id = gtna.node_id and\n' +
  ' gtna.species_tree_node_id = stn.node_id';

var leafNodeQuery = 'SELECT\n' +
  ' gtr.stable_id as treeId,\n' +
  ' gtn.node_id as nodeId,\n' +
  ' gtn.parent_id as parentId,\n' +
  ' gtn.root_id as rootId,\n' +
  ' gtn.distance_to_parent as distanceToParent,\n' +
  ' sm.stable_id as proteinId,\n' +
  ' sm.display_label as proteinName,\n' +
  ' sm.description as proteinDescription,\n' +
  ' sm.taxon_id as taxonId,\n' +
  ' gm.gene_member_id,\n' +
  ' gm.stable_id as geneId,\n' +
  ' gm.description as geneDescription,\n' +
  ' gm.display_label as geneName,\n' +
  ' gm.dnafrag_start as geneStart,\n' +
  ' gm.dnafrag_end as geneEnd,\n' +
  ' gm.dnafrag_strand as geneStrand,\n' +
  ' d.name as geneRegion,\n' +
  ' sq.sequence as sequence,\n' +
  ' gam.cigar_line as cigar\n' +
  'FROM\n' +
  ' gene_tree_node gtn,\n' +
  ' gene_tree_root gtr,\n' +
  ' seq_member sm,\n' +
  ' sequence sq,\n' +
  ' gene_member gm,\n' +
  ' dnafrag d,\n' +
  ' gene_align_member gam\n' +
  'WHERE\n' +
  ' gtr.stable_id IS NOT NULL and\n' +
  ' gtn.root_id = gtr.root_id and\n' +
  ' gtn.seq_member_id = sm.seq_member_id and\n' +
  ' sm.sequence_id = sq.sequence_id and\n' +
  ' sm.gene_member_id = gm.gene_member_id and\n' +
  ' gm.dnafrag_id = d.dnafrag_id and\n' +
  ' gtr.gene_align_id = gam.gene_align_id and\n' +
  ' gam.seq_member_id = gtn.seq_member_id';

var tidyRow = through2.obj(function (row, encoding, done) {
  row.id = row.treeId + "_" + row.nodeId; // because we need a unique id for solr to be happy?
  if (row.nodeId === row.rootId) {
    delete row.parentId;
  }
  this.push(_.omitBy(row, _.isNull));
  done();
});

function createSolrStream(url) {
  var headers = {
    'content-type' : 'application/json',
    'charset' : 'utf-8'
  };
  var requestOptions = {
    url: url + '/update/json?wt-json&commit=true',
    method: 'POST',
    headers: headers
  };
  var jsonStreamStringify = JSONStream.stringify();
  var postRequest = request(requestOptions);
  jsonStreamStringify.pipe(postRequest);
  return duplexer(jsonStreamStringify, postRequest);
}

comparaDb.query(geneOrderQuery, function(err, rows) {
  if (err) {
    throw err;
  }
  console.error('finished geneOrderQuery');
  var geneRank = [];
  rows.forEach(function(row, idx) {
    geneRank[row.gene_member_id] = idx;
  });

  var addRank = through2.obj(function (row, encoding, done) {
    if (row.gene_member_id) {
      var rank = geneRank[row.gene_member_id];
      row.geneRank = [rank];
      row.geneNeighbors = [];
      for(var i=rank - 10; i < rank + 10; i++) {
        row.geneNeighbors.push(i);
      }
      delete row.gene_member_id;
    }
    this.push(row);
    done();
  });

  comparaDb.query(internalNodeQuery + '; ' + leafNodeQuery)
    .stream({highWaterMark: 100})
    .pipe(tidyRow)
    .pipe(addRank)
    .pipe(createSolrStream(solrUrl))
    .on('end', function() {
      console.log('all tree nodes are in the solr database now.');
      comparaDb.end(function(err) {
        console.error('closed mysql connection');
      })
    });
});
