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

var internalNodeQuery = 'SELECT\n' +
  ' gtr.stable_id as treeId_s,\n' +
  ' gtn.node_id as nodeId_i,\n' +
  ' gtn.parent_id as parentId_i,\n' +
  ' gtn.root_id as rootId_i,\n' +
  ' gtn.distance_to_parent as distanceToParent_f,\n' +
  ' gtna.node_type as nodeType_s,\n' +
  ' gtna.bootstrap as bootstrap_i,\n' +
  ' gtna.duplication_confidence_score as duplicationConfidenceScore_f,\n' +
  ' stn.taxon_id as taxonId_i\n' +
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
  ' gtr.stable_id as treeId_s,\n' +
  ' gtn.node_id as nodeId_i,\n' +
  ' gtn.parent_id as parentId_i,\n' +
  ' gtn.root_id as rootId_i,\n' +
  ' gtn.distance_to_parent as distanceToParent_f,\n' +
  ' sm.stable_id as proteinId_s,\n' +
  ' sm.display_label as proteinName_s,\n' +
  ' sm.description as proteinDescription_t,\n' +
  ' sm.taxon_id as taxonId_i,\n' +
  ' gm.stable_id as geneId_s,\n' +
  ' gm.description as geneDescription_t,\n' +
  ' gm.display_label as geneName_s,\n' +
  ' sq.sequence as sequence_x,\n' +
  ' gam.cigar_line as cigar_x\n' +
  'FROM\n' +
  ' gene_tree_node gtn,\n' +
  ' gene_tree_root gtr,\n' +
  ' seq_member sm,\n' +
  ' sequence sq,\n' +
  ' gene_member gm,\n' +
  ' gene_align_member gam\n' +
  'WHERE\n' +
  ' gtr.stable_id IS NOT NULL and\n' +
  ' gtn.root_id = gtr.root_id and\n' +
  ' gtn.seq_member_id = sm.seq_member_id and\n' +
  ' sm.sequence_id = sq.sequence_id and\n' +
  ' sm.gene_member_id = gm.gene_member_id and\n' +
  ' gtr.gene_align_id = gam.gene_align_id and\n' +
  ' gam.seq_member_id = gtn.seq_member_id';

var tidyRow = through2.obj(function (row, encoding, done) {
  row.id = row.treeId_s + "_" + row.nodeId_i; // because we need a unique id for solr to be happy?
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

comparaDb.query(internalNodeQuery + '; ' + leafNodeQuery)
  .stream({highWaterMark: 10})
  .pipe(tidyRow)
  .pipe(createSolrStream(solrUrl))
  .on('end', function() {
    console.log('all tree nodes are in the solr database now.');
    comparaDb.end(function(err) {
      console.error('closed mysql connection');
    })
  });
