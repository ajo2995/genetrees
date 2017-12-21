var should = require('should');
var request = require('supertest');
var server = require('../../../app');

describe('controllers', function() {

  describe('search', function() {

    describe('GET /search', function() {

      it('should return a list', function(done) {

        request(server)
          .get('/api/v1/search')
          .set('Accept', 'application/json')
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(err, res) {
            should.not.exist(err);
            res.body.should.be.an.Array();

            done();
          });
      });

      it('should accept a query parameter', function(done) {

        request(server)
          .get('/api/v1/search')
          .query({ q: 'geneId:AT1G32900'})
          .set('Accept', 'application/json')
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(err, res) {
            should.not.exist(err);

            res.body.should.be.an.Array();
            var tree = res.body[0];
            tree.should.be.eql({
              setId: 'ensembl_compara_plants_38',
              treeId: 'EPlGT00820000103641',
              date: '2017-07-21'
            });
            done();
          });
      });

    });

  });

});
