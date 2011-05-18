// `node check_output.js -o` to overwrite .out.js
var fs = require('fs'),
    pro = require('../lib/process'),
    assert = require('assert');

var args = process.argv, arg, options = {
  overwrite: false
};
while (arg = args.shift()) {
  if(arg==='-o'){
    options.overwrite = true;
  }
}

function testFile(filename) {
  var code = fs.readFileSync(__dirname + '/' + filename + '.js', 'utf-8');
  var target = pro.compile(code);
  if(options.overwrite){
    fs.writeFileSync(__dirname + '/' + filename + '.out.js', target, 'utf-8');
  }else {
    var expect = fs.readFileSync(__dirname + '/' + filename + '.out.js', 'utf-8');
    assert.equal(target.trim(), expect.trim(), 'error test ' + filename + '.js');
  }
}

['groups', 'steps', 'serial', 'parallel', 'expression'].forEach(testFile);
