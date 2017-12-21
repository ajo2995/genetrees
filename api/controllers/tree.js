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

  // check if we have this query cached - or is that something volos handles as middleware?
  // get the url for the solr instance with setId trees
  // build a query for the given tree
  // possibly apply filters and subtree
  // run the query
  // assemble the tree from the matching solr docs
  // send the json response
  // cache the response - unless handled by middleware
  res.json({
    treeId: 'EPlGT00820000103641',
    treeType: 'geneTree',
    nodeId: 123
  });
}
