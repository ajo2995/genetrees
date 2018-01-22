'use strict';
/*
 'use strict' is not required but helpful for turning syntactical errors into true errors in the program flow
 https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Strict_mode
*/
/*
 For a controller in a127 (which this is) you should export the functions referenced in your Swagger document by name.

 Either:
  - The HTTP Verb of the corresponding operation (get, put, post, delete, etc)
  - Or the operationId associated with the operation in your Swagger document

*/
var request = require('request');
module.exports = {
  getNeighbors: getNeighbors
};

/*
  Functions in a127 controllers used for operations should take two parameters:

  Param 1: a handle to the request object
  Param 2: a handle to the response object
*/

function getNeighbors(req, res) {
  // variables defined in the Swagger document can be referenced using req.swagger.params.{parameter_name}
  var setId = req.swagger.params.setId.value || '';
  var treeId = req.swagger.params.treeId.value || '';
  var filter = req.swagger.params.filter.value || '';

  // get the url for the solr instance with setId trees
  var url = 'http://localhost:8983/solr/'+setId+'/query?rows=20000';
  url += '&fl=treeId,gene*';
  // build a query for the given tree
  var solrQuery = '&q={!graph from=geneNeighbors to=geneRank maxDepth=1}treeId:'+treeId;
  solrQuery += ' AND geneRank:[* TO *]';
  // possibly apply filter
  if (filter) {
    solrQuery += ' AND ' + filter;
  }
  // run the query
  request(url + solrQuery, function(err, response, body) {
    if (err) {
      res.json({error: err});
    }
    var nodes = JSON.parse(body).response.docs;
    var geneByRank = {};
    nodes.forEach(function(n) {
      var rank = n.geneRank[0];
      delete n.geneNeighbors;
      delete n.geneRank;
      geneByRank[rank] = n;
    });
    res.json(geneByRank);
  });
}
