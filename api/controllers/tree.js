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
  parent: 'parentId',
  options: { deleteParent: false }
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
  var filter = req.swagger.params.filter.value || '';
  var subtree = req.swagger.params.subtree.value || 0;

  // get the url for the solr instance with setId trees
  var url = 'http://localhost:8983/solr/'+setId+'/query?rows=10000&q=';
  // build a query for the given tree
  var solrQuery = 'treeId:'+treeId;
  // possibly apply filters and subtree
  if (filter) {
    solrQuery = '{!graph from=nodeId to=parentId}' + solrQuery + ' AND ' + filter;
  }
  if (subtree) {
    solrQuery += ' AND {!graph from=parentId to=nodeId}nodeId:'+subtree;
  }
  // run the query
  console.error(url + solrQuery);
  request(url + solrQuery, function(err, response, body) {
    if (err) {
      res.json({error: err});
    }
    // assemble the tree from the matching solr docs
    // send the tree
    // cache the response - handled by middleware
    var nodes = JSON.parse(body).response.docs;
    nodes.forEach(function(n) {
      if (n.interpro_x) {
        n.interpro = JSON.parse(n.interpro_x);
        delete n.interpro_x;
      }
      if (n.geneStructure_x) {
        n.gene_structure = JSON.parse(n.geneStructure_x);
        delete n.geneStructure_x
      }
      if (n.geneRIFs_x) {
        n.geneRIFs = JSON.parse(n.geneRIFs_x);
        delete n.geneRIFs_x;
      }
      if (n.genome_x) {
        n.genomeAssembly = JSON.parse(n.genome_x);
        delete n.genome_x;
      }
    });
    if (subtree && !filter) {
      // remove the parentId on the subtree root node so flatToNested works
      nodes.forEach(function(n) {
        if (n.nodeId === subtree) {
          delete n.parentId;
        }
      });
    }
    var tree = flatToNested.convert(nodes);
    if (subtree && filter) {
      // skip over ancestors of the subtree root
      while (tree.nodeId !== subtree) {
        tree = tree.children[0];
      }
    }
    res.json(tree);
  });
}
