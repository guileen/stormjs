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

  return w.with_walkers({
      'toplevel': function(statments) {
        return ['toplevel', walk_block(statments)];
      }
    }, function() {
      return w.walk(ast);
  });

  function gen_function(name, args, body, name_to_parent_asyncs) {
    var index = args.indexOf('_'),
        is_async = index >= 0;

    if (is_async) {
      args[index] = callback_name;
    }

    var block_node = gen_block(body, is_async, name_to_parent_asyncs);
    var ret = new_node([this[0], name, args, block_node.result]);
    ret.depend_asyncs = block_node.depend_asyncs;

    return ret;
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
          ['call', ['name', callback_name], [['name', '_err']]]]]];
    var i = indexOfName(args, '_');
    var index = reply_count;
    var reply_name = '_r' + (++reply_count);
    args[i] = ['function', '', ['_err', reply_name], body];
    return {
      is_async: true,
      ast: ['call', fn, args],
      callback: args[i],
      callback_args: args[i][2],
      result: ['name', reply_name],
      defined_asyncs: [],
      depend_asyncs: [],
      body: body
    };
  }

  function new_node(ast, body) {
    return {
      is_async: false,
      ast: ast,
      defined_asyncs: [],
      depend_asyncs: [],
      result: ast
    };
  }

  function join_node(left, right) {
    addAllToSet(left.defined_asyncs, right.defined_asyncs);
    addAllToSet(left.depend_asyncs, right.depend_asyncs);
    if (right.is_async) {
      addToSet(left.depend_asyncs, right);
    }
  }

  function walk_block(statments, in_async_fun) {
    var node = gen_block(statments, in_async_fun);
    return node.result;
  }

  function gen_block(statments, in_async_fun, name_to_parent_asyncs) {
    var before_asyncs = [], nodes = [], name_depend_asyncs = {},
        parent_asyncs = [], depend_parent_asyncs = [];
    // seperate blocked_callback and io_asyncs

    for (var name in name_to_parent_asyncs) {
      var asyncs = name_to_parent_asyncs[name];
      name_depend_asyncs[name] = asyncs;
      addAllToSet(parent_asyncs, asyncs);
    }

    for (var i = 0; i < statments.length; i++) {
      try {
        var node = gen_node(statments[i]);
        if (Array.isArray(node)) {
          for (var j = 0; j < node.length; j++) {
            add_result(node[j]);
          }
        }else {
          //TODO: if not depend_asyncs, depends current all asyncs. node.depend_asyncs = asyncs.slice();
          add_result(node);
        }
      } catch (e) {
        console.log('error to handle statment');
        console.log(statments[i]);
        throw e;
      }
    }

    for (var i = 0; i < nodes.length; i++) {
      remove_parent_asyncs(nodes[i]);
    }

    var result = make_block_ast(nodes, true);
    var node = new_node(result);
    node.depend_asyncs = depend_parent_asyncs;

    return node;

    function add_result(node) {
      var type = node.result[0];
      addAllToSet(nodes, node.defined_asyncs);
      if (type == 'function' || type == 'defun') {
        nodes.unshift(node);
      } else {
        addToSet(nodes, node);
      }
      remove_parent_asyncs(node);
    }

    function remove_parent_asyncs(node) {
      var depends = node.depend_asyncs;
      for (var i = depends.length - 1, async; i >= 0; i--) {
        async = depends[i];
        if (parent_asyncs.indexOf(async) >= 0) {
          addToSet(depend_parent_asyncs, async);
          // remove parent dependencies from local, else deadly cycle.
          depends.splice(i, 1);
        }
      }
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
          join_node(ret, def1);
          if (ret.depend_asyncs.length > 0) {
            // we should not modify depend_asyncs outside gen_node
            name_depend_asyncs[def[0]] = ret.depend_asyncs;
          }
          rets.push(ret);
        } else {
          rets.push(new_node(['var', [def]]));
        }
      }
      return rets;
    }

    function _call(ast) {
      var i = 0, args = ast[2], rargs = [], self_is_async, ret;
      for (; i < args.length; i++) {
        var arg = args[i];
        if (arg[0] == 'name' && arg[1] == '_') {
          self_is_async = true;
          rargs[i] = new_node(arg);
        } else {
          rargs[i] = gen_node(arg);
        }
      }

      var func = gen_node(ast[1]);
      if (self_is_async) {
        // process all asyncs, and make ret
        ret = make_async_call(func.result, MAP(rargs, function(rargs) {return rargs.result}));
      }else {
        ret = new_node([ast[0], func.result, MAP(rargs, function(rarg) {return rarg.result})]);
      }

      rargs.unshift(func);

      for (var j = 0; j < rargs.length; j++) {
        var rarg = rargs[j];
        addAllToSet(ret.defined_asyncs, rarg.defined_asyncs);
        addAllToSet(ret.depend_asyncs, rarg.depend_asyncs);
      }

      if (self_is_async) {
        ret.defined_asyncs.push(ret);
      }
      return ret;
    }

    function _array(ast) {
      var arr = ast[1];
      var rarr = [];
      var ret = new_node([ast[0], rarr]);
      for (var i = 0; i < arr.length; i++) {
        var node = gen_node(arr[i]);
        join_node(ret, node);
        rarr.push(node.result);
      }
      return ret;
    }

    function _object(ast) {
      var obj = ast[1];
      var robj = [];
      var ret = new_node([ast[0], robj]);
      for (var i = 0; i < obj.length; i++) {
        var pair = obj[i];
        var node = gen_node(pair[1]);
        join_node(ret, node);
        robj.push([pair[0], node.result]);
      }
      return ret;
    }

    function _for(ast) {
      var init = gen_node(ast[1])[0],
          condition = gen_node(ast[2]),
          step = gen_node(ast[3]),
          body = gen_node(ast[4]);

      var ret = new_node([ast[0], init.result, condition.result, step.result, body.result]);
      join_node(ret, init);
      join_node(ret, condition);
      join_node(ret, step);
      join_node(ret, body);
      return ret;
    }

    function gen_node(ast) {
      var type = ast[0], ret;
      switch (type.toString()) {
      case 'array':
        return _array(ast);
      case 'object':
        return _object(ast);
      case 'block':
        var block = gen_block(ast[1], in_async_fun, name_depend_asyncs);
        var ret = new_node([ast[0], block.result]);
        join_node(ret, block);
        return ret;
      case 'for':
        return _for(ast);
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
        if (ret.depend_asyncs.length > 0) {
          var name = astToNameStr(ast[2]);
          if (name) {
            name_depend_asyncs[name] = ret.depend_asyncs;
          }
        }
        break;
      case 'stat':
        var stat = gen_node(ast[1]);
        if (stat.is_async) return stat;
        ret = new_node([type, stat.result]);
        join_node(ret, stat);
        break;
      case 'return':
        var right = gen_node(ast[1]);
        if (in_async_fun) {
          ret = new_node(['call', ['name', callback_name], [['name', 'null'], right.result]]);
        } else {
          ret = new_node([ast[0], right.result]);
        }
        join_node(ret, right);
        break;
      case 'function':
      case 'defun':
        return gen_function.apply(ast, ast.slice(1).concat(name_depend_asyncs));
      case 'var':
        return _var(ast);
      case 'call':
        return _call(ast);
      case 'name':
        ret = new_node(ast);
        ret.depend_asyncs = name_depend_asyncs[ast[1]] || [];
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

  }

}

/* ======== make parallel vars ======== */

function get_depends_roots(node) {
  if (node.roots) return node.roots;
  // remove self
  var depends = node.depend_asyncs;
  remove(depends, node);
  if (depends.length === 0) {
    return node.roots = [];
  } else {
    node.roots = [];
    for (var i = 0; i < depends.length; i++) {
      var roots = get_depends_roots(depends[i]);
      addAllToSet(node.roots, roots.length > 0 ? roots : [depends[i]]);
    }
  }
  return node.roots;
}

function get_depends_leafs(node) {
  if (node.leafs) return node.leafs;
  var depends = node.depend_asyncs;
  remove(depends, node);
  var leafs = depends.slice();
  for (var i = depends.length - 1; i >= 0; i--) {
    var depdep = depends[i].depend_asyncs;
    for (var j = 0; j < depdep.length; j++) {
      if (depends[i] !== depdep[j])
        remove(leafs, depdep[j]);
    }
  }
  return node.leafs = leafs;
}

function make_nodes_tree(nodes, top) {
  // each async could have { nodes, multi_depends }
  top || (top = {
      nodes: [],
      multi_depends: [],
      used_leafs: []
  });
  for (var i = 0; i < nodes.length; i++) {
    var node = nodes[i];
    // reset roots for each levels
    node.roots = null;
    var roots = get_depends_roots(node);
    var len = roots.length;
    var leafs = get_depends_leafs(node);
    if (len === 0) {
      top.nodes.push(node);
    } else if (leafs.length === 1) {
      (leafs[0].nodes || (leafs[0].nodes = [])).push(node);
    } else {
      node.is_multi_depends = true;
      top.multi_depends.push(node);
      addAllToSet(top.used_leafs, leafs);
      // defined_asyncs is equals referenced async.
      // if in multi_depends, all referenced async must be outside referenced.
      for (var j = 0; j < node.defined_asyncs.length; j++) {
        var ref_node = node.defined_asyncs[j];
        if (ref_node !== node) {
          ref_node.out_ref = true;
        }
      }
    }
  }
  return top;
}

function gen_leafs_depend_flag(used_leafs) {
  for (var i = 0; i < used_leafs.length; i++) {
    var leaf = used_leafs[i];
    leaf.index = i;
    leaf.flag = 1 << i;
  }
}

function gen_nodes_depend_flag(multi_depends) {
  for (var i = 0; i < multi_depends.length; i++) {
    var flag = 0, node = multi_depends[i];
    for (var j = 0; j < node.leafs.length; j++) {
      flag |= node.leafs[j].flag;
    }
    node.depend_flag = flag;
  }
}

function make_block_ast(nodes, toplevel) {
  var bodys = [];
  var tree = make_nodes_tree(nodes);
  gen_leafs_depend_flag(tree.used_leafs);

  if (toplevel) {
    pushAll(bodys, make_vars_ast(nodes));
  }

  var nodes = tree.nodes;
  var multi_depends = tree.multi_depends;
  gen_nodes_depend_flag(multi_depends);
  var multi_groups = group_multi_depends(multi_depends);
  var with_trigger = multi_groups.length > 1;
  var with_update = multi_groups.length === 1;

  if (with_trigger) {
    bodys.push(make_triggers(multi_groups));
    bodys.push(make_fn_trigger(multi_depends));
  } else if (with_update) {
    bodys.push(make_update_vars_ast(tree.used_leafs));
    bodys.push(make_update_ast(multi_depends));
  }

  for (var i = 0; i < nodes.length; i++) {
    var node = nodes[i];
    if (node.is_async) {
      bodys.push(make_async_ast(node, with_trigger, with_update));
    } else {
      bodys.push(node.result);
    }
  }
  return bodys;
}

function make_nodes_ast(nodes, with_trigger, with_update) {
  var bodys = [];

  for (var i = 0; i < nodes.length; i++) {
    var node = nodes[i];
    if (node.is_async) {
      bodys.push(make_async_ast(node, with_trigger, with_update));
    } else {
      bodys.push(node.result);
    }
  }
  return bodys;
}

function make_trigger(group_flag, nodes) {
  var remove_me = ['stat', ['call',
        ['dot', ['name', 'triggers'], 'splice'],
        [
          ['name', '_index'],
          ['num', 1]]]];


  var block = make_nodes_ast(nodes, true, false);
  block.unshift(remove_me);

  return ['function',,
    ['_index'],
    [
      ['if',
        ['binary', '===',
          ['num', group_flag],
          ['binary', '&',
            ['name', '_done'],
            ['num', group_flag]]],
        ['block', block]]]];
}

function group_multi_depends(multi_depends) {
  var groups = [];
  multi_depends.sort(function(a, b) {return a.depend_flag > b.depend_flag});
  var group_flag = -1, nodes, triggers = [];
  for (var i = 0, node; i < multi_depends.length; i++) {
    node = multi_depends[i];
    if (node.depend_flag !== group_flag) {
      if (nodes && nodes.length > 0) {
        groups.push([group_flag, nodes]);
      }
      group_flag = node.depend_flag;
      nodes = [];
    }
    nodes.push(node);
  }
  if (nodes && nodes.length > 0) {
    // last group
    groups.push([group_flag, nodes]);
  }
  return groups;
}

function make_triggers(groups) {
  var triggers = [];

  for (var i = 0; i < groups.length; i++) {
    var group = groups[i];
    triggers.push(make_trigger(group[0], group[1]));
  }

  return ['var', [
      ['_done', ['num', 0]],
      ['triggers', ['array', triggers]]]];
}

function make_fn_trigger() {
  var fn_trigger = ['defun', 'trigger',
    [],
    [
      ['for',
        ['var',
          [
            ['i',
              ['binary', '-',
                ['dot',
                  ['name', 'triggers'], 'length'],
                ['num', 1]]]]],
        ['binary', '>=',
          ['name', 'i'],
          ['num', 0]],
        ['unary-postfix', '--',
          ['name', 'i']],
        ['block',
          [
            ['stat',
              ['call',
                ['sub',
                  ['name', 'triggers'],
                  ['name', 'i']],
                [['name', 'i']]]]]]]]];
  return fn_trigger;
}

function make_async_ast(async, with_trigger, with_update) {
  if (async.out_ref) {
    // use _r1 = __r1 when outside referenced _r1.
    async.callback_args[1] = '_' + async.result[1];
    async.body.push(['stat', ['assign', true,
          async.result, ['name', '_' + async.result[1]]]]);
  }

  if (with_trigger && async.flag) {
    // add flag, _done |= 0x04;
    async.body.push(['stat', ['assign', '|', ['name', '_done'], ['num', async.flag]]]);
    // call trigger, trigger();
    async.body.push(['stat', ['call', ['dot', ['name', 'process'], 'nextTick'], [['name', 'trigger']]]]);
  }

  if (async.nodes && async.nodes.length > 0) {
    pushAll(async.body, make_nodes_ast(async.nodes, with_trigger, with_update));
  }
  if (with_update && async.flag) {
    async.body.push(['stat', ['call', ['name', 'update'], []]]);
  }

  return ['stat', async.ast];
}

function make_vars_ast(nodes) {
  var defs = [];
  for (var i = 0; i < nodes.length; i++) {
    var node = nodes[i];
    var result = node.result;
    if (node.is_async && node.out_ref) {
      defs.push([result[1]]);
    } else if (result[0] == 'var') {
      // each var has convert to only 1 define before. move var to top scope, convert to assign
      var def = result[1][0];
      if (def.length > 1) {
        defs.push([def[0]]);
        nodes[i].result = ['stat', ['assign', true, ['name', def[0]], def[1]]];
      }
    }
  }
  return defs.length > 0 ? [['var', defs]] : [];
}

function make_update_vars_ast(leafs) {
  return ['var', [['count', ['num', leafs.length]]]];
}

function make_update_ast(multi_depends) {
  var block = make_nodes_ast(multi_depends);

  return ['defun', 'update', [],
    [
      ['if',
        ['binary', '===',
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

