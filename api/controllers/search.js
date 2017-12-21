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
  search: search
};

/*
  Functions in a127 controllers used for operations should take two parameters:

  Param 1: a handle to the request object
  Param 2: a handle to the response object
*/

function search(req, res) {
  // variables defined in the Swagger document can be referenced using req.swagger.params.{parameter_name}
  var query = req.swagger.params.q.value || '*:*';
  var setId = req.swagger.params.setId.value || '';
  res.json([{
    setId: 'ensembl_compara_plants_38',
    treeId: 'EPlGT00820000103641',
    date: '2017-07-21'
  }]);
}
