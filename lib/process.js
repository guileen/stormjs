require.paths.unshift('../supports/uglify-js');
var uglify = require('uglify-js'),
    util = require('util'),
    jsp = uglify.parser,
    pro = uglify.uglify,
    MAP = pro.MAP;

function compile(code) {
  var ast = jsp.parse(code, false, true);
  var new_ast = stormfy(ast, 'cb');
  return pro.gen_code(new_ast, { beautify: true });
}

function stormfy(ast, callback_name) {
  var w = pro.ast_walker();
  var reply_count = 0;

  callback_name || (callback_name = '_cb');

  var async_calls = [], before_asyncs = [], after_asyncs = [], name_depend_asyncs = {},
      readed_names, inside_asyncs;


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
          if (name_asyncs[name]) {
            name_asyncs[name].inside_asyncs.forEach(function(v) {
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

    var prop = name_depend_asyncs[name] = {
      async: false,
      readed_names: [],
      writed_names: [],
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
      callback: args[i],
      callback_args: args[i][2],
      result: ['name', reply_name],
      depend_asyncs: [],
      body: body
    };
  }

  function walk_block(statments, in_async_fun) {
    var before_asyncs = [], nodes = [], name_depend_asyncs = {};
    // seperate blocked_callback and io_asyncs

    function new_node(ast, body) {
      return {
        is_async: false,
        ast: ast,
        asyncs: [],
        depend_asyncs: [],
        result: ast
      };
    }

    function join_node(left, right) {
        addAllToSet(left.asyncs, right.asyncs);
        addAllToSet(left.depend_asyncs, right.depend_asyncs);
    }

    function sync_node(left, right) {
      left.asyncs = right.asyncs;
      left.depend_asyncs = right.depend_asyncs;
    }

    function _var(ast) {
      // defs should be handle standalone.
      // e.g. var a=foo(_), b=foo(_);
      var defs = ast[1];
      var rets = [];
      for (var j = 0; j < defs.length; j++) {
        var def = defs[j];
        if (def.length > 1) {
          var def1 = gen_node(def[1]);
          var ret = new_node(['var', [[def[0], def1.result]]]);
          if (def1.depend_asyncs.length > 0) {
            // we should not modify depend_asyncs outside gen_node
            name_depend_asyncs[def[0]] = def1.depend_asyncs;
          }
          sync_node(ret, def1);
          rets.push(ret);
        } else {
          rets.push(new_node(['var', [def]]));
        }
      }
      return rets;
    }

    function _call(ast) {
      var i = 0, args = ast[2], rargs = [], self_is_async, callback_body, reply_name;
      for (; i < args.length; i++) {
        var arg = args[i];
        if (arg[0] == 'name' && arg[1] == '_') {
          self_is_async = true;
          rargs[i] = new_node(arg);
        } else {
          rargs[i] = gen_node(arg);
        }
      }

      if (self_is_async) {
        // process all asyncs, and make ret
        var self_async = make_async_call(ast[1], MAP(rargs, function(rargs) {return rargs.result}));
        ret = new_node(self_async.result);
      }else {
        ret = new_node([ast[0], ast[1], MAP(rargs, function(rarg) {return rarg.result})]);
      }

      for (var j = 0; j < rargs.length; j++) {
        addAllToSet(ret.asyncs, rargs[j].asyncs);
        if (self_is_async) {
          addAllToSet(self_async.depend_asyncs, rargs[j].depend_asyncs);
        } else {
          addAllToSet(ret.depend_asyncs, rargs[j].depend_asyncs);
        }
      }

      if (self_is_async) {
        ret.asyncs.push(self_async);
        ret.depend_asyncs = [self_async];
      }
      return ret;
    }

    function gen_node(ast) {
      var type = ast[0], ret;
      switch (type.toString()) {
      case 'binary':
        var left = gen_node(ast[2]);
        var right = gen_node(ast[3]);
        ret = new_node([type, ast[1], left.result, right.result]);
        join_node(ret, left);
        join_node(ret, right);
        break;
      case 'assign':
        var left = gen_node(ast[2]);
        var right = gen_node(ast[3]);
        ret = new_node([type, ast[1], left.result, right.result]);
        join_node(ret, left);
        join_node(ret, right);
        if (right.depend_asyncs.length > 0) {
          var name = astToNameStr(ast[2]);
          if (name) {
            name_depend_asyncs[name] = right.depend_asyncs;
          }
        }
        break;
      case 'stat':
        var stat = gen_node(ast[1]);
        ret = new_node([type, stat.result]);
        sync_node(ret, stat);
        break;
      case 'return':
        var right = gen_node(ast[1]);
        if (in_async_fun) {
          ret = new_node(['call', ['name', callback_name], [['name', 'null'], right.result]]);
        } else {
          ret = new_node([ast[0], right.result]);
        }
        sync_node(ret, right);
        break;
      case 'function':
      case 'defun':
        return new_node(gen_function.apply(ast, ast.slice(1)));
      case 'var':
        return _var(ast);
      case 'call':
        return _call(ast);
      case 'name':
        ret = new_node(ast);
        ret.asyncs = ret.depend_asyncs = name_depend_asyncs[ast[1]] || [];
        break;
      case 'dot':
        var name = astToNameStr(ast);
        var left = gen_node(ast[1]);
        ret = new_node([type, left.result, ast[2]]);
        join_node(ret, left);
        if (name) {
          addAllToSet(ret.depend_asyncs, name_depend_asyncs[name] || []);
        }
        break;
      case 'sub':
        var name = astToNameStr(ast);
        var left = gen_node(ast[1]);
        var right = gen_node(ast[2]);
        ret = new_node([type, left.result, right.result]);
        join_node(ret, left);
        join_node(ret, right);
        if (name) {
          addAllToSet(ret.depend_asyncs, name_depend_asyncs[name] || []);
        }
        break;
      default:
        ret = new_node(ast);
      }
      return ret;
    }

    function add_result(node) {
      var type = node.result[0];
      addAllToSet(nodes, node.asyncs);
      if (type != 'function' && type != 'defun') {
        addToSet(nodes, node);
      } else {
        nodes.unshift(node);
      }
    }

    for (var i = 0; i < statments.length; i++) {
      try {
        var node = gen_node(statments[i]);
        if (Array.isArray(node)) {
          for (var j = 0; j < node.length; j++) {
            add_result(node[j]);
          }
        }else {
          //TODO: if not depend_asyncs, then same as prev_node.depend_asyncs
          add_result(node);
        }
      } catch (e) {
        console.log('error to handle statment');
        console.log(statments[i], '');
        console.log(e.stack);
      }
    }
    return make_nodes_ast(nodes);
    //return MAP(before_asyncs, function(node) {return node.result}).concat(make_parallel_ast(asyncs, after_asyncs));
  }

}

/* ======== make parallel vars ======== */

//get root async of a node or async
function get_roots(node) {
  if (node.roots) return node.roots;
  // remove self
  var depends = node.depend_asyncs, len = depends.length;
  remove(depends, node);
  if (len === 0) {
    return node.roots = [];
  }else if (len === 1) {
    var parent = depends[0];
    var roots = get_roots(parent);
    if (roots.length === 0) {
      node.roots = [parent];
    } else {
      node.roots = roots;
    }
  } else {
    node.roots = [];
    for (var i = 0; i < len; i++) {
      addAllToSet(node.roots, get_roots(depends[i]));
    }
  }
  // remove root from depends
  removeAll(depends, node.roots);
  return node.roots;
}

function make_nodes_tree(nodes, top) {
  // each async could have { nodes, after_asyncs }
  top || (top = {
      nodes: [],
      after_asyncs: []
  });
  for (var i = 0; i < nodes.length; i++) {
    var node = nodes[i];
    var len = node.depend_asyncs.length;
    // reset roots for each levels
    node.roots = null;
    var roots = get_roots(node);
    if (roots.length == 0) {
      top.nodes.push(node);
    } else if (roots.length == 1) {
      (roots[0].nodes || (roots[0].nodes = [])).push(node);
    } else {
      top.after_asyncs.push(node);
    }
  }
  return top;
}

function make_nodes_ast(nodes, toplevel) {
  var bodys = [];
  if (toplevel) {
    bodys.push(make_vars_ast(nodes));
  }
  var tree = make_nodes_tree(nodes);
  var nodes = tree.nodes;
  var after_asyncs = tree.after_asyncs;

  bodys.push(make_update_vars_ast(nodes));
  bodys.push(make_update_ast(nodes, after_asyncs));

  for (var i = 0; i < nodes.length; i++) {
    var node = nodes[i];
    if (node.is_async) {
      bodys.push(make_async_ast(node));
    } else {
      bodys.push(node.result);
    }
  }
  return bodys;
}

function make_async_ast(async) {
    // _r1 = __r1
    async.callback_args[1] = '_' + async.result[1];
    async.body.push(['stat', ['assign', true,
          async.result, ['name', '_' + async.result[1]]]]);
    if (async.nodes && async.nodes.length > 0) {
      pushAll(async.body, make_nodes_ast(async.nodes, false));
    }
    return ['stat', async.ast];
}

function make_vars_ast(nodes) {
  var defs = [];
  for (var i = 0; i < nodes.length; i++) {
    var node = nodes[i];
    var result = node.result;
    if (node.is_async) {
      defs.push([result[1]]);
    } else if (result[0] == 'var') {
      // each var has convert to only 1 define before. move var to top scope, convert to assign
      var def = result[1][0];
      defs.push([def[0]]);
      if (result.length > 1) {
        nodes[i] = ['stat', ['assign', true, ['name', def[0]], def[1]]];
      } else {
        //nodes[i] = null;
      }
    }
  }
  return ['var', defs];
}

function make_update_vars_ast(nodes) {
  var count = 0;
  for (var i = 0; i < nodes.length; i++) {
    if (nodes[i].is_async) {
      count++;
    }
  }
  return ['var', [['count', ['num', count.toString()]]]];
}

function make_update_ast(asyncs, after_asyncs) {
  var block = [];

  for (var i = 0; i < after_asyncs.length; i++) {
    block.push(after_asyncs[i].result);
  }
  //TODO handle after_asyncs

  return ['defun', 'update', [],
    [
      ['if',
        ['binary', '==',
          ['unary-prefix', '--',
            ['name', 'count']],
          ['num', '0']],
        ['block', block], undefined]]];
}

/*=============================*/

function pushAll(arr, another) {
  for (var i = 0; i < another.length; i++) {
    arr.push(another[i]);
  }
  return arr;
}

function addToSet(arr, obj) {
  if (arr.indexOf(obj) < 0)
    arr.push(obj);
}


function addAllToSet(arr, another) {
  for (var i = 0; i < another.length; i++) {
    addToSet(arr, another[i]);
  }
}

function remove(arr, obj) {
    var index = arr.indexOf(obj);
    if (index >= 0) arr.splice(index, 1);
}

function removeAll(arr, another) {
  for (var i = 0; i < another.length; i++) {
    remove(arr, another[i]);
  }
}

function indexOfName(args, name) {
  for (var i = 0; i < args.length; i++) {
    if (args[i][0] == 'name' && args[i][1] == name)
      return i;
  }
  return -1;
}

// sub, dot
function astToNameStr(ast) {
  switch (ast[0].toString()) {
  case 'name':
    return ast[1];
  case 'dot':
    var left = astToNameStr(ast[1]);
    return left && (left + '.' + ast[2]);
  case 'sub':
    //return a['x'] return a.x
    var left = astToNameStr(ast[1]);
    if (ast[2][0] == 'string') {
      return left && (left + '.' + ast[2][1]);
    }
  default:
    return null;
  }
}

exports.astToStr = function astToStr(ast, indent) {
  var ret = [];
  for (var i = 0; i < ast.length; i++) {
    if (Array.isArray(ast[i])) {
      ret.push('\n' + astToStr(ast[i], indent + '  '));
    // } else if (typeof ast[i] === 'object') {
    //   ret.push(util.inspect(ast[i]));
    } else if (typeof ast[i] === 'string') {
      ret.push('\'' + ast[i] + '\'');
    } else {
      ret.push(ast[i]);
    }
  }
  return indent + '[' + ret.join(',') + ']';
};

exports.stormfy = stormfy;
exports.compile = compile;
