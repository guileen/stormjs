var pro = require('./process'),
    fs = require('fs');

exports.run = function(args) {

  var arg, filenames = [], options = {
    compile: true,
    print: true
  };

  while (arg = args.shift()) {
    switch (arg) {
    case '-c':
    case '--compile':
      options.compile = true;
      break;
    default:
      if ('-' === arg[0]) {
        console.log('Unsupport argument of: ' + arg);
      } else {
        filenames.push(arg);
      }
    }
  }

  if (options.compile) {
    for (var i = 0; i < filenames.length; i++) {
      var code = fs.readFileSync(filenames[i], 'utf-8');
      var target = pro.compile(code);
      if (options.print) {
        console.log(target);
      }
    }
  }

};
