# Genetrees

This is a Swagger based API for querying gene trees from an apache solr database.

To get started:
```
npm install
node app.js &
open http://localhost:10010
```

You will also need an Apache Solr instance populated with gene trees
```
1. download solr and install in $SOLR_ROOT
2. mkdir $SOLR_ROOT/server/solr/compara_90
3. ln -s database/solr/conf $SOLR_ROOT/server/solr/compara_90/.
4. $SOLR_ROOT/bin/solr start -p 8983 -m 4g
5. open http://localhost:8983/solr
6. click Core Admin, then Add Core, then write "compara_90" in the name and instanceDir fields
7. node database/compara.js -h ensembldb.ensembl.org -u anonymous -d ensembl_compara_90 -s http://localhost:8983/solr/compara_90
```
