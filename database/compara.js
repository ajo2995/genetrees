var _ = require('lodash');
var through2 = require('through2');
var JSONStream = require('JSONStream');
var duplexer = require('duplexer');
var request = require('request');
var mysql = require('mysql');
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
var redisPromise = getRedis(1);

var comparaDb = mysql.createConnection({
  host: argv.h,
  user: argv.u,
  port: argv.t || 3306,
  password: argv.p,
  database: argv.d,
  multipleStatements: true
});

var solrUrl = argv.s;

var geneOrderQuery = 'SELECT gene_member_id, taxon_id, dnafrag_id from gene_member order by genome_db_id, dnafrag_id, dnafrag_start';
var taxonomyQuery = 'SELECT taxon_id, parent_id from ncbi_taxa_node';
var internalNodeQuery = 'SELECT\n' +
  ' gtr.stable_id as treeId,\n' +
  ' gtn.node_id as nodeId,\n' +
  ' gtn.parent_id as parentId,\n' +
  ' gtn.root_id as rootId,\n' +
  ' gtn.distance_to_parent as distanceToParent,\n' +
  ' gtn.left_index as leftIndex,\n' +
  ' gtna.node_type as nodeType,\n' +
  ' gtna.bootstrap as bootstrap,\n' +
  ' gtna.duplication_confidence_score as duplicationConfidenceScore,\n' +
  ' stn.taxon_id as taxonId,\n' +
  ' stn.node_name as taxonName\n' +
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
  ' gtn.left_index as leftIndex,\n' +
  ' sm.stable_id as proteinId,\n' +
  ' sm.display_label as proteinName,\n' +
  ' sm.description as proteinDescription,\n' +
  ' sm.taxon_id as taxonId,\n' +
  ' gdb.display_name as taxonName,\n' +
  ' gm.gene_member_id,\n' +
  ' gm.biotype_group as nodeType,\n' +
  ' gm.stable_id as geneId,\n' +
  ' gm.description as geneDescription,\n' +
  ' gm.display_label as geneName,\n' +
  ' gm.dnafrag_id,\n' +
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
  ' genome_db gdb,\n' +
  ' sequence sq,\n' +
  ' gene_member gm,\n' +
  ' dnafrag d,\n' +
  ' gene_align_member gam\n' +
  'WHERE\n' +
  ' gtr.stable_id IS NOT NULL and\n' +
  ' gtn.root_id = gtr.root_id and\n' +
  ' gtn.seq_member_id = sm.seq_member_id and\n' +
  ' sm.genome_db_id = gdb.genome_db_id and\n' +
  ' sm.sequence_id = sq.sequence_id and\n' +
  ' sm.gene_member_id = gm.gene_member_id and\n' +
  ' gm.dnafrag_id = d.dnafrag_id and\n' +
  ' gtr.gene_align_id = gam.gene_align_id and\n' +
  ' gam.seq_member_id = gtn.seq_member_id';

var speciesTreeQuery = 'SELECT\n' +
  ' str.root_id as treeId,\n' +
  ' stn.node_id as nodeId,\n' +
  ' stn.parent_id as parentId,\n' +
  ' stn.root_id as rootId,\n' +
  ' stn.distance_to_parent as distanceToParent,\n' +
  ' stn.left_index as leftIndex,\n' +
  ' stn.node_name as taxonName,\n' +
  ' stn.taxon_id as taxonId\n' +
  'FROM\n' +
  ' species_tree_root str,\n' +
  ' species_tree_node stn\n' +
  'WHERE\n' +
  ' str.root_id = stn.root_id';

var tidyRow = through2.obj(function (row, encoding, done) {
  row.id = row.treeId + "_" + row.nodeId; // because we need a unique id for solr to be happy?
  if (row.nodeId === row.rootId && row.parentId) {
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

console.error('geneOrderQuery started');
comparaDb.query(geneOrderQuery, function(err, rows) {
  if (err) {
    throw err;
  }
  console.error('geneOrderQuery finished');
  var geneRank = [];
  var leafTaxon = [];
  var dnaFragBounds = [];
  rows.forEach(function(row, idx) {
    geneRank[row.gene_member_id] = idx;
    leafTaxon[row.taxon_id] = 1;
    if (!dnaFragBounds[row.dnafrag_id]) {
      dnaFragBounds[row.dnafrag_id] = {
        start: idx,
        end: idx
      }
    }
    else {
      dnaFragBounds[row.dnafrag_id].end = idx;
    }
  });
  console.error('geneOrderQuery postprocessed');

  console.error('taxonomyQuery started');
  comparaDb.query(taxonomyQuery, function(err, rows) {
    if (err) {
      throw err;
    }
    console.error('taxonomyQuery finished');
    var parent = [];
    rows.forEach(function(row) {
      parent[row.taxon_id] = row.parent_id;
    });
    var ancestors = [];
    Object.keys(leafTaxon).forEach(function(leafStr) {
      var leaf = +leafStr;
      ancestors[leaf] = [leaf];
      var node = parent[leaf];
      while(node > 0) {
        ancestors[leaf].push(node);
        node = parent[node];
      }
    });
    console.error('taxonomyQuery prostprocessed');

    var addRank = through2.obj(function (row, encoding, done) {
      if (row.gene_member_id) {
        var rank = geneRank[row.gene_member_id];
        row.geneRank = [rank];
        row.geneNeighbors = [];
        var minRank = Math.max(rank - 10, dnaFragBounds[row.dnafrag_id].start);
        var maxRank = Math.min(rank + 10, dnaFragBounds[row.dnafrag_id].end);
        delete row.dnafrag_id;
        for(var i=minRank; i < maxRank; i++) {
          row.geneNeighbors.push(i);
        }
        row.taxonAncestors = ancestors[row.taxonId];
        delete row.gene_member_id;
      }

      this.push(row);
      done();
    });

    var addInterpro = through2.obj(function (row, encoding, done) {
      if (row.proteinId) {
        var that = this;
        redisPromise.then(function(client) {
          client.get(row.proteinId, function (err, domains) {
            if (err) {
              throw err;
            }
            if (domains) {
              row.interpro_x = domains;
            }
            that.push(row);
            done();
          });
        });
      }
      else {
        this.push(row);
        done();
      }
    });

    console.error('tree queries started');
    comparaDb.query(internalNodeQuery + '; ' + leafNodeQuery + '; ' + speciesTreeQuery)
      .stream()
      .pipe(tidyRow)
      .pipe(addRank)
      .pipe(addInterpro)
      .pipe(createSolrStream(solrUrl))
      .on('end', function() {
        console.log('all tree nodes are in the solr database now.');
        comparaDb.end(function(err) {
          console.error('closed mysql connection');
          redisPromise.then(function(client) {
            client.quit();
          });
        });
      });
  });
});
