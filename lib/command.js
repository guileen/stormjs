var pro = require('./storm'),
    util = require('util'),
    path = require('path'),
    fs = require('fs');

exports.run = function(args) {

  var arg, options = {
    compile: true,
    print: true
  };

  while (arg = args.shift()) {
    switch (arg) {
    case '-c':
    case '--compile':
      options.compile = true;
      break;
    case '-w':
    case '--watch':
      options.watch = true;
      break;
    case '-o':
    case '--output':
      options.output = args.shift();
      break;
    case '-p':
    case '--print':
      options.print = true;
      break;
    case '-h':
    case '--help':
      options.help = true;
      break;
    default:
      if ('-' === arg[0] || options.filename) {
        console.log('Unsupport argument of: ' + arg);
      } else {
        options.filename = arg;
      }
    }
  }

  function usage(){
    console.log('Usage:');
    console.log('  storm [options] path/to/script\n');
    console.log('Options:');
    console.log('  -c,  --compile       compile .storm to .js');
    console.log('  -w,  --watch         watch script for change, and recompile');
    console.log('  -p,  --print         print the compiled JavaScript');
    process.exit(0);
  }

  if (options.help) {
    usage();
  }

  if (options.compile) {

    var filename = options.filename;
    if(!filename){
      usage();
    }
    path.exists(filename, function(exists) {

        fs.stat(filename, function(err, stats) {
            compile(filename, stats.isDirectory());
        });
    });
  }

  function compile(filename, isDir){
    if(isDir){
      
    } else {
      fs.readFile(filename, 'utf-8', function(err, code){
          var target = pro.compile(code);
          if (options.print) {
            util.puts(target);
          }
      });
    }
  }

  function watch(source, base) {
    return fs.watchFile(source, {
      persistent: true,
      interval: 500
    }, function(curr, prev) {
      if (curr.size === prev.size && curr.mtime.getTime() === prev.mtime.getTime()) {
        return;
      }
      return fs.readFile(source, function(err, code) {
        if (err) {
          throw err;
        }
        return compileScript(source, code.toString(), base);
      });
    });
  };

};
