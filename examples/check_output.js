// `node check_output.js -o` to overwrite .out.js
// -e to execute code
// no arguments to check output
var fs = require('fs'),
    jsp = require('uglify-js').parser,
    pro = require('uglify-js').uglify,
    storm = require('../lib/storm'),
    vm = require('vm'),
    assert = require('assert');

var args = process.argv.slice(2), arg, options = {
  overwrite: false,
  check: true,
  filenames: []
};

while (arg = args.shift()) {
  if (arg === '-o') {
    options.overwrite = true;
    options.check = false;
  } else if (arg === '--ast') {
    options.ast = true;
  } else if (arg === '-e') {
    options.execute = true;
  } else if (arg === '-nt') {
    options.check = false;
  } else if (arg === '-p') {
    options.print = true;
  } else {
    options.filenames.push(arg);
  }
}

if (options.filenames.length === 0) {
  options.filenames = ['groups', 'steps', 'serial', 'parallel', 'expression', 'loop_parallel'];
}

function make_log(filename) {
  var filename = filename + new Array(16 - filename.length).join(' ');
  return function(s) {
    console.log(filename + ':' + s);
  }
}

function make_foo(filename) {
  var filename = filename + new Array(16 - filename.length).join(' ');
  var log = console.log;
  return function() {
    var args = Array.prototype.slice.call(arguments, 0),
        cb = args.pop(),
        arg_name = args.toString(),
        tab = new Array(12 - arg_name.length).join(' '),
        ret = Math.floor(Math.random() * 100);

    console.log(filename + ':foo(' + arg_name + ')');
    setTimeout(function() {
        console.log(filename + ':callback ' + arg_name + '#' + ret);
        cb(null, arg_name + '#' + ret);
      }, ret);
  };
}

function testFile(filename) {
  filename = filename.replace(/\.js$/, '');
  var code = fs.readFileSync(__dirname + '/' + filename + '.js', 'utf-8');
  var target;
  var src_ast = jsp.parse(code);

  if (options.ast) {
    console.log(filename + ': source ast');
    console.log(storm.astToStr(src_ast, ''));
  }

  if (options.print) {
    console.log(filename + ': source code');
    console.log(code);
  }

  var target_ast = storm.stormfy(src_ast, 'cb');

  if (options.ast) {
    console.log(filename + ': target ast');
    console.log(storm.astToStr(target_ast, ''));
  }

  var target = pro.gen_code(target_ast, {beautify: true});

  if (options.print) {
    console.log(filename + ': target code');
    console.log(target);
  }

  var expect;
  if (options.overwrite) {
    fs.writeFileSync(__dirname + '/' + filename + '.out.js', target, 'utf-8');
    expect = target;
  } else {
    expect = fs.readFileSync(__dirname + '/' + filename + '.out.js', 'utf-8');
  }

  if (options.execute) {
    var script = vm.createScript(expect);
    var sandbox = {
      foo: make_foo(filename),
      console: {
        log: make_log(filename)
      },
      process: process
    };
    script.runInNewContext(sandbox);
  }

  if (options.check) {
    assert.equal(target.trim(), expect.trim(), 'the output is not equals expected. filename: ' + filename + '.js');
  }

}

options.filenames.forEach(function(filename){
    try{
      testFile(filename);
      console.log(filename + ':OK');
    } catch(e) {
      console.log(filename + ':Fail');
      console.log(e.stack);
    }
});
