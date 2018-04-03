var _ = require('lodash');
var through2 = require('through2');
var JSONStream = require('JSONStream');
var duplexer = require('duplexer');
var request = require('request');
var argv = require('minimist')(process.argv.slice(2));
var Q = require('q');
var fs = require('fs');
var XmlStream = require('xml-stream');
var spigot = require('stream-spigot');


// parse the content from the xml file
// get the parent nodes from the hierarchy
// download interpro and uncompress before running this script
// 'ftp://ftp.ebi.ac.uk/pub/databases/interpro/interpro.xml.gz';
// 'ftp://ftp.ebi.ac.uk/pub/databases/interpro/ParentChildTreeFile.txt'


var parentChildFile = argv.p;
var xmlFile = argv.x;
var solrUrl = argv.s;

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


// read the parentChildFile into memory
var currentAncestors = [];
var ancestorIds = [];
var inTree = {}; // key is interpro id, value is tree node
require('readline').createInterface({
  input: fs.createReadStream(parentChildFile),
  terminal: false
}).on('line', function(line) {
  var splittedLine = line.split('--');
  var depth = splittedLine.length - 1;
  var IPRwithNames = splittedLine[depth];
  var splittedIPR = IPRwithNames.split('::');
  var id = splittedIPR[0];
  var IPR = parseInt(id.match(/\d+/));
  currentAncestors[depth] = IPR;
  ancestorIds[depth] = id;
  var node = {
    nodeId: IPR,
    rootId: currentAncestors[0],
    treeId: ancestorIds[0]
  };
  if (depth > 0) {
    node.parentId = currentAncestors[depth - 1];
  }
  inTree[id] = node;
}).on('close', function() {
  // Create a file stream and pass it to XmlStream
  var stream = fs.createReadStream(xmlFile);
  var xml = new XmlStream(stream);
  var nodes = [];
  xml.collect('db_xref');
  xml.on('endElement: interpro', function(item) {
    // console.log(item);
    var id = item.$.id;
    var IPR = parseInt(id.match(/\d+/));
    var node = {
      id: id,
      nodeId: IPR,
      nodeType: item.$.type,
      nodeName: item.name
    };
    if (item.hasOwnProperty('abstract') && item.abstract.hasOwnProperty('p')) {
      node.nodeDescription = item.abstract.p.$text;
    }
    if (inTree.hasOwnProperty(id)) {
      node.parentId = inTree[id].parentId;
      node.rootId = inTree[id].rootId;
      node.treeId = inTree[id].treeId;
    }
    else {
      node.rootId = IPR;
      node.treeId = node.id;
    }
    nodes.push(node);
  });
  xml.on('end', function() {
    spigot({objectMode: true, highWaterMark: 1}, nodes)
      .pipe(createSolrStream(solrUrl))
      .on('end', function() {
         console.log('all tree nodes are in the solr database now.');
       });
  });
});


// .pipe(createSolrStream(solrUrl))
// .on('end', function() {
//   console.log('all tree nodes are in the solr database now.');
//   comparaDb.end(function(err) {
//     console.error('closed mysql connection');
//   });
// });
