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
  getSets: getSets
};
var request = require('request');

/*
  Functions in a127 controllers used for operations should take two parameters:

  Param 1: a handle to the request object
  Param 2: a handle to the response object
*/

function getSets(req, res) {
  // variables defined in the Swagger document can be referenced using req.swagger.params.{parameter_name}
  var url = `http://localhost:8983/solr/admin/cores?action=STATUS&indexInfo=false`;
  request(url, function(err, response, body) {
    if (err) {
      res.json({error: err});
    }
    var results = [];
    var statusHash = JSON.parse(body).status;
    if (statusHash) {
      for (var core in statusHash) {
        if (core.startsWith('trees_')) {
          results.push({
            setId: core.replace('trees_',''),
            date: statusHash[core].startTime
          })
        }
      }
    }
    res.json(results)
  })
}
