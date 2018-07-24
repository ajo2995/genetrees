#!/usr/bin/env node
var argv = require('minimist')(process.argv.slice(2));
var fs = require('fs');


function redisify() {
  var red = [];
  red.push('*'+arguments.length);
  Array.prototype.slice.call(arguments).forEach(function(a) {
    red.push('$'+a.length,a);
  });
  return red.join("\r\n") + "\r";
}

console.log(redisify('SELECT','2'));

var generifs_basic = argv.g;
require('readline').createInterface({
  input: fs.createReadStream(generifs_basic),
  terminal: false
}).on('line', function(line) {
  var cols = line.split("\t");
  if (line.charAt(0) !== "#") {
    var key = cols[1];
    var val = {
      pubmed: cols[2],
      geneRIF: cols[4]
    }
    console.log(redisify('SET',key,JSON.stringify(val)));
  }
});
