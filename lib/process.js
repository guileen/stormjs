require.paths.unshift('../supports/uglify-js');
var uglify = require('uglify-js'),
    util = require('util'),
    jsp = uglify.parser,
    pro = uglify.uglify,
    MAP = pro.MAP;

function compile(code) {
  var ast = jsp.parse(code, false, true);
  var new_ast = stormfy(ast, 'cb');
  //console.log(showArray(ast, ''));
  //console.log(showArray(new_ast, ''));
  return pro.gen_code(new_ast, { beautify: true });
}

function stormfy(ast, callback_name) {
  var w = pro.ast_walker();
  var reply_count = 0;

  callback_name || (callback_name = '_cb');

  var async_calls = [], before_asyncs = [], after_asyncs = [], name_to_asyncs = {},
      stat, readed_names, inside_asyncs;


  return w.with_walkers({
      'toplevel': function(statments) {
        return ['toplevel', walk_block(statments)];
      }
    }, function() {
      return w.walk(ast);
  });

  function get_inside_asyncs(readed_names) {
    var ret = [];
    if (readed_names) {
      readed_names.forEach(function(name) {
          if (names[name]) {
            names[name].inside_asyncs.forEach(function(v) {
                if (ret.indexOf(v) < 0) {
                  ret.push(v);
                }
            });
          }
      });
    }
    return ret;
  }

  function get_readed_names(body) {

  }

  function gen_function(name, args, body) {
    index = args.indexOf('_');

    var prop = name_to_asyncs[name] = {
      async: false,
      readed_names: [],
      writed_names: [],
      ast: stat,
      inside_asyncs: [],
      all_done: true
    };

    if (index >= 0) {
      args[index] = callback_name;
      prop.async = true;
    }

    readed_names = prop.readed_names = get_readed_names(body);
    inside_asyncs = prop.inside_asyncs = get_inside_asyncs(prop.readed_names);

    var ret = [this[0], name, args, walk_block(body, prop.async)];
    return ret;
  }

  function vardefs(defs) {

    for (var i = 0; i < defs.length; i++) {
      var def = defs[i];
      if (def.length > 1) {
        gen_parent_ast(def[1], left);
      }
    }

  }

  /**
   * fn the function AST to be call
   * args  the args AST to be passed, callback in ['name', '_']
   */
  function make_async_call(fn, args) {
    var body = [
      ['if',
        ['name', '_err'],
        ['return',
          ['call', ['name', callback_name], [['name', '_err']]]
    ]]];
    var i = indexOfName(args, '_');
    var reply_name = '_r' + (++reply_count);
    args[i] = ['function', '', ['_err', reply_name], body];
    return {
      is_async: true,
      ast: ['call', fn, args],
      result: ['name', reply_name],
      body: body
    };
  }

  function new_node(ast, body) {
    return {
      is_async: false,
      ast: ast,
      asyncs: [],
      result: ast
    };
  }

  function gen_node(ast) {
    var type = ast[0];
    switch (type.toString()) {
    case 'binary':
      var left = gen_node(ast[2]);
      var right = gen_node(ast[3]);
      ret = new_node([type, ast[1], left.result, right.result]);
      pushAll(ret.asyncs, left.asyncs);
      pushAll(ret.asyncs, right.asyncs);
      break;
    case 'assign':
      break;
    case 'function':
    case 'defun':
      return ast;
      break;
    case 'var':
      break;
    case 'call':
      var i = 0, args = ast[2], rargs = [], self_async, callback_body, reply_name;
      for (; i < args.length; i++) {
        var arg = args[i];
        if (arg[0] == 'name' && arg[1] == '_') {
          self_async = true;
          rargs[i] = new_node(arg);
        } else {
          rargs[i] = gen_node(arg);
        }
      }

      if (self_async) {
        // process all asyncs, and make ret
        var async = make_async_call(ast[1], MAP(rargs, function(rargs) {return rargs.result}));
        ret = new_node(async.result);
      }else {
        ret = new_node([ast[0], ast[1], MAP(rargs, function(rarg) {return rarg.result})]);
      }

      for (var j = 0; j < rargs.length; j++) {
        pushAll(ret.asyncs, rargs[j].asyncs);
      }

      if (self_async) {
        ret.asyncs.push(async);
      }
      break;
    default:
      ret = new_node(ast);
    }
    return ret;
  }


  function walk_block(statments, in_async_fun) {
    var asyncs = [], before_asyncs = [], after_asyncs = [],
        name_to_asyncs = {}, stat, result;
    // seperate block_callback and io_asyncs

    function add_result(result) {
      if (asyncs.length > 0) {
        after_asyncs.push(result);
      } else {
        before_asyncs.push(result);
      }
    }
    function add_asyncs(node) {
      if (node.asyncs.length > 0) {
        pushAll(asyncs, node.asyncs);
      }
    }

    function handle_statment(stat) {
      var type = stat[0].toString();

      switch (type) {
      case 'defun':
      case 'function':
        add_result(gen_function.apply(stat, stat.slice(1)));
        break;

        //
        // if(while)
        //
        // if for
      case 'return':
        var right = gen_node(stat[1]);
        // must add_asyncs first, because add_result depends on asyncs count
        add_asyncs(right);
        if (in_async_fun) {
          add_result(['call', ['name', callback_name], [['name', 'null'], right.result]]);
        } else {
          add_result([stat[0], right.result]);
        }
        break;
      case 'var':
        var defs = stat[1];
        for (var j = 0; j < defs.length; j++) {
          var def = defs[j];
          if (def.length > 1) {
            var def1 = gen_node(def[1]);
            add_asyncs(def1);
            add_result(['var', [[def[0], def1.result]]]);
          } else {
            add_result(['var', [def]]);
          }
        }
        break;

      case 'stat':
        if (is_async_assign(stat)) {
          args.forEach(function(arg) {
              if (arg[0] == 'name') {
                prop.read_names.push(arg[1]);
              }else {
                // append sub statement read names
              }
          });
          // append function() to call args
          // if var or stat left goto function() 2nd line body
          // if right go to 2nd line body
          // first line of function() is if(err){
          // replace call to ast[i]
          // move sibling to args function() body
          // update map of name depends async
        }
        add_result(stat);
      default:
        add_result(stat);
        // if has name depends async,
        // the stat depends async,
        // the left name depends async
        //   if stat depends asyncs > 1
        //     stat move to all_done
        //   stat move to depends async function() body
        // else
        // stat move to sync blocks
      }
      // w.walk(stat)
    }

    for (var i = 0; i < statments.length; i++) {
      try {
        handle_statment(statments[i]);
      } catch (e) {
        console.log('error to handle statment');
        console.log(statments[i], '');
        throw e;
      }
    }
    // for each asyncs walk(asyncs function() body)
    return before_asyncs.concat(make_parallel(asyncs, after_asyncs));
  }

}

// ---- utilities ----

function pushAll(arr, another) {
  for (var i = 0; i < another.length; i++) {
    arr.push(another[i]);
  }
  return arr;
}

function make_parallel(asyncs, after_asyncs) {
  // if asyncs length > 1 parallel, all_done to on parallel done body
  if (asyncs.length == 0) return after_asyncs;
  if (asyncs.length == 1) {
    var async = asyncs[0];
    pushAll(async.body, after_asyncs);
    return [async.ast];
  }

  var args = ['err'],
  body = [['if', ['name', 'err'],
      ['return', ['call', ['name', 'cb'], [['name', 'err']]]],
      undefined]];
  for (var i = 0; i < asyncs.length; i++) {
    var async = asyncs[i];
    // async.result is ['name', '_r1'];
    args.push(async.result[1]);
  }

  for (var i = 0; i < after_asyncs.length; i++) {
    body.push(after_asyncs[i]);
  }

  var parallel_body = make_parallel_body(asyncs);
  //console.log(showArray(parallel_body, ''));
  //(function(cb){parallel_body})(function(args){after_asyncs})
  return [['stat', ['call',
        ['function', null, ['cb'], parallel_body],
        [['function', null, args, body]]]]];
}
//=============================

function make_parallel_vars(asyncs) {
  var defs = [['count', ['num', asyncs.length]]];
  for (var i = 1; i <= asyncs.length; i++) {
    defs.push(['__r' + i]);
  }
  return ['var', defs];
}

function make_parallel_fn_update(asyncs) {
  //(null, __r1, __r2)
  var cb_args = [['name', 'null']];

  for (var i = 1; i <= asyncs.length; i++) {
    cb_args.push(['name', '__r' + i]);
  }

  return ['defun', 'update', [],
    [
      ['if',
        ['binary', '==',
          ['unary-prefix', '--',
            ['name', 'count']],
          ['num', '0']],
        ['stat',
          ['call',
            ['name', 'cb'],
            cb_args]], undefined]]];
}

function make_parallel_body(asyncs) {
  var bodys = [make_parallel_vars(asyncs), make_parallel_fn_update(asyncs)];
  for (var i = 0; i < asyncs.length; i++) {
    var async = asyncs[i];
    // __r1 = _r1
    async.body.push(['stat', ['assign', true,
          ['name', '__r' + (i + 1)], async.result]]);
    bodys.push(['stat', async.ast]);
  }
  return bodys;
}

//=============================

function indexOfName(args, name) {
  for (var i = 0; i < args.length; i++) {
    if (args[i][0] == 'name' && args[i][1] == name)
      return i;
  }
  return -1;
}

function showArray(ast, indent) {
  var ret = [];
  for (var i = 0; i < ast.length; i++) {
    if (Array.isArray(ast[i])) {
      ret.push('\n' + showArray(ast[i], indent + '  '));
//    } else if (typeof ast[i] === 'object') {
//      ret.push(util.inspect(ast[i]));
    } else {
      ret.push('\'' + ast[i] + '\'');
    }
  }
  return indent + '[' + ret.join(',') + ']';
}

// ---- test ----

if (!module.parent) {

  var test_fun = test;

  var code = compile(test_fun.toString());
  console.log(test_fun.toString());
  console.log(code);

  function foo(path, _) {
    (function(cb) {
        var count = 2, __r1, __r2;
        function update() {
          if (--count == 0) cb(null, __r1, __r2);
        }
        foo(arg1, function(err, _r1) {
            __r1 = _r1;
        });
        foo(arg2, function(err, _r2) {
            __r2 = _r2;
        });
    })(function(err, _r1, _r2) {
        if (err) return cb(err);
    });
    if (err) return cb(err);
  }

  function simple(_) {
    return fs.readFileAsync(path + '/a.js', _) + fs.readFileAsync(path + '/b.js', _);
  }

  function test() {
    function onecallback() {
      var x = x + y;
      var x = foo(_);
      var x = x + y;
    }

    function test_statment() {
      var bar = foo(_) + 5 + foo(_);
    }
    function test_nested() {
      var bar = foo(foo1(_) + foo2(_), _);
    }
    function test_return(_) {
      return foo(_) + 5 + foo(_);
    }
    function test_return() {
      return foo1(1, _) + foo2(2, _);
    }
  }

  function testbak(_) {
    var bar, bar2;
    function foo(_) {
      return bar;
    }
    bar = foo(_);
    var bar = foo(_);
    foo(function(_bar) {
        bar = _bar;
        _bar(null, bar);
        return bar;
    });
    var bar3 = foo(_),
        bar4 = foo(_);

    if (true) {
      foo(_);
      a = foo(_);
      a += foo(_) + foo(_);
      var d = foo2(foo1(_), _);
      var e = (foo(_) || x = foo(_)) + (foo(_) || x = foo(_));
    }
  }

}
