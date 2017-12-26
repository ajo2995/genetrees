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
var FlatToNested = require('flat-to-nested');
var flatToNested = new FlatToNested({
  id: 'nodeId',
  parent: 'parentId'
});

module.exports = {
  getTree: getTree
};

/*
  Functions in a127 controllers used for operations should take two parameters:

  Param 1: a handle to the request object
  Param 2: a handle to the response object
*/

function getTree(req, res) {
  // variables defined in the Swagger document can be referenced using req.swagger.params.{parameter_name}
  var setId = req.swagger.params.setId.value;
  var treeId = req.swagger.params.treeId.value;
  var filter = req.swagger.params.filter || '';
  var subtree = req.swagger.params.subtree || '';

  // get the url for the solr instance with setId trees
  var url = 'http://localhost:8983/solr/'+setId+'/query';
  // build a query for the given tree
  url += '?rows=3000&q=treeId:'+treeId;
  // possibly apply filters and subtree
  if (filter) {

  }
  if (subtree) {

  }
  // run the query
  request(url, function(err, response, body) {
    if (err) {
      res.json({error: err});
    }
    // assemble the tree from the matching solr docs
    // send the json response
    // cache the response - unless handled by middleware
    var nodes = JSON.parse(body).response.docs;
    // move this logic into the build script
    nodes.forEach(function(node) {
      if (node.nodeId === node.rootId) {
        delete node.parentId;
        node.treeType = 'geneTree';
      }
    });
    res.json(flatToNested.convert(nodes));
  });
}
