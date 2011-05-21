var a, b, c, d, e, f, _done = 0;

var triggers = [ function(_index) {
    if (3 === (_done & 3)) {
        triggers.splice(_index, 1);
        foo(a, b, function(_err, _d) {
            if (_err) return cb(_err);
            d = _d;
            console.log("d=" + d);
        });
    }
}, function(_index) {
    if (5 === (_done & 5)) {
        triggers.splice(_index, 1);
        foo(a, c, function(_err, _e) {
            if (_err) return cb(_err);
            e = _e;
            console.log("e=" + e);
        });
    }
}, function(_index) {
    if (6 === (_done & 6)) {
        triggers.splice(_index, 1);
        foo(b, c, function(_err, _f) {
            if (_err) return cb(_err);
            f = _f;
            console.log("f=" + f);
        });
    }
} ];

function trigger(_flag) {
    _done |= _flag;
    for (var i = triggers.length - 1; i >= 0; i--) {
        triggers[i](i);
    }
}

foo(function(_err, _a) {
    if (_err) return cb(_err);
    a = _a;
    console.log("a=" + a);
    trigger(1);
});

foo(function(_err, _b) {
    if (_err) return cb(_err);
    b = _b;
    console.log("b=" + b);
    trigger(2);
});

foo(function(_err, _c) {
    if (_err) return cb(_err);
    c = _c;
    console.log("c=" + c);
    trigger(4);
});