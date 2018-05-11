var _ = require('lodash');
var through2 = require('through2');
var JSONStream = require('JSONStream');
var duplexer = require('duplexer');
var request = require('request');
var argv = require('minimist')(process.argv.slice(2));
var Q = require('q');
var convert = require('xml-js');

var solrUrl = argv.s;
var msa_info_url = 'http://www.pantherdb.org/search?type=msa_info&book=';
var book_info_url = 'http://www.pantherdb.org/search?type=book_info&book=';

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

var bookId = 'PTHR43356';
var bookIntId = +bookId.replace('PTHR','');
bookIntId *= 10000;
request({
  url: `${book_info_url}${bookId}`
},function(err, res) {
  var book = convert.xml2js(res.body,{compact: true});
  var root = book.search.annotation_node;
  request({
    url: `${msa_info_url}${bookId}`
  },function(err, res) {
    var nodes = [];
    var msa = {};
    var parsed = convert.xml2js(res.body,{compact: true});
    parsed.search.sequence_list.sequence_info.forEach(function(node) {
      var id = node.annotation_node_id._text.replace(':','_');
      msa[id] = {
        cigar: '',
        sequence: ''
      };
      var blocks = node.full_sequence._text.split(/([-\.]+)/);
      blocks.forEach(function(block) {
        var len = block.length > 1 ? block.length : '';
        if (block.match(/[-\.]/)) {
          msa[id].cigar += `${len}D`;
        }
        else {
          msa[id].cigar += `${len}M`;
          msa[id].sequence += block.toUpperCase();
        }
      });
    });
    function makeNode(bookNode) {
      var accessionIntId = +bookNode.accession._text.replace('AN','');
      var node = {
        treeId: bookId,
        id: `${bookId}_${bookNode.accession._text}`,
        nodeId: bookIntId + accessionIntId,
        nodeName: bookNode.sf_name._text,
        nodeType: bookNode.node_type ? bookNode.node_type._text.toLowerCase() : 'speciation',
        distanceToParent: +bookNode.branch_length._text,
        taxonName: bookNode.species
          ? bookNode.species._text
          : bookNode.organism
            ? bookNode.organism._text
            : ''
      };
      if (bookNode.parentId) {
        node.parentId = bookNode.parentId;
        node.rootId = bookNode.rootId;
      }
      else {
        node.rootId = node.nodeId;
      }
      if (bookNode.node_name) node.nodeName = bookNode.node_name._text;
      if (bookNode.children) {
        bookNode.children.annotation_node.forEach(function (child) {
          child.parentId = node.nodeId;
          child.rootId = node.rootId;
          makeNode(child);
        });
      }
      else if (msa.hasOwnProperty(node.id)) {
        node.sequence = msa[node.id].sequence;
        node.cigar = msa[node.id].cigar;
        node.geneId = bookNode.gene_id._text.replace(/.+:/,'');
        if (bookNode.gene_symbol) node.geneName = bookNode.gene_symbol._text;
        if (bookNode.definition) node.geneDescription = bookNode.definition._text;
      }
      nodes.push(node);
      // console.log(node);
    }
    makeNode(root);
    console.log(JSON.stringify(nodes))
  });
});

// comparaDb.query(internalNodeQuery + '; ' + leafNodeQuery + '; ' + speciesTreeQuery)
//       .stream()
//       .pipe(tidyRow)
//       .pipe(createSolrStream(solrUrl))
//       .on('end', function() {
//         console.log('all tree nodes are in the solr database now.');
//         comparaDb.end(function(err) {
//           console.error('closed mysql connection');
//           redisPromise.then(function(client) {
//             client.quit();
//           });
//         });
//       });
//   });
// });
