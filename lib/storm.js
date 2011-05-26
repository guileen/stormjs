require.paths.unshift('../supports/uglify-js');
var uglify = require('uglify-js'),
    util = require('util'),
    jsp = uglify.parser,
    pro = uglify.uglify;

function compile(code, options) {
  var ast = jsp.parse(code, false, true);
  var new_ast = stormfy(ast, options);
  return pro.gen_code(new_ast, { beautify: true });
}

function stormfy(ast, options) {
  var w = pro.ast_walker();
  var reply_count = 0;

  options || (options = {});
  var callback_name = options.callback_name || 'cb';

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

    var type = this[0];
    var block_node = gen_block(body, is_async, name_to_parent_asyncs);
    var ret = new_node('NORESULT_FUN', function() {
        return [type, name, args, block_node.toAST()];
    });
    ret.depend_asyncs = block_node.depend_asyncs;

    return ret;
  }

  /**
   * fn the function AST to be call
   * args  the args AST to be passed, callback in ['name', '_']
   */
  function make_async_call(fn, args, left_name) {
    var body = [
      ['if',
        ['name', '_err'],
        ['return',
          ['call', ['name', callback_name], [['name', '_err']]]]]];
    var i = indexOfName(args, '_');
    var reply_name = '_' + (left_name ? left_name.replace(/\./g, '_') : ++reply_count);
    args[i] = ['function', '', ['_err', reply_name], body];
    return {
      is_async: true,
      ast: ['call', fn, args],
      callback: args[i],
      callback_args: args[i][2],
      result: ['name', reply_name],
      toAST: function() {
        return make_async_ast(this);
      },
      defined_asyncs: [],
      depend_asyncs: [],
      body: body
    };
  }

  function walk_block(statments, in_async_fun) {
    var node = gen_block(statments, in_async_fun);
    return node.toAST();
  }

  function gen_block(statments, in_async_fun, name_to_parent_asyncs) {
    var nodes = [], name_depend_asyncs, inner_asyncs = [],
        locals = [], depend_parent_asyncs = [];
    // seperate blocked_callback and io_asyncs

    name_depend_asyncs = clone(name_to_parent_asyncs, true) || {};

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

    var node = new_node('NORESULT_BLOCK', function() {
        return make_block_ast(nodes, true);
    });
    node.depend_asyncs = depend_parent_asyncs;
    node.inner_asyncs = inner_asyncs;
    node.global_depend_inner_asyncs = get_global_depend_inner_asyncs();

    for (var i = 0; i < inner_asyncs.length; i++) {
      inner_asyncs[i].block = node;
    }

    return node;

    function add_result(node) {
      var type = node.result[0];
      pushAll(nodes, node.defined_asyncs);
      pushAll(inner_asyncs, node.defined_asyncs);
      if (node.is_async) {
        addToSet(inner_asyncs, node);
      }
      if (type == 'function' || type == 'defun') {
        nodes.unshift(node);
      } else {
        addToSet(nodes, node);
      }
      remove_parent_asyncs(node);
    }

    function get_global_depend_inner_asyncs() {
      var ret = {};
      for (var name in name_depend_asyncs) {
        if (locals.indexOf(name) < 0) {
          var map = filter(name_depend_asyncs[name], function(name, obj) {
              return !(obj && obj.is_async && inner_asyncs.indexOf(obj) < 0);
          });
          if (map['*'].length > 0) ret[name] = map;
        }
      }
      return ret;
    }

    function remove_parent_asyncs(node) {
      var depends = node.depend_asyncs;
      for (var i = depends.length - 1, async; i >= 0; i--) {
        async = depends[i];
        // safe than parent_asyncs.indexOf >= 0
        if (inner_asyncs.indexOf(async) < 0) {
          addToSet(depend_parent_asyncs, async);
          // remove parent dependencies from local, else deadly cycle.
          depends.splice(i, 1);
        }
      }
    }

    function set_var_depend_asyncs(ast, asyncs) {
      _set_var_depend_asyncs(ast, asyncs, name_depend_asyncs);
    }

    function add_var_depend_asyncs(ast, asyncs) {
      _add_var_depend_asyncs(ast, asyncs, name_depend_asyncs);
    }

    function get_var_depend_asyncs(ast) {
      var map = _get_var_depend_asyncs(ast, name_depend_asyncs);
      return map ? map['*'] : [];
    }

    function _set_var_depend_asyncs(ast, asyncs, map) {
      switch (ast[0].toString()) {
      case 'name':
        map = map[ast[1]] = {'*' : asyncs.slice()};
        return map;
      case 'dot':
        map = _add_var_depend_asyncs(ast[1], asyncs, map);
        return _set_var_depend_asyncs(ast[2], asyncs, map);
      case 'sub':
        //return a['x'] return a.x
        map = _add_var_depend_asyncs(ast[1], asyncs, map);
        if (ast[2][0] == 'string') {
          return _set_var_depend_asyncs(['name', ast[2][1]], asyncs, map);
        }
        return map;
      default:
        return null;
      }
    }

    function _add_var_depend_asyncs(ast, asyncs, map) {
      switch (ast[0].toString()) {
      case 'name':
        map = map[ast[1]] || (map[ast[1]] = {'*' : []});
        addAllToSet(map['*'], asyncs);
        return map;
      case 'dot':
        map = _add_var_depend_asyncs(ast[1], asyncs, map);
        return _add_var_depend_asyncs(ast[2], asyncs, map);
      case 'sub':
        //return a['x'] return a.x
        map = _add_var_depend_asyncs(ast[1], asyncs, map);
        if (ast[2][0] == 'string') {
          return _add_var_depend_asyncs(['name', ast[2][1]], asyncs, map);
        }
        return map;
      default:
        return null;
      }
    }

    function _get_var_depend_asyncs(ast, map) {
      switch (ast[0].toString()) {
      case 'name':
        return map[ast[1]];
      case 'dot':
        var map = _get_var_depend_asyncs(ast[1], map);
        return _get_var_depend_asyncs(ast[2], map) || map;
      case 'sub':
        var map = _get_var_depend_asyncs(ast[1], map);
        if (ast[2][0] == 'string') {
          return _get_var_depend_asyncs(['name', ast[2][1]], map) || map;
        }
        return map;
      default:
        return null;
      }
    }

    function _var(ast) {
      var defs = ast[1],
          rdefs = [],
          ret = new_node([ast[0], rdefs]);
      for (var j = 0; j < defs.length; j++) {
        var def = defs[j];
        locals.push(def[0]);
        if (def.length > 1) {
          var def1 = gen_node(def[1], def[0]);
          rdefs.push([def[0], def1.result]);
          join_node(ret, def1);
          // we should not modify depend_asyncs outside gen_node
          set_var_depend_asyncs(['name', def[0]], ret.depend_asyncs);
        } else {
          // reset parent depend because redefined.
          set_var_depend_asyncs(['name', def[0]], []);
          rdefs.push(def);
        }
      }
      return ret;
    }

    function _call(ast, left_name) {
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
        ret = make_async_call(func.result, rargs.map(function(rargs) {return rargs.result}), left_name);
      }else {
        ret = new_node([ast[0], func.result, rargs.map(function(rarg) {return rarg.result})]);
      }

      rargs.unshift(func);

      for (var j = 0; j < rargs.length; j++) {
        var rarg = rargs[j];
        addAllToSet(ret.defined_asyncs, rarg.defined_asyncs);
        addAllToSet(ret.depend_asyncs, rarg.depend_asyncs);
      }

      if (self_is_async) {
        ret.defined_asyncs.push(ret);
        ret.depend_asyncs.push(ret);
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

    function _block(ast) {
      var block = gen_block(ast[1], in_async_fun, name_depend_asyncs);
      var ret = new_node([ast[0], block.result]);
      join_node(ret, block);
      block.inner_asyncs = ret.inner_asyncs;
      return ret;
    }

    function _for(ast) {
      var init = gen_node(ast[1]),
          condition = gen_node(ast[2]),
          step = gen_node(ast[3]),
          body_ast = ast[4],
          next_body, body, is_serial;

      if (body_ast[0] == 'block') {
        body_ast = body_ast[1];
      } else {
        body_ast = [body_ast];
      }

      body = gen_block(body_ast, in_async_fun, name_depend_asyncs);
      var _reply_count = reply_count;
      next_body = gen_block(body_ast, in_async_fun, body.global_depend_inner_asyncs);
      reply_count = _reply_count;
      var ret;
      // next_body depend_asyncs means depend previous asyncs (global_depend_inner_asyncs)
      if (next_body.depend_asyncs.length > 0) {
        is_serial = true;
        ret = new_node('NORESULT', function() {
            return make_serial_loop_ast(init, condition, step, body, this.nodes);
        });
        ret.is_async = true;
        for (var name in body.global_depend_inner_asyncs) {
          set_var_depend_asyncs(['name', name], [ret]);
        }
      } else {
        ret = new_node([ast[0], init.result, condition.result, step.result, ['block', body.toAST()]]);
      }
      join_node(ret, init);
      join_node(ret, condition);
      join_node(ret, step);
      addAllToSet(ret.depend_asyncs, body.depend_asyncs);
      return ret;
    }

    /**
     * left_name  var left_name = foo(_);
     * is_sub ['name', 'foo'] foo is after dot or sub
     */
    function gen_node(ast, left_name, is_sub) {
      var type = ast[0], ret;
      switch (type.toString()) {
      case 'array':
        return _array(ast);
      case 'object':
        return _object(ast);
      case 'block':
        return _block(ast);
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
        var name = astToNameStr(ast[2]);
        var right = gen_node(ast[3], name);
        ret = new_node([type, ast[1], left.result, right.result]);
        join_node(ret, left);
        join_node(ret, right);
        if (ret.depend_asyncs.length > 0) {
          set_var_depend_asyncs(ast[2], right.depend_asyncs);
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
      case 'throw':
        var right = gen_node(ast[1]);
        if (in_async_fun) {
          ret = new_node(['call', ['name', callback_name], [right.result]]);
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
        return _call(ast, left_name);
      case 'name':
        ret = new_node(ast);
        if (!is_sub) {
          addAllToSet(ret.depend_asyncs, get_var_depend_asyncs(ast));
        }
        break;
      case 'dot':
        var left = gen_node(ast[1], null, is_sub);
        ret = new_node([type, left.result, ast[2]]);
        join_node(ret, left);
        if (!is_sub) {
          addAllToSet(ret.depend_asyncs, get_var_depend_asyncs(ast));
        }
        break;
      case 'sub':
        var name = astToNameStr(ast);
        var left = gen_node(ast[1], null, is_sub);
        var right = gen_node(ast[2], null, false);
        ret = new_node([type, left.result, right.result]);
        join_node(ret, left);
        join_node(ret, right);
        if (!is_sub) {
          addAllToSet(ret.depend_asyncs, get_var_depend_asyncs(ast));
        }
        break;
      default:
        var result = [ast[0]];
        ret = new_node(result);
        for (var i = 1; i < ast.length; i++) {
          if (Array.isArray(ast[i])) {
            var node = gen_node(ast[i]);
            result.push(node.result);
            join_node(ret, node);
          } else {
            result.push(ast[i]);
          }
        }
      }
      return ret;
    }

  }
  /* ======== end gen_block() ======== */

}

/* ======== end stormfy() ======== */

/**
 *
 * result is what other nodes embed this node as
 * e.g. result could be ['name', '_r1'] but toAST is and ['call', ...]
 */
function new_node(result, toAST) {
  return {
    is_async: false,
    defined_asyncs: [],
    depend_asyncs: [],
    result: result,
    toAST: toAST
  };
}

function join_node(left, right) {
  addAllToSet(left.defined_asyncs, right.defined_asyncs);
  addAllToSet(left.depend_asyncs, right.depend_asyncs);
  if (right.is_async) {
    addToSet(left.depend_asyncs, right);
  }
}

/*======== make_block_ast ========*/

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
    (leaf.nodes || (leaf.nodes = [])).push(new_node(['stat', ['call', ['name', 'trigger'], [['num', leaf.flag]]]]));
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
  var defs = [];

  if (toplevel) {
    set_vars_ast(nodes, defs);
  }

  var tree = make_nodes_tree(nodes);
  gen_leafs_depend_flag(tree.used_leafs);
  set_out_ref_defs(nodes, defs);

  var nodes = tree.nodes;
  var multi_depends = tree.multi_depends;
  gen_nodes_depend_flag(multi_depends);
  var multi_groups = group_multi_depends(multi_depends);
  if (multi_groups.length > 0) {
    pushAll(bodys, make_triggers(multi_groups, defs));
  }

  if (defs.length > 0) {
    bodys.unshift(['var', defs]);
  }

  for (var i = 0; i < nodes.length; i++) {
    var node = nodes[i];
    bodys.push(
      node.toAST ? node.toAST() : node.result);
  }
  return bodys;
}

function make_nodes_ast(nodes) {
  var bodys = [];

  for (var i = 0; i < nodes.length; i++) {
    var node = nodes[i];
    bodys.push(
      node.toAST ? node.toAST() : node.result);
  }
  return bodys;
}

function make_trigger(group_flag, nodes, only_one) {
  var block = make_nodes_ast(nodes, true, false), arg_name, done_ast, fn_name;
  if (only_one) {
    arg_name = '_flag';
    fn_name = 'trigger';
    done_ast = ['assign', '|', ['name', '_done'], ['name', '_flag']];
  } else {
    arg_name = '_index';
    done_ast = ['name', '_done'];
    var remove_me = ['stat', ['call',
        ['dot', ['name', 'triggers'], 'splice'],
        [
          ['name', '_index'],
          ['num', 1]]]];
    block.unshift(remove_me);
  }

  return ['function', fn_name,
    [arg_name],
    [
      ['if',
        ['binary', '===',
          ['num', group_flag],
          ['binary', '&', done_ast,
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

function make_triggers(groups, defs) {
  defs.push(['_done', ['num', 0]]);
  if (groups.length === 1) {
    return [make_trigger(groups[0][0], groups[0][1], true/* only_one */)];
  }

  var triggers = [];

  for (var i = 0; i < groups.length; i++) {
    var group = groups[i];
    triggers.push(make_trigger(group[0], group[1]));
  }

  return [['var', [['triggers', ['array', triggers]]]], make_fn_trigger()];
}

function make_fn_trigger() {
  var fn_trigger = ['defun', 'trigger',
    ['_flag'],
    [
      ['stat', ['assign', '|', ['name', '_done'], ['name', '_flag']]],
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

function make_async_ast(async) {
  if (async.out_ref) {
    // use _r1 = __r1 when outside referenced _r1.
    async.callback_args[1] = '_' + async.result[1];
    async.body.push(['stat', ['assign', true,
          async.result, ['name', '_' + async.result[1]]]]);
  }

  if (async.nodes && async.nodes.length > 0) {
    pushAll(async.body, make_nodes_ast(async.nodes));
  }

  return ['stat', async.ast];
}

function set_out_ref_defs(nodes, defs) {
  for (var i = 0; i < nodes.length; i++) {
    var node = nodes[i];
    if (node.is_async && node.out_ref) {
      defs.push([node.result[1]]);
    }
  }
}

function set_vars_ast(nodes, defs) {
  for (var i = 0; i < nodes.length; i++) {
    var node = nodes[i];
    var result = node.result;
    if (result[0] == 'var' && node.depend_asyncs.length > 0) {
      var _defs = result[1];
      var _i = i;
      for (var j = 0; j < _defs.length; j++) {
        var def = _defs[j];
        defs.push([def[0]]);
        if (def.length > 1) {
          var assign_node = new_node(['stat', ['assign', true, ['name', def[0]], def[1]]]);
          join_node(assign_node, node);
          nodes.splice(++i, 0, assign_node);
        }
      }
      nodes.splice(_i, 1);
      i--;
    }
  }
}

/*======== end make_block_ast ========*/

/*======== make loop ast ========*/

function make_serial_loop_ast(init_vars, condition, step, block_node, nodes) {
  // vars
  var init_defs = [];
  var init_values = [];
  var next_args = [];
  var temp, index;
  if (init_vars) {
    temp = init_vars.result;
    if (temp[0] == 'var') {
      temp = temp[1];
      for (var i = 0; i < temp.length; i++) {
        var def = temp[i];
        init_defs.push(def[0]);
        init_values.push(def[1] || ['name', 'undefined']);
        next_args.push(['name', def[0]]);
      }
    }
  }

  var body = block_node.toAST();

  if (step) {
    temp = step.result;
    temp = temp[0] == 'seq' ? temp.slice(1) : [temp];
    for (var i = 0; i < temp.length; i++) {
      var ast = temp[i];
      if ((ast[0] == 'unary-postfix' || ast[0] == 'unary-prefix' || ast[0] == 'assign') &&
        ast[2][0] == 'name' &&
        (index = init_defs.indexOf(ast[2][1])) >= 0) {

        next_args[index] = ast.slice();
        if (ast[0] == 'unary-postfix') {
          next_args[index][0] = 'unary-prefix';
        }
      } else {
        body.push(['stat', ast]);
      }
    }
  }

  body.push(['stat', ['call', ['name', 'next'], next_args]]);
  var if_ast = ['if', condition.result, ['block', body]];

  if (nodes && nodes.length > 0) {
    var nodes_ast;
    if (use_nodes_fn = nodes.length > 1) {
      init_defs.push('after');
      init_values.push(['function', , [], make_nodes_ast(nodes)]);
      nodes_ast = ['call', ['name', 'after'], []];
    } else {
      nodes_ast = ['block',
        [nodes[0].toAST ? nodes[0].toAST() : nodes[0].result]];
    }
    if_ast.push(nodes_ast);
  }

  var fn_next = ['function', 'next', init_defs, [if_ast]];
  return ['stat', ['call', fn_next, init_values]];
}

/*======== end make loop ast ========*/

/*======== utils ========*/

function pushAll(arr, another) {
  if (!another) return arr;
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
  if (!another) return;
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

function filter(obj, fn) {
  if (typeof obj === 'object' && obj !== null) {
    var new_obj = Array.isArray(obj) ? [] : {};
    for (var i in obj) {
      if (fn(i, obj[i])) {
        if (Array.isArray(obj)) {
          new_obj.push(obj[i]);
        } else {
          new_obj[i] = filter(obj[i], fn);
        }
      }
    }
    return new_obj;
  }
  return obj;
}

function clone(obj, recusive) {
  // rule is Array will not clone a.a = a, will die, a.a = [a] is okay.
  if (Array.isArray(obj)) return obj.slice();
  if (typeof obj === 'object' && obj !== null) {
    var new_obj = {};
    for (var i in obj) {
      new_obj[i] = recusive ? clone(obj[i]) : obj[i];
    }
    return new_obj;
  }
  return obj;
}

/*======== ast utils ========*/

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
