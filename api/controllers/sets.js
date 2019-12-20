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

/*
  Functions in a127 controllers used for operations should take two parameters:

  Param 1: a handle to the request object
  Param 2: a handle to the response object
*/

function getSets(req, res) {
  // variables defined in the Swagger document can be referenced using req.swagger.params.{parameter_name}
  var query = req.swagger.params.q.value || '*:*';
  res.json([{
    setId: 'compara_95',
    date: '2019-02-15'
  },
  {
    setId: 'compara_pan_95',
    date: '2017-07-21'
  },
  {
    setId: 'compara_metazoa_95',
    date: '2017-07-21'
  },
  {
    setId: 'compara_fungi_95',
    date: '2017-07-21'
  },
  {
    setId: 'compara_protists_95',
    date: '2017-07-21'
  },
  {
    setId: 'compara_plants_95',
    date: '2017-07-21'
  },
  {
    setId: 'compara_plants_94',
    date: '2017-07-21'
  },
  {
    setId: 'interpro_71',
    date: '2018-05-11'
  }
]);
}
