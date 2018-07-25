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

If you want to have interpro annotations integrated into the tree leaf nodes, run getCoreDBCommands.js on the relevant ensembl mysql db host.
The key params are -h <host> -u <user> -p <password> -t <port> -e <ensembl version> -g <gramene/ensemblGenomes version> -s <script (loadInterpro.js)>
You need to have a redis server running on the default port (also used for web cache)
Interpro annotations are stored in a redis cache (key is proteinId, value is JSON list of domains)
They get loaded into the solr core in a dynamic field called interpro_x which is parsed into a nested structure by the tree and search controllers of the web service.

Experimenting with adding GeneRIFs too.
geneRIFs.js will populate a redis db with the generifs_basic data (key EntrezGene id, value is a list of GeneRIFs)
loadEntrezGene.js finds any EntrezGene xrefs and looks for associated GeneRIFs. populates another redis db with ensembl stable id keys


